import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// ata100 = 薪酬域「会员中心」的数据库。
// 它只拥有会员域的表（账号 / 验证码 / 订单 / VIP / 流水 / 限频）。
// 薪资报告归 A500 自己的库；2026-06-04 起薪酬域文档合并进 A800 doc-library
// （一库管两域，按 category='人才ATA' 过滤）——中心不存业务数据，要看就只读聚合（见 lib/history.js）。

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const DB_PATH = process.env.ATA100_DB_PATH || path.join(DATA_DIR, "ata100.db");

let _db = null;

export function getDb() {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 5000");

  // ── 1. users（账号，phone 唯一；agreed_at 记录最近一次同意协议时间）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      phone         TEXT NOT NULL UNIQUE,
      created_at    INTEGER NOT NULL,
      last_login_at INTEGER,
      agreed_at     INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  `);
  const userCols = new Set(_db.prepare("PRAGMA table_info(users)").all().map((c) => c.name));
  if (!userCols.has("agreed_at")) _db.exec("ALTER TABLE users ADD COLUMN agreed_at INTEGER");

  // ── 2. sms_codes（验证码，bcrypt hash，5min 过期）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS sms_codes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      phone      TEXT    NOT NULL,
      code_hash  TEXT    NOT NULL,
      expires_at INTEGER NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      attempts   INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone, expires_at DESC);
  `);

  // ── 3. orders（支付订单，时间制：duration_days；幂等 out_trade_no）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      out_trade_no  TEXT    NOT NULL UNIQUE,
      package_id    TEXT    NOT NULL,
      amount_cents  INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'pending',
      payer_openid  TEXT,
      payer_phone   TEXT,
      prepay_id     TEXT,
      created_at    INTEGER NOT NULL,
      paid_at       INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_trade_no ON orders(out_trade_no);
    CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(payer_phone, created_at DESC);
  `);
  // additive migration（老库无 prepay_id 列时补上）
  const orderCols = new Set(_db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name));
  if (!orderCols.has("prepay_id")) _db.exec("ALTER TABLE orders ADD COLUMN prepay_id TEXT");

  // ── 4. memberships（VIP 到期时间，phone 为 PK）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS memberships (
      phone            TEXT    PRIMARY KEY,
      vip_expire_at    INTEGER NOT NULL DEFAULT 0,
      total_paid_cents INTEGER NOT NULL DEFAULT 0,
      updated_at       INTEGER NOT NULL
    );
  `);

  // ── 5. membership_ledger（会员变更流水，幂等 related_order_id）──
  _db.exec(`
    CREATE TABLE IF NOT EXISTS membership_ledger (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      phone            TEXT    NOT NULL,
      type             TEXT    NOT NULL,
      duration_days    INTEGER NOT NULL,
      expire_before    INTEGER NOT NULL,
      expire_after     INTEGER NOT NULL,
      amount_cents     INTEGER NOT NULL DEFAULT 0,
      related_order_id TEXT,
      created_at       INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_order
      ON membership_ledger(related_order_id) WHERE related_order_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_ledger_phone ON membership_ledger(phone, created_at DESC);
  `);

  // ── 6. legal_documents（服务使用协议 / 隐私政策；admin-hub 后台编辑、前台只读）──
  // type='terms' 服务使用协议、type='privacy' 隐私政策。内容存 Markdown。
  _db.exec(`
    CREATE TABLE IF NOT EXISTS legal_documents (
      type        TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL DEFAULT '',
      updated_at  INTEGER NOT NULL
    );
  `);
  // 兜底：表为空时塞两条占位记录，admin-hub 进后台直接看到两行可编辑
  const now = Date.now();
  _db.prepare(
    "INSERT OR IGNORE INTO legal_documents(type, title, content, updated_at) VALUES (?, ?, ?, ?)"
  ).run("terms", "服务使用协议", "", now);
  _db.prepare(
    "INSERT OR IGNORE INTO legal_documents(type, title, content, updated_at) VALUES (?, ?, ?, ?)"
  ).run("privacy", "隐私政策", "", now);

  // ── 7. rate-limiter-flexible 预建表（避免首次请求 race）──
  for (const name of [
    "rl_sms_code_phone",
    "rl_sms_code_ip",
    "rl_login_phone",
    "rl_charge_phone",
    "rl_charge_ip",
  ]) {
    _db.exec(`
      CREATE TABLE IF NOT EXISTS ${name} (
        key    TEXT PRIMARY KEY,
        points INTEGER NOT NULL DEFAULT 0,
        expire INTEGER
      );
    `);
  }

  return _db;
}

export function upsertUserByPhone(phone, { recordAgreement = false } = {}) {
  const db = getDb();
  const now = Date.now();
  const existing = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone);
  if (existing) {
    if (recordAgreement) {
      db.prepare("UPDATE users SET last_login_at = ?, agreed_at = ? WHERE id = ?").run(now, now, existing.id);
    } else {
      db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, existing.id);
    }
    return existing.id;
  }
  const info = db
    .prepare("INSERT INTO users(phone, created_at, last_login_at, agreed_at) VALUES (?, ?, ?, ?)")
    .run(phone, now, now, recordAgreement ? now : null);
  return Number(info.lastInsertRowid);
}

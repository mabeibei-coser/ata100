// rate-limiter-flexible@11 提供命名导出 RateLimiterSQLite（v5 没有这个类，故必须 ^11）
import { RateLimiterSQLite } from "rate-limiter-flexible";
import { getDb } from "./db.js";

// 限频用 better-sqlite3 持久化。表名对齐 lib/db.js 已预建的 rl_* 表
// （key/points/expire 三列，tableCreated:true 跳过自动建表，避免首次 consume 的 race）。

// ── 发码限频（两层，任一层触发即拒）──
//   phone - 同手机号 60s 只能发 1 次
//   ip    - 同 IP 1 小时最多 20 次（防同源脚本刷）
let _sms = null;
function smsLimiters() {
  if (_sms) return _sms;
  const db = getDb();
  _sms = {
    phone: new RateLimiterSQLite({
      storeClient: db,
      storeType: "better-sqlite3",
      tableName: "rl_sms_code_phone",
      tableCreated: true,
      points: 1,
      duration: 60,
      blockDuration: 60,
    }),
    ip: new RateLimiterSQLite({
      storeClient: db,
      storeType: "better-sqlite3",
      tableName: "rl_sms_code_ip",
      tableCreated: true,
      points: 20,
      duration: 60 * 60,
      blockDuration: 60 * 60,
    }),
  };
  return _sms;
}

export async function checkSmsLimits(phone, ip) {
  const lim = smsLimiters();
  try {
    await lim.phone.consume(phone);
  } catch (res) {
    return { ok: false, layer: "phone", retryAfterSec: secsLeft(res) };
  }
  try {
    await lim.ip.consume(ip);
  } catch (res) {
    return { ok: false, layer: "ip", retryAfterSec: secsLeft(res) };
  }
  return { ok: true };
}

// ── 验码尝试限频：同手机号 10 分钟最多 10 次（防爆破）──
let _login = null;
function loginLimiter() {
  if (_login) return _login;
  _login = new RateLimiterSQLite({
    storeClient: getDb(),
    storeType: "better-sqlite3",
    tableName: "rl_login_phone",
    tableCreated: true,
    points: 10,
    duration: 10 * 60,
    blockDuration: 10 * 60,
  });
  return _login;
}

export async function checkVerifyLimit(phone) {
  try {
    await loginLimiter().consume(phone);
    return { ok: true };
  } catch (res) {
    return { ok: false, retryAfterSec: secsLeft(res) };
  }
}

// ── 下单限频：同手机号 5/min、同 IP 5/min（防恶意刷单产生孤立 pending 订单）──
// phone 5/min：覆盖真实用户切套餐、取消支付重选的正常操作（曾踩坑：1/min 太苛刻被误判"付费失败"）
let _charge = null;
function chargeLimiters() {
  if (_charge) return _charge;
  const db = getDb();
  _charge = {
    phone: new RateLimiterSQLite({
      storeClient: db,
      storeType: "better-sqlite3",
      tableName: "rl_charge_phone",
      tableCreated: true,
      points: 5,
      duration: 60,
      blockDuration: 60,
    }),
    ip: new RateLimiterSQLite({
      storeClient: db,
      storeType: "better-sqlite3",
      tableName: "rl_charge_ip",
      tableCreated: true,
      points: 5,
      duration: 60,
      blockDuration: 60,
    }),
  };
  return _charge;
}

export async function checkChargeLimits(phone, ip) {
  const lim = chargeLimiters();
  try {
    await lim.phone.consume(phone);
  } catch (res) {
    return { ok: false, layer: "phone", retryAfterSec: secsLeft(res) };
  }
  try {
    await lim.ip.consume(ip);
  } catch (res) {
    return { ok: false, layer: "ip", retryAfterSec: secsLeft(res) };
  }
  return { ok: true };
}

function secsLeft(res) {
  return Math.ceil((res?.msBeforeNext ?? 0) / 1000);
}

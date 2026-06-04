// 时间制 VIP 会员原语。所有 VIP 读写走这里。
// 改写自 A200 lib/wallet.ts：余额制(balance_cents 加减) → 时间制(vip_expire_at 延长)。
//
// 关键设计：
// - VIP 状态 = vip_expire_at > now（读时比对，到期自动退回普通，无需定时任务）
// - 开通/续费走 db.transaction() 原子
// - 幂等靠 membership_ledger.related_order_id 的 partial UNIQUE 索引（见 lib/db.js）：
//   同充值订单只入账 1 次 → 微信回调可能重复推送，幂等是支付的生命线
// - 续费叠加：base = max(当前到期, now)，未过期续费往后叠，已过期从 now 起

import { getDb } from "./db.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 读 VIP 到期时间戳（无记录返 0）。 */
export function getVipExpireAt(phone) {
  const db = getDb();
  const row = db.prepare("SELECT vip_expire_at FROM memberships WHERE phone = ?").get(phone);
  return row?.vip_expire_at ?? 0;
}

/** 是否 VIP（到期时间 > 现在）。 */
export function isVip(phone) {
  return getVipExpireAt(phone) > Date.now();
}

/** 会员概况：给 /api/membership/me 和个人中心用。 */
export function getMembership(phone) {
  const db = getDb();
  const row = db
    .prepare("SELECT phone, vip_expire_at, total_paid_cents, updated_at FROM memberships WHERE phone = ?")
    .get(phone);
  const vipExpireAt = row?.vip_expire_at ?? 0;
  return {
    phone,
    isVip: vipExpireAt > Date.now(),
    vipExpireAt,
    totalPaidCents: row?.total_paid_cents ?? 0,
  };
}

/** 确保 phone 有 memberships 行（sms verify 成功后调，幂等）。 */
export function ensureMembership(phone) {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO memberships(phone, vip_expire_at, total_paid_cents, updated_at) VALUES (?, 0, 0, ?)"
  ).run(phone, now);
}

/** 最近 N 条会员流水（个人中心"购买记录"用）。 */
export function getRecentLedger(phone, limit = 10) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, type, duration_days, expire_before, expire_after, amount_cents, related_order_id, created_at
       FROM membership_ledger WHERE phone = ?
       ORDER BY id DESC LIMIT ?`
    )
    .all(phone, limit);
}

/**
 * 开通/续费 VIP（微信回调 / dev mock 调用）。
 * 前提：order.status='paid' 已被 caller 标记。
 * 幂等：membership_ledger.related_order_id UNIQUE 保证同订单只入账 1 次。
 * 改写自 A200 wallet.creditFromOrder：把"加余额"换成"延长到期时间"。
 *
 * @returns {{ applied: boolean, vipExpireAt: number }} applied=false 表示重复入账（幂等命中）
 */
export function grantVipFromOrder(outTradeNo) {
  const db = getDb();
  const order = db
    .prepare(
      "SELECT id, out_trade_no, payer_phone, duration_days, amount_cents, status FROM orders WHERE out_trade_no = ?"
    )
    .get(outTradeNo);
  if (!order) throw new Error(`order ${outTradeNo} not found`);
  if (order.status !== "paid") {
    throw new Error(`order ${outTradeNo} status=${order.status}，不应入账`);
  }
  const phone = order.payer_phone;
  if (!phone) throw new Error(`order ${outTradeNo} 无 payer_phone，无法开通会员`);

  // 幂等检查：同订单已入过账（ledger UNIQUE）直接返当前到期
  const existing = db
    .prepare("SELECT expire_after FROM membership_ledger WHERE related_order_id = ?")
    .get(outTradeNo);
  if (existing) {
    return { applied: false, vipExpireAt: existing.expire_after };
  }

  const now = Date.now();
  const vipExpireAt = db.transaction(() => {
    ensureMembership(phone);
    const before = getVipExpireAt(phone);
    // 续费叠加：未过期从旧到期往后叠，已过期从 now 起
    const base = Math.max(before, now);
    const after = base + order.duration_days * DAY_MS;
    db.prepare(
      `UPDATE memberships
       SET vip_expire_at = ?, total_paid_cents = total_paid_cents + ?, updated_at = ?
       WHERE phone = ?`
    ).run(after, order.amount_cents, now, phone);
    const type = before > now ? "renew" : "activate";
    db.prepare(
      `INSERT INTO membership_ledger
        (phone, type, duration_days, expire_before, expire_after, amount_cents, related_order_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(phone, type, order.duration_days, before, after, order.amount_cents, outTradeNo, now);
    return after;
  })();

  return { applied: true, vipExpireAt };
}

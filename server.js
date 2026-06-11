import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config({ path: path.join(__dirname, ".env") });

const { default: express } = await import("express");
const { getSession } = await import("./lib/session.js");
const { getDb, upsertUserByPhone } = await import("./lib/db.js");
const bcrypt = (await import("bcryptjs")).default;
const { sendSms } = await import("./lib/smsbao.js");
const { checkSmsLimits, checkVerifyLimit, checkChargeLimits } = await import("./lib/rate-limit.js");
const { listPackages, getPackage } = await import("./lib/packages.js");
const {
  getMembership,
  ensureMembership,
  grantVipFromOrder,
  getRecentLedger,
} = await import("./lib/membership.js");
const { getSalaryHistory, getSalaryReportDetail, getDocDownloadHistory } = await import("./lib/history.js");
const { createJsapiOrder, verifyNotify } = await import("./lib/wechat-pay.js");
const {
  buildAuthorizeUrl,
  exchangeCodeForOpenid,
  isSafeFromPath,
  resolveRedirect,
} = await import("./lib/wechat-oauth.js");

const PORT = Number(process.env.ATA100_API_PORT || process.env.PORT) || 4004;
const NOTIFY_PATH = "/api/pay/wechat/notify";
const OAUTH_CALLBACK_PATH = "/api/wechat/oauth/callback";
const DEV_PAY_ENABLED = process.env.NODE_ENV !== "production" || process.env.ATA_DEV_PAY === "true";

const app = express();
// 只信最近一跳（本机 nginx）：true 会取 X-Forwarded-For 最左值，客户端可伪造绕过 IP 限频
app.set("trust proxy", 1);

// notify 路由要原始 bytes 验签，跳过全局 json；其余路由走 json。
app.use((req, res, next) => {
  if (req.path === NOTIFY_PATH) return next();
  express.json({ limit: "2mb" })(req, res, next);
});

const PHONE_RE = /^1\d{10}$/;

function requireSession(handler) {
  return async (req, res) => {
    const session = await getSession(req, res);
    if (!session.userId) {
      return res.status(401).json({ error: "请先登录" });
    }
    req.session = session;
    return handler(req, res);
  };
}


// ════════════ 短信验证码登录 ════════════

app.post("/api/sms/send", async (req, res) => {
  const phone = String(req.body?.phone || "").trim();
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: "请输入有效的 11 位手机号" });
  }
  const ip = req.ip || "unknown";
  const limit = await checkSmsLimits(phone, ip);
  if (!limit.ok) {
    const tip =
      limit.layer === "phone"
        ? `请求过于频繁，请 ${limit.retryAfterSec} 秒后再试`
        : "发送次数过多，请稍后再试";
    return res.status(429).json({ error: tip });
  }
  try {
    const code = String(crypto.randomInt(100000, 1000000)); // CSPRNG；Math.random 输出可被推算
    const codeHash = await bcrypt.hash(code, 10);
    const now = Date.now();
    getDb()
      .prepare("INSERT INTO sms_codes(phone, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .run(phone, codeHash, now + 5 * 60 * 1000, now);
    // 短信宝按「签名+正文模板」整体审核：只有报备通过的模板才会用报备签名发出，
    // 否则回退到账户默认签名（曾踩坑：ata100 自定义正文未报备 → 签名被换成【云知象限】）。
    // 与 A200 共用账户，故签名 + 正文都对齐 A200（A200 的模板已报备通过），一字不差复用其模板。
    const sign = process.env.SMSBAO_SIGN || "【谨世智能】";
    const content = `${sign}您的注册登录验证码为${code}，如非本人操作，请忽略本短信`;
    const sent = await sendSms(phone, content);
    if (!sent.ok) {
      return res.status(502).json({ error: `验证码发送失败：${sent.msg}` });
    }
    res.json({ ok: true, dev: sent.code === "DEV" });
  } catch (err) {
    console.error("[sms/send] failed:", err);
    res.status(500).json({ error: "验证码发送失败，请稍后重试" });
  }
});

app.post("/api/sms/verify", async (req, res) => {
  const phone = String(req.body?.phone || "").trim();
  const code = String(req.body?.code || "").trim();
  if (!PHONE_RE.test(phone) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "请输入手机号和 6 位验证码" });
  }
  const attempt = await checkVerifyLimit(phone);
  if (!attempt.ok) {
    return res.status(429).json({ error: `验证过于频繁，请 ${attempt.retryAfterSec} 秒后再试` });
  }
  try {
    const db = getDb();
    const now = Date.now();
    const master = process.env.MASTER_OTP_CODE || "";

    if (master && code === master) {
      // 本地联调旁路：仅当 .env.local 配了 MASTER_OTP_CODE 时生效，上线必须留空
    } else {
      const row = db
        .prepare(
          "SELECT * FROM sms_codes WHERE phone = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
        )
        .get(phone, now);
      if (!row) {
        return res.status(400).json({ error: "验证码已过期或不存在，请重新获取" });
      }
      if (row.attempts >= 5) {
        return res.status(400).json({ error: "验证码错误次数过多，请重新获取" });
      }
      const ok = await bcrypt.compare(code, row.code_hash);
      if (!ok) {
        db.prepare("UPDATE sms_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
        return res.status(400).json({ error: "验证码错误" });
      }
      db.prepare("UPDATE sms_codes SET used = 1 WHERE id = ?").run(row.id);
    }

    const userId = upsertUserByPhone(phone);
    ensureMembership(phone);

    const session = await getSession(req, res);
    session.userId = userId;
    session.phone = phone;
    session.loggedInAt = now;
    await session.save();
    res.json({ ok: true, userId, phone });
  } catch (err) {
    console.error("[sms/verify] failed:", err);
    res.status(500).json({ error: "登录失败，请稍后重试" });
  }
});

app.post("/api/logout", async (req, res) => {
  const session = await getSession(req, res);
  await session.destroy();
  res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  const session = await getSession(req, res);
  if (!session.userId) return res.status(401).json({ error: "未登录" });
  const m = getMembership(session.phone);
  res.json({
    userId: session.userId,
    phone: session.phone,
    hasOpenid: !!session.openid,
    isVip: m.isVip,
    vipExpireAt: m.vipExpireAt,
  });
});

// ════════════ 会员状态（业务产品"刷卡"契约 + 个人中心）════════════

app.get(
  "/api/membership/me",
  requireSession(async (req, res) => {
    const m = getMembership(req.session.phone);
    res.json(m);
  })
);

app.get(
  "/api/membership/ledger",
  requireSession(async (req, res) => {
    res.json({ ledger: getRecentLedger(req.session.phone, 20) });
  })
);

// 套餐列表（公开）
app.get("/api/packages", (req, res) => {
  res.json({ packages: listPackages() });
});

// ════════════ 法律文档（公开）════════════
// 服务使用协议 / 隐私政策正文，由后台「系统设置」录入到 site_settings。
// 登录页勾选项的两个链接 + LegalView 读这里；未配置时返回空串（前台显示占位）。
const LEGAL_DOCS = {
  terms: { key: "legal_terms", title: "服务使用协议" },
  privacy: { key: "legal_privacy", title: "隐私政策" },
};
app.get("/api/legal/:type", (req, res) => {
  // hasOwnProperty 守门：防 __proto__/constructor 命中原型链（同 packages.js getPackage 写法）
  const doc = Object.prototype.hasOwnProperty.call(LEGAL_DOCS, req.params.type)
    ? LEGAL_DOCS[req.params.type]
    : null;
  if (!doc) return res.status(404).json({ error: "文档不存在" });
  let row = null;
  try {
    row = getDb()
      .prepare("SELECT value, updated_at FROM site_settings WHERE key = ?")
      .get(doc.key);
  } catch {
    row = null; // 表尚未建（极早期）→ 视为空内容
  }
  res.json({
    type: req.params.type,
    title: doc.title,
    content: row?.value || "",
    updatedAt: row?.updated_at || 0,
  });
});

// ════════════ 我的历史（只读聚合各业务积木的记录）════════════

app.get(
  "/api/me/history",
  requireSession(async (req, res) => {
    const salaryReports = getSalaryHistory(req.session.phone, 50);
    const downloads = getDocDownloadHistory(req.session.phone, 50);
    res.json({ items: salaryReports, downloads });
  })
);

app.get(
  "/api/me/history/salary/:id",
  requireSession(async (req, res) => {
    const detail = getSalaryReportDetail(req.session.phone, Number(req.params.id));
    if (!detail) return res.status(404).json({ error: "记录不存在" });
    res.json(detail);
  })
);


// ════════════ 微信支付 ════════════

app.post(
  "/api/pay/wechat/order",
  requireSession(async (req, res) => {
    const pkg = getPackage(String(req.body?.packageId || ""));
    if (!pkg) return res.status(400).json({ error: "套餐不存在" });

    // JSAPI 必须 openid；没有就引导走 OAuth
    if (!req.session.openid) {
      const from = isSafeFromPath(req.body?.from) ? req.body.from : "/billing";
      return res.status(401).json({
        needOauth: true,
        redirectTo: `/api/wechat/oauth/init?from=${encodeURIComponent(from)}`,
      });
    }

    const ip = req.ip || "unknown";
    const limit = await checkChargeLimits(req.session.phone, ip);
    if (!limit.ok) {
      return res.status(429).json({ error: `操作过于频繁，请 ${limit.retryAfterSec} 秒后再试` });
    }

    try {
      const db = getDb();
      const now = Date.now();
      const outTradeNo = `ATA${now}${crypto.randomBytes(3).toString("hex")}`;
      db.prepare(
        `INSERT INTO orders(out_trade_no, package_id, amount_cents, duration_days, status, payer_openid, payer_phone, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
      ).run(outTradeNo, pkg.id, pkg.amountCents, pkg.durationDays, req.session.openid, req.session.phone, now);

      const order = await createJsapiOrder({
        outTradeNo,
        amountCents: pkg.amountCents,
        description: `薪酬查询VIP-${pkg.label}`,
        notifyUrl: process.env.ATA_WECHAT_NOTIFY_URL || `http://localhost:${PORT}${NOTIFY_PATH}`,
        openid: req.session.openid,
      });
      db.prepare("UPDATE orders SET prepay_id = ? WHERE out_trade_no = ?").run(order.prepayId, outTradeNo);

      res.json({
        ok: true,
        outTradeNo,
        jsapi: order.jsapi,
        amountCents: pkg.amountCents,
        durationDays: pkg.durationDays,
        fakeMode: order.fakeMode,
      });
    } catch (err) {
      console.error("[pay/order] failed:", err);
      res.status(500).json({ error: "下单失败，请稍后重试" });
    }
  })
);

// 查单（前端支付后轮询）
app.get(
  "/api/pay/wechat/order/:outTradeNo",
  requireSession(async (req, res) => {
    const order = getDb()
      .prepare("SELECT out_trade_no, status, package_id, duration_days FROM orders WHERE out_trade_no = ? AND payer_phone = ?")
      .get(req.params.outTradeNo, req.session.phone);
    if (!order) return res.status(404).json({ error: "订单不存在" });
    res.json({ outTradeNo: order.out_trade_no, status: order.status });
  })
);

// 微信支付回调（验签要原始 bytes，单独挂 express.raw）
app.post(NOTIFY_PATH, express.raw({ type: "*/*" }), async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  const result = verifyNotify(req.headers, rawBody);
  if (!result.ok) {
    console.error("[pay/notify] verify failed:", result.reason, result.detail || "");
    const status = result.reason === "no-config" ? 500 : 401;
    return res.status(status).json({ code: "FAIL", message: result.reason });
  }
  try {
    const db = getDb();
    const { outTradeNo, tradeState, raw } = result.resource;
    if (tradeState !== "SUCCESS") {
      return res.status(200).json({ code: "SUCCESS", message: "OK" }); // 非成功也回 200，避免微信重推
    }
    const order = db.prepare("SELECT out_trade_no, status, amount_cents FROM orders WHERE out_trade_no = ?").get(outTradeNo);
    if (!order) {
      console.error("[pay/notify] order not found:", outTradeNo);
      return res.status(200).json({ code: "SUCCESS", message: "OK" });
    }
    // 纵深防御：解密载荷里的实付金额必须与订单一致（防串单/商户配置事故入账）
    const paidTotal = raw?.amount?.total;
    if (typeof paidTotal === "number" && paidTotal !== order.amount_cents) {
      console.error("[pay/notify] 金额不符拒绝入账:", outTradeNo, "paid=", paidTotal, "order=", order.amount_cents);
      return res.status(500).json({ code: "FAIL", message: "amount mismatch" });
    }
    if (order.status !== "paid") {
      db.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE out_trade_no = ?").run(Date.now(), outTradeNo);
    }
    grantVipFromOrder(outTradeNo); // 幂等：同订单只开通 1 次
    res.status(200).json({ code: "SUCCESS", message: "OK" });
  } catch (err) {
    console.error("[pay/notify] handle failed:", err);
    res.status(500).json({ code: "FAIL", message: "internal" });
  }
});

// 本地模拟支付成功（fake mode 联调用；生产默认禁用）
app.post(
  "/api/dev/mock-paid",
  requireSession(async (req, res) => {
    if (!DEV_PAY_ENABLED) return res.status(403).json({ error: "dev mock 已禁用" });
    const outTradeNo = String(req.body?.outTradeNo || "");
    const db = getDb();
    const order = db
      .prepare("SELECT out_trade_no, status, payer_phone FROM orders WHERE out_trade_no = ?")
      .get(outTradeNo);
    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.payer_phone !== req.session.phone) return res.status(403).json({ error: "无权操作此订单" });
    if (order.status !== "paid") {
      db.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE out_trade_no = ?").run(Date.now(), outTradeNo);
    }
    const r = grantVipFromOrder(outTradeNo);
    res.json({ ok: true, applied: r.applied, vipExpireAt: r.vipExpireAt });
  })
);

// ════════════ 微信 OAuth（拿 openid）════════════

app.get(
  "/api/wechat/oauth/init",
  requireSession(async (req, res) => {
    const from = isSafeFromPath(req.query.from) ? req.query.from : "/billing";
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;
    req.session.oauthFrom = from;
    await req.session.save();
    const redirectUri = process.env.ATA_OAUTH_REDIRECT_URI || OAUTH_CALLBACK_PATH;
    res.redirect(buildAuthorizeUrl(redirectUri, state));
  })
);

app.get(
  "/api/wechat/oauth/callback",
  requireSession(async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state || state !== req.session.oauthState) {
      return res.status(400).send("OAuth state 校验失败，请重试");
    }
    try {
      const { openid } = await exchangeCodeForOpenid(String(code));
      req.session.openid = openid;
      const from = isSafeFromPath(req.session.oauthFrom) ? req.session.oauthFrom : "/billing";
      req.session.oauthState = undefined;
      req.session.oauthFrom = undefined;
      await req.session.save();
      // 子路径部署：相对回跳必须补 /ata100 前缀，否则跳到根域名邻居应用 → 404
      res.redirect(resolveRedirect(from));
    } catch (err) {
      console.error("[oauth/callback] failed:", err);
      res.status(500).send("微信授权失败，请重试");
    }
  })
);

// ── 生产模式：托管 dist/ 静态资源 ──
if (process.env.NODE_ENV === "production") {
  const distDir = path.join(__dirname, "dist");
  app.use(express.static(distDir));
  app.get("*", (req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.listen(PORT, () => {
  try {
    getDb();
    console.log(`[ata100] 会员中心 api on http://localhost:${PORT}`);
  } catch (err) {
    console.error("[ata100] DB 初始化失败:", err);
  }
});

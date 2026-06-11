// 微信支付 V3 SDK 封装（wechatpay-node-v3）—— 搬自 A200 lib/wechat-pay.ts，去 TS。
//
// 关键设计（与 A200 一致）：
// - 单例 Pay 实例，lazy init，env 不全时返回 null
// - 所有公开函数支持 fake mode：env 不全时返假参数，本地无证书也能跑完整 UI 流程
// - 回调验签 + 解密用 node:crypto 自实现（verifySignature / decryptResource 纯函数，单测友好）
// - 微信支付公钥模式：WECHAT_PAY_PUBLIC_KEY_B64 + WECHAT_PAY_PUBLIC_KEY_ID

import crypto from "node:crypto";
import WxPay from "wechatpay-node-v3";

let _wxpay = null;
let _initTried = false;

function loadConfig() {
  const appid =
    process.env.WECHAT_OFFICIAL_ACCOUNT_APPID ?? process.env.WECHAT_PAY_APP_ID;
  const mchid = process.env.WECHAT_PAY_MCH_ID;
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
  const privateKeyB64 = process.env.WECHAT_PAY_PRIVATE_KEY_B64;
  const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
  const platformCertB64 = process.env.WECHAT_PAY_PLATFORM_CERT_B64;
  if (!appid || !mchid || !serialNo || !privateKeyB64 || !apiV3Key) return null;
  return { appid, mchid, serialNo, privateKeyB64, apiV3Key, platformCertB64 };
}

/** 是否可调真微信。false = fake mode(env 不全)。 */
export function isWxPayReady() {
  return loadConfig() !== null;
}

export function getWxPay() {
  if (_initTried) return _wxpay;
  _initTried = true;
  const config = loadConfig();
  if (!config) return null;
  try {
    const privateKey = Buffer.from(config.privateKeyB64, "base64");
    const publicKey = config.platformCertB64
      ? Buffer.from(config.platformCertB64, "base64")
      : Buffer.alloc(0);
    _wxpay = new WxPay({
      appid: config.appid,
      mchid: config.mchid,
      serial_no: config.serialNo,
      publicKey,
      privateKey,
      key: config.apiV3Key,
    });
  } catch (e) {
    console.error("[wechat-pay] init failed:", e);
    _wxpay = null;
  }
  return _wxpay;
}

// ===== v3 JSAPI 下单 + 调起参数（微信内浏览器场景） =====
//
// 流程：
// 1. 后端 createJsapiOrder({ openid, ... }) → prepay_id + 调起参数
// 2. 前端 WeixinJSBridge.invoke('getBrandWCPayRequest', 6 个参数)
// 3. 用户在微信支付确认页输密码 → 微信回调 notify_url

/**
 * 创建微信 JSAPI 下单（一步到位拿到前端调起参数）。
 * env 不全 → fake mode：返假参数，本地能跑完整 UI 流程。
 * SDK 返回：{ status: 200, data: { appId, timeStamp, nonceStr, package, signType, paySign } }
 */
export async function createJsapiOrder(opts) {
  const wxpay = getWxPay();
  if (!wxpay) {
    console.warn("[wechat-pay] JSAPI fake mode: env 不全。配齐 env 即可切真。");
    const fakePrepayId = `FAKE_PREPAY_${opts.outTradeNo}`;
    return {
      prepayId: fakePrepayId,
      jsapi: makeFakePayParams(fakePrepayId, "wxFAKE"),
      fakeMode: true,
    };
  }
  const result = await wxpay.transactions_jsapi({
    description: opts.description,
    out_trade_no: opts.outTradeNo,
    notify_url: opts.notifyUrl,
    amount: { total: opts.amountCents, currency: "CNY" },
    payer: { openid: opts.openid },
  });
  const r = result;
  if (r.status !== 200 || !r.data || !r.data.package) {
    throw new Error(`微信 JSAPI 下单失败 status=${r.status} body=${JSON.stringify(result)}`);
  }
  const prepayId = r.data.package.replace(/^prepay_id=/, "");
  return { prepayId, jsapi: r.data, fakeMode: false };
}

/**
 * 用商户私钥按 V3 规范签 paySign，返回前端 WeixinJSBridge 调起所需的 6 个参数。
 * （复用订单时手动签用；正常下单走 createJsapiOrder 已含签名。）
 */
export function buildJsapiPayParams(prepayId, opts = {}) {
  const config = loadConfig();
  const appId = opts.appId ?? config?.appid;
  if (!appId) {
    return makeFakePayParams(prepayId, "wxFAKE");
  }
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString("hex");
  const packageStr = `prepay_id=${prepayId}`;
  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;

  let privateKeyPem = opts.privateKeyPem;
  if (!privateKeyPem && config) {
    privateKeyPem = Buffer.from(config.privateKeyB64, "base64").toString("utf8");
  }
  if (!privateKeyPem) {
    return makeFakePayParams(prepayId, appId);
  }

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message, "utf8");
  signer.end();
  const paySign = signer.sign(privateKeyPem, "base64");

  return { appId, timeStamp, nonceStr, package: packageStr, signType: "RSA", paySign };
}

function makeFakePayParams(prepayId, appId) {
  console.warn("[wechat-pay] buildJsapiPayParams fake mode: 私钥缺失，paySign 是占位值。");
  return {
    appId,
    timeStamp: Math.floor(Date.now() / 1000).toString(),
    nonceStr: crypto.randomBytes(16).toString("hex"),
    package: `prepay_id=${prepayId}`,
    signType: "RSA",
    paySign: "FAKE_PAYSIGN",
  };
}

/**
 * 主动查单（polling 兜底，防回调丢）。Fake mode 始终返 NOTPAY。
 */
export async function queryOrderByOutTradeNo(outTradeNo) {
  const wxpay = getWxPay();
  if (!wxpay) return { tradeState: "NOTPAY" };
  const result = await wxpay.query({ out_trade_no: outTradeNo });
  if (result.status !== 200 || !result) {
    return { tradeState: "UNKNOWN" };
  }
  return {
    tradeState: result.trade_state ?? "UNKNOWN",
    transactionId: result.transaction_id,
  };
}

// ===== 回调验签 + 解密（微信支付公钥模式） =====

const NOTIFY_HEADER_TIMESTAMP = "wechatpay-timestamp";
const NOTIFY_HEADER_NONCE = "wechatpay-nonce";
const NOTIFY_HEADER_SIGNATURE = "wechatpay-signature";
const NOTIFY_HEADER_SERIAL = "wechatpay-serial";

/** 从 Headers/普通对象提取 4 个回调 header（大小写不敏感）。缺字段返 null。 */
export function extractNotifyHeaders(rawHeaders) {
  const get = (k) => {
    if (typeof Headers !== "undefined" && rawHeaders instanceof Headers) {
      return rawHeaders.get(k) ?? undefined;
    }
    for (const [hk, hv] of Object.entries(rawHeaders)) {
      if (hk.toLowerCase() === k) return hv;
    }
    return undefined;
  };
  const timestamp = get(NOTIFY_HEADER_TIMESTAMP);
  const nonce = get(NOTIFY_HEADER_NONCE);
  const signature = get(NOTIFY_HEADER_SIGNATURE);
  const serial = get(NOTIFY_HEADER_SERIAL);
  if (!timestamp || !nonce || !signature || !serial) return null;
  return { timestamp, nonce, signature, serial };
}

/** RSA-SHA256 验签（纯函数）。publicKeyPem: 微信支付公钥 PEM。 */
export function verifySignature(rawBody, timestamp, nonce, signatureBase64, publicKeyPem) {
  const data = `${timestamp}\n${nonce}\n${rawBody}\n`;
  try {
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(data, "utf8");
    verify.end();
    return verify.verify(publicKeyPem, signatureBase64, "base64");
  } catch {
    return false;
  }
}

/** AES-256-GCM 解密 resource（纯函数）。apiV3Key 必须 32 字节。 */
export function decryptResource(ciphertextBase64, associatedData, nonce, apiV3Key) {
  const key = Buffer.from(apiV3Key, "utf8");
  if (key.length !== 32) {
    throw new Error(`API_V3_KEY 长度必须 32 字节(当前 ${key.length})`);
  }
  const buf = Buffer.from(ciphertextBase64, "base64");
  if (buf.length < 16) throw new Error("ciphertext 长度不足");
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "utf8"));
  decipher.setAuthTag(tag);
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}

/**
 * 高层入口：验签 + 解密 + 字段提取。
 * 返回 { ok:true, resource:{outTradeNo, transactionId, tradeState, raw} }
 *   或 { ok:false, reason:"bad-header"|"bad-signature"|"bad-payload"|"no-config", detail? }
 */
export function verifyNotify(rawHeaders, rawBody, opts = {}) {
  const headers = extractNotifyHeaders(rawHeaders);
  if (!headers) return { ok: false, reason: "bad-header" };

  // 防重放：回调时间戳超出 ±5 分钟窗口直接拒（V3 规范窗口；幂等索引是第二道闸）
  const tsSec = Number(headers.timestamp);
  if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 300) {
    return { ok: false, reason: "stale-timestamp", detail: `timestamp=${headers.timestamp}` };
  }

  const publicKey = opts.publicKeyPem ?? loadPublicKeyPemFromEnv();
  const publicKeyId = opts.publicKeyId ?? loadPublicKeyIdFromEnv();
  const apiV3Key = opts.apiV3Key ?? process.env.WECHAT_PAY_API_V3_KEY;
  if (!publicKey || !publicKeyId || !apiV3Key) {
    return {
      ok: false,
      reason: "no-config",
      detail:
        "WECHAT_PAY_PUBLIC_KEY_B64 / WECHAT_PAY_PUBLIC_KEY_ID / WECHAT_PAY_API_V3_KEY 未配置",
    };
  }

  if (publicKeyId !== headers.serial) {
    return {
      ok: false,
      reason: "bad-signature",
      detail: `公钥 ID 不匹配:header=${headers.serial} env=${publicKeyId}`,
    };
  }

  const sigOk = verifySignature(
    rawBody,
    headers.timestamp,
    headers.nonce,
    headers.signature,
    publicKey
  );
  if (!sigOk) return { ok: false, reason: "bad-signature" };

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: "bad-payload", detail: "JSON parse fail" };
  }
  const r = payload.resource;
  if (!r?.ciphertext || !r.nonce || typeof r.associated_data !== "string") {
    return {
      ok: false,
      reason: "bad-payload",
      detail: "resource 字段缺(ciphertext/associated_data/nonce)",
    };
  }

  let plainJson;
  try {
    plainJson = decryptResource(r.ciphertext, r.associated_data, r.nonce, apiV3Key);
  } catch (e) {
    return { ok: false, reason: "bad-payload", detail: `decrypt fail: ${e.message}` };
  }
  let plain;
  try {
    plain = JSON.parse(plainJson);
  } catch {
    return { ok: false, reason: "bad-payload", detail: "plain JSON parse fail" };
  }
  const outTradeNo = typeof plain.out_trade_no === "string" ? plain.out_trade_no : "";
  const transactionId = typeof plain.transaction_id === "string" ? plain.transaction_id : "";
  const tradeState = typeof plain.trade_state === "string" ? plain.trade_state : "UNKNOWN";
  if (!outTradeNo || !transactionId) {
    return { ok: false, reason: "bad-payload", detail: "out_trade_no / transaction_id 缺" };
  }

  return { ok: true, resource: { outTradeNo, transactionId, tradeState, raw: plain } };
}

function loadPublicKeyPemFromEnv() {
  const b64 = process.env.WECHAT_PAY_PUBLIC_KEY_B64;
  if (!b64) return null;
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function loadPublicKeyIdFromEnv() {
  return process.env.WECHAT_PAY_PUBLIC_KEY_ID || null;
}

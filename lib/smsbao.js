import crypto from "node:crypto";

const SMSBAO_URL = "https://api.smsbao.com/sms";
const TIMEOUT_MS = 8000;

// 短信宝返回纯文本数字状态码（不是 JSON），映射到中文文案。
const CODE_MAP = {
  "0": "发送成功",
  "30": "密码错误",
  "40": "账号不存在",
  "41": "余额不足",
  "43": "IP 受限",
  "50": "内容含敏感词",
  "51": "手机号格式错",
};

function md5(plain) {
  return crypto.createHash("md5").update(plain).digest("hex");
}

/**
 * 发送短信验证码。
 * - 未配 SMSBAO_USER / SMSBAO_PASS 时走 DEV 模式：不真发，把验证码打到服务端日志后返回成功。
 *   本地联调用 MASTER_OTP_CODE 登录即可，无需真短信（短信宝账户开通是 Phase 6 的人工步骤）。
 * - 8 秒硬超时（AbortController），防运营商挂起卡死 better-sqlite3 的同步 event loop。
 * - 返回结构化结果，调用方根据 ok 判断。
 */
export async function sendSms(phone, content) {
  const user = process.env.SMSBAO_USER || "";
  const pass = process.env.SMSBAO_PASS || "";
  if (!user || !pass) {
    console.log(`[smsbao] DEV 模式（未配短信宝）→ 不真发。发往 ${phone} 的内容：${content}`);
    return { ok: true, code: "DEV", msg: "DEV 模式未真实发送" };
  }

  const params = new URLSearchParams({ u: user, p: md5(pass), m: phone, c: content });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SMSBAO_URL}?${params.toString()}`, { signal: ctrl.signal });
    const code = (await res.text()).trim();
    const msg = CODE_MAP[code] || `未知错误码 ${code}`;
    if (code !== "0") console.error(`[smsbao] 发送失败 code=${code} msg=${msg} phone=${phone}`);
    return { ok: code === "0", code, msg };
  } catch (e) {
    const isAbort = e?.name === "AbortError";
    const msg = isAbort ? "短信宝请求超时" : e?.message || String(e);
    console.error(`[smsbao] error phone=${phone}: ${msg}`);
    return { ok: false, code: isAbort ? "TIMEOUT" : "ERROR", msg };
  } finally {
    clearTimeout(timer);
  }
}

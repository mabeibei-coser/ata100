import crypto from "node:crypto";

// 短期签名下载 token：让外部浏览器（用户用「在浏览器中打开」跳过去后）也能下载。
// 流程：用户在微信里挂载历史页（已登录态）→ checkLedger 顺便签发 token →
// 下载 URL 带 ?dt=xxx → 跳浏览器复制链接，外部浏览器也能用（不再需要 cookie）。
//
// 密钥复用 session password：两个共生项目本来就要保证它一致（共享 cookie）。
// scope/ref 防止 token 越权（ledger-download token 不能用来下文档）。

const SECRET = process.env.ATA_MEMBER_SESSION_PASSWORD;
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 分钟

function b64url(buf) {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signDownloadToken({ phone, scope, ref, ttlMs = DEFAULT_TTL_MS }) {
  if (!SECRET) throw new Error("ATA_MEMBER_SESSION_PASSWORD 未配置");
  const exp = Date.now() + ttlMs;
  const payload = b64url(Buffer.from(JSON.stringify({ phone, scope, ref, exp })));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyDownloadToken(token, { scope, ref }) {
  if (!SECRET || !token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot < 1 || dot === token.length - 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(b64urlDecode(payload).toString("utf8"));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
  if (data.scope !== scope) return null;
  if (String(data.ref) !== String(ref)) return null;
  return { phone: data.phone };
}

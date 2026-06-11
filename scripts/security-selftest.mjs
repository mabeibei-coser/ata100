// ATA100「钱与门」安全自测：与 ASG100 scripts/security-selftest.mjs 同源（env 名换 ATA 系）。
// 纯函数级 + 临时库（os.tmpdir），不起服务、不碰真实业务数据。
// 跑法：node scripts/security-selftest.mjs   → 全 PASS 退出码 0，任一 FAIL 退出码 1
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

process.env.ATA_MEMBER_SESSION_PASSWORD ||= "selftest-password-32bytes-minimum!!";
// 临时库：测试只用临时路径，绝不指向真实业务库
const tmpDb = path.join(os.tmpdir(), `ata100-selftest-${process.pid}.db`);
process.env.ATA100_DB_PATH = tmpDb;

const { verifySignature, decryptResource, verifyNotify } = await import("../lib/wechat-pay.js");
const { signDownloadToken, verifyDownloadToken } = await import("../lib/download-token.js");
const { isSafeFromPath } = await import("../lib/wechat-oauth.js");
const { getDb } = await import("../lib/db.js");
const { grantVipFromOrder } = await import("../lib/membership.js");

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };

// ── 1. 微信回调验签（临时 RSA 密钥对模拟微信侧签名）──
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const signMsg = (msg) => crypto.createSign("RSA-SHA256").update(msg, "utf8").sign(privPem, "base64");

const apiV3Key = "0123456789abcdef0123456789abcdef";
const encryptResource = (plainObj, aad, nonce12) => {
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(apiV3Key), Buffer.from(nonce12));
  cipher.setAAD(Buffer.from(aad));
  const enc = Buffer.concat([cipher.update(JSON.stringify(plainObj), "utf8"), cipher.final()]);
  return Buffer.concat([enc, cipher.getAuthTag()]).toString("base64");
};

const makeNotify = ({ outTradeNo = "ATATEST001", total = 3990, tsOffsetSec = 0, tamper = false, badSerial = false } = {}) => {
  const plain = { out_trade_no: outTradeNo, transaction_id: "WXTEST123", trade_state: "SUCCESS", amount: { total } };
  const nonce12 = "abcdef123456";
  const body = JSON.stringify({ resource: { ciphertext: encryptResource(plain, "transaction", nonce12), nonce: nonce12, associated_data: "transaction" } });
  const timestamp = String(Math.floor(Date.now() / 1000) + tsOffsetSec);
  const nonce = "headernonce";
  const sig = signMsg(`${timestamp}\n${nonce}\n${body}\n`);
  const headers = {
    "wechatpay-timestamp": timestamp,
    "wechatpay-nonce": nonce,
    "wechatpay-signature": tamper ? sig.slice(0, -4) + "AAAA" : sig,
    "wechatpay-serial": badSerial ? "WRONG_SERIAL" : "TEST_KEY_ID",
  };
  return { headers, body };
};
const vOpts = { publicKeyPem: pubPem, publicKeyId: "TEST_KEY_ID", apiV3Key };

let n = makeNotify();
const good = verifyNotify(n.headers, n.body, vOpts);
ok("正确签名的回调 → 通过且解出订单号/金额", good.ok === true && good.resource.outTradeNo === "ATATEST001" && good.resource.raw?.amount?.total === 3990);
n = makeNotify({ tamper: true });
ok("伪造签名的回调 → 拒绝", verifyNotify(n.headers, n.body, vOpts).ok === false);
n = makeNotify({ badSerial: true });
ok("公钥 ID 不匹配 → 拒绝", verifyNotify(n.headers, n.body, vOpts).ok === false);
n = makeNotify({ tsOffsetSec: -600 });
ok("10 分钟前的旧回调（重放）→ 拒绝", verifyNotify(n.headers, n.body, vOpts).ok === false);
{
  const a = makeNotify(); const b = makeNotify({ outTradeNo: "ATAEVIL999" });
  ok("签名与 body 不配套（掉包）→ 拒绝", verifyNotify(a.headers, b.body, vOpts).ok === false);
}
ok("verifySignature 纯函数：篡改 body 验不过", verifySignature("tampered", "1", "2", signMsg("1\n2\noriginal\n"), pubPem) === false);

// ── 2. AES-GCM 解密 ──
const ct = encryptResource({ hello: 1 }, "aad", "abcdef123456");
ok("GCM 正常解密往返", JSON.parse(decryptResource(ct, "aad", "abcdef123456", apiV3Key)).hello === 1);
ok("GCM 篡改密文 → 抛错拒绝", (() => { try { decryptResource(ct.slice(0, -8) + "AAAAAAAA", "aad", "abcdef123456", apiV3Key); return false; } catch { return true; } })());

// ── 3. 下载 token（HMAC）──
const t = signDownloadToken({ phone: "13800000000", scope: "ledger-download", ref: "days=3" });
ok("有效 token → 通过", verifyDownloadToken(t, { scope: "ledger-download", ref: "days=3" })?.phone === "13800000000");
ok("scope 不符（越权用途）→ 拒绝", verifyDownloadToken(t, { scope: "doc-download", ref: "days=3" }) === null);
ok("篡改 token → 拒绝", verifyDownloadToken(t.slice(0, -3) + "abc", { scope: "ledger-download", ref: "days=3" }) === null);
const tExp = signDownloadToken({ phone: "13800000000", scope: "ledger-download", ref: "days=3", ttlMs: -1000 });
ok("过期 token → 拒绝", verifyDownloadToken(tExp, { scope: "ledger-download", ref: "days=3" }) === null);

// ── 4. 开放重定向防御 ──
ok("协议相对 //evil.com → 拒绝", isSafeFromPath("//evil.com") === false);
ok("外部域名 → 拒绝", isSafeFromPath("https://evil.com/x") === false);
ok("含换行（响应拆分）→ 拒绝", isSafeFromPath("/billing\r\nSet-Cookie:x=1") === false);
ok("站内相对路径 → 放行", isSafeFromPath("/billing") === true);

// ── 5. 充值幂等 + 续费叠加（临时库）──
const db = getDb();
const now = Date.now();
const insOrder = db.prepare(`INSERT INTO orders(out_trade_no, package_id, amount_cents, duration_days, status, payer_phone, created_at, paid_at) VALUES (?,?,?,?,'paid','13800000000',?,?)`);
insOrder.run("ATATEST001", "pkg_3m", 3990, 92, now, now);
const r1 = grantVipFromOrder("ATATEST001");
const r2 = grantVipFromOrder("ATATEST001");
ok("首次入账 applied=true", r1.applied === true);
ok("同订单重复回调 → 幂等命中不重复开通", r2.applied === false && r2.vipExpireAt === r1.vipExpireAt);
ok("会员流水只有 1 条", db.prepare("SELECT COUNT(*) c FROM membership_ledger WHERE related_order_id='ATATEST001'").get().c === 1);
insOrder.run("ATATEST002", "pkg_3m", 3990, 92, now, now);
const r3 = grantVipFromOrder("ATATEST002");
ok("未过期续费 → 在旧到期时间上叠加 92 天", r3.applied === true && r3.vipExpireAt === r1.vipExpireAt + 92 * 86400000);

// ── 6. 源码级红线 ──
const serverSrc = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
ok("验证码不再用 Math.random（已换 CSPRNG）", !serverSrc.includes("Math.random()"));
ok("trust proxy 不为 true（防 X-Forwarded-For 伪造绕限频）", !/trust proxy",\s*true/.test(serverSrc));
ok("notify 含金额一致性校验", serverSrc.includes("amount mismatch"));
ok("legal 接口有 hasOwnProperty 守门", serverSrc.includes("hasOwnProperty.call(LEGAL_DOCS"));

console.log(`\n${pass} PASS / ${fail} FAIL`);
try { db.close(); } catch {}
for (const f of [tmpDb, tmpDb + "-wal", tmpDb + "-shm"]) { try { fs.unlinkSync(f); } catch {} }
process.exit(fail ? 1 : 0);

import { getIronSession } from "iron-session";

// 薪酬域「共享会员 cookie」。
// ata100 中心是这个 cookie 的【唯一签发者】；A600/A800 等业务产品用同名同密钥
// 只读解析它拿 phone（见各业务产品的 session.js）。
//
// 多会员域分隔：薪酬域将来用另一个 cookieName + 另一个密钥，两域 cookie 浏览器并存、
// 互不解密 → VIP 天然不互通。
//
// ⚠️ 跨进程共享前提：所有进程的 cookieName + password + cookieOptions(尤其 path/sameSite)
// 必须逐字节一致，否则一方写的另一方解不开。

export const COOKIE_NAME = "ata_member_session";

export const sessionOptions = {
  password: process.env.ATA_MEMBER_SESSION_PASSWORD,
  cookieName: COOKIE_NAME,
  cookieOptions: {
    secure:
      process.env.ATA_COOKIE_SECURE !== "false" &&
      process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    // path 必须保持 "/"：A500(/a500/)、A800(/a800/) 与本中心(/ata100/) 不共享路径前缀，
    // 收窄到任一前缀都会让其余产品收不到 cookie。跨域隔离靠密钥（别的域解不开密文），不靠 path。
    path: process.env.ATA_COOKIE_PATH || "/",
    maxAge: 60 * 60 * 24 * 30,
  },
};

export async function getSession(req, res) {
  if (!sessionOptions.password) {
    throw new Error("ATA_MEMBER_SESSION_PASSWORD env 未配置");
  }
  return getIronSession(req, res, sessionOptions);
}

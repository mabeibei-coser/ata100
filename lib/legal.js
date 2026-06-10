import { getDb } from "./db.js";

// 服务使用协议 / 隐私政策：admin-hub 后台编辑、ATA100 前台只读。
// 表 schema 见 lib/db.js 第 6 段。
export const LEGAL_TYPES = ["terms", "privacy"];

export function getLegal(type) {
  if (!LEGAL_TYPES.includes(type)) return null;
  return getDb()
    .prepare("SELECT type, title, content, updated_at FROM legal_documents WHERE type = ?")
    .get(type);
}

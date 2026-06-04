// 个人历史聚合：中心【只读】挂载各业务积木的库，按当前登录 phone 聚合"我的记录"。
// 铁律：只 SELECT，绝不写别人的库。
// 设计：用独立只读连接，避免 ATTACH 污染会员库的主连接。
// 业务库不存在 → 捕获后返空。

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const SALARY_DB_PATH =
  process.env.ATA_SALARY_DB_PATH ||
  path.join(PROJECT_ROOT, "..", "A500-薪资查询-salary-report", "data", "salary-report.db");

const DOC_DB_PATH =
  process.env.ATA_DOC_DB_PATH ||
  path.join(PROJECT_ROOT, "..", "ata-doc-library", "data", "doc-library.db");

/**
 * 查"我的"薪资查询历史（只读 A500 reports）。
 */
export function getSalaryHistory(phone, limit = 50) {
  if (!phone) return [];
  if (!fs.existsSync(SALARY_DB_PATH)) return [];
  let db;
  try {
    db = new Database(SALARY_DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("busy_timeout = 5000");
    const rows = db
      .prepare(
        `SELECT id, position, company, rank, rank_label, education, city, created_at
         FROM reports WHERE user_phone = ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(phone, limit);
    return rows.map((r) => ({
      id: r.id,
      source: "salary",
      position: r.position,
      company: r.company,
      rank: r.rank,
      rankLabel: r.rank_label || r.rank,
      education: r.education,
      city: r.city,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error("[history] 读 A500 reports 失败:", err?.message || err);
    return [];
  } finally {
    if (db) db.close();
  }
}

/**
 * 查单条薪资报告详情（含完整 report_json）。
 * 必须校验 user_phone === 当前 phone，防越权。
 */
export function getSalaryReportDetail(phone, reportId) {
  if (!phone || !reportId) return null;
  if (!fs.existsSync(SALARY_DB_PATH)) return null;
  let db;
  try {
    db = new Database(SALARY_DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("busy_timeout = 5000");
    const row = db
      .prepare(
        `SELECT id, user_phone, position, company, rank, rank_label, education, city,
                report_json, created_at
         FROM reports WHERE id = ? AND user_phone = ?`
      )
      .get(reportId, phone);
    if (!row) return null;
    let report = null;
    try {
      report = JSON.parse(row.report_json);
    } catch {
      report = null;
    }
    return {
      id: row.id,
      source: "salary",
      position: row.position,
      company: row.company,
      rank: row.rank,
      rankLabel: row.rank_label || row.rank,
      education: row.education,
      city: row.city,
      report,
      createdAt: row.created_at,
    };
  } catch (err) {
    console.error("[history] 读 A500 报告详情失败:", err?.message || err);
    return null;
  } finally {
    if (db) db.close();
  }
}

/**
 * 查"我的"文档下载记录（只读 ata-doc-library document_downloads）。
 */
export function getDocDownloadHistory(phone, limit = 50) {
  if (!phone) return [];
  if (!fs.existsSync(DOC_DB_PATH)) return [];
  let db;
  try {
    db = new Database(DOC_DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("busy_timeout = 5000");
    const rows = db
      .prepare(
        `SELECT id, document_id, document_title, action, created_at
         FROM document_downloads WHERE user_phone = ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(phone, limit);
    return rows.map((r) => ({
      id: r.id,
      source: "doc",
      documentId: r.document_id,
      title: r.document_title,
      action: r.action,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error("[history] 读 ata-doc-library 下载记录失败:", err?.message || err);
    return [];
  } finally {
    if (db) db.close();
  }
}

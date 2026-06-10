// VIP 套餐配置（时间制，都是 VIP 价）。
// 改套餐 = 改本文件 + 重启 server，不需要 DB 迁移。
// 语义对照 A200：A200 是余额制(creditCents→到账余额)，ata100 是时间制(durationDays→VIP 时长)。

/** @typedef {{ id: string, label: string, amountCents: number, durationDays: number, badge: string|null, originalAmountCents?: number }} Package */

/** @type {Record<string, Package>} */
export const PACKAGES = {
  pkg_3m: {
    id: "pkg_3m",
    label: "3 个月",
    amountCents: 3990, // 39.9 元
    durationDays: 92,
    badge: null,
  },
  pkg_6m: {
    id: "pkg_6m",
    label: "6 个月",
    amountCents: 6990, // 69.9 元
    durationDays: 184,
    badge: "超值推荐",
  },
  pkg_12m: {
    id: "pkg_12m",
    label: "12 个月",
    amountCents: 7990, // 79.9 元
    originalAmountCents: 15990, // 159.9 元，前端展示划线价
    durationDays: 366,
    badge: "限时5折",
  },
};

export const PACKAGE_ORDER = ["pkg_3m", "pkg_6m", "pkg_12m"];

export function getPackage(id) {
  return Object.prototype.hasOwnProperty.call(PACKAGES, id) ? PACKAGES[id] : null;
}

export function listPackages() {
  return PACKAGE_ORDER.map((id) => PACKAGES[id]);
}

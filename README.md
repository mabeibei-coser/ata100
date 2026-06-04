# ata100 · 薪酬域会员中心

薪酬域的统一「会员卡中心」：手机号短信验证码登录 + 时间制 VIP 会员（微信支付）+ 个人中心（跨产品历史聚合）。它本身不做识别等业务功能，是给薪酬域各产品共用的「登录 + 付费 + 身份」底座。

谁在用 / 用在哪：A600 薪资查询、A800 岗位全景文档都依赖它登录和验 VIP——用户在那些产品里点登录会跳到这里，开通的 VIP 在全域通用。上线地址 `https://h100.jsai100.com/ata100/`（端口 4002）。代码最初从 A600 复制起步再改造，所以仓库里仍保留少量 A600 的痕迹（如 `reports` 表）。

## 技术栈

- **前端**：React 18 + Vite + MUI（Material UI 9.x）
- **后端**：Node.js + Express + better-sqlite3（WAL）+ iron-session
- **登录**：短信宝（smsbao）验证码 + bcrypt + rate-limiter-flexible 限频
- **支付**：微信支付 V3 JSAPI（wechatpay-node-v3）+ 公众号网页 OAuth 拿 openid
- **部署**：腾讯云 Lighthouse + pm2 + nginx 子路径反代

## 本机跑起来

```bash
npm install

# 配 env（首次）
cp .env.local.example .env.local
# 至少填 ATA_MEMBER_SESSION_PASSWORD（48 字节随机串）
# 本地联调可用 MASTER_OTP_CODE=888888 绕过真实短信（上线必须删）
# 密钥生成：node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

npm run dev
# vite: http://localhost:3000   api: http://localhost:4002
```

不配短信宝 / 微信凭证时，短信走 DEV 模式（验证码打到 server 日志）、支付走 fake 模式，全链路本地可验。

## 架构要点

- **一张会员卡全域通用**：登录 cookie（`ata_member_session`）设 `Path=/`，A600 / A800 都能读到同一份登录态，实现跨产品免登 + VIP 共享。三个产品的 `ATA_MEMBER_SESSION_PASSWORD` 必须填同一个值。
- **时间制 VIP**：套餐按时长（3/6/12 月）算，付款后写 `memberships.vip_expire_at`，不是按次扣费。
- **个人中心只读聚合**：`lib/history.js` 以【只读】方式挂载 A600 的 `hazard-detect.db` 和 A800 的 `doc-library.db`，按当前登录手机号聚合「我的识别记录 / 我的下载记录」——绝不写别人的库。
- **微信支付闭环**：下单 → JSAPI 拉起 → 回调验签（原始 bytes）→ 幂等开通 VIP；下单前需先走公众号 OAuth 拿 openid。

## 主要 API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/sms/send` | 发验证码（限频：同号 60s、同 IP 1h 20 次） |
| POST | `/api/sms/verify` | 验码登录（错码 5 次锁定，自动建会员行） |
| GET | `/api/me` | 当前登录态 |
| POST | `/api/logout` | 退出 |
| GET | `/api/membership/me` | 我的会员状态（业务产品「刷卡」契约） |
| GET | `/api/membership/ledger` | 我的开通流水 |
| GET | `/api/packages` | 套餐列表（公开） |
| GET | `/api/me/history` | 我的历史（聚合 A600 识别 + A800 下载） |
| POST | `/api/pay/wechat/order` | 微信下单（需 openid，无则引导 OAuth） |
| POST | `/api/pay/wechat/notify` | 微信支付回调（验签 + 开通 VIP） |
| GET | `/api/wechat/oauth/init`、`/callback` | 公众号网页授权拿 openid |

## 数据与目录

- DB：`data/ata100.db`（better-sqlite3 + WAL），首次启动自动建表（users / reports / sms_codes / orders / memberships / membership_ledger / documents / document_downloads + 5 张 `rl_*` 限频表）。
- `lib/`：`session.js`（iron-session）、`db.js`、`smsbao.js`、`rate-limit.js`、`packages.js`、`membership.js`、`history.js`、`wechat-pay.js`、`wechat-oauth.js`。
- 部署清单见 `deploy/DEPLOY.md`（薪酬域三产品一起上线的顺序、cookie 共享验证、回滚预案）。
- 环境变量完整清单见 `.env.local.example` / `deploy/env.production.example`。

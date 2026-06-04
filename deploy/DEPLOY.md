# 薪酬域三产品部署清单

> 会员中心(ata100) + 薪资查询(A600改造版) + 岗位全景文档(A800) 一起上线。
> 网址：会员中心 `/ata100/`、识别 `/a600/`、文档库 `/a800/`，同域 `h100.jsai100.com`。
> 服务器：腾讯云 124.222.114.47，端口 ata100=4002 / A600=4001 / A800=4003。

## ⚠️ 为什么三个必须一起上（不能单独上 A600）

A600 改造版的登录依赖会员中心。**若中心没上线或短信没通，A600 老用户点登录会跳到一个登不进的中心，砸生产。** 所以顺序铁律：**中心先起 → 短信验证通 → 再放 A600 改造版**。

---

## 第一步：你的人工操作（约 2 分钟，只有你能做）

### 1. 微信支付授权目录 —— ✅ 无需操作
- 2026-06-01 已确认：商户后台支付授权目录配的是**根域名** `https://h100.jsai100.com`，
  前缀匹配覆盖全站所有子路径，ata100 的 `/ata100/` 自动覆盖。**不用加任何东西。**

### 2. 确认短信宝账户可用（2 分钟）
- 复用 A200 的短信宝账户，不用重开。
- 确认账户**有余额**（验证码一条几分钱）。
- 确认报备的签名（A200 .env.local 里的 `SMSBAO_SIGN` 值）——ata100 会用同一个。

### 3. OAuth 网页授权域名（0 分钟，已配过）
- 你归档记录显示 `h100.jsai100.com` 已在公众号「网页授权域名」里。**无需操作。**

> 凭证值不要贴聊天。部署时从 `D:\_workspace\.secrets\wechatpay\1683774591\` 和 A200 的 .env.local 取，填进服务器的 .env。

---

## 第二步：模型执行（你说"开始部署"后我做）

### 端口与进程
| 产品 | 端口 | pm2 进程名 | 启动顺序 |
|---|---|---|---|
| ata100 会员中心 | 4002 | ata100 | **1（先起）** |
| A600 识别改造版 | 4001 | hazard-detect | 3（最后，确认中心+短信通了） |
| A800 文档库 | 4003 | doc-library | 2 |

### 每个产品的 .env 关键项（照各自 deploy/env.*.example）
- **三产品 `ATA_MEMBER_SESSION_PASSWORD` 必须填同一个值**（cookie 共享命门）
- 三产品 `ATA_COOKIE_PATH=/` + `ATA_COOKIE_SECURE=true`
- ata100 额外：微信 8 项凭证 + `ATA_WECHAT_NOTIFY_URL` + `ATA_OAUTH_REDIRECT_URI` + `ATA_ALLOWED_HOST=h100.jsai100.com` + 短信 3 项 + **删 MASTER_OTP_CODE**
- A600/A800 额外：`ATA_CENTER_BASE_URL=http://127.0.0.1:4002` + `VITE_CENTER_URL=https://h100.jsai100.com/ata100/`

### nginx
照 `ata100/deploy/nginx.conf.example` 追加三个 location 块。**A600 的 /a600 块要替换旧的**（旧的是无验证码版）。`nginx -t` 通过再 reload。

### 构建注意（子路径编译时内嵌）
`VITE_BASE_PATH` 是**编译时**写进前端的，每个产品 build 前必须先设对自己的子路径，否则前端请求路径错。

---

## 第三步：上线后必验（DevTools 实测，不能只 curl）

> cookie 跨产品共享是这套架构的命门，**必须用浏览器 DevTools 实测**（admin-hub 5 小时血泪教训）。

1. **登录**：访问 `/ata100/`，手机号收到真实验证码（不是 DEV 模式日志）→ 登录成功
2. **cookie 范围**：F12 → Application → Cookies → 确认 `ata_member_session` 的 **Path = `/`**（不是 /ata100）
3. **跨产品认登录**：登录后访问 `/a600/`，**不跳登录页**、右上角显示手机号 → cookie 共享成立
4. **跨产品回跳**：未登录访问 `/a600/` → 点登录 → 跳中心 → 登录完**跳回 /a600/**（不是停在中心首页）← 这是刚修的 bug，重点验
5. **真支付**：开通 VIP → 微信真扫码付 0.01 → 回调 → VIP 到期写入（看 pm2 logs 有没有收到 notify）
6. **VIP 闭环**：付完回 A600 下台账成功、回文档库下 VIP 档成功

### 出问题的排查锚点
- 验证码收不到 → 短信宝余额？签名对不对？pm2 logs 看 `[smsbao]` 错误码
- 登录完跳不回 A600 → `ATA_ALLOWED_HOST` 配了没？DevTools 看 from 参数
- 支付调不起 → 商户后台支付授权目录加了 `/ata100/` 没？
- 回调没反应 → notify_url 公网可达？nginx 有没有把 /ata100/api/pay/wechat/notify 放行

---

## 回滚预案
- A600 出问题：`git checkout main`（回 v1.0.14 无验证码版）+ pm2 restart + 改回旧 nginx 块
- 中心/文档库出问题：pm2 stop，不影响 A600 老版本（前提是 A600 还没切）

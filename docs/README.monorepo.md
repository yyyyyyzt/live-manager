# 直播 Demo — Monorepo 快速上手

本仓库基于 pnpm workspace，一条命令拉起管理端 Web、管理端 API、审核服务。完整背景请阅读 [`docs/progress.md`](./progress.md)。

## 目录结构

```
live-demo/
├── docs/                         # 本文档、契约、进度
├── packages/
│   ├── common/                   # @live-manager/common（共享业务与工具）
│   ├── server/                   # livekit-manager-server（管理端 Node API）
│   ├── vue3/                     # livekit-manager-vue3（Vite + Naive UI 前端）
│   └── audit-server/             # @live/audit-server（评论先审后发）
├── pnpm-workspace.yaml
└── package.json
```

## 端口与默认地址

| 服务 | 包 | 默认端口 | 备注 |
|------|----|----------|------|
| Web | `livekit-manager-vue3` | `5173` | Vite dev server，`base=/vue/` |
| API | `livekit-manager-server` | `9000` | 通过 `PORT` 环境变量可改 |
| Audit | `@live/audit-server` | `3080` | 通过 `AUDIT_PORT` 环境变量可改 |

前端已在 `packages/vue3/vite.config.ts` 中配置：
- `/audit-api` → `http://127.0.0.1:3080`

## 环境变量

### `packages/server`

| 变量 | 说明 |
|------|------|
| `SDK_APP_ID` | 腾讯云 TRTC SDKAppID（必填，单实例模式） |
| `SECRET_KEY` | 对应密钥（**仅用于本地 Demo**，生产请服务端签发） |
| `USER_ID` | 管理员 userID，默认 `administrator` |
| `PORT` | 服务端口，默认 `9000` |
| `DOMAIN` | 可覆盖默认 TRTC 控制台域名 |
| `HOST_ENTRY_SECRET` | 主播入口 token 的 HMAC 密钥（不设置时回退到 `SECRET_KEY`） |
| `STORAGE_PROVIDER`, `COS_*`, `CUSTOM_*` | 上传能力配置（可选） |

### `packages/audit-server`

| 变量 | 说明 |
|------|------|
| `AUDIT_PORT` | 服务端口，默认 `3080` |
| `AUDIT_ADMIN_TOKEN` | 管理接口令牌，默认 `dev-admin-token`（请求头 `X-Admin-Token`） |
| `MANAGER_API_BASE` | 管理端 API 前缀，默认 `http://127.0.0.1:9000/api` |
| `PUSH_APPROVED_TO_ROOM` | 设为 `1` 时 approve 后把评论下发到房间（IM 群消息） |
| `PUSH_ADMIN_SDK_APP_ID` / `PUSH_ADMIN_USER_ID` / `PUSH_ADMIN_USER_SIG` | 代发时使用的管理员凭证（可选） |

## 一键启动

```bash
pnpm install
SDK_APP_ID=1400000001 SECRET_KEY=<your-secret> USER_ID=administrator pnpm dev
```

`pnpm dev` 会通过 `concurrently` 同时启动 Web / API / Audit 三个进程并在同一终端以不同颜色呈现：

```
web    VITE ready in XXX ms  -> http://localhost:5173
server Express server started on port: 9000
audit  [audit-server] http://127.0.0.1:3080
```

## 关键链路

1. **建场**：管理端 `/room-list` → 新建直播间。
2. **生成主播链接**：列表每行「主播链接」→ `POST /api/host_entry/issue` 返回短期 token → 前端拼接 `#/host?token=...` → 复制到剪贴板。
3. **主播进房**：打开链接 → `POST /api/host_entry/consume` 换取 `sdkAppId + userId + userSig` → TUILogin → 后续推流由接入方挂载 TUILiveKit 组件完成。
4. **观众评论**：`/viewer-smoke` 投稿 → audit-server `enqueue` 待审。
5. **审核通过**：管理端或 curl 调 `POST /api/v1/comments/:id/approve`（或契约路径 `/api/moderation/comments/:id/approve`）→ 若启用 `PUSH_APPROVED_TO_ROOM`，评论作为 IM 群消息送入房间。

## 审核契约

[`docs/AUDIENCE_MODERATION_CONTRACT.md`](./AUDIENCE_MODERATION_CONTRACT.md) 为契约目标形态，`@live/audit-server` 同时提供：
- 当前工程在用路径：`/api/v1/rooms/:roomId/comments[/pending|/published]`、`/api/v1/comments/:id/approve|reject`
- 契约路径：`/api/moderation/comments[/pending|/published]`、`/api/moderation/comments/:commentId/approve|reject`

两组路由共享内存存储，不再重复实现。

## 构建与部署

```bash
pnpm build                                # 构建 Web（默认主交付物）
pnpm --filter livekit-manager-vue3 build  # 单独构建
pnpm --filter livekit-manager-server start
```

Web 构建产物默认写入 `packages/vue3/dist/`，可由 `packages/server` 直接托管（见 `src/index.js` 的 `/vue/*` 静态路由）。

## SWAP 指南

- **Redis 版评论存储**：按 `packages/audit-server/src/store.js` 文件顶部注释的 `KEY` 设计，实现一个 `RedisCommentStore` 模块，保持 `enqueue / listPending / listPublished / get / setStatus / snapshotJson` 签名一致，然后替换 `index.js` 的 `import`。
- **生产鉴权**：管理端接口和 audit 管理接口请在网关层完成 Token / IP / 频控，README 中的默认 Token 仅适用于开发联调。

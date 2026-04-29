# 直播 Demo — Monorepo 快速上手

本仓库基于 pnpm workspace，一条命令拉起管理端 Web 与管理端 API。完整背景请阅读 [`docs/progress.md`](./progress.md)。

## 目录结构

```
live-demo/
├── docs/                         # 本文档、契约、进度
├── archive/                      # 历史代码快照，不参与构建
├── packages/
│   ├── common/                   # @live-manager/common（共享业务与工具）
│   ├── server/                   # livekit-manager-server（管理端 Node API）
│   └── vue3/                     # livekit-manager-vue3（Vite + Naive UI 前端）
├── pnpm-workspace.yaml
└── package.json
```

> 仓库根目录旧的 `index.html / src / public / upload-server / vite.config.ts` 已迁至 [`archive/legacy-tuilivekit-root`](../archive/legacy-tuilivekit-root/README.md) 和 [`archive/legacy-upload-server`](../archive/legacy-upload-server/README.md)。

## 端口与默认地址

| 服务 | 包 | 默认端口 | 备注 |
|------|----|----------|------|
| Web | `livekit-manager-vue3` | `5173` | Vite dev server，`base=/vue/` |
| API | `livekit-manager-server` | `9000` | 通过 `PORT` 环境变量可改 |

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

## 一键启动

```bash
pnpm install
SDK_APP_ID=1400000001 SECRET_KEY=<your-secret> USER_ID=administrator pnpm dev
```

`pnpm dev` 会通过 `concurrently` 同时启动 Web / API 两个进程并在同一终端以不同颜色呈现：

```
web    VITE ready in XXX ms  -> http://localhost:5173
server Express server started on port: 9000
```

## 关键链路

1. **建场**：管理端 `/room-list` → 新建直播间。
2. **生成主播链接**：列表每行「主播链接」→ `POST /api/host_entry/issue` 返回短期 token → 前端拼接 `#/host?token=...` → 复制到剪贴板。
3. **主播进房**：打开链接 → `POST /api/host_entry/consume` 换取 `sdkAppId + userId + userSig` → TUILogin → 后续推流由接入方挂载 TUILiveKit 组件完成。

## 构建与部署

```bash
pnpm build                                # 构建 Web（默认主交付物）
pnpm --filter livekit-manager-vue3 build  # 单独构建
pnpm --filter livekit-manager-server start
```

Web 构建产物默认写入 `packages/vue3/dist/`，可由 `packages/server` 直接托管（见 `src/index.js` 的 `/vue/*` 静态路由）。

## SWAP 指南

- **生产鉴权**：管理端接口请在网关层完成 Token / IP / 频控，README 中的默认配置仅适用于开发联调。

# Live Demo（Monorepo）

基于 pnpm workspace 的直播后台 + 主播联调 Demo。采用 **单 Vite 前端 + Node 管理 API**：

```
live-demo/
├── packages/
│   ├── common/          # @live-manager/common（共享业务与工具）
│   ├── server/          # livekit-manager-server（Node 管理 API，含上传 / trtc_proxy / host_entry）
│   └── vue3/            # livekit-manager-vue3（Vite + Naive UI 前端）
├── docs/                # 工程文档（见下）
├── archive/             # 历史代码快照（见 archive/README.md）
└── pnpm-workspace.yaml
```

## 快速上手

```bash
pnpm install
SDK_APP_ID=<你的 SDKAppID> \
SECRET_KEY=<你的 SecretKey> \
USER_ID=administrator \
pnpm dev
```

`pnpm dev` 通过 `concurrently` 同时拉起两个进程：

| 名称 | 包 | 默认端口 | 备注 |
|------|----|----------|------|
| Web | `livekit-manager-vue3` | `5173` | Vite dev，`base=/vue/` |
| API | `livekit-manager-server` | `9000` | Node / Express |

进入 `http://localhost:5173/vue/` 即可访问管理端主界面。

> 更细颗粒（端口、env、契约对照）请阅读 [`docs/README.monorepo.md`](./docs/README.monorepo.md)。

## 关键链路

1. **建场**：管理端 `/room-list` → 新建直播间。
2. **主播入口**：列表每行「主播链接」→ 调 `POST /api/host_entry/issue` 获取 HMAC 短期 token（默认 5 分钟 TTL）→ 前端拼接 `#/host?token=...` → 一键复制。
3. **主播登录**：打开链接 → `POST /api/host_entry/consume` 换取 `sdkAppId + userId + userSig` → TUILogin。后续推流请自行挂载 `TUILiveKit` 组件。

## 构建

```bash
pnpm build                                # 构建 Web（默认主交付物）
pnpm --filter livekit-manager-vue3 build  # 单独构建前端
pnpm --filter livekit-manager-server start
```

构建产物默认写入 `packages/vue3/dist/`，可由 `packages/server` 直接托管（见 `src/index.js` 的 `/vue/*` 静态路由）。

## 文档索引

| 文档 | 用途 |
|------|------|
| [`docs/README.monorepo.md`](./docs/README.monorepo.md) | 端口、环境变量、`pnpm dev` 与契约对照 |
| [`docs/progress.md`](./docs/progress.md) | Harness 式分阶段进度 / 验收 Gate |
| [`docs/pnpm-workspace.md`](./docs/pnpm-workspace.md) | workspace 布局与构建约定 |
| [`docs/coding-style.md`](./docs/coding-style.md) | Vue 3 + Naive UI 编码规范 |
| [`archive/README.md`](./archive/README.md) | 已归档的历史代码与配置说明 |

## 相关

- 官方 TUILiveKit 示例：<https://github.com/Tencent-RTC/TUILiveKit>
- TRTC Live 产品概述：<https://cloud.tencent.com/document/product/647/105438>
- 开通 LiveKit 服务：<https://cloud.tencent.com/document/product/647/105439>

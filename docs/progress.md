# Live Demo 执行进度（Harness 式）

本文档为**分步执行清单**：按阶段顺序推进，每阶段有 **Gate（门禁）**；完成一项请勾选 `[x]`，便于评审与复盘。

**关联文档**

- [pnpm 工作区与构建](pnpm-workspace.md)
- [前端编码范式（Naive UI）](coding-style.md)
- [观众侧评论审核 HTTP 契约](AUDIENCE_MODERATION_CONTRACT.md)（文档中的 `/api/moderation/...` 为契约目标形态；**当前仓库** `packages/audit-server` 路由为 `/api/v1/...`，`packages/vue3` 开发态经 Vite 将 **`/audit-api` → `http://localhost:3080`**，联调以代理与 `audit-server` 代码为准。）

**一键启动（目标态）**

```bash
# 仓库根目录
pnpm install
pnpm dev
```

应同时拉起：`livekit-manager-vue3`（单 Vite）、`livekit-manager-server`、`@live/audit-server`。

---

## Phase A — Monorepo 与工程基线

- [x] 根目录 `pnpm-workspace.yaml` 纳入 `packages/*`
- [x] 根 `package.json`：`pnpm dev` 使用 `concurrently` 多进程
- [x] 去除子包孤立 `pnpm-lock.yaml`（以根 lockfile 为准）
- [ ] 归档或移除根目录旧 TUILiveKit 独立应用（仅保留 `packages/vue3` 为唯一前端工程）— *可选，见 `archive/legacy-tuilivekit-root/README.md`*
- [x] **Gate A**：`pnpm install` 成功；`pnpm --filter livekit-manager-vue3 build` 通过（`vue-tsc -b && vite build`）

---

## Phase B — 单 Vite + Naive UI 前端

- [x] 移除 TDesign / Tailwind，接入 **Naive UI** + `unplugin-vue-components`
- [x] `App.vue`：`NConfigProvider` + Message/Dialog/Notification Provider
- [x] 全局反馈：`src/utils/message.ts`（`createDiscreteApi`）
- [x] `packages/vue3` 源码：**无** `tdesign-*` 引用；图标统一 **lucide-vue-next**（`@live-manager/common` 内 `user-action-dropdown` 仍为历史实现，若管理端引用需另行迁移）
- [ ] **Gate B**：`pnpm dev` 可打开管理端主要路由且无控制台因组件库报错的中断性错误

---

## Phase C — 路由：管理 / 主播 / 观众联调

- [x] `/host` 主播占位页
- [x] `/viewer-smoke` 观众联调页（经 Vite 代理调审核服务）
- [ ] 管理端「建场后」生成可复制 **主播入口链接**（含短期 token 方案，对接 `packages/server`）
- [ ] **Gate C**：管理员建场 → 复制主播链接 → 主播页可进房（推流能力按产品接入 TUILiveKit）

---

## Phase D — 审核服务（先审后发）

- [x] `packages/audit-server`：内存存储 + `X-Admin-Token` 管理接口
- [ ] `approve` 后调用 TRTC 文本消息（经现有 `trtc_proxy` / `packages/common`），**不写重复签名逻辑**
- [ ] **Redis SWAP**：在 `packages/audit-server/src/store.js` 按注释替换为 `RedisCommentStore`
- [ ] **Gate D**：`viewer-smoke` 投稿 → 管理端或 curl 拉 pending → approve 后房间内可见（或文档描述当前为占位）

---

## Phase E — 文档与联调

- [x] `docs/AUDIENCE_MODERATION_CONTRACT.md`（若与实现不一致需同步修订）
- [x] `docs/progress.md`（本文件）
- [x] `docs/pnpm-workspace.md`
- [x] `docs/coding-style.md`
- [ ] 更新根 `README.zh.md` 或新增 `README.monorepo.md`：端口、环境变量、`pnpm dev`
- [ ] **Gate E**：新成员按文档 30 分钟内跑通 `pnpm dev` 全链路演示

---

## Phase F — 清理与二期占位

- [ ] `docs/REACT_INVENTORY_OBS.md` 标注 Deprecated 或改写为 Vue 视角
- [ ] 机器人 / OBS 高级能力：**默认隐藏**，文档列 Backlog
- [ ] **Gate F**：仓库内无「双根 Vite」误导；CI（若有）与本地脚本一致

---

## 当前执行顺序（建议本周次序）

1. 完成 Phase B 剩余：清掉所有 `tdesign-icons` / 模板残留；`pnpm --filter livekit-manager-vue3 build` 绿。
2. 完成 Phase C：主播入口 token + 换签接口（`packages/server`）。
3. 完成 Phase D：审核通过后代发房间消息 + 契约与 progress 勾选同步。
4. Phase E/F：README 与过时文档收尾。

**最后更新**：以 Git 提交为准；修改计划时请同步勾选本文件对应条目。

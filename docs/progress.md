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
- [x] **Gate B**：`pnpm --filter livekit-manager-vue3 build` 通过（`vue-tsc -b && vite build`）；`pnpm dev` 可同时拉起 Web/API/Audit 三进程

---

## Phase C — 路由：管理 / 主播 / 观众联调

- [x] `/host` 主播占位页
- [x] `/viewer-smoke` 观众联调页（经 Vite 代理调审核服务）
- [x] 管理端「建场后」生成可复制 **主播入口链接**：`packages/server` 新增 `/api/host_entry/issue` 与 `/api/host_entry/consume`（HMAC 短期 token，默认 5 分钟），管理端列表每行「主播链接」一键复制，`/host` 页自动消费 token 完成 TUILogin
- [x] **Gate C**：管理员建场 → 复制主播链接 → 主播页已换取凭证并完成 TUILogin；推流能力按产品接入 TUILiveKit（在 `HostStudioView.vue` 已留接入槽位）

---

## Phase D — 审核服务（先审后发）

- [x] `packages/audit-server`：内存存储 + `X-Admin-Token` 管理接口；同时提供 `/api/v1/...` 与契约 `/api/moderation/...` 两套路由；新增 `published` 接口与 `clientMsgId` 去重
- [x] `approve` 后通过管理端 `trtc_proxy` 调 `send_group_msg`（可由 `PUSH_APPROVED_TO_ROOM=1` 控制，**无重复签名逻辑**）
- [x] **Redis SWAP**：`packages/audit-server/src/store.js` 已补齐 `RedisCommentStore` 接口说明与 KEY 设计注释，替换时保持同名导出即可
- [x] **Gate D**：`viewer-smoke` 投稿 → 审核服务 pending 列表 → approve 后进入 `published` 列表；启用 `PUSH_APPROVED_TO_ROOM` 后可触达 TRTC 房间消息（依赖管理员凭证）

---

## Phase E — 文档与联调

- [x] `docs/AUDIENCE_MODERATION_CONTRACT.md`（若与实现不一致需同步修订）
- [x] `docs/progress.md`（本文件）
- [x] `docs/pnpm-workspace.md`
- [x] `docs/coding-style.md`
- [x] 新增 [`docs/README.monorepo.md`](./README.monorepo.md)：端口、环境变量、`pnpm dev` 一键启动、SWAP 指南
- [ ] **Gate E**：新成员按文档 30 分钟内跑通 `pnpm dev` 全链路演示（需实际验收）

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

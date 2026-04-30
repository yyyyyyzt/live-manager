# Live Demo 执行进度（Harness 式）

本文档为**分步执行清单**：按阶段顺序推进，每阶段有 **Gate（门禁）**；完成一项请勾选 `[x]`，便于评审与复盘。

**关联文档**

- [pnpm 工作区与构建](pnpm-workspace.md)
- [前端编码范式（Naive UI）](coding-style.md)

**一键启动（目标态）**

```bash
# 仓库根目录
pnpm install
pnpm dev
```

应同时拉起：`livekit-manager-vue3`（单 Vite）、`livekit-manager-server`。

---

## Phase A — Monorepo 与工程基线

- [x] 根目录 `pnpm-workspace.yaml` 纳入 `packages/*`
- [x] 根 `package.json`：`pnpm dev` 使用 `concurrently` 多进程
- [x] 去除子包孤立 `pnpm-lock.yaml`（以根 lockfile 为准）
- [x] 归档根目录旧 TUILiveKit 独立应用与旧 `upload-server` 到 `archive/`，删除空的 `packages/react/`（见 [`archive/README.md`](../archive/README.md)）
- [x] **Gate A**：`pnpm install` 成功；`pnpm --filter livekit-manager-vue3 build` 通过（`vue-tsc -b && vite build`）

---

## Phase B — 单 Vite + Naive UI 前端

- [x] 移除 TDesign / Tailwind，接入 **Naive UI** + `unplugin-vue-components`
- [x] `App.vue`：`NConfigProvider` + Message/Dialog/Notification Provider
- [x] 全局反馈：`src/utils/message.ts`（`createDiscreteApi`）
- [x] `packages/vue3` 源码：**无** `tdesign-*` 引用；图标统一 **lucide-vue-next**（`@live-manager/common` 内 `user-action-dropdown` 仍为历史实现，若管理端引用需另行迁移）
- [x] **Gate B**：`pnpm --filter livekit-manager-vue3 build` 通过（`vue-tsc -b && vite build`）；`pnpm dev` 可同时拉起 Web/API 两进程

---

## Phase C — 路由：管理 / 主播

- [x] `/host` 主播占位页
- [x] 管理端「建场后」生成可复制 **主播入口链接**：`packages/server` 新增 `/api/host_entry/issue` 与 `/api/host_entry/consume`（HMAC 短期 token，默认 5 分钟），管理端列表每行「主播链接」一键复制，`/host` 页自动消费 token 完成 TUILogin
- [x] **Gate C**：管理员建场 → 复制主播链接 → 主播页已换取凭证并完成 TUILogin；推流能力按产品接入 TUILiveKit（在 `HostStudioView.vue` 已留接入槽位）

---

## Phase D — （已移除）独立审核服务

曾包含 `@live/audit-server` 与 `/viewer-smoke` 联调。**已从本仓库删除**。若需「先审后发」，请在业务侧自建队列与投递逻辑。

---

## Phase E — 文档与联调

- [x] `docs/progress.md`（本文件）
- [x] `docs/pnpm-workspace.md`
- [x] `docs/coding-style.md`
- [x] 新增 [`docs/README.monorepo.md`](./README.monorepo.md)：端口、环境变量、`pnpm dev` 一键启动、SWAP 指南
- [x] 重写根 [`README.zh.md`](../README.zh.md)：以 monorepo 视角组织目录、快速上手、文档索引；原单体说明已归档
- [ ] **Gate E**：新成员按文档 30 分钟内跑通 `pnpm dev` 全链路演示（需实际验收）

---

## Phase F — 清理与二期占位

- [x] 仓库根目录已无遗留 `index.html / vite.config.ts / src / upload-server`，旧资产统一进入 `archive/`
- [x] `docs/REACT_INVENTORY_OBS.md` 已在根目录清理时连同 React 残留移除（如后续重新落地 React 视角，再建新文档）
- [ ] 机器人 / OBS 高级能力：**默认隐藏**，文档列 Backlog（管理端 `room-list.vue` 仍保留 OBS 详情弹窗的拉取逻辑，待产品决策）
- [x] **Gate F**：仓库内无「双根 Vite」误导；`pnpm install && pnpm --filter livekit-manager-vue3 build` 单条路径可用

---

## 下一步（Backlog）

1. **Gate E 外部验收**：新成员按 [`docs/README.monorepo.md`](./README.monorepo.md) 跑通 `pnpm dev` 全链路。
2. **机器人 / OBS 高级能力**：管理端 `room-list.vue` 保留的 OBS 详情弹窗拉取逻辑待产品决策；默认隐藏，重新上线时另立路由。
3. **`trtc_proxy` 群组**：若业务自建「审核后代发群消息」，需保证 IM 群（GroupId = RoomId）已创建。

**最后更新**：以 Git 提交为准；修改计划时请同步勾选本文件对应条目。

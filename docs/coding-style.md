# 前端编码范式（Vue3 + Naive UI）

本仓库 **`packages/vue3`** 为唯一管理端 / 主播联调 / 观众 demo 的 **单 Vite** 应用。

## 技术栈

- Vue 3 + `<script setup lang="ts">` + Vite 6
- **Naive UI**（按需：`unplugin-vue-components` + `NaiveUiResolver`）
- 图标：**lucide-vue-next**（不使用 TDesign Icons）
- 样式：**scoped SCSS**；布局与表单优先用 Naive 组件，避免再引入 Tailwind
- 全局反馈：`import { message } from '@/utils/message'`（`createDiscreteApi`，不依赖组件树）

## 单文件组件

1. 文件头用 HTML 注释简述：**名称、用途、关键 props**（见现有 `HostStudioView.vue`）。
2. `<template>` 在上，`script` 在中，`style lang="scss" scoped` 在下。
3. `id` 驼峰，`class` 短横线。

## Naive 常用映射（从 TDesign 迁移备忘）

| TDesign | Naive |
|--------|--------|
| `v-model:visible` | `v-model:show`（Modal） |
| `t-input` + `v-model` | `n-input` + `v-model:value` |
| `t-button` `theme="primary"` | `n-button` `type="primary"` |
| `t-button` `variant="outline"` | `n-button` `ghost` |
| `t-dialog` | `n-modal` + `preset="card"` 或内嵌 `n-card` 自定义 footer |
| `t-tabs` / `t-tab-panel` | `n-tabs` / `n-tab-pane`（`name` + `tab`） |
| `t-popup` `content=` | `n-tooltip` + `#trigger` 插槽 + 默认插槽为文案 |

## 目录约定

- `src/views/admin/`（可选逐步迁移）— 当前仍以 `room-list.vue` 等扁平文件为主，新功能优先分子目录。
- `src/views/host/` — 主播端路由页面

## 环境变量

- `VITE_API_BASE_URL`：`packages/server` 的 `/api` 基地址（默认开发 `http://localhost:9000/api`）

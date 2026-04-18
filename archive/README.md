# archive/

本目录保留与 Live Demo 当前交付无关的历史代码与配置快照。仅供溯源与参考，**不参与 `pnpm install / build` 流程**，也未纳入 pnpm workspace。

| 目录 | 原位置 | 状态 | 说明 |
|------|--------|------|------|
| `legacy-tuilivekit-root/` | 仓库根 `src/`、`public/`、`index.html`、`vite.config.ts`、`tsconfig*.json`、`coding.md`、根 `.env`/`.eslint*` | 弃用 | 原 `@tencentcloud/live-uikit-vue` 独立 Vite 应用，`packages/vue3` 已承接其能力 |
| `legacy-upload-server/` | 仓库根 `upload-server/` | 弃用 | 单体上传服务，能力已并入 `packages/server/src/services/storage` |

## 恢复某段历史代码

```bash
# 查看归档前最后一次完整形态
git log --all -- archive/legacy-tuilivekit-root/
# 从具体提交恢复某个文件
git checkout <commit> -- archive/legacy-tuilivekit-root/src/TUILiveKit/LiveListView.vue
```

## 已删除（不入档）

- `packages/react/`：原仅包含 `node_modules`，无源代码，直接删除。

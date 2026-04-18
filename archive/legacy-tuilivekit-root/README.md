# legacy-tuilivekit-root/

原仓库根目录的 TUILiveKit 独立 Vite 应用已完整归档至此，**不再参与构建**。当前主工程为 `packages/vue3`（单 Vite 管理端 + 主播入口 + 观众联调）。

## 目录映射

| 归档位置 | 原位置 | 作用 |
|----------|--------|------|
| `index.html` | 仓库根 `index.html` | 旧 Vite 入口 |
| `vite.config.ts` | 仓库根 `vite.config.ts` | 旧 Vite 配置（含 `@TUILive` 别名） |
| `tsconfig.json` / `tsconfig.node.json` | 同名 | 旧 TS 配置（`@TUIRoom/*` paths） |
| `src/` | 仓库根 `src/` | 原前端代码（TUILiveKit、业务视图、共享工具） |
| `public/` | 仓库根 `public/` | 旧静态资源（仅 `favicon.ico`） |
| `coding.md` | 仓库根 `coding.md` | 旧编码规范（指向已删除的 `src/TUIRoom`）；新规范见 `docs/coding-style.md` |
| `dotenv` | 仓库根 `.env` | 旧运行时 env；当前前端 env 见 `packages/vue3/.env` |
| `eslintrc.js` / `eslintignore` | 根 `.eslintrc.js` / `.eslintignore` | 旧 ESLint 配置（`eslint-config-tencent`）；子包按需自行开启 |

文件名中去掉前置点（`.env` → `dotenv`、`.eslintrc.js` → `eslintrc.js`）以避免在 `archive/` 里被全局工具误识别为活跃配置。

## 如何恢复某段历史

```bash
# 查看归档前 git 历史
git log --all -- archive/legacy-tuilivekit-root/src/TUILiveKit/
# 从具体提交恢复某个文件
git checkout <commit> -- archive/legacy-tuilivekit-root/src/TUILiveKit/LiveListView.vue
```

## 替代方案

- 官方 TUILiveKit 完整 Demo：参考 [`Tencent-RTC/TUILiveKit`](https://github.com/Tencent-RTC/TUILiveKit)。
- 本仓库当前主路径：见 [`docs/README.monorepo.md`](../../docs/README.monorepo.md)。

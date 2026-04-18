# legacy-upload-server/

原仓库根目录 `upload-server/` 的完整快照。作为独立 Node 子项目曾单独启动（端口 3071），负责 COS / 自定义上传代理。

**当前状态**：已并入 `packages/server`，对应实现见：

- `packages/server/src/services/storage/` — Provider 抽象 + COS / Custom 适配
- `packages/server/src/routes/apiRouter.js` — `/api/upload/config`、`/api/upload/image`
- 环境变量见 [`docs/README.monorepo.md`](../../docs/README.monorepo.md)

如需参考旧实现（如 `ali-oss` provider），请在本目录 `src-snapshot/` 下查阅。

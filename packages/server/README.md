# 使用指引

1. 在 `server/config/index.js` 中配置 `SdkAppId` 和 `SecretKey`；
2. 执行 `npm install` 安装依赖；
3. 执行 `npm run start` 启动项目，端口默认为 `9000`。

## 评论审核（观众端对接）

HTTP 契约见仓库根目录 **[docs/AUDIENCE_MODERATION_CONTRACT.md](../docs/AUDIENCE_MODERATION_CONTRACT.md)**（路径、字段、轮询方案与鉴权建议）。

## 前端维护范围

管理后台以 **React 包（`packages/react`）** 为唯一主线；Vue3 包已移出 pnpm workspace，不再随主仓安装与构建。
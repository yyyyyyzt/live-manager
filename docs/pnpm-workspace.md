# pnpm 工作区与构建说明

## 布局

```
live-demo/
├── pnpm-workspace.yaml    # packages/*
├── pnpm-lock.yaml         # 仅根目录一份
├── package.json           # 编排脚本，不含业务依赖
├── docs/                  # 工程文档
├── archive/               # 历史代码快照（不参与构建，详见 archive/README.md）
└── packages/
    ├── common/            # @live-manager/common
    ├── server/            # livekit-manager-server
    ├── vue3/              # livekit-manager-vue3（单 Vite 前端）
    └── audit-server/      # @live/audit-server
```

## 安装

```bash
pnpm install
```

勿在子目录单独维护 `pnpm-lock.yaml`（已删除 `packages/vue3/pnpm-lock.yaml`）。

## 开发

```bash
pnpm dev
```

并行启动：

| 名称 | 包 | 默认端口 |
|------|-----|----------|
| Web | `livekit-manager-vue3` | 5173 |
| API | `livekit-manager-server` | 见 `packages/server` 配置（常见 9000） |
| Audit | `@live/audit-server` | 3080（`AUDIT_PORT`） |

前端通过 Vite 将 `/audit-api` 代理到审核服务（见 `packages/vue3/vite.config.ts`）。

## 构建

```bash
# 仅构建 Web（当前主交付物）
pnpm build
# 或
pnpm --filter livekit-manager-vue3 build
```

`livekit-manager-vue3` 的 `build` 脚本为 `vue-tsc -b && vite build`。若需临时跳过类型检查（不推荐长期），可改为 `vite build`。

## CI 建议

```bash
pnpm install --frozen-lockfile
pnpm build
```

缓存：`~/.pnpm-store`。

## workspace 协议

子包依赖公共包使用 `workspace:*`，例如 `@live-manager/common`。

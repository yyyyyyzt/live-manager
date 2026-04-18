# 观众端对接：评论先审后发 HTTP 契约

本服务与腾讯云 Live/IM 主数据分离，**仅承载待审队列与已通过评论的短时状态**（进程内存，重启清空）。观众端应只展示 **已通过审核** 的评论来源（见下文「状态机」）。

**Base URL**：与 Node 管理后台同源，默认路径前缀为 `/api`（与现有 `trtc_proxy` 一致）。示例：`https://your-admin-host:9000/api/moderation/...`

**首期观众可见策略**：**轮询** `GET /api/moderation/comments/published` 增量拉取已通过条目。本服务**不**代为向腾讯云群发 custom 消息；若贵方改为消息推送模型，需另行约定并由管理端或服务端扩展调用 `send_custom_msg`（经 `trtc_proxy`）。

---

## 鉴权（测试 / 生产建议）

| 阶段 | 建议 |
|------|------|
| 测试 | 可公网暴露接口时不校验；或统一使用请求头 `X-Internal-Token: <与网关约定>` |
| 生产 | 由 API 网关校验 Token / mTLS；限制来源 IP；按 `roomId` 做速率限制 |

当前服务端路由**未强制**校验 Token，部署时请在网关层补齐。

---

## 状态机

```
上报 → pending（待审）
pending → approved（已通过，进入已发布列表）
pending → rejected（已拒绝，不进入已发布列表）
```

观众端 UI **仅应展示** `approved` 对应数据（通过下方「已发布」接口获取）。**勿**将待审内容当作公开展示。

---

## 接口列表

### 1. 上报待审评论

`POST /api/moderation/comments`

**Content-Type**：`application/json`

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| roomId | string | 是 | 直播间 ID，如 `live_xxx` |
| senderId | string | 是 | 发送者用户 ID |
| text | string | 是 | 评论正文（服务端截断至 4000 字符） |
| clientMsgId | string | 否 | 客户端消息 ID；**同一 roomId 下相同值会去重**，重复上报返回 `duplicate: true` |
| messageId | string | 否 | 云端/IM 消息 ID，仅作追溯展示（不参与去重，除非同时作为业务侧主键自行约定） |
| timestamp | number | 否 | 毫秒时间戳；缺省则服务端使用当前时间作为 `createdAt` |

**响应**（`code === 0`）

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "<uuid>",
    "duplicate": false
  }
}
```

**错误**：`code === -1`，`message` 为人类可读原因（如缺字段）。

---

### 2. 拉取待审列表（管理端；观众端一般不需要）

`GET /api/moderation/comments/pending?roomId=<roomId>`

**响应** `data.list`：待审项数组，每项含 `id`, `roomId`, `clientMsgId?`, `senderId`, `text`, `createdAt`（毫秒时间戳）。

---

### 3. 拉取已通过评论（观众端轮询）

`GET /api/moderation/comments/published?roomId=<roomId>&since=<ms>&limit=<n>`

| Query | 说明 |
|--------|------|
| roomId | 必填 |
| since | 可选，默认 `0`。仅返回 `approvedAt > since` 的条目（毫秒） |
| limit | 可选，默认 `100`，最大 `500` |

**响应**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "id": "...",
        "roomId": "live_xxx",
        "senderId": "...",
        "text": "...",
        "createdAt": 1710000000000,
        "approvedAt": 1710000001000
      }
    ],
    "serverTime": 1710000002000
  }
}
```

**增量建议**：用上次响应中最大的 `approvedAt` 作为下一次请求的 `since`（若列表为空，仍可保留原 `since`）。

---

### 4. 通过（管理端）

`POST /api/moderation/comments/:commentId/approve`

**Body**：`{ "roomId": "<roomId>" }`

**响应**：`data.item` 为已发布对象（含 `approvedAt`）。

**404**：待审中找不到该 `commentId`。

---

### 5. 拒绝（管理端）

`POST /api/moderation/comments/:commentId/reject`

**Body**：`{ "roomId": "<roomId>" }`

**响应**：`data.ok === true`

---

## 演进说明（不影响契约字段）

- 存储将从内存迁移至 **Redis**，接口路径与字段保持稳定。
- 进程重启后待审与已发布队列均会丢失；生产环境上线 Redis 前请评估运维窗口。

---

## 相关代码

- 路由：`packages/server/src/routes/moderationRoutes.js`
- 存储：`packages/server/src/services/moderation/memoryModerationStore.js`（含 `TODO: Redis`）

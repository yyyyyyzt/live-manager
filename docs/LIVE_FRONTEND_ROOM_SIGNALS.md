# 观众端 / 主播端对接：直播间管控与评论开关

本文说明**管理后台**对直播间做的两类能力，便于观众端（TUILiveKit / 自建 H5）对接：

1. **云端房间属性**（进房或轮询 `get_room_info` 即可拿到）
2. **即时信令**（管理端通过 `send_custom_msg` 广播，客户端需订阅**自定义消息**）

公开 REST 能力总览见腾讯云文档：[实时音视频 API 概览](https://cloud.tencent.com/document/product/647/37078)（其中 **RemoveUser** / **DismissRoom** 等为 TRTC 云 API 3.0；本仓库管理端对「直播房间」优先走 **Live Engine HTTP**，例如 `destroy_room`、`update_room_info`、`send_custom_msg`，经服务端 `trtc_proxy` 转发）。

---

## 1. 评论开关（全员禁言 ↔ 允许评论）

### 1.1 房间字段（权威状态）

- 字段：**`IsMessageDisabled`**（布尔）
  - `true`：全员禁言，观众**不应**再发送评论（服务端会拒绝或客户端应禁用输入）
  - `false`：允许发评论

管理端在开关评论时会调用 **`update_room_info`** 写入该字段。观众端应在：

- **进入房间成功后**拉取一次房间信息；或  
- 定时/按需调用 **`get_room_info`**  

根据 `IsMessageDisabled` 更新 UI（显示或隐藏评论输入区、历史列表是否可继续滚动等由产品决定）。

### 1.2 即时 UI 同步（自定义消息）

仅依赖轮询会有延迟。管理端在成功更新房间后，会额外发送一条 **自定义消息**（`live_engine` 的 `send_custom_msg`），便于已在线用户**秒级**刷新界面。

| 项 | 约定值 |
|----|--------|
| **BusinessId** | `live_mgr_action` |
| **Data** | UTF-8 **JSON 字符串** |
| **Sender_Account** | `admin`（系统账号，仅作发送方标识） |

**评论开关** 对应的 JSON 结构示例：

```json
{
  "action": "comment_visibility",
  "enabled": true,
  "roomId": "<与当前直播间一致的 RoomId>",
  "ts": 1710000000000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `action` | string | 固定为 `comment_visibility` |
| `enabled` | boolean | `true` 允许评论；`false` 关闭评论（与 `IsMessageDisabled === !enabled` 一致） |
| `roomId` | string | 直播间 ID |
| `ts` | number | 毫秒时间戳，可用于去重或展示 |

### 1.3 客户端建议处理流程

1. 进房后读取 `IsMessageDisabled`，初始化「评论区是否可见 / 输入是否可用」。  
2. 订阅 **直播间自定义消息**（具体 API 名以当前使用的 TUILiveKit / TUIRoomEngine 版本文档为准；语义上对应 IM 的自定义消息回调）。  
3. 当 `BusinessId === "live_mgr_action"` 时，解析 `Data` JSON：  
   - 若 `action === "comment_visibility"`，用 `enabled` 更新本地状态并刷新 UI。  
4. 若未收到自定义消息（弱网、丢包），仍以周期性 **`get_room_info`** 为准纠偏。

---

## 2. 移出房间（踢出观众）

管理端对观众使用 **`kick_user_out`**（REST：`v4/room_engine_http_srv/kick_user_out`），与文档中 [移出用户 RemoveUser](https://cloud.tencent.com/document/api/647/40496) 同属「将用户移出 RTC 房间」类管控能力；直播场景下字符串 `RoomId` 走 Room Engine HTTP。

被移出用户侧通常表现为：**被踢出房间 / 收到被踢事件**，需按 SDK 文档处理 UI（返回列表、提示「您已被管理员移出」等）。若需向房间内其他人广播「某某被移出」，可另行约定 `live_mgr_action` 的其它 `action` 值（当前未实现）。

---

## 3. 解散 / 强制关播

与 **`destroy_room`**（Live Engine）或云 API **`DismissRoom` / `DismissRoomByStrRoomId`** 同类：房间销毁后，观众端应监听 **房间解散 / 直播结束** 事件（如 TUILiveKit 的 `onLiveEnded` 或等价回调），展示结束页。

---

## 4. 扩展更多「管理端 → 观众端」信令

新增业务时建议：

1. **仍使用** `BusinessId = live_mgr_action`。  
2. 在 JSON 内增加不同 **`action`** 字符串区分业务。  
3. 在本文档或内部 Wiki 维护 **action 白名单** 与字段说明，避免与产品其它自定义消息冲突。

---

## 5. 相关代码位置（本仓库）

| 能力 | 说明 |
|------|------|
| `LIVE_MANAGER_CUSTOM_BUSINESS_ID` | 常量 `live_mgr_action`，见 `@live-manager/common` `room.ts` |
| `setRoomCommentsEnabled` | 更新 `IsMessageDisabled` 并广播 `comment_visibility` |
| `kickUsersOutRoom` | 调用 `kick_user_out` |

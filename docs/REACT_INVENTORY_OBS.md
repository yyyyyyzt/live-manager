# React 管理端与「纯 OBS / 无连麦」模式：清单说明

产品路线以 **管理员建场 + OBS 推流** 为主时，下列能力属于 **连麦 / 多嘉宾** 场景，与单主播 OBS 模式可能不一致。当前代码仍保留以便兼容；二期可隐藏或改为可选。

| 位置 | 说明 |
|------|------|
| `packages/react/src/components/CreateRoomModal.tsx` | 布局模板（`SeatTemplate`）选择、最大麦位数（语聊模板）；勾选「使用 OBS 推流」时会调用 `pickUserOnSeat` 将 `{anchorId}_obs` 机器人上麦以承载推流 |
| `packages/react/src/api/room.ts` | 导出 `pickUserOnSeat`、`getSeatList` 等与麦位相关的 API 封装 |

**无连麦 / 仅 OBS**：创建房间时仍可只勾选 OBS，依赖机器人占位推流；若未来完全去掉麦位概念，需与云端房间模板能力对齐后再改 UI。

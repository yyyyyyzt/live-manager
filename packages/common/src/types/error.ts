/**
 * 即时通信 IM 错误码定义
 * 文档来源: https://cloud.tencent.com/document/product/269/125815
 */

// ========== 客户端错误码 ==========

/** 通用错误码 */
export enum ClientCommonError {
  /** 操作成功 */
  SUCCESS = 0,
  /** 暂未归类的通用错误 */
  UNKNOWN = -1,
  /** 请求被限频，请稍后重试 */
  RATE_LIMITED = -2,
  /** 重复操作 */
  DUPLICATE_OPERATION = -3,
  /** 未找到 SDKAppID */
  SDK_APP_ID_NOT_FOUND = -1000,
  /** 传入的参数不合法 */
  INVALID_PARAMETER = -1001,
  /** 未登录 */
  NOT_LOGGED_IN = -1002,
  /** 获取权限失败，未授权音/视频权限 */
  PERMISSION_DENIED = -1003,
  /** 需要开通额外的套餐 */
  PACKAGE_NOT_PURCHASED = -1004,
}

/** 设备相关错误码（摄像头、麦克风、屏幕共享） */
export enum DeviceError {
  /** 打开摄像头失败 */
  CAMERA_START_FAILED = -1100,
  /** 摄像头没有系统授权 */
  CAMERA_NOT_AUTHORIZED = -1101,
  /** 摄像头被占用 */
  CAMERA_OCCUPIED = -1102,
  /** 当前无摄像头设备 */
  CAMERA_NOT_FOUND = -1103,
  /** 打开麦克风失败 */
  MIC_START_FAILED = -1104,
  /** 麦克风没有系统授权 */
  MIC_NOT_AUTHORIZED = -1105,
  /** 麦克风被占用 */
  MIC_OCCUPIED = -1106,
  /** 当前无麦克风设备 */
  MIC_NOT_FOUND = -1107,
  /** 获取屏幕分享对象失败 */
  SCREEN_CAPTURE_FAILED = -1108,
  /** 开启屏幕分享失败 */
  SCREEN_SHARE_FAILED = -1109,
}

/** 房间管理相关错误码 */
export enum RoomError {
  /** 需要进房后才可使用此功能 */
  NOT_IN_ROOM = -2101,
  /** 房主不支持退房操作 */
  OWNER_EXIT_NOT_ALLOWED = -2102,
  /** 当前房间类型下不支持该操作 */
  ROOM_TYPE_NOT_SUPPORTED = -2103,
  /** 创建房间 ID 非法 */
  INVALID_ROOM_ID = -2105,
  /** 房间名称非法 */
  INVALID_ROOM_NAME = -2107,
  /** 当前用户已在别的房间内 */
  ALREADY_IN_ANOTHER_ROOM = -2108,
}

/** 房间内用户信息错误码 */
export enum RoomUserError {
  /** 未找到该用户 */
  USER_NOT_FOUND = -2200,
}

/** 权限与麦位管理错误码 */
export enum SeatPermissionError {
  /** 需要房主权限才能操作 */
  NEED_OWNER_PERMISSION = -2300,
  /** 需要房主或者管理员权限才能操作 */
  NEED_ADMIN_PERMISSION = -2301,
  /** 信令请求无权限 */
  SIGNALING_NO_PERMISSION = -2310,
  /** 信令请求 ID 无效或已经被处理过 */
  SIGNALING_INVALID_ID = -2311,
  /** 信令请求重复 */
  SIGNALING_DUPLICATE = -2312,
  /** 最大麦位超出套餐包数量限制 */
  SEAT_LIMIT_EXCEEDED = -2340,
  /** 麦位编号不存在 */
  SEAT_NOT_FOUND = -2344,
  /** 当前麦位音频被锁 */
  SEAT_AUDIO_LOCKED = -2360,
  /** 需要申请后打开麦克风 */
  NEED_APPLY_MIC = -2361,
  /** 当前麦位视频被锁 */
  SEAT_VIDEO_LOCKED = -2370,
  /** 需要申请后打开摄像头 */
  NEED_APPLY_CAMERA = -2371,
  /** 当前麦位视频被锁，无法打开屏幕分享 */
  SEAT_SCREEN_LOCKED = -2372,
  /** 需要申请后打开屏幕分享 */
  NEED_APPLY_SCREEN = -2373,
  /** 当前房间已开启全员禁言 */
  ROOM_MUTE_ALL = -2380,
  /** 当前房间内，您已被禁言 */
  USER_MUTED = -2381,
}

/** 房间预加载错误码 */
export enum PreloadError {
  /** 当前房间不支持预加载 */
  PRELOAD_NOT_SUPPORTED = -4001,
}

// ========== REST API 公共错误码 ==========

export enum RestApiError {
  /** HTTP 解析错误 */
  HTTP_PARSE_ERROR = 60002,
  /** HTTP 请求 JSON 解析错误 */
  JSON_PARSE_ERROR = 60003,
  /** 请求 URL 或 JSON 包体中账号或签名错误 */
  ACCOUNT_SIGNATURE_ERROR = 60004,
  /** 请求 URL 或 JSON 包体中账号或签名错误 */
  ACCOUNT_SIGNATURE_ERROR_2 = 60005,
  /** SDKAppID 失效 */
  SDK_APP_ID_INVALID = 60006,
  /** REST 接口调用频率超过限制 */
  REST_API_RATE_LIMITED = 60007,
  /** 服务请求超时或 HTTP 请求格式错误 */
  SERVICE_TIMEOUT = 60008,
  /** 请求资源错误 */
  RESOURCE_ERROR = 60009,
  /** 请求需要 App 管理员权限 */
  NEED_ADMIN_ROLE = 60010,
  /** SDKAppID 请求频率超限 */
  SDK_APP_ID_RATE_LIMITED = 60011,
  /** REST 接口需要带 SDKAppID */
  MISSING_SDK_APP_ID = 60012,
  /** HTTP 响应包 JSON 解析错误 */
  RESPONSE_JSON_ERROR = 60013,
  /** 置换账号超时 */
  ACCOUNT_SWAP_TIMEOUT = 60014,
  /** 请求包体账号类型错误 */
  ACCOUNT_TYPE_ERROR = 60015,
  /** SDKAppID 被禁用 */
  SDK_APP_ID_DISABLED = 60016,
  /** 请求被禁用 */
  REQUEST_DISABLED = 60017,
  /** 请求过于频繁 */
  TOO_FREQUENT = 60018,
  /** 请求过于频繁 */
  TOO_FREQUENT_2 = 60019,
  /** 专业版套餐包已到期并停用 */
  PACKAGE_EXPIRED = 60020,
  /** RestAPI 调用来源 IP 非法 */
  IP_NOT_ALLOWED = 60021,
}

// ========== 服务端错误码 (2.0 版本 SDK) ==========

export enum ServerError {
  /** 服务器内部错误 */
  INTERNAL_ERROR = 100001,
  /** 请求参数非法 */
  INVALID_PARAMETER = 100002,
  /** 房间 ID 已被使用 */
  ROOM_ID_ALREADY_USED = 100003,
  /** 房间不存在 */
  ROOM_NOT_EXIST = 100004,
  /** 非房间成员 */
  NOT_ROOM_MEMBER = 100005,
  /** 操作权限不足 */
  PERMISSION_DENIED = 100006,
  /** 无付费信息 */
  NO_PAYMENT_INFO = 100007,
  /** 房间成员已满 */
  ROOM_MEMBERS_FULL = 100008,
  /** 标签数量超上限 */
  TAG_LIMIT_EXCEEDED = 100009,
  /** 房间 ID 已被使用，操作者为房主 */
  ROOM_ID_USED_BY_OWNER = 100010,
  /** 房间 ID 已被 IM 占用 */
  ROOM_ID_OCCUPIED_BY_IM = 100011,
  /** 频率超过限制 */
  RATE_LIMITED = 100012,
  /** 超过付费上限 */
  PAYMENT_LIMIT_EXCEEDED = 100013,
  /** 无效的房间类型 */
  INVALID_ROOM_TYPE = 100015,
  /** 该成员已经被封禁 */
  MEMBER_BANNED = 100016,
  /** 该成员已经被禁言 */
  MEMBER_MUTED = 100017,
  /** 当前房间需要密码才能进入 */
  ROOM_PASSWORD_REQUIRED = 100018,
  /** 进房密码错误 */
  ROOM_PASSWORD_WRONG = 100019,
  /** 管理员数量超过上限 */
  ADMIN_LIMIT_EXCEEDED = 100020,
  /** 信令请求冲突 */
  SIGNALING_CONFLICT = 100102,
  /** 麦位已锁定 */
  SEAT_LOCKED = 100200,
  /** 当前麦位已经有人了 */
  SEAT_OCCUPIED = 100201,
  /** 已经处于排麦状态 */
  ALREADY_IN_QUEUE = 100202,
  /** 已经处于麦上状态 */
  ALREADY_ON_SEAT = 100203,
  /** 没有在排麦列表中 */
  NOT_IN_QUEUE = 100204,
  /** 麦位已满 */
  SEATS_FULL = 100205,
  /** 未在麦上 */
  NOT_ON_SEAT = 100206,
  /** 已经有用户在麦位上 */
  SEAT_HAS_USER = 100210,
  /** 该房间不支持连麦 */
  LINK_MIC_NOT_SUPPORTED = 100211,
  /** 连麦列表为空 */
  LINK_MIC_LIST_EMPTY = 100251,
  /** 当前连线不存在或结束 */
  CONNECTION_NOT_EXIST = 100400,
  /** 该房间已经在连线中 */
  ROOM_ALREADY_CONNECTED = 100401,
  /** 该房间存在待处理的连线请求 */
  PENDING_CONNECTION_REQUEST = 100402,
  /** 当前房间与其他房间连线中 */
  ROOM_CONNECTED_TO_OTHER = 100403,
  /** 超过连线和 battle 房间数量上限 */
  CONNECTION_LIMIT_EXCEEDED = 100404,
  /** 短时间内连线过于频繁 */
  CONNECTION_TOO_FREQUENT = 100405,
  /** 该场次 battle 不存在或已结束 */
  BATTLE_NOT_EXIST = 100411,
  /** 发起的 battle 里没有一个有效的房间 */
  NO_VALID_BATTLE_ROOM = 100412,
  /** 短时间内频繁发起 battle */
  BATTLE_TOO_FREQUENT = 100413,
  /** 该房间已经不在 battle 中 */
  ROOM_NOT_IN_BATTLE = 100414,
  /** 该房间处于其他的 battle 场次中 */
  ROOM_IN_OTHER_BATTLE = 100415,
  /** 该房间存在待处理的 battle 请求 */
  PENDING_BATTLE_REQUEST = 100416,
  /** 该房间处于 battle 中 */
  ROOM_IN_BATTLE = 100419,
  /** 该 battle 场次还未开始 */
  BATTLE_NOT_STARTED = 100420,
  /** 该 battle 场次已经结束 */
  BATTLE_ALREADY_ENDED = 100421,
  /** 房间 meta 数据中的 key 数量超过上限 */
  META_KEY_LIMIT_EXCEEDED = 100500,
  /** 房间 meta 数据中单个 key 对应的 val 超过最大字节数限制 */
  META_VALUE_SIZE_EXCEEDED = 100501,
  /** 房间 meta 数据中所有 key 对应的 val 总和超过最大字节数限制 */
  META_TOTAL_SIZE_EXCEEDED = 100502,
  /** 删除房间 meta 数据时，被删除的 key 没有一个存在 */
  META_KEY_NOT_EXIST = 100503,
  /** 房间 meta 数据中的 key 大小超过了最大字节数限制 */
  META_KEY_SIZE_EXCEEDED = 100504,
}

// ========== 旧版兼容：保留原有 ErrorCode 枚举 ==========

/** @deprecated 请使用更细粒度的错误码枚举（ClientCommonError / ServerError 等） */
export enum ErrorCode {
  SUCCESS = 0,
  LOGIN_TIMEOUT = -1,
  NETWORK_ERROR = -2,
  USER_SIG_ILLEGAL = -3,
  UNKNOWN_ERROR = -999,
}

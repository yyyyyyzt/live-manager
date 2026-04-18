/**
 * IM 错误码 → 友好提示信息映射
 * 文档来源: https://cloud.tencent.com/document/product/269/125815
 *
 * 使用方式:
 *   import { getErrorMessage } from '@live-manager/common';
 *   const msg = getErrorMessage(errorCode);
 */

// ========== 客户端通用错误码 ==========
const clientCommonErrors: Record<number, string> = {
  0: '操作成功',
  [-1]: '暂未归类的通用错误',
  [-2]: '请求被限频，请稍后重试',
  [-3]: '重复操作',
  [-1000]: '未找到 SDKAppID，请在控制台确认应用信息',
  [-1001]: '传入的参数不合法，请检查入参',
  [-1002]: '未登录，请先登录',
  [-1003]: '获取权限失败，当前未授权音/视频权限，请查看是否开启设备权限',
  [-1004]: '该功能需要开通额外的套餐，请在控制台按需开通',
};

// ========== 设备相关错误码 ==========
const deviceErrors: Record<number, string> = {
  [-1100]: '打开摄像头失败，请检查摄像头设备是否正常',
  [-1101]: '摄像头没有系统授权，请检查系统权限设置',
  [-1102]: '摄像头被占用，请检查是否有其他应用正在使用',
  [-1103]: '当前无摄像头设备，请插入摄像头后重试',
  [-1104]: '打开麦克风失败，请检查麦克风设备是否正常',
  [-1105]: '麦克风没有系统授权，请检查系统权限设置',
  [-1106]: '麦克风被占用，请检查是否有其他应用正在使用',
  [-1107]: '当前无麦克风设备，请插入麦克风后重试',
  [-1108]: '获取屏幕分享对象失败，请检查屏幕录制权限',
  [-1109]: '开启屏幕分享失败，请检查房间内是否有人正在屏幕分享',
};

// ========== 房间管理相关错误码 ==========
const roomErrors: Record<number, string> = {
  [-2101]: '需要进房后才可使用此功能',
  [-2102]: '房主不支持退房操作。会议房间可以先转让房主再退房，直播房间房主只能解散房间',
  [-2103]: '当前房间类型下不支持该操作',
  [-2105]: '创建房间 ID 非法，自定义 ID 必须为可打印 ASCII 字符（0x20-0x7e），最长 48 个字节',
  [-2107]: '房间名称非法，名称最长 30 字节，字符编码必须是 UTF-8',
  [-2108]: '当前用户已在别的房间内，请先退出当前房间',
};

// ========== 房间内用户信息错误码 ==========
const roomUserErrors: Record<number, string> = {
  [-2200]: '未找到该用户',
};

// ========== 权限与麦位管理错误码 ==========
const seatPermissionErrors: Record<number, string> = {
  [-2300]: '需要房主权限才能操作',
  [-2301]: '需要房主或管理员权限才能操作',
  [-2310]: '信令请求无权限',
  [-2311]: '信令请求 ID 无效或已经被处理过',
  [-2312]: '信令请求重复',
  [-2340]: '最大麦位超出套餐包数量限制',
  [-2344]: '麦位编号不存在',
  [-2360]: '当前麦位音频被锁定',
  [-2361]: '需要向房主或管理员申请后打开麦克风',
  [-2370]: '当前麦位视频被锁定，需要由房主解锁后才能打开摄像头',
  [-2371]: '需要向房主或管理员申请后打开摄像头',
  [-2372]: '当前麦位视频被锁定，需要由房主解锁后才能打开屏幕分享',
  [-2373]: '需要向房主或管理员申请后打开屏幕分享',
  [-2380]: '当前房间已开启全员禁言',
  [-2381]: '您已被禁言',
};

// ========== 房间预加载错误码 ==========
const preloadErrors: Record<number, string> = {
  [-4001]: '当前房间不支持预加载',
};

// ========== REST API 公共错误码 ==========
const restApiErrors: Record<number, string> = {
  60002: 'HTTP 解析错误，请检查请求 URL 格式',
  60003: '请求 JSON 解析错误，请检查 JSON 格式',
  60004: '请求中账号或签名错误',
  60005: '请求中账号或签名错误',
  60006: 'SDKAppID 失效，请核对 SDKAppID 有效性',
  60007: '接口调用频率超过限制，请降低请求频率',
  60008: '服务请求超时或 HTTP 请求格式错误，请检查并重试',
  60009: '请求资源错误，请检查请求 URL',
  60010: '请求需要 App 管理员权限',
  60011: 'SDKAppID 请求频率超限，请降低请求频率',
  60012: '请求需要带 SDKAppID，请检查请求 URL',
  60013: 'HTTP 响应包 JSON 解析错误',
  60014: '置换账号超时',
  60015: '请求包体账号类型错误，请确认账号为字符串格式',
  60016: 'SDKAppID 被禁用',
  60017: '请求被禁用',
  60018: '请求过于频繁，请稍后重试',
  60019: '请求过于频繁，请稍后重试',
  60020: '专业版套餐包已到期并停用，请重新购买套餐包',
  60021: 'RestAPI 调用来源 IP 非法',
};

// ========== 服务端错误码 (2.0 版本 SDK) ==========
const serverErrors: Record<number, string> = {
  100001: '服务器内部错误，请重试',
  100002: '请求参数非法，请检查请求是否正确',
  100003: '房间 ID 已被使用，请选择其他房间 ID',
  100004: '房间不存在或已被解散',
  100005: '非房间成员',
  100006: '操作权限不足',
  100007: '无付费信息，请在控制台购买套餐包',
  100008: '房间成员已满',
  100009: '标签数量超上限',
  100010: '房间 ID 已被使用，操作者为房主，可以直接使用',
  100011: '房间 ID 已被 IM 占用，请换一个房间 ID 或先通过 IM 接口解散该群',
  100012: '操作频率超过限制，请稍后重试',
  100013: '超过付费上限，请检查套餐包限制',
  100015: '无效的房间类型',
  100016: '该成员已被封禁',
  100017: '该成员已被禁言',
  100018: '当前房间需要密码才能进入',
  100019: '进房密码错误',
  100020: '管理员数量超过上限',
  100102: '信令请求冲突',
  100200: '麦位已锁定，请尝试其他麦位',
  100201: '当前麦位已经有人了',
  100202: '已处于排麦状态',
  100203: '已处于麦上状态',
  100204: '未在排麦列表中',
  100205: '麦位已满',
  100206: '未在麦上',
  100210: '已经有用户在麦位上',
  100211: '该房间不支持连麦',
  100251: '连麦列表为空',
  100400: '当前连线不存在或已结束',
  100401: '该房间已经在连线中',
  100402: '该房间存在待处理的连线请求',
  100403: '当前房间正与其他房间连线中',
  100404: '超过连线和 Battle 房间数量上限',
  100405: '短时间内连线过于频繁，请稍后再试',
  100411: '该场次 Battle 不存在或已结束',
  100412: '发起的 Battle 中没有有效的房间',
  100413: '短时间内频繁发起 Battle，请稍后再试',
  100414: '该房间已不在 Battle 中',
  100415: '该房间处于其他 Battle 场次中',
  100416: '该房间存在待处理的 Battle 请求',
  100419: '该房间处于 Battle 中',
  100420: '该 Battle 场次还未开始',
  100421: '该 Battle 场次已经结束',
  100500: '房间 Meta 数据中的 Key 数量超过上限',
  100501: '房间 Meta 数据中单个 Key 对应的值超过最大字节数限制',
  100502: '房间 Meta 数据中所有 Key 对应的值总和超过最大字节数限制',
  100503: '删除房间 Meta 数据时，被删除的 Key 没有一个存在',
  100504: '房间 Meta 数据中的 Key 大小超过最大字节数限制',
};

// ========== 合并所有错误码映射 ==========
const allErrorMessages: Record<number, string> = {
  ...clientCommonErrors,
  ...deviceErrors,
  ...roomErrors,
  ...roomUserErrors,
  ...seatPermissionErrors,
  ...preloadErrors,
  ...restApiErrors,
  ...serverErrors,
};

/**
 * 根据错误码获取友好的中文提示信息
 * @param code 错误码
 * @param errorInfo API返回的错误信息，优先使用，errorinfo 为空时才使用错误码映射
 * @param fallback 未找到对应错误码时的兜底信息，默认返回 "未知错误（错误码: xxx）"
 * @returns 友好的中文错误描述
 *
 * @example
 * ```ts
 * import { getErrorMessage } from '@live-manager/common';
 *
 * // 基本用法（仅使用错误码映射）
 * getErrorMessage(100004); // => '房间不存在或已被解散'
 * getErrorMessage(-1002);  // => '未登录，请先登录'
 *
 * // 优先使用 errorinfo
 * getErrorMessage(100004, '房间已关闭'); // => '房间已关闭'
 * getErrorMessage(-1002, '', '请先登录'); // => '请先登录'（errorinfo 为空时使用 fallback）
 *
 * // 结合 API 响应使用
 * if (response.ErrorCode !== 0) {
 *   showToast(getErrorMessage(response.ErrorCode, response.ErrorInfo));
 * }
 * ```
 */
export function getErrorMessage(code: number, errorInfo?: string, fallback?: string): string {
  // 优先使用 errorinfo，除非 errorinfo 为空
  if (errorInfo) {
    return errorInfo;
  }
  // errorinfo 为空时，使用错误码映射或 fallback
  return allErrorMessages[code] ?? fallback ?? `未知错误（错误码: ${code}）`;
}

/**
 * 判断错误码是否表示成功
 */
export function isSuccess(code: number): boolean {
  return code === 0;
}

/**
 * 判断是否为客户端错误码（负数）
 */
export function isClientError(code: number): boolean {
  return code < 0;
}

/**
 * 判断是否为 REST API 错误码（60000-69999）
 */
export function isRestApiError(code: number): boolean {
  return code >= 60000 && code < 70000;
}

/**
 * 判断是否为服务端错误码（100000+）
 */
export function isServerError(code: number): boolean {
  return code >= 100000;
}

/**
 * 错误码分类
 */
export type ErrorCategory = 'success' | 'client' | 'rest_api' | 'server' | 'unknown';

/**
 * 获取错误码所属分类
 */
export function getErrorCategory(code: number): ErrorCategory {
  if (code === 0) return 'success';
  if (code < 0) return 'client';
  if (code >= 60000 && code < 70000) return 'rest_api';
  if (code >= 100000) return 'server';
  return 'unknown';
}

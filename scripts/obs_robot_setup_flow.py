#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OBS 机器人推流 — 文档「方案」最小 REST 流程（与腾讯云说明一致）
https://cloud.tencent.com/document/product/647/118378

步骤（机器人推流）：
  1) 创建直播间 create_room（OBS 模式：KeepOwnerOnSeat=false，房主不上麦）
  2) 添加机器人 add_robot
  3) 机器人上麦 pick_user_on_seat（Index=0）
  4) 打印 OBS RTMP 服务器地址与推流码（userid=机器人，usersig=机器人）

依赖：仅 Python 3 标准库（urllib / json / hmac / hashlib / zlib / base64 / logging）。

用法示例：
  export TENCENT_SDK_APP_ID=1400000001
  export TENCENT_SECRET_KEY='your_secret'
  export TENCENT_ADMIN_USER_ID=administrator
  python3 scripts/obs_robot_setup_flow.py \\
    --room-id live_demo_001 \\
    --anchor-id anchor_user_01

或显式传参：
  python3 scripts/obs_robot_setup_flow.py \\
    --sdk-app-id 1400000001 \\
    --secret-key 'xxx' \\
    --admin-user-id administrator \\
    --room-id live_demo_001 \\
    --anchor-id anchor_user_01 \\
    --log-file ./obs_setup.log

说明：
  - identifier / usersig 使用管理员账号（与控制台 REST 调用一致）。
  - 会先 account_import 房主与机器人账号（幂等，70102 视为已存在）。
  - 若房间已存在（ErrorCode 100003/100010），脚本会记录日志并尽量继续 add_robot（可能仍失败，需换 RoomId 或先 destroy）。
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import logging
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from typing import Any, Dict, Optional


# ---------------------------------------------------------------------------
# TLSSigAPIv2（与腾讯云 IM UserSig 算法一致，无第三方包）
# ---------------------------------------------------------------------------


def _base64_encode_url(data: bytes) -> str:
    return (
        base64.b64encode(data)
        .decode("utf-8")
        .replace("+", "*")
        .replace("/", "-")
        .replace("=", "_")
    )


class TLSSigAPIv2:
    def __init__(self, sdk_app_id: int, secret_key: str) -> None:
        self._sdk_app_id = int(sdk_app_id)
        self._secret_key = str(secret_key).encode("utf-8")

    def _hmac_sha256(self, identifier: str, curr_time: int, expire: int) -> str:
        content = (
            "TLS.identifier:%s\n"
            "TLS.sdkappid:%d\n"
            "TLS.time:%d\n"
            "TLS.expire:%d\n"
            "TLS.ext:undefined\n"
        ) % (identifier, self._sdk_app_id, curr_time, expire)
        sig = hmac.new(
            self._secret_key, content.encode("utf-8"), digestmod=hashlib.sha256
        ).digest()
        return _base64_encode_url(sig)

    def gen_user_sig(self, identifier: str, expire: int = 7 * 24 * 3600) -> str:
        curr = int(time.time())
        payload = {
            "TLS.ver": "2.0",
            "TLS.identifier": str(identifier),
            "TLS.sdkappid": int(self._sdk_app_id),
            "TLS.expire": int(expire),
            "TLS.time": int(curr),
            "TLS.sig": self._hmac_sha256(str(identifier), curr, expire),
        }
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        compressed = zlib.compress(raw)
        return _base64_encode_url(compressed)


# ---------------------------------------------------------------------------
# HTTP 调用腾讯云 REST
# ---------------------------------------------------------------------------


def _rtmp_server_url(sdk_app_id: int) -> str:
    # 与 @live-manager/common getRtmpPushUrl 一致：国内默认域名
    if sdk_app_id < 1400000000:
        return "rtmp://intl-rtmp.rtc.qq.com/push"
    return "rtmp://rtmp.rtc.qq.com/push"


def _api_domain(sdk_app_id: int) -> str:
    if sdk_app_id < 1400000000:
        return "adminapisgp.im.qcloud.com"
    return "console.tim.qq.com"


def _post_json(
    log: logging.Logger,
    step: str,
    domain: str,
    path: str,
    sdk_app_id: int,
    admin_id: str,
    admin_sig: str,
    body: Dict[str, Any],
    pause_sec: float = 1.15,
) -> Dict[str, Any]:
    rnd = random.randint(0, 2**31 - 1)
    qs = (
        f"sdkappid={sdk_app_id}&identifier={urllib.parse.quote(str(admin_id), safe='')}"
        f"&usersig={urllib.parse.quote(admin_sig, safe='')}&random={rnd}&contenttype=json"
    )
    url = f"https://{domain}/{path}?{qs}"
    data = json.dumps(body).encode("utf-8")
    log.info("[%s] POST https://%s/%s (body keys=%s)", step, domain, path, list(body.keys()))
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            elapsed = (time.time() - t0) * 1000
            log.info("[%s] HTTP %s, %.0f ms, bytes=%d", step, resp.status, elapsed, len(raw))
            try:
                parsed: Dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                log.error("[%s] 非 JSON 响应: %s", step, raw[:2000])
                raise
            log.info("[%s] Response: %s", step, json.dumps(parsed, ensure_ascii=False)[:8000])
            if pause_sec > 0:
                time.sleep(pause_sec)
            return parsed
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace") if e.fp else ""
        log.error("[%s] HTTPError %s: %s", step, e.code, body_err[:4000])
        raise
    except urllib.error.URLError as e:
        log.error("[%s] URLError: %s", step, e)
        raise


def _ec(resp: Dict[str, Any]) -> int:
    if "ErrorCode" in resp:
        return int(resp.get("ErrorCode") or 0)
    if "Error" in resp:
        return int(resp.get("Error") or 0)
    return 0


def setup_logging(log_file: Optional[str]) -> logging.Logger:
    log = logging.getLogger("obs_robot_setup")
    log.setLevel(logging.INFO)
    log.handlers.clear()
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    log.addHandler(sh)
    if log_file:
        fh = logging.FileHandler(log_file, encoding="utf-8")
        fh.setFormatter(fmt)
        log.addHandler(fh)
    return log


def main() -> int:
    p = argparse.ArgumentParser(description="OBS 机器人推流最小 REST 流程 + 文件日志")
    p.add_argument("--sdk-app-id", type=int, default=int(os.environ.get("TENCENT_SDK_APP_ID", "0") or 0))
    p.add_argument("--secret-key", default=os.environ.get("TENCENT_SECRET_KEY", ""))
    p.add_argument("--admin-user-id", default=os.environ.get("TENCENT_ADMIN_USER_ID", "administrator"))
    p.add_argument("--room-id", required=True, help="RoomId，如 live_xxx")
    p.add_argument("--anchor-id", required=True, help="房主/主播 IM userId（已导入或本脚本会 import）")
    p.add_argument(
        "--domain",
        default="",
        help="REST 域名，默认按 sdkAppId 选择（国内 console.tim.qq.com）",
    )
    p.add_argument("--log-file", default=os.environ.get("OBS_SETUP_LOG", "obs_robot_setup.log"))
    p.add_argument("--pause", type=float, default=1.15, help="每步 REST 后休眠秒数，减轻限频/竞态")
    args = p.parse_args()

    log = setup_logging(args.log_file)
    log.info("======== OBS 机器人推流 REST 流程开始 ========")
    log.info(
        "配置: sdkAppId=%s, adminId=%s, roomId=%s, anchorId=%s, domain=%s, logFile=%s",
        args.sdk_app_id,
        args.admin_user_id,
        args.room_id,
        args.anchor_id,
        args.domain or "(auto)",
        args.log_file or "(stdout only)",
    )

    if args.sdk_app_id <= 0 or not args.secret_key:
        log.error("缺少 sdkAppId 或 secretKey（可用环境变量 TENCENT_SDK_APP_ID / TENCENT_SECRET_KEY）")
        return 2

    domain = args.domain.strip() or _api_domain(args.sdk_app_id)
    signer = TLSSigAPIv2(args.sdk_app_id, args.secret_key)
    admin_sig = signer.gen_user_sig(args.admin_user_id)
    log.info("Step A: 已生成管理员 UserSig（不打印明文 secret / 不全量打印 sig）")

    robot_id = f"{args.anchor_id}_obs"

    # Step 0: account_import 房主
    log.info("Step 0: account_import 房主 anchor=%s", args.anchor_id)
    r0 = _post_json(
        log,
        "account_import_anchor",
        domain,
        "v4/im_open_login_svc/account_import",
        args.sdk_app_id,
        args.admin_user_id,
        admin_sig,
        {"UserID": args.anchor_id, "Nick": args.anchor_id, "FaceUrl": ""},
        pause_sec=args.pause,
    )
    ec0 = _ec(r0)
    if ec0 not in (0, 70102):
        log.warning("account_import 房主非 0/70102: ErrorCode=%s ErrorInfo=%s", ec0, r0.get("ErrorInfo"))

    # Step 0b: account_import 机器人
    log.info("Step 0b: account_import 机器人 robot=%s", robot_id)
    r0b = _post_json(
        log,
        "account_import_robot",
        domain,
        "v4/im_open_login_svc/account_import",
        args.sdk_app_id,
        args.admin_user_id,
        admin_sig,
        {"UserID": robot_id, "Nick": "obs_robot", "FaceUrl": ""},
        pause_sec=args.pause,
    )
    ec0b = _ec(r0b)
    if ec0b not in (0, 70102):
        log.warning("account_import 机器人非 0/70102: ErrorCode=%s ErrorInfo=%s", ec0b, r0b.get("ErrorInfo"))

    # Step 1: create_room（OBS：KeepOwnerOnSeat=false）
    log.info("Step 1: create_room RoomId=%s Owner=%s KeepOwnerOnSeat=false", args.room_id, args.anchor_id)
    room_info = {
        "RoomId": args.room_id,
        "RoomType": "Live",
        "SeatTemplate": "VideoDynamicGrid9Seats",
        "Owner_Account": args.anchor_id,
        "IsUnlimitedRoomEnabled": True,
        "KeepOwnerOnSeat": False,
    }
    r1 = _post_json(
        log,
        "create_room",
        domain,
        "v4/live_engine_http_srv/create_room",
        args.sdk_app_id,
        args.admin_user_id,
        admin_sig,
        {"RoomInfo": room_info},
        pause_sec=args.pause,
    )
    ec1 = _ec(r1)
    if ec1 == 0:
        log.info("create_room 成功")
    elif ec1 in (100003, 100010, 100011):
        log.warning(
            "create_room 返回房间已存在或占用 (ErrorCode=%s)，若后续 add_robot 失败请先换 RoomId 或 destroy_room",
            ec1,
        )
    else:
        log.error("create_room 失败，终止后续步骤: ErrorCode=%s", ec1)
        return 1

    # Step 2: add_robot
    log.info("Step 2: add_robot room=%s robots=%s", args.room_id, [robot_id])
    r2 = _post_json(
        log,
        "add_robot",
        domain,
        "v4/live_engine_http_srv/add_robot",
        args.sdk_app_id,
        args.admin_user_id,
        admin_sig,
        {"RoomId": args.room_id, "RobotList_Account": [robot_id]},
        pause_sec=args.pause,
    )
    ec2 = _ec(r2)
    if ec2 != 0:
        log.error("add_robot 失败，终止: ErrorCode=%s ErrorInfo=%s", ec2, r2.get("ErrorInfo"))
        return 1

    # Step 3: pick_user_on_seat（麦位服务域名与 live_engine 相同文档示例为 console.tim.qq.com）
    log.info("Step 3: pick_user_on_seat Member=%s Index=0", robot_id)
    r3 = _post_json(
        log,
        "pick_user_on_seat",
        domain,
        "v4/room_engine_http_mic/pick_user_on_seat",
        args.sdk_app_id,
        args.admin_user_id,
        admin_sig,
        {"RoomId": args.room_id, "Member_Account": robot_id, "Index": 0},
        pause_sec=args.pause,
    )
    ec3 = _ec(r3)
    if ec3 != 0:
        log.error("pick_user_on_seat 失败: ErrorCode=%s ErrorInfo=%s", ec3, r3.get("ErrorInfo"))
        return 1

    # Step 4: 推流地址（OBS：服务器 + 推流码）
    robot_sig = signer.gen_user_sig(robot_id)
    server = _rtmp_server_url(args.sdk_app_id)
    stream_key = (
        f"{args.room_id}?sdkappid={args.sdk_app_id}&userid={urllib.parse.quote(str(robot_id), safe='')}"
        f"&usersig={urllib.parse.quote(robot_sig, safe='')}"
    )
    log.info("Step 4: OBS 推流参数（请复制到 OBS）")
    log.info("  服务器: %s", server)
    log.info("  串流密钥: %s", stream_key)
    log.info("======== 流程结束（成功）========")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

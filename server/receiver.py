#!/usr/bin/env python3
"""
Nurosand heart-rate receiver.

- Watch connects with raw TCP and sends newline-delimited JSON: {"bpm":72,"t":...}
- Browser opens http://localhost:8765 for a live Chart.js graph (SSE updates)

Both share port 8765: HTTP requests are detected by the first line; everything else is Watch NDJSON.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import mimetypes
from pathlib import Path

HOST = "0.0.0.0"
PORT = 8765
STATIC_DIR = Path(__file__).resolve().parent / "static"
MAX_POINTS_HINT = 300

sse_clients: set[asyncio.Queue[str]] = set()
latest: dict | None = None
_imu_log_counter = 0


def broadcast(payload: dict) -> None:
    global latest
    # Keep latest HR for page refresh; IMU alone shouldn't wipe BPM display state.
    if payload.get("type") == "hr" or "bpm" in payload:
        latest = payload
    elif latest is None:
        latest = payload
    message = f"data: {json.dumps(payload)}\n\n"
    dead: list[asyncio.Queue[str]] = []
    for queue in sse_clients:
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            dead.append(queue)
    for queue in dead:
        sse_clients.discard(queue)


def log(msg: str) -> None:
    print(msg, flush=True)


async def handle_watch_stream(reader: asyncio.StreamReader, first_line: bytes) -> None:
    buffer = first_line
    while True:
        if b"\n" not in buffer:
            chunk = await reader.read(4096)
            if not chunk:
                break
            buffer += chunk
            continue

        line, _, buffer = buffer.partition(b"\n")
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line.decode("utf-8"))
            ingest_sample(payload)
        except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            log(f"skip bad sample: {exc}")
            continue


async def read_http_request(
    reader: asyncio.StreamReader, first_line: bytes
) -> tuple[str, str, dict[str, str], bytes]:
    lines = [first_line.rstrip(b"\r\n")]
    while True:
        line = await reader.readline()
        if not line or line in (b"\r\n", b"\n"):
            break
        lines.append(line.rstrip(b"\r\n"))

    request_line = lines[0].decode("utf-8", errors="replace")
    parts = request_line.split()
    method = parts[0] if parts else "GET"
    path = parts[1] if len(parts) > 1 else "/"

    headers: dict[str, str] = {}
    for raw in lines[1:]:
        if b":" not in raw:
            continue
        key, value = raw.split(b":", 1)
        headers[key.decode("utf-8", errors="replace").lower()] = value.decode(
            "utf-8", errors="replace"
        ).strip()

    body = b""
    content_length = int(headers.get("content-length", "0") or "0")
    if content_length > 0:
        body = await reader.readexactly(content_length)
    return method, path, headers, body


async def write_response(
    writer: asyncio.StreamWriter,
    status: str,
    body: bytes,
    content_type: str,
    extra_headers: list[tuple[str, str]] | None = None,
) -> None:
    headers = [
        f"HTTP/1.1 {status}",
        f"Content-Type: {content_type}",
        f"Content-Length: {len(body)}",
        "Connection: close",
        "Cache-Control: no-store",
        "Access-Control-Allow-Origin: *",
        "Access-Control-Allow-Methods: GET, POST, HEAD, OPTIONS",
        "Access-Control-Allow-Headers: Content-Type",
    ]
    if extra_headers:
        for key, value in extra_headers:
            headers.append(f"{key}: {value}")
    writer.write(("\r\n".join(headers) + "\r\n\r\n").encode("utf-8") + body)
    await writer.drain()


async def handle_sse(writer: asyncio.StreamWriter) -> None:
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=256)
    sse_clients.add(queue)

    header = (
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/event-stream\r\n"
        "Cache-Control: no-cache\r\n"
        "Connection: keep-alive\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "\r\n"
    )
    writer.write(header.encode("utf-8"))
    await writer.drain()

    if latest is not None:
        await queue.put(f"data: {json.dumps(latest)}\n\n")

    try:
        while True:
            message = await queue.get()
            writer.write(message.encode("utf-8"))
            await writer.drain()
    except (ConnectionResetError, BrokenPipeError, asyncio.CancelledError):
        pass
    finally:
        sse_clients.discard(queue)


def ingest_sample(payload: dict) -> None:
    global _imu_log_counter
    sample_type = payload.get("type")
    t = float(payload.get("t", asyncio.get_running_loop().time()))

    if sample_type == "imu" or ("ax" in payload and "bpm" not in payload):
        sample = {
            "type": "imu",
            "t": t,
            "ax": float(payload["ax"]),
            "ay": float(payload["ay"]),
            "az": float(payload["az"]),
            "gx": float(payload["gx"]),
            "gy": float(payload["gy"]),
            "gz": float(payload["gz"]),
            "roll": float(payload.get("roll", 0.0)),
            "pitch": float(payload.get("pitch", 0.0)),
            "yaw": float(payload.get("yaw", 0.0)),
            "amag": float(payload.get("amag", 0.0)),
            "gmag": float(payload.get("gmag", 0.0)),
        }
        _imu_log_counter += 1
        if _imu_log_counter % 10 == 1:
            log(f"imu amag={sample['amag']:.2f} gmag={sample['gmag']:.2f}")
        broadcast(sample)
        return

    bpm = float(payload["bpm"])
    sample = {"type": "hr", "bpm": bpm, "t": t}
    log(f"hr {bpm:.0f} bpm")
    broadcast(sample)


async def handle_http(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, first_line: bytes) -> None:
    method, path, _headers, body = await read_http_request(reader, first_line)
    path = path.split("?", 1)[0]

    if method == "OPTIONS":
        await write_response(writer, "204 No Content", b"", "text/plain")
        return

    if method == "HEAD" and path in ("/", "/index.html", "/bpm", "/hr", "/imu"):
        await write_response(writer, "200 OK", b"", "text/plain; charset=utf-8")
        return

    if method == "POST" and path in ("/bpm", "/hr", "/imu"):
        try:
            payload = json.loads(body.decode("utf-8"))
            if path == "/imu":
                payload.setdefault("type", "imu")
            ingest_sample(payload)
            await write_response(writer, "200 OK", b'{"ok":true}\n', "application/json")
        except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            log(f"skip bad sample: {exc}")
            msg = f'{{"ok":false,"error":"{exc}"}}\n'.encode("utf-8")
            await write_response(writer, "400 Bad Request", msg, "application/json")
        return

    if method == "GET" and path in ("/events", "/stream"):
        await handle_sse(writer)
        return

    if method == "GET" and path in ("/", "/index.html"):
        index = STATIC_DIR / "index.html"
        page = index.read_bytes()
        await write_response(writer, "200 OK", page, "text/html; charset=utf-8")
        return

    if method == "GET":
        candidate = (STATIC_DIR / path.lstrip("/")).resolve()
        if candidate.is_file() and STATIC_DIR.resolve() in candidate.parents:
            content_type = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
            await write_response(writer, "200 OK", candidate.read_bytes(), content_type)
            return

    not_found = b"Not found\n"
    await write_response(writer, "404 Not Found", not_found, "text/plain; charset=utf-8")


async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    peer = writer.get_extra_info("peername")
    try:
        first_line = await reader.readline()
        if not first_line:
            return

        stripped = first_line.lstrip()
        upper = stripped.upper()
        if upper.startswith((b"GET ", b"HEAD ", b"POST ", b"OPTIONS ")):
            # Avoid flooding logs with 10 Hz IMU posts
            if not upper.startswith(b"POST /IMU"):
                log(f"http {peer}")
            await handle_http(reader, writer, first_line)
        else:
            log(f"watch {peer}")
            await handle_watch_stream(reader, first_line)
    except (ConnectionResetError, BrokenPipeError):
        pass
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


async def main(host: str, port: int) -> None:
    server = await asyncio.start_server(handle_client, host, port)
    sockets = ", ".join(str(sock.getsockname()) for sock in server.sockets or [])
    log(f"Nurosand receiver listening on {sockets}")
    log(f"Open http://127.0.0.1:{port}  |  Watch POST /bpm and /imu")
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nurosand HR + IMU network receiver")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args()
    try:
        asyncio.run(main(args.host, args.port))
    except KeyboardInterrupt:
        log("\nbye")

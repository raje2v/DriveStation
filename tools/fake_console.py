#!/usr/bin/env python3
"""Fake roboRIO console server — sends stdout messages on TCP 1740.
Usage: python3 tools/fake_console.py [messages_per_sec]

1. Set dashboard to "None" in DS (Shuffleboard grabs port 1740)
2. Set team number to 0 (localhost) in DS
3. Run this script
"""
import socket, struct, time, sys

RATE = int(sys.argv[1]) if len(sys.argv) > 1 else 10  # msgs/sec

srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(("0.0.0.0", 1740))
srv.listen(1)
print(f"Listening on :1740, {RATE} msgs/sec. Set team to 0 in DS.")

while True:
    conn, addr = srv.accept()
    print(f"DS connected from {addr}")
    seq = 0
    t0 = time.time()
    try:
        while True:
            elapsed = time.time() - t0
            msg = f"[{seq:05d}] Tick {elapsed:.2f}s — The quick brown fox jumps over the lazy dog"
            if seq % 50 == 0:
                msg = f"[{seq:05d}] === PERIODIC STATUS: uptime={elapsed:.1f}s rate={RATE}/s ==="
            if seq % 25 == 0 and seq % 50 != 0:
                msg = f"[{seq:05d}] WARNING: CAN utilization at 78% — check wiring"

            ts = struct.pack(">f", elapsed)       # 4 bytes float BE
            sn = struct.pack(">H", seq & 0xFFFF)  # 2 bytes u16 BE
            body = ts + sn + msg.encode()
            tag = 0x0C  # stdout
            frame = struct.pack(">H", 1 + len(body)) + bytes([tag]) + body
            conn.sendall(frame)
            seq += 1
            time.sleep(1.0 / RATE)
    except (BrokenPipeError, ConnectionResetError):
        print("DS disconnected, waiting for reconnect...")

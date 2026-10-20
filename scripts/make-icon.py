"""Draw the app icon (sage tile, cream mug, steam) as PNGs with the stdlib only.

Usage: python scripts/make-icon.py  ->  resources/icon.png (512), resources/tray.png (32)
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "resources"

SAGE = (143, 169, 138)
CREAM = (255, 253, 248)
PEACH = (242, 184, 160)


def inside(x, y):
    """Colour at a point in unit space (0..1), or None for transparent."""
    # Rounded tile
    r = 0.22
    cx, cy = min(max(x, r), 1 - r), min(max(y, r), 1 - r)
    if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
        return None
    col = SAGE
    # Mug body
    if 0.27 <= x <= 0.63 and 0.42 <= y <= 0.78:
        bottom = 0.78 - 0.06
        if y < bottom or (x - min(max(x, 0.33), 0.57)) ** 2 + (y - bottom) ** 2 <= 0.06 ** 2:
            col = CREAM
            if 0.48 <= y <= 0.53:
                col = PEACH
    # Handle (ring)
    d = math.hypot(x - 0.65, y - 0.58)
    if 0.055 <= d <= 0.11 and x > 0.63:
        col = CREAM
    # Steam: two sine wisps
    for sx in (0.37, 0.52):
        if 0.17 <= y <= 0.36:
            wx = sx + 0.025 * math.sin((y - 0.17) * 30)
            if abs(x - wx) < 0.022:
                col = CREAM
    return col


def render(size, ss=4):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    c = inside((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size)
                    if c:
                        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 1
            n = acc[3]
            if n:
                row += bytes([acc[0] // n, acc[1] // n, acc[2] // n, 255 * n // (ss * ss)])
            else:
                row += b"\0\0\0\0"
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(t, data):
        return struct.pack(">I", len(data)) + t + data + struct.pack(">I", zlib.crc32(t + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    (OUT / "icon.png").write_bytes(render(512, 3))
    (OUT / "tray.png").write_bytes(render(32, 6))
    print("wrote", OUT / "icon.png", OUT / "tray.png")

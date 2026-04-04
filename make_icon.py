#!/usr/bin/env python3
"""Generate AutoTag .icns icon from logoAutocutter.svg using Pillow."""

import re, os, shutil, math
from PIL import Image, ImageDraw, ImageFont

SVG_W, SVG_H = 546, 498

# Path 1 (s1=white) — main logo body
PATH_WHITE = "m337.25 83.49c-5.46 2.64-10.39 6.41-20 15.29-7.01 6.47-18.15 16.3-24.75 21.83-6.6 5.52-18.52 14.97-26.5 20.99-7.98 6.02-15.47 11.61-16.65 12.42-1.19 0.81-5.24 3.67-9 6.36-3.77 2.68-10 6.61-13.85 8.72-4.56 2.52-8.3 3.87-10.75 3.88-2.06 0.01-3.76-0.32-3.78-0.73-0.02-0.41 2.32-4.35 5.18-8.75 2.87-4.4 6.08-10.02 7.15-12.5 1.2-2.81 1.92-6.75 1.91-10.5-0.02-3.3-0.54-7.35-1.18-9-0.63-1.65-2.81-4.7-4.84-6.78-2.05-2.1-6.03-4.66-8.94-5.75-2.89-1.08-7.28-1.97-9.75-1.97-2.47 0-7.09 0.81-10.25 1.8-3.16 0.99-8.9 3.53-12.75 5.66-4.5 2.48-10.06 6.93-15.57 12.45-4.71 4.72-11.06 12.41-14.11 17.09-3.05 4.68-7.59 12.55-10.09 17.5-2.5 4.95-5.66 11.7-7.01 15-1.35 3.3-3.25 8.48-4.22 11.5-0.97 3.03-3.45 9.1-5.53 13.5-2.07 4.4-5.78 10.7-8.24 14-2.47 3.3-6.45 7.62-8.86 9.61-2.4 1.98-6.62 4.99-9.37 6.68-2.75 1.7-7.62 4.12-10.82 5.4-5.35 2.12-5.78 2.52-5.19 4.81 0.35 1.38 2.08 6.1 3.83 10.5 1.76 4.4 5.67 12.46 8.69 17.9 3.29 5.95 8.09 12.69 11.99 16.85 4.43 4.74 8.41 7.87 12.5 9.85 4.28 2.06 9.57 3.42 18.5 4.75 6.87 1.03 13.85 2.54 15.5 3.37 1.65 0.82 3.34 2.24 3.75 3.14 0.41 0.9 0.75 2.77 0.75 4.14 0 1.66-1.95 4.6-5.8 8.75-3.19 3.44-7.63 8.5-9.87 11.25-2.24 2.75-5.51 7.7-7.27 11-3.02 5.64-3.19 6.52-2.89 14.67 0.18 4.77 0.69 9.04 1.13 9.5 0.43 0.46 6.51-0.52 13.5-2.17 11.03-2.61 14.54-2.99 26.7-2.96 12.56 0.04 15.64 0.43 30 3.79 8.8 2.05 20.72 4.62 26.5 5.71 5.78 1.08 15.22 2.25 21 2.6 6.15 0.37 14.85 0.13 21-0.57 5.77-0.66 14.32-2.03 19-3.04 4.68-1.01 14.12-3.71 21-6 6.87-2.29 17-6.31 22.5-8.92 5.5-2.62 14.05-7.36 19-10.53 4.95-3.17 11.64-8.31 14.86-11.42 3.23-3.11 6.7-7.46 7.73-9.66 1.03-2.2 1.86-5.12 1.86-6.5-0.01-1.37-1.24-4.67-2.73-7.32-1.5-2.65-4.29-5.88-6.22-7.18-1.93-1.29-5.98-3.14-9-4.09-4.66-1.48-7.69-1.65-19.75-1.08-7.84 0.37-14.27 0.33-14.29-0.08-0.02-0.41 2.79-2.29 6.25-4.17 3.46-1.88 9.22-5.33 12.79-7.66 3.57-2.34 8.52-6.01 11-8.17 2.48-2.15 5.96-6.12 7.75-8.83 1.78-2.71 3.51-6.72 3.84-8.92 0.33-2.2 0.1-5.8-0.52-8-0.62-2.2-2.38-5.57-3.92-7.5-1.53-1.93-5.23-4.74-8.22-6.26-4.41-2.25-6.74-2.76-12.43-2.74-3.85 0.01-11.95 0.65-18 1.43-6.05 0.78-12.76 1.11-14.9 0.74-3.15-0.54-3.63-0.9-2.5-1.83 0.77-0.64 8.15-4.17 16.4-7.85 8.25-3.67 25.57-10.97 38.5-16.21 12.93-5.24 25.75-10.41 28.5-11.48 2.75-1.08 6.35-2.57 8-3.32 1.65-0.75 8.18-3.67 14.5-6.5 6.32-2.83 14.61-7.24 18.41-9.81 3.8-2.57 7.82-6.02 8.94-7.67 1.12-1.65 2.42-4.57 2.9-6.5 0.62-2.51 0.39-5.06-0.8-9-1.14-3.77-2.96-6.8-5.81-9.63-2.42-2.42-5.8-4.6-8.14-5.25-2.2-0.61-5.91-1.11-8.25-1.11-2.34-0.01-7.51 0.64-11.5 1.44-3.99 0.8-13.1 3.44-20.25 5.87-7.15 2.43-20.65 7.14-30 10.48-9.35 3.33-21.73 7.83-27.5 9.99-5.77 2.17-15.45 5.78-21.5 8.04-6.05 2.26-15.5 5.44-21 7.08-5.5 1.63-12.02 3.28-14.5 3.66q-4.5 0.69-3.5-0.31c0.55-0.55 5.08-4.1 10.06-7.88 4.98-3.78 12.8-9.8 17.38-13.38 4.57-3.57 11.52-9.13 15.44-12.35 3.91-3.22 10.72-9.03 15.12-12.92 4.4-3.89 11.32-10.49 15.37-14.65 4.06-4.17 9.46-10.36 12-13.77 2.55-3.4 6.2-9.24 8.13-12.98 3.05-5.92 3.5-7.74 3.5-14 0-6.64-0.23-7.44-3-10.29-1.65-1.7-4.46-3.76-6.25-4.57-1.79-0.81-4.94-1.48-7-1.48-2.27-0.01-6.61 1.37-11 3.5z"

# Path 2 (s0=black) — three horizontal stripe cutouts
PATH_STRIPES = "m240 228.65c-6.32 2.48-16.22 6.33-22 8.56-5.78 2.22-13.2 5.09-16.5 6.36-3.3 1.28-10.72 4.19-16.5 6.48-5.78 2.29-13.2 5.21-16.5 6.48-3.3 1.27-8.7 3.53-12 5.03l-6 2.72c4.65 1.37 9.04 2.43 12.75 3.24 3.71 0.82 9.9 1.48 13.75 1.48 5.05 0 9.44-0.81 15.75-2.9 4.81-1.6 13.47-4.73 19.25-6.97 5.78-2.24 19.41-7.57 30.29-11.85 10.89-4.28 20.2-8.46 20.7-9.28 0.61-1.01 0.11-3.21-1.54-6.75-1.35-2.89-3.35-5.7-4.45-6.25-1.1-0.55-2.79-0.97-3.75-0.93-0.96 0.05-6.93 2.11-13.25 4.58zm15.5 44.36c-3.85 1.6-16.9 6.72-29 11.37-12.1 4.64-26.28 10.23-31.5 12.4-5.22 2.18-11.87 5.03-14.77 6.34-2.89 1.31-5.26 2.61-5.26 2.88 0 0.27 3.27 1.58 7.27 2.91 3.99 1.33 10.64 2.61 14.76 2.86 6.77 0.41 8.37 0.11 16.5-3.05 4.95-1.92 13.28-5.1 18.5-7.06 5.22-1.96 15.13-5.87 22-8.68 6.88-2.81 14.41-5.75 16.75-6.54 2.62-0.89 4.73-2.39 5.5-3.93 1.07-2.12 0.95-3.02-0.75-6.1-1.1-1.98-2.9-4.24-4-5.02-1.1-0.77-3.57-1.38-5.5-1.35-1.93 0.02-6.65 1.36-10.5 2.97zm14.5 44.11c-4.12 1.65-10.87 4.3-15 5.88-4.12 1.58-14.03 5.39-22 8.47-7.97 3.08-18.32 7.18-23 9.12-4.68 1.93-11.1 4.73-14.27 6.21-3.59 1.68-5.29 2.96-4.5 3.39 0.7 0.37 5.09 1.61 9.77 2.74 4.68 1.13 10.75 2.06 13.5 2.07 2.75 0.01 7.47-0.71 10.5-1.61 3.03-0.89 12.93-4.53 22-8.08 9.07-3.54 20.1-7.94 24.5-9.77 4.4-1.82 10.2-4.15 12.9-5.18 2.84-1.08 5.2-2.7 5.63-3.86 0.43-1.14 0.14-3.5-0.66-5.5-0.78-1.93-2.41-4.31-3.64-5.29-1.23-0.99-3.58-1.75-5.23-1.69-1.65 0.05-6.37 1.45-10.5 3.1z"

BG      = (26, 28, 32, 255)
WHITE   = (255, 255, 255, 255)
DARK    = (26, 28, 32, 255)


def _cubic(p0, p1, p2, p3, n=20):
    pts = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        x = u**3*p0[0] + 3*u**2*t*p1[0] + 3*u*t**2*p2[0] + t**3*p3[0]
        y = u**3*p0[1] + 3*u**2*t*p1[1] + 3*u*t**2*p2[1] + t**3*p3[1]
        pts.append((x, y))
    return pts


def _quad(p0, p1, p2, n=12):
    pts = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        x = u**2*p0[0] + 2*u*t*p1[0] + t**2*p2[0]
        y = u**2*p0[1] + 2*u*t*p1[1] + t**2*p2[1]
        pts.append((x, y))
    return pts


def parse_path(d, sx, sy, ox, oy):
    toks = re.findall(
        r'[MmCcLlZzQqHhVv]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', d)
    polys, poly = [], []
    cx = cy = sx0 = sy0 = 0.0
    cmd = 'M'
    nums = []

    def pt(x, y):
        return (x * sx + ox, y * sy + oy)

    def flush():
        nonlocal poly
        if poly:
            polys.append(poly)
            poly = []

    def consume():
        nonlocal cx, cy, sx0, sy0, cmd, poly
        while True:
            if cmd in ('M', 'm'):
                if len(nums) < 2: break
                x, y = nums.pop(0), nums.pop(0)
                if cmd == 'm': cx += x; cy += y
                else: cx, cy = x, y
                sx0, sy0 = cx, cy
                flush()
                poly.append(pt(cx, cy))
                cmd = 'l' if cmd == 'm' else 'L'
            elif cmd in ('C', 'c'):
                if len(nums) < 6: break
                v = [nums.pop(0) for _ in range(6)]
                if cmd == 'c':
                    p1 = (cx+v[0], cy+v[1]); p2 = (cx+v[2], cy+v[3]); p3 = (cx+v[4], cy+v[5])
                else:
                    p1 = (v[0], v[1]); p2 = (v[2], v[3]); p3 = (v[4], v[5])
                for p in _cubic((cx, cy), p1, p2, p3)[1:]:
                    poly.append(pt(p[0], p[1]))
                cx, cy = p3
            elif cmd in ('Q', 'q'):
                if len(nums) < 4: break
                v = [nums.pop(0) for _ in range(4)]
                if cmd == 'q':
                    p1 = (cx+v[0], cy+v[1]); p2 = (cx+v[2], cy+v[3])
                else:
                    p1 = (v[0], v[1]); p2 = (v[2], v[3])
                for p in _quad((cx, cy), p1, p2)[1:]:
                    poly.append(pt(p[0], p[1]))
                cx, cy = p2
            elif cmd in ('L', 'l'):
                if len(nums) < 2: break
                x, y = nums.pop(0), nums.pop(0)
                if cmd == 'l': cx += x; cy += y
                else: cx, cy = x, y
                poly.append(pt(cx, cy))
            elif cmd in ('H', 'h'):
                if len(nums) < 1: break
                x = nums.pop(0)
                if cmd == 'h': cx += x
                else: cx = x
                poly.append(pt(cx, cy))
            elif cmd in ('V', 'v'):
                if len(nums) < 1: break
                y = nums.pop(0)
                if cmd == 'v': cy += y
                else: cy = y
                poly.append(pt(cx, cy))
            else:
                break

    for tok in toks:
        if re.match(r'^[A-Za-z]$', tok):
            consume()
            if tok in ('z', 'Z'):
                cx, cy = sx0, sy0
                flush()
            else:
                cmd = tok; nums = []
        else:
            nums.append(float(tok))
    consume()
    flush()
    return polys


def make_icon(size):
    # Allocate ~72% height for logo, 20% for text, rest for padding
    pad      = max(int(size * 0.07), 4)
    text_h   = int(size * 0.18)
    avail_w  = size - 2 * pad
    avail_h  = size - 2 * pad - text_h

    # Use actual content bounding box instead of full SVG viewBox
    # Computed from path vertices: x=79.3-440.6, y=80.0-384.8
    CONTENT_X0, CONTENT_Y0 = 79.3, 80.0
    CONTENT_W,  CONTENT_H  = 361.3, 304.8

    scale    = min(avail_w / CONTENT_W, avail_h / CONTENT_H)
    logo_w   = CONTENT_W * scale
    logo_h   = CONTENT_H * scale
    ox       = pad + (avail_w - logo_w) / 2 - CONTENT_X0 * scale
    oy       = pad + (avail_h - logo_h) / 2 - CONTENT_Y0 * scale

    img  = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)

    # White logo body
    for poly in parse_path(PATH_WHITE, scale, scale, ox, oy):
        if len(poly) >= 3:
            draw.polygon([v for pt in poly for v in pt], fill=WHITE)

    # Dark stripe cutouts
    for poly in parse_path(PATH_STRIPES, scale, scale, ox, oy):
        if len(poly) >= 3:
            draw.polygon([v for pt in poly for v in pt], fill=DARK)

    # "DashboardJeux" text
    label     = "DashboardJeux"
    font_size = max(int(size * 0.115), 8)
    font      = None
    for fp in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ]:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, font_size)
                break
            except Exception:
                pass
    if font is None:
        font = ImageFont.load_default()

    bb = draw.textbbox((0, 0), label, font=font)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    tx = (size - tw) / 2
    # Centre text vertically in the text area at the bottom
    ty = size - text_h + (text_h - th) / 2
    draw.text((tx, ty), label, fill=WHITE, font=font)

    return img


SIZES = [16, 32, 64, 128, 256, 512, 1024]

HERE = os.path.dirname(os.path.abspath(__file__))
ICONSET = os.path.join(HERE, "icon.iconset")

if os.path.exists(ICONSET):
    shutil.rmtree(ICONSET)
os.makedirs(ICONSET)

# iconutil naming: icon_SIZEx SIZE.png and icon_SIZEx SIZE@2x.png
for s in SIZES:
    img = make_icon(s)
    name = f"icon_{s}x{s}.png"
    img.save(os.path.join(ICONSET, name))
    print(f"  {name}")

# @2x variants (double-density)
for s in [16, 32, 64, 128, 256, 512]:
    img = make_icon(s * 2)
    name = f"icon_{s}x{s}@2x.png"
    img.save(os.path.join(ICONSET, name))
    print(f"  {name}")

print("Iconset ready — running iconutil…")

from __future__ import annotations
import math, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "assets" / "xc-intro-v2.mp4"
W, H = 1920, 1080
FPS, DURATION = 30, 8
FRAMES = FPS * DURATION
FONT_REG = r"C:\Windows\Fonts\segoeui.ttf"
FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
TEAL = (45, 212, 191)
VIOLET = (167, 139, 250)
PINK = (244, 114, 182)
ICE = (224, 242, 254)
def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)
F_TITLE = font(132, True)
F_SUB = font(34)
F_TINY = font(19)
F_BADGE = font(20, True)
def c01(v):
    return max(0.0, min(1.0, v))
def smooth(v):
    v = c01(v)
    return v * v * (3 - 2 * v)
def expo_out(v):
    v = c01(v)
    return 1 - 2 ** (-10 * v) if v < 1 else 1.0
def inout(v):
    v = c01(v)
    return 4 * v ** 3 if v < 0.5 else 1 - (-2 * v + 2) ** 3 / 2
def back_out(v):
    v = c01(v)
    c = 1.70158
    return 1 + (c + 1) * (v - 1) ** 3 + c * (v - 1) ** 2
def win(t, start, end, fade=0.25):
    return smooth((t - start) / fade) * (1 - smooth((t - (end - fade)) / fade))
def rgba(color, alpha):
    return (*color, max(0, min(255, int(alpha * 255))))
def build_base():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx, ny = xx / W, yy / H
    glow = np.exp(-(((nx - 0.5) / 0.42) ** 2 + ((ny - 0.46) / 0.5) ** 2) * 2.4)
    top = 0.55 + 0.45 * (1 - ny)
    r = (6 + 14 * glow) * top
    g = (9 + 30 * glow) * top
    b = (18 + 52 * glow) * top
    arr = np.stack([r, g, b], axis=2).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")
def make_blob(color, size=560):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i in range(24, 0, -1):
        a = 0.028 * (1 - i / 26) ** 1.6
        rr = int(size * 0.5 * i / 24)
        d.ellipse([size // 2 - rr, size // 2 - rr, size // 2 + rr, size // 2 + rr], fill=rgba(color, a * 9))
    return img.filter(ImageFilter.GaussianBlur(28))
def build_vig():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx, ny = xx / W - 0.5, yy / H - 0.5
    dd = np.sqrt(nx ** 2 * 1.15 + ny ** 2 * 1.6) * 2
    dark = np.clip((dd - 0.62) * 0.62, 0, 0.52)
    alpha = Image.fromarray((dark * 255).astype(np.uint8), "L")
    black = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    black.putalpha(alpha)
    return black
def build_grid():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    horizon = int(H * 0.62)
    for i in range(14):
        p = i / 13
        y = horizon + int((H - horizon) * p ** 1.7)
        d.line([(0, y), (W, y)], fill=(94, 234, 212, int(26 * p + 6)), width=1)
    for i in range(-14, 15):
        d.line([(W // 2 + i * 26, horizon), (W // 2 + i * 170, H)], fill=(139, 146, 255, 22), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.6))
def text_c(d, cx, y, s, f, fill, spacing=0):
    if not spacing:
        d.text((cx, y), s, font=f, fill=fill, anchor="mm")
        return
    widths = [d.textlength(ch, font=f) for ch in s]
    total = sum(widths) + spacing * (len(s) - 1)
    x = cx - total / 2
    for ch, wch in zip(s, widths):
        d.text((x, y), ch, font=f, fill=fill, anchor="lm")
        x += wch + spacing
def track(t, start):
    return 26 * (1 - expo_out((t - start) / 0.9)) + 3
def glow_text(base, cx, y, s, f, color, ga, spacing=0, blur=18):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    text_c(ld, cx, y, s, f, rgba(color, ga), spacing)
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
def glass(img, box, radius, alpha):
    x0, y0, x1, y1 = [int(v) for v in box]
    if x1 <= x0 or y1 <= y0:
        return
    card = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle([0, 0, x1 - x0, y1 - y0], radius=radius, fill=(13, 22, 38, int(235 * alpha)), outline=(148, 210, 255, int(90 * alpha)), width=2)
    cd.rounded_rectangle([3, 3, x1 - x0 - 3, 14], radius=max(2, radius - 3), fill=(255, 255, 255, int(26 * alpha)))
    img.alpha_composite(card, (x0, y0))
BASE = build_base()
BT = make_blob(TEAL)
BV = make_blob(VIOLET)
BP = make_blob(PINK)
VIG = build_vig()
GRID = build_grid()
NG = np.random.default_rng(7)
ST = [(float(NG.uniform(0, W)), float(NG.uniform(0, H)), float(NG.uniform(0.3, 1.0)), float(NG.uniform(0, 6.28))) for _ in range(150)]
GR = Image.fromarray((NG.uniform(0, 255, (180, 320))).astype(np.uint8), "L")
GR = GR.resize((W, H), Image.Resampling.BILINEAR)

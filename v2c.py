from v2a import *
from v2b import chip
def act1b(img, d, time, a1):
    cy = H * 0.5 - (1 - expo_out(time / 1.0)) * 70
    uw = 560 * expo_out(max(0, time - 0.5) / 0.8)
    big = uw > 4
    if big:
        grad = Image.new("RGBA", (int(uw), 8), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grad)
        for i in range(int(uw)):
            p = i / max(1, uw - 1)
            cc = (int(45 + 199 * p), int(212 - 98 * p), int(191 - 9 * p), int(220 * a1 * math.sin(math.pi * p) ** 0.5))
            gd.line([(i, 0), (i, 8)], fill=cc)
        img.alpha_composite(grad, (int(W / 2 - uw / 2), int(cy + 30)))
    items = (("BIO 101", VIOLET, 0.24, 0.24), ("+214 pages", TEAL, 0.76, 0.30))
    for label, accent, fx, fy in items:
        bob = math.sin(time * 2 + fx * 9) * 14
        ca = a1 * win(time, 0.35, 2.2, fade=0.3)
        show = ca > 0.02
        if show:
            chip(d, W * fx, H * fy + bob, label, accent, max(0, ca))
    more = (("CHEM NOTES", PINK, 0.22, 0.62), ("DUE FRIDAY!", (255, 120, 120), 0.78, 0.60))
    for label, accent, fx, fy in more:
        bob = math.sin(time * 2 + fx * 9) * 14
        ca = a1 * win(time, 0.35, 2.2, fade=0.3)
        show = ca > 0.02
        if show:
            chip(d, W * fx, H * fy + bob, label, accent, max(0, ca))

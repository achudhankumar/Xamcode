from v2a import *
from v2b import chip, frame_bg, act1
from v2c import act1b
from v2d import act2, act2cards
def act3(img, d, time, a3):
    bt = time - 5.2
    pop = max(back_out(bt / 0.6), 0.01)
    ls = int(150 * pop)
    lx, ly = W // 2, 400
    big = ls > 4
    if big:
        halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        hs = ls * 3
        hh = BT.resize((hs, hs), Image.Resampling.BILINEAR)
        halo.alpha_composite(hh, (int(lx - hs / 2), int(ly - hs / 2)))
        img.alpha_composite(Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 0)), halo, 0.35 * a3))
        logo = Image.new("RGBA", (ls, ls), (0, 0, 0, 0))
        ld = ImageDraw.Draw(logo)
        ld.rounded_rectangle([0, 0, ls, ls], radius=int(ls * 0.28), fill=(16, 32, 48, int(240 * a3)), outline=(94, 234, 212, int(200 * a3)), width=4)
        s = ls * 0.30
        c = ls / 2
        ld.line([(c - s, c - s), (c + s, c + s)], fill=(94, 234, 212, int(255 * a3)), width=max(3, ls // 12), joint="curve")
        ld.line([(c + s, c - s), (c - s, c + s)], fill=(244, 114, 182, int(255 * a3)), width=max(3, ls // 12), joint="curve")
        img.alpha_composite(logo, (int(lx - ls / 2), int(ly - ls / 2)))
        # impact FX at the logo pop: double ring burst + radial confetti
        if bt < 1.35:
            burst = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            bnd = ImageDraw.Draw(burst)
            if 0 < bt < 1.1:
                rp = expo_out(bt / 0.9)
                ra = max(0.0, 1 - bt / 1.1)
                rr = int(150 + rp * 540)
                bnd.ellipse([lx - rr, ly - rr, lx + rr, ly + rr],
                            outline=rgba((94, 234, 212), 0.85 * ra * a3), width=max(2, int(9 * ra)))
                rr2 = int(rr * 0.6)
                bnd.ellipse([lx - rr2, ly - rr2, lx + rr2, ly + rr2],
                            outline=rgba((244, 114, 182), 0.7 * ra * a3), width=max(2, int(6 * ra)))
            if bt > 0:
                cp = expo_out(min(bt, 1.3) / 1.2)
                ca = max(0.0, 1 - bt / 1.3)
                for k in range(20):
                    ang = k * (math.tau / 20)
                    dist = cp * (260 + (k * 53) % 300)
                    px = lx + math.cos(ang) * dist
                    py = ly + math.sin(ang) * dist * 0.88
                    rad = 5 + (k % 3) * 3
                    bnd.ellipse([px - rad, py - rad, px + rad, py + rad],
                                fill=rgba((TEAL, PINK, VIOLET)[k % 3], 0.9 * ca * a3))
            img.alpha_composite(burst)
    rise = expo_out(bt / 0.9)
    byy = 610 + (1 - rise) * 60
    tr = int(track(time, 5.35))
    glow_text(img, W / 2, byy, "XAMCODE AI", F_TITLE, TEAL, 0.55 * a3, spacing=tr, blur=30)
    dd = ImageDraw.Draw(img, "RGBA")
    text_c(dd, W / 2, byy, "XAMCODE AI", F_TITLE, rgba((255, 255, 255), a3), spacing=tr)
    text_c(dd, W / 2, byy + 110, "UPLOAD. UNDERSTAND. ACE IT.", F_SUB, rgba(TEAL, 0.9 * a3), spacing=6)
    # The "TAP TO ENTER" chip and its pulsing halo ring used to sit here at
    # y=880. Both are removed: the intro already has a real Skip control,
    # so a baked-in CTA only advertised an interaction that does not
    # exist in the video itself (the whole overlay is click-to-dismiss).
    # chip() is still used by v2c.py, so the import stays.
def draw_frame(time):
    img = frame_bg(time)
    d = ImageDraw.Draw(img, "RGBA")
    a1 = win(time, 0.0, 2.35, fade=0.3)
    on1 = a1 > 0.01
    if on1:
        act1(img, d, time, a1)
        act1b(img, d, time, a1)
        d = ImageDraw.Draw(img, "RGBA")
    a2 = win(time, 2.3, 5.3, fade=0.3)
    on2 = a2 > 0.01
    if on2:
        act2(img, d, time, a2)
        act2cards(img, d, time, a2)
        d = ImageDraw.Draw(img, "RGBA")
    a3 = win(time, 5.2, 8.6, fade=0.35)
    on3 = a3 > 0.01
    if on3:
        act3(img, d, time, a3)
        d = ImageDraw.Draw(img, "RGBA")
    gf = win(time, 2.0, 8.6, fade=0.6)
    show = gf > 0.02
    if show:
        img.alpha_composite(Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 0)), GRID, gf * 0.8))
    bar = int(64 * win(time, 0.0, 8.6, fade=0.5))
    tall = bar > 0
    if tall:
        d4 = ImageDraw.Draw(img, "RGBA")
        d4.rectangle([0, 0, W, bar], fill=(0, 0, 0, 255))
        d4.rectangle([0, H - bar, W, H], fill=(0, 0, 0, 255))
    # scene-cut flashes + radial speed streaks (locked to the SFX hits)
    for ct in (2.3, 5.2):
        ft = time - ct
        if 0 <= ft < 0.35:
            fa = (1 - ft / 0.35) ** 2
            img.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, int(52 * fa))))
            sd = ImageDraw.Draw(img, "RGBA")
            for k in range(14):
                ang = k * (math.tau / 14) + ct
                r0 = 240 + 660 * (ft / 0.35)
                r1 = r0 + 150
                sd.line([(W / 2 + math.cos(ang) * r0, H / 2 + math.sin(ang) * r0 * 0.85),
                         (W / 2 + math.cos(ang) * r1, H / 2 + math.sin(ang) * r1 * 0.85)],
                        fill=rgba((215, 255, 248), int(160 * fa)), width=3)
    # soft light sheen sweeping across each act
    for st0 in (0.35, 5.35):
        st = time - st0
        if 0 <= st < 1.0:
            sx = int(-420 + (W + 840) * st)
            sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(sh).polygon([(sx, 0), (sx + 300, 0), (sx + 150, H), (sx - 150, H)],
                                       fill=(255, 255, 255, int(24 * math.sin(math.pi * st))))
            img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(30)))
    # faint radar scanline drifting down the frame
    scan = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sy = int((time * 430) % (H + 160)) - 80
    ImageDraw.Draw(scan).rectangle([0, sy, W, sy + 3], fill=(94, 234, 212, 44))
    img.alpha_composite(scan)
    img.alpha_composite(Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 0)), VIG, 0.9))
    grain = GR.point(lambda v: int(v * 0.05))
    img = Image.composite(img, img.convert("RGB").convert("RGBA"), grain)
    return img.convert("RGB")

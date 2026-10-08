from v2a import *
def chip(d, cx, y, label, accent, alpha, w=None):
    h = 44
    tw = d.textlength(label, font=F_TINY)
    need = 42 + tw + 24
    w = need if w is None else max(w, need)
    x0, y0 = cx - w / 2, y - h / 2
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=22, fill=rgba((10, 18, 32), 0.72 * alpha), outline=rgba(accent, 0.75 * alpha), width=2)
    dx = x0 + 24
    d.ellipse([dx - 7, y - 7, dx + 7, y + 7], fill=rgba(accent, 0.95 * alpha))
    d.text((dx + 18, y + 1), label, font=F_TINY, fill=rgba(ICE, 0.95 * alpha), anchor="lm")
def frame_bg(time):
    img = BASE.copy()
    zoom = 1.0 + 0.035 * inout(time / DURATION)
    done = zoom > 1.001
    if done:
        zw, zh = int(W * zoom), int(H * zoom)
        img = img.resize((zw, zh), Image.Resampling.BILINEAR)
        img = img.crop(((zw - W) // 2, (zh - H) // 2, (zw - W) // 2 + W, (zh - H) // 2 + H))
    blobs = ((BT, 0.30, 0.30, 90, 0.5, 0.0, 1.0, 0.5), (BV, 0.72, 0.26, 110, 0.4, 2.1, 1.15, 0.5))
    for blob, bx, by, amp, sp, ph, sc, al in blobs:
        t = time * sp + ph
        x = int(bx * W + math.sin(t) * amp - blob.width * sc / 2)
        y = int(by * H + math.cos(t * 0.8) * amp * 0.7 - blob.height * sc / 2)
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        layer.alpha_composite(blob, (x, y))
        img.alpha_composite(Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 0)), layer, al))
    dust = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dust)
    for sx, sy, size, ph in ST:
        tw = 0.25 + 0.75 * (0.5 + 0.5 * math.sin(time * 1.6 + ph))
        yy = (sy + time * 8 * size) % H
        dd.ellipse([sx - size, yy - size, sx + size, yy + size], fill=(190, 230, 255, int(120 * tw)))
    img.alpha_composite(dust)
    return img
def act1(img, d, time, a1):
    rise = expo_out(time / 1.0)
    cy = H * 0.5 - (1 - rise) * 70
    glow_text(img, W / 2, cy - 190, "DROWNING IN", F_SUB, TEAL, 0.55 * a1, spacing=10, blur=14)
    d.text((W / 2, cy - 190), "DROWNING IN", font=F_SUB, fill=rgba(ICE, 0.8 * a1), anchor="mm")
    wob = math.sin(min(time, 1.2) * 9) * 10 * max(0, 1 - time / 1.2)
    tr = int(track(time, 0.15))
    glow_text(img, W / 2 + wob, cy - 60, "STUDY CHAOS?", F_TITLE, (255, 120, 180), 0.5 * a1, spacing=tr, blur=26)
    text_c(d, W / 2 + wob, cy - 60, "STUDY CHAOS?", F_TITLE, rgba((255, 255, 255), a1), spacing=tr)
    # chromatic-aberration glitch split on the two whoosh SFX hits
    for gt, gw in ((0.18, 0.22), (1.25, 0.16)):
        if abs(time - gt) < gw:
            k = (1 - abs(time - gt) / gw) * a1
            off = int(8 * k) + 1
            text_c(d, W / 2 + wob - off, cy - 60, "STUDY CHAOS?", F_TITLE, rgba((0, 235, 255), 0.5 * k), spacing=tr)
            text_c(d, W / 2 + wob + off, cy - 60, "STUDY CHAOS?", F_TITLE, rgba((255, 50, 120), 0.5 * k), spacing=tr)

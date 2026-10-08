from v2a import *
from v2b import chip, frame_bg, act1, text_c, glow_text
def act2(img, d, time, a2):
    lt = time - 2.3
    bx = W * (0.1 + 0.8 * inout(lt / 0.9))
    beam = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(beam)
    bd.polygon([(bx - 130, 0), (bx - 30, 0), (bx + 60, H), (bx - 40, H)], fill=(120, 240, 220, int(70 * a2 * max(0, 1 - lt / 1.2))))
    img.alpha_composite(beam.filter(ImageFilter.GaussianBlur(24)))
    doc_a = a2 * (1 - smooth((lt - 0.9) / 0.5))
    dx0, dy0, dw, dh = 300, 300, 300, 420
    vis = doc_a > 0.02
    if vis:
        pop = max(back_out(lt / 0.55), 0.01)
        w2, h2 = int(dw * pop), int(dh * pop)
        glass(img, (dx0 + dw // 2 - w2 // 2, dy0 + dh // 2 - h2 // 2, dx0 + dw // 2 + w2 // 2, dy0 + dh // 2 + h2 // 2), 26, doc_a)
        dd = ImageDraw.Draw(img, "RGBA")
        widths = (220, 190, 205, 150, 175, 120, 90)
        k = 0
        while k < 7:
            yy = dy0 + 70 + k * 44
            dd.rounded_rectangle([dx0 + 40, yy, dx0 + 40 + widths[k] * pop, yy + 12], radius=6, fill=rgba((150, 200, 235), 0.5 * doc_a))
            k += 1
        dd.text((dx0 + 40, dy0 + 34), "SUBJECT_NOTES.PDF", font=F_TINY, fill=rgba((255, 150, 150), 0.9 * doc_a))
        # live "parsing" progress bar under the document
        pb = c01((lt - 0.15) / 1.1)
        bx0, by0, bw, bh = dx0 + 40, dy0 + dh + 26, dw - 80, 14
        dd.rounded_rectangle([bx0, by0, bx0 + bw, by0 + bh], radius=7,
                             fill=rgba((16, 34, 52), 0.8 * doc_a),
                             outline=rgba(TEAL, 0.5 * doc_a), width=1)
        fw = int(bw * pb)
        if fw > 6:
            dd.rounded_rectangle([bx0, by0, bx0 + fw, by0 + bh], radius=7,
                                 fill=rgba(TEAL, 0.95 * doc_a))
        dd.text((bx0 + bw, by0 + bh + 12), f"{int(pb * 100)}% PARSED",
                font=F_TINY, fill=rgba(ICE, 0.75 * doc_a), anchor="ra")
def act2cards(img, d, time, a2):
    lt = time - 2.3
    dx0, dy0, dw, dh = 300, 300, 300, 420
    cards = (("CONCEPTS", TEAL, 0.55), ("VISUALS", VIOLET, 0.85), ("PRACTICE", PINK, 1.15))
    i = 0
    while i < 3:
        label, accent, delay = cards[i]
        p = back_out((lt - delay) / 0.6)
        go = p > 0
        if go:
            p = min(p, 1.15)
            cx = 1080 + i * 235
            cyy = 480 + (i % 2) * 40 + math.sin(time * 2 + i * 2) * 8
            w2, h2 = int(200 * p), int(280 * p)
            trail = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            td = ImageDraw.Draw(trail)
            td.line([(dx0 + dw, dy0 + dh // 2), (cx, cyy)], fill=rgba(accent, 0.35 * a2 * p), width=3)
            # glowing data packet travelling from the document into the card
            pu = (time * 0.8 + i * 0.37) % 1.0
            qx = (dx0 + dw) + (cx - (dx0 + dw)) * pu
            qy = (dy0 + dh // 2) + (cyy - (dy0 + dh // 2)) * pu
            td.ellipse([qx - 14, qy - 14, qx + 14, qy + 14], fill=rgba(accent, 0.30 * a2))
            td.ellipse([qx - 6, qy - 6, qx + 6, qy + 6], fill=rgba((220, 255, 250), 0.95 * a2))
            img.alpha_composite(trail.filter(ImageFilter.GaussianBlur(6)))
            ImageDraw.Draw(img, "RGBA").ellipse([qx - 5, qy - 5, qx + 5, qy + 5],
                                                fill=rgba((255, 255, 255), 0.9 * a2))
            glass(img, (cx - w2 // 2, cyy - h2 // 2, cx + w2 // 2, cyy + h2 // 2), 22, a2)
            d3 = ImageDraw.Draw(img, "RGBA")
            d3.ellipse([cx - 26 * p, cyy - 60 * p, cx + 26 * p, cyy - 8 * p], fill=rgba(accent, 0.85 * a2), outline=rgba((255, 255, 255), 0.6 * a2), width=2)
            text_c(d3, cx, cyy + 60 * p, label, F_BADGE, rgba(ICE, a2), spacing=2)
            link = i > 0
            if link:
                pcx = 1080 + (i - 1) * 235
                pcyy = 480 + ((i - 1) % 2) * 40 + math.sin(time * 2 + (i - 1) * 2) * 8
                d3.line([(pcx + 100 * p, pcyy), (cx - 100 * p, cyy)], fill=rgba((140, 220, 255), 0.4 * a2), width=2)
                for q in range(2):
                    u = (time * 0.9 + q * 0.5 + i * 0.23) % 1.0
                    jx = (pcx + 100 * p) + ((cx - 100 * p) - (pcx + 100 * p)) * u
                    jy = pcyy + (cyy - pcyy) * u
                    d3.ellipse([jx - 5, jy - 5, jx + 5, jy + 5], fill=rgba((210, 250, 255), 0.9 * a2))
        i += 1
    text_c(d, W / 2, 930, "XAMCODE  READS  EVERY  PAGE", F_SUB, rgba(ICE, 0.85 * a2), spacing=8)

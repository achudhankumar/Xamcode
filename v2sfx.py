"""Clean, professional (Apple-style) sound design for the 8 s XamCode AI intro.

Replaces the first-pass synthesis (full-band noise risers + tanh soft-clip
master) which sounded harsh/disturbed. This version uses:

  * band-limited noise whooshes with a smooth spectral sweep,
  * pitch-enveloped sine kicks/impacts with soft attack and seamless tails,
  * soft-attack glass bells for the chimes and closing arpeggio,
  * a pure-sine pad bed, gentle fades and peak normalisation (no clipping).

Picture-locked timings are unchanged, so audio sync with the visuals holds:
  0.18 / 1.25          title glitch swishes (chromatic-aberration splits)
  2.30                 scene-cut flash accent (whoosh + soft sub thump)
  2.75 .. 7.07         rhythm kicks on the 0.36 s grid (bar accents)
  5.20                 logo pop impact (sub + glass bell + sparkle)
  6.00                 TAP TO ENTER ping
  6.62/6.72/6.84       closing arpeggio
  7.70 .. 8.00         fade matching the picture fade

Called from v2f.make_audio(); run standalone with:  python v2sfx.py out.wav
"""
from __future__ import annotations

import wave as _w

import numpy as np

SR = 48000
DURATION = 8.0
N = int(SR * DURATION)
T = np.arange(N, dtype=np.float64) / SR


def _place(dst, at, sig):
    i = int(round(at * SR))
    if i < 0:
        sig = sig[-i:]
        i = 0
    if i >= N or len(sig) == 0:
        return
    seg = sig[: N - i]
    dst[i:i + len(seg)] += seg


def _band_noise(n, f_lo, f_hi, seed):
    """Unit-RMS noise band-limited to [f_lo, f_hi] with soft 4th-order edges."""
    spec = np.fft.rfft(np.random.default_rng(seed).normal(0.0, 1.0, n))
    freqs = np.maximum(np.fft.rfftfreq(n, 1.0 / SR), 1e-6)
    mask = (1.0 / (1.0 + (f_lo / freqs) ** 4)) * (1.0 / (1.0 + (freqs / f_hi) ** 4))
    y = np.fft.irfft(spec * mask, n)
    rms = float(np.sqrt(np.mean(y * y)))
    return y / rms if rms > 1e-9 else y


def _whoosh(length, f0, f1, seed, layers=5, front=False):
    """Airy noise whose band centre sweeps f0 -> f1; peak-normalised to 1.0.

    Built as an equal-power crossfade of static band-limited noise layers, so
    the sweep is perfectly smooth (no filter zippering) and never contains the
    full-band hiss of the previous version.  ``front=True`` gives a fast
    (50 ms) attack with a decaying tail — used for whooshes that must read as
    hits locked to a hard picture cut; otherwise a symmetric mid-crest swell.
    """
    n = max(int(length * SR), 8)
    tt = np.arange(n) / SR
    p = np.clip(tt / max(length, 1e-6), 0.0, 1.0)
    centres = f0 * (f1 / f0) ** (np.arange(layers) / (layers - 1))
    target = f0 * (f1 / f0) ** p
    sigma = np.log(f1 / f0) / (layers - 1)
    out = np.zeros(n)
    power = np.zeros(n)
    for i, fc in enumerate(centres):
        w = np.exp(-0.5 * (np.log(target / fc) / sigma) ** 2)
        out += w * _band_noise(n, max(fc * 0.55, 60.0), fc * 1.9, seed + 17 * i)
        power += w * w
    out /= np.sqrt(np.maximum(power, 1e-9))
    if front:
        atk = min(0.05, 0.3 * length)
        env = np.minimum(tt / atk, 1.0) ** 0.6
        env *= np.exp(-np.maximum(tt - atk, 0.0) / (length * 0.45))
        env *= np.clip((length - tt) / max(0.2 * length, 1e-6), 0.0, 1.0)
    else:
        env = np.sin(np.pi * p) ** 1.8  # gentle raised-cosine window, no clicks
    out *= env
    m = float(np.abs(out).max())
    return out / m if m > 1e-9 else out


def _kick(length, f_hi, f_lo, amp, decay, pitch_t=0.09, attack=0.004):
    """Soft sub thump: sine with exponential pitch drop and click-free envelope."""
    n = int(length * SR)
    tt = np.arange(n) / SR
    freq = f_lo + (f_hi - f_lo) * np.exp(-tt / pitch_t)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    env = np.minimum(tt / attack, 1.0) * np.exp(-tt / decay)
    env *= np.clip((length - tt) / 0.08, 0.0, 1.0)  # seamless tail cap
    return np.sin(phase) * env * amp


def _bell(freq, length, amp, decay=0.7, attack=0.005,
          partials=((1.0, 1.0), (2.0, 0.38), (3.01, 0.16), (4.16, 0.06))):
    """Glassy bell/marimba tone: soft attack, per-partial decay, no clicks."""
    n = int(length * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, pa in partials:
        env = np.minimum(tt / attack, 1.0) * np.exp(-tt / (decay * ratio ** -0.6))
        out += np.sin(2 * np.pi * freq * ratio * tt) * env * pa
    out *= np.clip((length - tt) / 0.1, 0.0, 1.0)
    m = float(np.abs(out).max())
    return out / m * amp if m > 1e-9 else out


def _sweep(f0, f1, start, length, amp):
    """Pure sine glide (kept from the first pass — clean by construction)."""
    p = np.clip((T - start) / length, 0.0, 1.0)
    env = np.sin(np.pi * p) ** 1.2 * ((T >= start) & (T <= start + length))
    freq = f0 + (f1 - f0) * p
    phase = np.cumsum(freq) / SR * 2 * np.pi
    return np.sin(phase) * env * amp


def make_sfx(path):
    """Assemble the full 8 s sound design and write it as a 48 kHz stereo wav."""
    left = np.zeros(N)
    right = np.zeros(N)

    def add(at, sig, sig_r=None):
        _place(left, at, sig)
        _place(right, at, sig if sig_r is None else sig_r)

    # --- soft sine sweeps (original pitch glides, unchanged timings) --------
    for f0, f1, start, length, amp in ((55, 220, 0.0, 1.6, 0.26),
                                       (110, 440, 2.2, 0.7, 0.20),
                                       (220, 880, 5.0, 1.1, 0.18)):
        s = _sweep(f0, f1, start, length, amp)
        add(start, s, s * 0.96)

    # --- warm sine pad bed (pure tones only — no noise, no distortion) -----
    bed = ((55, 0.0, 0.038), (82.41, 0.16, 0.026), (110, -0.3, 0.026),
           (164.8, 0.26, 0.020), (220, -0.08, 0.014))
    for f, pan, amp in bed:
        tone = np.sin(2 * np.pi * f * T + 0.15 * np.sin(2 * np.pi * 0.13 * T))
        tone += 0.2 * np.sin(2 * np.pi * f * 2.01 * T + 0.7)
        left += tone * amp * (1 - max(0.0, pan))
        right += tone * amp * (1 + min(0.0, pan))

    # --- rhythm kicks: smooth thumps on the 0.36 s grid (bar accents) ------
    bars = (3.83, 5.27, 6.71)
    for beat in np.arange(2.75, 7.4, 0.36):
        on_bar = any(abs(beat - b) < 0.01 for b in bars)
        k = _kick(0.42, 92, 46, 0.085 * (1.3 if on_bar else 1.0),
                  decay=0.13, pitch_t=0.07)
        add(float(beat), k, k * 0.96)

    # --- airy band-limited whooshes (replace the old full-band hiss) -------
    for at, length, f0, f1, amp, seed in ((0.12, 1.22, 200, 5000, 0.155, 31),
                                          (1.45, 0.78, 300, 4500, 0.12, 47),
                                          (2.82, 0.72, 250, 4000, 0.10, 53),
                                          (4.92, 0.56, 400, 5500, 0.095, 59),
                                          (6.48, 0.88, 250, 4200, 0.145, 61)):
        add(at, _whoosh(length, f0, f1, seed) * amp,
            _whoosh(length, f0, f1, seed + 500) * amp * 0.95)

    # --- title glitch swishes, locked to the chromatic-aberration splits ---
    for at, length, f0, f1, amp, seed in ((0.18, 0.30, 1000, 6000, 0.12, 71),
                                          (1.25, 0.28, 900, 5500, 0.10, 73)):
        add(at, _whoosh(length, f0, f1, seed, front=True) * amp,
            _whoosh(length, f0, f1, seed + 500, front=True) * amp * 0.95)

    # --- scene-cut accent at 2.30 (flash frame) ---------------------------
    add(2.30, _whoosh(0.5, 500, 3600, 83, front=True) * 0.12,
        _whoosh(0.5, 500, 3600, 89, front=True) * 0.115)
    thump = _kick(0.7, 75, 36, 0.13, decay=0.28, pitch_t=0.12)
    add(2.30, thump, thump * 0.96)

    # --- logo pop at 5.20: warm sub impact + glass bell + sparkle ----------
    imp = _kick(1.2, 92, 40, 0.15, decay=0.42, pitch_t=0.14)
    add(5.20, imp, imp * 0.96)
    ring = _bell(880, 1.6, 0.05, decay=0.9)
    add(5.20, ring * 0.9, ring)
    for at, fq, amp in ((5.26, 1567.98, 0.022), (5.34, 2093.0, 0.017),
                        (5.44, 2637.02, 0.013)):
        s = _bell(fq, 1.0, amp, decay=0.5, attack=0.004)
        add(at, s, s * 0.85)

    # --- UI chimes / TAP TO ENTER ping / closing arpeggio ------------------
    for at, fq, amp, pan in ((1.45, 660.0, 0.050, -0.35),
                             (2.82, 880.0, 0.042, 0.35),
                             (4.95, 740.0, 0.040, -0.30),
                             (6.00, 659.25, 0.050, 0.00),
                             (6.62, 392.0, 0.060, -0.30),
                             (6.72, 523.25, 0.055, 0.00),
                             (6.84, 783.99, 0.050, 0.30)):
        s = _bell(fq, 1.5, amp, decay=0.8)
        add(at, s * (1 - max(0.0, pan)) ** 0.5, s * (1 + min(0.0, pan)) ** 0.5)

    # --- master: fade in/out with the picture, peak-normalise, no clipping -
    fin = np.clip(T / 0.012, 0.0, 1.0)
    fout = np.clip((DURATION - T) / 0.32, 0.0, 1.0)
    fout = fout * fout * (3 - 2 * fout)
    left *= fin * fout
    right *= fin * fout
    peak = max(float(np.abs(left).max()), float(np.abs(right).max()))
    if peak > 0.0:
        left *= 0.72 / peak
        right *= 0.72 / peak
    stereo = np.stack((left, right), axis=1)
    rms = float(np.sqrt(np.mean(stereo ** 2)))
    print(f"sfx: peak={np.abs(stereo).max():.3f} rms={rms:.4f} "
          f"crest={np.abs(stereo).max() / max(rms, 1e-9):.1f}x")
    pcm = np.int16(np.clip(stereo, -1.0, 1.0) * 32767)
    with _w.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(pcm.tobytes())


if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "_sfx_preview.wav"
    make_sfx(out)

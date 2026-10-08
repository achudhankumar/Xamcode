"""Add a picture-locked background music bed to assets/xamcode-ai-intro.mp4.

Strategy: keep the existing sound-design track untouched (it already accents the
scene cuts), layer a composed BGM on top of it, and remux with the video stream
copied so picture/audio sync stays bit-exact.

Sync grid: the existing kicks run every 0.36 s (166.7 BPM). Anchoring beats at
t = 0.23 + 0.36k puts bar downbeats at 0.95 / 2.39 / 3.83 / 5.27 / 6.71, which
lands on the picture:

    2.30  scene B (PDF -> cards) crossfade  -> downbeat 2.39 (+ kick at 2.39)
    5.20  logo pop                          -> impact boom AT 5.20 (on picture),
                                               music drops in at downbeat 5.27
    6.00  TAP TO ENTER chip                 -> beat 5.99 (+ melody note C5)
    7.68  picture fades                     -> music fade-out 7.68 -> 8.00

Run: python intro_bgm.py   (reruns are safe; SFX source always comes from the
backup xamcode-ai-intro-sfx-only.mp4 so BGM never stacks).
"""
from __future__ import annotations

import os
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
VIDEO = ROOT / "assets" / "xamcode-ai-intro.mp4"
BACKUP = ROOT / "assets" / "xamcode-ai-intro-sfx-only.mp4"
SR = 48000
DURATION = 8.0
N = int(SR * DURATION)
T = np.arange(N, dtype=np.float64) / SR

# 166.7 BPM grid anchored to the existing kick pattern.
BEAT = 0.36
GRID0 = 0.23
BARS = (0.95, 2.39, 3.83, 5.27, 6.71)  # 4 beats per bar


def beat(k: float) -> float:
    return GRID0 + BEAT * k


def place(dst: np.ndarray, at: float, sig: np.ndarray) -> None:
    i = int(round(at * SR))
    if i >= N:
        return
    seg = sig[: max(0, N - i)]
    dst[i:i + len(seg)] += seg


def stereo_place(left: np.ndarray, right: np.ndarray, at: float,
                 sig: np.ndarray, pan: float = 0.0) -> None:
    l = sig * (1.0 - max(0.0, pan)) ** 0.5
    r = sig * (1.0 + min(0.0, pan)) ** 0.5
    place(left, at, l)
    place(right, at, r)


def env_ad(n: int, attack: float, decay: float) -> np.ndarray:
    tt = np.arange(n) / SR
    a = np.clip(tt / max(attack, 1e-6), 0, 1)
    return a * np.exp(-np.maximum(0.0, tt - attack) / decay)



def pluck(freq: float, dur: float, amp: float, decay: float,
          attack: float = 0.006, harm: tuple = (1.0, 0.32, 0.1)) -> np.ndarray:
    n = int(dur * SR)
    tt = np.arange(n) / SR
    sig = np.zeros(n)
    for i, h in enumerate(harm):
        sig += np.sin(2 * np.pi * freq * h * tt) / (i + 1) ** 0.6
    return sig * env_ad(n, attack, decay) * amp


def pad_chord(dst_l: np.ndarray, dst_r: np.ndarray, at: float, end: float,
              freqs: tuple, amp: float, fade: float = 0.2) -> None:
    n = int((end - at) * SR)
    if n <= 0:
        return
    tt = np.arange(n) / SR
    ramp = np.minimum(1.0, tt / fade) * np.minimum(1.0, (end - at - tt) / fade)
    ramp = np.clip(ramp, 0, 1)
    for i, f in enumerate(freqs):
        pan = 0.0 if i == 0 else (0.45 if i % 2 else -0.45)
        det = 1.0 + 0.0025 * (1 if i % 2 else -1)
        l = np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * det * tt)
        r = np.sin(2 * np.pi * f * det * tt) + 0.5 * np.sin(2 * np.pi * f * tt)
        shimmer = 1.0 + 0.12 * np.sin(2 * np.pi * (0.6 + 0.13 * i) * tt + i)
        layer = ramp * shimmer * amp / max(2.0, len(freqs) ** 0.8)
        stereo_place(dst_l, dst_r, at, l * layer, pan)
        i0 = int(round(at * SR))
        if i0 >= N:
            return
        seg = r * layer
        m = min(len(seg), N - i0)
        dst_r[i0:i0 + m] += seg[:m]


def kick_sig(amp: float) -> np.ndarray:
    n = int(0.32 * SR)
    tt = np.arange(n) / SR
    p = np.clip(tt / 0.32, 0, 1)
    f = 78.0 - 24.0 * p
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.11)
    return sig * amp


def noise_hit(dur: float, amp: float, decay: float, bright: bool = True) -> np.ndarray:
    n = int(dur * SR)
    rng = np.random.default_rng(1234)
    nz = rng.normal(0, 1, n)
    if not bright:  # smooth into airy noise like the original sweeps
        nz = np.convolve(nz, np.ones(40) / 40, mode="same")
    else:  # emphasize highs by differentiating
        nz = np.diff(nz, prepend=0.0)
    tt = np.arange(n) / SR
    return nz * np.exp(-tt / decay) * amp


def clap(amp: float) -> np.ndarray:
    return noise_hit(0.16, amp, 0.045, bright=True)


def riser(t0: float, t1: float, amp_n: float, amp_f: float,
          f0: float, f1: float) -> tuple[np.ndarray, np.ndarray]:
    n = int((t1 - t0) * SR)
    p = np.linspace(0.0, 1.0, n)
    rng = np.random.default_rng(99)
    nz = rng.normal(0, 1, n)
    nz = np.convolve(nz, np.ones(18) / 18, mode="same")
    noise = nz * (p ** 2) * amp_n
    f = f0 + (f1 - f0) * p
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (p ** 1.5) * amp_f
    return noise, tone


def melody_note(freq: float, dur: float, amp: float) -> np.ndarray:
    n = int(dur * SR)
    tt = np.arange(n) / SR
    vib = 1.0 + 0.006 * np.sin(2 * np.pi * 5.2 * tt) * np.clip((tt - 0.15) / 0.2, 0, 1)
    f = freq * vib
    ph = np.cumsum(f) / SR
    sig = (np.sin(2 * np.pi * ph) + 0.28 * np.sin(4 * np.pi * ph)
           + 0.1 * np.sin(6 * np.pi * ph))
    env = np.clip(tt / 0.02, 0, 1) * np.exp(-np.maximum(0.0, tt - dur * 0.7) / 0.25)
    return sig * env * amp


def build_bgm() -> tuple[np.ndarray, np.ndarray]:
    left = np.zeros(N)
    right = np.zeros(N)

    # ---- Section A (0.0 - 2.44): tense Am pad + sparse plucks (STUDY CHAOS)
    pad_chord(left, right, 0.0, 2.44, (110.0, 164.81, 246.94, 261.63), amp=0.16, fade=0.5)
    for at, f in ((beat(0), 220.0), (beat(1), 261.63), (beat(3), 246.94),
                  (beat(4), 261.63), (beat(5), 329.63)):
        stereo_place(left, right, at, pluck(f, 0.4, 0.05, 0.16), pan=-0.15)
    for k in (3, 4, 5):  # light offbeat ticks hinting the pulse
        stereo_place(left, right, beat(k) + 0.18,
                     noise_hit(0.05, 0.02, 0.012), pan=0.3)

    # riser into the scene-B downbeat (2.39)
    n_r, tone_r = riser(2.03, 2.39, 0.05, 0.04, 300, 820)
    place(left, 2.03, n_r * 0.9)
    place(right, 2.03, n_r)
    place(left, 2.03, tone_r * 0.95)
    place(right, 2.03, tone_r)

    # ---- Section B (2.39 - 5.27): driving pulse (PDF -> CARDS crossfade at 2.30)
    k = kick_sig(0.11)
    place(left, 2.39, k)
    place(right, 2.39, k * 0.9)  # downbeat kick (existing SFX kicks start 2.75)
    pad_chord(left, right, 2.39, 3.87, (87.31, 220.0, 261.63, 349.23), amp=0.15)
    pad_chord(left, right, 3.83, 5.31, (130.81, 196.0, 261.63, 329.63), amp=0.15)
    for at, f in ((2.39, 87.31), (3.11, 87.31), (3.83, 65.41), (4.55, 65.41)):
        stereo_place(left, right, at,
                     pluck(f, 0.5, 0.11, 0.18, attack=0.008, harm=(1.0, 0.4, 0.08)))
    b, i = 2.57, 0  # offbeat hats
    while b < 5.15:
        stereo_place(left, right, b, noise_hit(0.05, 0.03, 0.011),
                     pan=0.35 if i % 2 else -0.35)
        b += BEAT
        i += 1
    for at in (2.75, 3.47, 4.19, 4.91):  # claps on beats 2 & 4
        stereo_place(left, right, at, clap(0.05))
    arp_a = (174.61, 220.0, 261.63, 349.23, 261.63, 220.0)   # F major bar
    arp_c = (261.63, 329.63, 392.0, 523.25, 392.0, 329.63)   # C major bar
    for step in range(8):
        stereo_place(left, right, 2.39 + step * 0.18,
                     pluck(arp_a[step % len(arp_a)], 0.3, 0.04, 0.1),
                     pan=0.25 if step % 2 else -0.25)
    for step in range(8):
        stereo_place(left, right, 3.83 + step * 0.18,
                     pluck(arp_c[step % len(arp_c)], 0.3, 0.04, 0.1),
                     pan=0.25 if step % 2 else -0.25)

    # riser 4.91 -> 5.20 landing exactly on the logo cut
    n_r2, tone_r2 = riser(4.91, 5.20, 0.07, 0.055, 350, 1300)
    place(left, 4.91, n_r2 * 0.9)
    place(right, 4.91, n_r2)
    place(left, 4.91, tone_r2 * 0.95)
    place(right, 4.91, tone_r2)

    # ---- Impact AT 5.20 (on picture): sub boom + click + shimmer
    n_i = int(0.65 * SR)
    tt = np.arange(n_i) / SR
    f_sub = 95.0 * (42.0 / 95.0) ** (tt / 0.65)
    sub = np.sin(2 * np.pi * np.cumsum(f_sub) / SR) * np.exp(-tt / 0.17) * 0.16
    place(left, 5.20, sub)
    place(right, 5.20, sub * 0.96)
    click = noise_hit(0.09, 0.05, 0.014)
    place(left, 5.20, click * 0.9)
    place(right, 5.20, click)
    n_s = int(0.45 * SR)
    ts = np.arange(n_s) / SR
    shim = (np.sin(2 * np.pi * 659.25 * ts) + 0.8 * np.sin(2 * np.pi * 783.99 * ts)
            + 0.6 * np.sin(2 * np.pi * 1046.5 * ts)) * np.sin(np.pi * ts / 0.45) ** 1.3
    place(left, 5.20, shim * 0.03)
    place(right, 5.20, shim * 0.032)

    # ---- Section C (5.27 - 8.0): brand theme (LOGO / TITLE / TAP TO ENTER)
    pad_chord(left, right, 5.27, 6.75, (261.63, 329.63, 392.0, 523.25), amp=0.15)
    pad_chord(left, right, 6.71, 7.47, (196.0, 246.94, 293.66, 392.0), amp=0.14)
    pad_chord(left, right, 7.43, 8.0, (220.0, 261.63, 329.63, 440.0), amp=0.14, fade=0.14)
    for at, f in ((5.27, 65.41), (5.99, 65.41), (6.71, 98.0), (7.43, 110.0)):
        stereo_place(left, right, at,
                     pluck(f, 0.6, 0.10, 0.2, attack=0.008, harm=(1.0, 0.4, 0.08)))
    b, i = 5.45, 0  # sparse offbeat hats keep the pulse under the logo
    while b < 7.7:
        stereo_place(left, right, b, noise_hit(0.05, 0.024, 0.011),
                     pan=0.35 if i % 2 else -0.35)
        b += BEAT
        i += 1
    for at in (5.63, 6.35, 7.07):
        stereo_place(left, right, at, clap(0.045))
    # hero melody: E5 - D5 - C5 (lands on TAP TO ENTER) - D5 - E5 - A4 resolve
    melody = ((5.27, 659.25, 0.36), (5.63, 587.33, 0.36), (5.99, 523.25, 0.72),
              (6.71, 587.33, 0.36), (7.07, 659.25, 0.36), (7.43, 440.0, 0.55))
    for at, f, dur in melody:
        sig = melody_note(f, dur + 0.3, 0.085)
        place(left, at, sig)
        place(right, at + 0.006, sig * 0.85)  # haas widening

    stereo_place(left, right, 2.39, pluck(440.0, 0.35, 0.05, 0.12))  # transition accent

    # global music fades: in with the picture, out with the picture (7.68 -> 8.0)
    fade = np.clip(T / 0.12, 0, 1) * np.clip((DURATION - T) / 0.32, 0, 1)
    return left * fade, right * fade


def read_wav(path: Path) -> tuple[np.ndarray, np.ndarray]:
    with wave.open(str(path), "rb") as w:
        sr = w.getframerate()
        assert sr == SR, f"unexpected sample rate {sr}"
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    l = data[0::2].astype(np.float64) / 32767.0
    r = data[1::2].astype(np.float64) / 32767.0
    assert len(l) == N and len(r) == N, f"unexpected length {len(l)}"
    return l, r


def write_wav(path: Path, left: np.ndarray, right: np.ndarray) -> None:
    stereo = np.stack((left, right), axis=1)
    pcm = np.int16(np.clip(stereo, -1.0, 1.0) * 32767)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


SFX_GAIN = 1.35  # ~+2.7 dB lift so the sound design sits clearly above the BGM


def duck_gain(sfx_l: np.ndarray, sfx_r: np.ndarray, depth: float = 0.45) -> np.ndarray:
    """Sidechain-style duck envelope for the BGM, driven by the SFX signal.

    Loud SFX events (swipes, impacts, logo boom) pull the music down by up to
    ``depth`` (~-5.2 dB) while quieter passages leave it almost untouched, so
    the original sound design stays clearly audible on top of the bed.
    """
    amp = np.maximum(np.abs(sfx_l), np.abs(sfx_r))
    hop = int(0.01 * SR)  # 10 ms blocks keep the envelope cheap to build
    blocks = len(amp) // hop
    env = amp[:blocks * hop].reshape(blocks, hop).max(axis=1)
    kern = np.hanning(17)  # ~170 ms smoothing: follows whooshes/impacts
    env = np.convolve(env, kern / kern.sum(), mode="same")
    ref = np.percentile(env, 95)
    env = np.clip(env / max(float(ref), 1e-9), 0.0, 1.0)
    env = np.repeat(env, hop)
    env = np.concatenate([env, np.zeros(len(amp))])[:len(amp)]
    return 1.0 - depth * env


def main() -> None:
    if not VIDEO.exists():
        raise SystemExit(f"missing {VIDEO}")
    work = ROOT / "_bgm_work"
    work.mkdir(exist_ok=True)
    try:
        # Always take the pure SFX source from the backup so reruns never stack BGM.
        if not BACKUP.exists():
            shutil.copy2(VIDEO, BACKUP)
            print("backed up original ->", BACKUP.name)
        sfx = work / "sfx.wav"
        run(["ffmpeg", "-y", "-v", "error", "-i", str(BACKUP), "-vn",
             "-ac", "2", "-ar", str(SR), "-acodec", "pcm_s16le", str(sfx)])
        sfx_l, sfx_r = read_wav(sfx)
        # Lift the SFX ~+2.7 dB, then duck the BGM under loud SFX events so
        # the original sound design stays clearly audible over the music.
        sfx_l = sfx_l * SFX_GAIN
        sfx_r = sfx_r * SFX_GAIN
        bgm_l, bgm_r = build_bgm()
        dg = duck_gain(sfx_l, sfx_r)
        bgm_l = bgm_l * dg
        bgm_r = bgm_r * dg

        mix_l = sfx_l + bgm_l
        mix_r = sfx_r + bgm_r
        peak = max(np.abs(mix_l).max(), np.abs(mix_r).max())
        target = 0.84  # ~-1.5 dBFS headroom for AAC encode overshoot
        if peak > target:
            g = target / peak
            mix_l *= g
            mix_r *= g
            print(f"scaled mix by {g:.3f} (pre-scale peak {peak:.3f})")
        mix = work / "mix.wav"
        write_wav(mix, mix_l, mix_r)
        print(f"mix: peak={max(np.abs(mix_l).max(), np.abs(mix_r).max()):.3f} "
              f"rms={np.sqrt(((mix_l ** 2 + mix_r ** 2) / 2).mean()):.4f}")

        out = work / "out.mp4"
        run(["ffmpeg", "-y", "-v", "error", "-i", str(VIDEO), "-i", str(mix),
             "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
             "-c:a", "aac", "-b:a", "192k", "-ar", str(SR), "-t", str(DURATION),
             "-movflags", "+faststart", str(out)])
        os.replace(out, VIDEO)
        print("wrote", VIDEO)
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()


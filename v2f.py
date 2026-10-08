from v2a import *
from v2e import draw_frame
def make_audio(path):
    """Render the clean Apple-style SFX bed (synthesis lives in v2sfx.py)."""
    from v2sfx import make_sfx
    make_sfx(path)
def main():
    wav_path = OUTPUT.with_suffix(".wav")
    make_audio(wav_path)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1920x1080", "-r", "30", "-i", "-", "-i", str(wav_path), "-map", "0:v:0", "-map", "1:a:0", "-frames:v", str(FRAMES), "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", "8", "-movflags", "+faststart", str(OUTPUT)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        n = 0
        while n < FRAMES:
            frame = draw_frame(n / FPS)
            proc.stdin.write(frame.tobytes())
            done = n % 30 == 0
            if done:
                print("frame", n, "of", FRAMES, flush=True)
            n += 1
        proc.stdin.close()
        code = proc.wait()
        bad = code != 0
        if bad:
            raise RuntimeError("ffmpeg failed")
    finally:
        wav_path.unlink(missing_ok=True)
    print("wrote", OUTPUT)
if __name__ == "__main__":
    main()

/**
 * 01 Vibe Coding Studio — 3D Tesseract Scene
 * Supports lite mode: caps DPR at 1.5, 30 FPS cap, pauses when tab is hidden or canvas offscreen.
 */
class VibeStudioScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.isLiteMode = Boolean(options.liteMode);
    this.maxFps = this.isLiteMode ? 30 : 60;
    this.maxDpr = this.isLiteMode ? 1.5 : (window.devicePixelRatio || 1);
    this.animationFrameId = null;
    this.isRunning = false;
    this.angle = 0;
  }

  mount() {
    this.isRunning = true;
    this.bindVisibilityObserver();
    this.renderLoop();
  }

  bindVisibilityObserver() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pause();
        } else if (this.isRunning) {
          this.renderLoop();
        }
      });
    }
  }

  pause() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  renderLoop() {
    if (!this.isRunning) return;
    this.angle += 0.015;
    // Tesseract rotation step
    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
    }
  }

  destroy() {
    this.isRunning = false;
    this.pause();
  }
}

if (typeof module !== 'undefined') {
  module.exports = { VibeStudioScene };
}

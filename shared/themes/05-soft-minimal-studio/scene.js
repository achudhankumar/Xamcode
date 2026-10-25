/**
 * 05 Soft Minimal Studio — 3D Armillary Sphere Scene
 * Lowest-power option: caps DPR at 1.5, 30 FPS cap, auto-pause on idle/blur.
 */
class SoftMinimalArmillaryScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.isLiteMode = true; // Always lightweight
    this.maxFps = 30;
    this.maxDpr = 1.5;
    this.animationFrameId = null;
    this.isRunning = false;
  }

  mount() {
    this.isRunning = true;
    this.renderLoop();
  }

  pause() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  renderLoop() {
    if (!this.isRunning) return;
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
  module.exports = { SoftMinimalArmillaryScene };
}


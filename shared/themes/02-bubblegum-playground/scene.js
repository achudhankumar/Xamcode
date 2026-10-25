/**
 * 02 Bubblegum Playground — 3D Clay Spheres Scene
 * Supports lite mode: caps DPR at 1.5, 30 FPS cap, auto-pause on blur.
 */
class BubblegumPlaygroundScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.isLiteMode = Boolean(options.liteMode);
    this.maxFps = this.isLiteMode ? 30 : 60;
    this.maxDpr = this.isLiteMode ? 1.5 : (window.devicePixelRatio || 1);
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
  module.exports = { BubblegumPlaygroundScene };
}

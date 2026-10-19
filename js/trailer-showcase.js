/* ============================================================
   XAMCODE AI — CINEMATIC TRAILER CONTROLLER
   Manages the 25-second product trailer showcase:
   - HTML5 responsive video player with metadata preload
   - Mute / Unmute audio toggle with state sync
   - Synchronized chapter navigation with real scene timecodes
   - IntersectionObserver viewport power efficiency
   - prefers-reduced-motion compliance
   - Real existing app actions (upload, workspace, aura, build)
   ============================================================ */

(function() {
  'use strict';

  window.XC = window.XC || {};

  // Verified real scene timestamps from 25.0s master MP4
  const CHAPTERS = [
    { id: 'ch-01', label: 'Universal Hook', time: 0.0, timecode: '0:00', badge: 'Any Subject', theme: 'cosmic' },
    { id: 'ch-02', label: 'PDF Deconstruction', time: 5.0, timecode: '0:05', badge: '3D Layers', theme: 'digital' },
    { id: 'ch-03', label: 'Robotics & Kinematics', time: 8.4, timecode: '0:08', badge: '5-Axis CAD', theme: 'digital' },
    { id: 'ch-04', label: 'Quantum Science', time: 11.8, timecode: '0:11', badge: 'Wavepacket', theme: 'cosmic' },
    { id: 'ch-05', label: 'Cardiac Medicine', time: 15.2, timecode: '0:15', badge: 'Purkinje ECG', theme: 'bubblegum' },
    { id: 'ch-06', label: 'Finance & Markets', time: 18.6, timecode: '0:18', badge: 'Markowitz 3D', theme: 'organic' },
    { id: 'ch-07', label: 'AURA Socratic Tutor', time: 20.0, timecode: '0:20', badge: '94% Mastery', theme: 'organic' },
    { id: 'ch-08', label: 'XamCode Finale', time: 22.0, timecode: '0:22', badge: 'Build in Public', theme: 'bubblegum' }
  ];

  let currentActiveIndex = 0;
  let isUserPaused = false;
  let observer = null;

  function renderMarkup() {
    const chaptersHtml = CHAPTERS.map((ch, idx) => `
      <button type="button" class="cine-chapter-btn" data-chapter-index="${idx}" data-time="${ch.time}" aria-label="Jump to chapter: ${ch.label} at ${ch.timecode}" ${idx === 0 ? 'aria-current="true"' : 'aria-current="false"'}>
        <div class="cine-ch-meta">
          <span>0${idx + 1}</span>
          <span>${ch.timecode}</span>
        </div>
        <div class="cine-ch-title">${ch.label}</div>
      </button>
    `).join('');

    return `
    <section class="cinematic-showcase-section" id="trailerSection" aria-labelledby="trailerShowcaseTitle">
      <div class="cine-theater">
        <!-- Section Header -->
        <div class="cine-header">
          <div class="cine-header-left">
            <div class="cine-kicker">
              <span class="cine-kicker-dot" aria-hidden="true"></span>
              <span>Official Product Trailer · 0:25</span>
            </div>
            <h2 class="cine-title" id="trailerShowcaseTitle">
              ANY SUBJECT. ANY PDF.<br>
              <em>ONE INTELLIGENT LEARNING SPACE.</em>
            </h2>
            <p class="cine-sub">
              Watch how XamCode AI transforms raw textbooks into 3D articulated mechanics, wavepacket quantum orbitals, cardiac electrophysiology, and Socratic dialogues.
            </p>
          </div>
          <div class="cine-header-pills">
            <span class="cine-badge-pill">1080P · 30 FPS</span>
            <span class="cine-badge-pill">150 BPM SCORE</span>
            <span class="cine-badge-pill">4 REAL THEMES</span>
          </div>
        </div>

        <!-- 16:9 Video Player Presentation -->
        <div class="cine-player-wrapper" id="cinePlayerWrapper" data-state="playing">
          <video
            id="trailerShowcaseVideo"
            class="cine-video"
            autoplay
            muted
            loop
            playsinline
            preload="metadata"
            poster="/assets/xamcode-build-trailer-poster.jpg"
            aria-label="XamCode AI Universal Learning Launch Trailer"
          >
            <source src="/assets/xamcode-build-trailer.mp4" type="video/mp4">
            Your browser does not support HTML5 video.
          </video>

          <!-- Top-Right Player Controls HUD -->
          <div class="cine-player-hud">
            <button type="button" class="cine-audio-btn" id="cineAudioBtn" aria-label="Unmute trailer audio" aria-pressed="false">
              <span class="cine-audio-icon" aria-hidden="true" id="cineAudioIcon">🔇</span>
              <span id="cineAudioLabel">Muted</span>
            </button>
            <button type="button" class="cine-play-pause-btn" id="cinePlayPauseBtn" aria-label="Pause trailer">
              <span aria-hidden="true" id="cinePlayPauseIcon">❚❚</span>
            </button>
          </div>

          <!-- Paused Center Play Trigger -->
          <div class="cine-fallback-overlay" id="cineFallbackOverlay">
            <button type="button" class="cine-center-play" id="cineCenterPlayBtn" aria-label="Resume playing trailer">
              <span aria-hidden="true">▶</span>
            </button>
          </div>
        </div>

        <!-- Accessible Chapter Navigation Track -->
        <div class="cine-chapters-container">
          <div class="cine-chapters-heading">
            <span>✦ Interactive Chapters</span>
            <span id="cineCurrentTimecode">0:00 / 0:25</span>
          </div>
          <div class="cine-chapters-track" id="cineChaptersTrack" role="navigation" aria-label="Trailer chapters">
            ${chaptersHtml}
          </div>
        </div>

        <!-- Multi-Disciplinary Department Highlights -->
        <div class="cine-grid-highlights">
          <div class="cine-highlight-card card-bubblegum">
            <span class="ch-badge">🧬 MEDICINE &amp; HEALTH</span>
            <h4>Cardiology &amp; Genomics</h4>
            <p>Anatomical ventricular models, Purkinje conduction wave pulses, and synchronized Phase 2 action potential curves.</p>
          </div>
          <div class="cine-highlight-card card-digital">
            <span class="ch-badge">⚙️ ENGINEERING &amp; TECH</span>
            <h4>Robotics &amp; Kinematics</h4>
            <p>Articulated 5-axis mechanical hand with 15-DOF joints, exploded CAD assembly views, and real-time telemetry.</p>
          </div>
          <div class="cine-highlight-card card-cosmic">
            <span class="ch-badge">⚛️ SCIENCE &amp; QUANTUM</span>
            <h4>Wavepackets &amp; Orbitals</h4>
            <p>Dynamic wave interference surfaces resolving into 3D atomic orbital probability density dumbbell lobes (ĤΨ = EΨ).</p>
          </div>
          <div class="cine-highlight-card card-organic">
            <span class="ch-badge">📈 FINANCE &amp; MARKETS</span>
            <h4>Portfolio Volatility</h4>
            <p>Continuous 3D Markowitz risk-return manifolds, Capital Allocation Lines, and optimal Sharpe ratio tangency beacons.</p>
          </div>
        </div>

        <!-- AURA Socratic Tutor Feature Strip -->
        <div class="cine-aura-highlight">
          <div class="cine-aura-info">
            <div class="cine-aura-avatar" aria-hidden="true">A</div>
            <div class="cine-aura-text">
              <h4>AURA Socratic Co-Pilot &amp; Vaathiyar Assessments</h4>
              <p>Grounded pedagogical dialogue that challenges your reasoning instead of merely reciting answers.</p>
            </div>
          </div>
          <div class="cine-aura-badge">
            <span>✓ 94% CONCEPT MASTERY SURGE</span>
          </div>
        </div>

        <!-- Actions Bar (Real valid existing application routes) -->
        <div class="cine-actions-bar">
          <div class="cine-actions-left">
            <button type="button" class="cine-btn-primary" data-open="upload">
              <span>Create AI Study Space</span>
              <span aria-hidden="true">↗</span>
            </button>
            <button type="button" class="cine-btn-secondary" data-nav="workspace">
              <span>Explore Sample Course</span>
            </button>
            <button type="button" class="cine-btn-secondary" data-auth-aura>
              <span>Consult AURA Tutor</span>
            </button>
          </div>
          <div>
            <a href="/build" class="cine-link-bip">
              <span>Follow Build-in-Public Journey</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
    `;
  }

  function init() {
    const video = document.getElementById('trailerShowcaseVideo');
    if (!video) return;

    const wrapper = document.getElementById('cinePlayerWrapper');
    const audioBtn = document.getElementById('cineAudioBtn');
    const audioIcon = document.getElementById('cineAudioIcon');
    const audioLabel = document.getElementById('cineAudioLabel');
    const playPauseBtn = document.getElementById('cinePlayPauseBtn');
    const playPauseIcon = document.getElementById('cinePlayPauseIcon');
    const centerPlayBtn = document.getElementById('cineCenterPlayBtn');
    const timecodeDisplay = document.getElementById('cineCurrentTimecode');
    const chapterButtons = document.querySelectorAll('.cine-chapter-btn');

    // Sync audio button display
    function syncAudio() {
      if (!audioBtn) return;
      const isMuted = video.muted;
      audioBtn.setAttribute('aria-pressed', isMuted ? 'false' : 'true');
      audioBtn.setAttribute('aria-label', isMuted ? 'Unmute trailer audio' : 'Mute trailer audio');
      if (audioIcon) audioIcon.textContent = isMuted ? '🔇' : '🔊';
      if (audioLabel) audioLabel.textContent = isMuted ? 'Muted' : 'Sound On';
    }

    // Sync play/pause state
    function syncPlayback() {
      const paused = video.paused || video.ended;
      if (wrapper) wrapper.setAttribute('data-state', paused ? 'paused' : 'playing');
      if (playPauseIcon) playPauseIcon.textContent = paused ? '▶' : '❚❚';
      if (playPauseBtn) playPauseBtn.setAttribute('aria-label', paused ? 'Play trailer' : 'Pause trailer');
    }

    // Format seconds into m:ss
    function formatTime(s) {
      const mins = Math.floor(s / 60);
      const secs = Math.floor(s % 60);
      return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    // Set active chapter
    function setActiveChapter(newIdx) {
      if (newIdx === currentActiveIndex) return;
      currentActiveIndex = newIdx;
      chapterButtons.forEach((btn, idx) => {
        const isActive = (idx === newIdx);
        btn.setAttribute('aria-current', isActive ? 'true' : 'false');
        if (isActive) {
          const track = document.getElementById('cineChaptersTrack');
          if (track) {
            const left = btn.offsetLeft - (track.clientWidth / 2) + (btn.clientWidth / 2);
            track.scrollTo({ left, behavior: 'smooth' });
          }
        }
      });
    }

    // Audio button click
    if (audioBtn) {
      audioBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        video.muted = !video.muted;
        if (!video.muted && video.paused) {
          const playPromise = video.play();
          if (playPromise && playPromise.catch) {
            playPromise.catch(function() {});
          }
        }
        syncAudio();
      });
    }

    // Play/Pause button click
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (video.paused) {
          isUserPaused = false;
          video.play().catch(function() {});
        } else {
          isUserPaused = true;
          video.pause();
        }
        syncPlayback();
      });
    }

    // Center play overlay click
    if (centerPlayBtn) {
      centerPlayBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        isUserPaused = false;
        video.play().catch(function() {});
        syncPlayback();
      });
    }

    // Chapter buttons seek
    chapterButtons.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const targetTime = parseFloat(btn.dataset.time);
        const targetIdx = parseInt(btn.dataset.chapterIndex, 10);
        if (!isNaN(targetTime)) {
          video.currentTime = targetTime;
          setActiveChapter(targetIdx);
          if (video.paused) {
            isUserPaused = false;
            video.play().catch(function() {});
          }
        }
      });
    });

    // Throttled timeupdate for chapter tracking
    let lastTimeUpdate = 0;
    video.addEventListener('timeupdate', function() {
      const now = Date.now();
      if (now - lastTimeUpdate < 150) return;
      lastTimeUpdate = now;

      const ct = video.currentTime;
      if (timecodeDisplay) {
        timecodeDisplay.textContent = formatTime(ct) + ' / 0:25';
      }

      // Determine active chapter based on currentTime
      let matchIdx = 0;
      for (let i = CHAPTERS.length - 1; i >= 0; i--) {
        if (ct >= CHAPTERS[i].time - 0.15) {
          matchIdx = i;
          break;
        }
      }
      setActiveChapter(matchIdx);
    });

    video.addEventListener('play', syncPlayback);
    video.addEventListener('pause', syncPlayback);
    video.addEventListener('ended', syncPlayback);
    video.addEventListener('seeked', syncPlayback);

    // Error handling
    video.addEventListener('error', function() {
      if (wrapper) wrapper.setAttribute('data-state', 'paused');
    });

    // IntersectionObserver to pause playback when out of viewport
    try {
      if (observer) observer.disconnect();
      observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            if (!video.paused) video.pause();
          } else {
            if (!isUserPaused && video.paused) {
              video.play().catch(function() {});
            }
          }
        });
      }, { threshold: 0.15 });
      observer.observe(video);
    } catch (e) {}

    // Respect prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      isUserPaused = true;
      syncPlayback();
    }

    // Initial sync
    syncAudio();
    syncPlayback();
  }

  window.XC.trailerShowcase = {
    CHAPTERS,
    renderMarkup,
    init
  };

  // Auto-init on DOMContentLoaded if element is already present
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

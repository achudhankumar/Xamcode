/* ============================================================
   AURA diagram engine — lazy browser loader for the text→SVG
   generator from aura-visuals (parse + layout + React renderer).
   ------------------------------------------------------------
   XC.auraDiagram.render(text, opts) → Promise<{svg,width,height,kind,title}>
   The bundle (aura-visuals/browser/aura-diagram.js, built with
   "npm run build:browser" inside aura-visuals) is fetched on the
   FIRST render only, so page load never pays for it. Theme follows
   the site's body[data-mode] so diagrams match light/dark pages.
   ============================================================ */
(function(){
  'use strict';

  window.XC = window.XC || {};

  const BUNDLE_URL = '/aura-visuals/browser/aura-diagram.js';
  let loading = null;

  function engine(){
    const m = window.AuraDiagram;
    return m && typeof m.renderDiagram === 'function' ? m : null;
  }

  function ensureLoaded(){
    const ready = engine();
    if(ready) return Promise.resolve(ready);
    if(loading) return loading;
    loading = new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = BUNDLE_URL;
      s.async = true;
      s.onload = ()=>{
        const m = engine();
        if(m){ resolve(m); }
        else{ loading = null; reject(new Error('diagram bundle loaded without renderDiagram')); }
      };
      s.onerror = ()=>{
        loading = null;
        reject(new Error('diagram bundle could not be loaded'));
      };
      (document.head || document.body).appendChild(s);
    });
    return loading;
  }

  /* Follow the site's light/dark mode so the picture matches the page. */
  function currentTheme(){
    try{
      return document.body && document.body.getAttribute('data-mode') === 'light' ? 'light' : 'dark';
    }catch(error){ return 'dark'; }
  }

  function render(text, opts){
    const theme = (opts && opts.theme) || currentTheme();
    return ensureLoaded().then(m=>{
      const res = m.renderDiagram(String(text == null ? '' : text), { theme });
      if(!res || typeof res.svg !== 'string' || !res.svg) throw new Error('no diagram for this text');
      return res;
    });
  }

  window.XC.auraDiagram = {
    render,
    ensureLoaded,
    currentTheme,
    get loaded(){ return !!engine(); }
  };
})();
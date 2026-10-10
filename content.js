// Runs inside every tv.youtube.com frame, but only does anything when that
// frame is a tile embedded directly in the TileTV extension page.
(() => {
  const EXT_ORIGIN = chrome.runtime.getURL('').replace(/\/$/, '');
  const ancestors = location.ancestorOrigins;
  if (window === window.top || !ancestors || ancestors[0] !== EXT_ORIGIN) return;

  let muted = true;

  const style = document.createElement('style');
  // Clean view: hide every element, then un-hide just the <video>. A child can be
  // visible inside a visibility:hidden parent, so this works regardless of how
  // YouTube TV nests or layers its overlays. Hidden elements also stop receiving
  // hover/clicks, so the controls can't pop up.
  style.textContent = `
    html.mv-clean, html.mv-clean body { background: #000 !important; overflow: hidden !important; }
    html.mv-clean body * { visibility: hidden !important; }
    html.mv-clean video {
      visibility: visible !important;
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      object-fit: contain !important;
      background: #000 !important;
      pointer-events: none !important;
    }
  `;
  document.documentElement.appendChild(style);

  // YouTube TV resets mute state when switching channels or ads, so keep enforcing it.
  function applyAudio() {
    for (const v of document.querySelectorAll('video')) {
      if (v.muted !== muted) v.muted = muted;
      if (!muted && v.volume === 0) v.volume = 1;
    }
  }
  for (const type of ['play', 'playing', 'loadedmetadata', 'volumechange']) {
    document.addEventListener(type, applyAudio, true);
  }
  setInterval(applyAudio, 750);

  const send = (msg) => window.parent.postMessage({ mv: 1, ...msg }, EXT_ORIGIN);

  window.addEventListener('message', (e) => {
    if (e.origin !== EXT_ORIGIN || e.source !== window.parent) return;
    const d = e.data;
    if (!d || d.mv !== 1) return;
    if ('muted' in d) { muted = !!d.muted; applyAudio(); }
    if ('clean' in d) document.documentElement.classList.toggle('mv-clean', !!d.clean);
  });

  // Report the current URL (YouTube TV is a single-page app, so poll for changes).
  let lastUrl = '';
  const reportUrl = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      send({ url: lastUrl });
    }
  };
  reportUrl();
  setInterval(reportUrl, 1000);

  // Forward Alt+1..4 audio shortcuts, since the frame has focus after clicking in it.
  window.addEventListener('keydown', (e) => {
    if (e.altKey && /^Digit[1-4]$/.test(e.code)) {
      e.preventDefault();
      send({ key: Number(e.code.slice(5)), shift: e.shiftKey });
    }
  }, true);
})();

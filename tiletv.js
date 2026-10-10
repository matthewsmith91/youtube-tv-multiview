const YT_ORIGIN = 'https://tv.youtube.com';
const HOME_URL = 'https://tv.youtube.com/live';
const LAYOUT_COUNTS = { '1': 1, '2': 2, '1+2': 3, '2x2': 4, '1+3': 4 };

const state = {
  layout: '2x2',
  urls: [HOME_URL, HOME_URL, HOME_URL, HOME_URL],
  hearing: [0],      // indices of tiles with audio on
  clean: false,
};

const grid = document.getElementById('grid');
const tiles = [];    // { el, iframe, input, audioBtn }
let maxIndex = -1;

// ---------- persistence ----------

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.local.set({ state }), 300);
}

// ---------- framing permission ----------

// tv.youtube.com sends X-Frame-Options, which stops it loading in a frame.
// Strip that header, but only for frames in this tab. Its CSP has no
// frame-ancestors, so the CSP stays in place and keeps protecting the tiles.
async function allowFraming() {
  const tab = await chrome.tabs.getCurrent();
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tab.id],
    addRules: [{
      id: tab.id,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'x-frame-options', operation: 'remove' },
        ],
      },
      condition: {
        requestDomains: ['tv.youtube.com'],
        resourceTypes: ['sub_frame'],
        tabIds: [tab.id],
      },
    }],
  });
}

// ---------- tiles ----------

function normalizeUrl(raw) {
  let s = raw.trim();
  if (!s) return null;
  // Also accept "/watch/...", "tv.youtube.com/watch/..." and http:// links.
  if (s.startsWith('/')) s = YT_ORIGIN + s;
  else if (!/^[a-z][a-z\d+.-]*:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.origin === YT_ORIGIN ? u.href : null;
  } catch {
    return null;
  }
}

function createTile(i) {
  const el = document.createElement('section');
  el.className = 'tile';
  el.innerHTML = `
    <div class="bar">
      <span class="num">${i + 1}</span>
      <button class="audio" title="Listen to this tile (Shift+click to mix)">🔇</button>
      <input type="text" spellcheck="false" placeholder="Paste a tv.youtube.com link and press Enter">
      <button class="home" title="Live guide">Guide</button>
      <button class="reload" title="Reload">⟳</button>
      <button class="maxbtn" title="Enlarge / restore">⤢</button>
    </div>
    <iframe allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
  `;
  const tile = {
    el,
    iframe: el.querySelector('iframe'),
    input: el.querySelector('input'),
    audioBtn: el.querySelector('.audio'),
  };

  tile.audioBtn.addEventListener('click', (e) => setHearing(tiles.indexOf(tile), e.shiftKey));
  el.querySelector('.home').addEventListener('click', () => navigate(tile, HOME_URL));
  el.querySelector('.reload').addEventListener('click', () => navigate(tile, state.urls[tiles.indexOf(tile)]));
  el.querySelector('.maxbtn').addEventListener('click', () => toggleMax(tiles.indexOf(tile)));
  el.querySelector('.bar').addEventListener('dblclick', (e) => {
    if (e.target.closest('button, input')) return;
    toggleMax(tiles.indexOf(tile));
  });
  tile.input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const url = normalizeUrl(tile.input.value);
    if (url) navigate(tile, url);
    else showError('That isn’t a tv.youtube.com link.');
  });
  tile.iframe.addEventListener('load', () => sendState(tile));

  tile.input.value = state.urls[i];
  tile.iframe.src = state.urls[i];
  return tile;
}

function navigate(tile, url) {
  const i = tiles.indexOf(tile);
  state.urls[i] = url;
  tile.input.value = url;
  tile.iframe.src = url;
  save();
}

// Add or remove tiles at the end only, so existing streams keep playing.
function applyLayout() {
  const count = LAYOUT_COUNTS[state.layout];
  while (tiles.length > count) tiles.pop().el.remove();
  while (tiles.length < count) {
    const tile = createTile(tiles.length);
    tiles.push(tile);
    grid.appendChild(tile.el);
  }
  grid.className = `l-${state.layout}`;
  for (const b of document.querySelectorAll('#layouts button')) {
    b.classList.toggle('on', b.dataset.layout === state.layout);
  }
  if (maxIndex >= count) maxIndex = -1;
  state.hearing = state.hearing.filter((i) => i < count);
  renderAll();
}

function toggleMax(i) {
  maxIndex = maxIndex === i ? -1 : i;
  tiles.forEach((t, j) => t.el.classList.toggle('max', j === maxIndex));
}

// ---------- audio ----------

function setHearing(i, mix) {
  if (mix) {
    state.hearing = state.hearing.includes(i)
      ? state.hearing.filter((j) => j !== i)
      : [...state.hearing, i];
  } else {
    state.hearing = state.hearing.length === 1 && state.hearing[0] === i ? [] : [i];
  }
  renderAll();
  save();
}

function sendState(tile) {
  const i = tiles.indexOf(tile);
  if (i < 0 || !tile.iframe.contentWindow) return;
  tile.iframe.contentWindow.postMessage(
    { mv: 1, muted: !state.hearing.includes(i), clean: state.clean },
    YT_ORIGIN,
  );
}

function renderAll() {
  tiles.forEach((tile, i) => {
    const on = state.hearing.includes(i);
    tile.el.classList.toggle('hearing', on);
    tile.audioBtn.classList.toggle('on', on);
    tile.audioBtn.textContent = on ? '🔊' : '🔇';
    sendState(tile);
  });
  document.getElementById('clean').classList.toggle('on', state.clean);
}

// ---------- messages from tiles ----------

window.addEventListener('message', (e) => {
  if (e.origin !== YT_ORIGIN || !e.data || e.data.mv !== 1) return;
  const tile = tiles.find((t) => t.iframe.contentWindow === e.source);
  if (!tile) return;
  const i = tiles.indexOf(tile);

  if (typeof e.data.url === 'string') {
    const url = normalizeUrl(e.data.url);
    if (url) {
      state.urls[i] = url;
      if (document.activeElement !== tile.input) tile.input.value = url;
      save();
    }
    sendState(tile); // also covers a freshly loaded page
  }
  if (typeof e.data.key === 'number') handleAudioKey(e.data.key, e.data.shift);
  if (e.data.listen) {
    // Unlike the 🔊 button, double-clicking the only tile you hear keeps it on.
    const onlyThis = state.hearing.length === 1 && state.hearing[0] === i;
    if (e.data.shift || !onlyThis) setHearing(i, !!e.data.shift);
  }
});

function handleAudioKey(n, shift) {
  if (n >= 1 && n <= tiles.length) setHearing(n - 1, shift);
}

// ---------- toolbar & keys ----------

document.getElementById('layouts').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-layout]');
  if (!b) return;
  state.layout = b.dataset.layout;
  applyLayout();
  save();
});

document.getElementById('muteAll').addEventListener('click', () => {
  state.hearing = [];
  renderAll();
  save();
});

document.getElementById('clean').addEventListener('click', () => {
  state.clean = !state.clean;
  renderAll();
  save();
});

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}
document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('fs', !!document.fullscreenElement);
});

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input')) return;
  const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
  if (/^Digit[1-4]$/.test(e.code) && !e.ctrlKey && !e.metaKey) {
    handleAudioKey(Number(e.code.slice(5)), e.shiftKey);
  } else if (plain && (e.key === 'f' || e.key === 'F')) {
    toggleFullscreen();
  } else if (plain && (e.key === 'm' || e.key === 'M')) {
    state.hearing = [];
    renderAll();
    save();
  }
});

function showError(msg) {
  const box = document.getElementById('error');
  box.textContent = msg;
  box.hidden = false;
  clearTimeout(showError.t);
  showError.t = setTimeout(() => { box.hidden = true; }, 6000);
}

// ---------- start ----------

(async () => {
  const { state: saved } = await chrome.storage.local.get('state');
  if (saved) {
    Object.assign(state, saved);
    if (!LAYOUT_COUNTS[state.layout]) state.layout = '2x2';
    while (state.urls.length < 4) state.urls.push(HOME_URL);
  }
  try {
    await allowFraming();
  } catch (err) {
    showError(`Couldn’t enable framing: ${err.message}`);
  }
  applyLayout();
})();

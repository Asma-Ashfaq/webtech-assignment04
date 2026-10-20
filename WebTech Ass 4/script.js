const KEY = 'markdown_slides_app_v1';
const DEFAULT_MD = `# Welcome to Markdown Slides
## Create, edit, save and present
Write your slides in Markdown on the left.

---

# Slide 02
## Separate slides with three dashes
- Use headings
- Use lists
- Use **bold** and *italic*

---

# Slide 03
## Thank you
Press **Full Screen** or **F11** to present.
`;

const $ = id => document.getElementById(id);
let store = { decks: {}, current: null };
let currentId = null, idx = 0, presenting = false, dirty = false, savedMd = '';

/* ---------- Storage (browser's internal memory) ---------- */
function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.decks) store = s;
  } catch (e) {}
}
function writeStore() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); return true; }
  catch (e) { return false; }
}
function uid() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

/* ---------- Slides ---------- */
// "---" on its own line separates slides
function slides() {
  const parts = $('editor').value.split(/^\s*---\s*$/m)
    .map(s => s.trim()).filter(s => s.length);
  return parts.length ? parts : [''];
}
function clampIndex() {
  const n = slides().length;
  if (idx > n - 1) idx = n - 1;
  if (idx < 0) idx = 0;
}

function render() {
  clampIndex();
  const all = slides();
  const html = marked.parse(all[idx] || '');
  const isLast = idx === all.length - 1;
  const text = (idx + 1) + ' / ' + all.length;

  $('pvSlide').innerHTML = html;
  $('prSlide').innerHTML = html;
  $('pvCount').textContent = text;
  $('prCount').textContent = text;

  ['pvLeft', 'prLeft'].forEach(id => $(id).disabled = idx === 0);
  ['pvRight', 'prRight'].forEach(id => $(id).disabled = isLast);

  $('prFull').textContent = presenting ? 'Exit Full Screen' : 'Full Screen';
  $('pvFull').innerHTML = '&#9974; Full Screen';

  const saved = store.decks[currentId];
  dirty = $('editor').value !== savedMd || (saved ? $('title').value !== saved.name : false);
  $('status').textContent = dirty ? 'Unsaved changes' : 'All changes saved';
}
function go(d) { idx += d; render(); }

/* ---------- Deck management ---------- */
function refreshList() {
  const sel = $('deckList');
  sel.innerHTML = '';
  const ids = Object.keys(store.decks);
  if (!ids.length) {
    const o = document.createElement('option');
    o.textContent = '(no saved presentations)';
    o.value = '';
    sel.appendChild(o);
  }
  ids.forEach(id => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = store.decks[id].name;
    sel.appendChild(o);
  });
  sel.value = store.decks[currentId] ? currentId : '';
}

function openDeck(id) {
  const d = store.decks[id];
  if (!d) return;
  currentId = id; store.current = id; idx = 0;
  $('editor').value = d.md;
  $('title').value = d.name;
  savedMd = d.md;
  writeStore(); refreshList(); render();
}

function newDeck() {
  if (dirty && !confirm('Discard unsaved changes?')) return;
  currentId = null; idx = 0;
  $('editor').value = DEFAULT_MD;
  $('title').value = 'Untitled presentation';
  savedMd = '';
  refreshList(); render();
}

function save() {
  const name = $('title').value.trim() || 'Untitled presentation';
  if (!currentId) currentId = uid();
  store.decks[currentId] = { name, md: $('editor').value, updated: Date.now() };
  store.current = currentId;
  if (!writeStore()) { $('status').textContent = 'Save failed (storage unavailable)'; return; }
  $('title').value = name;
  savedMd = $('editor').value;
  refreshList(); render();
  $('status').textContent = 'Saved ' + new Date().toLocaleTimeString();
}

function deleteDeck() {
  if (!currentId || !store.decks[currentId]) { alert('Nothing saved to delete.'); return; }
  if (!confirm('Delete "' + store.decks[currentId].name + '"?')) return;
  delete store.decks[currentId];
  currentId = null; store.current = null;
  writeStore();
  const ids = Object.keys(store.decks);
  if (ids.length) openDeck(ids[0]);
  else { refreshList(); dirty = false; savedMd = ''; newDeck(); }
}

/* ---------- Presentation / Full screen ---------- */
function startPresent() {
  presenting = true;
  $('present').classList.add('open');
  render();
  const el = $('present');
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}
function stopPresent() {
  presenting = false;
  $('present').classList.remove('open');
  render();
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}
function toggleFull() { presenting ? stopPresent() : startPresent(); }

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && presenting) stopPresent();
});

/* ---------- Events ---------- */
$('editor').addEventListener('input', render);
$('title').addEventListener('input', render);
$('editor').addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const t = e.target, s = t.selectionStart;
    t.value = t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd);
    t.selectionStart = t.selectionEnd = s + 2;
    render();
  }
});

$('pvLeft').onclick = $('prLeft').onclick = () => go(-1);
$('pvRight').onclick = $('prRight').onclick = () => go(1);
$('pvFull').onclick = $('prFull').onclick = toggleFull;
$('presentBtn').onclick = startPresent;
$('saveBtn').onclick = save;
$('newBtn').onclick = newDeck;
$('deleteBtn').onclick = deleteDeck;
$('deckList').onchange = e => {
  if (!e.target.value) return;
  if (dirty && !confirm('Discard unsaved changes?')) { refreshList(); return; }
  openDeck(e.target.value);
};

// Keyboard: Right / Left arrows, F11, Ctrl+S
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault(); save(); return;
  }
  if (e.key === 'F11') {
    e.preventDefault(); toggleFull(); return;
  }
  const tag = (document.activeElement || {}).tagName;
  const typing = tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT';
  if (typing && !presenting) return; // keep arrow keys for the cursor while editing

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (idx < slides().length - 1) go(1);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (idx > 0) go(-1);
  } else if (e.key === 'Escape' && presenting) {
    stopPresent();
  }
});

window.addEventListener('beforeunload', e => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- Init: load saved slides from browser memory ---------- */
loadStore();
if (store.current && store.decks[store.current]) {
  openDeck(store.current);
} else if (Object.keys(store.decks).length) {
  openDeck(Object.keys(store.decks)[0]);
} else {
  $('editor').value = DEFAULT_MD;
  $('title').value = 'Untitled presentation';
  refreshList();
  render();
}
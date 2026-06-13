/* ============================================================
   Code Scavenge — frontend
   ============================================================ */

// ── State ──────────────────────────────────────────────────────
let allEntries = [];
let filteredEntries = [];
let selectedIds = new Set();
let filters = {
  tags:      new Set(),
  languages: new Set(),
  origins:   new Set(),
  statuses:  new Set(),
  search:    '',
};
let currentDetailId = null;
let sortKey    = 'date-desc';
let modalMode  = 'add';
let modalEntryId = null;
let idAutoMode = true;
let foundBlocks   = [];  // all scanned blocks (classes, methods, functions)
let blockTypeIdx  = 0;   // index in availableTypes() array
let blockItemIdx  = 0;   // index within current type's items
let importedFileName = '';
let importedFileCode  = '';
let blockDrafts   = {};  // displayName → saved form state
let checkedBlocks = new Set(); // displayNames of checked blocks

// ── API helper — routes to Tauri invoke ────────────────────────
const invoke = window.__TAURI__?.core?.invoke ?? window.__TAURI__?.invoke;

async function api(method, path, body) {
  if (!invoke) throw new Error('Tauri not available');

  if (method === 'GET' && path === '/api/entries') {
    return invoke('get_entries');
  }
  if (method === 'GET' && path.startsWith('/api/entries/')) {
    return invoke('get_entry', { id: path.slice('/api/entries/'.length) });
  }
  if (method === 'DELETE' && path.startsWith('/api/entries/')) {
    return invoke('delete_entry', { id: path.slice('/api/entries/'.length) });
  }
  if (method === 'POST' && path === '/api/entries') {
    return invoke('create_entry', { data: body });
  }
  if (method === 'PUT' && path.startsWith('/api/entries/')) {
    return invoke('update_entry', { id: path.slice('/api/entries/'.length), data: body });
  }
  if (method === 'POST' && path === '/api/export') {
    return invoke('export_entries', { ids: body.ids });
  }
  throw new Error(`Unknown API: ${method} ${path}`);
}

// ── Load ───────────────────────────────────────────────────────
async function loadEntries() {
  try {
    allEntries = await api('GET', '/api/entries');
    applyFilters();
    renderFilters();
  } catch (err) {
    showToast('Failed to load entries: ' + err.message, 'error');
  }
}

// ── Filtering ──────────────────────────────────────────────────
function applyFilters() {
  filteredEntries = allEntries.filter(e => {
    if (filters.languages.size > 0 && !filters.languages.has(e.language)) return false;
    if (filters.origins.size > 0   && !filters.origins.has(e.origin))    return false;
    if (filters.statuses.size > 0  && !filters.statuses.has(e.status))   return false;
    if (filters.tags.size > 0 && ![...filters.tags].every(t => e.tags.includes(t))) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (![e.name, e.contract, e.notes].join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const STATUS_ORDER = { stable: 0, scarred: 1, experimental: 2 };
  filteredEntries.sort((a, b) => {
    switch (sortKey) {
      case 'date-asc':  return new Date(a.updated_at) - new Date(b.updated_at);
      case 'name-asc':  return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'status':    return (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      case 'language':  return a.language.localeCompare(b.language);
      default:          return new Date(b.updated_at) - new Date(a.updated_at); // date-desc
    }
  });

  renderCards();
  updateEntryCount();
}

function toggleFilter(key, value) {
  const s = filters[key];
  s.has(value) ? s.delete(value) : s.add(value);
  applyFilters();
  renderFilters();
}

function clearAllFilters() {
  ['tags','languages','origins','statuses'].forEach(k => filters[k].clear());
  filters.search = '';
  $('search').value = '';
  applyFilters();
  renderFilters();
}

// ── Render: filter sidebar ─────────────────────────────────────
function renderFilters() {
  const langs    = uniq(allEntries.map(e => e.language)).sort();
  const origins  = uniq(allEntries.map(e => e.origin).filter(Boolean)).sort();
  const tags     = uniq(allEntries.flatMap(e => e.tags)).sort();
  const statuses = ['stable', 'scarred', 'experimental'];

  renderChips('filter-language', langs,    filters.languages, 'languages');
  renderChips('filter-origin',   origins,  filters.origins,   'origins');
  renderChips('filter-status',   statuses, filters.statuses,  'statuses', true);
  renderChips('filter-tags',     tags,     filters.tags,      'tags');
}

function renderChips(containerId, items, activeSet, filterKey, useStatusClass = false) {
  $(containerId).innerHTML = items.map(item => {
    const cls = useStatusClass ? ` fc-${item}` : '';
    return `<button class="filter-chip${activeSet.has(item) ? ' active' : ''}${cls}"
              data-filter-key="${filterKey}" data-filter-val="${esc(item)}">${esc(item)}</button>`;
  }).join('');
}

// ── Render: cards ──────────────────────────────────────────────
function renderCards() {
  const grid = $('cards-grid');
  if (!filteredEntries.length) {
    grid.innerHTML = '<div class="empty-state">No entries match the current filters.</div>';
    return;
  }
  grid.innerHTML = filteredEntries.map(cardHtml).join('');
}

function cardHtml(e) {
  const sel     = selectedIds.has(e.id);
  const tags    = e.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const touched = e.touched?.length ? ` → <span class="touched">${esc(e.touched.join(', '))}</span>` : '';
  const preview = e.contract.length > 115 ? e.contract.slice(0, 115) + '…' : e.contract;
  return `<div class="card${sel ? ' selected' : ''}" data-id="${e.id}">
    <div class="card-header">
      <label class="card-check"><input type="checkbox"${sel ? ' checked' : ''} data-select="${e.id}"></label>
      <span class="card-name">${esc(e.name)}</span>
      <div class="card-badges">${typeBadge(e.type)}${langBadge(e.language)}<span class="status-badge status-${e.status}">${e.status}</span></div>
    </div>
    <div class="card-tags">${tags}</div>
    <div class="card-meta"><span class="origin">${esc(e.origin)}</span>${touched}</div>
    <div class="card-contract">${esc(preview)}</div>
    <div class="card-footer"><button class="btn-details" data-detail="${e.id}">Details →</button></div>
  </div>`;
}

function langBadge(lang) {
  return `<span class="lang-badge lang-${lang.toLowerCase()}">${esc(lang)}</span>`;
}

function typeBadge(type) {
  if (!type || type === 'function') return '<span class="type-badge type-fn">fn</span>';
  if (type === 'class')  return '<span class="type-badge type-class">cls</span>';
  if (type === 'module') return '<span class="type-badge type-mod">mod</span>';
  return ''; // 'other' or undefined: no badge
}

function updateEntryCount() {
  const shown = filteredEntries.length, total = allEntries.length;
  $('entry-count').textContent = shown === total
    ? `${total} entr${total === 1 ? 'y' : 'ies'}`
    : `${shown} / ${total} entries`;
}

// ── Selection ──────────────────────────────────────────────────
function toggleSelect(id, checked) {
  checked ? selectedIds.add(id) : selectedIds.delete(id);
  document.querySelector(`.card[data-id="${id}"]`)?.classList.toggle('selected', checked);
  updateSelectionBar();
}

function clearSelection() { selectedIds.clear(); renderCards(); updateSelectionBar(); }

function updateSelectionBar() {
  const bar = $('selection-bar');
  if (!selectedIds.size) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const n = selectedIds.size;
  $('selection-count').textContent = `${n} entr${n === 1 ? 'y' : 'ies'} selected`;
  const delBtn = $('delete-selected-btn');
  if (delBtn) delBtn.textContent = `Delete ${n > 1 ? n + ' entries' : 'entry'}`;
}

// ── Detail panel ───────────────────────────────────────────────
const PRISM_LANG = {
  javascript:  'javascript',  typescript: 'typescript',
  python:      'python',      rust:       'rust',
  c:           'c',           cpp:        'cpp',
  go:          'go',          lua:        'lua',
  glsl:        'glsl',        hlsl:       'hlsl',
  wgsl:        'wgsl',        gdscript:   'gdscript',
  csharp:      'csharp',      java:       'java',
  zig:         'zig',         css:        'css',
  scss:        'scss',        sass:       'sass',
  html:        'markup',      shell:      'bash',
  sql:         'sql',         kotlin:     'kotlin',
  swift:       'swift',       ruby:       'ruby',
  php:         'php',         dart:       'dart',
  scala:       'scala',       groovy:     'groovy',
  elixir:      'elixir',      r:          'r',
  powershell:  'powershell',  assembly:   'nasm',
  nim:         'nim',         julia:      'julia',
  perl:        'perl',        d:          'd',
  crystal:     'crystal',     odin:       'odin',
  solidity:    'solidity',    objc:       'objectivec',
  vhdl:        'vhdl',        verilog:    'verilog',
  fortran:     'fortran',     haskell:    'haskell',
  ocaml:       'ocaml',       fsharp:     'fsharp',
  kql:         'sql',
};

async function showDetail(id) {
  try {
    const entry = await api('GET', `/api/entries/${id}`);
    currentDetailId = id;
    $('detail-content').innerHTML = detailHtml(entry);
    $('panel-edit-btn').innerHTML = `<button class="btn-secondary" data-edit-id="${entry.id}">✏ Edit</button>`;
    $('detail-panel').classList.remove('hidden');
    $('panel-overlay').classList.remove('hidden');
    highlightDetail(entry.language);
  } catch (err) {
    showToast('Failed to load entry: ' + err.message, 'error');
  }
}

function highlightDetail(lang) {
  if (typeof Prism === 'undefined') return;
  const codeEl = $('detail-content')?.querySelector('pre code');
  if (!codeEl) return;
  codeEl.className = `language-${PRISM_LANG[lang?.toLowerCase()] || 'none'}`;
  Prism.highlightElement(codeEl);
}

function highlightModalSource(code, lang) {
  const hl    = $('modal-source-hl');
  const srcEl = $('modal-source');
  if (!hl || !srcEl) return;
  if (!code) { hl.classList.add('hidden'); srcEl.classList.remove('hidden'); return; }
  // Nuclear: destroy old <code> element so Prism never sees a "previously
  // highlighted" node and cannot skip or cache the update.
  hl.innerHTML = '<code></code>';
  hl.scrollTop = 0;
  const codeEl    = hl.querySelector('code');
  const prismLang = PRISM_LANG[lang?.toLowerCase()] || 'none';
  codeEl.className = prismLang !== 'none' ? `language-${prismLang}` : '';
  codeEl.textContent = code;
  if (typeof Prism !== 'undefined' && prismLang !== 'none') {
    if (Prism.languages[prismLang]) {
      // Grammar already cached → highlight synchronously right now
      codeEl.innerHTML = Prism.highlight(code, Prism.languages[prismLang], prismLang);
    } else {
      // First time this language is seen → autoloader fetches grammar async;
      // textContent above is already correct so the user sees the raw code
      // immediately, and highlighting applies once the grammar arrives.
      Prism.highlightElement(codeEl);
    }
  }
  hl.classList.remove('hidden');
  srcEl.classList.add('hidden');
}

function detailHtml(e) {
  const tags = e.tags.length
    ? e.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')
    : '<span class="muted-text">none</span>';
  return `
    <div class="detail-header">
      <div class="detail-title-row">
        <h2 class="detail-name">${esc(e.name)}</h2>
        <div class="detail-badges">${langBadge(e.language)}<span class="status-badge status-${e.status}">${e.status}</span></div>
      </div>
      <div class="detail-meta">
        <span>Origin: <strong>${esc(e.origin)}</strong></span>
        ${e.touched?.length ? `<span>Touched: <strong>${esc(e.touched.join(', '))}</strong></span>` : ''}
        <span class="detail-date">${new Date(e.updated_at).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})}</span>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-label">TAGS</div>
      <div class="detail-tags">${tags}</div>
    </div>
    <div class="detail-section">
      <div class="detail-label">CONTRACT</div>
      <div class="detail-value">${esc(e.contract)||'<span class="muted-text">—</span>'}</div>
    </div>
    <div class="detail-section two-col">
      <div><div class="detail-label">INPUTS</div><div class="detail-value mono">${esc(e.inputs)||'<span class="muted-text">—</span>'}</div></div>
      <div><div class="detail-label">OUTPUTS</div><div class="detail-value mono">${esc(e.outputs)||'<span class="muted-text">—</span>'}</div></div>
    </div>
    ${e.scars?`<div class="detail-section"><div class="detail-label">SCARS</div><div class="detail-value scar-text">${esc(e.scars)}</div></div>`:''}
    ${e.notes?`<div class="detail-section"><div class="detail-label">NOTES</div><div class="detail-value detail-notes-ro">${esc(e.notes)}</div></div>`:''}
    <div class="detail-section">
      <div class="detail-label">SOURCE <span class="detail-source-path">${esc(e.source||'')}</span><button class="btn-copy" data-copy-source title="Copy source code">Copy</button></div>
      <pre class="detail-source"><code>${esc(e.sourceContent||'')}</code></pre>
    </div>
    <div class="detail-actions">
      <button class="btn-danger" data-delete-id="${e.id}">Delete</button>
    </div>`;
}

function closeDetail() {
  $('detail-panel').classList.add('hidden');
  $('panel-overlay').classList.add('hidden');
  $('panel-edit-btn').innerHTML = '';
  currentDetailId = null;
}

// ── Delete ─────────────────────────────────────────────────────
function deleteEntry(id) {
  const entry = allEntries.find(e => e.id === id);
  openConfirm(`Delete "${entry?.name || id}"?\n\nRemoves the catalog entry and source file.`, async () => {
    try {
      await api('DELETE', `/api/entries/${id}`);
      allEntries = allEntries.filter(e => e.id !== id);
      selectedIds.delete(id);
      closeDetail(); applyFilters(); renderFilters(); updateSelectionBar();
      showToast('Entry deleted');
    } catch (err) { showToast('Failed to delete: ' + err.message, 'error'); }
  });
}

// ── Confirm ────────────────────────────────────────────────────
let confirmCallback = null;
function openConfirm(message, onOk) {
  confirmCallback = onOk;
  $('confirm-message').textContent = message;
  $('confirm-overlay').classList.remove('hidden');
}

// ── Bulk delete ────────────────────────────────────────────────
function deleteSelected() {
  const ids   = [...selectedIds];
  const names = ids.map(id => allEntries.find(e => e.id === id)?.name || id);
  const label = ids.length === 1 ? `"${names[0]}"` : `${ids.length} entries`;
  openConfirm(`Delete ${label}?\n\nThis cannot be undone.`, async () => {
    let deleted = 0, failed = 0;
    for (const id of ids) {
      try { await api('DELETE', `/api/entries/${id}`); allEntries = allEntries.filter(e => e.id !== id); deleted++; }
      catch { failed++; }
    }
    selectedIds.clear();
    if (ids.includes(currentDetailId)) closeDetail();
    applyFilters(); renderFilters(); updateSelectionBar();
    showToast(`${deleted} entr${deleted !== 1 ? 'ies' : 'y'} deleted${failed ? ` · ${failed} failed` : ''}`);
  });
}

// ── Tag autocomplete ───────────────────────────────────────────
function showTagSuggestions(input) {
  document.getElementById('tag-dropdown')?.remove();
  const pos   = input.selectionStart;
  const before = input.value.slice(0, pos);
  const lastSep = Math.max(before.lastIndexOf(','), before.lastIndexOf(' '));
  const token   = before.slice(lastSep + 1).trim().toLowerCase();
  if (!token) return;

  const inUse   = input.value.split(/[,\s]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
  const matches = uniq(allEntries.flatMap(e => e.tags))
    .filter(t => t.toLowerCase().startsWith(token) && !inUse.includes(t.toLowerCase()))
    .sort().slice(0, 8);
  if (!matches.length) return;

  const dd = document.createElement('div');
  dd.id = 'tag-dropdown';
  dd.className = 'tag-dropdown';
  matches.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-dropdown-item';
    btn.textContent = tag;
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      const after  = input.value.slice(pos);
      const prefix = before.slice(0, lastSep + 1);
      input.value  = prefix + tag + (after.trimStart().startsWith(',') ? '' : ', ') + after.trimStart().replace(/^,\s*/, '');
      input.dispatchEvent(new Event('input'));
      dd.remove();
    });
    dd.appendChild(btn);
  });
  const rect = input.getBoundingClientRect();
  Object.assign(dd.style, { top: `${rect.bottom + 2}px`, left: `${rect.left}px`, width: `${rect.width}px` });
  document.body.appendChild(dd);
}

// ── Modal ──────────────────────────────────────────────────────
function openModal(entry = null) {
  modalMode    = entry ? 'edit' : 'add';
  modalEntryId = entry?.id || null;
  idAutoMode   = !entry;
  foundBlocks = []; blockTypeIdx = 0; blockItemIdx = 0;
  importedFileName = ''; importedFileCode = '';
  blockDrafts = {}; checkedBlocks = new Set();
  $('modal-title').textContent = entry ? 'Edit Entry' : 'New Entry';
  $('modal-form').innerHTML = buildForm(entry);
  updateBatchButtons();
  $('modal-overlay').classList.remove('hidden');
  ($('modal-name') ?? $('modal-id'))?.focus();
}

const LANGUAGES = [
  'javascript','typescript','python','rust','c','cpp','go',
  'lua','glsl','wgsl','hlsl','gdscript','csharp','java','zig',
  'css','scss','sass','html','shell','sql',
  'kotlin','swift','ruby','php','dart','scala','groovy',
  'elixir','r','powershell','assembly','nim','julia','perl',
  'd','crystal','odin','solidity','objc','vhdl','verilog',
  'fortran','haskell','ocaml','fsharp','kql',
];
const LANG_EXT = {
  javascript:'js', typescript:'ts', python:'py', rust:'rs',
  c:'c', cpp:'cpp', go:'go', lua:'lua', glsl:'glsl', hlsl:'hlsl',
  wgsl:'wgsl', gdscript:'gd', csharp:'cs', java:'java', zig:'zig',
  css:'css', scss:'scss', sass:'sass', html:'html', shell:'sh', sql:'sql',
  kotlin:'kt', swift:'swift', ruby:'rb', php:'php', dart:'dart',
  scala:'scala', groovy:'groovy', elixir:'ex', r:'r', powershell:'ps1',
  assembly:'asm', nim:'nim', julia:'jl', perl:'pl', d:'d',
  crystal:'cr', odin:'odin', solidity:'sol', objc:'m', vhdl:'vhd',
  verilog:'v', fortran:'f90', haskell:'hs', ocaml:'ml', fsharp:'fs', kql:'kql',
};
// File extension → language (for auto-detecting from dropped file)
const EXT_LANG = {
  js:'javascript', ts:'typescript', py:'python', rs:'rust',
  c:'c', cpp:'cpp', cc:'cpp', h:'c', hpp:'cpp',
  go:'go', lua:'lua', glsl:'glsl', hlsl:'hlsl', wgsl:'wgsl',
  gd:'gdscript', cs:'csharp', java:'java', zig:'zig',
  css:'css', scss:'scss', sass:'sass',
  html:'html', htm:'html',
  sh:'shell', bash:'shell',
  sql:'sql',
  kt:'kotlin', kts:'kotlin',
  swift:'swift',
  rb:'ruby',
  php:'php',
  dart:'dart',
  scala:'scala',
  groovy:'groovy', gradle:'groovy',
  ex:'elixir', exs:'elixir',
  r:'r', R:'r',
  ps1:'powershell', psm1:'powershell',
  asm:'assembly', s:'assembly', nasm:'assembly',
  nim:'nim',
  jl:'julia',
  pl:'perl', pm:'perl',
  d:'d',
  cr:'crystal',
  odin:'odin',
  sol:'solidity',
  m:'objc', mm:'objc',
  vhd:'vhdl', vhdl:'vhdl',
  sv:'verilog',                       // .v mapped to verilog below
  f:'fortran', f90:'fortran', f95:'fortran', f03:'fortran', f08:'fortran', for:'fortran',
  hs:'haskell', lhs:'haskell',
  ml:'ocaml', mli:'ocaml',
  fs:'fsharp', fsx:'fsharp', fsi:'fsharp',
  // .v is ambiguous (Verilog vs V lang) — map to verilog
  v:'verilog',
  kql:'kql',
};

function buildForm(e) {
  const v      = e || {};
  const isEdit = !!e;
  const langList = LANGUAGES.map(l => `<option value="${l}">`).join('');

  const TYPES = ['function','class','struct','interface','enum','macro','type','module','other'];
  const metaFields = `
    <div class="form-row two-col">
      <div class="form-field">
        <label>Name <span class="req">*</span></label>
        <input id="modal-name" type="text" value="${esc(v.name||'')}" placeholder="myFunction" required>
      </div>
      <div class="form-field">
        <label>Language <span class="req">*</span></label>
        <input id="modal-language" type="text" list="lang-list"
          value="${esc(v.language||'javascript')}" placeholder="javascript, python…" autocomplete="off">
        <datalist id="lang-list">${langList}</datalist>
      </div>
    </div>
    <div class="form-row two-col">
      <div class="form-field">
        <label>ID <span class="req">*</span></label>
        <input id="modal-id" type="text" value="${esc(v.id||'')}" placeholder="my-function-js" ${isEdit?'readonly':''} required>
      </div>
      <div class="form-field two-col-inner">
        <div class="form-field" style="flex:1">
          <label>Status</label>
          <select id="modal-status">
            ${['stable','scarred','experimental'].map(s=>`<option value="${s}"${(v.status||'experimental')===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-field" style="flex:0 0 110px">
          <label>Type</label>
          <select id="modal-type">
            ${TYPES.map(t=>`<option value="${t}"${(v.type||'function')===t?' selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="form-row two-col">
      <div class="form-field">
        <label>Origin</label>
        <input id="modal-origin" type="text" value="${esc(v.origin||'')}" placeholder="P1">
      </div>
      <div class="form-field">
        <label>Touched (comma-separated)</label>
        <input id="modal-touched" type="text" value="${esc((v.touched||[]).join(', '))}" placeholder="P2, P3">
      </div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Tags (comma or space-separated)</label>
        <input id="modal-tags" type="text" value="${esc((v.tags||[]).join(', '))}" placeholder="collision 2d math pure">
      </div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Contract</label>
        <textarea id="modal-contract" rows="3" placeholder="What does this function do?">${esc(v.contract||'')}</textarea>
      </div>
    </div>
    <div class="form-row two-col">
      <div class="form-field">
        <label>Inputs</label>
        <input id="modal-inputs" type="text" value="${esc(v.inputs||'')}" placeholder="a: number, b: { x, y }">
      </div>
      <div class="form-field">
        <label>Outputs</label>
        <input id="modal-outputs" type="text" value="${esc(v.outputs||'')}" placeholder="{ dx, dy } | null">
      </div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Scars</label>
        <textarea id="modal-scars" rows="2" placeholder="Known issues, gotchas…">${esc(v.scars||'')}</textarea>
      </div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Notes</label>
        <textarea id="modal-notes" rows="3" placeholder="Personal notes…">${esc(v.notes||'')}</textarea>
      </div>
    </div>`;

  if (isEdit) {
    return metaFields + `<div class="form-note">Source: <code>${esc(v.source||'')}</code> — edit directly in your code editor.</div>`;
  }

  // ADD mode: file drop zone first, source preview revealed after
  return `
    <div class="file-drop-zone" id="file-drop" title="Click to browse, or drag a file here">
      <input type="file" id="file-input" style="display:none"
        accept=".js,.ts,.py,.rs,.c,.cpp,.cc,.h,.hpp,.go,.lua,.glsl,.hlsl,.wgsl,.gd,.cs,.java,.zig,.css,.scss,.sass,.html,.htm,.sh,.bash,.sql,.kt,.kts,.swift,.rb,.php,.dart,.scala,.groovy,.gradle,.ex,.exs,.r,.R,.ps1,.psm1,.asm,.s,.nasm,.nim,.jl,.pl,.pm,.d,.cr,.odin,.sol,.m,.mm,.vhd,.vhdl,.v,.sv,.f,.f90,.f95,.f03,.f08,.for,.hs,.lhs,.ml,.mli,.fs,.fsx,.fsi,.kql">
      <div class="drop-body">
        <span class="drop-icon">⬇</span>
        <div id="drop-text">Click to import a source file, or drag &amp; drop it here</div>
      </div>
    </div>
    <div class="parse-hint" id="parse-hint"></div>
    <div class="fn-selector hidden" id="fn-selector"></div>
    ${metaFields}
    <div class="form-row hidden" id="source-preview-wrap">
      <div class="form-field">
        <div class="label-with-copy">
          <label>Source Code <span class="detail-source-path" id="source-filename"></span></label>
          <button class="btn-copy" id="copy-source-btn" type="button" title="Copy source code">Copy</button>
        </div>
        <pre id="modal-source-hl" class="detail-source modal-source-hl hidden" tabindex="0" title="Click or press Enter to edit source"><code></code></pre>
        <textarea id="modal-source" class="mono" rows="12" placeholder="Source will appear here after file selection…"></textarea>
      </div>
    </div>`;
}

// ── Auto-ID ────────────────────────────────────────────────────
function slugify(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function autoId() {
  if (!idAutoMode) return;
  const name = $('modal-name')?.value.trim() || '';
  const lang = $('modal-language')?.value.trim().toLowerCase() || '';
  if (!name) return;
  const ext = LANG_EXT[lang] || lang.slice(0, 3) || '';
  $('modal-id').value = ext ? `${slugify(name)}-${ext}` : slugify(name);
}

// ── File handling ──────────────────────────────────────────────
function handleFileSelect(file) {
  if (!file) return;

  importedFileName = file.name;
  const ext  = file.name.split('.').pop().toLowerCase();
  const lang = EXT_LANG[ext] || '';

  // Auto-set language from extension
  const langEl = $('modal-language');
  if (langEl && lang) { langEl.value = lang; autoId(); }

  const reader = new FileReader();
  reader.onload = ev => {
    importedFileCode = ev.target.result;

    // Reveal source preview section
    const wrap = $('source-preview-wrap');
    if (wrap) wrap.classList.remove('hidden');
    const fnEl = $('source-filename');
    if (fnEl) fnEl.textContent = file.name;

    // Update drop zone appearance
    const dropZone = $('file-drop');
    dropZone?.classList.add('file-loaded');
    const dropText = $('drop-text');
    if (dropText) dropText.innerHTML =
      `✓ <strong>${esc(file.name)}</strong> <span class="drop-change">(click to change)</span>`;

    // Scan all blocks (classes + methods + functions)
    const detectedLang = lang || $('modal-language')?.value?.toLowerCase() || '';
    foundBlocks = findAllBlocks(importedFileCode, detectedLang);

    // Start on the first non-file type (function if present, else whatever comes first)
    blockTypeIdx = 0; blockItemIdx = 0;
    const types = availableTypes();
    if (foundBlocks.length > 0) {
      // Default to 'function' tab if available, else the first real tab after 'file'
      const fnIdx = types.indexOf('function');
      blockTypeIdx = fnIdx >= 0 ? fnIdx : (types.length > 1 ? 1 : 0);
    }
    renderScopeNav();
    applyScopeFields();
    updateBatchButtons();

    const hint = $('parse-hint');
    if (!hint) return;
    if (foundBlocks.length === 0) {
      hint.textContent = detectedLang
        ? `No blocks detected — using entire file. Fill metadata manually.`
        : `Unknown file type — set language and fill metadata manually.`;
    } else {
      // Summarise by type
      const counts = {};
      foundBlocks.forEach(b => { const t = b.type||'function'; counts[t] = (counts[t]||0)+1; });
      const plurals = { class:'classes', macro:'macros', interface:'interfaces',
                        struct:'structs', enum:'enums', method:'methods',
                        function:'functions', type:'types', module:'modules', other:'other' };
      const parts = TYPE_ORDER
        .filter(t => t !== 'file' && counts[t])
        .map(t => `${counts[t]} ${counts[t] > 1 ? (plurals[t]||t+'s') : t}`);
      hint.textContent = `Found ${parts.join(', ')} — use arrows to switch scope.`;
    }
  };
  reader.readAsText(file);
}

function applyParsed(block) {
  const nameEl = $('modal-name');
  // Use formName (class-qualified for methods) if available, else raw name
  if (nameEl) { nameEl.value = block.formName || block.name; idAutoMode = true; autoId(); }
  const inputsEl = $('modal-inputs');
  if (inputsEl) inputsEl.value = block.inputs || '';
  const outputsEl = $('modal-outputs');
  if (outputsEl) outputsEl.value = block.outputs || '';
}

// ── Scope navigation — two level (type row + item row) ──────────
const TYPE_META = {
  file:      { icon: '📄', label: 'Entire file'  },
  class:     { icon: '📦', label: 'Classes'      },
  struct:    { icon: '🧱', label: 'Structs'      },
  interface: { icon: '🔌', label: 'Interfaces'   },
  enum:      { icon: '🔢', label: 'Enums'        },
  function:  { icon: '⚙',  label: 'Functions'    },
  method:    { icon: '🔩', label: 'Methods'      },
  macro:     { icon: '🔧', label: 'Macros'       },
  type:      { icon: '🏷',  label: 'Types'        },
  module:    { icon: '📂', label: 'Modules'      },
  other:     { icon: '🔹', label: 'Other'        },
};

// Order in which type tabs appear in the scope navigator
const TYPE_ORDER = ['file','function','class','method','struct','interface','enum','macro','type','module','other'];

function availableTypes() {
  const present = new Set(foundBlocks.map(b => b.type || 'function'));
  return TYPE_ORDER.filter(t => t === 'file' || present.has(t));
}

function typeItems(typeKey) {
  if (typeKey === 'file') return [];
  return foundBlocks.filter(b => b.type === typeKey);
}

function renderScopeNav() {
  const sel = $('fn-selector');
  if (!sel) return;

  // Remember which scope row had focus before innerHTML wipes it
  const prevFocus = sel.contains(document.activeElement)
    ? (document.activeElement.closest('.type-row') ? 'type'
      : document.activeElement.closest('.item-row') ? 'item' : null)
    : null;

  const types  = availableTypes();
  const tKey   = types[blockTypeIdx] || 'file';
  const items  = typeItems(tKey);
  const tm     = TYPE_META[tKey];

  // Type row
  const tPrevOff = blockTypeIdx === 0             ? ' disabled' : '';
  const tNextOff = blockTypeIdx >= types.length-1 ? ' disabled' : '';
  const tLabel   = `${tm.icon} ${tm.label}${items.length > 1 ? `  ·  ${items.length}` : ''}`;

  // Item row (only when type has items)
  let itemRowHtml = '';
  if (items.length > 0) {
    const block    = items[blockItemIdx] || items[0];
    const iPrevOff = blockItemIdx === 0             ? ' disabled' : '';
    const iNextOff = blockItemIdx >= items.length-1 ? ' disabled' : '';
    const isChecked = checkedBlocks.has(block.displayName) ? ' checked' : '';
    itemRowHtml = `<div class="scope-row item-row" tabindex="0">
      <button class="scope-arrow" id="item-prev"${iPrevOff}>&#x2190;</button>
      <span class="scope-label"><input type="checkbox" id="block-check" class="block-check" title="Include in Create Checked"${isChecked}> ${esc(block.displayName)}  ·  ${blockItemIdx+1} / ${items.length}</span>
      <button class="scope-arrow" id="item-next"${iNextOff}>&#x2192;</button>
    </div>`;
  }

  sel.innerHTML = `<div class="scope-nav">
    <div class="scope-row type-row" tabindex="0">
      <button class="scope-arrow" id="type-prev"${tPrevOff}>&#x2190;</button>
      <span class="scope-label type-label">${tLabel}</span>
      <button class="scope-arrow" id="type-next"${tNextOff}>&#x2192;</button>
    </div>
    ${itemRowHtml}
  </div>`;
  sel.classList.remove('hidden');

  // Restore focus to the correct scope row after re-render
  if (prevFocus === 'type') sel.querySelector('.type-row')?.focus();
  else if (prevFocus === 'item') sel.querySelector('.item-row')?.focus();
}

function applyScopeFields() {
  const srcEl  = $('modal-source');
  const lang   = $('modal-language')?.value?.toLowerCase() || '';
  const types  = availableTypes();
  const tKey   = types[blockTypeIdx] || 'file';
  const items  = typeItems(tKey);
  const block  = items[blockItemIdx] || null;
  const draftKey = block ? block.displayName : '__file__';
  const draft    = blockDrafts[draftKey];

  // Wipe all metadata inputs to empty (called when arriving at a fresh block)
  function clearMeta() {
    [['modal-status','experimental'],['modal-origin',''],['modal-touched',''],
     ['modal-tags',''],['modal-contract',''],['modal-scars',''],['modal-notes','']
    ].forEach(([id, def]) => { const el = $(id); if (el) el.value = def; });
  }

  if (draft) {
    // ── Returning to a block we've visited — restore everything ──
    const nameEl = $('modal-name');
    if (nameEl) { nameEl.value = draft.name || ''; idAutoMode = !block; if (!block) autoId(); }
    if ($('modal-type'))    $('modal-type').value    = draft.type    || 'function';
    if ($('modal-status'))  $('modal-status').value  = draft.status  || 'experimental';
    if ($('modal-inputs'))  $('modal-inputs').value  = draft.inputs  || '';
    if ($('modal-outputs')) $('modal-outputs').value = draft.outputs || '';
    if ($('modal-origin'))  $('modal-origin').value  = draft.origin  || '';
    if ($('modal-touched')) $('modal-touched').value = draft.touched || '';
    if ($('modal-tags'))    $('modal-tags').value    = draft.tags    || '';
    if ($('modal-contract'))$('modal-contract').value= draft.contract|| '';
    if ($('modal-scars'))   $('modal-scars').value   = draft.scars   || '';
    if ($('modal-notes'))   $('modal-notes').value   = draft.notes   || '';
    const draftCode = block ? extractBlockSource(importedFileCode, lang, block) : importedFileCode;
    if (srcEl) srcEl.value = draftCode;
    highlightModalSource(draftCode, lang);

  } else if (block) {
    // ── First visit to this block — scanned data for name/inputs/outputs, clear the rest ──
    applyParsed(block);
    const typeEl = $('modal-type');
    if (typeEl) typeEl.value = (block.type === 'method' ? 'function' : block.type) || 'function';
    clearMeta();
    const blockCode = extractBlockSource(importedFileCode, lang, block);
    if (srcEl) srcEl.value = blockCode;
    highlightModalSource(blockCode, lang);

  } else {
    // ── Entire file, first visit — filename stem as name, wipe everything else ──
    const stem = importedFileName.replace(/\.[^.]+$/, '');
    const nameEl = $('modal-name');
    if (nameEl) { nameEl.value = stem; idAutoMode = true; autoId(); }
    if ($('modal-type'))    $('modal-type').value    = 'module';
    if ($('modal-inputs'))  $('modal-inputs').value  = '';
    if ($('modal-outputs')) $('modal-outputs').value = '';
    clearMeta();
    if (srcEl) srcEl.value = importedFileCode;
    highlightModalSource(importedFileCode, lang);
  }

  // Sync checkbox state in scope nav
  const chk = $('block-check');
  if (chk && block) chk.checked = checkedBlocks.has(block.displayName);
}

// Save current block's form into blockDrafts before navigating away
function saveCurrentDraft() {
  const types = availableTypes();
  const tKey  = types[blockTypeIdx] || 'file';
  const items = typeItems(tKey);
  const block = items[blockItemIdx] || null;
  const key   = block ? block.displayName : '__file__';
  blockDrafts[key] = {
    name:     $('modal-name')?.value     ?? '',
    type:     $('modal-type')?.value     ?? 'function',
    status:   $('modal-status')?.value   ?? 'experimental',
    origin:   $('modal-origin')?.value   ?? '',
    touched:  $('modal-touched')?.value  ?? '',
    tags:     $('modal-tags')?.value     ?? '',
    contract: $('modal-contract')?.value ?? '',
    inputs:   $('modal-inputs')?.value   ?? '',
    outputs:  $('modal-outputs')?.value  ?? '',
    scars:    $('modal-scars')?.value    ?? '',
    notes:    $('modal-notes')?.value    ?? '',
  };
}

function setBlockType(delta) {
  saveCurrentDraft();
  const types = availableTypes();
  blockTypeIdx = Math.max(0, Math.min(types.length - 1, blockTypeIdx + delta));
  blockItemIdx = 0;
  applyScopeFields();
  renderScopeNav();
  updateBatchButtons();
}

function setBlockItem(delta) {
  saveCurrentDraft();
  const types = availableTypes();
  const items = typeItems(types[blockTypeIdx] || 'file');
  blockItemIdx = Math.max(0, Math.min(items.length - 1, blockItemIdx + delta));
  applyScopeFields();
  renderScopeNav();
}

// ── Block scanners ─────────────────────────────────────────────
const BLOCK_KEYWORDS = /^(if|for|while|switch|catch|constructor)$/;

function findAllBlocks(code, lang) {
  const scanner = SCANNERS[lang?.toLowerCase()];
  if (!scanner) return [];
  try {
    return scanner(code)
      .filter(b => b.name && !BLOCK_KEYWORDS.test(b.name))
      .map(b => ({
        type:        b.type        || 'function',
        name:        b.name,
        displayName: b.displayName || b.name,
        formName:    b.formName    || b.name,
        className:   b.className   || null,
        inputs:      b.inputs      || '',
        outputs:     b.outputs     || '',
        srcStart:    b.srcStart,
      }));
  } catch { return []; }
}

const SCANNERS = {
  javascript: scanJsTs,
  typescript: scanJsTs,
  python:     scanPython,
  gdscript:   scanGDScript,
  rust:       scanRust,
  c:          scanClike,
  cpp:        scanClike,
  glsl:       scanClike,
  hlsl:       scanClike,
  wgsl:       scanClike,
  go:         scanGo,
  lua:        scanLua,
  java:       scanJava,
  csharp:     scanCSharp,
  zig:        scanZig,
  shell:      scanShell,
  css:        scanCSS,
  scss:       scanSCSS,
  sass:       scanSCSS,
  sql:        scanSQL,
  kotlin:     scanKotlin,
  swift:      scanSwift,
  ruby:       scanRuby,
  php:        scanPHP,
  dart:       scanDart,
  scala:      scanScala,
  groovy:     scanJava,    // Groovy is close enough to Java for scanning
  elixir:     scanElixir,
  r:          scanR,
  powershell: scanPowerShell,
  assembly:   scanAssembly,
  nim:        scanNim,
  julia:      scanJulia,
  perl:       scanPerl,
  d:          scanClike,   // D uses the same brace-back approach as C/C++
  crystal:    scanCrystal,
  odin:       scanOdin,
  solidity:   scanSolidity,
  objc:       scanObjC,
  vhdl:       scanVHDL,
  verilog:    scanVerilog,
  fortran:    scanFortran,
  haskell:    scanHaskell,
  ocaml:      scanOCaml,
  fsharp:     scanFSharp,
  kql:        scanKQL,
  // html: no function-like constructs — whole-file entries only
};

function scanJsTs(code) {
  const seen = new Set(), results = [];

  // ── Standalone named functions ──────────────────────────────
  const fnRe = /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{/\n]+))?/g;
  let m;
  while ((m = fnRe.exec(code)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      results.push({ type:'function', name: m[1], displayName: m[1], formName: m[1], className: null,
        inputs: m[2]?.trim()||'', outputs: m[3]?.trim()||inferReturnJs(code, m.index), srcStart: m.index });
    }
  }
  // ── Top-level arrow / const ─────────────────────────────────
  const arrowRe = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^=>/\n]+))?\s*=>/gm;
  while ((m = arrowRe.exec(code)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      results.push({ type:'function', name: m[1], displayName: m[1], formName: m[1], className: null,
        inputs: m[2]?.trim()||'', outputs: m[3]?.trim()||'', srcStart: m.index });
    }
  }
  // ── TypeScript interface ────────────────────────────────────
  const ifaceRe = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s<>]+)?\s*\{/g;
  while ((m = ifaceRe.exec(code)) !== null) {
    const name = m[1];
    if (!seen.has('iface:' + name)) {
      seen.add('iface:' + name);
      results.push({ type:'interface', name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'', srcStart:m.index });
    }
  }
  // ── TypeScript / JS enum ────────────────────────────────────
  const enumRe = /(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*\{/g;
  while ((m = enumRe.exec(code)) !== null) {
    const name = m[1];
    if (!seen.has('enum:' + name)) {
      seen.add('enum:' + name);
      results.push({ type:'enum', name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'', srcStart:m.index });
    }
  }
  // ── TypeScript type alias ───────────────────────────────────
  const typeAliasRe = /^(?:export\s+)?type\s+(\w+)(?:\s*<[^>]*>)?\s*=/gm;
  while ((m = typeAliasRe.exec(code)) !== null) {
    const name = m[1];
    if (!seen.has('type:' + name)) {
      seen.add('type:' + name);
      results.push({ type:'type', name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'', srcStart:m.index });
    }
  }
  // ── Classes and their methods ───────────────────────────────
  const classRe = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+[\w$.]+(?:<[^>]*>)?)?(?:\s+implements\s+[\w,\s<>]+)?\s*\{/g;
  while ((m = classRe.exec(code)) !== null) {
    const className = m[1];
    if (seen.has('class:' + className)) continue;
    seen.add('class:' + className);
    // Find class body by brace counting
    let depth = 0, inStr = false, strCh = '', classEnd = code.length;
    for (let i = m.index; i < code.length; i++) {
      const c = code[i];
      if (inStr) { if (c === strCh && code[i-1] !== '\\') inStr = false; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { classEnd = i + 1; break; } }
    }
    results.push({ type:'class', name: className, displayName: className, formName: className,
      className: null, inputs: '', outputs: 'instance', srcStart: m.index });
    // Methods inside the class body
    const classBody = code.slice(m.index, classEnd);
    const methodRe  = /^([ \t]+)(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{/\n]+))?\s*\{/gm;
    let mm;
    while ((mm = methodRe.exec(classBody)) !== null) {
      if (BLOCK_KEYWORDS.test(mm[2])) continue;
      const key = className + '.' + mm[2];
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ type:'method', name: mm[2],
          displayName: `${className}.${mm[2]}`,
          formName:    `${className} ${mm[2]}`,
          className,
          inputs: mm[3]?.trim()||'', outputs: mm[4]?.trim()||'',
          srcStart: m.index + mm.index });
      }
    }
  }
  return results;
}

function inferReturnJs(code, fromIdx = 0) {
  const slice = code.slice(fromIdx);
  const hits = [...slice.matchAll(/\breturn\b\s*([^\n;{}]+)/g)]
    .map(m => m[1].trim()).filter(r => r && r !== 'null' && r !== 'undefined');
  if (!hits.length) return '';
  const r = hits[0];
  const nullable = slice.includes('return null');
  const short = r.startsWith('{') ? '{ … }' : r.startsWith('[') ? '[ … ]' : r.slice(0,40);
  return nullable ? `${short} | null` : short;
}

function scanPython(code) {
  const lines   = code.split('\n');
  const results = [];
  const classStack = []; // { name, indent }

  for (const line of lines) {
    // Class definition
    const cm = line.match(/^([ \t]*)class\s+(\w+)/);
    if (cm) {
      const indent = cm[1].length;
      while (classStack.length && classStack.at(-1).indent >= indent) classStack.pop();
      classStack.push({ name: cm[2], indent });
      results.push({ type:'class', name: cm[2], displayName: cm[2], formName: cm[2],
        className: null, inputs: '', outputs: 'instance' });
      continue;
    }
    // Function / method definition
    const fm = line.match(/^([ \t]*)def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:\n]+))?/);
    if (fm) {
      const fnIndent = fm[1].length;
      while (classStack.length && classStack.at(-1).indent >= fnIndent) classStack.pop();
      const cls = classStack.length ? classStack.at(-1).name : null;
      results.push({
        type:        cls ? 'method' : 'function',
        name:        fm[2],
        displayName: cls ? `${cls}.${fm[2]}` : fm[2],
        formName:    cls ? `${cls} ${fm[2]}` : fm[2],
        className:   cls,
        inputs:      fm[3]?.trim() || '',
        outputs:     fm[4]?.trim() || '',
      });
    }
  }
  return results;
}

// GDScript — same indentation model as Python but uses 'func' instead of 'def'
function scanGDScript(code) {
  const lines = code.split('\n');
  const results = [];
  const classStack = [];
  for (const line of lines) {
    const cm = line.match(/^([ \t]*)class\s+(\w+)/);
    if (cm) {
      const indent = cm[1].length;
      while (classStack.length && classStack.at(-1).indent >= indent) classStack.pop();
      classStack.push({ name: cm[2], indent });
      results.push({ type:'class', name: cm[2], displayName: cm[2], formName: cm[2],
        className: null, inputs: '', outputs: 'instance' });
      continue;
    }
    // Enum: `enum NAME { ... }` — single-line or block, just detect the name
    const em = line.match(/^([ \t]*)enum\s+(\w+)/);
    if (em) {
      results.push({ type:'enum', name: em[2], displayName: em[2], formName: em[2],
        className: null, inputs: '', outputs: '' });
      continue;
    }
    const fm = line.match(/^([ \t]*)func\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:\n]+))?/);
    if (fm) {
      const fnIndent = fm[1].length;
      while (classStack.length && classStack.at(-1).indent >= fnIndent) classStack.pop();
      const cls = classStack.length ? classStack.at(-1).name : null;
      results.push({
        type:        cls ? 'method' : 'function',
        name:        fm[2],
        displayName: cls ? `${cls}.${fm[2]}` : fm[2],
        formName:    cls ? `${cls} ${fm[2]}` : fm[2],
        className:   cls,
        inputs:      fm[3]?.trim() || '',
        outputs:     fm[4]?.trim() || '',
      });
    }
  }
  return results;
}

function scanRust(code) {
  const results = [];
  const seen    = new Set();
  const clean   = stripCCode(code);   // handles // and /* */ — fine for Rust

  const CTRL       = new Set(['if','else','for','while','loop','match','return','use']);
  const TYPE_BLOCK = new Set(['struct','enum','trait','union','mod','impl','type']);

  let i = 0;
  while (i < clean.length) {
    if (clean[i] !== '{') { i++; continue; }
    const braceAt   = i;
    const lookStart = Math.max(0, braceAt - 500);
    const look      = clean.slice(lookStart, braceAt);

    // Find last ) before { not separated by ; { }
    let rp = look.length - 1;
    while (rp >= 0 && look[rp] !== ')' && look[rp] !== ';'
           && look[rp] !== '{' && look[rp] !== '}') rp--;
    if (rp < 0 || look[rp] !== ')') { i++; continue; }

    const between = look.slice(rp + 1);
    if (/[;{}]/.test(between)) { i++; continue; }
    // Scrub `-> RetType` and `where ...` — should leave only whitespace
    const scrubbed = between
      .replace(/->\s*[^{]+/, '')
      .replace(/\bwhere\b[\s\S]*/, '')
      .trim();
    if (scrubbed) { i++; continue; }

    // Find matching (
    const closeAbs = lookStart + rp;
    let depth = 0, openAbs = -1;
    for (let k = closeAbs; k >= 0; k--) {
      if (clean[k] === ')') depth++;
      else if (clean[k] === '(') { if (!--depth) { openAbs = k; break; } }
    }
    if (openAbs < 0) { i++; continue; }

    const params = clean.slice(openAbs + 1, closeAbs).replace(/\s+/g, ' ').trim();

    let j = openAbs - 1;
    while (j >= 0 && /\s/.test(clean[j])) j--;
    if (j < 0) { i++; continue; }
    // Skip back past a generic parameter list  <T: Clone>  before the (
    if (clean[j] === '>') {
      let depth2 = 0;
      while (j >= 0) {
        if (clean[j] === '>') depth2++;
        else if (clean[j] === '<') { if (!--depth2) { j--; break; } }
        j--;
      }
      while (j >= 0 && /\s/.test(clean[j])) j--;
    }
    if (j < 0) { i++; continue; }
    const nameEnd = j + 1;
    while (j >= 0 && /\w/.test(clean[j])) j--;
    const name = clean.slice(j + 1, nameEnd);
    if (!name || CTRL.has(name) || BLOCK_KEYWORDS.test(name)) { i++; continue; }

    // Return region
    let rtStart = j;
    while (rtStart > 0 && !/[;{}]/.test(clean[rtStart - 1])) rtStart--;
    const retRegion = clean.slice(rtStart, j + 1);

    // Must contain `fn`
    if (!/\bfn\b/.test(retRegion)) { i++; continue; }
    if (TYPE_BLOCK.has(name)) { i++; continue; }

    if (seen.has(name)) { i++; continue; }
    seen.add(name);

    // Output = the `-> RetType` part (before any `where`)
    const retMatch = between.match(/->\s*([\s\S]+?)(?:\s+where\b|$)/);
    const outputs  = retMatch ? retMatch[1].trim() : '';

    results.push({
      type: 'function', name, displayName: name, formName: name,
      className: null, inputs: params, outputs, srcStart: rtStart,
    });
    i++;
  }

  // Struct / enum / trait / type alias detection
  const clsRe = /\b(?:pub(?:\s*\([^)]*\))?\s+)?(struct|enum|trait|union)\s+(\w+)/g;
  let cm;
  while ((cm = clsRe.exec(clean)) !== null) {
    const keyword = cm[1], name = cm[2], key = 'cls:' + name;
    if (!seen.has(key)) {
      seen.add(key);
      const bt = keyword === 'enum' ? 'enum' : keyword === 'trait' ? 'interface' : 'struct';
      results.push({ type:bt, name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'', srcStart:cm.index });
    }
  }
  // type aliases: type Name = ...;
  const typeAliasRe = /\b(?:pub(?:\s*\([^)]*\))?\s+)?type\s+(\w+)(?:\s*<[^>]*>)?\s*=/g;
  while ((cm = typeAliasRe.exec(clean)) !== null) {
    const name = cm[1], key = 'type:' + name;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ type:'type', name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'', srcStart:cm.index });
    }
  }
  // macro_rules! name { ... }
  const macroRe = /\bmacro_rules!\s+(\w+)\s*\{/g;
  while ((cm = macroRe.exec(clean)) !== null) {
    const name = cm[1], key = 'macro:' + name;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ type:'macro', name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'', srcStart:cm.index });
    }
  }
  // impl blocks — shown as 'struct' since they implement a struct/type
  const implRe = /\bimpl(?:\s*<[^>]*>)?\s+(?:[\w:]+\s+for\s+)?([\w]+)/g;
  while ((cm = implRe.exec(clean)) !== null) {
    const raw = 'impl ' + cm[1], key = 'impl:' + cm[1];
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ type:'struct', name:raw, displayName:raw, formName:raw,
        className:null, inputs:'', outputs:'', srcStart:cm.index });
    }
  }

  return results;
}

// ── Strip C/C++ comments, string literals, and preprocessor lines ─
function stripCCode(code) {
  let out = '', i = 0, n = code.length;
  while (i < n) {
    if (code[i] === '/' && code[i+1] === '/') {                      // line comment
      while (i < n && code[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (code[i] === '/' && code[i+1] === '*') {                      // block comment
      out += '  '; i += 2;
      while (i < n-1 && !(code[i] === '*' && code[i+1] === '/')) {
        out += code[i] === '\n' ? '\n' : ' '; i++;
      }
      out += '  '; i += 2; continue;
    }
    if (code[i] === '"') {                                            // string literal
      out += '"'; i++;
      while (i < n && code[i] !== '"') {
        if (code[i] === '\\') { out += '  '; i += 2; continue; }
        out += code[i] === '\n' ? '\n' : ' '; i++;
      }
      out += '"'; i++; continue;
    }
    if (code[i] === "'") {                                            // char literal
      out += "'"; i++;
      while (i < n && code[i] !== "'") {
        if (code[i] === '\\') { out += '  '; i += 2; continue; }
        out += ' '; i++;
      }
      out += "'"; i++; continue;
    }
    if (code[i] === '#' && (i === 0 || code[i-1] === '\n')) {        // preprocessor
      while (i < n) {
        if (code[i] === '\n') { const cont = code[i-1] === '\\'; out += '\n'; i++; if (!cont) break; }
        else { out += ' '; i++; }
      }
      continue;
    }
    out += code[i++];
  }
  return out;
}

// ── C / C++ / GLSL / HLSL / WGSL scanner ──────────────────────────
function scanClike(code) {
  const results = [];
  const seen    = new Set();

  // ── Pre-pass: #define macros (raw code, before stripCCode removes # lines) ──
  const macroDefRe = /^[ \t]*#define\s+(\w+)(\([^)]*\))?[^\n]*/gm;
  let mpre;
  while ((mpre = macroDefRe.exec(code)) !== null) {
    const name = mpre[1];
    if (!name || BLOCK_KEYWORDS.test(name) || seen.has(name)) continue;
    seen.add(name);
    results.push({
      type:'macro', name, displayName:name, formName:name, className:null,
      inputs: mpre[2] ? mpre[2].slice(1,-1).trim() : '',
      outputs: '', srcStart: mpre.index,
    });
  }

  const clean   = stripCCode(code);

  // Non-function keywords that appear before (
  const CTRL = new Set([
    'if','else','for','while','do','switch','catch','return',
    'sizeof','alignof','typeof','decltype','throw','case',
  ]);
  // Keywords that open type-definition blocks (not function bodies)
  const TYPE_BLOCK = new Set(['struct','union','enum','namespace']);

  let i = 0;
  while (i < clean.length) {
    if (clean[i] !== '{') { i++; continue; }
    const braceAt = i;

    // ── Look back ≤500 chars for ) … name(params) ─────────────
    const lookStart = Math.max(0, braceAt - 500);
    const look      = clean.slice(lookStart, braceAt);

    // Find last ) not separated from { by ; or another brace
    let rp = look.length - 1;
    while (rp >= 0 && look[rp] !== ')' && look[rp] !== ';'
           && look[rp] !== '{' && look[rp] !== '}') rp--;
    if (rp < 0 || look[rp] !== ')') { i++; continue; }

    // Between ) and { must be only qualifiers / trailing return / init list — no ; or {
    const between = look.slice(rp + 1);
    if (/[;{}]/.test(between)) { i++; continue; }
    const scrubbed = between
      .replace(/\b(const|volatile|override|final|noexcept|explicit)\b\s*/g, '')
      .replace(/->\s*[\w\s:*&<>[\],]+/, '')    // trailing return type (e.g. -> int)
      .replace(/=\s*0\s*/, '')                  // pure virtual: = 0
      .replace(/:\s*[^{]*/, '')                 // constructor initialiser list
      .trim();
    if (scrubbed && !/^\w*$/.test(scrubbed)) { i++; continue; }

    // ── Find matching ( scanning backwards ────────────────────
    const closeAbs = lookStart + rp;
    let depth = 0, openAbs = -1;
    for (let k = closeAbs; k >= 0; k--) {
      if (clean[k] === ')') depth++;
      else if (clean[k] === '(') { if (!--depth) { openAbs = k; break; } }
    }
    if (openAbs < 0) { i++; continue; }

    const params = clean.slice(openAbs + 1, closeAbs).replace(/\s+/g, ' ').trim();

    // ── Name: the word (or qualified word) right before ( ─────
    let j = openAbs - 1;
    while (j >= 0 && /\s/.test(clean[j])) j--;
    if (j < 0) { i++; continue; }
    const nameEnd = j + 1;
    while (j >= 0 && /[\w:~]/.test(clean[j])) j--;
    const rawName = clean.slice(j + 1, nameEnd);
    if (!rawName) { i++; continue; }

    const shortName = rawName.split('::').pop().replace(/^~/, '');
    if (!shortName || CTRL.has(shortName) || BLOCK_KEYWORDS.test(shortName)) { i++; continue; }

    // ── Return type: back to previous statement boundary ──────
    let rtStart = j;
    while (rtStart > 0 && !/[;{}]/.test(clean[rtStart - 1])) rtStart--;
    const retRegion = clean.slice(rtStart, j + 1);

    // If retRegion contains '(' the name is inside an init-list or expression, not a function
    if (retRegion.includes('(')) { i++; continue; }
    // Skip if the return region is a type-block definition or control statement
    const retToks = retRegion.trim().split(/\W+/).filter(Boolean);
    if (retToks.some(w => TYPE_BLOCK.has(w) || CTRL.has(w))) { i++; continue; }
    const lastRet = retToks[retToks.length - 1] || '';
    if (CTRL.has(lastRet) || TYPE_BLOCK.has(lastRet)) { i++; continue; }

    if (seen.has(rawName)) { i++; continue; }
    seen.add(rawName);

    // Strip storage/linkage specifiers from the return type display
    const retType = retRegion
      .replace(/template\s*<[^>]*>/g, '')
      .replace(/\b(static|inline|virtual|explicit|constexpr|consteval|constinit|extern|friend)\b\s*/g, '')
      .trim();

    const colonParts = rawName.split('::');
    const hasQual    = colonParts.length > 1;
    const className  = hasQual ? colonParts.slice(0, -1).join('::') : null;

    results.push({
      type:        className ? 'method' : 'function',
      name:        shortName,
      displayName: hasQual ? rawName : shortName,
      formName:    hasQual ? rawName.replace(/::/g, ' ') : shortName,
      className,
      inputs:      params,
      outputs:     retType,
      srcStart:    rtStart,
    });

    i++;
  }

  // ── Named type definitions (separate pass) ────────────────
  // class (C++ only), struct (C/C++/GLSL/HLSL/WGSL), enum, enum class (C++), cbuffer/tbuffer (HLSL)
  const clsRe = /\b(class|struct|enum(?:\s+class)?|cbuffer|tbuffer)\s+(\w+)\s*([^{;]*)\{/g;
  let cm;
  while ((cm = clsRe.exec(clean)) !== null) {
    const keyword = cm[1].trim(), name = cm[2], beforeBrace = cm[3];
    // Skip if before-brace contains ( → it's a function, not a type
    // Exception: cbuffer/tbuffer allow a register(...) semantic qualifier
    const cleanBefore = (keyword === 'cbuffer' || keyword === 'tbuffer')
      ? beforeBrace.replace(/:\s*register\s*\([^)]*\)/g, '')
      : beforeBrace;
    if (cleanBefore.includes('(') || cleanBefore.includes(';')) continue;
    const key = 'cls:' + name;
    if (!seen.has(key)) {
      seen.add(key);
      const bt = keyword === 'class'              ? 'class'
               : keyword.startsWith('enum')       ? 'enum'
               : keyword === 'cbuffer' || keyword === 'tbuffer' ? 'struct'
               : 'struct';  // struct, union
      results.push({
        type: bt, name, displayName: name, formName: name,
        className: null, inputs: '', outputs: bt === 'class' ? 'instance' : '', srcStart: cm.index,
      });
    }
  }

  return results;
}

// ── Java scanner ──────────────────────────────────────────────
function scanJava(code) {
  const results = [];
  const seen    = new Set();
  const clean   = stripCCode(code);   // Java uses the same comment/string syntax as C

  const CTRL      = new Set(['if','else','for','while','do','switch','catch','try','finally','return','synchronized','throw']);
  const TYPE_BLOCK = new Set(['class','interface','enum','record','@interface']);
  const MODS      = /\b(public|private|protected|static|final|abstract|synchronized|native|strictfp|default|transient|volatile)\b\s*/g;

  let i = 0;
  while (i < clean.length) {
    if (clean[i] !== '{') { i++; continue; }
    const braceAt   = i;
    const lookStart = Math.max(0, braceAt - 500);
    const look      = clean.slice(lookStart, braceAt);

    let rp = look.length - 1;
    while (rp >= 0 && look[rp] !== ')' && look[rp] !== ';'
           && look[rp] !== '{' && look[rp] !== '}') rp--;
    if (rp < 0 || look[rp] !== ')') { i++; continue; }

    const between = look.slice(rp + 1);
    if (/[;{}]/.test(between)) { i++; continue; }
    // Scrub `throws X, Y` clause between ) and {
    const scrubbed = between.replace(/\bthrows\b[\w\s,.<>]*/g, '').trim();
    if (scrubbed) { i++; continue; }

    const closeAbs = lookStart + rp;
    let depth = 0, openAbs = -1;
    for (let k = closeAbs; k >= 0; k--) {
      if (clean[k] === ')') depth++;
      else if (clean[k] === '(') { if (!--depth) { openAbs = k; break; } }
    }
    if (openAbs < 0) { i++; continue; }

    const params = clean.slice(openAbs + 1, closeAbs).replace(/\s+/g, ' ').trim();

    // Name right before ( — skip any trailing generic <T> list
    let j = openAbs - 1;
    while (j >= 0 && /\s/.test(clean[j])) j--;
    if (j < 0) { i++; continue; }
    if (clean[j] === '>') {                        // skip <T extends Foo, ...>
      let d = 0;
      while (j >= 0) {
        if (clean[j] === '>') d++;
        else if (clean[j] === '<') { if (!--d) { j--; break; } }
        j--;
      }
      while (j >= 0 && /\s/.test(clean[j])) j--;
    }
    const nameEnd = j + 1;
    while (j >= 0 && /\w/.test(clean[j])) j--;
    const name = clean.slice(j + 1, nameEnd);
    if (!name || CTRL.has(name) || BLOCK_KEYWORDS.test(name)) { i++; continue; }

    let rtStart = j;
    while (rtStart > 0 && !/[;{}]/.test(clean[rtStart - 1])) rtStart--;
    const retRegion = clean.slice(rtStart, j + 1);

    const retToks = retRegion.trim().split(/\W+/).filter(Boolean);
    if (retToks.some(w => TYPE_BLOCK.has(w) || CTRL.has(w))) { i++; continue; }

    if (seen.has(name)) { i++; continue; }
    seen.add(name);

    const retType = retRegion.replace(MODS, '').trim();
    results.push({
      type:'function', name, displayName:name, formName:name,
      className:null, inputs:params, outputs:retType, srcStart:rtStart,
    });
    i++;
  }

  // class / interface / enum / record / @interface (annotation type) — distinct types
  const clsRe = /\b(class|(?:@\s*)?interface|enum|record)\s+(\w+)/g;
  let cm;
  while ((cm = clsRe.exec(clean)) !== null) {
    const keyword = cm[1], name = cm[2], key = 'cls:' + name;
    if (!seen.has(key)) {
      seen.add(key);
      const bt = keyword === 'enum' ? 'enum' : keyword === 'interface' ? 'interface' : 'class';
      results.push({ type:bt, name, displayName:name, formName:name,
        className:null, inputs:'', outputs:bt==='class'?'instance':'', srcStart:cm.index });
    }
  }
  return results;
}

// ── C# scanner ────────────────────────────────────────────────
function scanCSharp(code) {
  const results = [];
  const seen    = new Set();
  const clean   = stripCCode(code);

  const CTRL      = new Set(['if','else','for','foreach','while','do','switch','catch','try','finally','return','lock','using','checked','unchecked','throw']);
  const TYPE_BLOCK = new Set(['class','interface','struct','record','enum','namespace']);
  const MODS      = /\b(public|private|protected|internal|static|abstract|virtual|override|sealed|async|unsafe|extern|partial|readonly|new)\b\s*/g;

  let i = 0;
  while (i < clean.length) {
    if (clean[i] !== '{') { i++; continue; }
    const braceAt   = i;
    const lookStart = Math.max(0, braceAt - 600);
    const look      = clean.slice(lookStart, braceAt);

    let rp = look.length - 1;
    while (rp >= 0 && look[rp] !== ')' && look[rp] !== ';'
           && look[rp] !== '{' && look[rp] !== '}') rp--;
    if (rp < 0 || look[rp] !== ')') { i++; continue; }

    const between = look.slice(rp + 1);
    if (/[;{}]/.test(between)) { i++; continue; }
    // Scrub C# `where T : class, new()` constraints
    const scrubbed = between.replace(/\bwhere\b[\s\S]*/g, '').trim();
    if (scrubbed) { i++; continue; }

    const closeAbs = lookStart + rp;
    let depth = 0, openAbs = -1;
    for (let k = closeAbs; k >= 0; k--) {
      if (clean[k] === ')') depth++;
      else if (clean[k] === '(') { if (!--depth) { openAbs = k; break; } }
    }
    if (openAbs < 0) { i++; continue; }

    const params = clean.slice(openAbs + 1, closeAbs).replace(/\s+/g, ' ').trim();

    // Name right before ( — skip trailing generic <T> list
    let j = openAbs - 1;
    while (j >= 0 && /\s/.test(clean[j])) j--;
    if (j < 0) { i++; continue; }
    if (clean[j] === '>') {
      let d = 0;
      while (j >= 0) {
        if (clean[j] === '>') d++;
        else if (clean[j] === '<') { if (!--d) { j--; break; } }
        j--;
      }
      while (j >= 0 && /\s/.test(clean[j])) j--;
    }
    const nameEnd = j + 1;
    // Allow dot for explicit interface impl: IFoo.Method
    while (j >= 0 && /[\w.]/.test(clean[j])) j--;
    const rawName = clean.slice(j + 1, nameEnd);
    const name    = rawName.split('.').pop();
    if (!name || CTRL.has(name) || BLOCK_KEYWORDS.test(name)) { i++; continue; }

    let rtStart = j;
    while (rtStart > 0 && !/[;{}]/.test(clean[rtStart - 1])) rtStart--;
    // Strip [Attribute] annotations from the return region before checking
    const retRegion = clean.slice(rtStart, j + 1).replace(/\[[^\]]*\]\s*/g, '');

    const retToks = retRegion.trim().split(/\W+/).filter(Boolean);
    if (retToks.some(w => TYPE_BLOCK.has(w) || CTRL.has(w))) { i++; continue; }

    if (seen.has(rawName)) { i++; continue; }
    seen.add(rawName);

    const retType = retRegion.replace(MODS, '').trim();
    results.push({
      type:'function', name, displayName:rawName, formName:rawName.replace(/\./g,' '),
      className:null, inputs:params, outputs:retType, srcStart:rtStart,
    });
    i++;
  }

  // class / interface / struct / record / enum — distinct types
  const clsRe = /\b(class|interface|struct|record|enum)\s+(\w+)/g;
  let cm;
  while ((cm = clsRe.exec(clean)) !== null) {
    const keyword = cm[1], name = cm[2], key = 'cls:' + name;
    if (!seen.has(key)) {
      seen.add(key);
      const bt = keyword === 'enum'      ? 'enum'
               : keyword === 'interface' ? 'interface'
               : keyword === 'struct'    ? 'struct'
               : 'class';   // class, record
      results.push({ type:bt, name, displayName:name, formName:name,
        className:null, inputs:'', outputs:bt==='class'?'instance':'', srcStart:cm.index });
    }
  }
  return results;
}

// ── Zig scanner ────────────────────────────────────────────────
function scanZig(code) {
  const results = [];
  const seen    = new Set();
  // Zig has only // line comments (no block comments)
  const clean = code.replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));

  // fn name(params) ReturnType { — return type sits between ) and {
  const fnRe = /\bfn\s+(\w+)\s*\(([^)]*)\)\s*([^{]*?)\s*\{/g;
  let m;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name) || BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({
      type:'function', name, displayName:name, formName:name,
      className:null,
      inputs:  m[2]?.trim() || '',
      outputs: m[3]?.trim() || '',
      srcStart: m.index,
    });
  }

  // pub? const Name = struct/union/enum/opaque { ... }
  const clsRe = /\b(?:pub\s+)?const\s+(\w+)\s*=\s*(struct|union|enum|opaque)\s*\{/g;
  let cm;
  while ((cm = clsRe.exec(clean)) !== null) {
    const name = cm[1], keyword = cm[2], key = 'cls:' + name;
    if (!seen.has(key)) {
      seen.add(key);
      const bt = keyword === 'enum' ? 'enum' : 'struct';
      results.push({ type:bt, name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'', srcStart:cm.index });
    }
  }
  return results;
}

function scanGo(code) {
  const results = [];
  const seen    = new Set();
  // Strip comments
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

  // func declarations (including receiver methods)
  const fnRe = /\bfunc\s+(?:\([^)]+\)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*(?:\(([^)]+)\)|(\w[\w\s*,[\]]*)))?\s*\{/g;
  let m;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name) || BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name,
      className:null, inputs: m[2]?.trim()||'', outputs: (m[3]||m[4]||'').trim(), srcStart: m.index });
  }

  // type Name struct / type Name interface
  const typeRe = /\btype\s+(\w+)\s+(struct|interface)\s*\{/g;
  let cm;
  while ((cm = typeRe.exec(clean)) !== null) {
    const name = cm[1], keyword = cm[2], key = 'cls:' + name;
    if (!seen.has(key)) {
      seen.add(key);
      const bt = keyword === 'interface' ? 'interface' : 'struct';
      results.push({ type:bt, name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'',
        srcStart: cm.index });
    }
  }

  // type aliases: type Name = OtherType (no brace — simple assignment)
  const aliasRe = /\btype\s+(\w+)\s*=\s*\S/g;
  while ((cm = aliasRe.exec(clean)) !== null) {
    const name = cm[1], key = 'type:' + name;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ type:'type', name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'', srcStart:cm.index });
    }
  }

  return results;
}

function scanLua(code) {
  const results = [];
  const seen    = new Set();
  // Strip Lua comments: --[[ long ]] and -- line
  const clean = code
    .replace(/--\[\[[\s\S]*?\]\]/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g,           m => ' '.repeat(m.length));

  // All declaration forms:
  //   function name(...)         global function
  //   local function name(...)   local function
  //   function Cls:method(...)   colon-method
  //   function Cls.method(...)   dot-method
  //   name = function(...)       assignment form
  //   Cls.method = function(...) assignment form
  const re = /(?:(?:local\s+)?function\s+([\w.:]+)\s*\(([^)]*)\)|([\w.:]+)\s*=\s*function\s*\(([^)]*)\))/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const rawName = m[1] || m[3];
    const params  = (m[2] ?? m[4] ?? '').trim();
    if (!rawName || seen.has(rawName)) continue;
    seen.add(rawName);

    const hasColon = rawName.includes(':');
    const hasDot   = !hasColon && rawName.lastIndexOf('.') > 0;
    const name     = rawName.split(/[.:]/).pop();
    const className = (hasColon || hasDot)
      ? rawName.slice(0, rawName.lastIndexOf(hasColon ? ':' : '.'))
      : null;

    results.push({
      type:        className ? 'method' : 'function',
      name,
      displayName: rawName,
      formName:    rawName.replace(/[.:]/g, ' '),
      className,
      inputs:      params,
      outputs:     '',
      srcStart:    m.index,
    });
  }
  return results;
}

// ── Shell / Bash scanner ──────────────────────────────────────
function scanShell(code) {
  const results = [];
  const seen    = new Set();
  // Strip comments (# to end-of-line; shebang becomes spaces too — that's fine)
  const clean = code.replace(/#[^\n]*/g, m => ' '.repeat(m.length));

  // Both syntaxes:  name() {   and   function name() {
  const re = /^[ \t]*(?:function\s+)?(\w[\w-]*)\s*\(\s*\)\s*\{/gm;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name) || BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({
      type: 'function', name, displayName: name, formName: name,
      className: null, inputs: '', outputs: '', srcStart: m.index,
    });
  }
  // alias name='...'  or  alias name="..."
  const aliasRe = /^[ \t]*alias\s+([\w-]+)=/gm;
  while ((m = aliasRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name) || BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({
      type: 'macro', name, displayName: name, formName: name,
      className: null, inputs: '', outputs: '', srcStart: m.index,
    });
  }
  return results;
}

// ── CSS scanner ────────────────────────────────────────────────
// HTML has no function-like constructs so is a whole-file-only language.
// CSS is scanned for @keyframes (animations) and @layer (cascade layers).
function scanCSS(code) {
  const results = [];
  const seen    = new Set();
  const clean   = code.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;

  // @keyframes name { … }
  const kfRe = /@keyframes\s+([\w-]+)\s*\{/g;
  while ((m = kfRe.exec(clean)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({ type:'function', name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'animation', srcStart:m.index });
    }
  }

  // @layer name { … } — a cascade layer, not a class
  const layerRe = /@layer\s+([\w.-]+)\s*\{/g;
  while ((m = layerRe.exec(clean)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({ type:'module', name, displayName:name, formName:name,
        className:null, inputs:'', outputs:'', srcStart:m.index });
    }
  }

  return results;
}

// ── SCSS / SASS scanner ───────────────────────────────────────
// Handles @mixin, @function, and %placeholder blocks.
// Reused for both .scss and .sass files (most .sass files use SCSS syntax).
function scanSCSS(code) {
  const results = [];
  const seen    = new Set();
  const clean   = code
    .replace(/\/\/[^\n]*/g,          m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g,    m => m.replace(/[^\n]/g, ' '));
  let m;

  // @mixin name[(args)] {
  const mixinRe = /@mixin\s+([\w-]+)\s*(?:\(([^)]*)\))?\s*\{/g;
  while ((m = mixinRe.exec(clean)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({ type:'function', name, displayName:name, formName:name,
        className:null, inputs:m[2]?.trim()||'', outputs:'mixin', srcStart:m.index });
    }
  }

  // @function name(args) {
  const fnRe = /@function\s+([\w-]+)\s*\(([^)]*)\)\s*\{/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({ type:'function', name, displayName:name, formName:name,
        className:null, inputs:m[2]?.trim()||'', outputs:'', srcStart:m.index });
    }
  }

  // %placeholder { — extend placeholders (abstract reusable CSS rule sets)
  const phRe = /%(\w[\w-]*)\s*\{/g;
  while ((m = phRe.exec(clean)) !== null) {
    const name = '%' + m[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({ type:'other', name, displayName:name, formName:m[1],
        className:null, inputs:'', outputs:'', srcStart:m.index });
    }
  }

  return results;
}

// ── SQL scanner ───────────────────────────────────────────────
// Detects DDL statements: PROCEDURE/FUNCTION (function), TABLE (struct),
// VIEW (other), TRIGGER (function), TYPE AS ENUM (enum), TYPE AS ... (type).
// Case-insensitive; strips -- and /* */ comments before scanning.
function scanSQL(code) {
  const results = [];
  const seen    = new Set();

  // Strip -- line comments and /* */ block comments (preserve newline positions)
  const clean = code
    .replace(/--[^\n]*/g,          m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g,  m => m.replace(/[^\n]/g, ' '));

  let m;

  // CREATE [OR REPLACE] PROCEDURE name(...)
  // CREATE [OR REPLACE] FUNCTION  name(...)
  const procRe = /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:DEFINER\s*=\s*\S+\s+)?(PROCEDURE|FUNCTION)\s+(\w+)\s*\(([^)]*)\)/gi;
  while ((m = procRe.exec(clean)) !== null) {
    const kw   = m[1].toUpperCase();
    const name = m[2];
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({
      type: 'function', name, displayName: name, formName: name,
      className: null,
      inputs:  m[3]?.trim() || '',
      outputs: kw === 'FUNCTION' ? 'result' : '',
      srcStart: m.index,
    });
  }

  // CREATE [OR REPLACE] [TEMP] VIEW name AS …
  const viewRe = /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP\s+|TEMPORARY\s+)?VIEW\s+(\w+)\s+AS\b/gi;
  while ((m = viewRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({
      type: 'other', name, displayName: name, formName: name,
      className: null, inputs: '', outputs: 'view',
      srcStart: m.index,
    });
  }

  // CREATE [OR REPLACE] [CONSTRAINT] TRIGGER name …
  const trigRe = /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+(\w+)\b/gi;
  while ((m = trigRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({
      type: 'function', name, displayName: name, formName: name,
      className: null, inputs: '', outputs: 'trigger',
      srcStart: m.index,
    });
  }

  // CREATE [TEMP[ORARY]] TABLE [IF NOT EXISTS] name (…)
  const tableRe = /\bCREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(/gi;
  while ((m = tableRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({
      type: 'struct', name, displayName: name, formName: name,
      className: null, inputs: '', outputs: '',
      srcStart: m.index,
    });
  }

  // CREATE TYPE name AS ENUM (…)  → enum
  // CREATE TYPE name AS (…)       → type  (composite)
  // CREATE TYPE name AS RANGE …   → type
  const typeRe = /\bCREATE\s+TYPE\s+(\w+)\s+AS\s+(ENUM|RANGE|\()/gi;
  while ((m = typeRe.exec(clean)) !== null) {
    const name = m[1];
    const kind = m[2].toUpperCase();
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({
      type: kind === 'ENUM' ? 'enum' : 'type',
      name, displayName: name, formName: name,
      className: null, inputs: '', outputs: '',
      srcStart: m.index,
    });
  }

  return results;
}

// ── Kotlin scanner ────────────────────────────────────────────
function scanKotlin(code) {
  const results = [], seen = new Set();
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;
  // fun [<generics>] [Receiver.]name(
  const fnRe = /\bfun\s+(?:<[^>]*>\s+)?(?:(\w+)\.)?([\w`]+)\s*(?:<[^>]*>)?\s*\(/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const cls = m[1]||null, name = m[2];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type: cls?'method':'function', name, displayName: cls?`${cls}.${name}`:name,
      formName: cls?`${cls} ${name}`:name, className:cls, inputs:'', outputs:'', srcStart:m.index });
  }
  const clsRe = /\b(?:(?:data|open|abstract|sealed|inner|value)\s+)?class\s+(\w+)/g;
  while ((m = clsRe.exec(clean)) !== null) {
    const name = m[1], k='cls:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const objRe = /\bobject\s+(\w+)/g;
  while ((m = objRe.exec(clean)) !== null) {
    const name = m[1], k='cls:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const ifRe = /\binterface\s+(\w+)/g;
  while ((m = ifRe.exec(clean)) !== null) {
    const name = m[1], k='iface:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const enRe = /\benum\s+class\s+(\w+)/g;
  while ((m = enRe.exec(clean)) !== null) {
    const name = m[1], k='enum:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'enum', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const taRe = /\btypealias\s+(\w+)/g;
  while ((m = taRe.exec(clean)) !== null) {
    const name = m[1], k='type:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'type', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Swift scanner ─────────────────────────────────────────────
function scanSwift(code) {
  const results = [], seen = new Set();
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;
  const fnRe = /\bfunc\s+(\w+)\s*(?:<[^>]*>)?\s*\(/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  const clsRe = /\b(class|actor)\s+(\w+)/g;
  while ((m = clsRe.exec(clean)) !== null) {
    const name = m[2], k='cls:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const stRe = /\bstruct\s+(\w+)/g;
  while ((m = stRe.exec(clean)) !== null) {
    const name = m[1], k='struct:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'struct', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const prRe = /\bprotocol\s+(\w+)/g;
  while ((m = prRe.exec(clean)) !== null) {
    const name = m[1], k='proto:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const enRe = /\benum\s+(\w+)/g;
  while ((m = enRe.exec(clean)) !== null) {
    const name = m[1], k='enum:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'enum', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const taRe = /\btypealias\s+(\w+)/g;
  while ((m = taRe.exec(clean)) !== null) {
    const name = m[1], k='type:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'type', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const exRe = /\bextension\s+(\w+)/g;
  while ((m = exRe.exec(clean)) !== null) {
    const name = 'ext '+m[1], k='ext:'+m[1];
    if (!seen.has(k)) { seen.add(k); results.push({ type:'struct', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Ruby scanner (keyword-depth, end-based) ───────────────────
function scanRuby(code) {
  const results = [], seen = new Set();
  const clean = code.replace(/#[^\n]*/g, m => ' '.repeat(m.length));
  const lines  = clean.split('\n');
  let classCtx = null, depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mDef   = line.match(/^[ \t]*def\s+(self\.)?(\w+[?!]?)/);
    const mClass = line.match(/^[ \t]*class\s+(\w+)/);
    const mMod   = line.match(/^[ \t]*module\s+(\w+)/);
    const mEnd   = line.match(/^[ \t]*end\b/);
    const opens  = (line.match(/\b(def|class|module|do|if|unless|while|until|for|begin|case|rescue)\b/g)||[]).length;
    const closes = (line.match(/\bend\b/g)||[]).length;
    if (mClass) {
      const name = mClass[1];
      if (!seen.has('cls:'+name)) { seen.add('cls:'+name); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'' }); }
      classCtx = name; depth = 0;
    } else if (mMod) {
      const name = mMod[1];
      if (!seen.has('mod:'+name)) { seen.add('mod:'+name); results.push({ type:'module', name, displayName:name, formName:name, className:null, inputs:'', outputs:'' }); }
    } else if (mDef) {
      const name = mDef[2];
      const cls  = classCtx && depth === 0 ? classCtx : null;
      const key  = (cls||'') + ':' + name;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ type: cls?'method':'function', name, displayName: cls?`${cls}#${name}`:name,
          formName: cls?`${cls} ${name}`:name, className:cls, inputs:'', outputs:'' });
      }
    }
    depth += opens - closes;
    if (mEnd && depth < 0) { classCtx = null; depth = 0; }
  }
  return results;
}

// ── PHP scanner ───────────────────────────────────────────────
function scanPHP(code) {
  const results = [], seen = new Set();
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/#[^\n]*/g,          m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;
  const fnRe = /\bfunction\s+(\w+)\s*\(/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  const clsRe = /\b(?:abstract\s+|final\s+)?class\s+(\w+)/g;
  while ((m = clsRe.exec(clean)) !== null) {
    const name = m[1], k='cls:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const ifRe = /\binterface\s+(\w+)/g;
  while ((m = ifRe.exec(clean)) !== null) {
    const name = m[1], k='iface:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const trRe = /\btrait\s+(\w+)/g;
  while ((m = trRe.exec(clean)) !== null) {
    const name = m[1], k='trait:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const enRe = /\benum\s+(\w+)/g;
  while ((m = enRe.exec(clean)) !== null) {
    const name = m[1], k='enum:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'enum', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Dart scanner ──────────────────────────────────────────────
function scanDart(code) {
  const results = [], seen = new Set();
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;
  // Function: ReturnType name(...) or just name(...)
  // Detect by brace-back — use scanClike-compatible pattern: name followed by ( before {
  const fnRe = /\b(?:async\s+)?(?:[\w<>?,\s]+\s+)?(\w+)\s*\(([^)]*)\)\s*(?:async\s*)?\{/g;
  const DART_KW = new Set(['if','for','while','switch','catch','class','mixin','extension','enum','factory','assert','do']);
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)||DART_KW.has(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:m[2]?.trim()||'', outputs:'', srcStart:m.index });
  }
  const clsRe = /\b(?:abstract\s+)?class\s+(\w+)/g;
  while ((m = clsRe.exec(clean)) !== null) {
    const name = m[1], k='cls:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const mxRe = /\bmixin\s+(\w+)/g;
  while ((m = mxRe.exec(clean)) !== null) {
    const name = m[1], k='mixin:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const enRe = /\benum\s+(\w+)/g;
  while ((m = enRe.exec(clean)) !== null) {
    const name = m[1], k='enum:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'enum', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const exRe = /\bextension\s+(\w+)\s+on\b/g;
  while ((m = exRe.exec(clean)) !== null) {
    const name = m[1], k='ext:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'struct', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Scala scanner ─────────────────────────────────────────────
function scanScala(code) {
  const results = [], seen = new Set();
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;
  const fnRe = /\bdef\s+(\w+)\s*(?:\[[^\]]*\])?\s*\(/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  const clsRe = /\b(?:(?:case|abstract|sealed|open|final)\s+)?class\s+(\w+)/g;
  while ((m = clsRe.exec(clean)) !== null) {
    const kw = code.slice(m.index, m.index+20).match(/case\s+class/);
    const name = m[1], bt = kw?'struct':'class', k=bt+':'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:bt, name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const objRe = /\b(?:case\s+)?object\s+(\w+)/g;
  while ((m = objRe.exec(clean)) !== null) {
    const name = m[1], k='obj:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const trRe = /\b(?:sealed\s+)?trait\s+(\w+)/g;
  while ((m = trRe.exec(clean)) !== null) {
    const name = m[1], k='trait:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const enRe = /\benum\s+(\w+)/g;
  while ((m = enRe.exec(clean)) !== null) {
    const name = m[1], k='enum:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'enum', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const taRe = /\btype\s+(\w+)\s*(?:\[[^\]]*\])?\s*=/g;
  while ((m = taRe.exec(clean)) !== null) {
    const name = m[1], k='type:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'type', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Elixir scanner ────────────────────────────────────────────
function scanElixir(code) {
  const results = [], seen = new Set();
  const clean = code.replace(/#[^\n]*/g, m => ' '.repeat(m.length));
  let m;
  const fnRe = /^\s*defp?\s+(\w+[\?!]?)\s*\(/gm;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  const modRe = /^\s*defmodule\s+([\w.]+)/gm;
  while ((m = modRe.exec(clean)) !== null) {
    const name = m[1], k='mod:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'module', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const proRe = /^\s*defprotocol\s+(\w+)/gm;
  while ((m = proRe.exec(clean)) !== null) {
    const name = m[1], k='proto:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const macRe = /^\s*defmacrop?\s+(\w+)/gm;
  while ((m = macRe.exec(clean)) !== null) {
    const name = m[1], k='mac:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'macro', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const stRe = /^\s*defstruct\b/gm;
  while ((m = stRe.exec(clean)) !== null) {
    // defstruct is anonymous — attach to nearest defmodule
    const before = clean.slice(0, m.index);
    const modMatch = [...before.matchAll(/defmodule\s+([\w.]+)/g)].pop();
    const name = modMatch ? modMatch[1]+'.__struct__' : '__struct__';
    if (!seen.has('struct:'+name)) { seen.add('struct:'+name); results.push({ type:'struct', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── R scanner ─────────────────────────────────────────────────
function scanR(code) {
  const results = [], seen = new Set();
  const clean = code.replace(/#[^\n]*/g, m => ' '.repeat(m.length));
  let m;
  // name <- function(...) or name = function(...)
  const fnRe = /^[ \t]*(\w+)\s*(?:<-|=)\s*function\s*\(([^)]*)\)/gm;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:m[2]?.trim()||'', outputs:'', srcStart:m.index });
  }
  // S4 classes: setClass("Name", ...)
  const clsRe = /\bsetClass\s*\(\s*["'](\w+)["']/g;
  while ((m = clsRe.exec(clean)) !== null) {
    const name = m[1], k='cls:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── PowerShell scanner ────────────────────────────────────────
function scanPowerShell(code) {
  const results = [], seen = new Set();
  const clean = code.replace(/#[^\n]*/g, m => ' '.repeat(m.length));
  let m;
  const fnRe = /\bfunction\s+([\w-]+)\s*(?:\(([^)]*)\))?\s*\{/gi;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:m[2]?.trim()||'', outputs:'', srcStart:m.index });
  }
  const clsRe = /\bclass\s+(\w+)\s*(?::\s*\w+)?\s*\{/g;
  while ((m = clsRe.exec(clean)) !== null) {
    const name = m[1], k='cls:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const enRe = /\benum\s+(\w+)\s*\{/g;
  while ((m = enRe.exec(clean)) !== null) {
    const name = m[1], k='enum:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'enum', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Assembly scanner (NASM/MASM/GAS) ─────────────────────────
// Detects procedure/function declarations and global labels.
function scanAssembly(code) {
  const results = [], seen = new Set();
  // Strip ; comments (NASM/MASM) and @ comments (GAS is // but ; common)
  const clean = code.replace(/;[^\n]*/g, m => ' '.repeat(m.length));
  let m;
  // NASM/MASM: proc name  or  name proc
  const procRe = /^\s*(\w+)\s+proc\b|^\s*proc\s+(\w+)/gmi;
  while ((m = procRe.exec(clean)) !== null) {
    const name = m[1]||m[2];
    if (!seen.has(name)&&!BLOCK_KEYWORDS.test(name)) {
      seen.add(name);
      results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
    }
  }
  // Global/exported labels: global name or section+label
  const globalRe = /^\s*global\s+(\w+)/gm;
  while ((m = globalRe.exec(clean)) !== null) {
    const name = m[1];
    if (!seen.has(name)&&!BLOCK_KEYWORDS.test(name)) {
      seen.add(name);
      results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
    }
  }
  // Top-level labels: name: (at start of line, not local labels starting with .)
  const labelRe = /^(\w+)\s*:/gm;
  while ((m = labelRe.exec(clean)) !== null) {
    const name = m[1];
    if (!seen.has(name)&&!BLOCK_KEYWORDS.test(name)&&!/^\d/.test(name)) {
      seen.add(name);
      results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
    }
  }
  // %macro name  (NASM macros)
  const macRe = /^[ \t]*%macro\s+(\w+)/gm;
  while ((m = macRe.exec(clean)) !== null) {
    const name = m[1], k='mac:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'macro', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // .macro name (GAS)
  const gasMacRe = /^[ \t]*\.macro\s+(\w+)/gm;
  while ((m = gasMacRe.exec(clean)) !== null) {
    const name = m[1], k='mac:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'macro', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // Sections (data, text, bss): treat as module
  const secRe = /^\s*(?:section|segment|\.section)\s+[\.\w]+\s*(?:;.*)?$/gm;
  const secsSeen = new Set();
  while ((m = secRe.exec(code)) !== null) {
    const name = m[0].trim().split(/\s+/)[1];
    if (!secsSeen.has(name)) { secsSeen.add(name); results.push({ type:'module', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Nim scanner (indent-based) ────────────────────────────────
function scanNim(code) {
  const results = [], seen = new Set();
  const lines = code.split('\n');
  let m;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // proc/func/method/iterator: proc name(...)
    const fnM = line.match(/^([ \t]*)(?:proc|func|method|iterator|converter)\s+(`?[\w`]+`?)\s*\*?\s*[\(\[<]/);
    if (fnM) {
      const indent = fnM[1].length;
      const name   = fnM[2].replace(/`/g,'');
      const isMethod = indent > 0;
      const key  = (isMethod?'m:':'f:') + name;
      if (!seen.has(key)&&!BLOCK_KEYWORDS.test(name)) {
        seen.add(key);
        results.push({ type:isMethod?'method':'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'' });
      }
      continue;
    }
    // template/macro: macro name(...)
    const macM = line.match(/^[ \t]*(?:template|macro)\s+(`?[\w`]+`?)/);
    if (macM) {
      const name = macM[1].replace(/`/g,''), k='mac:'+name;
      if (!seen.has(k)) { seen.add(k); results.push({ type:'macro', name, displayName:name, formName:name, className:null, inputs:'', outputs:'' }); }
      continue;
    }
    // type block: type followed by indented Name = object/enum/tuple
    if (/^[ \t]*type\s*$/.test(line) || /^[ \t]*type\s+(\w+)/.test(line)) {
      const inlineM = line.match(/^[ \t]*type\s+(\w+)/);
      if (inlineM) {
        // might be "type Name = object" on next line or same line
        const rest = lines.slice(i, i+3).join('\n');
        const objM = rest.match(/type\s+(\w+)\s*(?:\*?)\s*=\s*(object|enum|tuple|ref object|distinct)/);
        if (objM) {
          const name = objM[1], bt = objM[2].includes('enum')?'enum':'struct', k=bt+':'+name;
          if (!seen.has(k)) { seen.add(k); results.push({ type:bt, name, displayName:name, formName:name, className:null, inputs:'', outputs:'' }); }
        }
      } else {
        // multi-line type block: scan next lines for "  Name = object"
        for (let j = i+1; j < lines.length && j < i+30; j++) {
          const tl = lines[j];
          if (!tl.trim()) continue;
          if (!/^[ \t]/.test(tl)) break;
          const typeM = tl.match(/^[ \t]+(\w+)\s*(?:\*?)\s*=\s*(object|enum|tuple|ref object|distinct)/);
          if (typeM) {
            const name = typeM[1], bt = typeM[2].includes('enum')?'enum':'struct', k=bt+':'+name;
            if (!seen.has(k)) { seen.add(k); results.push({ type:bt, name, displayName:name, formName:name, className:null, inputs:'', outputs:'' }); }
          }
        }
      }
    }
  }
  return results;
}

// ── Julia scanner (keyword-depth, end-based) ──────────────────
function scanJulia(code) {
  const results = [], seen = new Set();
  const clean = code.replace(/#[^\n]*/g, m => ' '.repeat(m.length));
  let m;
  // function name(...) ... end
  const fnRe = /\bfunction\s+([\w!]+)\s*\(/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  // Short-form: name(args) = expr
  const shortFnRe = /^[ \t]*(\w+)\s*\([^)]*\)\s*=/gm;
  while ((m = shortFnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)||name==='if') continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  // struct/mutable struct
  const stRe = /\b(?:mutable\s+)?struct\s+(\w+)/g;
  while ((m = stRe.exec(clean)) !== null) {
    const name = m[1], k='struct:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'struct', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // abstract type Name end
  const abRe = /\babstract\s+type\s+(\w+)/g;
  while ((m = abRe.exec(clean)) !== null) {
    const name = m[1], k='type:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'type', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // primitive type Name bits end
  const prRe = /\bprimitive\s+type\s+(\w+)/g;
  while ((m = prRe.exec(clean)) !== null) {
    const name = m[1], k='type:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'type', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // module Name ... end
  const modRe = /\bmodule\s+(\w+)/g;
  while ((m = modRe.exec(clean)) !== null) {
    const name = m[1], k='mod:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'module', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // macro name(...) ... end
  const macRe = /\bmacro\s+(\w+)\s*\(/g;
  while ((m = macRe.exec(clean)) !== null) {
    const name = m[1], k='mac:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'macro', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Perl scanner ──────────────────────────────────────────────
function scanPerl(code) {
  const results = [], seen = new Set();
  const clean = code.replace(/#[^\n]*/g, m => ' '.repeat(m.length));
  let m;
  const fnRe = /\bsub\s+(\w+)\s*(?:\([^)]*\))?\s*\{/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  const pkgRe = /\bpackage\s+([\w:]+)\s*;/g;
  while ((m = pkgRe.exec(clean)) !== null) {
    const name = m[1], k='pkg:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'module', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Crystal scanner (Ruby-like with Rust-influenced types) ────
function scanCrystal(code) {
  const results = [], seen = new Set();
  const clean = code.replace(/#[^\n]*/g, m => ' '.repeat(m.length));
  const lines  = clean.split('\n');
  let classCtx = null, depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mDef  = line.match(/^([ \t]*)(?:private\s+|protected\s+)?def\s+((?:\w+\.)?[\w?!]+)/);
    const mCls  = line.match(/^[ \t]*(?:abstract\s+)?class\s+(\w+)/);
    const mSt   = line.match(/^[ \t]*struct\s+(\w+)/);
    const mMod  = line.match(/^[ \t]*module\s+(\w+)/);
    const mEn   = line.match(/^[ \t]*enum\s+(\w+)/);
    const mMac  = line.match(/^[ \t]*macro\s+(\w+)/);
    const opens = (line.match(/\b(def|class|struct|module|enum|macro|do|if|unless|while|until|for|begin|case)\b/g)||[]).length;
    const closes= (line.match(/\bend\b/g)||[]).length;
    if (mCls) { const n=mCls[1],k='cls:'+n; if (!seen.has(k)) { seen.add(k); results.push({ type:'class',name:n,displayName:n,formName:n,className:null,inputs:'',outputs:'' }); } classCtx=n; depth=0; }
    else if (mSt)  { const n=mSt[1], k='st:'+n; if (!seen.has(k)) { seen.add(k); results.push({ type:'struct',name:n,displayName:n,formName:n,className:null,inputs:'',outputs:'' }); } }
    else if (mMod) { const n=mMod[1],k='mod:'+n; if (!seen.has(k)) { seen.add(k); results.push({ type:'module',name:n,displayName:n,formName:n,className:null,inputs:'',outputs:'' }); } }
    else if (mEn)  { const n=mEn[1], k='en:'+n; if (!seen.has(k)) { seen.add(k); results.push({ type:'enum',name:n,displayName:n,formName:n,className:null,inputs:'',outputs:'' }); } }
    else if (mMac) { const n=mMac[1],k='mac:'+n; if (!seen.has(k)) { seen.add(k); results.push({ type:'macro',name:n,displayName:n,formName:n,className:null,inputs:'',outputs:'' }); } }
    else if (mDef) {
      const raw = mDef[2], cls = classCtx && depth === 0 ? classCtx : null;
      const name = raw.split('.').pop();
      const key = (cls||'')+':'+name;
      if (!seen.has(key)) { seen.add(key); results.push({ type:cls?'method':'function',name,displayName:cls?`${cls}#${name}`:name,formName:cls?`${cls} ${name}`:name,className:cls,inputs:'',outputs:'' }); }
    }
    depth += opens - closes;
    if (depth < 0) { classCtx = null; depth = 0; }
  }
  return results;
}

// ── Odin scanner ──────────────────────────────────────────────
function scanOdin(code) {
  const results = [], seen = new Set();
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;
  // name :: proc(...) or name : proc(...)
  const fnRe = /^[ \t]*(\w+)\s*:[:=]\s*proc\s*\(/gm;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  // Name :: struct { or Name :: union {
  const stRe = /^[ \t]*(\w+)\s*::\s*(struct|union)\s*\{/gm;
  while ((m = stRe.exec(clean)) !== null) {
    const name = m[1], k='struct:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'struct', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // Name :: enum
  const enRe = /^[ \t]*(\w+)\s*::\s*enum\s*(?:\w+\s*)?\{/gm;
  while ((m = enRe.exec(clean)) !== null) {
    const name = m[1], k='enum:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'enum', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Solidity scanner ──────────────────────────────────────────
function scanSolidity(code) {
  const results = [], seen = new Set();
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;
  const fnRe = /\bfunction\s+(\w+)\s*\(/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  const conRe = /\b(?:contract|library)\s+(\w+)/g;
  while ((m = conRe.exec(clean)) !== null) {
    const name = m[1], k='con:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const ifRe = /\binterface\s+(\w+)/g;
  while ((m = ifRe.exec(clean)) !== null) {
    const name = m[1], k='iface:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const stRe = /\bstruct\s+(\w+)/g;
  while ((m = stRe.exec(clean)) !== null) {
    const name = m[1], k='struct:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'struct', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const evRe = /\bevent\s+(\w+)/g;
  while ((m = evRe.exec(clean)) !== null) {
    const name = m[1], k='event:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'other', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const modRe = /\bmodifier\s+(\w+)/g;
  while ((m = modRe.exec(clean)) !== null) {
    const name = m[1], k='mod:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'macro', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const enRe = /\benum\s+(\w+)/g;
  while ((m = enRe.exec(clean)) !== null) {
    const name = m[1], k='enum:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'enum', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Objective-C scanner ───────────────────────────────────────
function scanObjC(code) {
  const results = [], seen = new Set();
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;
  // - (ReturnType)methodName  and  + (ReturnType)classMethod
  const methRe = /^[ \t]*([+-])\s*\([^)]+\)\s*(\w+)/gm;
  while ((m = methRe.exec(clean)) !== null) {
    const sign = m[1], name = m[2];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type: sign==='-'?'method':'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  // @interface ClassName  /  @implementation ClassName
  const ifaceRe = /@interface\s+(\w+)/g;
  while ((m = ifaceRe.exec(clean)) !== null) {
    const name = m[1], k='cls:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // @protocol ProtocolName
  const prRe = /@protocol\s+(\w+)/g;
  while ((m = prRe.exec(clean)) !== null) {
    const name = m[1], k='proto:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // C-style function (Objective-C files can contain plain C functions)
  const fnRe = /^[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*\{/gm;
  const OBJC_KW = new Set(['if','for','while','switch','do']);
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)||OBJC_KW.has(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  return results;
}

// ── VHDL scanner ──────────────────────────────────────────────
function scanVHDL(code) {
  const results = [], seen = new Set();
  // VHDL is case-insensitive; normalise to lower for matching
  const clean = code
    .replace(/--[^\n]*/g, m => ' '.repeat(m.length))
    .toLowerCase();
  let m;
  const entRe = /\bentity\s+(\w+)\s+is\b/g;
  while ((m = entRe.exec(clean)) !== null) {
    const name = m[1], k='ent:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'struct', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const archRe = /\barchitecture\s+(\w+)\s+of\s+(\w+)\s+is\b/g;
  while ((m = archRe.exec(clean)) !== null) {
    const name = m[1]+'_of_'+m[2], k='arch:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const fnRe = /\bfunction\s+(\w+)\s*\(/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  const procRe = /\bprocedure\s+(\w+)\s*\(/g;
  while ((m = procRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  const procBlkRe = /\b([\w]+\s*:\s*)?process\b/g;
  while ((m = procBlkRe.exec(clean)) !== null) {
    const label = (m[1]||'process_'+results.length).replace(/\s*:\s*/,'').trim();
    const name = label, k='proc:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Verilog / SystemVerilog scanner ───────────────────────────
function scanVerilog(code) {
  const results = [], seen = new Set();
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;
  const modRe = /\bmodule\s+(\w+)/g;
  while ((m = modRe.exec(clean)) !== null) {
    const name = m[1], k='mod:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'module', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const fnRe = /\bfunction\s+(?:automatic\s+)?(?:[\w\[\]:]+\s+)?(\w+)\s*\(/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  const taskRe = /\btask\s+(?:automatic\s+)?(\w+)/g;
  while ((m = taskRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  // SystemVerilog: interface Name
  const ifRe = /\binterface\s+(\w+)/g;
  while ((m = ifRe.exec(clean)) !== null) {
    const name = m[1], k='iface:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // class (SystemVerilog)
  const clsRe = /\bclass\s+(\w+)/g;
  while ((m = clsRe.exec(clean)) !== null) {
    const name = m[1], k='cls:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Fortran scanner (case-insensitive) ────────────────────────
function scanFortran(code) {
  const results = [], seen = new Set();
  const clean = code.replace(/![^\n]*/g, m => ' '.repeat(m.length));
  let m;
  const fnRe = /^\s*(?:(?:pure|elemental|recursive|impure)\s+)*(?:[\w()*]+\s+)*(?:function|subroutine)\s+(\w+)\s*\(/gim;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1].toLowerCase();
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  const modRe = /^\s*module\s+(\w+)/gim;
  while ((m = modRe.exec(clean)) !== null) {
    const name = m[1].toLowerCase(), k='mod:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'module', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  const typeRe = /^\s*type(?:\s*,\s*(?:public|private|abstract))?\s*::\s*(\w+)/gim;
  while ((m = typeRe.exec(clean)) !== null) {
    const name = m[1].toLowerCase(), k='type:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'struct', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── Haskell scanner ───────────────────────────────────────────
function scanHaskell(code) {
  const results = [], seen = new Set();
  // Strip -- and {- -} comments
  const clean = code
    .replace(/\{-[\s\S]*?-\}/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g,       m => ' '.repeat(m.length));
  const lines = clean.split('\n');
  let m;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Type signature: name :: Type (signals a top-level definition)
    const sigM = line.match(/^(\w+)\s*::/);
    if (sigM) {
      const name = sigM[1];
      if (!seen.has(name) && /[a-z]/.test(name[0])) {
        seen.add(name);
        results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart: clean.split('\n').slice(0,i).join('\n').length });
      }
    }
    // data Name = ...  (ADT)
    const datM = line.match(/^data\s+(\w+)/);
    if (datM) {
      const name = datM[1], k='data:'+name;
      if (!seen.has(k)) { seen.add(k); results.push({ type:'enum', name, displayName:name, formName:name, className:null, inputs:'', outputs:'' }); }
    }
    // newtype Name = ...
    const newM = line.match(/^newtype\s+(\w+)/);
    if (newM) {
      const name = newM[1], k='newtype:'+name;
      if (!seen.has(k)) { seen.add(k); results.push({ type:'struct', name, displayName:name, formName:name, className:null, inputs:'', outputs:'' }); }
    }
    // type Name = ...  (alias)
    const typM = line.match(/^type\s+(\w+)/);
    if (typM) {
      const name = typM[1], k='type:'+name;
      if (!seen.has(k)) { seen.add(k); results.push({ type:'type', name, displayName:name, formName:name, className:null, inputs:'', outputs:'' }); }
    }
    // class Name where  (typeclass)
    const clsM = line.match(/^class\b.*\b(\w+)\s+\w+\s+where/);
    if (clsM) {
      const name = clsM[1], k='class:'+name;
      if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'' }); }
    }
  }
  return results;
}

// ── OCaml scanner ─────────────────────────────────────────────
function scanOCaml(code) {
  const results = [], seen = new Set();
  const clean = code.replace(/\(\*[\s\S]*?\*\)/g, m => m.replace(/[^\n]/g, ' '));
  let m;
  // let [rec] name args = ...
  const fnRe = /\blet\s+(?:rec\s+)?(\w+)\s+[^=\n]*=/g;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)||name==='_') continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  // type name = ...
  const typeRe = /\btype\s+(?:nonrec\s+)?(\w+)/g;
  while ((m = typeRe.exec(clean)) !== null) {
    const name = m[1], k='type:'+name;
    if (seen.has(k)||name==='_') continue;
    seen.add(k);
    // Look ahead to determine variant
    const after = clean.slice(m.index, m.index + 60);
    const bt = after.includes('|') ? 'enum' : after.includes('{') ? 'struct' : 'type';
    results.push({ type:bt, name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  // module Name = ...  or  module Name : sig
  const modRe = /\bmodule\s+(\w+)\s*(?:=|:)/g;
  while ((m = modRe.exec(clean)) !== null) {
    const name = m[1], k='mod:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'module', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // class name = ...
  const clsRe = /\bclass\s+(?:virtual\s+)?(\w+)/g;
  while ((m = clsRe.exec(clean)) !== null) {
    const name = m[1], k='cls:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'class', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── F# scanner (indent-aware) ─────────────────────────────────
function scanFSharp(code) {
  const results = [], seen = new Set();
  const clean = code.replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
  let m;
  // let [rec] name args = ...
  const fnRe = /^\s*let\s+(?:rec\s+)?(\w+)\s+[^=\n]*=/gm;
  while ((m = fnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name)||BLOCK_KEYWORDS.test(name)||name==='_') continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  // type Name = ...
  const typeRe = /^\s*type\s+(\w+)/gm;
  while ((m = typeRe.exec(clean)) !== null) {
    const name = m[1], k='type:'+name;
    if (seen.has(k)) continue;
    seen.add(k);
    const after = clean.slice(m.index, m.index + 80);
    const bt = after.match(/\|\s*\w/) ? 'enum'
             : after.includes('{')    ? 'struct'
             : 'type';
    results.push({ type:bt, name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index });
  }
  // module [rec] Name
  const modRe = /^\s*module\s+(?:rec\s+)?(\w+)/gm;
  while ((m = modRe.exec(clean)) !== null) {
    const name = m[1], k='mod:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'module', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // member [this.]Name
  const memRe = /^\s*member\s+(?:this\.\w+\s*\.)?\s*(\w+)\s*\(/gm;
  while ((m = memRe.exec(clean)) !== null) {
    const name = m[1], k='mem:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'method', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  // interface IName
  const ifRe = /^\s*(?:interface|type)\s+(I[A-Z]\w+)/gm;
  while ((m = ifRe.exec(clean)) !== null) {
    const name = m[1], k='iface:'+name;
    if (!seen.has(k)) { seen.add(k); results.push({ type:'interface', name, displayName:name, formName:name, className:null, inputs:'', outputs:'', srcStart:m.index }); }
  }
  return results;
}

// ── KQL scanner (Kusto Query Language) ───────────────────────
// Used in Azure Data Explorer, Microsoft Sentinel, Log Analytics.
// Detects: let-bound functions, let aliases/variables, .create function,
// .create table, and .create-or-alter function.
function scanKQL(code) {
  const results = [], seen = new Set();
  // Strip // and /* */ comments
  const clean = code
    .replace(/\/\/[^\n]*/g,       m => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  let m;

  // let name = (params) { ... }   — tabular or scalar function
  // let name = (params) => expr   — scalar shorthand
  const letFnRe = /^\s*let\s+(\w+)\s*=\s*\(/gm;
  while ((m = letFnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name) || BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name,
      className:null, inputs:'', outputs:'', srcStart:m.index });
  }

  // let name = scalar_value / table_expression  (not a function, treat as type alias)
  const letValRe = /^\s*let\s+(\w+)\s*=(?!\s*\()/gm;
  while ((m = letValRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name) || BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'type', name, displayName:name, formName:name,
      className:null, inputs:'', outputs:'', srcStart:m.index });
  }

  // .create [or-replace] function [with (...)] name(params) { ... }
  const createFnRe = /^\s*\.create(?:-or-alter)?\s+function\s+(?:with\s*\([^)]*\)\s+)?(\w+)\s*\(/gmi;
  while ((m = createFnRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has(name) || BLOCK_KEYWORDS.test(name)) continue;
    seen.add(name);
    results.push({ type:'function', name, displayName:name, formName:name,
      className:null, inputs:'', outputs:'', srcStart:m.index });
  }

  // .create [or-replace] table Name (col:type, ...)
  const createTblRe = /^\s*\.create(?:-merge)?\s+table\s+(\w+)\s*\(/gmi;
  while ((m = createTblRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has('tbl:'+name)) continue;
    seen.add('tbl:'+name);
    results.push({ type:'struct', name, displayName:name, formName:name,
      className:null, inputs:'', outputs:'', srcStart:m.index });
  }

  // .create materialized-view Name on table BaseName { ... }
  const matViewRe = /^\s*\.create(?:\s+async)?\s+materialized-view\s+(\w+)\s+on\s+table\s+\w+/gmi;
  while ((m = matViewRe.exec(clean)) !== null) {
    const name = m[1];
    if (seen.has('mv:'+name)) continue;
    seen.add('mv:'+name);
    results.push({ type:'other', name, displayName:name, formName:name,
      className:null, inputs:'', outputs:'view', srcStart:m.index });
  }

  return results;
}

// ── Block source extractors ────────────────────────────────────
function extractBlockSource(code, lang, block) {
  if (!block || !code) return code;
  try {
    if (lang === 'python')   return extractIndented(code, block, 'def');
    if (lang === 'gdscript') return extractIndented(code, block, 'func');
    // All brace-delimited languages — brace-depth counting via extractJsTs
    if (['javascript','typescript','c','cpp',
         'rust','go','java','csharp',
         'glsl','hlsl','wgsl','shell','css','scss','sass',
         'kotlin','swift','php','dart','scala','groovy',
         'zig','d','odin','solidity','objc',
         'powershell','perl','r','kql'].includes(lang)) return extractJsTs(code, block);
    // Expression-body / blank-line–separated languages (no braces, `=>` means typeclass)
    if (['haskell','fsharp','ocaml'].includes(lang)) return extractExpressionBody(code, block);
    if (lang === 'lua') return extractLua(code, block);
    if (lang === 'sql') return extractSQL(code, block);
  } catch { /* fall through */ }
  return code;
}

// Shared extractor for indentation-scoped languages (Python, GDScript)
function extractIndented(code, block, fnKeyword) {
  const lines = code.split('\n');
  // Match either 'class Name' or '<fnKeyword> name('
  const pattern = block.type === 'class'
    ? new RegExp(`^([ \\t]*)class\\s+${block.name}\\b`)
    : new RegExp(`^([ \\t]*)${fnKeyword}\\s+${block.name}\\s*\\(`);
  let startLine = -1, startIndent = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(pattern);
    if (m) { startLine = i; startIndent = m[1].length; break; }
  }
  if (startLine === -1) return code;
  let endLine = lines.length;
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = line.match(/^([ \t]*)/)[1].length;
    if (indent <= startIndent) { endLine = i; break; }
  }
  return lines.slice(startLine, endLine).join('\n').trimEnd();
}

// Extractor for expression-body / blank-line–separated languages:
// Haskell, F#, OCaml — definitions are separated by blank lines, rarely use {}.
// srcStart can land on the blank line before the definition, so we skip leading
// whitespace, then return everything up to the next blank line.
function extractExpressionBody(code, block) {
  if (block.srcStart === undefined) return code;
  const slice = code.slice(block.srcStart);
  const contentStart = slice.search(/\S/);
  if (contentStart < 0) return '';
  const content   = slice.slice(contentStart);
  const blankLine = content.search(/\n[ \t]*\n/);
  return blankLine >= 0 ? content.slice(0, blankLine + 1) : content.trimEnd();
}

function extractJsTs(code, block) {
  if (block.srcStart === undefined) return code;
  const slice = code.slice(block.srcStart);

  const firstBrace = slice.indexOf('{');

  // Arrow expression body (JS/TS): => appears before any {
  const firstArrow = slice.indexOf('=>');
  if (firstArrow >= 0 && (firstBrace < 0 || firstArrow < firstBrace)) {
    const afterArrow = slice.slice(firstArrow + 2).trimStart();
    if (!afterArrow.startsWith('{')) {
      const semi = slice.indexOf(';', firstArrow + 2);
      return semi >= 0 ? slice.slice(0, semi + 1) : slice.trimEnd();
    }
  }

  // No braces at all → single-line expression-body (e.g. R: clamp <- function(...) expr)
  if (firstBrace < 0) {
    const nl = slice.indexOf('\n');
    return nl >= 0 ? slice.slice(0, nl + 1) : slice.trimEnd();
  }

  // Brace is separated by a blank line → it belongs to a later construct,
  // not this function. Return only up to the blank line.
  // Fixes Kotlin/Scala/F# expression-body functions like: fun f(...) = expr\n\nclass C {
  const beforeBrace = slice.slice(0, firstBrace);
  if (/\n[ \t]*\n/.test(beforeBrace)) {
    const blankAt = beforeBrace.search(/\n[ \t]*\n/);
    return slice.slice(0, blankAt + 1);
  }

  // Block body: brace-depth counting (functions, classes, arrow+block)
  let depth = 0, started = false, inStr = false, strCh = '';
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (inStr) { if (c === strCh && slice[i-1] !== '\\') inStr = false; continue; }
    if (c === '/' && slice[i+1] === '/') { while (i < slice.length && slice[i] !== '\n') i++; continue; }
    if (c === '/' && slice[i+1] === '*') { i += 2; while (i < slice.length-1 && !(slice[i]==='*'&&slice[i+1]==='/')) i++; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; continue; }
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return slice.slice(0, i + 1); }
  }
  return slice;
}

// Lua block extractor — keyword-depth counting
// Openers: function, if, for, while, do, repeat
// Closers: end, until
// Note: `for`/`while` always pair their header `do` — we skip that `do`
function extractLua(code, block) {
  if (block.srcStart === undefined) return code;
  const slice = code.slice(block.srcStart);
  // Tokenise: skip strings, long strings, and comments so we only count real keywords
  const tokRe = /--\[\[(=*)\[[\s\S]*?\]\1\]|--[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\[(=*)\[[\s\S]*?\]\2\]|\b(function|if|elseif|else|for|while|do|repeat|then|end|until)\b/g;
  let depth = 0, started = false, pendingDo = false;
  let t;
  while ((t = tokRe.exec(slice)) !== null) {
    const kw = t[3];            // undefined for non-keyword matches (strings/comments)
    if (!kw) continue;
    switch (kw) {
      case 'function': case 'if': case 'repeat':
        depth++; started = true; pendingDo = false; break;
      case 'for': case 'while':
        depth++; started = true; pendingDo = true;  break;
      case 'do':
        if (pendingDo) { pendingDo = false; break; }   // header `do` — don't count
        depth++; started = true; break;
      case 'then': case 'else': case 'elseif':
        pendingDo = false; break;
      case 'end':
        depth--;
        if (started && depth === 0) return slice.slice(0, t.index + 3);
        pendingDo = false; break;
      case 'until':
        depth--;
        if (started && depth === 0) {
          const rest = slice.slice(t.index + 5);
          const nl   = rest.search(/\n/);
          return slice.slice(0, t.index + 5 + (nl >= 0 ? nl : rest.length));
        }
        pendingDo = false; break;
    }
  }
  return slice;
}

// ── SQL block extractor ───────────────────────────────────────
// Walks from srcStart to the first `;` at paren-depth 0 that is not inside
// a string or comment.  Handles: single-quoted strings, -- line comments,
// /* */ block comments, and PostgreSQL $$-quoted strings.
function extractSQL(code, block) {
  if (block.srcStart === undefined) return code;
  const s = code.slice(block.srcStart);
  let i = 0, depth = 0;
  while (i < s.length) {
    const ch = s[i];

    // -- line comment
    if (ch === '-' && s[i + 1] === '-') {
      i += 2;
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    // /* block comment */
    if (ch === '/' && s[i + 1] === '*') {
      i += 2;
      while (i < s.length - 1 && !(s[i] === '*' && s[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // $$ or $tag$ dollar-quoting (PostgreSQL)
    if (ch === '$') {
      const tagEnd = s.indexOf('$', i + 1);
      if (tagEnd >= i + 1) {
        const tag = s.slice(i, tagEnd + 1);          // e.g. "$$" or "$body$"
        const close = s.indexOf(tag, tagEnd + 1);
        i = close >= 0 ? close + tag.length : s.length;
        continue;
      }
    }
    // single-quoted string  '...'  (doubles '' are an escape inside)
    if (ch === "'") {
      i++;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { i += 2; continue; }
        if (s[i] === "'") { i++; break; }
        i++;
      }
      continue;
    }
    // parens — track depth so we don't stop at ';' inside a subquery
    if (ch === '(') { depth++; i++; continue; }
    if (ch === ')') { depth--; i++; continue; }

    // top-level semicolon → end of statement
    if (ch === ';' && depth === 0) {
      return s.slice(0, i + 1).trimEnd();
    }
    i++;
  }
  return s.trimEnd();
}

// ── Batch creation helpers ─────────────────────────────────────
function blockAutoId(block, lang) {
  const ext = LANG_EXT[lang?.toLowerCase()] || '';
  return ext ? `${slugify(block.formName)}-${ext}` : slugify(block.formName);
}

function blockTypeValue(block) {
  return block.type === 'method' ? 'function' : (block.type || 'function');
}

function updateBatchButtons() {
  const hasBatch = modalMode === 'add' && foundBlocks.length > 0;
  $('batch-btns')?.classList.toggle('hidden', !hasBatch);
  // Reflect checked count in the Save Entry button
  const saveBtn = $('modal-save');
  if (!saveBtn) return;
  const n = checkedBlocks.size;
  saveBtn.textContent = (modalMode === 'add' && n > 0) ? `Create ${n} checked` : 'Save Entry';
}

async function makeAll() {
  if (!foundBlocks.length) return;
  const lang   = $('modal-language')?.value?.trim() || '';
  const origin = $('modal-origin')?.value?.trim()   || '';
  const touched = splitList($('modal-touched')?.value || '');
  let created = 0, skipped = 0;
  for (const block of foundBlocks) {
    const id = blockAutoId(block, lang);
    try {
      await api('POST', '/api/entries', {
        id, name: block.formName,
        type: blockTypeValue(block), language: lang,
        status: 'experimental', origin, touched,
        tags: [], contract: '',
        inputs: block.inputs, outputs: block.outputs,
        scars: '', notes: '',
        sourceContent: extractBlockSource(importedFileCode, lang, block),
      });
      created++;
    } catch { skipped++; }
  }
  closeModal();
  await loadEntries();
  showToast(`${created} card${created !== 1 ? 's' : ''} created${skipped ? ` · ${skipped} skipped (duplicate ID)` : ''}`);
}

async function createChecked() {
  if (!checkedBlocks.size) return;
  saveCurrentDraft(); // capture current form state
  const lang = $('modal-language')?.value?.trim() || '';
  let created = 0, skipped = 0;
  for (const block of foundBlocks) {
    if (!checkedBlocks.has(block.displayName)) continue;
    const draft = blockDrafts[block.displayName] || {};
    const name  = draft.name || block.formName;
    const id    = blockAutoId({ formName: name }, lang);
    try {
      await api('POST', '/api/entries', {
        id, name,
        type:     draft.type     || blockTypeValue(block),
        language: lang,
        status:   draft.status  || 'experimental',
        origin:   draft.origin   || '',
        touched:  splitList(draft.touched  || ''),
        tags:     splitList(draft.tags     || ''),
        contract: draft.contract || '',
        inputs:   draft.inputs   || block.inputs,
        outputs:  draft.outputs  || block.outputs,
        scars:    draft.scars    || '',
        notes:    draft.notes    || '',
        sourceContent: extractBlockSource(importedFileCode, lang, block),
      });
      created++;
    } catch { skipped++; }
  }
  closeModal();
  await loadEntries();
  showToast(`${created} card${created !== 1 ? 's' : ''} created${skipped ? ` · ${skipped} skipped` : ''}`);
}

// ── Modal save ─────────────────────────────────────────────────
function closeModal() { $('modal-overlay').classList.add('hidden'); }

async function saveModal() {
  // If any blocks are checked → batch-create all of them instead
  if (modalMode === 'add' && checkedBlocks.size > 0) { await createChecked(); return; }

  const id   = $('modal-id')?.value.trim();
  const name = $('modal-name')?.value.trim();
  const lang = $('modal-language')?.value.trim();
  if (!id || !name || !lang) { showToast('ID, Name, and Language are required', 'error'); return; }

  const data = {
    id, name,
    type:     $('modal-type')?.value || 'function',
    language: lang,
    status:   $('modal-status').value,
    origin:   $('modal-origin').value.trim(),
    touched:  splitList($('modal-touched').value),
    tags:     splitList($('modal-tags').value),
    contract: $('modal-contract').value.trim(),
    inputs:   $('modal-inputs').value.trim(),
    outputs:  $('modal-outputs').value.trim(),
    scars:    $('modal-scars').value.trim(),
    notes:    $('modal-notes').value.trim(),
  };
  if (modalMode === 'add') data.sourceContent = $('modal-source')?.value || '';

  try {
    if (modalMode === 'add') {
      allEntries.push(await api('POST', '/api/entries', data));
      showToast('Entry added');
    } else {
      const updated = await api('PUT', `/api/entries/${modalEntryId}`, data);
      const idx = allEntries.findIndex(e => e.id === modalEntryId);
      if (idx !== -1) allEntries[idx] = { ...allEntries[idx], ...updated };
      showToast('Entry updated');
    }
    closeModal(); applyFilters(); renderFilters();
    if (modalMode === 'edit' && currentDetailId === modalEntryId) showDetail(modalEntryId);
  } catch (err) { showToast('Save failed: ' + err.message, 'error'); }
}

// ── Export ─────────────────────────────────────────────────────
async function exportSelected() {
  if (!selectedIds.size) return;
  try {
    const savedPath = await api('POST', '/api/export', { ids: [...selectedIds] });
    if (savedPath) showToast(`Exported ${selectedIds.size} entr${selectedIds.size===1?'y':'ies'}`);
  } catch (err) {
    if (!err.message.includes('cancelled')) showToast('Export failed: ' + err.message, 'error');
  }
}

// ── Clipboard ──────────────────────────────────────────────────
async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied!');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
    }
  } catch {
    showToast('Copy failed — try selecting and copying manually', 'error');
  }
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  $('toast-container').appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 250); }, 3000);
}

// ── Utils ──────────────────────────────────────────────────────
function $(id)        { return document.getElementById(id); }
function esc(s)       {
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function uniq(arr)    { return [...new Set(arr)]; }
function splitList(s) { return s.split(/[,\s]+/).map(t=>t.trim()).filter(Boolean); }

// ── Modal keyboard navigation sequence ────────────────────────
// Returns an ordered array of focusable "stops":
//   scope-type row → scope-item row (if present) → all visible single-line form fields
function buildModalNavSeq() {
  const seq   = [];
  const fnSel = $('fn-selector');
  if (fnSel && !fnSel.classList.contains('hidden')) {
    const typeRow = fnSel.querySelector('.type-row');
    if (typeRow) seq.push({ kind: 'scope-type', el: typeRow });
    const itemRow = fnSel.querySelector('.item-row');
    if (itemRow) seq.push({ kind: 'scope-item', el: itemRow });
  }
  // Include inputs, selects, textareas, and the highlighted source pre — all visible ones
  [...$('modal-form').querySelectorAll(
    'input:not([type=file]):not([type=checkbox]), select, textarea, #modal-source-hl'
  )].filter(el => el.offsetParent !== null)
    .forEach(el => seq.push({ kind: 'field', el }));
  return seq;
}

// ── Event wiring ───────────────────────────────────────────────
function wireEvents() {
  // Cards
  $('cards-grid').addEventListener('change', e => {
    const id = e.target.dataset.select;
    if (id) toggleSelect(id, e.target.checked);
  });
  $('cards-grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-detail]');
    if (btn) showDetail(btn.dataset.detail);
  });

  // Filter chips
  document.addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (chip) toggleFilter(chip.dataset.filterKey, chip.dataset.filterVal);
  });

  // Panel topbar edit button
  $('panel-edit-btn').addEventListener('click', e => {
    const btn = e.target.closest('[data-edit-id]');
    if (btn) openModalForEdit(btn.dataset.editId);
  });

  // Detail content: delete + copy source
  $('detail-content').addEventListener('click', e => {
    const d = e.target.closest('[data-delete-id]');
    if (d) { deleteEntry(d.dataset.deleteId); return; }
    const c = e.target.closest('[data-copy-source]');
    if (c) {
      const code = $('detail-content').querySelector('.detail-source code');
      copyToClipboard(code?.textContent || '', c);
    }
  });

  // Sidebar
  $('clear-filters').addEventListener('click', clearAllFilters);
  $('search').addEventListener('input', debounce(e => {
    filters.search = e.target.value; applyFilters();
  }, 120));


  // Topbar + detail + selection
  $('add-btn').addEventListener('click', () => openModal());
  $('sort-select').addEventListener('change', e => { sortKey = e.target.value; applyFilters(); });
  $('close-detail').addEventListener('click', closeDetail);
  $('panel-overlay').addEventListener('click', closeDetail);
  $('clear-selection').addEventListener('click', clearSelection);
  $('delete-selected-btn').addEventListener('click', deleteSelected);
  $('export-btn').addEventListener('click', exportSelected);

  // Modal buttons
  $('modal-close').addEventListener('click', closeModal);
  $('modal-cancel').addEventListener('click', closeModal);
  $('modal-save').addEventListener('click', saveModal);
  $('make-all-btn').addEventListener('click', makeAll);
  $('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) closeModal(); });

  // Modal form: auto-ID from name/language; tag autocomplete
  $('modal-form').addEventListener('input', e => {
    if (e.target.id === 'modal-id') { idAutoMode = false; return; }
    if (modalMode === 'add' && (e.target.id === 'modal-name' || e.target.id === 'modal-language')) autoId();
    if (e.target.id === 'modal-tags') showTagSuggestions(e.target);
  });
  // Dismiss tag dropdown on blur
  $('modal-form').addEventListener('focusout', e => {
    if (e.target.id === 'modal-tags') setTimeout(() => document.getElementById('tag-dropdown')?.remove(), 150);
  });

  // Modal form: file input change + block checkbox
  $('modal-form').addEventListener('change', e => {
    if (e.target.id === 'file-input' && e.target.files[0]) handleFileSelect(e.target.files[0]);
    if (e.target.id === 'block-check') {
      const types = availableTypes();
      const items = typeItems(types[blockTypeIdx] || 'file');
      const block = items[blockItemIdx];
      if (block) {
        e.target.checked ? checkedBlocks.add(block.displayName) : checkedBlocks.delete(block.displayName);
        updateBatchButtons();
      }
    }
  });

  // Modal form: drag-and-drop
  $('modal-form').addEventListener('dragover', e => {
    if (e.target.closest('#file-drop')) e.preventDefault();
  });
  $('modal-form').addEventListener('drop', e => {
    const zone = e.target.closest('#file-drop');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });
  $('modal-form').addEventListener('dragenter', e => {
    if (e.target.closest('#file-drop')) e.target.closest('#file-drop').classList.add('drag-over');
  });
  $('modal-form').addEventListener('dragleave', e => {
    const zone = e.target.closest('#file-drop');
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
  });

  // Modal form: click anywhere on drop zone → open file picker
  // Scope navigation: type row + item row; copy source button; highlight → edit toggle
  $('modal-form').addEventListener('click', e => {
    if (e.target.closest('#file-drop')) { $('file-input')?.click(); return; }
    if (e.target.id === 'copy-source-btn') { copyToClipboard($('modal-source')?.value || '', e.target); return; }
    if (e.target.closest('#modal-source-hl')) {
      // Switch from highlighted view to editable textarea
      $('modal-source-hl').classList.add('hidden');
      const srcEl = $('modal-source');
      srcEl.classList.remove('hidden');
      srcEl.focus();
      return;
    }
    if (e.target.id === 'type-prev')  { setBlockType(-1); return; }
    if (e.target.id === 'type-next')  { setBlockType(+1); return; }
    if (e.target.id === 'item-prev')  { setBlockItem(-1); return; }
    if (e.target.id === 'item-next')  { setBlockItem(+1); return; }
  });

  // When user finishes editing the raw source textarea, switch back to highlighted view
  $('modal-form').addEventListener('blur', e => {
    if (e.target.id === 'modal-source') {
      const lang = $('modal-language')?.value?.toLowerCase() || '';
      highlightModalSource(e.target.value, lang);
    }
  }, true);

  // Confirm dialog
  $('confirm-cancel').addEventListener('click', () => $('confirm-overlay').classList.add('hidden'));
  $('confirm-ok').addEventListener('click', () => {
    $('confirm-overlay').classList.add('hidden');
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('confirm-overlay').classList.contains('hidden')) {
        $('confirm-overlay').classList.add('hidden');
      } else if (!$('modal-overlay').classList.contains('hidden')) {
        closeModal();
      } else if (!$('detail-panel').classList.contains('hidden')) {
        closeDetail();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !$('modal-overlay').classList.contains('hidden')) {
      saveModal();
    }
    // Enter on highlighted source block → switch to edit mode
    if (e.key === 'Enter' && document.activeElement?.id === 'modal-source-hl') {
      e.preventDefault();
      $('modal-source-hl').classList.add('hidden');
      const srcEl = $('modal-source');
      srcEl.classList.remove('hidden');
      srcEl.focus();
    }
    // Arrow keys — unified sequence navigation when modal is open
    if (!$('modal-overlay').classList.contains('hidden')) {
      const active = document.activeElement;
      const tag    = active?.tagName;
      const inArea = tag === 'TEXTAREA';

      // ── Up / Down: move through the nav sequence ──────────────
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Inside a textarea: only exit when cursor is at the absolute boundary
        if (inArea) {
          const atBoundary = e.key === 'ArrowUp'
            ? active.selectionStart === 0 && active.selectionEnd === 0
            : active.selectionStart === active.value.length && active.selectionEnd === active.value.length;
          if (!atBoundary) return; // let browser move cursor within the textarea
        }
        const seq   = buildModalNavSeq();
        const cur   = seq.findIndex(s => s.el === active);
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const next  = cur === -1
          ? (delta > 0 ? 0 : seq.length - 1)
          : Math.max(0, Math.min(seq.length - 1, cur + delta));
        e.preventDefault();
        if (seq[next]) {
          seq[next].el.focus();
          // Select text on arrival so typing replaces it immediately
          if (seq[next].kind === 'field' && seq[next].el.tagName !== 'TEXTAREA' &&
              typeof seq[next].el.select === 'function') {
            seq[next].el.select();
          }
        }
        return;
      }

      // ── Left / Right: only for scope nav rows (never steal from inputs/textareas) ──
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const fnSel   = $('fn-selector');
        if (!fnSel || fnSel.classList.contains('hidden')) return;
        const typeRow = fnSel.querySelector('.type-row');
        const itemRow = fnSel.querySelector('.item-row');
        // Only intercept when the row DIV itself is focused (not a child button or input)
        if (active === typeRow) {
          e.preventDefault();
          e.key === 'ArrowLeft' ? setBlockType(-1) : setBlockType(+1);
        } else if (active === itemRow) {
          e.preventDefault();
          e.key === 'ArrowLeft' ? setBlockItem(-1) : setBlockItem(+1);
        }
        // Any other element (inputs, selects, textareas) → browser handles Left/Right
      }
    }
  });

  // Prevent browser from navigating on stray drops
  window.addEventListener('dragover', e => { if (!e.target.closest('#file-drop')) e.preventDefault(); });
  window.addEventListener('drop', e => { if (!e.target.closest('#file-drop')) e.preventDefault(); });
}

async function openModalForEdit(id) {
  try { openModal(await api('GET', `/api/entries/${id}`)); }
  catch (err) { showToast('Failed to load entry: ' + err.message, 'error'); }
}

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Library path UI ────────────────────────────────────────────
async function initLibraryPath() {
  try {
    const dir = await invoke('get_library_dir');
    const el  = $('lib-path-display');
    if (el) el.textContent = dir ? dir.split(/[\\/]/).slice(-2).join('/') : 'Not set';
    if (el) el.title = dir || '';
    if (!dir) showToast('No library folder set. Click "Change…" in the sidebar.', 'error');
  } catch {}
}

$('lib-path-btn')?.addEventListener('click', async () => {
  const path = await invoke('get_library_dir').catch(() => null);
  const newPath = prompt('Enter path to your library folder:', path || '');
  if (!newPath) return;
  try {
    await invoke('set_library_dir', { path: newPath });
    const el = $('lib-path-display');
    if (el) { el.textContent = newPath.split(/[\\/]/).slice(-2).join('/'); el.title = newPath; }
    await loadEntries();
    showToast('Library folder updated');
  } catch (err) {
    showToast('Error: ' + err, 'error');
  }
});

wireEvents();
initLibraryPath();
loadEntries();

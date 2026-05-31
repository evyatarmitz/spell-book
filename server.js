const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3333;

const LIBRARY_DIR = path.join(__dirname, 'library');
const CATALOG_FILE = path.join(LIBRARY_DIR, 'index.json');
const SOURCES_DIR = path.join(LIBRARY_DIR, 'sources');

if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
if (!fs.existsSync(SOURCES_DIR)) fs.mkdirSync(SOURCES_DIR, { recursive: true });

// ── PID file — lets start.bat kill a previous instance cleanly ──
const PID_FILE = path.join(__dirname, '.server.pid');
fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');
const _cleanup = () => { try { fs.unlinkSync(PID_FILE); } catch {} };
process.on('exit', _cleanup);
process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve prismjs for offline syntax highlighting
const prismDir = path.dirname(require.resolve('prismjs'));
app.use('/prism', express.static(prismDir));

// Stable key ordering for clean git diffs
const KEY_ORDER = [
  'id', 'name', 'type', 'language', 'status', 'origin', 'touched',
  'tags', 'contract', 'inputs', 'outputs', 'scars', 'notes', 'source',
  'created_at', 'updated_at',
];

function orderKeys(obj) {
  const result = {};
  for (const key of KEY_ORDER) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

function readCatalog() {
  if (!fs.existsSync(CATALOG_FILE)) return [];
  return JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
}

function writeCatalog(entries) {
  const ordered = entries.map(orderKeys);
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
}

const LANG_EXT = {
  javascript: 'js', typescript: 'ts', python: 'py', rust: 'rs',
  c: 'c', cpp: 'cpp', go: 'go', lua: 'lua', glsl: 'glsl', hlsl: 'hlsl',
  gdscript: 'gd', csharp: 'cs', java: 'java', zig: 'zig', wgsl: 'wgsl',
  css: 'css', scss: 'scss', sass: 'sass', html: 'html', shell: 'sh',
};

function getExt(lang) {
  return LANG_EXT[lang.toLowerCase()] || lang.toLowerCase();
}

function readSource(entry) {
  if (!entry.source) return '';
  const p = path.join(LIBRARY_DIR, entry.source);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

// GET /api/entries — list all (no source content)
app.get('/api/entries', (req, res) => {
  res.json(readCatalog());
});

// GET /api/entries/:id — single entry with source content
app.get('/api/entries/:id', (req, res) => {
  const entry = readCatalog().find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json({ ...entry, sourceContent: readSource(entry) });
});

// POST /api/entries — create
app.post('/api/entries', (req, res) => {
  const entries = readCatalog();
  const d = req.body;

  if (!d.id || !d.name || !d.language) {
    return res.status(400).json({ error: 'id, name, and language are required' });
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id)) {
    return res.status(400).json({ error: 'id must be lowercase alphanumeric with hyphens' });
  }
  if (entries.find(e => e.id === d.id)) {
    return res.status(409).json({ error: `Entry "${d.id}" already exists` });
  }

  const now = new Date().toISOString();
  const ext = getExt(d.language);
  const sourceRel = `sources/${d.id}.${ext}`;

  fs.writeFileSync(path.join(LIBRARY_DIR, sourceRel), d.sourceContent || '', 'utf8');

  const entry = {
    id: d.id,
    name: d.name,
    language: d.language,
    tags: Array.isArray(d.tags) ? d.tags : [],
    origin: d.origin || '',
    touched: Array.isArray(d.touched) ? d.touched : [],
    status: d.status || 'experimental',
    contract: d.contract || '',
    inputs: d.inputs || '',
    outputs: d.outputs || '',
    scars: d.scars || '',
    notes: d.notes || '',
    source: sourceRel,
    created_at: now,
    updated_at: now,
  };

  entries.push(entry);
  writeCatalog(entries);
  res.status(201).json({ ...entry, sourceContent: d.sourceContent || '' });
});

// PUT /api/entries/:id — update
app.put('/api/entries/:id', (req, res) => {
  const entries = readCatalog();
  const idx = entries.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const existing = entries[idx];
  const d = req.body;

  if (d.sourceContent !== undefined) {
    const p = path.join(LIBRARY_DIR, existing.source);
    fs.writeFileSync(p, d.sourceContent, 'utf8');
  }

  const updated = {
    id: existing.id,
    name: d.name ?? existing.name,
    language: d.language ?? existing.language,
    tags: d.tags ?? existing.tags,
    origin: d.origin ?? existing.origin,
    touched: d.touched ?? existing.touched,
    status: d.status ?? existing.status,
    contract: d.contract ?? existing.contract,
    inputs: d.inputs ?? existing.inputs,
    outputs: d.outputs ?? existing.outputs,
    scars: d.scars ?? existing.scars,
    notes: d.notes ?? existing.notes,
    source: existing.source,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  };

  entries[idx] = updated;
  writeCatalog(entries);
  res.json({ ...updated, sourceContent: d.sourceContent });
});

// DELETE /api/entries/:id
app.delete('/api/entries/:id', (req, res) => {
  const entries = readCatalog();
  const idx = entries.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const entry = entries[idx];
  if (entry.source) {
    const p = path.join(LIBRARY_DIR, entry.source);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  entries.splice(idx, 1);
  writeCatalog(entries);
  res.json({ ok: true });
});

// POST /api/export — zip selected entries grouped by language
app.post('/api/export', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const entries = readCatalog();
  const selected = entries.filter(e => ids.includes(e.id));
  if (selected.length === 0) {
    return res.status(400).json({ error: 'No matching entries' });
  }

  const byLang = {};
  for (const entry of selected) {
    const lang = entry.language.toLowerCase();
    if (!byLang[lang]) byLang[lang] = [];
    byLang[lang].push({ ...entry, sourceContent: readSource(entry) });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="scavenge-export.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => { throw err; });
  archive.pipe(res);

  const lineComment = lang => ['python', 'lua', 'gdscript'].includes(lang) ? '#' : '//';

  for (const [lang, langEntries] of Object.entries(byLang)) {
    const ext = getExt(lang);
    const c = lineComment(lang);
    let content = '';

    for (const entry of langEntries) {
      content += `${c} ${'='.repeat(72)}\n`;
      content += `${c} Name:     ${entry.name}\n`;
      content += `${c} Origin:   ${entry.origin}\n`;
      content += `${c} Status:   ${entry.status}\n`;
      content += `${c} Contract: ${entry.contract}\n`;
      if (entry.inputs) content += `${c} Inputs:   ${entry.inputs}\n`;
      if (entry.outputs) content += `${c} Outputs:  ${entry.outputs}\n`;
      if (entry.scars) content += `${c} Scars:    ${entry.scars}\n`;
      content += `${c} ${'='.repeat(72)}\n\n`;
      content += (entry.sourceContent || '').trim() + '\n\n\n';
    }

    archive.append(content.trimEnd() + '\n', { name: `${lang}.${ext}` });
  }

  // Bundle README
  const lines = [
    '# Scavenge Export\n',
    `Generated: ${new Date().toISOString()}\n\n`,
    '## Entries\n\n',
    ...selected.map(e => `- **${e.name}** (${e.language}) — ${e.contract}\n`),
  ];
  archive.append(lines.join(''), { name: 'README.md' });

  archive.finalize();
});

// POST /api/shutdown — lets the UI stop the server without hunting for the terminal
app.post('/api/shutdown', (_req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 150);
});

app.listen(PORT, () => {
  console.log(`\n  Code Scavenge Library`);
  console.log(`  http://localhost:${PORT}\n`);
});

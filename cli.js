#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── config ────────────────────────────────────────────────────────────────────
// Stored at ~/.spellbook/config.json  { "dir": "/path/to/library" }
// Override with SPELLBOOK_DIR env var.

const CONFIG_DIR  = path.join(os.homedir(), '.spellbook');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function writeConfig(cfg) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

function getLibraryDir() {
  if (process.env.SPELLBOOK_DIR) return process.env.SPELLBOOK_DIR;
  const cfg = readConfig();
  if (cfg.dir) return cfg.dir;
  return null;
}

function requireLibraryDir() {
  const d = getLibraryDir();
  if (!d) {
    console.error('No library configured. Run:  sb use <path-to-library-folder>');
    console.error('Example:  sb use "C:\\Users\\USER\\AI_Agency\\Spell Book\\library"');
    process.exit(1);
  }
  return d;
}

// ── catalog helpers ───────────────────────────────────────────────────────────

const LANG_EXT = {
  javascript: 'js', typescript: 'ts', python: 'py', rust: 'rs',
  c: 'c', cpp: 'cpp', go: 'go', lua: 'lua', glsl: 'glsl', hlsl: 'hlsl',
  gdscript: 'gd', csharp: 'cs', java: 'java', zig: 'zig', wgsl: 'wgsl',
  css: 'css', scss: 'scss', sass: 'sass', html: 'html', shell: 'sh',
};

function getExt(lang) {
  return LANG_EXT[lang.toLowerCase()] || lang.toLowerCase();
}

const KEY_ORDER = [
  'id', 'name', 'type', 'language', 'status', 'origin', 'touched',
  'tags', 'contract', 'inputs', 'outputs', 'scars', 'notes', 'source',
  'created_at', 'updated_at',
];

function orderKeys(obj) {
  const result = {};
  for (const k of KEY_ORDER) if (k in obj) result[k] = obj[k];
  return result;
}

function readCatalog(libDir) {
  const f = path.join(libDir, 'index.json');
  if (!fs.existsSync(f)) return [];
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function writeCatalog(libDir, entries) {
  fs.writeFileSync(
    path.join(libDir, 'index.json'),
    JSON.stringify(entries.map(orderKeys), null, 2) + '\n',
    'utf8'
  );
}

function readSource(libDir, entry) {
  if (!entry.source) return '';
  const p = path.join(libDir, entry.source);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function ensureDirs(libDir) {
  const srcDir = path.join(libDir, 'sources');
  if (!fs.existsSync(libDir))  fs.mkdirSync(libDir,  { recursive: true });
  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
}

// ── commands ──────────────────────────────────────────────────────────────────

function cmdUse(dirArg) {
  if (!dirArg) {
    console.error('Usage: sb use <path-to-library-folder>');
    process.exit(1);
  }
  const resolved = path.resolve(dirArg);
  if (!fs.existsSync(resolved)) {
    console.error(`Path does not exist: ${resolved}`);
    process.exit(1);
  }
  const cfg = readConfig();
  cfg.dir = resolved;
  writeConfig(cfg);
  console.log(`Library set to: ${resolved}`);
}

function cmdStatus() {
  const dir = getLibraryDir();
  if (!dir) {
    console.log('No library configured.');
    console.log('Run: sb use <path-to-library-folder>');
    return;
  }
  console.log(`Library: ${dir}`);
  const entries = readCatalog(dir);
  console.log(`Entries: ${entries.length}`);
}

function cmdInitAi() {
  const src = path.join(__dirname, 'AI_README.md');
  if (!fs.existsSync(src)) {
    console.error(`AI_README.md not found at: ${src}`);
    process.exit(1);
  }
  const dest = path.join(process.cwd(), 'AI_README.md');
  fs.copyFileSync(src, dest);
  console.log(`Copied AI_README.md to: ${dest}`);
}

function cmdAdd(filePath) {
  if (!filePath) { console.error('Usage: sb add <entry.json>'); process.exit(1); }

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) { console.error(`File not found: ${abs}`); process.exit(1); }

  let d;
  try { d = JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch (e) { console.error(`Invalid JSON: ${e.message}`); process.exit(1); }

  if (!d.id || !d.name || !d.language) {
    console.error('Entry must have id, name, and language');
    process.exit(1);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id)) {
    console.error('id must be lowercase alphanumeric with hyphens');
    process.exit(1);
  }

  const libDir = requireLibraryDir();
  ensureDirs(libDir);
  const entries = readCatalog(libDir);

  if (entries.find(e => e.id === d.id)) {
    console.error(`Entry "${d.id}" already exists`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const ext = getExt(d.language);
  const sourceRel = `sources/${d.id}.${ext}`;

  fs.writeFileSync(path.join(libDir, sourceRel), d.sourceContent || '', 'utf8');

  const entry = {
    id:       d.id,
    name:     d.name,
    language: d.language,
    tags:     Array.isArray(d.tags) ? d.tags : [],
    origin:   d.origin   || '',
    touched:  Array.isArray(d.touched) ? d.touched : [],
    status:   d.status   || 'experimental',
    contract: d.contract || '',
    inputs:   d.inputs   || '',
    outputs:  d.outputs  || '',
    scars:    d.scars    || '',
    notes:    d.notes    || '',
    source:   sourceRel,
    created_at: now,
    updated_at: now,
  };

  entries.push(entry);
  writeCatalog(libDir, entries);
  console.log(`Added: ${entry.name} (${entry.id})`);
}

function cmdSearch(query) {
  if (!query) { console.error('Usage: sb search <query>'); process.exit(1); }

  const libDir = requireLibraryDir();
  const entries = readCatalog(libDir);
  const q = query.toLowerCase();

  const matches = entries.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.language.toLowerCase().includes(q) ||
    (e.tags  || []).some(t => t.toLowerCase().includes(q)) ||
    (e.contract || '').toLowerCase().includes(q)
  );

  if (matches.length === 0) { console.log('No matches.'); return; }

  for (const e of matches) {
    const tags = (e.tags || []).join(', ');
    console.log(`${e.name}  [${e.id}]  ${e.language}${tags ? '  ' + tags : ''}`);
  }
}

function cmdGet(nameOrId) {
  if (!nameOrId) { console.error('Usage: sb get <name-or-id>'); process.exit(1); }

  const libDir = requireLibraryDir();
  const entries = readCatalog(libDir);
  const q = nameOrId.toLowerCase();
  const entry = entries.find(e =>
    e.id.toLowerCase() === q || e.name.toLowerCase() === q
  );

  if (!entry) { console.error(`Not found: ${nameOrId}`); process.exit(1); }

  const source = readSource(libDir, entry);

  console.log(`Name: ${entry.name}`);
  console.log(`ID:   ${entry.id}`);
  if (entry.contract) console.log(`What: ${entry.contract}`);
  if (entry.inputs)   console.log(`In:   ${entry.inputs}`);
  if (entry.outputs)  console.log(`Out:  ${entry.outputs}`);
  if (entry.scars)    console.log(`Scars: ${entry.scars}`);
  console.log('---');
  console.log(source);
}

function cmdHelp() {
  console.log(`
Spell Book CLI

  sb use <path>         Point sb at your library folder (run once after install)
  sb status             Show current library path and entry count

  sb init-ai            Copy AI_README.md into the library folder
  sb add <entry.json>   Add a new entry from a JSON file
  sb search <query>     Search entries by name, language, tags, or contract
  sb get <name|id>      Print name + source for an entry
`);
}

// ── dispatch ──────────────────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'use':     cmdUse(args[0]);           break;
  case 'status':  cmdStatus();               break;
  case 'init-ai': cmdInitAi();               break;
  case 'add':     cmdAdd(args[0]);           break;
  case 'search':  cmdSearch(args.join(' ')); break;
  case 'get':     cmdGet(args[0]);           break;
  default:        cmdHelp();
}

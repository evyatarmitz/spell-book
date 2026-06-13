#!/usr/bin/env node
// Copies prismjs files from node_modules into public/prism/ for offline bundling.
// Runs automatically via "postinstall" in package.json.
'use strict';

const fs   = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'prismjs');
const dst = path.join(__dirname, '..', 'public', 'prism');

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    entry.isDirectory() ? copyDir(s, d) : copyFile(s, d);
  }
}

copyFile(path.join(src, 'prism.js'),                                            path.join(dst, 'prism.js'));
copyFile(path.join(src, 'themes', 'prism-tomorrow.min.css'),                    path.join(dst, 'prism-tomorrow.min.css'));
copyFile(path.join(src, 'plugins', 'autoloader', 'prism-autoloader.min.js'),    path.join(dst, 'plugins', 'autoloader', 'prism-autoloader.min.js'));
copyDir( path.join(src, 'components'),                                           path.join(dst, 'components'));

console.log('prism copied to public/prism/');

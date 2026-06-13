#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'prismjs');
const dst = path.join(__dirname, '..', 'public', 'prism');

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    e.isDirectory() ? copyDir(s, d) : copy(s, d);
  }
}

copy(path.join(src, 'prism.js'),                                         path.join(dst, 'prism.js'));
copy(path.join(src, 'themes', 'prism-tomorrow.min.css'),                 path.join(dst, 'prism-tomorrow.min.css'));
copy(path.join(src, 'plugins', 'autoloader', 'prism-autoloader.min.js'), path.join(dst, 'plugins', 'autoloader', 'prism-autoloader.min.js'));
copyDir(path.join(src, 'components'),                                     path.join(dst, 'components'));

console.log('prism → public/prism/');

#!/usr/bin/env node
'use strict';
// Verify new extractJson repairs against the real failed model output.
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('c:/Xamcode/server.js', 'utf8');
const cut = src.indexOf('const server = http.createServer');
const sb = { console, process, require, __dirname: 'c:/Xamcode', __filename: 'c:/Xamcode/server.js',
  Buffer, URL, fetch, setTimeout, clearTimeout, setInterval, clearInterval, AbortController, TextEncoder, Intl };
sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(src.slice(0, cut) + '\nglobalThis.__t={extractJson,validateStudyOutline,normalizeOutline};', sb, { filename: 'server.js' });
const raw = fs.readFileSync('c:/Xamcode/dbg-outline-raw.txt', 'utf8');
try {
  const o = sb.__t.extractJson(raw);
  console.log('PARSED OK units=' + (o.units && o.units.length) + ' concepts=' + (o.concepts && o.concepts.length));
  console.log('valid-raw=' + sb.__t.validateStudyOutline(o));
  sb.__t.normalizeOutline(o);
  console.log('valid-normalized=' + sb.__t.validateStudyOutline(o));
} catch (e) { console.log('STILL FAILS: ' + e.message); process.exit(1); }

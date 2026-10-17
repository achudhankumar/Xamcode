'use strict';
/* Check CSS brace balance line by line in build.html's bip-css style. */
const fs = require('fs');
const h = fs.readFileSync(require('path').join(__dirname, 'build.html'), 'utf8');
const start = h.indexOf('<style id="bip-css">');
const end = h.indexOf('</style>', start);
const css = h.slice(start, end);
let depth = 0, line = 1, problems = [];
for (const ch of css){
  if (ch === '\n') line++;
  if (ch === '{') depth++;
  if (ch === '}') { depth--; if (depth < 0) problems.push('negative depth at line ' + line); depth = Math.max(0, depth); }
}
console.log('final depth=' + depth + (problems.length ? ' | ' + problems.join(', ') : ''));
if (depth !== 0){
  // Report where depth first stays >0 through the end of a suspected block: print last 5 open positions.
  let d = 0, ln = 1, opens = [];
  for (const ch of css){ if (ch === '\n') ln++; if (ch === '{'){ d++; opens.push(ln); } if (ch === '}'){ d--; opens.pop(); } }
  console.log('unclosed { opened at lines: ' + opens.join(', '));
}

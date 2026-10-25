const fs = require('fs');
const [,, phase] = process.argv;
if (!phase) { console.log('usage: node scripts/gate.js <phase>'); process.exit(1); }
const rep = JSON.parse(fs.readFileSync('reports/phase-' + phase + '.json', 'utf8'));
const gates = JSON.parse(fs.readFileSync('scripts/gates.json', 'utf8'));
const g = gates[phase];
let pass = true;
for (const [k, v] of Object.entries(g.pass)) {
  const ok = rep[k] >= v;
  if (!ok) pass = false;
  console.log('  ' + k + ': ' + rep[k] + ' >= ' + v + ' ? ' + (ok ? 'PASS' : 'FAIL'));
}
console.log(pass ? 'GATE PASS' : 'GATE FAIL');
process.exit(pass ? 0 : 1);

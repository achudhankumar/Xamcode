'use strict';
const fs=require('fs');
const html=fs.readFileSync('c:/Xamcode/build.html','utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
fs.writeFileSync('c:/Xamcode/build-parts/inline.js', m?m[1]:'');
try{ new (require('vm').Script)(m?m[1]:''); console.log('SYNTAX OK'); }
catch(e){ console.log('SYNTAX FAIL: '+e.message); const s=(m?m[1]:'').split('\n'); const idx=(e.stack.match(/:(\d+):/)||[])[1]; console.log('line ~'+idx); const n=Number(idx)||0; console.log(s.slice(Math.max(0,n-6),n+4).map((l,i)=>((Math.max(0,n-6)+i+1)+': '+l)).join('\n')); }

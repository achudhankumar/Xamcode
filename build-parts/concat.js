'use strict';
const fs=require('fs');
const path=require('path');
const OUT=path.join(__dirname,'..','build.html');
const P=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
const parts=['p01.txt','p02.txt','p03.txt','p04.txt','p05.txt','p06.txt','p07.txt','p08.txt','p09.txt','p10.txt','p11.txt','p12.txt','p13.txt'];
let html='';
for(const p of parts){ html+=P(p); }
fs.writeFileSync(OUT,html);
console.log('wrote build.html bytes='+html.length);
const ids={}; const re=/id=["']([^"']+)["']/g; let m;
while((m=re.exec(html))){ ids[m[1]]=(ids[m[1]]||0)+1; }
const dup=Object.keys(ids).filter(k=>ids[k]>1);
console.log('DUP_IDS='+(dup.length?dup.join(','):'none'));
console.log('SCRIPT_TAGS='+(html.match(/<script[^>]*>/g)||[]).length);
console.log('STYLE_TAGS='+(html.match(/<style[^>]*>/g)||[]).length);
const need=['heroTitle','phaseLabel','liveBadge','pctFill','pctNum','pctSub','pctBar','statProgress','statPhase','statMilestone','statIdeas','statWait','waitCount','mDone','mProg','mUp','mRev','roadmapList','stBuild','stBuildAt','stTests','stTestsAt','stDeploy','stDeployAt','actList','feedNote','ideaList','ideaForm','ideaTitle','ideaDesc','ideaBtn','ideaMsg','chatList','chatForm','chatNick','chatText','chatBtn','chatMsg','launchState','launchNote','launchKind','countCells','cdD','cdH','cdM','cdS','waitForm','waitEmail','waitNick','waitConsent','waitBtn','waitMsg','main','opening','menuBtn','menuOverlay'];
const miss=need.filter(k=>!ids[k]);
console.log('MISSING='+(miss.length?miss.join(','):'none'));

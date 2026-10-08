'use strict';
/* Turns any video or GIF into ONE contact-sheet image showing the whole
   loop, so the motion can be read as a single picture instead of guessed
   from a still. Uses ffmpeg's tile filter.
   usage: node extract-motion.js <input> [out.png] [frameCount] */
const {execFileSync}=require('child_process');
const fs=require('fs'),path=require('path');

const [, , input, outArg, countArg]=process.argv;
if(!input){
  console.error('usage: node extract-motion.js <input.gif|mp4|webm> [out.png] [frames]');
  process.exit(2);
}
if(!fs.existsSync(input)){
  console.error(`not found: ${input}`);
  process.exit(2);
}
const out=outArg||'motion-sheet.png';
const count=Math.max(2,Math.min(24,Number(countArg)||12));

const ff=(args)=>execFileSync('ffmpeg',args,{stdio:['ignore','pipe','pipe']});

/* Duration drives the sampling rate, so a 4s loop and a 12s loop both
   yield the same number of evenly spaced frames. ffmpeg prints its report
   to STDERR and exits non-zero when only probing, so the report has to be
   read off the thrown error — reading stdout yields nothing and the rate
   silently falls back to 1 fps, which for a long loop leaves the tile
   grid mostly black. */
function probeDuration(file){
  try{
    execFileSync('ffmpeg',['-i',file],{stdio:['ignore','pipe','pipe']});
  }catch(error){
    const report=String(error.stderr||'');
    const m=/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(report);
    if(m) return Number(m[1])*3600+Number(m[2])*60+Number(m[3]);
  }
  return 0;
}

const duration=probeDuration(input);

const cols=count>9?4:count>4?3:2;
const rows=Math.ceil(count/cols);
const fps=duration>0?count/duration:1;

ff(['-y','-i',input,
    '-vf',`fps=${fps.toFixed(4)},scale=360:-1:flags=lanczos,tile=${cols}x${rows}`,
    '-frames:v','1',out]);

const size=fs.statSync(out).size;
console.log(`input    : ${path.basename(input)}`);
console.log(`duration : ${duration?duration.toFixed(2)+'s':'unknown'}`);
console.log(`frames   : ${count} sampled at ${fps.toFixed(2)} fps, tiled ${cols}x${rows}`);
console.log(`written  : ${out} (${(size/1024).toFixed(0)} KB)`);
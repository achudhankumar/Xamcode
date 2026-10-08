#!/usr/bin/env node
/*
 * AI Agent Diagnostic Test
 * Checks current state of PDF generation
 * Run: node setup/test-agent.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:4173';

async function checkServer() {
  console.log('=== AI Agent Diagnostic ===');
  
  // 1. Server health
  console.log('\n1. Server Health');
  let up = false;
  for(let i=0; i<10 && !up; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const r = await fetch('http://127.0.0.1:4173/');
      up = r.ok;
    } catch(e) {}
  }
  console.log(up ? '   Server: RUNNING' : '   Server: NOT RUNNING');
  
  // 2. Provider status
  console.log('\n2. AI Provider Status');
  try {
    const r = await fetch('http://127.0.0.1:4173/api/providers');
    const body = await r.json();
    console.log('   ' + JSON.stringify(body, null, 2));
  } catch(e) {
    console.log('   Cannot fetch providers');
  }
  
  // 3. Quota status
  console.log('\n3. PDF Quota');
  try {
    const r = await fetch('http://127.0.0.1:4173/api/quota');
    const body = await r.json();
    console.log('   ' + JSON.stringify(body, null, 2));
  } catch(e) {
    console.log('   Cannot fetch quota');
  }
  
  // 4. Check .env
  console.log('\n4. Environment Configuration');
  const envFile = fs.existsSync('/.env') ? 'Exists' : 'Missing';
  console.log('   .env: ' + envFile);
  
  // 5. Test PDF generation
  console.log('\n5. PDF Generation Test');
  const pdfBase64 = Buffer.from('Test PDF content for AI analysis', 'utf-8').toString('base64');
  try {
    const t0 = Date.now();
    const post = await fetch('http://127.0.0.1:4173/api/analyze', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({pdfBase64, level:'standard'})
    });
    const elapsed = Date.now() - t0;
    const body = await post.json();
    console.log('   POST /api/analyze: ' + post.status + ' (' + elapsed + 'ms)');
    if (body.jobId) {
      console.log('   ✓ Job created: ' + body.jobId);
      // Poll for completion
      for(let i=0; i<20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const status = await fetch('http://127.0.0.1:4173/api/analyze/' + body.jobId);
        const statusBody = await status.json();
        if (statusBody.status === 'completed' || statusBody.status === 'error') {
          console.log('   Job status: ' + statusBody.status);
          if (statusBody.error) console.log('   Error: ' + statusBody.error);
          if (statusBody.study) console.log('   Study title: ' + statusBody.study.title);
          break;
        }
      }
    }
  } catch(e) {
    console.log('   Error: ' + e.message);
  }
  
  console.log('\n=== Diagnostic Complete ===');
}

checkServer().catch(console.error);

#!/usr/bin/env node
/**
 * PDF Generation Test Script
 * Tests the AI agent with a sample PDF
 * Run: node setup/test-pdf-generation.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:4173';
const QUOTA_FILE = path.join(__dirname, '..', '.xamcode-quota-test.json');

// Create a simple test PDF (text-based)
function createTestPdf(content = 'Test PDF for AI agent analysis. This is a simple test document to verify PDF generation works correctly.') {
  return Buffer.from(content, 'utf-8').toString('base64');
}

// Get quota status
async function getQuota() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}/api/quota`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
  });
}

// Create analyze job
async function createAnalyzeJob(pdfBase64, level = 'standard') {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ pdfBase64, level });
    const req = http.request(`${BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve({ status: res.statusCode, raw }); }
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

// Poll job status
async function pollJob(jobId, maxAttempts = 30, interval = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getJobStatus(jobId);
    if (status && (status.status === 'completed' || status.status === 'error' || status.status === 'cancelled')) {
      return status;
    }
    await new Promise(r => setTimeout(r, interval));
  }
  return null;
}

// Get job status
async function getJobStatus(jobId) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}/api/analyze/${jobId}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
  });
}

// Main test
async function main() {
  console.log('=== XamCode AI Agent Test ===\n');

  // Check server health
  console.log('1. Checking server health...');
  let up = false;
  for (let i = 0; i < 10 && !up; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const r = await fetch(`http://127.0.0.1:4173/`);
      up = r.ok;
    } catch (e) {}
  }
  console.log(up ? '   ✓ Server is running' : '   ✗ Server not running yet');

  // Check providers
  console.log('\n2. Checking AI providers...');
  try {
    const r = await fetch('http://127.0.0.1:4173/api/providers');
    const body = await r.json();
    console.log('   ' + JSON.stringify(body, null, 2));
  } catch (e) {
    console.log('   ✗ Could not fetch providers');
  }

  // Check quota
  console.log('\n3. Checking PDF quota...');
  try {
    const quota = await getQuota();
    console.log('   ' + JSON.stringify(quota, null, 2));
  } catch (e) {
    console.log('   ✗ Could not fetch quota');
  }

  // Create PDF
  const pdfBase64 = createTestPdf();

  // Create analyze job
  console.log('\n4. Creating PDF analysis job...');
  try {
    const job = await createAnalyzeJob(pdfBase64, 'standard');
    console.log('   ' + JSON.stringify(job, null, 2));

    if (job.jobId) {
      console.log('\n5. Polling for completion...');
      const result = await pollJob(job.jobId);
      if (result) {
        console.log('   Result: ' + JSON.stringify(result, null, 2));
        if (result.error) {
          console.log('   ✗ Job error: ' + result.error);
        } else if (result.study) {
          console.log('   ✓ Job completed successfully!');
          console.log('   Study title: ' + result.study.title);
          console.log('   Concepts: ' + (result.study.concepts ? result.study.concepts.length : 0));
          console.log('   Units: ' + (result.study.units ? result.study.units.length : 0));
        }
      } else {
        console.log('   ✗ Job did not complete in time');
      }
    }
  } catch (e) {
    console.log('   ✗ Error: ' + e.message);
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);

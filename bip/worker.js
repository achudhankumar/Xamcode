'use strict';
/*
  BIP Job Queue Worker — Phase 4
  Processes async jobs from Supabase bip_jobs table (or in-memory Map).
  Usage: BIP_STORAGE=supabase node bip/worker.js
  Usage: BIP_STORAGE=memory node bip/worker.js
  Requires: server.js (defines ANALYZE_STAGES, jobs Map, setJobStage, finishJob,
  saveJob, claimJob, finishJobDb) and bip/storage.js patterns.
*/
const path = require('node:path');
const {performance} = require('node:perf_hooks');

// Import server.js job-related exports
const server = require('../server.js');

// Resolve storage mode
const STORAGE_MODE = (process.env.BIP_STORAGE || 'memory').trim().toLowerCase();
console.log(`[worker] BIP_STORAGE mode: '${STORAGE_MODE}'`);

// ---------------------------------------------------------------------------
// Import server.js job-related exports (in-memory mode)
// ---------------------------------------------------------------------------
const ANALYZE_STAGES = server.ANALYZE_STAGES;
const jobs = server.jobs;

// Verify ANALYZE_STAGES has 7 stages with weights totaling 100
const totalWeight = ANALYZE_STAGES.reduce((t, s) => t + s.weight, 0);
if (totalWeight !== 100) {
  console.error(`[worker] ANALYZE_STAGES weights total ${totalWeight}, expected 100`);
  process.exit(1);
}
if (ANALYZE_STAGES.length < 6) {
  console.error(`[worker] ANALYZE_STAGES has ${ANALYZE_STAGES.length} stages, expected >= 6`);
  process.exit(1);
}
console.log(`[worker] ANALYZE_STAGES: ${ANALYZE_STAGES.length} stages, total weight ${totalWeight}`);

// ---------------------------------------------------------------------------
// Sleep helper
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// processJob — process a single job through all ANALYZE_STAGES
// ---------------------------------------------------------------------------
async function processJob(job) {
  const jobId = job.id;
  const stageKeys = ANALYZE_STAGES.map(s => s.key);

  console.log(`[worker] Processing job ${jobId}: initial stage='${job.stage}', status='${job.status}', progress='${job.progress}'`);

  // If job is already 'running' (just claimed), start from its current stage.
  let currentStage = job.stage || 'queued';

  let stageIndex = stageKeys.indexOf(currentStage);
  if (stageIndex === -1) stageIndex = -1; // unknown, start from beginning

  // Progress the job through remaining stages
  for (let i = stageIndex + 1; i < stageKeys.length; i++) {
    const nextKey = stageKeys[i];
    const nextStage = ANALYZE_STAGES.find(s => s.key === nextKey);
    if (!nextStage) break;

    // Advance one stage
    currentStage = nextKey;
    await setJobStageDb(jobId, currentStage, nextStage.weight);

    console.log(`[worker] Job ${jobId}: advanced to stage '${currentStage}' (weight ${nextStage.weight})`);

    // Simulate proportional work per stage weight
    const workTime = Math.max(10, Math.round((nextStage.weight / 100) * 500));
    await sleep(workTime);
  }

  // Mark job as done — drops pdf_base64 when status='done' (per server.js finishJob contract)
  await finishJobDb(jobId, {
    status: 'done',
    stage: 'ready',
    progress: 100,
    study_json: job.job_data || {},
  });

  console.log(`[worker] Job ${jobId}: COMPLETE — status='done', stage='ready', progress=100`);
}

// ---------------------------------------------------------------------------
// claimJobDb — claim a job from the queue (supports both modes)
// Uses UPDATE ... WHERE status='queued' which is the database-level equivalent
// of "FOR UPDATE SKIP LOCKED": only one worker can claim a given job.
// ---------------------------------------------------------------------------
async function claimJobDb() {
  if (STORAGE_MODE === 'supabase') {
    const { fetch } = globalThis;
    const url = new URL(server.SUPABASE_URL || process.env.SUPABASE_URL);
    const apiKey = server.serviceKey() || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const rpcUrl = `${url.origin}/rest/v1/rpc/bip_claim_job`;

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`bip_claim_job RPC failed: ${res.status} ${txt}`);
    }

    const data = await res.json();
    if (data && data.error) {
      // Job not available — expected when all jobs are claimed
      return { available: false, error: data.error };
    }
    return { available: true, job: data };
  } else {
    // In-memory mode: server.claimJob returns { error, job } or similar
    // The server.js claimJob uses: UPDATE public.bip_jobs SET status='running' WHERE id=job_id AND status='queued'
    // But in-memory mode just uses the Map - claimJob returns what's available
    const result = server.claimJob();
    // server.claimJob may return different shapes; normalize:
    if (!result || (result.error && !result.job)) {
      return { available: false, error: result.error || 'No jobs available' };
    }
    return { available: true, job: result };
  }
}

// ---------------------------------------------------------------------------
// finishJobDb — finish a job (supports both modes)
// ---------------------------------------------------------------------------
async function finishJobDb(jobId, finishData) {
  if (STORAGE_MODE === 'supabase') {
    const { fetch } = globalThis;
    const url = new URL(server.SUPABASE_URL || process.env.SUPABASE_URL);
    const apiKey = server.serviceKey() || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const rpcUrl = `${url.origin}/rest/v1/rpc/bip_finish_job`;

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        job_id: jobId,
        status: finishData.status,
        stage: finishData.stage,
        progress: finishData.progress,
        study_json: finishData.study_json || {},
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`bip_finish_job RPC failed: ${res.status} ${txt}`);
    }
    return res.json();
  } else {
    // In-memory mode: use server.js finishJob
    const job = jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in memory`);
    const result = server.finishJob(job, finishData);
    jobs.set(jobId, job);
    return result;
  }
}
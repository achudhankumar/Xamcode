'use strict';
/* ============================================================
   CI -> Build-in-Public ingest reporter (GitHub Actions).
   ----------------------------------------------------------------
   Posts ONE typed event (build_started / build_passed / build_failed)
   to POST /api/bip/events/ingest with the shared Bearer token, then
   VALIDATES the response body — HTTP 200 alone is never trusted (the
   endpoint can answer 200 with stored:0 for a duplicate or a drop).

   Configuration is environment-driven so each workflow step stays tiny:
     BIP_INGEST_TOKEN   bearer secret (GitHub Actions secret)
     PUBLIC_URL         preferred target; falls back to PUBLIC_URL_SECRET
                        then the documented production default
     EVENT_TYPE         required — one of the allow-listed BIP event types
     SUMMARY            required — human line for the public feed
     REF                optional commit SHA (goes to the status board ref)
     DEDUPE_KEY         stable, idempotent key (run id + attempt)
     SOURCE             defaults to "ci"

   Honesty rules preserved from the existing tests reporter:
     * no secrets are ever echoed to a log line or the body,
     * a reporting failure fails THIS step via ::error:: and never masks
       the build/test step's own outcome (this runs as its own step),
     * pull_request events with no secrets (fork PRs) skip gracefully.
   ============================================================ */
const TOKEN = process.env.BIP_INGEST_TOKEN || '';
const EVENT_NAME = process.env.GITHUB_EVENT_NAME || '';

function fail(msg){
  console.log('::error::BIP ingest reporting failed - ' + msg);
  process.exit(1);
}

async function main(){
  if (!TOKEN){
    if (EVENT_NAME === 'pull_request'){
      console.log('BIP ingest skipped: secrets are unavailable for pull_request events (expected for fork PRs).');
      return;
    }
    fail('BIP_INGEST_TOKEN secret is not configured on this repository.');
  }

  const eventType = process.env.EVENT_TYPE || '';
  const summary = process.env.SUMMARY || '';
  if (!eventType || !summary) fail('EVENT_TYPE and SUMMARY are required.');

  let base = process.env.PUBLIC_URL || process.env.PUBLIC_URL_SECRET || 'https://xamcode-ai.onrender.com';
  base = String(base).replace(/\/+$/, '');

  const body = JSON.stringify({
    type: eventType,
    summary: summary,
    ref: process.env.REF || '',
    dedupeKey: process.env.DEDUPE_KEY || undefined,
    source: process.env.SOURCE || 'ci'
  });

  const controller = new AbortController();
  const timer = setTimeout(() => { try { controller.abort(); } catch (e) {} }, 15000);

  let res, transportError = null;
  try {
    res = await fetch(base + '/api/bip/events/ingest', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: body,
      signal: controller.signal
    });
  } catch (e) {
    transportError = e;
  } finally {
    clearTimeout(timer);
  }

  if (transportError){
    fail('transport error (' + (transportError.name || 'Error') + ') posting ' + eventType + '. The build/test result is unaffected.');
  }

  const status = res.status;
  let parsed = null, raw = '';
  try { raw = await res.text(); parsed = JSON.parse(raw); } catch (e) { parsed = null; }

  if (status !== 200){
    const snippet = String(raw || '').slice(0, 300);
    fail('HTTP ' + status + ' posting ' + eventType + '. Body: ' + snippet);
  }
  if (!parsed || parsed.received !== true){
    fail('HTTP 200 but the response was missing received=true for ' + eventType + '.');
  }
  if (Array.isArray(parsed.errors) && parsed.errors.length > 0){
    fail('server rejected the event (' + eventType + '): ' + parsed.errors.join(','));
  }
  const stored = Number(parsed.stored) || 0;
  const dup = Number(parsed.duplicates) || 0;
  if (stored + dup < 1){
    fail('HTTP 200 but the event was NOT stored (storage failure or silent drop) for ' + eventType + '.');
  }

  console.log('BIP ingest report OK - HTTP 200, ' + eventType + ' stored=' + stored + ' duplicates=' + dup + '.');
}

main().catch(e => fail('unexpected reporter error (' + (e && e.message) + ').'));

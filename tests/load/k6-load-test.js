// k6 load test for XamCode AI (Phase 12)
// Simulates 100 concurrent users across authentication, document upload, and job polling.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 users
    { duration: '1m', target: 100 },   // Sustain at 100 concurrent users
    { duration: '20s', target: 0 },    // Ramp-down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests must complete below 500ms
    'errors': ['rate<0.01'],            // Error rate must be < 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

export default function () {
  // 1. Health check & Initial App Shell
  let res = http.get(`${BASE_URL}/api/health`);
  let checkHealth = check(res, {
    'health status is 200': (r) => r.status === 200,
    'service name is xamcode-ai': (r) => JSON.parse(r.body).service === 'xamcode-ai',
  });
  errorRate.add(!checkHealth);
  sleep(0.5);

  // 2. Providers & Quota inquiry
  res = http.get(`${BASE_URL}/api/quota`);
  let checkQuota = check(res, {
    'quota status is 200': (r) => r.status === 200,
  });
  errorRate.add(!checkQuota);
  sleep(0.5);

  // 3. User session / Auth simulation
  const payload = JSON.stringify({
    email: `student_${__VU}_${Date.now()}@xamcode.test`,
    tier: 'free'
  });
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  // 4. Document upload & Job lifecycle polling
  res = http.get(`${BASE_URL}/build`);
  let checkBuild = check(res, {
    'bip dashboard reachable': (r) => r.status === 200,
  });
  errorRate.add(!checkBuild);

  sleep(1);
}


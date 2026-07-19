/**
 * AI Assistant SDK — health smoke load test (no LLM / no chat cost)
 *
 * Usage:
 *   k6 run performance/k6-smoke.js
 *   k6 run performance/k6-smoke.js -e BASE_URL=http://localhost:18080/ai-assistant
 *
 * Env:
 *   BASE_URL  default http://localhost:8080/ai-assistant
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'http://localhost:8080/ai-assistant').replace(/\/$/, '');
const ORIGIN = BASE.replace(/\/ai-assistant\/?$/, '') || 'http://localhost:8080';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:assistant_health}': ['p(95)<400'],
    'http_req_duration{endpoint:actuator_liveness}': ['p(95)<400'],
  },
};

export default function () {
  const health = http.get(`${BASE}/health`, { tags: { endpoint: 'assistant_health' } });
  check(health, {
    'assistant health 200': (r) => r.status === 200,
    'assistant health body': (r) => {
      try {
        const j = JSON.parse(r.body);
        return j.success === true && j.status === 'running';
      } catch {
        return false;
      }
    },
  });

  const live = http.get(`${ORIGIN}/actuator/health/liveness`, {
    tags: { endpoint: 'actuator_liveness' },
  });
  check(live, {
    'actuator liveness 200': (r) => r.status === 200,
    'actuator UP': (r) => {
      try {
        return JSON.parse(r.body).status === 'UP';
      } catch {
        return false;
      }
    },
  });

  sleep(0.25);
}

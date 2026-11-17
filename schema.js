/*
 * Daily Pulse - shared schema, examples, validation and derived metrics.
 * Loaded via <script src> by index.html, prompt.html and pulse/report.html.
 *
 * Input JSON (only what the LLM/automation actually knows):
 *   date      string                       display label for the run date
 *   suites    [{ name, passed, total }]    per-suite results
 *   clusters  [{ type, name, count?, error?, actLink? }]   optional
 *   history   [{ label, passRate }]        optional, PREVIOUS days only (today is added automatically)
 *
 * Everything else (pass rate, unique/new/flaky counts, incident days) is derived
 * in derivePulse() so the headline numbers always match the breakdown.
 */

const CLUSTER_TYPES = ['NEW', 'REGRESSION', 'FLAKE', 'ENV'];
const INCIDENT_THRESHOLD = 80; // a day below this pass rate is flagged as an incident

const EXAMPLE = {
  date: 'Apr 17',
  suites: [
    { name: 'non_blocking_backend_cms', passed: 608, total: 652 },
    { name: 'non_blocking_frontend_cms', passed: 608, total: 656 },
    { name: 'components', passed: 150, total: 178 }
  ],
  clusters: [
    { type: 'NEW', name: 'Cart checkout timeout', count: 1, error: "TimeoutError: waiting for selector '#confirm-btn'", actLink: 'https://example.com/build/123' },
    { type: 'REGRESSION', name: 'Homepage hero image 404', count: 12, error: 'AssertionError: expected 200, got 404', actLink: 'https://example.com/build/124' },
    { type: 'FLAKE', name: 'Navigation dropdown hover', count: 9, error: 'Element not interactable', actLink: null },
    { type: 'ENV', name: 'DB connection noise', count: 4, error: 'ECONNREFUSED 127.0.0.1:5432', actLink: null }
  ],
  history: [
    { label: 'Apr 11', passRate: 92.0 },
    { label: 'Apr 14', passRate: 84.0 },
    { label: 'Apr 15', passRate: 87.0 },
    { label: 'Apr 16', passRate: 90.4 }
  ]
};

// A bad day: pass rate dip, several NEW clusters - exercises the red/incident states.
const EXAMPLE_INCIDENT = {
  date: 'Apr 18',
  suites: [
    { name: 'non_blocking_backend_cms', passed: 410, total: 652 },
    { name: 'non_blocking_frontend_cms', passed: 520, total: 656 },
    { name: 'components', passed: 150, total: 178 }
  ],
  clusters: [
    { type: 'NEW', name: 'Checkout API 500', count: 14, error: 'AssertionError: expected 200 got 500', actLink: 'https://example.com/build/201' },
    { type: 'NEW', name: 'Login timeout on Safari', count: 6, error: 'TimeoutError: waiting for selector', actLink: 'https://example.com/build/202' },
    { type: 'REGRESSION', name: 'Homepage hero image 404', count: 12, error: 'AssertionError: expected 200, got 404', actLink: null },
    { type: 'FLAKE', name: 'Navigation dropdown hover', count: 9, error: 'Element not interactable', actLink: null },
    { type: 'ENV', name: 'DB connection noise', count: 5, error: 'ECONNREFUSED 127.0.0.1:5432', actLink: null }
  ],
  history: [
    { label: 'Apr 14', passRate: 96.0 },
    { label: 'Apr 15', passRate: 95.0 },
    { label: 'Apr 16', passRate: 94.0 },
    { label: 'Apr 17', passRate: 91.9 }
  ]
};

/** Returns an array of human-readable problems (empty array = valid). */
function validatePulse(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ['Expected a JSON object.'];
  const errs = [];

  if (typeof d.date !== 'string' || !d.date) errs.push('"date" must be a non-empty string');

  if (!Array.isArray(d.suites) || d.suites.length === 0) {
    errs.push('"suites" must be a non-empty array');
  } else {
    d.suites.forEach((s, i) => {
      const ok = s && typeof s.name === 'string' && s.name &&
        Number.isFinite(s.passed) && Number.isFinite(s.total) &&
        s.total > 0 && s.passed >= 0 && s.passed <= s.total;
      if (!ok) errs.push(`suites[${i}] needs name, passed and total (0 ≤ passed ≤ total, total > 0)`);
    });
  }

  if (d.clusters !== undefined) {
    if (!Array.isArray(d.clusters)) {
      errs.push('"clusters" must be an array');
    } else {
      d.clusters.forEach((c, i) => {
        if (!c || !CLUSTER_TYPES.includes(c.type)) errs.push(`clusters[${i}].type must be one of ${CLUSTER_TYPES.join(', ')}`);
        else if (typeof c.name !== 'string' || !c.name) errs.push(`clusters[${i}].name must be a non-empty string`);
        else if (c.count !== undefined && !(Number.isInteger(c.count) && c.count > 0)) errs.push(`clusters[${i}].count must be a positive integer`);
        else if (c.actLink != null && !/^https?:\/\//i.test(c.actLink)) errs.push(`clusters[${i}].actLink must be an http(s) URL or null`);
      });
    }
  }

  if (d.history !== undefined) {
    if (!Array.isArray(d.history)) {
      errs.push('"history" must be an array of { label, passRate }');
    } else {
      d.history.forEach((h, i) => {
        const ok = h && typeof h.label === 'string' && Number.isFinite(h.passRate) && h.passRate >= 0 && h.passRate <= 100;
        if (!ok) errs.push(`history[${i}] needs label (string) and passRate (0–100)`);
      });
    }
  }

  return errs;
}

/** Computes every headline number from the validated input. */
function derivePulse(d) {
  const clusters = d.clusters || [];
  const countOf = type => clusters
    .filter(c => !type || c.type === type)
    .reduce((n, c) => n + (c.count || 1), 0);

  const passed = d.suites.reduce((n, s) => n + s.passed, 0);
  const total = d.suites.reduce((n, s) => n + s.total, 0);
  const passRate = Math.round((passed / total) * 1000) / 10;

  const history = [...(d.history || []), { label: d.date, passRate }];
  const incidentDays = history.reduce((acc, h, i) => (h.passRate < INCIDENT_THRESHOLD ? [...acc, i] : acc), []);

  return {
    passRate,
    uniqueFailures: countOf(),
    newFailures: countOf('NEW'),
    flakes: countOf('FLAKE'),
    clusterCount: clusters.length,
    history,
    incidentDays
  };
}

/** Strips ```json fences (the prompt asks for a fenced block, so pastes often include them). */
function stripFences(raw) {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

/** JSON.stringify with 2-space indent, but small objects inside arrays kept on one line. */
function formatJson(obj) {
  return JSON.stringify(obj, null, 2).replace(/\{\n\s+([^{}]*?)\n\s*\}/g, (m, inner) => '{ ' + inner.replace(/\n\s*/g, ' ') + ' }');
}

// Allows tests (Node) to import this file; ignored in the browser.
if (typeof module !== 'undefined') {
  module.exports = { CLUSTER_TYPES, INCIDENT_THRESHOLD, EXAMPLE, EXAMPLE_INCIDENT, validatePulse, derivePulse, stripFences, formatJson };
}

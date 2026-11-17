const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  EXAMPLE, EXAMPLE_INCIDENT, INCIDENT_THRESHOLD,
  validatePulse, derivePulse, stripFences, formatJson
} = require('../schema.js');

const clone = o => JSON.parse(JSON.stringify(o));

test('both examples are valid', () => {
  assert.deepEqual(validatePulse(EXAMPLE), []);
  assert.deepEqual(validatePulse(EXAMPLE_INCIDENT), []);
});

test('derivePulse: normal day', () => {
  const d = derivePulse(EXAMPLE);
  assert.equal(d.passRate, 91.9);
  assert.equal(d.uniqueFailures, 26);
  assert.equal(d.newFailures, 1);
  assert.equal(d.flakes, 9);
  assert.equal(d.clusterCount, 4);
  assert.deepEqual(d.incidentDays, []);
});

test('derivePulse: appends today as the last history point', () => {
  const d = derivePulse(EXAMPLE);
  assert.equal(d.history.length, EXAMPLE.history.length + 1);
  assert.deepEqual(d.history.at(-1), { label: EXAMPLE.date, passRate: d.passRate });
});

test('derivePulse: incident day', () => {
  const d = derivePulse(EXAMPLE_INCIDENT);
  assert.equal(d.passRate, 72.7);
  assert.equal(d.newFailures, 20);
  assert.ok(d.passRate < INCIDENT_THRESHOLD);
  assert.deepEqual(d.incidentDays, [d.history.length - 1]);
});

test('derivePulse: cluster count defaults to 1; clusters and history are optional', () => {
  const d = derivePulse({
    date: 'Apr 1',
    suites: [{ name: 's', passed: 9, total: 10 }],
    clusters: [{ type: 'NEW', name: 'x' }]
  });
  assert.equal(d.uniqueFailures, 1);
  assert.equal(d.passRate, 90);
  assert.deepEqual(d.history, [{ label: 'Apr 1', passRate: 90 }]);

  const bare = derivePulse({ date: 'Apr 1', suites: [{ name: 's', passed: 1, total: 1 }] });
  assert.equal(bare.uniqueFailures, 0);
  assert.equal(bare.clusterCount, 0);
});

test('validatePulse rejects bad input', () => {
  const bad = (mutate, pattern) => {
    const d = clone(EXAMPLE);
    mutate(d);
    const errs = validatePulse(d);
    assert.ok(errs.length > 0, `expected errors for ${pattern}`);
    assert.match(errs.join(' | '), pattern);
  };

  assert.deepEqual(validatePulse(null), ['Expected a JSON object.']);
  assert.deepEqual(validatePulse([]), ['Expected a JSON object.']);
  bad(d => { delete d.date; }, /date/);
  bad(d => { d.suites = []; }, /suites/);
  bad(d => { d.suites[0].passed = '608'; }, /suites\[0\]/);
  bad(d => { d.suites[0].passed = d.suites[0].total + 1; }, /suites\[0\]/);
  bad(d => { d.suites[0].total = 0; }, /suites\[0\]/);
  bad(d => { d.clusters[0].type = 'BOGUS'; }, /clusters\[0\]\.type/);
  bad(d => { d.clusters[0].count = 0; }, /count/);
  bad(d => { d.clusters[0].count = 1.5; }, /count/);
  bad(d => { d.clusters[0].actLink = 'javascript:alert(1)'; }, /actLink/);
  bad(d => { d.history = [92, 84]; }, /history\[0\]/);
  bad(d => { d.history[0].passRate = 101; }, /history\[0\]/);
});

test('stripFences unwraps a fenced json block', () => {
  const fenced = '```json\n{"a":1}\n```';
  assert.deepEqual(JSON.parse(stripFences(fenced)), { a: 1 });
  assert.deepEqual(JSON.parse(stripFences('  {"a":1}  ')), { a: 1 });
});

test('formatJson round-trips and the prompt example stays valid', () => {
  for (const ex of [EXAMPLE, EXAMPLE_INCIDENT]) {
    const out = formatJson(ex);
    assert.deepEqual(JSON.parse(out), ex);
    assert.deepEqual(validatePulse(JSON.parse(out)), []);
  }
});

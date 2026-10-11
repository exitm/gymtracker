const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorkoutActivityMap, getWorkoutDates } = require('../utils/workoutActivity');

test('counts completed log dates from imported database history', () => {
  const activity = buildWorkoutActivityMap([
    { date: '2026-09-01', status: 'COMPLETED' },
    { date: '2026-09-02', status: 'REST' },
  ], []);
  assert.deepEqual(activity, { '2026-09-01': 'COMPLETED' });
  assert.deepEqual(getWorkoutDates(activity), ['2026-09-01']);
});

test('uses exercise history when imported dates have no completed daily log', () => {
  const activity = buildWorkoutActivityMap([], [
    { date: '2026-09-01', name: '스쿼트' },
    { date: '2026-09-01', name: '벤치프레스' },
    { date: '2026-09-03', name: '걷기' },
  ]);
  assert.deepEqual(activity, { '2026-09-01': 'COMPLETED', '2026-09-03': 'COMPLETED' });
});

test('treats checked IN_PROGRESS dates as activity but excludes empty drafts and rest days', () => {
  const activity = buildWorkoutActivityMap([
    { date: '2026-09-01', status: 'IN_PROGRESS', progress_json: JSON.stringify([{ name: '스쿼트', isChecked: true }]) },
    { date: '2026-09-02', status: 'IN_PROGRESS', progress_json: JSON.stringify([{ name: '걷기', isChecked: false }]) },
    { date: '2026-09-03', status: 'REST', progress_json: null },
  ], []);
  assert.deepEqual(activity, { '2026-09-01': 'IN_PROGRESS' });
});

test('completed log takes precedence over progress and duplicate exercise rows count once', () => {
  const activity = buildWorkoutActivityMap([
    { date: '2026-09-01', status: 'COMPLETED', progress_json: null },
  ], [
    { date: '2026-09-01', name: '스쿼트' },
    { date: '2026-09-01', name: '스쿼트' },
  ]);
  assert.deepEqual(activity, { '2026-09-01': 'COMPLETED' });
  assert.equal(getWorkoutDates(activity).length, 1);
});

test('ignores malformed dates and empty imported exercise names', () => {
  const activity = buildWorkoutActivityMap(
    [{ date: '2026-99-99', status: 'COMPLETED' }, { date: 'bad-date', status: 'COMPLETED' }],
    [{ date: 'bad-date', name: '스쿼트' }, { date: '2026-09-01', name: ' ' }]
  );
  assert.deepEqual(activity, {});
});

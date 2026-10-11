const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorkoutActivityMap, getWorkoutDates } = require('../utils/workoutActivity');

const countActivities = (activity, dates) => dates.filter(date => ['COMPLETED', 'IN_PROGRESS'].includes(activity[date])).length;
const monthPercent = (dates, monthPrefix, daysInMonth) => Math.round((dates.filter(date => date.startsWith(monthPrefix)).length / daysInMonth) * 100);

test('weekly dashboard check and count use completed imported workout dates', () => {
  const activity = buildWorkoutActivityMap(
    [{ date: '2026-10-05', status: 'COMPLETED' }, { date: '2026-10-06', status: 'REST' }],
    []
  );
  const week = ['2026-10-05', '2026-10-06', '2026-10-07'];
  assert.equal(activity[week[0]], 'COMPLETED');
  assert.equal(activity[week[1]], undefined);
  assert.equal(countActivities(activity, week), 1);
});

test('monthly goal percentage includes both completed logs and imported exercise-only dates', () => {
  const activity = buildWorkoutActivityMap(
    [{ date: '2026-10-02', status: 'COMPLETED' }],
    [{ date: '2026-10-03', name: '스쿼트' }, { date: '2026-10-03', name: '벤치프레스' }]
  );
  const workoutDates = getWorkoutDates(activity);
  assert.equal(monthPercent(workoutDates, '2026-10', 31), 6);
});

test('dashboard aggregates each workout date once despite multiple exercise rows', () => {
  const activity = buildWorkoutActivityMap([], [
    { date: '2026-10-03', name: '스쿼트' },
    { date: '2026-10-03', name: '벤치프레스' },
  ]);
  assert.equal(countActivities(activity, ['2026-10-03']), 1);
  assert.equal(monthPercent(getWorkoutDates(activity), '2026-10', 31), 3);
});

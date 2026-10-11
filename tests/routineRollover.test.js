const test = require('node:test');
const assert = require('node:assert/strict');
const { rolloverUnfinalizedWorkout } = require('../utils/routineRollover');

const createDb = ({ log, routineIndex = 0 } = {}) => {
  const calls = [];
  let dailyLog = log ? { ...log } : null;
  let currentIndex = routineIndex;
  const db = {
    calls,
    async withExclusiveTransactionAsync(callback) {
      await callback({
        async getFirstAsync(sql, params) {
          if (sql.includes('SELECT status, routine_advanced, progress_json FROM daily_logs')) return dailyLog;
          if (sql.includes('SELECT value FROM settings')) return { value: String(currentIndex) };
          return null;
        },
        async runAsync(sql, params) {
          calls.push({ sql, params });
          if (sql.includes('UPDATE daily_logs SET routine_advanced = 1')) dailyLog = { ...dailyLog, routine_advanced: 1 };
          if (sql.includes('INSERT OR REPLACE INTO settings')) currentIndex = Number(params[0]);
        },
      });
    },
    async getFirstAsync(sql, params) {
      if (sql.includes('SELECT value FROM settings')) return { value: String(currentIndex) };
      return null;
    },
  };
  return { db, calls, get dailyLog() { return dailyLog; }, get currentIndex() { return currentIndex; } };
};

const rolloverAt = async (db, date, totalDays, today) => {
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return rolloverUnfinalizedWorkout(db, date, `${year}-${month}-${day}`, totalDays);
};

const tomorrow = new Date('2026-10-09T12:00:00');

test('advances exactly once on the next day when yesterday has checked in-progress exercises', async () => {
  const fake = createDb({
    routineIndex: 0,
    log: { status: 'IN_PROGRESS', routine_advanced: 0, progress_json: JSON.stringify([{ name: '스쿼트', isChecked: true }]) },
  });

  const first = await rolloverAt(fake.db, '2026-10-08', 3, new Date('2026-10-09T08:00:00'));
  const second = await rolloverAt(fake.db, '2026-10-08', 3, new Date('2026-10-09T10:00:00'));

  assert.deepEqual(first, { advanced: true, routineIndex: 1 });
  assert.deepEqual(second, { advanced: false, routineIndex: 1 });
  assert.equal(fake.currentIndex, 1);
  assert.equal(fake.calls.filter(call => call.sql.includes('UPDATE daily_logs SET routine_advanced = 1')).length, 1);
});

test('does not advance when calendar days pass without opening the workout screen', async () => {
  const fake = createDb({
    routineIndex: 1,
    log: { status: 'IN_PROGRESS', routine_advanced: 0, progress_json: JSON.stringify([{ name: '벤치프레스', isChecked: true }]) },
  });

  const result = await rolloverAt(fake.db, '2026-10-08', 3, new Date('2026-10-11T09:00:00'));

  assert.deepEqual(result, { advanced: false, routineIndex: 1 });
  assert.equal(fake.calls.length, 0);
});

test('does not advance when routine rollover is checked after a missed day', async () => {
  const fake = createDb({
    routineIndex: 1,
    log: { status: 'IN_PROGRESS', routine_advanced: 0, progress_json: JSON.stringify([{ name: '벤치프레스', isChecked: true }]) },
  });

  const result = await rolloverAt(fake.db, '2026-10-08', 3, new Date('2026-10-11T09:00:00'));

  assert.deepEqual(result, { advanced: false, routineIndex: 1 });
  assert.equal(fake.calls.length, 0);
});

test('does not advance for an in-progress draft with no checked exercises', async () => {
  const fake = createDb({
    routineIndex: 1,
    log: { status: 'IN_PROGRESS', routine_advanced: 0, progress_json: JSON.stringify([{ name: '벤치프레스', isChecked: false }]) },
  });

  const result = await rolloverAt(fake.db, '2026-10-08', 3, tomorrow);

  assert.deepEqual(result, { advanced: false, routineIndex: 1 });
  assert.equal(fake.calls.length, 0);
});

test('does not advance a completed day', async () => {
  const fake = createDb({
    routineIndex: 2,
    log: { status: 'COMPLETED', routine_advanced: 1, progress_json: null },
  });

  const result = await rolloverAt(fake.db, '2026-10-08', 3, tomorrow);

  assert.deepEqual(result, { advanced: false, routineIndex: 2 });
  assert.equal(fake.calls.length, 0);
});

test('does not advance before the next calendar day', async () => {
  const fake = createDb({
    routineIndex: 1,
    log: { status: 'IN_PROGRESS', routine_advanced: 0, progress_json: JSON.stringify([{ name: '벤치프레스', isChecked: true }]) },
  });

  const result = await rolloverAt(fake.db, '2026-10-08', 3, new Date('2026-10-08T22:00:00'));

  assert.deepEqual(result, { advanced: false, routineIndex: 1 });
  assert.equal(fake.calls.length, 0);
});



const test = require('node:test');
const assert = require('node:assert/strict');
const { saveWorkoutProgressToDb } = require('../utils/workoutProgressPersistence');

const makeDb = ({ initialIndex = 0, initialLog = null } = {}) => {
  const calls = [];
  let index = initialIndex;
  let dailyLog = initialLog;
  const exerciseLogs = [];
  const db = {
    calls,
    async withExclusiveTransactionAsync(callback) {
      await callback({
        async getFirstAsync(sql, params = []) {
          if (sql.includes('SELECT routine_advanced FROM daily_logs')) return dailyLog;
          if (sql.includes('SELECT value FROM settings')) return { value: String(index) };
          return null;
        },
        async runAsync(sql, params = []) {
          calls.push({ sql, params });
          if (sql.includes("VALUES (?, 'IN_PROGRESS'")) {
            dailyLog = { date: params[0], status: 'IN_PROGRESS', memo: params[1], water_consumed: params[2], progress_json: params[3], routine_advanced: Number(params[4]) };
            exerciseLogs.length = 0;
            return;
          }
          if (sql.includes('INSERT OR REPLACE INTO settings')) {
            index = Number(params[0]);
            return;
          }
          if (sql.includes('DELETE FROM exercise_logs')) {
            exerciseLogs.length = 0;
            return;
          }
          if (sql.includes('INSERT INTO exercise_logs')) {
            exerciseLogs.push({ date: params[0], name: params[1], type: params[2] });
            return;
          }
          if (sql.includes('UPDATE daily_logs SET routine_advanced = 1')) {
            dailyLog = { ...dailyLog, routine_advanced: 1 };
            return;
          }
          if (sql.includes('UPDATE daily_logs SET routine_advanced = 0')) {
            dailyLog = { ...dailyLog, routine_advanced: 0 };
            return;
          }
        },
      });
    },
  };
  return { db, calls, exerciseLogs, get dailyLog() { return dailyLog; }, get index() { return index; } };
};

test('checked exercise autosaves full draft and persists only checked entries in exercise history without changing routine yet', async () => {
  const fake = makeDb({ initialIndex: 0 });
  const exercises = [
    { id: 1, name: '스쿼트', type: 'WEIGHT', weight: '40', reps: '8', sets: '3', isChecked: true },
    { id: 2, name: '걷기', type: 'CARDIO', time: '10', isChecked: false },
  ];

  await saveWorkoutProgressToDb(fake.db, {
    date: '2026-10-08', memo: '', exercises, waterConsumed: 0,
  });

  assert.equal(fake.dailyLog.status, 'IN_PROGRESS');
  assert.equal(fake.dailyLog.routine_advanced, 0);
  assert.deepEqual(JSON.parse(fake.dailyLog.progress_json), exercises);
  assert.equal(fake.index, 0);
  assert.deepEqual(fake.exerciseLogs.map(row => row.name), ['스쿼트']);
});

test('saving a changed all-unchecked plan preserves the draft but creates no exercise history and does not advance', async () => {
  const fake = makeDb({ initialIndex: 2 });
  const exercises = [{ id: 1, name: '수정된 계획', type: 'WEIGHT', isChecked: false }];

  await saveWorkoutProgressToDb(fake.db, {
    date: '2026-10-08', memo: '', exercises, waterConsumed: 0,
  });

  assert.equal(fake.dailyLog.status, 'IN_PROGRESS');
  assert.equal(fake.dailyLog.routine_advanced, 0);
  assert.deepEqual(JSON.parse(fake.dailyLog.progress_json), exercises);
  assert.equal(fake.index, 2);
  assert.deepEqual(fake.exerciseLogs, []);
});

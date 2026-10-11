const test = require('node:test');
const assert = require('node:assert/strict');
const { rolloverUnfinalizedWorkout } = require('../utils/routineRollover');
const { saveWorkoutProgressToDb } = require('../utils/workoutProgressPersistence');
const lifecycleModule = require('../utils/workoutLifecycle');
lifecycleModule.rolloverUnfinalizedWorkout = (...args) => rolloverUnfinalizedWorkout(...args);
lifecycleModule.saveWorkoutProgressToDb = (...args) => saveWorkoutProgressToDb(...args);
const { createWorkoutLifecycleService } = lifecycleModule;


const draft = (names, checkedNames = names) => names.map((name, index) => ({
  id: index + 1,
  name,
  type: 'WEIGHT',
  weight: '20',
  reps: '8',
  sets: '3',
  isChecked: checkedNames.includes(name),
}));

const createFakeDb = () => {
  const dailyLogs = new Map();
  const progressByDate = new Map();
  const exerciseLogs = new Map();
  const calls = [];
  let routineIndex = 0;
  const db = {
    async withExclusiveTransactionAsync(callback) {
      const tx = {
        async getFirstAsync(sql, params) {
          if (sql.includes('SELECT status, routine_advanced, progress_json FROM daily_logs')) return dailyLogs.get(params[0]) || null;
          if (sql.includes('SELECT routine_advanced FROM daily_logs')) return { routine_advanced: dailyLogs.get(params[0])?.routine_advanced || 0 };
          if (sql.includes('SELECT value FROM settings')) return { value: String(routineIndex) };
          return null;
        },
        async runAsync(sql, params = []) {
          calls.push({ sql, params });
          if (sql.includes("VALUES (?, 'IN_PROGRESS'")) {
            const advanced = Number(params[4]) || 0;
            const progress = JSON.parse(params[3]);
            dailyLogs.set(params[0], { date: params[0], status: 'IN_PROGRESS', routine_advanced: advanced, memo: params[1], water_consumed: params[2], progress_json: params[3] });
            progressByDate.set(params[0], progress);
            return;
          }
          if (sql.includes("VALUES (?, 'COMPLETED'")) {
            dailyLogs.set(params[0], { date: params[0], status: 'COMPLETED', routine_advanced: 1, memo: params[1], water_consumed: params[2] });
            progressByDate.delete(params[0]);
            return;
          }
          if (sql.includes('UPDATE daily_logs SET routine_advanced = 1')) {
            const existing = dailyLogs.get(params[0]);
            dailyLogs.set(params[0], { ...existing, routine_advanced: 1 });
            return;
          }
          if (sql.includes('INSERT OR REPLACE INTO settings')) {
            routineIndex = Number(params[0]);
            return;
          }
          if (sql.includes('DELETE FROM exercise_logs WHERE date = ?')) {
            exerciseLogs.set(params[0], []);
            return;
          }
          if (sql.includes('INSERT INTO exercise_logs')) {
            const rows = exerciseLogs.get(params[0]) || [];
            rows.push({ date: params[0], name: params[1], type: params[2], actual_weight: params[3] });
            exerciseLogs.set(params[0], rows);
          }
        },
      };
      await callback(tx);
    },
    async getFirstAsync(sql, params) {
      if (sql.includes('SELECT * FROM daily_logs')) return dailyLogs.get(params[0]) || null;
      if (sql.includes('SELECT progress_json FROM daily_logs')) {
        const value = progressByDate.get(params[0]);
        return value ? { progress_json: JSON.stringify(value) } : null;
      }
      return null;
    },
    async getAllAsync(sql, params) {
      if (sql.includes('SELECT * FROM exercise_logs')) return exerciseLogs.get(params[0]) || [];
      if (sql.includes('SELECT date, status FROM daily_logs')) return [...dailyLogs.values()].map(({ date, status }) => ({ date, status }));
      return [];
    },

  };
  return { db, dailyLogs, progressByDate, exerciseLogs, calls };
};

test('autosaved checked workout advances routine on next-day entry exactly once and is shown on calendar', async () => {
  const fake = createFakeDb();
  const routine = { totalDays: 2, routineData: [draft(['Day 1 A']), draft(['Day 2 A'])] };
  let currentIndex = 0;
  const service = createWorkoutLifecycleService({
    db: fake.db,
    routine,
    getRoutineIndex: async () => currentIndex,
    setRoutineIndex: async next => { currentIndex = next; },
  });

  await service.saveProgress('2026-10-08', '', draft(['Day 1 A'], ['Day 1 A']), 0);
  assert.deepEqual(await service.getCalendarLogs(), { '2026-10-08': 'IN_PROGRESS' });
  assert.deepEqual(await service.getExercises('2026-10-08'), [{ date: '2026-10-08', name: 'Day 1 A', type: 'WEIGHT', actual_weight: 20 }]);
  assert.equal(currentIndex, 0);

  const rollover = await service.rollover('2026-10-08', '2026-10-09');
  assert.equal(rollover.advanced, true);
  assert.equal(rollover.routineIndex, 1);
  assert.deepEqual(rollover.nextDay.exercises.map(exercise => exercise.name), ['Day 2 A']);

  const repeated = await service.rollover('2026-10-08', '2026-10-09');
  assert.equal(repeated.advanced, false);
  assert.equal(repeated.routineIndex, 1);
  assert.equal(repeated.nextDay.routineIndex, 1);
  assert.equal(currentIndex, 1);
});

test('reopening the same date does not roll routine and completion does not double-advance', async () => {
  const fake = createFakeDb();
  const routine = { totalDays: 2, routineData: [draft(['Day 1 A']), draft(['Day 2 A'])] };
  let currentIndex = 0;
  const service = createWorkoutLifecycleService({
    db: fake.db,
    routine,
    getRoutineIndex: async () => currentIndex,
    setRoutineIndex: async next => { currentIndex = next; },
  });
  const exercises = draft(['Day 1 A'], ['Day 1 A']);

  await service.saveProgress('2026-10-08', '', exercises, 0);
  const sameDay = await service.rollover('2026-10-08', '2026-10-08');
  assert.equal(sameDay.advanced, false);
  assert.equal(currentIndex, 0);

  await service.complete('2026-10-08', '', exercises, 0);
  assert.equal(currentIndex, 1);
  const nextDay = await service.getTodayWorkout('2026-10-09');
  assert.equal(nextDay.routineIndex, 1);
  assert.deepEqual(nextDay.exercises.map(exercise => exercise.name), ['Day 2 A']);
});

test('reopening an in-progress date restores its partial draft, while completed date stays completed', async () => {
  const fake = createFakeDb();
  const routine = { totalDays: 2, routineData: [draft(['Plan A']), draft(['Plan B'])] };
  let currentIndex = 0;
  const service = createWorkoutLifecycleService({
    db: fake.db,
    routine,
    getRoutineIndex: async () => currentIndex,
    setRoutineIndex: async next => { currentIndex = next; },
  });

  await service.saveProgress('2026-10-08', '메모', draft(['Plan A', '추가 운동'], ['Plan A']), 200);
  const restored = await service.getTodayWorkout('2026-10-08');
  assert.equal(restored.status, 'IN_PROGRESS');
  assert.deepEqual(restored.exercises.map(exercise => [exercise.name, exercise.isChecked]), [['Plan A', true], ['추가 운동', false]]);

  await service.complete('2026-10-08', '메모', [draft(['Plan A'])[0]], 200);
  assert.equal((await service.getCalendarLogs())['2026-10-08'], 'COMPLETED');
  assert.equal(fake.progressByDate.has('2026-10-08'), false);
});

test('all-unchecked plan edits are saved as a draft and never advance routine until a checked workout completes', async () => {
  const fake = createFakeDb();
  let currentIndex = 0;
  const routine = { totalDays: 2, routineData: [draft(['Plan A', 'Plan B']), draft(['Plan C'])] };
  const service = createWorkoutLifecycleService({
    db: fake.db,
    routine,
    getRoutineIndex: async () => currentIndex,
    setRoutineIndex: async next => { currentIndex = next; },
  });

  const modifiedPlan = draft(['Plan A'], []);
  await service.saveProgress('2026-10-08', '', modifiedPlan, 0);
  const reopened = await service.getTodayWorkout('2026-10-08');
  assert.deepEqual(reopened.exercises, modifiedPlan);
  assert.equal((await service.getTodayWorkout('2026-10-09')).exercises[0].name, 'Plan A');
  assert.equal(currentIndex, 0);
});

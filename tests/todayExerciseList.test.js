const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTodayExerciseList } = require('../utils/todayExerciseList');

test('in-progress database draft is authoritative over checked-only history and stale legacy cache', () => {
  const draft = [
    { id: 1, name: '스쿼트', isChecked: true },
    { id: 2, name: '새로 추가한 운동', isChecked: false },
  ];
  const result = resolveTodayExerciseList({
    dailyLog: { status: 'IN_PROGRESS' },
    savedExercises: [{ id: 10, name: '스쿼트' }],
    draftExercises: draft,
    legacyProgress: { date: '2026-10-08', exercises: [{ id: 3, name: '오래된 삭제 운동' }] },
    today: '2026-10-08',
    plannedExercises: [{ id: 20, name: '계획 운동' }],
  });

  assert.deepEqual(result, draft);
});

test('empty in-progress draft remains empty instead of resurrecting deleted or planned exercises', () => {
  const result = resolveTodayExerciseList({
    dailyLog: { status: 'IN_PROGRESS' },
    savedExercises: [{ id: 10, name: '과거 완료 운동' }],
    draftExercises: [],
    legacyProgress: { date: '2026-10-08', exercises: [{ id: 3, name: '삭제한 운동' }] },
    today: '2026-10-08',
    plannedExercises: [{ id: 20, name: '계획 운동' }],
  });

  assert.deepEqual(result, []);
});

test('completed workout uses committed exercise history and ignores stale progress cache', () => {
  const completed = [{ id: 1, name: '저장 완료 운동' }];
  const result = resolveTodayExerciseList({
    dailyLog: { status: 'COMPLETED' },
    savedExercises: completed,
    draftExercises: [{ id: 2, name: '오래된 임시 운동' }],
    legacyProgress: { date: '2026-10-08', exercises: [{ id: 3, name: '더 오래된 캐시' }] },
    today: '2026-10-08',
    plannedExercises: [{ id: 20, name: '계획 운동' }],
  });

  assert.deepEqual(result, completed);
});

test('without a database draft, uses only a matching-date legacy progress cache', () => {
  const cached = [{ id: 1, name: '오늘 진행 운동' }];
  const result = resolveTodayExerciseList({
    dailyLog: null,
    savedExercises: [],
    draftExercises: null,
    legacyProgress: { date: '2026-10-08', exercises: cached },
    today: '2026-10-08',
    plannedExercises: [{ id: 20, name: '계획 운동' }],
  });

  assert.deepEqual(result, cached);
});

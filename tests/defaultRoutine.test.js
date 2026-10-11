const test = require('node:test');
const assert = require('node:assert/strict');
const { seedDefaultRoutineIfNeeded } = require('../utils/defaultRoutineSeeder');
const defaultRoutine = require('../assets/defaultRoutine.json');

const createDb = ({ hasTemplates = false } = {}) => {
  const calls = [];
  const db = {
    calls,
    async getFirstAsync(sql) {
      calls.push({ type: 'read', sql });
      return hasTemplates ? { id: 9 } : null;
    },
    async withExclusiveTransactionAsync(callback) {
      calls.push({ type: 'transaction' });
      let insertedTemplate = false;
      await callback({
        async getFirstAsync(sql) {
          calls.push({ type: 'transaction-read', sql });
          return insertedTemplate ? { id: 1 } : null;
        },
        async runAsync(sql, params) {
          calls.push({ type: 'write', sql, params });
          if (sql.includes('INSERT INTO routine_templates')) {
            insertedTemplate = true;
            return { lastInsertRowId: 1 };
          }
          return { lastInsertRowId: 0 };
        },
      });
    },
  };
  return db;
};

test('빈 DB에 첨부 기본 루틴 3일과 22개 운동을 한 번 시드한다', async () => {
  const db = createDb();

  const seeded = await seedDefaultRoutineIfNeeded(db, defaultRoutine);

  assert.equal(seeded, true);
  assert.equal(db.calls.filter(call => call.type === 'transaction').length, 1);
  const writes = db.calls.filter(call => call.type === 'write');
  assert.equal(writes.filter(call => call.sql.includes('INSERT INTO routine_templates')).length, 1);
  const exerciseWrites = writes.filter(call => call.sql.includes('INSERT INTO template_exercises'));
  assert.equal(exerciseWrites.length, 22);
  assert.equal(writes[0].params[0], '기본 루틴');
  assert.equal(writes[0].params[1], 3);
  assert.deepEqual(exerciseWrites[0].params, [1, 0, '걷기', 'CARDIO', 0, 0, 0, 10, 6.5, 0]);
});

test('기존 템플릿이 있으면 기본 루틴을 추가하지 않는다', async () => {
  const db = createDb({ hasTemplates: true });

  const seeded = await seedDefaultRoutineIfNeeded(db, defaultRoutine);

  assert.equal(seeded, false);
  assert.equal(db.calls.filter(call => call.type === 'transaction').length, 0);
  assert.equal(db.calls.filter(call => call.type === 'write').length, 0);
});

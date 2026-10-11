export const seedDefaultRoutineIfNeeded = async (db, defaultRoutine) => {
  const existingTemplate = await db.getFirstAsync(
    'SELECT id FROM routine_templates LIMIT 1;'
  );
  if (existingTemplate) return false;

  await db.withExclusiveTransactionAsync(async (transaction) => {
    // Recheck inside the write transaction so simultaneous startup calls stay idempotent.
    const templateCreated = await transaction.getFirstAsync(
      'SELECT id FROM routine_templates LIMIT 1;'
    );
    if (templateCreated) return;

    await transaction.runAsync(
      'INSERT INTO routine_templates (name, total_days, is_active) VALUES (?, ?, 1);',
      [defaultRoutine.name, defaultRoutine.totalDays]
    );
    const template = await transaction.getFirstAsync(
      'SELECT id FROM routine_templates WHERE is_active = 1 LIMIT 1;'
    );
    if (!template) throw new Error('기본 루틴 템플릿 생성 후 ID를 찾지 못했습니다.');

    for (let dayIndex = 0; dayIndex < defaultRoutine.routineData.length; dayIndex += 1) {
      for (const exercise of defaultRoutine.routineData[dayIndex]) {
        await transaction.runAsync(
          `INSERT INTO template_exercises
            (template_id, day_index, name, type, weight, reps, sets, time, speed, distance)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            template.id,
            dayIndex,
            exercise.name,
            exercise.type || 'WEIGHT',
            Number(exercise.weight) || 0,
            Number(exercise.reps) || 0,
            Number(exercise.sets) || 0,
            Number(exercise.time) || 0,
            Number(exercise.speed) || 0,
            Number(exercise.distance) || 0,
          ]
        );
      }
    }
  });

  return true;
};

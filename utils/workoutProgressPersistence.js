export const saveWorkoutProgressToDb = async (db, { date, memo, exercises, waterConsumed }) => {
  const draftExercises = Array.isArray(exercises) ? exercises : [];
  const checkedExercises = draftExercises.filter(exercise => exercise.isChecked && exercise.name && exercise.name.trim() !== '');
  const serializedExercises = JSON.stringify(draftExercises);

  await db.withExclusiveTransactionAsync(async transaction => {
    const previousLog = await transaction.getFirstAsync(
      `SELECT routine_advanced FROM daily_logs WHERE date = ?;`,
      [date]
    );
    const routineAdvanced = previousLog?.routine_advanced === 1 ? 1 : 0;

    await transaction.runAsync(
      `INSERT OR REPLACE INTO daily_logs (date, status, memo, water_consumed, progress_json, routine_advanced) VALUES (?, 'IN_PROGRESS', ?, ?, ?, ?);`,
      [date, memo, waterConsumed, serializedExercises, routineAdvanced]
    );
    await transaction.runAsync(`DELETE FROM exercise_logs WHERE date = ?;`, [date]);

    for (const exercise of checkedExercises) {
      await transaction.runAsync(
        `INSERT INTO exercise_logs (date, name, type, actual_weight, actual_reps, actual_sets, actual_time, actual_speed, actual_distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [date, exercise.name.trim(), exercise.type || 'WEIGHT', parseFloat(exercise.weight) || 0, parseFloat(exercise.reps) || 0, parseFloat(exercise.sets) || 0, parseFloat(exercise.time) || 0, parseFloat(exercise.speed) || 0, parseFloat(exercise.distance) || 0]
      );
    }
  });

  return true;
};

const dateDistanceInDays = (fromDate, toDate) => {
  const from = new Date(`${fromDate}T12:00:00`);
  const to = new Date(`${toDate}T12:00:00`);
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
};

export const rolloverUnfinalizedWorkout = async (db, date, nextDate, totalDays) => {
  const safeTotalDays = Math.max(1, Number(totalDays) || 1);
  if (!nextDate || dateDistanceInDays(date, nextDate) !== 1) {
    const settingsIndex = await db.getFirstAsync(
      `SELECT value FROM settings WHERE key = 'current_routine_day_index';`
    );
    return { advanced: false, routineIndex: Number.parseInt(settingsIndex?.value || '0', 10) || 0 };
  }

  let result = { advanced: false, routineIndex: 0 };
  await db.withExclusiveTransactionAsync(async transaction => {
    const dailyLog = await transaction.getFirstAsync(
      `SELECT status, routine_advanced, progress_json FROM daily_logs WHERE date = ?;`,
      [date]
    );
    const settingsIndex = await transaction.getFirstAsync(
      `SELECT value FROM settings WHERE key = 'current_routine_day_index';`
    );
    const currentIndex = Number.parseInt(settingsIndex?.value || '0', 10) || 0;
    result = { advanced: false, routineIndex: currentIndex };

    if (dailyLog?.status !== 'IN_PROGRESS' || dailyLog.routine_advanced === 1 || !dailyLog.progress_json) return;

    let draft;
    try {
      draft = JSON.parse(dailyLog.progress_json);
    } catch {
      return;
    }
    if (!Array.isArray(draft) || !draft.some(exercise => exercise.isChecked && exercise.name?.trim())) return;

    const nextIndex = (currentIndex + 1) % safeTotalDays;
    await transaction.runAsync(
      `UPDATE daily_logs SET routine_advanced = 1 WHERE date = ? AND status = 'IN_PROGRESS' AND routine_advanced = 0;`,
      [date]
    );
    await transaction.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('current_routine_day_index', ?);`,
      [String(nextIndex)]
    );
    result = { advanced: true, routineIndex: nextIndex };
  });

  return result;
};

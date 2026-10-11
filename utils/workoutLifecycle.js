import { rolloverUnfinalizedWorkout } from './routineRollover.js';
import { saveWorkoutProgressToDb } from './workoutProgressPersistence.js';

const normalizeExercises = exercises => Array.isArray(exercises) ? exercises : [];

export const createWorkoutLifecycleService = ({ db, routine, getRoutineIndex, setRoutineIndex }) => {
  const saveProgress = async (date, memo, exercises, waterConsumed) => {
    return saveWorkoutProgressToDb(db, { date, memo, exercises, waterConsumed });
  };

  const getCalendarLogs = async () => {
    const rows = await db.getAllAsync(`SELECT date, status FROM daily_logs;`);
    return Object.fromEntries(rows.map(row => [row.date, row.status]));
  };

  const getExercises = async date => db.getAllAsync(`SELECT * FROM exercise_logs WHERE date = ?;`, [date]);

  const getDraft = async date => {
    const row = await db.getFirstAsync(`SELECT progress_json FROM daily_logs WHERE date = ?;`, [date]);
    if (!row?.progress_json) return null;
    try {
      const parsed = JSON.parse(row.progress_json);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const getTodayWorkout = async date => {
    const dailyLog = await db.getFirstAsync(`SELECT * FROM daily_logs WHERE date = ?;`, [date]);
    const currentIndex = await getRoutineIndex();

    if (dailyLog?.status === 'REST') return { status: 'REST', routineIndex: currentIndex, exercises: [] };
    if (dailyLog?.status === 'IN_PROGRESS') {
      return { status: 'IN_PROGRESS', routineIndex: currentIndex, exercises: (await getDraft(date)) || [] };
    }
    if (dailyLog?.status === 'COMPLETED') {
      const saved = await getExercises(date);
      return { status: 'COMPLETED', routineIndex: currentIndex, exercises: saved.map(exercise => ({ ...exercise, isChecked: true })) };
    }

    const totalDays = Math.max(1, routine?.totalDays || 1);
    const plannedExercises = routine?.routineData?.[currentIndex % totalDays] || [];
    return {
      status: null,
      routineIndex: currentIndex,
      exercises: plannedExercises.map((exercise, index) => ({ id: `planned-${date}-${index}`, ...exercise, isChecked: false })),
    };
  };

  const complete = async (date, memo, exercises, waterConsumed) => {
    const checked = normalizeExercises(exercises).filter(exercise => exercise.isChecked && exercise.name?.trim());
    if (checked.length === 0) throw new Error('체크된 유효한 운동이 없습니다.');

    const dailyLog = await db.getFirstAsync(`SELECT status, routine_advanced FROM daily_logs WHERE date = ?;`, [date]);
    const currentIndex = await getRoutineIndex();
    await db.withExclusiveTransactionAsync(async transaction => {
      await transaction.runAsync(
        `INSERT OR REPLACE INTO daily_logs (date, status, memo, water_consumed, progress_json, routine_advanced) VALUES (?, 'COMPLETED', ?, ?, NULL, 1);`,
        [date, memo, waterConsumed]
      );
      await transaction.runAsync(`DELETE FROM exercise_logs WHERE date = ?;`, [date]);
      for (const exercise of checked) {
        await transaction.runAsync(
          `INSERT INTO exercise_logs (date, name, type, actual_weight, actual_reps, actual_sets, actual_time, actual_speed, actual_distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [date, exercise.name.trim(), exercise.type || 'WEIGHT', parseFloat(exercise.weight) || 0, parseFloat(exercise.reps) || 0, parseFloat(exercise.sets) || 0, parseFloat(exercise.time) || 0, parseFloat(exercise.speed) || 0, parseFloat(exercise.distance) || 0]
        );
      }
      if (dailyLog?.status !== 'COMPLETED' && dailyLog?.routine_advanced !== 1 && routine?.totalDays) {
        const nextIndex = (currentIndex + 1) % routine.totalDays;
        await transaction.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('current_routine_day_index', ?);`, [String(nextIndex)]);
        if (typeof setRoutineIndex === 'function') await setRoutineIndex(nextIndex);
      }
    });
    return true;
  };

  const rollover = async (date, nextDate) => {
    const totalDays = routine?.totalDays || 0;
    if (totalDays <= 0) return { advanced: false, routineIndex: await getRoutineIndex(), nextDay: nextDate ? await getTodayWorkout(nextDate) : null };
    const result = await rolloverUnfinalizedWorkout(db, date, nextDate, totalDays);
    if (result.advanced && typeof setRoutineIndex === 'function') await setRoutineIndex(result.routineIndex);
    return { ...result, nextDay: nextDate ? await getTodayWorkout(nextDate) : null };
  };

  return { saveProgress, getCalendarLogs, getExercises, getDraft, getTodayWorkout, complete, rollover };
};

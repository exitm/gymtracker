const hasCheckedExercise = progressJson => {
  if (typeof progressJson !== 'string' || !progressJson) return false;
  try {
    const exercises = JSON.parse(progressJson);
    return Array.isArray(exercises) && exercises.some(exercise =>
      exercise?.isChecked === true && typeof exercise.name === 'string' && exercise.name.trim().length > 0
    );
  } catch {
    return false;
  }
};

export const isWorkoutDateValue = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export const buildWorkoutActivityMap = (dailyLogs = [], exerciseLogs = []) => {
  const exercisesByDate = new Set(
    exerciseLogs
      .filter(exercise => isWorkoutDateValue(exercise?.date) && typeof exercise.name === 'string' && exercise.name.trim().length > 0)
      .map(exercise => exercise.date)
  );
  const activity = {};
  const restDates = new Set();

  for (const log of dailyLogs) {
    if (!isWorkoutDateValue(log?.date)) continue;
    if (log.status === 'REST') {
      restDates.add(log.date);
    } else if (log.status === 'COMPLETED') {
      activity[log.date] = 'COMPLETED';
    } else if (log.status === 'IN_PROGRESS' && (exercisesByDate.has(log.date) || hasCheckedExercise(log.progress_json))) {
      activity[log.date] = 'IN_PROGRESS';
    }
  }

  for (const date of exercisesByDate) {
    if (!activity[date] && !restDates.has(date)) activity[date] = 'COMPLETED';
  }

  return activity;
};

export const isWorkoutActivityStatus = status => status === 'COMPLETED' || status === 'IN_PROGRESS';

export const getWorkoutDates = activityMap => Object.keys(activityMap || {}).sort();

export const resolveTodayExerciseList = ({
  dailyLog,
  savedExercises = [],
  draftExercises,
  legacyProgress,
  today,
  plannedExercises = [],
}) => {
  if (dailyLog?.status === 'REST') return [];
  if (dailyLog?.status === 'COMPLETED') return savedExercises;
  if (dailyLog?.status === 'IN_PROGRESS') return Array.isArray(draftExercises) ? draftExercises : [];

  if (legacyProgress?.date === today && Array.isArray(legacyProgress.exercises)) {
    return legacyProgress.exercises;
  }
  if (savedExercises.length > 0) return savedExercises;
  return plannedExercises;
};

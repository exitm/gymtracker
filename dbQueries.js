// dbQueries.js
import * as SQLite from 'expo-sqlite';

// 🌟 최상단에서 강제로 열지 않고, 필요할 때 연결하도록 변수만 선언합니다.
let dbInstance = null;

// 🌟 데이터베이스를 비동기식으로 부드럽게 여는 함수
const getDB = async () => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('workout_tracker_v3.db');
  }
  return dbInstance;
};

export const initDB = async () => {
  try {
    const db = await getDB(); // 🌟 연결 호출
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_name TEXT, height REAL, weight REAL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY, value TEXT
      );
      CREATE TABLE IF NOT EXISTS daily_logs (
        date TEXT PRIMARY KEY, status TEXT, memo TEXT, water_consumed INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS exercise_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, name TEXT, type TEXT, 
        actual_weight REAL, actual_reps REAL, actual_sets REAL, actual_time REAL, actual_speed REAL, actual_distance REAL
      );
      CREATE TABLE IF NOT EXISTS routine_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, total_days INTEGER, is_active INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS template_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT, template_id INTEGER, day_index INTEGER, name TEXT, type TEXT, 
        weight REAL, reps REAL, sets REAL, time REAL, speed REAL, distance REAL
      );
    `);
    return true;
  } catch (error) {
    console.error('DB Initialization Error:', error);
    throw error;
  }
};

export const getSettings = async () => {
  try {
    const db = await getDB();
    const rows = await db.getAllAsync(`SELECT * FROM settings;`);
    const settings = {
      user_name: '사용자', height: 170, weight: 65, weekly_goal: 5, water_goal: 900,
      is_dark_mode: 0, is_long_term_pause: 0, current_routine_day_index: 0, rest_timer: 60,
      gym_lat: null, gym_lng: null
    };
    
    rows.forEach(item => {
      if (item.key === 'user_name') settings.user_name = item.value;
      if (item.key === 'height') settings.height = parseFloat(item.value);
      if (item.key === 'weight') settings.weight = parseFloat(item.value);
      if (item.key === 'weekly_goal') settings.weekly_goal = parseInt(item.value);
      if (item.key === 'water_goal') settings.water_goal = parseInt(item.value);
      if (item.key === 'is_dark_mode') settings.is_dark_mode = parseInt(item.value);
      if (item.key === 'is_long_term_pause') settings.is_long_term_pause = parseInt(item.value);
      if (item.key === 'current_routine_day_index') settings.current_routine_day_index = parseInt(item.value);
      if (item.key === 'rest_timer') settings.rest_timer = parseInt(item.value);
      if (item.key === 'gym_lat') settings.gym_lat = item.value ? parseFloat(item.value) : null;
      if (item.key === 'gym_lng') settings.gym_lng = item.value ? parseFloat(item.value) : null;
    });
    return settings;
  } catch (error) {
    console.error('getSettings Error:', error);
    return { user_name: '사용자', height: 170, weight: 65, weekly_goal: 5, water_goal: 900, is_dark_mode: 0, is_long_term_pause: 0, current_routine_day_index: 0, rest_timer: 60 };
  }
};

export const updateSetting = async (key, value) => {
  const db = await getDB();
  await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);`, [key, String(value)]);
  return true;
};

export const updateProfile = async (name, height, weight) => {
  const db = await getDB();
  await db.runAsync(`DELETE FROM profile;`);
  await db.runAsync(`INSERT INTO profile (user_name, height, weight) VALUES (?, ?, ?);`, [name, height, weight]);
  return true;
};

export const getDailyLogForDate = async (dateStr) => {
  const db = await getDB();
  const row = await db.getFirstAsync(`SELECT * FROM daily_logs WHERE date = ?;`, [dateStr]);
  return row || null;
};

export const getExercisesForDate = async (dateStr) => {
  const db = await getDB();
  return await db.getAllAsync(`SELECT * FROM exercise_logs WHERE date = ?;`, [dateStr]);
};

export const saveWorkoutLog = async (dateStr, status, memo, exercises, waterConsumed) => {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO daily_logs (date, status, memo, water_consumed) VALUES (?, ?, ?, ?);`,
    [dateStr, status, memo, waterConsumed]
  );
  await db.runAsync(`DELETE FROM exercise_logs WHERE date = ?;`, [dateStr]);
  
  for (const ex of exercises) {
    await db.runAsync(
      `INSERT INTO exercise_logs (date, name, type, actual_weight, actual_reps, actual_sets, actual_time, actual_speed, actual_distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [dateStr, ex.name, ex.type, parseFloat(ex.weight) || 0, parseFloat(ex.reps) || 0, parseFloat(ex.sets) || 0, parseFloat(ex.time) || 0, parseFloat(ex.speed) || 0, parseFloat(ex.distance) || 0]
    );
  }
  return true;
};

export const saveRestDayLog = async (dateStr, memo, waterConsumed) => {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO daily_logs (date, status, memo, water_consumed) VALUES (?, 'REST', ?, ?);`,
    [dateStr, memo, waterConsumed]
  );
  await db.runAsync(`DELETE FROM exercise_logs WHERE date = ?;`, [dateStr]);
  return true;
};

export const deleteDailyLog = async (dateStr) => {
  const db = await getDB();
  await db.runAsync(`DELETE FROM daily_logs WHERE date = ?;`, [dateStr]);
  await db.runAsync(`DELETE FROM exercise_logs WHERE date = ?;`, [dateStr]);
  return true;
};

export const getAllLogsForCalendar = async () => {
  const db = await getDB();
  const rows = await db.getAllAsync(`SELECT date, status FROM daily_logs;`);
  const map = {};
  rows.forEach(item => { map[item.date] = item.status; });
  return map;
};

export const getAllCompletedDatesForStats = async () => {
  const db = await getDB();
  const rows = await db.getAllAsync(`SELECT date FROM daily_logs WHERE status = 'COMPLETED';`);
  return rows.map(i => i.date);
};

export const getWeeklyLogsStatus = async (dateArr) => {
  if (!dateArr || dateArr.length === 0) return {};
  const db = await getDB();
  const placeholders = dateArr.map(() => '?').join(',');
  const query = `SELECT date, status FROM daily_logs WHERE date IN (${placeholders});`;
  const rows = await db.getAllAsync(query, dateArr);
  
  const map = {};
  rows.forEach(item => { map[item.date] = item.status; });
  return map;
};

export const getWeeklyWaterAverage = async () => {
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  
  const db = await getDB();
  const placeholders = dates.map(() => '?').join(',');
  const rows = await db.getAllAsync(`SELECT water_consumed FROM daily_logs WHERE date IN (${placeholders});`, dates);
  
  if (rows.length === 0) return 0;
  const total = rows.reduce((acc, cur) => acc + (cur.water_consumed || 0), 0);
  return Math.round(total / 7);
};

export const getAllTemplates = async () => {
  const db = await getDB();
  return await db.getAllAsync(`SELECT * FROM routine_templates;`);
};

export const setActiveTemplate = async (templateId) => {
  const db = await getDB();
  await db.runAsync(`UPDATE routine_templates SET is_active = 0;`);
  await db.runAsync(`UPDATE routine_templates SET is_active = 1 WHERE id = ?;`, [templateId]);
  return true;
};

const fetchExercisesForTemplate = async (templateId, totalDays) => {
  const db = await getDB();
  const rows = await db.getAllAsync(`SELECT * FROM template_exercises WHERE template_id = ?;`, [templateId]);
  const routineData = Array.from({ length: totalDays }, () => []);
  
  rows.forEach(ex => {
    if (ex.day_index >= 0 && ex.day_index < totalDays) {
      routineData[ex.day_index].push({
        name: ex.name, type: ex.type, weight: ex.weight, reps: ex.reps, sets: ex.sets, time: ex.time, speed: ex.speed, distance: ex.distance
      });
    }
  });
  return { id: templateId, totalDays, routineData };
};

export const getActiveRoutineTemplate = async () => {
  const db = await getDB();
  let activeT = await db.getFirstAsync(`SELECT * FROM routine_templates WHERE is_active = 1 LIMIT 1;`);
  
  if (!activeT) {
    activeT = await db.getFirstAsync(`SELECT * FROM routine_templates LIMIT 1;`);
    if (activeT) {
      await db.runAsync(`UPDATE routine_templates SET is_active = 1 WHERE id = ?;`, [activeT.id]);
    }
  }
  
  if (!activeT) return null;
  return await fetchExercisesForTemplate(activeT.id, activeT.total_days);
};

export const saveNewRoutineTemplate = async (name, totalDays, routineData) => {
  const db = await getDB();
  await db.runAsync(`UPDATE routine_templates SET is_active = 0;`);
  const result = await db.runAsync(
    `INSERT INTO routine_templates (name, total_days, is_active) VALUES (?, ?, 1);`,
    [name, totalDays]
  );
  
  const templateId = result.lastInsertRowId;
  
  for (let dayIndex = 0; dayIndex < routineData.length; dayIndex++) {
    const dayExercises = routineData[dayIndex];
    for (const ex of dayExercises) {
      await db.runAsync(
        `INSERT INTO template_exercises (template_id, day_index, name, type, weight, reps, sets, time, speed, distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [templateId, dayIndex, ex.name, ex.type, parseFloat(ex.weight) || 0, parseFloat(ex.reps) || 0, parseFloat(ex.sets) || 0, parseFloat(ex.time) || 0, parseFloat(ex.speed) || 0, parseFloat(ex.distance) || 0]
      );
    }
  }
  return templateId;
};

export const getRoutineTemplateById = async (templateId) => {
  const db = await getDB();
  const template = await db.getFirstAsync(`SELECT * FROM routine_templates WHERE id = ?;`, [templateId]);
  if (!template) return null;
  return await fetchExercisesForTemplate(template.id, template.total_days);
};

export const updateRoutineTemplate = async (templateId, name, totalDays, routineData) => {
  const db = await getDB();
  await db.runAsync(`UPDATE routine_templates SET name = ?, total_days = ? WHERE id = ?;`, [name, totalDays, templateId]);
  await db.runAsync(`DELETE FROM template_exercises WHERE template_id = ?;`, [templateId]);
  
  for (let dayIndex = 0; dayIndex < routineData.length; dayIndex++) {
    const dayExercises = routineData[dayIndex];
    for (const ex of dayExercises) {
      await db.runAsync(
        `INSERT INTO template_exercises (template_id, day_index, name, type, weight, reps, sets, time, speed, distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [templateId, dayIndex, ex.name, ex.type, parseFloat(ex.weight) || 0, parseFloat(ex.reps) || 0, parseFloat(ex.sets) || 0, parseFloat(ex.time) || 0, parseFloat(ex.speed) || 0, parseFloat(ex.distance) || 0]
      );
    }
  }
  return true;
};

export const deleteRoutineTemplate = async (templateId) => {
  const db = await getDB();
  await db.runAsync(`DELETE FROM routine_templates WHERE id = ?;`, [templateId]);
  await db.runAsync(`DELETE FROM template_exercises WHERE template_id = ?;`, [templateId]);
  return true;
};

export const restoreSettingsAndTemplates = async (parsedData) => {
  const db = await getDB();
  if (parsedData.settings) {
    for (const key of Object.keys(parsedData.settings)) {
      await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);`, [key, String(parsedData.settings[key])]);
    }
  }
  
  if (parsedData.templates && Array.isArray(parsedData.templates)) {
    for (const t of parsedData.templates) {
      await db.runAsync(
        `INSERT OR REPLACE INTO routine_templates (id, name, total_days, is_active) VALUES (?, ?, ?, ?);`,
        [t.id, t.name, t.totalDays, t.id === 1 ? 1 : 0]
      );
      await db.runAsync(`DELETE FROM template_exercises WHERE template_id = ?;`, [t.id]);
      
      if (t.routineData && Array.isArray(t.routineData)) {
        for (let dayIdx = 0; dayIdx < t.routineData.length; dayIdx++) {
          const dayExs = t.routineData[dayIdx];
          for (const ex of dayExs) {
            await db.runAsync(
              `INSERT INTO template_exercises (template_id, day_index, name, type, weight, reps, sets, time, speed, distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              [t.id, dayIdx, ex.name, ex.type || 'WEIGHT', parseFloat(ex.weight) || 0, parseFloat(ex.reps) || 0, parseFloat(ex.sets) || 0, parseFloat(ex.time) || 0, parseFloat(ex.speed) || 0, parseFloat(ex.distance) || 0]
            );
          }
        }
      }
    }
  }
  return true;
};
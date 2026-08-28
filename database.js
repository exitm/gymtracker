// database.js
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('workout_tracker.db');

export const initDB = async () => {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Settings (
        id INTEGER PRIMARY KEY NOT NULL,
        height REAL, weight REAL, is_dark_mode INTEGER DEFAULT 0,
        is_long_term_pause INTEGER DEFAULT 0, gym_lat REAL, gym_lng REAL,
        current_routine_day_index INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS RoutineTemplate (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, total_days INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS RoutineExercise (
        id INTEGER PRIMARY KEY AUTOINCREMENT, template_id INTEGER,
        day_index INTEGER NOT NULL, name TEXT NOT NULL, type TEXT DEFAULT 'WEIGHT', 
        target_weight REAL, target_reps INTEGER, target_sets INTEGER, target_speed REAL, target_time INTEGER
      );
      CREATE TABLE IF NOT EXISTS DailyLog (
        date TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL, memo TEXT
      );
      CREATE TABLE IF NOT EXISTS ExerciseLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, name TEXT NOT NULL,
        type TEXT DEFAULT 'WEIGHT', actual_weight REAL, actual_reps INTEGER, actual_sets INTEGER,
        actual_speed REAL, actual_time INTEGER, is_adhoc INTEGER DEFAULT 0, actual_distance REAL DEFAULT 0,
        FOREIGN KEY (date) REFERENCES DailyLog (date)
      );
    `);
    
    try { await db.execAsync(`ALTER TABLE RoutineTemplate ADD COLUMN is_active INTEGER DEFAULT 0;`); } catch (e) {}
    try { await db.execAsync(`ALTER TABLE Settings ADD COLUMN weekly_goal INTEGER DEFAULT 7;`); } catch (e) {}
    
    // 🌟 추가된 로직: 수분 목표 컬럼을 안전하게 추가 (기본값 700ml)
    try { await db.execAsync(`ALTER TABLE Settings ADD COLUMN water_goal INTEGER DEFAULT 700;`); } catch (e) {}

    console.log("DB 초기화 완료!");
  } catch (error) {
    console.error("DB 초기화 실패:", error);
  }
};
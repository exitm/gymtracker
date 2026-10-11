const test = require('node:test');
const assert = require('node:assert/strict');
const { createBackupFilename } = require('../utils/backupFilename');

test('운동 기록 백업 파일명에 현지 날짜를 YYYYMMDD로 포함한다', () => {
  const date = new Date(2026, 9, 4, 15, 30, 0);
  assert.equal(createBackupFilename('Workout_DB_Backup', date), 'Workout_DB_Backup_20261004.json');
});

test('설정 및 루틴 백업 파일명도 같은 날짜 형식을 사용한다', () => {
  const date = new Date(2026, 0, 9, 9, 5, 0);
  assert.equal(createBackupFilename('Workout_Settings_Backup', date), 'Workout_Settings_Backup_20260109.json');
});

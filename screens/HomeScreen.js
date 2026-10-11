// screens/HomeScreen.js
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, DeviceEventEmitter } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { getSettings, getWeeklyLogsStatus, getWorkoutActivityDates, getWeeklyWaterAverage, getExercisesForDate, getDailyLogForDate, getWorkoutProgress, getActiveRoutineTemplate } from '../dbQueries';
import { resolveTodayExerciseList } from '../utils/todayExerciseList';
import { isWorkoutActivityStatus } from '../utils/workoutActivity';

const { width } = Dimensions.get('window');

const CircularProgress = ({ size, strokeWidth, progress, color, emptyColor }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <Svg width={size} height={size}>
      <Circle stroke={emptyColor} cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" />
      <Circle stroke={color} cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" fill="none" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [userName, setUserName] = useState('사용자');
  const [weeklyGoal, setWeeklyGoal] = useState(5);
  const [waterGoal, setWaterGoal] = useState(700);
  const [isDarkMode, setIsDarkMode] = useState(false); 
  
  const [weekDates, setWeekDates] = useState([]);
  const [weeklyStatus, setWeeklyStatus] = useState({});
  const [weeklyCompletedCount, setWeeklyCompletedCount] = useState(0);
  
  const [currentStreak, setCurrentStreak] = useState(0);
  const [monthlyProgress, setMonthlyProgress] = useState(0);
  const [weeklyWaterAvg, setWeeklyWaterAvg] = useState(0);
  
  const [todayExercises, setTodayExercises] = useState([]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('themeChanged', (mode) => {
      setIsDarkMode(mode);
    });
    return () => subscription.remove();
  }, []);

  // 운동 화면이 전송한 전체 스냅샷은 새로고침 중에도 stale DB 조회로 덮지 않는다.
  const latestWorkoutProgressRef = React.useRef(null);
  const dashboardLoadVersionRef = React.useRef(0);

  useEffect(() => {
    const syncSubscription = DeviceEventEmitter.addListener('syncWorkoutProgress', (payload) => {
      if (Array.isArray(payload)) {
        latestWorkoutProgressRef.current = payload;
        setTodayExercises(payload);
      } else {
        latestWorkoutProgressRef.current = null;
        loadDashboardData();
      }
    });
    return () => syncSubscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => { loadDashboardData(); }, [])
  );

  const loadDashboardData = async () => {
    const loadVersion = ++dashboardLoadVersionRef.current;
    const settings = await getSettings();
    // [수정] AsyncStorage를 우선 확인하여 이름 초기화 버그 방어
    const savedName = await AsyncStorage.getItem('userName');
    setUserName(savedName || settings.user_name || '사용자');
    
    setWeeklyGoal(settings.weekly_goal || 5);
    setWaterGoal(settings.water_goal || 700);
    setIsDarkMode(settings.is_dark_mode === 1); 

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayDiff);

    const weekArr = [];
    const dateStrArr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      weekArr.push({ dayName: ['월', '화', '수', '목', '금', '토', '일'][i], dateNum: d.getDate(), dateStr: str, isToday: d.getTime() === today.getTime() });
      dateStrArr.push(str);
    }
    setWeekDates(weekArr);

    const wStatus = await getWeeklyLogsStatus(dateStrArr);

    const allCompletedDates = await getWorkoutActivityDates();
    if (loadVersion !== dashboardLoadVersionRef.current) return;
    setWeeklyStatus(wStatus);
    const completedCount = dateStrArr.filter(date => isWorkoutActivityStatus(wStatus[date])).length;
    setWeeklyCompletedCount(completedCount);

    let streak = 0;
    const checkDate = new Date(today);
    
    const todayStr = dateStrArr[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
    checkDate.setDate(today.getDate() - 1);
    const yesterdayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    
    if (allCompletedDates.includes(todayStr) || allCompletedDates.includes(yesterdayStr)) {
      let calcDate = new Date(allCompletedDates.includes(todayStr) ? today : checkDate);
      while (true) {
        const cStr = `${calcDate.getFullYear()}-${String(calcDate.getMonth() + 1).padStart(2, '0')}-${String(calcDate.getDate()).padStart(2, '0')}`;
        if (allCompletedDates.includes(cStr)) { streak++; calcDate.setDate(calcDate.getDate() - 1); } else { break; }
      }
    }
    setCurrentStreak(streak);

    const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthLogs = allCompletedDates.filter(date => date.startsWith(currentMonthPrefix));
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    setMonthlyProgress(Math.round((thisMonthLogs.length / daysInMonth) * 100));

    const waterAvg = await getWeeklyWaterAverage();
    setWeeklyWaterAvg(waterAvg);

    const todayExData = await getExercisesForDate(todayStr);
    const dailyLog = await getDailyLogForDate(todayStr);
    let plannedExercises = [];
    if ((!dailyLog || !['REST', 'COMPLETED', 'IN_PROGRESS'].includes(dailyLog.status)) && todayExData.length === 0) {
      const template = await getActiveRoutineTemplate();
      if (template?.routineData) {
        const currentRoutineIndex = settings.current_routine_day_index || 0;
        const calcIndex = currentRoutineIndex % (template.totalDays || 1);
        plannedExercises = (template.routineData[calcIndex] || []).map((ex, index) => ({
          id: `planned-${index}-${todayStr}`,
          name: ex.name,
          type: ex.type || 'WEIGHT',
          weight: ex.weight?.toString() || '',
          reps: ex.reps?.toString() || '',
          sets: ex.sets?.toString() || '',
          time: ex.time?.toString() || '',
          speed: ex.speed?.toString() || '',
          distance: ex.distance?.toString() || '',
          isChecked: false,
        }));
      }
    }

    const draftExercises = dailyLog?.status === 'IN_PROGRESS'
      ? await getWorkoutProgress(todayStr)
      : null;
    let legacyProgress = null;
    try {
      const progressStr = await AsyncStorage.getItem('today_workout_progress');
      if (progressStr) legacyProgress = JSON.parse(progressStr);
    } catch (error) {
      console.log('진행 캐시 읽기 실패:', error);
    }

    if (loadVersion !== dashboardLoadVersionRef.current) return;
    const finalTodayData = resolveTodayExerciseList({
      dailyLog,
      savedExercises: todayExData,
      draftExercises,
      legacyProgress,
      today: todayStr,
      plannedExercises,
    });
    const eventSnapshot = latestWorkoutProgressRef.current;
    const visibleExercises = Array.isArray(eventSnapshot) ? eventSnapshot : finalTodayData;
    setTodayExercises(visibleExercises);
  };

  const getFormatDetail = (ex) => {
    // [수정 2] DB 기반(actual_*)과 템플릿 기반(weight/reps/time 등) 모두 호환
    const w = ex.actual_weight ?? ex.weight ?? 0;
    const r = ex.actual_reps ?? ex.reps ?? 0;
    const s = ex.actual_sets ?? ex.sets ?? 0;
    if (ex.type === 'WEIGHT') return `${w}kg · ${r}회 · ${s}세트`;
    const t = ex.actual_time ?? ex.time ?? 0;
    const sp = ex.actual_speed ?? ex.speed ?? 0;
    return `${t}분 · 속도 ${sp}`;
  };

  const theme = {
    bg: isDarkMode ? '#111317' : '#F7F4F2',
    cardBg: isDarkMode ? '#1A1D24' : '#FFFFFF',
    textMain: isDarkMode ? '#FFFFFF' : '#222222',
    textSub: isDarkMode ? '#8892A0' : '#888888',
    accentPrimary: isDarkMode ? '#00E5FF' : '#FF4D6D',  
    accentSecondary: isDarkMode ? '#FF5C00' : '#FF4D6D', 
    radius: isDarkMode ? 6 : 24, 
    borderColor: isDarkMode ? '#2A2F3A' : '#FFFFFF',
    success: isDarkMode ? '#00E5FF' : '#4CAF50', 
    emptyChart: isDarkMode ? '#2A2F3A' : '#F0F0F0',
  };

  return (
    <View style={[styles.mainWrapper, { backgroundColor: theme.bg, paddingTop: insets.top + 20 }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={[styles.headerSub, {color: theme.textSub}]}>오늘도 나를 돌보는 시간</Text>
          <Text style={[styles.headerTitle, {color: theme.textMain}]}>
            안녕, {userName} {isDarkMode ? '💪' : '❤️'}
          </Text>
        </View>

        <View style={[styles.card, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, {color: theme.textMain}]}>이번 주</Text>
            <TouchableOpacity onPress={() => navigation.navigate('기록')}><Text style={[styles.cardActionText, {color: theme.accentPrimary}]}>전체 보기</Text></TouchableOpacity>
          </View>
          
          <View style={styles.weekRow}>
            {weekDates.map((day, idx) => {
              const status = weeklyStatus[day.dateStr];
              const isCompleted = isWorkoutActivityStatus(status);
              
              return (
                <View key={idx} style={styles.dayItem}>
                  <Text style={[styles.dayName, {color: theme.textSub}, day.dayName === '일' && {color: theme.accentSecondary}]}>{day.dayName}</Text>
                  <View style={[
                    styles.dateCircle,
                    day.isToday && {backgroundColor: theme.accentPrimary},
                    isCompleted && !day.isToday && {borderWidth: 2, borderColor: theme.success, backgroundColor: isDarkMode ? '#1E2B35' : '#F1F8E9'}
                  ]}>
                    <Text style={[
                      styles.dateText, {color: theme.textMain},
                      day.isToday && {color: isDarkMode ? '#111' : '#fff'},
                      day.dayName === '일' && !day.isToday && {color: theme.accentSecondary}
                    ]}>{day.dateNum}</Text>
                    {isCompleted && (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={day.isToday ? (isDarkMode ? '#111317' : '#FFFFFF') : theme.success}
                        style={{ position: 'absolute', right: -3, bottom: -3, backgroundColor: theme.cardBg, borderRadius: 7 }}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, styles.goalCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
          <View style={styles.chartContainer}>
            <CircularProgress size={90} strokeWidth={10} progress={Math.min(weeklyCompletedCount / weeklyGoal, 1)} color={theme.accentPrimary} emptyColor={theme.emptyChart} />
            <View style={styles.chartTextContainer}>
              <Text style={[styles.chartValue, {color: theme.accentPrimary}]}>{weeklyCompletedCount}<Text style={styles.chartTotal}>/{weeklyGoal}</Text></Text>
            </View>
          </View>
          <View style={styles.goalTextContainer}>
            <Text style={[styles.goalTitle, {color: theme.textMain}]}>이번 주 달성률</Text>
            <Text style={[styles.goalSub, {color: theme.textSub}]}>작은 시작이 큰 변화를 만들어요.{'\n'}끝까지 화이팅! ✨</Text>
          </View>
        </View>

        <View style={styles.rowCards}>
          <View style={[styles.card, styles.halfCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
            <Text style={[styles.streakValue, {color: theme.accentSecondary}]}>🔥 {currentStreak}일</Text>
            <Text style={[styles.statsTitle, {color: theme.textMain}]}>연속 운동</Text>
            <Text style={[styles.statsSub, {color: theme.textSub}]}>조금씩 꾸준히 💪</Text>
          </View>
          
          <View style={[styles.card, styles.halfCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
            <View style={{marginBottom: 8}}>
              <CircularProgress size={50} strokeWidth={5} progress={monthlyProgress / 100} color={theme.success} emptyColor={theme.emptyChart} />
              <View style={styles.miniChartTextContainer}>
                <Text style={[styles.miniChartValue, {color: theme.success}]}>{monthlyProgress}%</Text>
              </View>
            </View>
            <Text style={[styles.statsTitle, {color: theme.textMain}]}>월간 달성</Text>
            <Text style={[styles.statsSub, {color: theme.textSub}]}>이번 달도 멋져요!</Text>
          </View>
        </View>

        <View style={[styles.card, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
          <View style={styles.waterHeaderRow}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={{fontSize: 16, marginRight: 6}}>💧</Text>
              <Text style={[styles.cardTitle, {color: theme.textMain}]}>최근 7일 평균 수분</Text>
            </View>
            <Text style={[styles.waterAmountText, {color: theme.accentPrimary}]}>{weeklyWaterAvg} <Text style={{fontSize: 14, fontWeight: 'normal'}}>ml</Text></Text>
          </View>
          
          <View style={[styles.waterProgressBarBg, {backgroundColor: theme.emptyChart}]}>
            <View style={[styles.waterProgressBarFill, { backgroundColor: theme.accentPrimary, width: `${Math.min((weeklyWaterAvg / waterGoal) * 100, 100)}%` }]} />
          </View>
          <Text style={[styles.waterSubText, {color: theme.textSub}]}>
            {weeklyWaterAvg >= waterGoal ? '목표 달성 완료! 훌륭해요 🌊' : `목표까지 ${waterGoal - weeklyWaterAvg}ml 남았어요`}
          </Text>
        </View>

        <View style={styles.todayWorkoutSection}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, {color: theme.textMain}]}>오늘의 운동</Text>
            <TouchableOpacity onPress={() => navigation.navigate('운동')}><Text style={[styles.cardActionText, {color: theme.accentPrimary}]}>+ 운동 추가</Text></TouchableOpacity>
          </View>

          {todayExercises.map((ex, idx) => (
            <View key={idx} style={[styles.workoutItemCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name={ex.type === 'WEIGHT' ? 'barbell' : 'walk'} size={20} color={ex.isChecked ? theme.success : theme.accentPrimary} style={{marginRight: 12}} />
                <Text style={[styles.workoutItemName, {color: theme.textMain}, ex.isChecked && {textDecorationLine: 'line-through', color: theme.textSub}]}>{ex.name}</Text>
              </View>
              <Text style={[styles.workoutItemDetail, {color: theme.textSub}, ex.isChecked && {color: theme.success}]}>{getFormatDetail(ex)}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1 },
  header: { marginBottom: 24, paddingHorizontal: 4 },
  headerSub: { fontSize: 14, marginBottom: 4, fontWeight: '500' },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  
  card: { padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1, borderWidth: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  cardActionText: { fontSize: 13, fontWeight: 'bold' },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayItem: { alignItems: 'center' },
  dayName: { fontSize: 12, marginBottom: 8, fontWeight: '600' },
  dateCircle: { width: 36, height: 44, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  dateText: { fontSize: 16, fontWeight: 'bold' },

  goalCard: { flexDirection: 'row', alignItems: 'center' },
  chartContainer: { position: 'relative', justifyContent: 'center', alignItems: 'center', marginRight: 20 },
  chartTextContainer: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  chartValue: { fontSize: 20, fontWeight: '900' },
  chartTotal: { fontSize: 13, color: '#aaa', fontWeight: 'bold' },
  goalTextContainer: { flex: 1 },
  goalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  goalSub: { fontSize: 13, lineHeight: 20 },

  rowCards: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  halfCard: { width: (width - 40 - 16) / 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, marginBottom: 0 },
  streakValue: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
  statsTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  statsSub: { fontSize: 12 },
  miniChartTextContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center' },
  miniChartValue: { fontSize: 13, fontWeight: 'bold' },

  waterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  waterAmountText: { fontSize: 18, fontWeight: '900' },
  waterProgressBarBg: { height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 10 },
  waterProgressBarFill: { height: '100%', borderRadius: 6 },
  waterSubText: { fontSize: 12 },

  todayWorkoutSection: { marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  emptyWorkoutText: { fontSize: 14, color: '#aaa', fontWeight: '500' },
  workoutItemCard: { padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1 },
  workoutItemName: { fontSize: 15, fontWeight: 'bold' },
  workoutItemDetail: { fontSize: 13, fontWeight: '500' },
  moreWorkoutBtn: { alignItems: 'center', paddingVertical: 10 },
  moreWorkoutBtnText: { fontSize: 13, fontWeight: 'bold' }
});
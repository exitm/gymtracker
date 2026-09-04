// screens/HomeScreen.js
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, DeviceEventEmitter } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { getSettings, getWeeklyLogsStatus, getAllCompletedDatesForStats, getWeeklyWaterAverage, getExercisesForDate } from '../dbQueries';

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

  useFocusEffect(
    useCallback(() => { loadDashboardData(); }, [])
  );

  const loadDashboardData = async () => {
    const settings = await getSettings();
    setUserName(settings.user_name || '사용자');
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
    setWeeklyStatus(wStatus);

    let completedCount = 0;
    for (const key in wStatus) { if (wStatus[key] === 'COMPLETED') completedCount++; }
    setWeeklyCompletedCount(completedCount);

    const allCompletedDates = await getAllCompletedDatesForStats();
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
    const thisMonthLogs = allCompletedDates.filter(d => d.startsWith(currentMonthPrefix));
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    setMonthlyProgress(Math.round((thisMonthLogs.length / daysInMonth) * 100));

    const waterAvg = await getWeeklyWaterAverage();
    setWeeklyWaterAvg(waterAvg);

    const todayExData = await getExercisesForDate(todayStr);
    setTodayExercises(todayExData);
  };

  const getFormatDetail = (ex) => {
    if (ex.type === 'WEIGHT') return `${ex.actual_weight || 0}kg · ${ex.actual_reps || 0}회 · ${ex.actual_sets || 0}세트`;
    return `${ex.actual_time || 0}분 · 속도 ${ex.actual_speed || 0}`;
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
          {/* 🌟 수정사항: isDarkMode 값에 따라 이모지가 '💪' 또는 '❤️'로 동적으로 렌더링됩니다. */}
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
              const isCompleted = status === 'COMPLETED';
              
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

          {todayExercises.length === 0 ? (
            <View style={[styles.card, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor, alignItems: 'center', paddingVertical: 30}]}>
              <Text style={styles.emptyWorkoutText}>아직 완료한 운동이 없어요.</Text>
            </View>
          ) : (
            todayExercises.slice(0, 3).map((ex, idx) => (
              <View key={idx} style={[styles.workoutItemCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Ionicons name={ex.type === 'WEIGHT' ? 'barbell' : 'walk'} size={20} color={theme.accentPrimary} style={{marginRight: 12}} />
                  <Text style={[styles.workoutItemName, {color: theme.textMain}]}>{ex.name}</Text>
                </View>
                <Text style={[styles.workoutItemDetail, {color: theme.textSub}]}>{getFormatDetail(ex)}</Text>
              </View>
            ))
          )}
          
          {todayExercises.length > 3 && (
            <TouchableOpacity onPress={() => navigation.navigate('운동')} style={styles.moreWorkoutBtn}>
              <Text style={[styles.moreWorkoutBtnText, {color: theme.textSub}]}>...외 {todayExercises.length - 3}개 더보기</Text>
            </TouchableOpacity>
          )}
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
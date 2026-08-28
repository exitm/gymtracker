// screens/TodayWorkoutScreen.js
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Vibration, AppState, Modal, Image, FlatList, DeviceEventEmitter } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import ViewShot from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { saveWorkoutLog, saveRestDayLog, getDailyLogForDate, getExercisesForDate, getActiveRoutineTemplate, getSettings, deleteDailyLog, updateSetting } from '../dbQueries';

const EXERCISE_DICTIONARY = [
  '로슨 플랫 체스트', '로슨 인클라인 체스트', '체스트 프레스 머신', '인클라인 체스트 프레스 머신', '펙덱 플라이', '벤치프레스', '인클라인 벤치프레스', '덤벨 플라이', '딥스', '케이블 크로스 오버',
  '로슨 하이로우', '로슨 시티드로우', '로슨 로우로우', '시티드 로우 머신', '로우 케이블 머신', '랫 풀다운 케이블', '데드리프트', '바벨 로우', '덤벨 로우', '풀업(턱걸이)', '티바 로우', '어시스트 머신',
  '레그 프레스', '시티드 레그프레스 머신', '브이 스쿼트 머신', '라잉 레그컬 머신', '힙 어덕션 머신', '스쿼트', '런지', '레그 익스텐션', '카프 레이즈', '파워 레그프레스', '레그 컬',
  '밀리터리 프레스', '오버헤드 프레스', '사이드 레터럴 레이즈', '프론트 레이즈', '벤트오버 레터럴 레이즈', '숄더 프레스 머신',
  '프리쳐 컬 머신', '바벨 컬', '덤벨 컬', '해머 컬', '트라이셉스 익스텐션', '케이블 푸시다운', '라잉 트라이셉스 익스텐션',
  '행잉 레그레이즈', '크런치', '레그 레이즈', '플랭크', 'ab 슬라이드', '케이블 크런치',
  '걷기', '달리기(러닝)', '천국의 계단(스텝밀)', '실내 사이클', '로잉머신', '일립티컬'
];

export default function TodayWorkoutScreen() {
  const insets = useSafeAreaInsets(); 

  const [memo, setMemo] = useState('');
  const [exercises, setExercises] = useState([]);
  const [isRestDay, setIsRestDay] = useState(false);
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [waterGoal, setWaterGoal] = useState(700);
  const [waterConsumed, setWaterConsumed] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false); 

  const [baseTimerSeconds, setBaseTimerSeconds] = useState(60); 
  const [timeLeft, setTimeLeft] = useState(0); 
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [targetEndTime, setTargetEndTime] = useState(null); 
  
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', onConfirm: null });
  const [isProofModalVisible, setIsProofModalVisible] = useState(false);
  const [proofImageUri, setProofImageUri] = useState(null);
  const [proofImageAspect, setProofImageAspect] = useState(1); 
  
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingExerciseId, setEditingExerciseId] = useState(null); 

  const viewShotRef = useRef(); 
  const searchInputRef = useRef(null); 

  const today = new Date();
  const dbDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const displayDateString = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayString = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()] + '요일';

  const isDataLoadedRef = useRef(false);
  const loadedDateRef = useRef(null);
  const timerRef = useRef(null); 
  const appState = useRef(AppState.currentState);
  const lastUpdateRef = useRef(null);
  const currentRoutineIndexRef = useRef(0); 
  const activeTemplateRef = useRef(null); 

  const showAlert = (title, message, type = 'info', onConfirm = null) => { setAlertConfig({ visible: true, title, message, type, onConfirm }); };
  const closeAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    const themeSub = DeviceEventEmitter.addListener('themeChanged', (mode) => { setIsDarkMode(mode); });
    const appStateSub = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isTimerRunning && targetEndTime) {
          const now = Date.now();
          const remaining = Math.round((targetEndTime - now) / 1000);
          if (remaining <= 0) {
            setTimeLeft(0); setIsTimerRunning(false); setTargetEndTime(null);
            Vibration.vibrate([500, 500, 500]);
            showAlert("휴식 끝! 💦", "호흡을 가다듬고 다음 세트를 준비하세요! 💪", "info");
          } else { setTimeLeft(remaining); }
        }
      }
      appState.current = nextAppState;
    });
    return () => { themeSub.remove(); appStateSub.remove(); };
  }, [isTimerRunning, targetEndTime]);

  useEffect(() => {
    if (isTimerRunning && targetEndTime) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const remaining = Math.round((targetEndTime - now) / 1000);
        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setTimeLeft(0); setIsTimerRunning(false); setTargetEndTime(null);
          Vibration.vibrate([500, 500, 500]); 
          showAlert("휴식 끝! 💦", "호흡을 가다듬고 다음 세트를 준비하세요! 💪", "info");
        } else { setTimeLeft(remaining); }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning, targetEndTime]);

  const clearTimer = () => { setIsTimerRunning(false); setTargetEndTime(null); };

  useFocusEffect(
    useCallback(() => {
      const checkUpdateAndLoad = async () => {
        const updateTime = await AsyncStorage.getItem('template_update_time');
        if (updateTime !== lastUpdateRef.current || loadedDateRef.current !== dbDateString) {
          isDataLoadedRef.current = false; 
          loadedDateRef.current = dbDateString;
          lastUpdateRef.current = updateTime;
          loadTodayData(true); 
        } else if (!isDataLoadedRef.current) {
          loadTodayData();
        }
      };
      checkUpdateAndLoad();
    }, [dbDateString]) 
  );

  const loadTodayData = async (forceReload = false) => {
    const settings = await getSettings();
    setWaterGoal(settings.water_goal || 700);
    setIsDarkMode(settings.is_dark_mode === 1);
    
    const safeTimer = settings.rest_timer > 0 ? settings.rest_timer : 60;
    if (!isTimerRunning) { setBaseTimerSeconds(safeTimer); setTimeLeft(safeTimer); }

    currentRoutineIndexRef.current = settings.current_routine_day_index || 0; 

    if (!forceReload && exercises.length > 0 && loadedDateRef.current === dbDateString) return; 

    const dailyLog = await getDailyLogForDate(dbDateString);
    if (dailyLog) {
      setMemo(dailyLog.memo || '');
      setWaterConsumed(dailyLog.water_consumed || 0);

      if (dailyLog.status === 'REST') {
        setExercises([]); setIsRestDay(true); setIsWorkoutCompleted(false); isDataLoadedRef.current = true; return;
      } else if (dailyLog.status === 'COMPLETED') {
        const savedExercises = await getExercisesForDate(dbDateString);
        const formatted = savedExercises.map(ex => ({
          id: ex.id, name: ex.name, type: ex.type, weight: ex.actual_weight?.toString() || '', reps: ex.actual_reps?.toString() || '', sets: ex.actual_sets?.toString() || '', speed: ex.actual_speed?.toString() || '', time: ex.actual_time?.toString() || '', distance: ex.actual_distance?.toString() || '', isChecked: true 
        }));
        setExercises(formatted); setIsRestDay(false); setIsWorkoutCompleted(true); isDataLoadedRef.current = true; return;
      }
    }

    setIsRestDay(false); setMemo(''); setWaterConsumed(0); setIsWorkoutCompleted(false);
    
    const template = await getActiveRoutineTemplate();
    activeTemplateRef.current = template; 

    if (template && settings.is_long_term_pause === 0) {
      const calcIndex = currentRoutineIndexRef.current % template.totalDays; 
      const plannedExercises = template.routineData[calcIndex] || []; 
      const formatted = plannedExercises.map((ex, index) => ({
        id: Date.now() + index, name: ex.name, type: ex.type, weight: ex.weight?.toString() || '', reps: ex.reps?.toString() || '', sets: ex.sets?.toString() || '', time: ex.time?.toString() || '', speed: ex.speed?.toString() || '', distance: ex.distance?.toString() || '', isChecked: false 
      }));
      setExercises(formatted);
    } else { setExercises([]); }
    isDataLoadedRef.current = true; 
  };

  const drinkWater = () => { if (waterConsumed < waterGoal) setWaterConsumed(prev => prev + 100); };
  const waterLeft = Math.max(waterGoal - waterConsumed, 0); 
  const waterProgressPercent = Math.min((waterConsumed / waterGoal) * 100, 100);

  const toggleTimer = () => {
    if (isTimerRunning) clearTimer();
    else {
      const currentLeft = timeLeft === 0 ? baseTimerSeconds : timeLeft;
      setTimeLeft(currentLeft); setTargetEndTime(Date.now() + currentLeft * 1000); setIsTimerRunning(true);
    }
  };

  const adjustTimer = async (step) => {
    let newBase = baseTimerSeconds + step;
    if (newBase < 10) newBase = 10;
    setBaseTimerSeconds(newBase);
    await updateSetting('rest_timer', newBase);

    if (isTimerRunning) {
      const newLeft = timeLeft + step > 0 ? timeLeft + step : 0;
      setTimeLeft(newLeft); setTargetEndTime(Date.now() + newLeft * 1000);
      if (newLeft <= 0) clearTimer();
    } else { setTimeLeft(newBase); }
  };

  const toggleCheck = (id) => { 
    setExercises(exercises.map(ex => {
      if (ex.id === id) return { ...ex, isChecked: !ex.isChecked };
      return ex;
    })); 
  };
  
  const updateExercise = (id, field, value) => {
    const updatedExercises = exercises.map(ex => {
      if (ex.id === id) {
        let newType = ex.type;
        if (field === 'name') {
          const isCardio = ['천국', '계단', '걷기', '뛰기', '달리기', '자전거', '사이클', '런닝', '유산소', '러닝', '도보', '산책', '로잉머신', '일립티컬'].some(k => value.includes(k));
          newType = isCardio ? 'CARDIO' : 'WEIGHT';
        }
        return { ...ex, [field]: value, type: newType };
      }
      return ex;
    });
    setExercises(updatedExercises);
  };

  const handleSelectExerciseFromSearch = (selectedName) => {
    updateExercise(editingExerciseId, 'name', selectedName);
    setIsSearchModalVisible(false);
    setSearchKeyword('');
  };

  const deleteExercise = (id) => { setExercises(exercises.filter(ex => ex.id !== id)); };

  const moveExercise = (id, direction) => {
    setExercises(prevExercises => {
      const index = prevExercises.findIndex(ex => ex.id === id);
      if (index < 0) return prevExercises; 
      const newExercises = [...prevExercises];
      if (direction === -1 && index > 0) {
        const temp = newExercises[index]; newExercises[index] = newExercises[index - 1]; newExercises[index - 1] = temp;
      } else if (direction === 1 && index < newExercises.length - 1) {
        const temp = newExercises[index]; newExercises[index] = newExercises[index + 1]; newExercises[index + 1] = temp;
      }
      return newExercises;
    });
  };

  const addAdhocExercise = () => { 
    setExercises([...exercises, { id: Date.now(), name: '', weight: '', reps: '', sets: '', speed: '', time: '', distance: '', type: 'WEIGHT', isChecked: false }]); 
  };

  const handleSaveWorkout = async () => {
    const checkedExercises = exercises.filter(ex => ex.isChecked);
    if (checkedExercises.length === 0) return showAlert('안내', '체크(완료)된 운동이 없습니다.', 'info');
    if (checkedExercises.some(ex => !ex.name || ex.name.trim() === '')) return showAlert('입력 확인', '체크된 기구의 운동 이름을 입력해 주세요.', 'info');

    try {
      await saveWorkoutLog(dbDateString, 'COMPLETED', memo, checkedExercises, waterConsumed);
      
      if (!isWorkoutCompleted && activeTemplateRef.current) {
        const nextIndex = (currentRoutineIndexRef.current + 1) % activeTemplateRef.current.totalDays;
        await updateSetting('current_routine_day_index', nextIndex);
        currentRoutineIndexRef.current = nextIndex; 
      }

      showAlert('운동 완료! 🎉', '운동 기록과 물 섭취량이 멋지게 저장되었습니다.', 'info');
      clearTimer(); 
      isDataLoadedRef.current = false; 
      loadTodayData(true); 
    } catch (error) { showAlert('오류', '저장에 실패했습니다.', 'info'); }
  };

  const handleToggleRest = () => {
    if (isRestDay) {
      showAlert('휴식 취소', '오늘의 휴식을 취소하고 다시 운동 루틴을 부르시겠습니까?', 'confirm', async () => {
        try { await deleteDailyLog(dbDateString); isDataLoadedRef.current = false; loadTodayData(true); } catch (e) {}
      });
    } else {
      showAlert('휴식 기록하기', '오늘을 휴식일로 기록하시겠습니까?\n작성 중이던 운동 기록은 모두 지워집니다.', 'confirm', async () => {
        try {
          await saveRestDayLog(dbDateString, memo, waterConsumed);
          showAlert('휴식 완료', '오늘은 푹 쉬고 내일 다시 화이팅입니다! ☕', 'info');
          clearTimer();
          isDataLoadedRef.current = false; loadTodayData(true);
        } catch (error) { showAlert('오류', '휴식 기록 저장에 실패했습니다.', 'info'); }
      });
    }
  };

  const pickProofImage = async (useCamera = false) => {
    let result;
    const options = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
    if (useCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') return showAlert('권한 필요', '카메라 접근 권한이 필요합니다.', 'info');
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') return showAlert('권한 필요', '사진첩 접근 권한이 필요합니다.', 'info');
      result = await ImagePicker.launchImageLibraryAsync(options);
    }
    if (!result.canceled) {
      const asset = result.assets[0]; setProofImageUri(asset.uri);
      if (asset.width && asset.height) setProofImageAspect(asset.width / asset.height);
      else setProofImageAspect(1);
    }
  };

  const captureAndShareProof = async () => {
    try {
      const uri = await viewShotRef.current.capture();
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) await Sharing.shareAsync(uri, { dialogTitle: '오운완 인증샷 공유하기' });
    } catch (error) { showAlert('오류', '인증샷을 생성하는 중 문제가 발생했습니다.', 'info'); }
  };

  const formatExerciseDetail = (ex) => {
    const w = ex.actual_weight ?? ex.weight; const r = ex.actual_reps ?? ex.reps; const s = ex.actual_sets ?? ex.sets;
    const t = ex.actual_time ?? ex.time; const sp = ex.actual_speed ?? ex.speed; const d = ex.actual_distance ?? ex.distance;
    const isValid = (val) => val !== null && val !== undefined && String(val).trim() !== '' && parseFloat(val) !== 0;
    const parts = [];
    if (ex.type === 'WEIGHT') {
      if (isValid(w)) parts.push(`${w}kg`); if (isValid(r)) parts.push(`${r}회`); if (isValid(s)) parts.push(`${s}세트`);
    } else {
      if (isValid(t)) parts.push(`${t}분`); if (isValid(sp)) parts.push(`속도 ${sp}`); if (isValid(d)) parts.push(`거리 ${d}km`);
    }
    return parts.length > 0 ? parts.join(' / ') : '기록 없음';
  };

  const filteredExercises = EXERCISE_DICTIONARY.filter(name => name.toLowerCase().includes(searchKeyword.toLowerCase()));

  const theme = {
    bg: isDarkMode ? '#111317' : '#F7F4F2',
    cardBg: isDarkMode ? '#1A1D24' : '#FFFFFF',
    textMain: isDarkMode ? '#FFFFFF' : '#222222',
    textSub: isDarkMode ? '#8892A0' : '#888888',
    accentPrimary: isDarkMode ? '#00E5FF' : '#FF4D6D',  
    accentSecondary: isDarkMode ? '#FF5C00' : '#FF4D6D', 
    radius: isDarkMode ? 6 : 24, 
    inputBg: isDarkMode ? '#242832' : '#F9F9F9',
    borderColor: isDarkMode ? '#2A2F3A' : '#FFFFFF',
    inputBorder: isDarkMode ? '#2A2F3A' : '#EEEEEE',
    success: isDarkMode ? '#00E5FF' : '#4CAF50', 
    emptyChart: isDarkMode ? '#2A2F3A' : '#F0F0F0',
  };

  return (
    <View style={[styles.mainWrapper, { backgroundColor: theme.bg, paddingTop: insets.top + 20 }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 + insets.bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            {/* 🌟 1. 요청하신 헤더 서브타이틀 텍스트로 변경되었습니다. */}
            <Text style={[styles.headerSub, {color: theme.textSub}]}>오늘 흘린 땀방울, 내일 피어날 행복!</Text>
            <Text style={[styles.headerTitle, {color: theme.textMain}]}>운동 진행</Text>
          </View>

          <View style={[styles.dateCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
            <Text style={[styles.dateText, {color: theme.textMain}]}>{displayDateString} ({dayString})</Text>
            <TouchableOpacity style={[styles.restButton, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder, borderRadius: theme.radius}, isRestDay && {backgroundColor: theme.inputBg, borderColor: theme.inputBorder}]} onPress={handleToggleRest}>
              <Text style={[styles.restButtonText, {color: theme.accentSecondary}, isRestDay && {color: theme.textSub}]}>{isRestDay ? '☕ 오늘 휴식 취소' : '☕ 오늘 휴식'}</Text>
            </TouchableOpacity>
          </View>

          {!isRestDay && (
            <View style={[styles.timerWidget, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
              <View style={[styles.timerLeft, {borderRightColor: theme.inputBg}]}>
                <View style={styles.timerTitleRow}>
                  <Ionicons name="timer-outline" size={20} color={theme.textSub} />
                  <Text style={[styles.timerTitle, {color: theme.textSub}]}>세트 간 휴식</Text>
                </View>
                <View style={styles.timerControlRow}>
                  <TouchableOpacity onPress={() => adjustTimer(-10)} style={[styles.timerAdjustBtn, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder, borderRadius: theme.radius}]}><Ionicons name="remove" size={20} color={theme.textMain} /></TouchableOpacity>
                  <Text style={[styles.timerValue, {color: theme.textMain}, isTimerRunning && {color: theme.accentPrimary}]}>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => adjustTimer(10)} style={[styles.timerAdjustBtn, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder, borderRadius: theme.radius}]}><Ionicons name="add" size={20} color={theme.textMain} /></TouchableOpacity>
                </View>
                <View style={styles.quickAddRow}>
                  <TouchableOpacity onPress={() => adjustTimer(-30)} style={[styles.quickAddBtn, {backgroundColor: isDarkMode ? '#1A2933' : '#FFF1F2', borderRadius: theme.radius}]}><Text style={[styles.quickAddText, {color: theme.accentPrimary}]}>-30초</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => adjustTimer(30)} style={[styles.quickAddBtn, {backgroundColor: isDarkMode ? '#1A2933' : '#FFF1F2', borderRadius: theme.radius}]}><Text style={[styles.quickAddText, {color: theme.accentPrimary}]}>+30초</Text></TouchableOpacity>
                </View>
              </View>
              <View style={styles.timerRight}>
                <TouchableOpacity style={[styles.timerPlayLargeBtn, {backgroundColor: theme.accentSecondary, shadowColor: theme.accentSecondary}]} onPress={toggleTimer}>
                  <Ionicons name={isTimerRunning ? "pause" : "play"} size={36} color="#111" style={{ marginLeft: isTimerRunning ? 0 : 4 }} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={[styles.waterWidget, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
            {waterLeft > 0 ? (
              <>
                {/* 🌟 2. 수분 텍스트와 버튼이 겹치지 않도록 flex 구조를 개선했습니다. */}
                <View style={styles.waterHeader}>
                  <View style={styles.waterTitleRow}>
                    <Text style={{fontSize: 16, marginRight: 6}}>💧</Text>
                    <Text style={[styles.waterTitle, {color: theme.textMain}]} numberOfLines={1} adjustsFontSizeToFit>남은 수분 섭취: {waterLeft}ml</Text>
                  </View>
                  <TouchableOpacity style={[styles.waterButton, {backgroundColor: isDarkMode ? '#1E3A5F' : '#E1F5FE', borderRadius: theme.radius}]} onPress={drinkWater}>
                    <Text style={[styles.waterButtonText, {color: isDarkMode ? '#64B5F6' : '#03A9F4'}]}>마시기 (+100ml)</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.waterProgressBarBg, {backgroundColor: theme.emptyChart}]}>
                  <View style={[styles.waterProgressBarFill, { width: `${waterProgressPercent}%`, backgroundColor: isDarkMode ? '#64B5F6' : '#03A9F4' }]} />
                </View>
              </>
            ) : (
              <View style={[styles.waterCompletedCard, {backgroundColor: isDarkMode ? '#1E2B35' : '#E8F5E9', borderRadius: theme.radius}]}>
                <Ionicons name="water" size={32} color={theme.success} style={{ marginRight: 10 }} />
                <View>
                  <Text style={[styles.waterCompletedTitle, {color: theme.success}]}>수분 섭취 완료!</Text>
                  <Text style={[styles.waterCompletedSub, {color: theme.success}]}>몸속 세포들이 기뻐하고 있어요! 🌊✨</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={[styles.mainTitle, {color: theme.textSub}]}>오늘의 운동 기록</Text>

          {isRestDay ? (
            <View style={[styles.emptyCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}><Text style={[styles.emptyText, {color: theme.textSub}]}>오늘은 푹 쉬며 회복하는 날입니다. ☕</Text></View>
          ) : exercises.length > 0 ? (
            exercises.map((exercise, index) => (
              <View key={exercise.id} style={[styles.card, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}, exercise.isChecked && {backgroundColor: isDarkMode ? '#14161A' : '#FAFAFA', borderColor: theme.inputBorder}]}>
                <View style={styles.cardHeader}>
                  <TouchableOpacity onPress={() => toggleCheck(exercise.id)} style={styles.checkboxContainer}>
                    <Ionicons name={exercise.isChecked ? "checkmark-circle" : "ellipse-outline"} size={30} color={exercise.isChecked ? theme.success : theme.inputBorder} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.exerciseNameInputTouchable, {borderBottomColor: theme.inputBorder}]}
                    onPress={() => {
                      if (!exercise.isChecked) { setEditingExerciseId(exercise.id); setSearchKeyword(exercise.name); setIsSearchModalVisible(true); }
                    }}
                  >
                    <Text style={[styles.exerciseNameText, {color: theme.textMain}, exercise.isChecked && {textDecorationLine: 'line-through', color: theme.textSub}, !exercise.name && {color: theme.textSub}]}>
                      {exercise.name ? exercise.name : '운동 이름 선택'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.cardHeaderActions}>
                    <TouchableOpacity onPress={() => moveExercise(exercise.id, -1)} style={styles.iconBtn} disabled={index === 0}><Ionicons name="chevron-up" size={24} color={index === 0 ? theme.inputBorder : theme.textSub} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => moveExercise(exercise.id, 1)} style={styles.iconBtn} disabled={index === exercises.length - 1}><Ionicons name="chevron-down" size={24} color={index === exercises.length - 1 ? theme.inputBorder : theme.textSub} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteExercise(exercise.id)} style={styles.iconBtn}><Ionicons name="trash-outline" size={22} color={theme.accentSecondary} /></TouchableOpacity>
                  </View>
                </View>
                {exercise.type === 'WEIGHT' ? (
                  <View style={styles.inputRow}>
                    <TextInput style={[styles.input, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder, borderRadius: theme.radius, color: theme.textMain}, exercise.isChecked && {backgroundColor: theme.bg, color: theme.textSub}]} value={exercise.weight} onChangeText={(val) => updateExercise(exercise.id, 'weight', val)} keyboardType="numeric" placeholder="0" placeholderTextColor={theme.textSub} editable={!exercise.isChecked} /><Text style={[styles.unitText, {color: theme.textSub}]}>kg</Text>
                    <TextInput style={[styles.input, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder, borderRadius: theme.radius, color: theme.textMain}, exercise.isChecked && {backgroundColor: theme.bg, color: theme.textSub}]} value={exercise.reps} onChangeText={(val) => updateExercise(exercise.id, 'reps', val)} keyboardType="numeric" placeholder="0" placeholderTextColor={theme.textSub} editable={!exercise.isChecked} /><Text style={[styles.unitText, {color: theme.textSub}]}>회</Text>
                    <TextInput style={[styles.input, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder, borderRadius: theme.radius, color: theme.textMain}, exercise.isChecked && {backgroundColor: theme.bg, color: theme.textSub}]} value={exercise.sets} onChangeText={(val) => updateExercise(exercise.id, 'sets', val)} keyboardType="numeric" placeholder="0" placeholderTextColor={theme.textSub} editable={!exercise.isChecked} /><Text style={[styles.unitText, {color: theme.textSub}]}>세트</Text>
                  </View>
                ) : (
                  <View style={styles.inputRow}>
                    <TextInput style={[styles.input, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder, borderRadius: theme.radius, color: theme.textMain}, exercise.isChecked && {backgroundColor: theme.bg, color: theme.textSub}]} value={exercise.time} onChangeText={(val) => updateExercise(exercise.id, 'time', val)} keyboardType="numeric" placeholder="분" placeholderTextColor={theme.textSub} editable={!exercise.isChecked} /><Text style={[styles.unitText, {color: theme.textSub}]}>분</Text>
                    <TextInput style={[styles.input, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder, borderRadius: theme.radius, color: theme.textMain}, exercise.isChecked && {backgroundColor: theme.bg, color: theme.textSub}]} value={exercise.speed} onChangeText={(val) => updateExercise(exercise.id, 'speed', val)} keyboardType="numeric" placeholder="선택" placeholderTextColor={theme.textSub} editable={!exercise.isChecked} /><Text style={[styles.unitText, {color: theme.textSub}]}>속도</Text>
                    <TextInput style={[styles.input, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder, borderRadius: theme.radius, color: theme.textMain}, exercise.isChecked && {backgroundColor: theme.bg, color: theme.textSub}]} value={exercise.distance} onChangeText={(val) => updateExercise(exercise.id, 'distance', val)} keyboardType="numeric" placeholder="선택" placeholderTextColor={theme.textSub} editable={!exercise.isChecked} /><Text style={[styles.unitText, {color: theme.textSub}]}>거리</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={[styles.emptyCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}><Text style={[styles.emptyText, {color: theme.textSub}]}>오늘 배정된 루틴이 없습니다.</Text></View>
          )}

          <TouchableOpacity style={[styles.addButton, {backgroundColor: 'transparent', borderColor: theme.inputBorder, borderRadius: theme.radius}]} onPress={addAdhocExercise}>
            <Text style={[styles.addButtonText, {color: theme.textSub}]}>+ 새로운 운동 추가</Text>
          </TouchableOpacity>
          
          <View style={styles.memoContainer}>
            <Text style={[styles.memoTitle, {color: theme.textSub}]}>오늘의 메모</Text>
            <TextInput style={[styles.memoInput, {backgroundColor: theme.cardBg, borderRadius: theme.radius, color: theme.textMain, borderColor: theme.borderColor}]} placeholder="컨디션이나 특이사항을 적어주세요." value={memo} onChangeText={setMemo} multiline={true} placeholderTextColor={theme.textSub} />
          </View>
          
          {!isRestDay && (
            <>
              {isWorkoutCompleted && (
                <TouchableOpacity style={[styles.proofCreateBtn, {backgroundColor: theme.inputBg, borderRadius: theme.radius}]} onPress={() => setIsProofModalVisible(true)}>
                  <Ionicons name="camera" size={20} color={theme.textMain} style={{marginRight: 8}} />
                  <Text style={[styles.proofCreateBtnText, {color: theme.textMain}]}>인증샷 만들기</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={[styles.completeButton, {backgroundColor: theme.accentPrimary, borderRadius: theme.radius, shadowColor: theme.accentPrimary}]} onPress={handleSaveWorkout}>
                <Text style={[styles.completeButtonText, isDarkMode && {color: '#111'}]}>
                  {isWorkoutCompleted ? '수정된 내용 저장' : '운동 완료 및 저장'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={isSearchModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsSearchModalVisible(false)} onShow={() => { setTimeout(() => { searchInputRef.current?.focus(); }, 100); }}>
        <View style={[styles.searchModalContainer, {backgroundColor: theme.bg}]}>
          <View style={[styles.searchHeader, {backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor}]}>
            <TouchableOpacity onPress={() => setIsSearchModalVisible(false)}><Ionicons name="close" size={28} color={theme.textMain} /></TouchableOpacity>
            <Text style={[styles.searchTitle, {color: theme.textMain}]}>운동 선택</Text>
            <View style={{width: 28}} />
          </View>
          <View style={[styles.searchInputWrapper, {backgroundColor: theme.cardBg, borderColor: theme.borderColor, borderRadius: theme.radius}]}>
            <Ionicons name="search" size={20} color={theme.textSub} style={{marginRight: 8}} />
            <TextInput ref={searchInputRef} style={[styles.searchInput, {color: theme.textMain}]} placeholder="운동 이름을 검색하거나 직접 입력하세요." placeholderTextColor={theme.textSub} value={searchKeyword} onChangeText={setSearchKeyword} />
          </View>
          {searchKeyword.trim() !== '' && !EXERCISE_DICTIONARY.includes(searchKeyword.trim()) && (
            <TouchableOpacity style={[styles.customAddBtn, {backgroundColor: theme.accentPrimary, borderRadius: theme.radius}]} onPress={() => handleSelectExerciseFromSearch(searchKeyword.trim())}>
              <Ionicons name="add-circle" size={20} color={isDarkMode ? '#111' : '#fff'} style={{marginRight: 6}} /><Text style={[styles.customAddBtnText, isDarkMode && {color: '#111'}]}>"{searchKeyword.trim()}" 직접 추가하기</Text>
            </TouchableOpacity>
          )}
          <FlatList data={filteredExercises} keyExtractor={(item) => item} keyboardShouldPersistTaps="handled" renderItem={({item}) => (<TouchableOpacity style={[styles.searchListItem, {backgroundColor: theme.cardBg, borderBottomColor: theme.inputBorder}]} onPress={() => handleSelectExerciseFromSearch(item)}><Text style={[styles.searchListText, {color: theme.textMain}]}>{item}</Text></TouchableOpacity>)} ListEmptyComponent={() => (<Text style={[styles.searchEmptyText, {color: theme.textSub}]}>검색 결과가 없습니다.</Text>)} />
        </View>
      </Modal>

      <Modal visible={alertConfig.visible} transparent={true} animationType="fade" onRequestClose={closeAlert}>
        <TouchableOpacity style={styles.alertBackdrop} activeOpacity={1} onPress={() => { closeAlert(); }}>
          <TouchableOpacity activeOpacity={1} onPress={alertConfig.type === 'info' ? closeAlert : undefined}>
            <View style={[styles.alertBox, {backgroundColor: theme.cardBg, borderRadius: theme.radius}]}>
              <Text style={[styles.alertTitleText, {color: theme.textMain}]}>{alertConfig.title}</Text>
              <Text style={[styles.alertMessageText, {color: theme.textSub}]}>{alertConfig.message}</Text>
              {alertConfig.type === 'confirm' ? (
                <View style={styles.alertBtnRow}>
                  <TouchableOpacity style={[styles.alertCancelBtn, {backgroundColor: theme.inputBg, borderRadius: theme.radius}]} onPress={closeAlert}><Text style={[styles.alertCancelText, {color: theme.textMain}]}>취소</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.alertConfirmBtn, {backgroundColor: theme.accentPrimary, borderRadius: theme.radius}]} onPress={() => { if (alertConfig.onConfirm) alertConfig.onConfirm(); closeAlert(); }}><Text style={[styles.alertConfirmText, isDarkMode && {color: '#111'}]}>확인</Text></TouchableOpacity>
                </View>
              ) : ( <Text style={styles.alertHintText}>아무 곳이나 터치하여 닫기</Text> )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isProofModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsProofModalVisible(false)}>
        <View style={[styles.modalHeader, {backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor}]}>
          <Text style={[styles.modalTitleText, {color: theme.textMain}]}>Workout Complete!</Text>
          <TouchableOpacity onPress={() => { setIsProofModalVisible(false); setProofImageUri(null); }}><Ionicons name="close" size={28} color={theme.textMain} /></TouchableOpacity>
        </View>
        <View style={styles.proofModalContent}>
          {proofImageUri ? (
            <ScrollView contentContainerStyle={styles.proofStudioWrapper}>
              <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={[styles.viewShotContainer, { aspectRatio: proofImageAspect }]}>
                <Image source={{ uri: proofImageUri }} style={styles.proofBackgroundImage} />
                <View style={styles.darkOverlay} />
                <View style={styles.proofTopRow}>
                  <Text style={styles.proofDateText}>{dbDateString.replace(/-/g, '.')}</Text>
                  <Text style={styles.proofLogoText}>나만의 운동 기록</Text>
                </View>
                <View style={styles.proofExerciseList}>
                  {exercises.filter(ex => ex.isChecked).slice(0, 7).map((ex, idx) => (
                    <View key={idx} style={styles.proofExerciseItem}>
                      <Text style={styles.proofExName}>{ex.name}</Text>
                      <Text style={styles.proofExDetail}>{formatExerciseDetail(ex)}</Text>
                    </View>
                  ))}
                  {exercises.filter(ex => ex.isChecked).length > 7 && (
                    <Text style={[styles.proofExMoreText, {color: theme.accentPrimary}]}>...외 {exercises.filter(ex => ex.isChecked).length - 7}개 운동 완료</Text>
                  )}
                  {memo ? ( <Text style={styles.proofMemoText}>"{memo}"</Text> ) : null}
                </View>
              </ViewShot>
              <TouchableOpacity style={[styles.shareBtn, {backgroundColor: theme.accentPrimary, borderRadius: theme.radius}]} onPress={captureAndShareProof}><Ionicons name="share-social" size={20} color={isDarkMode ? '#111' : '#fff'} style={{marginRight: 8}} /><Text style={[styles.shareBtnText, isDarkMode && {color: '#111'}]}>SNS 공유하기</Text></TouchableOpacity>
              <TouchableOpacity style={styles.repickBtn} onPress={() => setProofImageUri(null)}><Text style={styles.repickBtnText}>사진 다시 고르기</Text></TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={[styles.imagePickerPlaceholder, {backgroundColor: theme.bg}]}>
              <Ionicons name="image-outline" size={60} color={theme.textSub} style={{marginBottom: 20}} />
              <Text style={[styles.imagePickerHint, {color: theme.textSub}]}>자랑스러운 오늘 운동을 사진으로 남겨보세요!</Text>
              <TouchableOpacity style={[styles.pickerBtnPrimary, {backgroundColor: theme.accentPrimary, borderRadius: theme.radius}]} onPress={() => pickProofImage(true)}><Ionicons name="camera" size={20} color={isDarkMode ? '#111' : '#fff'} style={{marginRight: 8}}/><Text style={[styles.pickerBtnPrimaryText, isDarkMode && {color: '#111'}]}>지금 사진 촬영하기</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.pickerBtnSecondary, {backgroundColor: theme.cardBg, borderColor: theme.accentPrimary, borderRadius: theme.radius}]} onPress={() => pickProofImage(false)}><Ionicons name="images" size={20} color={theme.accentPrimary} style={{marginRight: 8}}/><Text style={[styles.pickerBtnSecondaryText, {color: theme.accentPrimary}]}>갤러리에서 불러오기</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1 },
  container: { flex: 1 },
  header: { marginBottom: 20, paddingHorizontal: 4 },
  headerSub: { fontSize: 14, marginBottom: 4, fontWeight: '500' },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },

  dateCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1, borderWidth: 1 },
  dateText: { fontSize: 18, fontWeight: 'bold' },
  restButton: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  restButtonText: { fontSize: 13, fontWeight: 'bold' },

  timerWidget: { flexDirection: 'row', padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1, alignItems: 'center', borderWidth: 1 },
  timerLeft: { flex: 1, paddingRight: 16, borderRightWidth: 1, justifyContent: 'center' },
  timerRight: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  timerTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  timerTitle: { fontSize: 14, fontWeight: 'bold', marginLeft: 6 },
  timerControlRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, 
  timerAdjustBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  timerValue: { flex: 1, textAlign: 'center', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  quickAddRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  quickAddBtn: { width: '48%', paddingVertical: 8, alignItems: 'center' },
  quickAddText: { fontWeight: 'bold', fontSize: 13 },
  timerPlayLargeBtn: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },

  waterWidget: { padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1, borderWidth: 1 },
  
  // 🌟 버튼과 텍스트의 간격을 벌리고 안정적으로 배치하기 위해 Flexbox를 수정했습니다.
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  waterTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  waterTitle: { fontSize: 16, fontWeight: 'bold', flexShrink: 1 },
  waterButton: { paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  
  waterProgressBarBg: { height: 12, borderRadius: 6, overflow: 'hidden' },
  waterProgressBarFill: { height: '100%', borderRadius: 6 },
  waterCompletedCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  waterCompletedTitle: { fontSize: 16, fontWeight: 'bold' },
  waterCompletedSub: { fontSize: 13, marginTop: 4 },
  
  mainTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 8, marginBottom: 12 },
  
  card: { padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  checkboxContainer: { marginRight: 12 },
  
  exerciseNameInputTouchable: { flex: 1, paddingVertical: 8, borderBottomWidth: 1 },
  exerciseNameText: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  
  cardHeaderActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 4, marginLeft: 6 },
  
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { flex: 1, paddingHorizontal: 4, paddingVertical: 10, fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginHorizontal: 4, borderWidth: 1 },
  unitText: { fontSize: 14, fontWeight: 'bold', marginRight: 4 },
  
  addButton: { padding: 16, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderStyle: 'dashed' },
  addButtonText: { fontWeight: 'bold', fontSize: 15 },
  
  memoContainer: { marginBottom: 30 },
  memoTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 10, marginLeft: 8 },
  memoInput: { padding: 16, height: 100, textAlignVertical: 'top', fontSize: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1, borderWidth: 1 },
  
  completeButton: { padding: 18, alignItems: 'center', marginBottom: 10, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  completeButtonText: { fontSize: 16, fontWeight: 'bold' },
  
  emptyCard: { padding: 40, marginBottom: 24, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 1, borderWidth: 1 },
  emptyText: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },

  searchModalContainer: { flex: 1 },
  searchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  searchTitle: { fontSize: 18, fontWeight: 'bold' },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', margin: 16, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '500' },
  customAddBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, padding: 16, justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 2 },
  customAddBtnText: { fontSize: 16, fontWeight: 'bold' },
  searchListItem: { padding: 18, borderBottomWidth: 1 },
  searchListText: { fontSize: 16, fontWeight: '500' },
  searchEmptyText: { textAlign: 'center', marginTop: 40, fontSize: 15, fontWeight: '500' },

  alertBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  alertBox: { width: 300, padding: 24, alignItems: 'center', elevation: 10 },
  alertTitleText: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  alertMessageText: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  alertHintText: { fontSize: 13, color: '#aaa', marginTop: 4, fontStyle: 'italic' },
  alertBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 10 },
  alertCancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  alertConfirmBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  alertCancelText: { fontWeight: 'bold', fontSize: 15 },
  alertConfirmText: { fontWeight: 'bold', fontSize: 15 },

  proofCreateBtn: { flexDirection: 'row', paddingVertical: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  proofCreateBtnText: { fontSize: 16, fontWeight: 'bold' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitleText: { fontSize: 18, fontWeight: 'bold' },
  proofModalContent: { flex: 1, backgroundColor: '#111' },
  imagePickerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  imagePickerHint: { fontSize: 15, marginBottom: 30, textAlign: 'center' },
  pickerBtnPrimary: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 24, marginBottom: 12, width: '100%', justifyContent: 'center', alignItems: 'center' },
  pickerBtnPrimaryText: { fontSize: 16, fontWeight: 'bold' },
  pickerBtnSecondary: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 24, width: '100%', justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  pickerBtnSecondaryText: { fontSize: 16, fontWeight: 'bold' },
  proofStudioWrapper: { alignItems: 'center', padding: 20 },
  viewShotContainer: { width: '100%', overflow: 'hidden', backgroundColor: '#000', position: 'relative' },
  proofBackgroundImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' }, 
  proofTopRow: { position: 'absolute', top: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proofDateText: { color: '#fff', fontSize: 24, fontWeight: '900', fontStyle: 'italic', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  proofLogoText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  proofExerciseList: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  proofExerciseItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  proofExName: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginRight: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  proofExDetail: { color: '#eee', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  proofExMoreText: { fontSize: 12, fontWeight: 'bold', textAlign: 'left', marginTop: 4, fontStyle: 'italic', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  proofMemoText: { color: '#fff', fontSize: 14, fontWeight: 'bold', fontStyle: 'italic', textAlign: 'center', marginTop: 20, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  shareBtn: { flexDirection: 'row', paddingVertical: 16, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  shareBtnText: { fontSize: 18, fontWeight: 'bold' },
  repickBtn: { marginTop: 20, padding: 10, marginBottom: 40 },
  repickBtnText: { color: '#aaa', fontSize: 14, textDecorationLine: 'underline' }
});
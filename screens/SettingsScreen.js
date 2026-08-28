// screens/SettingsScreen.js
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Switch, ScrollView, TouchableOpacity, Modal, FlatList, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons'; 
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { getSettings, updateSetting, updateProfile, getAllTemplates, setActiveTemplate, saveNewRoutineTemplate, getRoutineTemplateById, updateRoutineTemplate, deleteRoutineTemplate, restoreSettingsAndTemplates } from '../dbQueries';
import PolicyModal from '../components/PolicyModal'; 

const GEOFENCING_TASK = 'GYM_GEOFENCING_TASK';

const EXERCISE_DICTIONARY = [
  '로슨 플랫 체스트', '로슨 인클라인 체스트', '체스트 프레스 머신', '인클라인 체스트 프레스 머신', '펙덱 플라이', '벤치프레스', '인클라인 벤치프레스', '덤벨 플라이', '딥스', '케이블 크로스 오버',
  '로슨 하이로우', '로슨 시티드로우', '로슨 로우로우', '시티드 로우 머신', '로우 케이블 머신', '랫 풀다운 케이블', '데드리프트', '바벨 로우', '덤벨 로우', '풀업(턱걸이)', '티바 로우', '어시스트 머신',
  '레그 프레스', '시티드 레그프레스 머신', '브이 스쿼트 머신', '라잉 레그컬 머신', '힙 어덕션 머신', '스쿼트', '런지', '레그 익스텐션', '카프 레이즈', '파워 레그프레스', '레그 컬',
  '밀리터리 프레스', '오버헤드 프레스', '사이드 레터럴 레이즈', '프론트 레이즈', '벤트오버 레터럴 레이즈', '숄더 프레스 머신',
  '프리쳐 컬 머신', '바벨 컬', '덤벨 컬', '해머 컬', '트라이셉스 익스텐션', '케이블 푸시다운', '라잉 트라이셉스 익스텐션',
  '행잉 레그레이즈', '크런치', '레그 레이즈', '플랭크', 'ab 슬라이드', '케이블 크런치',
  '걷기', '달리기(러닝)', '천국의 계단(스텝밀)', '실내 사이클', '로잉머신', '일립티컬'
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets(); 

  const [name, setName] = useState('사용자');
  const [height, setHeight] = useState(171);
  const [weight, setWeight] = useState(65);
  const [weeklyGoal, setWeeklyGoal] = useState(5);
  const [waterGoal, setWaterGoal] = useState(700); 

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLongTermPause, setIsLongTermPause] = useState(false);
  const [templateList, setTemplateList] = useState([]);
  
  const [gymLat, setGymLat] = useState(null);
  const [gymLng, setGymLng] = useState(null);
  const [isGeofencingActive, setIsGeofencingActive] = useState(false);

  const [isRoutineModalVisible, setRoutineModalVisible] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null); 
  const [newTemplateName, setNewTemplateName] = useState(''); 
  const [cycleDays, setCycleDays] = useState('3'); 
  const [routineData, setRoutineData] = useState([[], [], []]);

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', onConfirm: null, dismissible: true });
  const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingExTarget, setEditingExTarget] = useState(null); 
  const searchInputRef = useRef(null);

  const showAlert = (title, message, type = 'info', onConfirm = null, dismissible = true) => { setAlertConfig({ visible: true, title, message, type, onConfirm, dismissible }); };
  const closeAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  useFocusEffect(
    useCallback(() => { loadData(); checkGeofencingStatus(); }, [])
  );

  const loadData = async () => {
    const data = await getSettings();
    setName(data.user_name || '사용자');
    setHeight(data.height > 0 ? data.height : 171);
    setWeight(data.weight > 0 ? data.weight : 65);
    setWeeklyGoal(data.weekly_goal > 0 ? data.weekly_goal : 5);
    setWaterGoal(data.water_goal > 0 ? data.water_goal : 700);
    setIsDarkMode(data.is_dark_mode === 1);
    setIsLongTermPause(data.is_long_term_pause === 1);
    if (data.gym_lat && data.gym_lng) { setGymLat(data.gym_lat); setGymLng(data.gym_lng); }
    const templates = await getAllTemplates();
    setTemplateList(templates);
  };

  const checkGeofencingStatus = async () => {
    const isRegistered = await Location.hasStartedGeofencingAsync(GEOFENCING_TASK);
    setIsGeofencingActive(isRegistered);
  };

  const handleRegisterGymLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return showAlert('권한 필요', '위치 정보 접근 권한이 필요합니다.', 'info');
    let backStatus = await Location.requestBackgroundPermissionsAsync();
    if (backStatus.status !== 'granted') return showAlert('권한 필요', '앱을 껐을 때도 알림을 받으려면 설정에서 위치 권한을 "항상 허용"으로 변경해주세요.', 'info');

    try {
      showAlert('위치 탐색 중', '현재 위치를 탐색하고 있습니다.\n잠시만 기다려 주세요.', 'info', null, false);
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = location.coords.latitude; const lng = location.coords.longitude;
      await updateSetting('gym_lat', lat); await updateSetting('gym_lng', lng);
      setGymLat(lat); setGymLng(lng);
      await Location.startGeofencingAsync(GEOFENCING_TASK, [{
        identifier: 'MyGym', latitude: lat, longitude: lng, radius: 50, notifyOnEnter: true, notifyOnExit: true,
      }]);
      setIsGeofencingActive(true);
      showAlert('등록 완료', '현재 위치가 내 헬스장으로 등록되었습니다! 이제 50m 반경에 들어오고 나갈 때 알림을 보내드립니다.', 'info');
    } catch (error) { showAlert('오류', '위치를 가져오거나 지오펜싱을 설정하는데 실패했습니다.', 'info'); }
  };

  const handleStopGeofencing = async () => {
    try {
      await Location.stopGeofencingAsync(GEOFENCING_TASK);
      await updateSetting('gym_lat', null); await updateSetting('gym_lng', null);
      setGymLat(null); setGymLng(null); setIsGeofencingActive(false);
      showAlert('해제 완료', '헬스장 자동 알림 기능이 해제되었습니다.', 'info');
    } catch (error) { showAlert('오류', '해제 중 문제가 발생했습니다.', 'info'); }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) return showAlert('입력 확인', '이름을 입력해 주세요.', 'info');
    await updateProfile(name.trim(), height, weight); 
    showAlert('저장 완료', '프로필 정보가 저장되었습니다.', 'info');
  };

  // 🌟 핵심 추가: 스위치가 변경될 때 DeviceEventEmitter로 앱 전체에 방송합니다.
  const handleToggle = async (key, currentValue, setFunction) => {
    const newValue = !currentValue; 
    setFunction(newValue); 
    await updateSetting(key, newValue ? 1 : 0);

    if (key === 'is_dark_mode') {
      DeviceEventEmitter.emit('themeChanged', newValue);
    }
  };

  const adjustWeeklyGoal = async (step) => {
    let newVal = weeklyGoal + step; if (newVal < 1) newVal = 1; if (newVal > 7) newVal = 7;
    setWeeklyGoal(newVal); await updateSetting('weekly_goal', newVal);
  };

  const adjustWaterGoal = async (step) => {
    let newVal = waterGoal + step; if (newVal < 100) newVal = 100;
    setWaterGoal(newVal); await updateSetting('water_goal', newVal); 
  };

  const adjustHeight = (step) => { let newVal = height + step; if (newVal < 50) newVal = 50; setHeight(newVal); };
  const adjustWeight = (step) => { let newVal = weight + step; if (newVal < 20) newVal = 20; setWeight(newVal); };

  const handleBackupDB = async () => {
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/workout_tracker_v3.db`;
      const fileExists = await FileSystem.getInfoAsync(dbPath);
      if (!fileExists.exists) return showAlert('안내', '아직 백업할 데이터가 생성되지 않았습니다.', 'info');
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) await Sharing.shareAsync(dbPath, { dialogTitle: '나만의 운동 기록 DB 백업', mimeType: 'application/x-sqlite3' });
    } catch (error) {}
  };

  const handleRestoreDB = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      
      showAlert('전체 기록 복원', '선택한 파일로 전체 운동 기록(DB)을 덮어씌우시겠습니까?\n이 작업은 되돌릴 수 없으며, 적용을 위해 앱을 껐다 켜야 합니다.', 'confirm', async () => {
        try {
          const dbPath = `${FileSystem.documentDirectory}SQLite/workout_tracker_v3.db`;
          await FileSystem.copyAsync({ from: result.assets[0].uri, to: dbPath });
          showAlert('복원 완료', '데이터베이스 복원이 완료되었습니다.\n지금 앱을 강제로 종료한 후 다시 실행해 주세요.', 'info', null, false);
        } catch (e) {
          showAlert('오류', '데이터베이스 복원 중 문제가 발생했습니다.', 'info');
        }
      });
    } catch (error) {}
  };

  const handleBackupSettings = async () => {
    try {
      const settings = await getSettings();
      const templates = await getAllTemplates();
      const fullTemplates = [];
      for (const t of templates) {
        const fullT = await getRoutineTemplateById(t.id);
        if (fullT) fullTemplates.push(fullT);
      }
      const exportData = { settings, templates: fullTemplates };
      const jsonString = JSON.stringify(exportData, null, 2);
      const filePath = `${FileSystem.cacheDirectory}Workout_Settings_Backup.json`;
      await FileSystem.writeAsStringAsync(filePath, jsonString, { encoding: 'utf8' });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) await Sharing.shareAsync(filePath, { dialogTitle: '설정 및 템플릿 백업' });
    } catch (error) {}
  };

  const handleRestoreSettings = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const fileContents = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'utf8' });
      const parsedData = JSON.parse(fileContents);
      if (!parsedData.settings && !parsedData.templates) return showAlert('오류', '올바른 백업 파일 형식이 아닙니다.', 'info');
      
      showAlert('설정 복원', '설정과 루틴 템플릿 데이터를 덮어쓰시겠습니까?', 'confirm', async () => {
        try {
          await restoreSettingsAndTemplates(parsedData);
          await AsyncStorage.setItem('template_update_time', Date.now().toString()); 
          showAlert('복원 완료', '데이터가 성공적으로 복원되었습니다.', 'info');
          loadData();
        } catch (e) { showAlert('오류', '데이터 복원 중 문제가 발생했습니다.', 'info'); }
      });
    } catch (error) {}
  };

  const handleSelectTemplate = async (templateId, templateName) => {
    await setActiveTemplate(templateId); 
    await AsyncStorage.setItem('template_update_time', Date.now().toString()); 
    showAlert('루틴 시작', `[${templateName}] 루틴을 시작합니다!`, 'info'); 
    loadData(); 
  };

  const handleDeleteTemplate = (templateId, templateName) => {
    showAlert('템플릿 삭제', `'${templateName}' 템플릿을 정말 삭제하시겠습니까?`, 'confirm', async () => {
      try { 
        await deleteRoutineTemplate(templateId); 
        await AsyncStorage.setItem('template_update_time', Date.now().toString()); 
        showAlert('삭제 완료', '템플릿이 삭제되었습니다.', 'info'); loadData(); 
      } catch (error) {}
    });
  };

  const handleOpenCreateModal = () => {
    setEditingTemplateId(null); setNewTemplateName(''); setCycleDays('3'); setRoutineData([[], [], []]); setRoutineModalVisible(true);
  };

  const handleOpenEditModal = async (templateId) => {
    try {
      const template = await getRoutineTemplateById(templateId);
      if (template) {
        setEditingTemplateId(template.id); setNewTemplateName(template.name);
        setCycleDays(template.totalDays.toString()); setRoutineData(template.routineData); setRoutineModalVisible(true);
      }
    } catch (error) {}
  };

  const handleCycleDaysChange = (text) => {
    setCycleDays(text);
    const numDays = parseInt(text) || 1;
    if (numDays > 14) return showAlert('안내', '주기는 최대 14일까지만 설정 가능합니다.', 'info');
    setRoutineData(prevData => {
      const newData = [...prevData];
      if (numDays > newData.length) { for (let i = newData.length; i < numDays; i++) newData.push([]); } 
      else if (numDays < newData.length) { newData.length = Math.max(1, numDays); }
      return newData;
    });
  };

  const addExerciseToDay = (dayIndex) => {
    setRoutineData(prevData => {
      const newData = [...prevData];
      newData[dayIndex] = [...newData[dayIndex], { id: Date.now().toString(), name: '', weight: '', reps: '', sets: '', time: '', speed: '', distance: '', type: 'WEIGHT' }];
      return newData;
    });
  };

  const moveTemplateDay = (dayIndex, direction) => {
    setRoutineData(prevData => {
      const newData = [...prevData];
      if (direction === -1 && dayIndex > 0) {
        const temp = newData[dayIndex]; newData[dayIndex] = newData[dayIndex - 1]; newData[dayIndex - 1] = temp;
      } else if (direction === 1 && dayIndex < newData.length - 1) {
        const temp = newData[dayIndex]; newData[dayIndex] = newData[dayIndex + 1]; newData[dayIndex + 1] = temp;
      }
      return newData;
    });
  };

  const moveTemplateExercise = (dayIndex, exerciseIndex, direction) => {
    setRoutineData(prevData => {
      const newData = [...prevData]; const newDay = [...newData[dayIndex]];
      if (direction === -1 && exerciseIndex > 0) {
        const temp = newDay[exerciseIndex]; newDay[exerciseIndex] = newDay[exerciseIndex - 1]; newDay[exerciseIndex - 1] = temp;
      } else if (direction === 1 && exerciseIndex < newDay.length - 1) {
        const temp = newDay[exerciseIndex]; newDay[exerciseIndex] = newDay[exerciseIndex + 1]; newDay[exerciseIndex + 1] = temp;
      }
      newData[dayIndex] = newDay; return newData;
    });
  };

  const removeTemplateExercise = (dayIndex, exerciseIndex) => {
    setRoutineData(prevData => {
      const newData = [...prevData]; const newDay = [...newData[dayIndex]];
      newDay.splice(exerciseIndex, 1); newData[dayIndex] = newDay; return newData;
    });
  };

  const updateTemplateExercise = (dayIndex, exerciseIndex, field, value) => {
    setRoutineData(prevData => {
      const newData = [...prevData]; const newDay = [...newData[dayIndex]]; 
      let newType = newDay[exerciseIndex].type || 'WEIGHT';
      if (field === 'name') {
        const isCardio = ['천국', '계단', '걷기', '뛰기', '달리기', '자전거', '사이클', '런닝', '유산소', '러닝', '도보', '산책', '로잉머신', '일립티컬'].some(k => value.includes(k));
        newType = isCardio ? 'CARDIO' : 'WEIGHT';
      }
      newDay[exerciseIndex] = { ...newDay[exerciseIndex], [field]: value, type: newType }; 
      newData[dayIndex] = newDay; return newData;
    });
  };

  const handleSelectExerciseFromSearch = (selectedName) => {
    if (editingExTarget) {
      updateTemplateExercise(editingExTarget.dayIndex, editingExTarget.exIndex, 'name', selectedName);
    }
    setIsSearchModalVisible(false);
    setSearchKeyword('');
    setEditingExTarget(null);
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return showAlert('안내', '템플릿 이름을 입력해 주세요.', 'info');
    const totalDays = parseInt(cycleDays) || 1;
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
      const dayExercises = routineData[dayIndex] || [];
      for (let i = 0; i < dayExercises.length; i++) {
        const ex = dayExercises[i];
        if (!ex.name || ex.name.trim() === '') return showAlert('입력 확인', `${dayIndex + 1}일차에 이름이 없는 운동 기구가 있습니다.`, 'info');
      }
    }
    try {
      if (editingTemplateId) { await updateRoutineTemplate(editingTemplateId, newTemplateName, totalDays, routineData); showAlert('수정 완료', '템플릿이 수정되었습니다.', 'info'); } 
      else { await saveNewRoutineTemplate(newTemplateName, totalDays, routineData); showAlert('저장 완료', '새로운 템플릿이 저장되었습니다!', 'info'); }
      
      await AsyncStorage.setItem('template_update_time', Date.now().toString()); 
      setRoutineModalVisible(false); loadData(); 
    } catch (error) {}
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
    borderColor: isDarkMode ? '#2A2F3A' : '#F0F0F0',
  };

  return (
    <View style={[styles.mainWrapper, { backgroundColor: theme.bg, paddingTop: insets.top + 20 }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={[styles.headerSub, {color: theme.textSub}]}>나만의 맞춤 루틴</Text>
          <Text style={[styles.headerTitle, {color: theme.textMain}]}>설정</Text>
        </View>

        <Text style={[styles.sectionTitle, {color: theme.textSub}]}>내 프로필</Text>
        <View style={[styles.card, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
          <View style={styles.settingRow}>
            <Text style={[styles.label, {color: theme.textMain}]}>이름</Text>
            <TextInput style={[styles.nameTextInput, {backgroundColor: theme.inputBg, color: theme.textMain, borderColor: theme.borderColor, borderRadius: theme.radius}]} value={name} onChangeText={setName} placeholder="이름 입력" placeholderTextColor={theme.textSub} />
          </View>
          <View style={[styles.divider, {backgroundColor: theme.borderColor}]} />
          <View style={styles.settingRow}>
            <Text style={[styles.label, {color: theme.textMain}]}>키</Text>
            <View style={[styles.stepperContainer, {backgroundColor: theme.inputBg, borderColor: theme.borderColor, borderRadius: theme.radius}]}>
              <TouchableOpacity style={[styles.stepperBtn, {backgroundColor: theme.cardBg, borderRadius: theme.radius}]} onPress={() => adjustHeight(-1)}><Ionicons name="remove" size={18} color={theme.textMain} /></TouchableOpacity>
              <Text style={[styles.stepperValue, {color: theme.textMain}]}>{height} cm</Text>
              <TouchableOpacity style={[styles.stepperBtn, {backgroundColor: theme.cardBg, borderRadius: theme.radius}]} onPress={() => adjustHeight(1)}><Ionicons name="add" size={18} color={theme.textMain} /></TouchableOpacity>
            </View>
          </View>
          <View style={[styles.divider, {backgroundColor: theme.borderColor}]} />
          <View style={styles.settingRow}>
            <Text style={[styles.label, {color: theme.textMain}]}>몸무게</Text>
            <View style={[styles.stepperContainer, {backgroundColor: theme.inputBg, borderColor: theme.borderColor, borderRadius: theme.radius}]}>
              <TouchableOpacity style={[styles.stepperBtn, {backgroundColor: theme.cardBg, borderRadius: theme.radius}]} onPress={() => adjustWeight(-1)}><Ionicons name="remove" size={18} color={theme.textMain} /></TouchableOpacity>
              <Text style={[styles.stepperValue, {color: theme.textMain}]}>{weight} kg</Text>
              <TouchableOpacity style={[styles.stepperBtn, {backgroundColor: theme.cardBg, borderRadius: theme.radius}]} onPress={() => adjustWeight(1)}><Ionicons name="add" size={18} color={theme.textMain} /></TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={[styles.saveButton, {backgroundColor: theme.accentPrimary, borderRadius: theme.radius}]} onPress={handleSaveProfile}><Text style={[styles.saveButtonText, isDarkMode && {color: '#111'}]}>프로필 저장</Text></TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, {color: theme.textSub}]}>앱 설정</Text>
        <View style={[styles.card, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.label, {color: theme.textMain}]}>주간 목표 운동일</Text>
              <Text style={[styles.subLabel, {color: theme.textSub}]}>일주일 중 며칠 운동할지 설정합니다.</Text>
            </View>
            <View style={[styles.stepperContainer, {backgroundColor: theme.inputBg, borderColor: theme.borderColor, borderRadius: theme.radius}]}>
              <TouchableOpacity style={[styles.stepperBtn, {backgroundColor: theme.cardBg, borderRadius: theme.radius}]} onPress={() => adjustWeeklyGoal(-1)}><Ionicons name="remove" size={18} color={theme.textMain} /></TouchableOpacity>
              <Text style={[styles.stepperValue, {color: theme.textMain}]}>{weeklyGoal} 일</Text>
              <TouchableOpacity style={[styles.stepperBtn, {backgroundColor: theme.cardBg, borderRadius: theme.radius}]} onPress={() => adjustWeeklyGoal(1)}><Ionicons name="add" size={18} color={theme.textMain} /></TouchableOpacity>
            </View>
          </View>
          <View style={[styles.divider, {backgroundColor: theme.borderColor}]} />
          <View style={styles.settingRow}>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.label, {color: theme.textMain}]}>일일 수분 목표</Text>
              <Text style={[styles.subLabel, {color: theme.textSub}]}>하루에 마실 물의 양을 설정합니다.</Text>
            </View>
            <View style={[styles.stepperContainer, {backgroundColor: theme.inputBg, borderColor: theme.borderColor, borderRadius: theme.radius}]}>
              <TouchableOpacity style={[styles.stepperBtn, {backgroundColor: theme.cardBg, borderRadius: theme.radius}]} onPress={() => adjustWaterGoal(-100)}><Ionicons name="remove" size={18} color={theme.textMain} /></TouchableOpacity>
              <Text style={[styles.stepperValue, {color: theme.textMain}]}>{waterGoal} ml</Text>
              <TouchableOpacity style={[styles.stepperBtn, {backgroundColor: theme.cardBg, borderRadius: theme.radius}]} onPress={() => adjustWaterGoal(100)}><Ionicons name="add" size={18} color={theme.textMain} /></TouchableOpacity>
            </View>
          </View>
          <View style={[styles.divider, {backgroundColor: theme.borderColor}]} />
          <View style={styles.settingRow}>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.label, {color: theme.textMain}]}>다크 모드 (Titan 테마)</Text>
              <Text style={[styles.subLabel, {color: theme.textSub}]}>디자인이 시안블루 톤의 각진 형태로 바뀝니다.</Text>
            </View>
            <Switch value={isDarkMode} onValueChange={() => handleToggle('is_dark_mode', isDarkMode, setIsDarkMode)} trackColor={{ false: theme.inputBg, true: theme.accentPrimary }} thumbColor={isDarkMode ? '#fff' : '#fff'} />
          </View>
          <View style={[styles.divider, {backgroundColor: theme.borderColor}]} />
          <View style={styles.settingRow}>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.label, {color: theme.textMain}]}>장기 휴식 모드</Text>
              <Text style={[styles.subLabel, {color: theme.textSub}]}>루틴 순환을 일시 정지합니다.</Text>
            </View>
            <Switch value={isLongTermPause} onValueChange={() => handleToggle('is_long_term_pause', isLongTermPause, setIsLongTermPause)} trackColor={{ false: theme.inputBg, true: theme.accentPrimary }} thumbColor={isDarkMode ? '#fff' : '#fff'} />
          </View>
        </View>

        <Text style={[styles.sectionTitle, {color: theme.textSub}]}>스마트 기능</Text>
        <View style={[styles.card, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.label, {color: theme.textMain}]}>헬스장 자동 알림 <Text style={{fontSize: 11, color: theme.accentSecondary, fontWeight: 'normal'}}>(GPS 항상 허용)</Text></Text>
              <Text style={[styles.subLabel, {color: theme.textSub, marginTop: 6}]}>{isGeofencingActive ? "현재 위치가 등록되어 있습니다. 50m 반경 도착 시 알림을 받아요." : "지금 위치를 헬스장으로 등록합니다."}</Text>
            </View>
            <Switch value={isGeofencingActive} onValueChange={isGeofencingActive ? handleStopGeofencing : handleRegisterGymLocation} trackColor={{ false: theme.inputBg, true: theme.accentSecondary }} thumbColor="#fff" />
          </View>
        </View>

        <Text style={[styles.sectionTitle, {color: theme.textSub}]}>데이터 관리</Text>
        <View style={[styles.card, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
          <View style={styles.dataGroupRow}>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.label, {color: theme.textMain}]}>운동 기록 (DB)</Text>
              <Text style={[styles.subLabel, {color: theme.textSub}]}>전체 운동 기록 데이터베이스</Text>
            </View>
            <View style={styles.dataBtnGroup}>
              <TouchableOpacity style={[styles.smallDataBtn, {backgroundColor: theme.inputBg, borderRadius: theme.radius}]} onPress={handleBackupDB}>
                <Text style={[styles.smallDataBtnText, {color: theme.textMain}]}>내보내기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallDataBtn, {backgroundColor: theme.inputBg, borderRadius: theme.radius}]} onPress={handleRestoreDB}>
                <Text style={[styles.smallDataBtnText, {color: theme.textMain}]}>불러오기</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.divider, {backgroundColor: theme.borderColor}]} />
          <View style={styles.dataGroupRow}>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.label, {color: theme.textMain}]}>앱 설정 및 루틴</Text>
              <Text style={[styles.subLabel, {color: theme.textSub}]}>프로필, 설정, 템플릿(JSON)</Text>
            </View>
            <View style={styles.dataBtnGroup}>
              <TouchableOpacity style={[styles.smallDataBtn, {backgroundColor: isDarkMode ? '#1E3A5F' : '#E1F5FE', borderRadius: theme.radius}]} onPress={handleBackupSettings}>
                <Text style={[styles.smallDataBtnText, {color: isDarkMode ? '#64B5F6' : '#03A9F4'}]}>내보내기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallDataBtn, {backgroundColor: isDarkMode ? '#1E3A5F' : '#E1F5FE', borderRadius: theme.radius}]} onPress={handleRestoreSettings}>
                <Text style={[styles.smallDataBtnText, {color: isDarkMode ? '#64B5F6' : '#03A9F4'}]}>불러오기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.routineHeaderRow}>
          <Text style={[styles.sectionTitle, {marginTop: 0, color: theme.textSub}]}>루틴 관리</Text>
          <TouchableOpacity style={[styles.createNewButton, {backgroundColor: theme.inputBg, borderRadius: theme.radius}]} onPress={handleOpenCreateModal}>
            <Text style={[styles.createNewButtonText, {color: theme.textMain}]}>+ 새 템플릿</Text>
          </TouchableOpacity>
        </View>
        
        {templateList.map(template => (
          <TouchableOpacity key={template.id} style={[styles.templateCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: template.is_active === 1 ? theme.accentPrimary : theme.borderColor}]} onPress={() => handleOpenEditModal(template.id)} activeOpacity={0.7}>
            <View style={{flex: 1}}>
              <Text style={[styles.templateName, {color: theme.textMain}]}>{template.name}</Text>
              <Text style={[styles.templateDetail, {color: theme.textSub}]}>{template.total_days}일 주기 순환 (터치하여 수정)</Text>
            </View>
            <View style={styles.templateActionRow}>
              {template.is_active === 1 ? (
                <View style={[styles.activeBadge, {backgroundColor: theme.accentPrimary, borderRadius: theme.radius}]}><Text style={[styles.activeBadgeText, isDarkMode && {color: '#111'}]}>사용 중</Text></View>
              ) : (
                <TouchableOpacity style={[styles.selectButton, {backgroundColor: theme.inputBg, borderRadius: theme.radius}]} onPress={() => handleSelectTemplate(template.id, template.name)}><Text style={[styles.selectButtonText, {color: theme.textMain}]}>선택하기</Text></TouchableOpacity>
              )}
              <TouchableOpacity style={styles.templateListDeleteBtn} onPress={() => handleDeleteTemplate(template.id, template.name)}><Ionicons name="trash-outline" size={22} color={theme.accentSecondary} /></TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, {color: theme.textSub}]}>앱 정보</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor, marginBottom: 40, alignItems: 'center', paddingVertical: 30 }]}>
          <Ionicons name="barbell" size={36} color={theme.accentPrimary} style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 18, fontWeight: '900', color: theme.textMain }}>나만의 운동 기록</Text>
          <Text style={{ fontSize: 13, color: theme.textSub, marginTop: 4, marginBottom: 20 }}>버전 1.0.0</Text>
          <Text style={{ fontSize: 14, color: theme.textSub }}>개발 및 운영: <Text style={{fontWeight: 'bold', color: theme.textMain}}>이종호</Text></Text>
          <Text style={{ fontSize: 14, color: theme.textSub, marginTop: 6 }}>문의: <Text style={{fontWeight: 'bold', color: theme.textMain}}>rnrals@gmail.com</Text></Text>
          <TouchableOpacity onPress={() => setIsPrivacyModalVisible(true)} style={{marginTop: 16}}>
            <Text style={{ fontSize: 13, color: theme.textSub, textDecorationLine: 'underline' }}>개인정보 처리방침 및 이용약관</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: theme.borderColor, marginTop: 24 }}>© 2026. All rights reserved.</Text>
        </View>

        <Modal visible={isRoutineModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRoutineModalVisible(false)}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingTemplateId ? '루틴 템플릿 수정' : '새 루틴 템플릿 만들기'}</Text>
            <TouchableOpacity onPress={() => setRoutineModalVisible(false)}><Text style={styles.modalCloseText}>취소</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.cycleSetupRow}>
              <Text style={styles.label}>루틴 이름</Text>
              <TextInput style={styles.nameInput} value={newTemplateName} onChangeText={setNewTemplateName} placeholder="예: 다이어트 5분할" />
            </View>
            <View style={styles.cycleSetupRow}>
              <Text style={styles.label}>몇 일 주기로 운동하시나요?</Text>
              <View style={{flexDirection:'row', alignItems:'center'}}>
                <TextInput style={styles.cycleInput} value={cycleDays} onChangeText={handleCycleDaysChange} keyboardType="numeric" selectTextOnFocus={true} />
                <Text style={styles.label}> 일</Text>
              </View>
            </View>

            {routineData.map((dayExercises, dayIndex) => (
              <View key={dayIndex} style={styles.dayCard}>
                <View style={styles.dayCardHeader}>
                  <Text style={styles.dayCardTitle}>{dayIndex + 1}일차</Text>
                  <View style={styles.dayCardActions}>
                    <TouchableOpacity onPress={() => moveTemplateDay(dayIndex, -1)} disabled={dayIndex === 0} style={styles.dayMoveBtn}><Ionicons name="chevron-up-circle" size={24} color={dayIndex === 0 ? "#ddd" : "#888"} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => moveTemplateDay(dayIndex, 1)} disabled={dayIndex === routineData.length - 1} style={styles.dayMoveBtn}><Ionicons name="chevron-down-circle" size={24} color={dayIndex === routineData.length - 1 ? "#ddd" : "#888"} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => addExerciseToDay(dayIndex)} style={styles.addExerciseButton}><Text style={styles.addExerciseButtonText}>+ 추가</Text></TouchableOpacity>
                  </View>
                </View>

                {dayExercises.length === 0 ? ( <Text style={styles.emptyDayText}>휴식일</Text> ) : (
                  dayExercises.map((ex, exIndex) => (
                    <View key={exIndex} style={styles.templateExerciseCard}>
                      <TouchableOpacity style={styles.templateInputNameTouchable} onPress={() => { setEditingExTarget({ dayIndex, exIndex }); setSearchKeyword(ex.name); setIsSearchModalVisible(true); }}>
                        <Text style={[styles.templateInputNameText, !ex.name && {color: '#999'}]}>{ex.name ? ex.name : '운동 이름 선택'}</Text>
                      </TouchableOpacity>
                      <View style={styles.templateExerciseBottomRow}>
                        <View style={styles.templateExerciseInputs}>
                          {ex.type === 'WEIGHT' ? (
                            <>
                              <TextInput style={styles.templateInputSmall} placeholder="kg" keyboardType="numeric" value={ex.weight?.toString()} onChangeText={(val) => updateTemplateExercise(dayIndex, exIndex, 'weight', val)} />
                              <TextInput style={styles.templateInputSmall} placeholder="회" keyboardType="numeric" value={ex.reps?.toString()} onChangeText={(val) => updateTemplateExercise(dayIndex, exIndex, 'reps', val)} />
                              <TextInput style={styles.templateInputSmall} placeholder="세트" keyboardType="numeric" value={ex.sets?.toString()} onChangeText={(val) => updateTemplateExercise(dayIndex, exIndex, 'sets', val)} />
                            </>
                          ) : (
                            <>
                              <TextInput style={styles.templateInputSmall} placeholder="분" keyboardType="numeric" value={ex.time?.toString()} onChangeText={(val) => updateTemplateExercise(dayIndex, exIndex, 'time', val)} />
                              <TextInput style={styles.templateInputSmall} placeholder="속도" keyboardType="numeric" value={ex.speed?.toString()} onChangeText={(val) => updateTemplateExercise(dayIndex, exIndex, 'speed', val)} />
                              <TextInput style={styles.templateInputSmall} placeholder="거리" keyboardType="numeric" value={ex.distance?.toString()} onChangeText={(val) => updateTemplateExercise(dayIndex, exIndex, 'distance', val)} />
                            </>
                          )}
                        </View>
                        <View style={styles.templateActionButtons}>
                          <TouchableOpacity onPress={() => moveTemplateExercise(dayIndex, exIndex, -1)} style={styles.templateIconButton} disabled={exIndex === 0}><Ionicons name="chevron-up" size={22} color={exIndex === 0 ? "#eee" : "#555"} /></TouchableOpacity>
                          <TouchableOpacity onPress={() => moveTemplateExercise(dayIndex, exIndex, 1)} style={styles.templateIconButton} disabled={exIndex === dayExercises.length - 1}><Ionicons name="chevron-down" size={22} color={exIndex === dayExercises.length - 1 ? "#eee" : "#555"} /></TouchableOpacity>
                          <TouchableOpacity onPress={() => removeTemplateExercise(dayIndex, exIndex)} style={styles.templateIconButton}><Ionicons name="trash-outline" size={22} color="#f44336" /></TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveTemplate}><Text style={styles.modalSaveButtonText}>{editingTemplateId ? '수정 내용 저장' : '새 템플릿 저장 및 선택'}</Text></TouchableOpacity>
        </Modal>

        <Modal visible={isSearchModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsSearchModalVisible(false)} onShow={() => { setTimeout(() => { searchInputRef.current?.focus(); }, 100); }}>
          <View style={styles.searchModalContainer}>
            <View style={styles.searchHeader}>
              <TouchableOpacity onPress={() => setIsSearchModalVisible(false)}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity>
              <Text style={styles.searchTitle}>운동 선택</Text>
              <View style={{width: 28}} />
            </View>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={20} color="#888" style={{marginRight: 8}} />
              <TextInput ref={searchInputRef} style={styles.searchInput} placeholder="운동 이름을 검색하거나 직접 입력하세요." value={searchKeyword} onChangeText={setSearchKeyword} />
            </View>
            {searchKeyword.trim() !== '' && !EXERCISE_DICTIONARY.includes(searchKeyword.trim()) && (
              <TouchableOpacity style={styles.customAddBtn} onPress={() => handleSelectExerciseFromSearch(searchKeyword.trim())}>
                <Ionicons name="add-circle" size={20} color="#fff" style={{marginRight: 6}} /><Text style={styles.customAddBtnText}>"{searchKeyword.trim()}" 직접 추가하기</Text>
              </TouchableOpacity>
            )}
            <FlatList data={filteredExercises} keyExtractor={(item) => item} keyboardShouldPersistTaps="handled" renderItem={({item}) => (<TouchableOpacity style={styles.searchListItem} onPress={() => handleSelectExerciseFromSearch(item)}><Text style={styles.searchListText}>{item}</Text></TouchableOpacity>)} ListEmptyComponent={() => (<Text style={styles.searchEmptyText}>검색 결과가 없습니다.</Text>)} />
          </View>
        </Modal>

        <PolicyModal visible={isPrivacyModalVisible} onClose={() => setIsPrivacyModalVisible(false)} />

        <Modal visible={alertConfig.visible} transparent={true} animationType="fade" onRequestClose={closeAlert}>
          <TouchableOpacity style={styles.alertBackdrop} activeOpacity={1} onPress={() => { if (alertConfig.dismissible) closeAlert(); }}>
            <TouchableOpacity activeOpacity={1} onPress={(alertConfig.type === 'info' && alertConfig.dismissible) ? closeAlert : undefined}>
              <View style={styles.alertBox}>
                <Text style={styles.alertTitleText}>{alertConfig.title}</Text>
                <Text style={styles.alertMessageText}>{alertConfig.message}</Text>
                {alertConfig.type === 'confirm' ? (
                  <View style={styles.alertBtnRow}>
                    <TouchableOpacity style={styles.alertCancelBtn} onPress={closeAlert}><Text style={styles.alertCancelText}>취소</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.alertConfirmBtn} onPress={() => { if (alertConfig.onConfirm) alertConfig.onConfirm(); closeAlert(); }}><Text style={styles.alertConfirmText}>확인</Text></TouchableOpacity>
                  </View>
                ) : ( alertConfig.dismissible && <Text style={styles.alertHintText}>아무 곳이나 터치하여 닫기</Text> )}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1 },
  container: { flex: 1 },
  header: { marginBottom: 20, paddingHorizontal: 4 },
  headerSub: { fontSize: 14, marginBottom: 4, fontWeight: '500' },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 16, marginBottom: 8, marginLeft: 8 },
  
  card: { padding: 20, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1, borderWidth: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  settingTextGroup: { flex: 1, paddingRight: 10 },
  label: { fontSize: 16, fontWeight: 'bold' },
  subLabel: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  
  nameTextInput: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, fontWeight: 'bold', textAlign: 'right', minWidth: 120, borderWidth: 1 },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', padding: 4, borderWidth: 1 },
  stepperBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  stepperValue: { width: 70, textAlign: 'center', fontSize: 15, fontWeight: 'bold' },
  
  dataGroupRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  dataBtnGroup: { flexDirection: 'row', gap: 8 },
  smallDataBtn: { paddingHorizontal: 12, paddingVertical: 10, minWidth: 70, alignItems: 'center' },
  smallDataBtnText: { fontWeight: 'bold', fontSize: 13 },
  
  divider: { height: 1, marginVertical: 8 },
  saveButton: { paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  routineHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10, paddingHorizontal: 4 },
  createNewButton: { paddingHorizontal: 14, paddingVertical: 8 },
  createNewButtonText: { fontSize: 13, fontWeight: 'bold' },
  
  templateCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1, borderWidth: 1 },
  templateName: { fontSize: 16, fontWeight: 'bold' },
  templateDetail: { fontSize: 13, marginTop: 6 }, 
  templateActionRow: { flexDirection: 'row', alignItems: 'center' },
  selectButton: { paddingHorizontal: 14, paddingVertical: 8 },
  selectButtonText: { fontWeight: 'bold', fontSize: 13 },
  activeBadge: { paddingHorizontal: 14, paddingVertical: 8 },
  activeBadgeText: { fontWeight: 'bold', fontSize: 13 },
  templateListDeleteBtn: { marginLeft: 12, padding: 4 },

  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalCloseText: { fontSize: 16, color: '#f44336', fontWeight: 'bold' },
  modalContent: { flex: 1, backgroundColor: '#f4f4f4', padding: 16 },
  cycleSetupRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12 },
  nameInput: { flex: 1, marginLeft: 16, borderBottomWidth: 1, borderBottomColor: '#ddd', fontSize: 16, paddingVertical: 4, textAlign: 'right' },
  cycleInput: { backgroundColor: '#FFF1F2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, fontSize: 18, fontWeight: 'bold', textAlign: 'center', width: 60, color: '#FF4D6D' },
  dayCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1 },
  dayCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  dayCardActions: { flexDirection: 'row', alignItems: 'center' },
  dayMoveBtn: { paddingHorizontal: 2 },
  addExerciseButton: { backgroundColor: '#FFF1F2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 8 },
  addExerciseButtonText: { color: '#FF4D6D', fontSize: 13, fontWeight: 'bold' },
  emptyDayText: { color: '#888', fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },
  templateExerciseCard: { backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 10 },
  templateInputNameTouchable: { borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8, marginBottom: 10, justifyContent: 'center' },
  templateInputNameText: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  templateExerciseBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  templateExerciseInputs: { flexDirection: 'row', flex: 1, gap: 6, marginRight: 10 },
  templateInputSmall: { flex: 1, backgroundColor: '#f9f9f9', borderRadius: 8, fontSize: 14, textAlign: 'center', paddingVertical: 8, borderWidth: 1, borderColor: '#eee' },
  templateActionButtons: { flexDirection: 'row', alignItems: 'center' },
  templateIconButton: { padding: 4, marginLeft: 2 },
  modalSaveButton: { backgroundColor: '#FF4D6D', padding: 18, alignItems: 'center' },
  modalSaveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  searchModalContainer: { flex: 1, backgroundColor: '#f4f4f4' },
  searchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: '#ddd' },
  searchInput: { flex: 1, fontSize: 16, color: '#333' },
  customAddBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF4D6D', marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 16, justifyContent: 'center' },
  customAddBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  searchListItem: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchListText: { fontSize: 16, color: '#333' },
  searchEmptyText: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },

  alertBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  alertBox: { width: 300, backgroundColor: '#fff', padding: 24, borderRadius: 24, alignItems: 'center', elevation: 10 },
  alertTitleText: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  alertMessageText: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  alertHintText: { fontSize: 13, color: '#aaa', marginTop: 4, fontStyle: 'italic' },
  alertBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 10 },
  alertCancelBtn: { flex: 1, backgroundColor: '#f0f0f0', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  alertConfirmBtn: { flex: 1, backgroundColor: '#FF4D6D', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  alertCancelText: { color: '#555', fontWeight: 'bold', fontSize: 15 },
  alertConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
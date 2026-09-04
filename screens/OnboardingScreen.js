// screens/OnboardingScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { updateProfile, updateSetting, saveNewRoutineTemplate } from '../dbQueries';

// 디자인 시스템 테마 색상 (온보딩은 기본 아이보리/핑크 테마 유지)
const ACCENT_COLOR = '#FF4D6D';
const BG_COLOR = '#F7F4F2';
const CARD_BG = '#FFFFFF';
const TEXT_DARK = '#222222';
const TEXT_GRAY = '#888888';
const INPUT_BG = '#F9F9F9';
const BORDER_COLOR = '#EEEEEE';

export default function OnboardingScreen({ onFinish }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // 상태 관리
  const [name, setName] = useState('');
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('65');
  const [weeklyGoal, setWeeklyGoal] = useState('5');
  const [waterGoal, setWaterGoal] = useState('900'); 
  
  const [templateName, setTemplateName] = useState('');
  const [cycleDays, setCycleDays] = useState('3');
  const [routineData, setRoutineData] = useState([[], [], []]);

  const handleNext = async () => {
    if (step === 1) {
      if (!name.trim()) {
        return Alert.alert("입력 확인", "이름(닉네임)을 입력해 주세요.");
      }
      await updateProfile(name.trim(), parseFloat(height) || 170, parseFloat(weight) || 65);
      setStep(2);
    } else if (step === 2) {
      await updateSetting('weekly_goal', parseInt(weeklyGoal) || 5);
      setStep(3);
    } else if (step === 3) {
      await updateSetting('water_goal', parseInt(waterGoal) || 900);
      setStep(4);
    } else if (step === 4) {
      const hasExercises = routineData.some(day => 
        day && day.length > 0 && day.some(ex => ex.name && ex.name.trim() !== '')
      );
      const hasTemplateName = templateName.trim() !== '';

      if (hasTemplateName && hasExercises) {
        const days = parseInt(cycleDays) || 1;
        await saveNewRoutineTemplate(templateName.trim(), days, routineData);
        onFinish();
      } else {
        Alert.alert(
          "안내",
          "설정에서 언제든지 나만의 루틴을 만들 수 있습니다.",
          [{ text: "확인", onPress: () => onFinish() }],
          { cancelable: false }
        );
      }
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const addExerciseToDay = (dayIndex) => {
    const newData = [...routineData];
    if (!newData[dayIndex]) newData[dayIndex] = [];
    newData[dayIndex].push({ id: Date.now().toString(), name: '', type: 'WEIGHT', weight: '', reps: '', sets: '' });
    setRoutineData(newData);
  };

  const updateExercise = (dayIndex, exIndex, field, value) => {
    const newData = [...routineData];
    newData[dayIndex][exIndex][field] = value;
    setRoutineData(newData);
  };

  const handleCycleDaysChange = (text) => {
    setCycleDays(text);
    const numDays = parseInt(text) || 1;
    if (numDays > 14) return Alert.alert('안내', '최대 14일까지만 설정 가능합니다.');
    const newData = [...routineData];
    if (numDays > newData.length) {
      for (let i = newData.length; i < numDays; i++) newData.push([]);
    } else if (numDays < newData.length) {
      newData.length = Math.max(1, numDays);
    }
    setRoutineData(newData);
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        {step > 1 ? (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={TEXT_DARK} />
          </TouchableOpacity>
        ) : <View style={styles.backButtonPlaceholder} />}
        
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${(step / totalSteps) * 100}%` }]} />
        </View>
        <Text style={styles.stepText}>{step} / {totalSteps}</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled" 
        showsVerticalScrollIndicator={false}
      >
        {/* 🌟 1단계: 신체 정보 및 이름 입력 */}
        {step === 1 && (
          <View style={styles.card}>
            <View style={styles.iconCircle}><Ionicons name="person" size={40} color={ACCENT_COLOR} /></View>
            <Text style={styles.title}>신체 정보를 알려주세요</Text>
            <Text style={styles.description}>맞춤형 기록 관리를 위해 꼭 필요한 정보입니다.</Text>
            
            {/* 🌟 이름(닉네임) 입력칸 확실히 배치 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>이름 (닉네임)</Text>
              <TextInput 
                style={styles.input} 
                value={name} 
                onChangeText={setName} 
                placeholder="이름(닉네임) 입력" 
                placeholderTextColor="#aaa" 
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>키 (cm)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={height} 
                  onChangeText={setHeight} 
                  placeholder="170"
                  placeholderTextColor="#aaa"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>몸무게 (kg)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  value={weight} 
                  onChangeText={setWeight} 
                  placeholder="65"
                  placeholderTextColor="#aaa"
                />
              </View>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <View style={styles.iconCircle}><Ionicons name="calendar" size={40} color={ACCENT_COLOR} /></View>
            <Text style={styles.title}>주간 운동 목표 설정</Text>
            <Text style={styles.description}>일주일에 며칠을 운동할지 나만의 목표를 정해보세요.</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>주간 목표 (일)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={weeklyGoal} onChangeText={setWeeklyGoal} />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.card}>
            <View style={[styles.iconCircle, {backgroundColor: '#E1F5FE'}]}><Ionicons name="water" size={40} color="#03A9F4" /></View>
            <Text style={styles.title}>일일 수분 섭취 목표</Text>
            <Text style={styles.description}>근육의 빠른 회복을 위해 하루 동안 마실 물의 양을 설정하세요.</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>수분 목표 (ml)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={waterGoal} onChangeText={setWaterGoal} />
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={styles.card}>
            <View style={styles.iconCircle}><Ionicons name="list" size={40} color={ACCENT_COLOR} /></View>
            <Text style={styles.title}>첫 루틴 만들기 (선택)</Text>
            <Text style={styles.description}>나중에 언제든 설정 탭에서 추가할 수 있습니다.</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>루틴 이름</Text>
              <TextInput style={styles.input} value={templateName} onChangeText={setTemplateName} placeholder="예: 3분할 루틴 (생략 가능)" placeholderTextColor="#aaa" />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>순환 주기 (일)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={cycleDays} onChangeText={handleCycleDaysChange} />
            </View>

            {routineData.map((dayExercises, dayIndex) => (
              <View key={dayIndex} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{dayIndex + 1}일차 운동</Text>
                  <TouchableOpacity onPress={() => addExerciseToDay(dayIndex)} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ 추가</Text>
                  </TouchableOpacity>
                </View>
                {dayExercises.length === 0 ? <Text style={styles.emptyText}>추가된 운동이 없습니다 (휴식일)</Text> : null}
                
                {dayExercises.map((ex, exIndex) => (
                  <View key={exIndex} style={styles.exRow}>
                    <TextInput style={styles.exInputName} placeholder="운동명" placeholderTextColor="#ccc" value={ex.name} onChangeText={(val) => updateExercise(dayIndex, exIndex, 'name', val)} />
                    <TextInput style={styles.exInputSmall} placeholder="kg" keyboardType="numeric" placeholderTextColor="#ccc" value={ex.weight} onChangeText={(val) => updateExercise(dayIndex, exIndex, 'weight', val)} />
                    <TextInput style={styles.exInputSmall} placeholder="회" keyboardType="numeric" placeholderTextColor="#ccc" value={ex.reps} onChangeText={(val) => updateExercise(dayIndex, exIndex, 'reps', val)} />
                    <TextInput style={styles.exInputSmall} placeholder="세트" keyboardType="numeric" placeholderTextColor="#ccc" value={ex.sets} onChangeText={(val) => updateExercise(dayIndex, exIndex, 'sets', val)} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 고정된 하단 버튼 구역 */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextButtonText}>
            {step === 4 ? "나만의 운동 기록 시작하기! 🎉" : "다음 단계로"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_COLOR },
  
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'space-between' },
  backButton: { padding: 8, marginLeft: -8 },
  backButtonPlaceholder: { width: 40 },
  progressContainer: { flex: 1, height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, marginHorizontal: 16, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: ACCENT_COLOR, borderRadius: 3 },
  stepText: { fontSize: 14, fontWeight: 'bold', color: TEXT_GRAY, width: 36, textAlign: 'right' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 100 },
  
  card: { backgroundColor: CARD_BG, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1, borderWidth: 1, borderColor: '#FFFFFF' },
  
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF1F2', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900', color: TEXT_DARK, textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  description: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  
  inputGroup: { marginBottom: 16 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: 'bold', color: TEXT_DARK, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: INPUT_BG, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16, fontSize: 15, color: TEXT_DARK, fontWeight: 'bold', borderWidth: 1, borderColor: BORDER_COLOR },
  
  footer: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: BG_COLOR },
  nextButton: { backgroundColor: ACCENT_COLOR, paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: ACCENT_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  nextButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  
  dayCard: { backgroundColor: '#FAFAFA', padding: 14, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: BORDER_COLOR },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayTitle: { fontSize: 15, fontWeight: 'bold', color: TEXT_DARK },
  addBtn: { backgroundColor: '#FFF1F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: ACCENT_COLOR, fontWeight: 'bold', fontSize: 12 },
  emptyText: { color: '#AAA', fontSize: 13, textAlign: 'center', marginVertical: 8, fontStyle: 'italic' },
  
  exRow: { flexDirection: 'row', marginBottom: 8, gap: 6 },
  exInputName: { flex: 2, backgroundColor: CARD_BG, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: BORDER_COLOR, fontSize: 13, fontWeight: 'bold', color: TEXT_DARK },
  exInputSmall: { flex: 1, backgroundColor: CARD_BG, padding: 10, borderRadius: 10, textAlign: 'center', borderWidth: 1, borderColor: BORDER_COLOR, fontSize: 13, fontWeight: 'bold', color: TEXT_DARK }
});
// screens/CalendarScreen.js
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image, DeviceEventEmitter } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons'; 
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import ViewShot from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getAllLogsForCalendar, getExercisesForDate, getDailyLogForDate, deleteDailyLog, getSettings } from '../dbQueries';

LocaleConfig.locales['kr'] = {
  monthNames: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  monthNamesShort: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  dayNames: ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'],
  dayNamesShort: ['일','월','화','수','목','금','토'],
  today: '오늘'
};
LocaleConfig.defaultLocale = 'kr';

export default function CalendarScreen() {
  const insets = useSafeAreaInsets(); 

  const [logStatusMap, setLogStatusMap] = useState({});
  const [selectedDate, setSelectedDate] = useState('');
  const [exercises, setExercises] = useState([]);
  const [memo, setMemo] = useState('');
  const [isRestDay, setIsRestDay] = useState(false); 
  const [isDarkMode, setIsDarkMode] = useState(false); 

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', onConfirm: null });
  const [isProofModalVisible, setIsProofModalVisible] = useState(false);
  const [proofImageUri, setProofImageUri] = useState(null);
  const [proofImageAspect, setProofImageAspect] = useState(1); 
  const viewShotRef = useRef(); 

  const showAlert = (title, message, type = 'info', onConfirm = null) => { setAlertConfig({ visible: true, title, message, type, onConfirm }); };
  const closeAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('themeChanged', (mode) => {
      setIsDarkMode(mode);
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        const settings = await getSettings();
        setIsDarkMode(settings.is_dark_mode === 1);

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const currentTarget = selectedDate || todayStr;
        
        if (!selectedDate) setSelectedDate(currentTarget);
        const allLogs = await getAllLogsForCalendar();
        setLogStatusMap(allLogs);
        await fetchDailyData(currentTarget);
      };
      refreshData();
    }, [selectedDate]) 
  );

  const fetchDailyData = async (dateStr) => {
    const exData = await getExercisesForDate(dateStr);
    setExercises(exData);
    const logData = await getDailyLogForDate(dateStr);
    if (logData) { setMemo(logData.memo); setIsRestDay(logData.status === 'REST'); } 
    else { setMemo(''); setIsRestDay(false); }
  };

  const onDayPress = (date) => {
    setSelectedDate(date.dateString);
    fetchDailyData(date.dateString);
  };

  const handleDeleteRecord = () => {
    showAlert('기록 삭제', `${selectedDate}의 운동 기록과 메모를 영구 삭제하시겠습니까?`, 'confirm', async () => {
      try {
        await deleteDailyLog(selectedDate);
        setExercises([]); setMemo(''); setIsRestDay(false);
        showAlert('삭제 완료', '해당 날짜의 기록이 지워졌습니다.', 'info');
        const allLogs = await getAllLogsForCalendar();
        setLogStatusMap(allLogs);
      } catch (error) { showAlert('오류', '삭제에 실패했습니다.', 'info'); }
    });
  };

  const handleExportCSV = async () => {
    if (exercises.length === 0 && !isRestDay && !memo) return showAlert('안내', '내보낼 기록이 없습니다.', 'info');
    try {
      let csvString = '날짜,운동이름,종류,무게(kg),반복(회),세트,시간(분),속도,거리(km),메모\n';
      if (isRestDay) { csvString += `${selectedDate},휴식일,,,,,,,,${memo}\n`; } 
      else {
        exercises.forEach((ex, index) => {
          const currentMemo = index === 0 ? memo : ''; 
          csvString += `${selectedDate},${ex.name},${ex.type},${ex.actual_weight || ''},${ex.actual_reps || ''},${ex.actual_sets || ''},${ex.actual_time || ''},${ex.actual_speed || ''},${ex.actual_distance || ''},${currentMemo || ''}\n`; 
        });
      }
      const filePath = `${FileSystem.cacheDirectory}Workout_Record_${selectedDate}.csv`;
      await FileSystem.writeAsStringAsync(filePath, '\uFEFF' + csvString, { encoding: 'utf8' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(filePath, { dialogTitle: '운동 기록 엑셀 내보내기' });
      else showAlert('안내', '이 기기에서는 공유 기능을 지원하지 않습니다.', 'info');
    } catch (error) { showAlert('오류', '엑셀 변환 중 문제가 발생했습니다.', 'info'); }
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
    return parts.length > 0 ? parts.join(' · ') : '기록 없음';
  };

  const hasRecord = exercises.length > 0 || memo || isRestDay;
  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

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
    success: isDarkMode ? '#00E5FF' : '#4CAF50', 
  };

  return (
    <View style={[styles.mainWrapper, { backgroundColor: theme.bg, paddingTop: insets.top + 20 }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={[styles.headerSub, {color: theme.textSub}]}>차곡차곡 쌓인 노력들</Text>
          <Text style={[styles.headerTitle, {color: theme.textMain}]}>운동 기록</Text>
        </View>

        <View style={[styles.calendarCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
          <Calendar
            key={isDarkMode ? 'dark' : 'light'}
            theme={{
              backgroundColor: theme.cardBg,
              calendarBackground: theme.cardBg,
              textSectionTitleColor: theme.textSub,
              arrowColor: theme.accentPrimary,
              monthTextColor: theme.textMain,
              textDayFontWeight: 'bold',
              textMonthFontWeight: '900',
              textDayHeaderFontWeight: '600',
              textMonthFontSize: 18,
            }}
            dayComponent={({ date, state }) => {
              const status = logStatusMap[date.dateString];
              const isSelected = selectedDate === date.dateString;
              const isToday = date.dateString === todayStr;

              let cellBg = 'transparent';
              let cellText = theme.textMain;
              let cellBorder = 'transparent';
              let bWidth = 0;

              // 🌟 수정: 휴식(REST) 처리 로직 삭제. 오직 COMPLETED(운동완료)일 때만 배경색을 채웁니다.
              if (status === 'COMPLETED') {
                cellBg = theme.accentPrimary; 
                cellText = isDarkMode ? '#111317' : '#FFFFFF';
              }

              if (isToday) {
                if (status !== 'COMPLETED') cellText = theme.accentPrimary;
                if (!isSelected) {
                  cellBorder = theme.accentPrimary;
                  bWidth = 1;
                }
              }

              if (isSelected) {
                if (status !== 'COMPLETED') {
                  cellBg = theme.inputBg; 
                }
                cellBorder = theme.textMain; 
                bWidth = 2;
              }

              if (state === 'disabled') {
                cellText = isDarkMode ? '#333A45' : '#d9e1e8';
                cellBg = 'transparent';
                cellBorder = 'transparent';
                bWidth = 0;
              }

              return (
                <TouchableOpacity 
                  style={[
                    styles.dayCell, 
                    { 
                      backgroundColor: cellBg, 
                      borderColor: cellBorder, 
                      borderWidth: bWidth,
                      borderRadius: isDarkMode ? 8 : 20 
                    }
                  ]} 
                  onPress={() => onDayPress(date)} 
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayCellText, { color: cellText }]}>
                    {date.day}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
        
        <View style={styles.dateHeaderRow}>
          <View>
            <Text style={[styles.dateTitle, {color: theme.textMain}]}>{selectedDate} 기록</Text>
            {hasRecord && <Text style={[styles.dateSubTitle, {color: theme.textSub}]}>총 {exercises.length}개 운동 완료</Text>}
          </View>
          {hasRecord && (
            <View style={{flexDirection: 'row'}}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#1A2933' : '#E8F5E9', marginRight: 8, borderRadius: theme.radius }]} onPress={handleExportCSV}>
                <Ionicons name="document-text" size={14} color={isDarkMode ? '#00E5FF' : '#2E7D32'} style={{marginRight: 4}} />
                <Text style={[styles.actionBtnText, { color: isDarkMode ? '#00E5FF' : '#2E7D32' }]}>엑셀 내보내기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#331D1D' : '#FFEBEE', borderRadius: theme.radius }]} onPress={handleDeleteRecord}>
                <Text style={[styles.actionBtnText, { color: theme.accentSecondary }]}>삭제</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {exercises.length === 0 ? (
          <View style={[styles.emptyCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
            {/* 🌟 수정: 휴식일 전용 안내 문구를 삭제하고 아무것도 안 한 날과 똑같이 렌더링되게 변경 */}
            <Text style={[styles.emptyText, {color: theme.textSub}]}>해당 날짜의 기록이 없습니다.</Text>
          </View>
        ) : (
          exercises.map((exercise, index) => (
            <View key={index} style={[styles.exerciseCard, {backgroundColor: theme.cardBg, borderRadius: theme.radius, borderColor: theme.borderColor}]}>
              <View style={styles.exerciseNameWrapper}>
                <Text style={[styles.exerciseName, {color: theme.textMain}]}>{exercise.name}</Text>
                <Text style={[styles.exerciseType, {color: theme.textSub}]}>{exercise.type === 'WEIGHT' ? '웨이트 트레이닝' : '유산소 운동'}</Text>
              </View>
              <View style={[styles.exerciseDetailBadge, {backgroundColor: theme.inputBg, borderColor: isDarkMode ? '#2A2F3A' : '#F0F0F0', borderRadius: theme.radius}]}>
                <Text style={[styles.exerciseDetailText, {color: theme.textMain}]}>{formatExerciseDetail(exercise)}</Text>
              </View>
            </View>
          ))
        )}

        {memo ? (
          <View style={[styles.memoCard, {backgroundColor: isDarkMode ? '#1E2521' : '#FFFDF9', borderColor: isDarkMode ? '#2D3A30' : '#FFF3E0', borderRadius: theme.radius}]}>
            <Text style={[styles.memoTitle, {color: theme.accentSecondary}]}>메모</Text>
            <Text style={[styles.memoContent, {color: theme.textMain}]}>{memo}</Text>
          </View>
        ) : null}

        {hasRecord && !isRestDay && (
          <TouchableOpacity style={[styles.proofCreateBtn, {backgroundColor: theme.inputBg, borderRadius: theme.radius}]} onPress={() => setIsProofModalVisible(true)}>
            <Ionicons name="camera" size={20} color={theme.textMain} style={{marginRight: 8}} />
            <Text style={[styles.proofCreateBtnText, {color: theme.textMain}]}>인증샷 만들기</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 팝업 모달 */}
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
                  <Text style={styles.proofDateText}>{selectedDate.replace(/-/g, '.')}</Text>
                  <Text style={styles.proofLogoText}>나만의 운동 기록</Text>
                </View>
                <View style={styles.proofExerciseList}>
                  {exercises.slice(0, 7).map((ex, idx) => (
                    <View key={idx} style={styles.proofExerciseItem}>
                      <Text style={styles.proofExName}>{ex.name}</Text>
                      <Text style={styles.proofExDetail}>{formatExerciseDetail(ex)}</Text>
                    </View>
                  ))}
                  {exercises.length > 7 && (
                    <Text style={[styles.proofExMoreText, {color: theme.accentPrimary}]}>...외 {exercises.length - 7}개 운동 완료</Text>
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
  header: { marginBottom: 20, paddingHorizontal: 4 },
  headerSub: { fontSize: 14, marginBottom: 4, fontWeight: '500' },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },

  calendarCard: { padding: 10, paddingBottom: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1, borderWidth: 1 },
  
  dayCell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dayCellText: { fontSize: 16, fontWeight: 'bold' },
  
  dateHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, paddingHorizontal: 4 },
  dateTitle: { fontSize: 18, fontWeight: 'bold' },
  dateSubTitle: { fontSize: 13, marginTop: 4 },
  
  actionBtn: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: 'bold' },
  
  exerciseCard: { padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1, borderWidth: 1 },
  exerciseNameWrapper: { flex: 1, paddingRight: 10 },
  exerciseName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  exerciseType: { fontSize: 12 },
  exerciseDetailBadge: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  exerciseDetailText: { fontSize: 13, fontWeight: 'bold' },
  
  emptyCard: { padding: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  
  memoCard: { padding: 16, marginTop: 8, marginBottom: 16, borderWidth: 1 },
  memoTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  memoContent: { fontSize: 15, lineHeight: 22 },
  
  proofCreateBtn: { flexDirection: 'row', paddingVertical: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  proofCreateBtnText: { fontSize: 16, fontWeight: 'bold' },

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
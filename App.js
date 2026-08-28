// App.js
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, DeviceEventEmitter } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from './screens/HomeScreen';
import CalendarScreen from './screens/CalendarScreen';
import TodayWorkoutScreen from './screens/TodayWorkoutScreen';
import SettingsScreen from './screens/SettingsScreen';
import OnboardingScreen from './screens/OnboardingScreen'; 

import { initDB, getSettings } from './dbQueries';

// 스플래시 화면이 임의로 사라지지 않도록 방지
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {}

const GEOFENCING_TASK = 'GYM_GEOFENCING_TASK';
const navigationRef = createNavigationContainerRef();

TaskManager.defineTask(GEOFENCING_TASK, async ({ data: { eventType, region }, error }) => {
  if (error) return;
});

const Tab = createBottomTabNavigator();

function RootNavigator({ isDarkMode }) {
  const insets = useSafeAreaInsets();

  const ACCENT_COLOR = isDarkMode ? '#00E5FF' : '#FF4D6D'; 
  const TAB_BG_COLOR = isDarkMode ? '#1A1D24' : '#FFFFFF';
  const INACTIVE_COLOR = isDarkMode ? '#555555' : '#A0A0A0';
  const TAB_RADIUS = isDarkMode ? 6 : 24; 

  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color }) => {
            let iconName;
            if (route.name === '홈') iconName = focused ? 'home' : 'home-outline';
            else if (route.name === '운동') iconName = focused ? 'barbell' : 'barbell-outline';
            else if (route.name === '기록') iconName = focused ? 'calendar' : 'calendar-outline';
            else if (route.name === '설정') iconName = focused ? 'settings' : 'settings-outline';
            
            return <Ionicons name={iconName} size={focused ? 26 : 24} color={color} />;
          },
          tabBarActiveTintColor: ACCENT_COLOR,
          tabBarInactiveTintColor: INACTIVE_COLOR,
          headerShown: false,
          tabBarStyle: {
            paddingBottom: Math.max(insets.bottom, 10),
            paddingTop: 10,
            height: 65 + Math.max(insets.bottom, 0),
            backgroundColor: TAB_BG_COLOR,
            borderTopWidth: 0, 
            elevation: 15, 
            shadowColor: '#000', 
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: isDarkMode ? 0.3 : 0.05,
            shadowRadius: 10,
            borderTopLeftRadius: TAB_RADIUS, 
            borderTopRightRadius: TAB_RADIUS,
            position: 'absolute', 
          },
          tabBarLabelStyle: { 
            fontSize: 11, 
            fontWeight: 'bold',
            marginTop: 4,
          }
        })}
      >
        <Tab.Screen name="홈" component={HomeScreen} />
        <Tab.Screen name="운동" component={TodayWorkoutScreen} />
        <Tab.Screen name="기록" component={CalendarScreen} />
        <Tab.Screen name="설정" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false); 
  const [errorMessage, setErrorMessage] = useState(null); // 🌟 에러 발생 시 화면에 띄우기 위한 상태

  useEffect(() => {
    const setup = async () => {
      try { 
        // 1. 데이터베이스 초기화 안전 실행
        await initDB(); 
        
        // 2. 온보딩 완료 여부 확인
        const hasOnboarded = await AsyncStorage.getItem('@onboarding_complete');
        if (hasOnboarded === 'true') setShowOnboarding(false);
        
        // 3. 설정 불러오기
        const settings = await getSettings();
        if (settings && settings.is_dark_mode === 1) {
          setIsDarkMode(true);
        }

        setIsDbReady(true); 
      } 
      catch (e) { 
        console.error("App Initialization Error:", e);
        setErrorMessage(e.toString()); // 🌟 에러 내용을 화면에 기록
      } 
      finally { 
        try {
          await SplashScreen.hideAsync();
        } catch (e) {}
      }
    };
    setup();

    const subscription = DeviceEventEmitter.addListener('themeChanged', (mode) => {
      setIsDarkMode(mode);
    });

    return () => subscription.remove(); 
  }, []);

  const finishOnboarding = async () => {
    await AsyncStorage.setItem('@onboarding_complete', 'true');
    setShowOnboarding(false);
  };

  // 🌟 만약 초기화 중 에러가 발생했다면, 튕기지 않고 에러 내용을 화면에 빨간 글씨로 띄워줍니다!
  if (errorMessage) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>앗, 앱 실행 중 오류가 발생했어요!</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{fontSize: 16, fontWeight: 'bold', color: '#555'}}>데이터를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{flex: 1, backgroundColor: isDarkMode ? '#111317' : '#F7F4F2'}}> 
        {showOnboarding ? (
          <OnboardingScreen onFinish={finishOnboarding} />
        ) : (
          <RootNavigator isDarkMode={isDarkMode} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F4F2' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF0F0', padding: 20 },
  errorTitle: { fontSize: 18, fontWeight: 'bold', color: '#D32F2F', marginBottom: 12, textAlign: 'center' },
  errorText: { fontSize: 14, color: '#333', textAlign: 'center', lineHeight: 20 }
});
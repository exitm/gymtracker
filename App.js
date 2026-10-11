// App.js
import React, { useEffect, useState } from 'react';
import { Platform, View, ActivityIndicator, Text, DeviceEventEmitter } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import './utils/gymGeofencingTask';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';

import HomeScreen from './screens/HomeScreen';
import TodayWorkoutScreen from './screens/TodayWorkoutScreen';
import CalendarScreen from './screens/CalendarScreen';
import SettingsScreen from './screens/SettingsScreen';
import OnboardingScreen from './screens/OnboardingScreen'; 

import { initDB, getSettings } from './dbQueries'; 

const Tab = createMaterialTopTabNavigator();

function MainTabs({ isDarkMode }) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      tabBarPosition="bottom" 
      screenOptions={({ route }) => ({
        // 🌟 1번 해결책: 사용자가 탭을 누를 때만 화면을 메모리에 올립니다 (튕김 현상 완벽 방지)
        lazy: true, 
        swipeEnabled: true, 
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === '홈') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === '운동') iconName = focused ? 'barbell' : 'barbell-outline';
          else if (route.name === '기록') iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === '설정') iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={24} color={color} />; 
        },
        tabBarActiveTintColor: '#00D1FF',
        tabBarInactiveTintColor: '#888888',
        tabBarLabelStyle: { fontSize: 11, fontWeight: 'bold', marginTop: -4 },
        tabBarIndicatorStyle: { height: 0 }, 
        tabBarStyle: {
          backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: isDarkMode ? '#2A2F3A' : '#EEEEEE',
          paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 10) : Math.max(insets.bottom, 20), 
          height: 65 + insets.bottom,
        },
        tabBarIconStyle: { justifyContent: 'center', alignItems: 'center' },
      })}
    >
      <Tab.Screen name="홈" component={HomeScreen} />
      <Tab.Screen name="운동" component={TodayWorkoutScreen} />
      <Tab.Screen name="기록" component={CalendarScreen} />
      <Tab.Screen name="설정" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState(null); 

  useEffect(() => {
    const setupApp = async () => {
      try {
        await initDB(); 
        const settings = await getSettings();
        const initialDarkMode = settings.is_dark_mode === 1;
        setIsDarkMode(initialDarkMode);
        
        const onboardedStatus = await AsyncStorage.getItem('hasOnboarded');
        if (onboardedStatus === 'true') {
          setIsFirstLaunch(false); 
        } else {
          setIsFirstLaunch(true);  
        }
        
        if (Platform.OS === 'android') {
          try {
            if (NavigationBar && typeof NavigationBar.setBackgroundColorAsync === 'function') {
              await NavigationBar.setBackgroundColorAsync(initialDarkMode ? '#1E1E1E' : '#FFFFFF');
              await NavigationBar.setButtonStyleAsync(initialDarkMode ? 'light' : 'dark');
            }
          } catch (navError) {}
        }
        setIsDbReady(true); 
      } catch (error) {
        console.error("앱 초기화 실패:", error);
      }
    };
    setupApp();

    const themeListener = DeviceEventEmitter.addListener('themeChanged', async (darkModeEnabled) => {
      setIsDarkMode(darkModeEnabled);
      if (Platform.OS === 'android') {
        try {
          if (NavigationBar && typeof NavigationBar.setBackgroundColorAsync === 'function') {
            await NavigationBar.setBackgroundColorAsync(darkModeEnabled ? '#1E1E1E' : '#FFFFFF');
            await NavigationBar.setButtonStyleAsync(darkModeEnabled ? 'light' : 'dark');
          }
        } catch (navError) {}
      }
    });

    return () => themeListener.remove();
  }, []);

  if (!isDbReady || isFirstLaunch === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#121212' : '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#00D1FF" />
        <Text style={{ color: isDarkMode ? '#ffffff' : '#333333', marginTop: 10 }}>데이터베이스 준비 중...</Text>
      </View>
    );
  }

  if (isFirstLaunch) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <OnboardingScreen onFinish={() => setIsFirstLaunch(false)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} backgroundColor={isDarkMode ? '#111317' : '#F7F4F2'} />
      <NavigationContainer>
        <MainTabs isDarkMode={isDarkMode} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
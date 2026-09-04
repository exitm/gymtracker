import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './screens/HomeScreen';
import CalendarScreen from './screens/CalendarScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;
              if (route.name === '홈' || route.name === '운동') {
                iconName = focused ? 'barbell' : 'barbell-outline';
              } else if (route.name === '기록') {
                iconName = focused ? 'calendar' : 'calendar-outline';
              } else if (route.name === '설정') {
                iconName = focused ? 'settings' : 'settings-outline';
              }
              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#00D1FF', // 활성화된 탭 색상
            tabBarInactiveTintColor: '#888888', // 비활성화된 탭 색상
            tabBarStyle: {
              backgroundColor: '#1E1E1E', // 하단 바 배경색 (다크 모드)
              borderTopWidth: 0,
              // [수정 완료] 플랫폼에 따른 하단 여백 및 높이 조절
              paddingBottom: Platform.OS === 'android' ? 10 : 25, 
              height: Platform.OS === 'android' ? 65 : 85,
            },
          })}
        >
          <Tab.Screen name="운동" component={HomeScreen} />
          <Tab.Screen name="기록" component={CalendarScreen} />
          <Tab.Screen name="설정" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
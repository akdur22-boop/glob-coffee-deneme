import { Tabs, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider } from '../../context/AppContext';

export default function TabLayout() {
  // Handle auth callback session_id on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const hash = window.location.hash;
      if (hash && hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1];
        if (sessionId) {
          exchangeSession(sessionId);
        }
      }
    }
  }, []);

  const exchangeSession = async (sessionId: string) => {
    const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
    try {
      const res = await fetch(`${API_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        await AsyncStorage.setItem('session_token', data.session_token);
        if (Platform.OS === 'web') {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    } catch (e) {
      console.log('Tab auth error', e);
    }
  };

  return (
    <AppProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#E67E22',
          tabBarInactiveTintColor: '#8A8A8A',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E5E0DB',
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 88 : 64,
            paddingBottom: Platform.OS === 'ios' ? 28 : 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.3,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: 'Menu',
            tabBarIcon: ({ color, size }) => <Feather name="coffee" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            title: 'Rewards',
            tabBarIcon: ({ color, size }) => <Feather name="gift" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stores"
          options={{
            title: 'Stores',
            tabBarIcon: ({ color, size }) => <Feather name="map-pin" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
          }}
        />
      </Tabs>
    </AppProvider>
  );
}

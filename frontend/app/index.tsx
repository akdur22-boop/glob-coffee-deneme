import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width, height } = Dimensions.get('window');

// Safe window access helpers - prevent crashes on native
const getWindowLocation = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location;
  }
  return null;
};

export default function WelcomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (token) {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          router.replace('/(tabs)');
          return;
        }
        await AsyncStorage.removeItem('session_token');
      }
    } catch (e) {
      console.log('Session check error', e);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const loc = getWindowLocation();
    if (Platform.OS === 'web' && loc) {
      setAuthLoading(true);
      const redirectUrl = loc.origin + '/(tabs)';
      loc.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } else {
      // Native: open auth in browser
      try {
        setAuthLoading(true);
        const redirectUrl = `${API_URL}/(tabs)`;
        await WebBrowser.openBrowserAsync(
          `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`
        );
      } catch (e) {
        console.log('Native auth error', e);
      } finally {
        setAuthLoading(false);
      }
    }
  };

  // Handle session_id from URL hash (web only)
  useEffect(() => {
    const loc = getWindowLocation();
    if (loc) {
      const hash = loc.hash;
      if (hash && hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1];
        if (sessionId) {
          exchangeSession(sessionId);
        }
      }
    }
  }, []);

  const exchangeSession = async (sessionId: string) => {
    setAuthLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        await AsyncStorage.setItem('session_token', data.session_token);
        const loc = getWindowLocation();
        if (loc) {
          window.history.replaceState(null, '', loc.pathname);
        }
        router.replace('/(tabs)');
      }
    } catch (e) {
      console.log('Auth exchange error', e);
    }
    setAuthLoading(false);
  };

  if (loading || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
        <Text style={styles.loadingText}>{authLoading ? 'Signing you in...' : 'Loading...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800' }}
        style={styles.bgImage}
      />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.content}>
        <View style={styles.topSection}>
          <View style={styles.badge}>
            <Feather name="coffee" size={14} color="#E67E22" />
            <Text style={styles.badgeText}>EST. 2024</Text>
          </View>
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.brand}>KINETIC</Text>
          <Text style={styles.brandSub}>ROAST</Text>
          <Text style={styles.tagline}>Artisan coffee, crafted with intention.</Text>

          <TouchableOpacity
            testID="google-login-btn"
            style={styles.googleButton}
            activeOpacity={0.8}
            onPress={handleGoogleLogin}
          >
            <View style={styles.googleIconWrap}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="guest-browse-btn"
            style={styles.guestButton}
            activeOpacity={0.8}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.guestButtonText}>Browse as Guest</Text>
          </TouchableOpacity>

          <Text style={styles.terms}>By continuing, you agree to our Terms & Privacy Policy</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#231F20' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#231F20' },
  loadingText: { marginTop: 16, color: '#F9F5F1', fontSize: 16 },
  bgImage: { position: 'absolute', width: width, height: height },
  overlay: { position: 'absolute', width: width, height: height, backgroundColor: 'rgba(35,31,32,0.65)' },
  content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 32 },
  topSection: { marginTop: 24, alignItems: 'flex-start' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#E67E22', fontSize: 12, fontWeight: '600', marginLeft: 6, letterSpacing: 2 },
  bottomSection: { marginBottom: 48 },
  brand: { fontSize: 56, fontWeight: '900', color: '#F9F5F1', letterSpacing: 8, lineHeight: 60 },
  brandSub: { fontSize: 56, fontWeight: '300', color: '#E67E22', letterSpacing: 12, lineHeight: 60, marginBottom: 12 },
  tagline: { fontSize: 16, color: 'rgba(249,245,241,0.7)', marginBottom: 40, letterSpacing: 0.5 },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9F5F1', paddingVertical: 16, borderRadius: 9999,
    marginBottom: 12,
  },
  googleIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#4285F4', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  googleIcon: { color: '#fff', fontWeight: '700', fontSize: 14 },
  googleButtonText: { fontSize: 16, fontWeight: '600', color: '#231F20' },
  guestButton: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 9999,
    borderWidth: 1.5, borderColor: 'rgba(249,245,241,0.3)',
    marginBottom: 24,
  },
  guestButtonText: { fontSize: 16, fontWeight: '600', color: '#F9F5F1' },
  terms: { textAlign: 'center', fontSize: 12, color: 'rgba(249,245,241,0.4)' },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width, height } = Dimensions.get('window');

const getWindowLocation = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location;
  return null;
};

export default function WelcomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => { checkSession(); }, []);
  const checkSession = async () => {
    try {
      const t = await AsyncStorage.getItem('session_token');
      if (t) { const r = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } }); if (r.ok) { router.replace('/(tabs)'); return; } await AsyncStorage.removeItem('session_token'); }
    } catch {} setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const loc = getWindowLocation();
    if (Platform.OS === 'web' && loc) { setAuthLoading(true); loc.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(loc.origin + '/(tabs)')}`; }
  };

  useEffect(() => {
    const loc = getWindowLocation();
    if (loc?.hash?.includes('session_id=')) { exchangeSession(loc.hash.split('session_id=')[1]); }
  }, []);

  const exchangeSession = async (sid: string) => {
    setAuthLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/auth/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sid }) });
      if (r.ok) { const d = await r.json(); await AsyncStorage.setItem('session_token', d.session_token); const loc = getWindowLocation(); if (loc) window.history.replaceState(null, '', loc.pathname); router.replace('/(tabs)'); }
    } catch {} setAuthLoading(false);
  };

  if (loading || authLoading) return <View style={s.loadWrap}><ActivityIndicator size="large" color="#800020" /><Text style={s.loadText}>{authLoading ? 'Giriş yapılıyor...' : 'Yükleniyor...'}</Text></View>;

  return (
    <View style={s.container}>
      <Image source={{ uri: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800' }} style={s.bgImage} resizeMode="cover" />
      <View style={s.overlay} />
      <SafeAreaView style={s.content}>
        <View style={s.topSection}><View style={s.badge}><Feather name="coffee" size={14} color="#800020" /><Text style={s.badgeText}>GLOB COFFEE</Text></View></View>
        <View style={s.bottomSection}>
          <Text style={s.brand}>GLOB</Text>
          <Text style={s.brandSub}>COFFEE</Text>
          <Text style={s.tagline}>Her yudumda yeni bir dünya keşfet.</Text>
          <TouchableOpacity testID="google-login-btn" style={s.googleButton} activeOpacity={0.8} onPress={handleGoogleLogin}>
            <View style={s.googleIconWrap}><Text style={s.googleIcon}>G</Text></View>
            <Text style={s.googleButtonText}>Google ile Devam Et</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="email-login-btn" style={s.emailButton} activeOpacity={0.8} onPress={() => router.push('/auth')}>
            <Feather name="mail" size={18} color="#F9F5F1" />
            <Text style={s.emailButtonText}>Email ile Giriş Yap / Kayıt Ol</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="guest-browse-btn" style={s.guestButton} activeOpacity={0.8} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.guestButtonText}>Misafir Olarak Göz At</Text>
          </TouchableOpacity>
          <Text style={s.terms}>Devam ederek Kullanım Şartlarını kabul edersiniz</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#231F20' },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#231F20' },
  loadText: { marginTop: 16, color: '#F9F5F1', fontSize: 16 },
  bgImage: { position: 'absolute', width, height },
  overlay: { position: 'absolute', width, height, backgroundColor: 'rgba(35,31,32,0.65)' },
  content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 32 },
  topSection: { marginTop: 24, alignItems: 'flex-start' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#800020', fontSize: 12, fontWeight: '600', marginLeft: 6, letterSpacing: 2 },
  bottomSection: { marginBottom: 48 },
  brand: { fontSize: 56, fontWeight: '900', color: '#F9F5F1', letterSpacing: 8, lineHeight: 60 },
  brandSub: { fontSize: 56, fontWeight: '300', color: '#800020', letterSpacing: 12, lineHeight: 60, marginBottom: 12 },
  tagline: { fontSize: 16, color: 'rgba(249,245,241,0.7)', marginBottom: 40, letterSpacing: 0.5 },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F5F1', paddingVertical: 16, borderRadius: 9999, marginBottom: 12 },
  googleIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#4285F4', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  googleIcon: { color: '#fff', fontWeight: '700', fontSize: 14 },
  googleButtonText: { fontSize: 16, fontWeight: '600', color: '#231F20' },
  emailButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#800020', paddingVertical: 16, borderRadius: 9999, marginBottom: 12, gap: 10 },
  emailButtonText: { fontSize: 16, fontWeight: '600', color: '#F9F5F1' },
  guestButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 9999, borderWidth: 1.5, borderColor: 'rgba(249,245,241,0.3)', marginBottom: 24 },
  guestButtonText: { fontSize: 16, fontWeight: '600', color: '#F9F5F1' },
  terms: { textAlign: 'center', fontSize: 12, color: 'rgba(249,245,241,0.4)' },
  adminLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  adminLinkText: { color: 'rgba(249,245,241,0.4)', fontSize: 12, marginLeft: 6, fontWeight: '500' },
});

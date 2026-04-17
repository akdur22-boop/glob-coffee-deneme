import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const { setUser, setSessionToken } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Hata', 'Email ve şifre gerekli');
      return;
    }
    if (mode === 'register') {
      if (!name.trim()) { Alert.alert('Hata', 'Ad soyad gerekli'); return; }
      if (password.length < 6) { Alert.alert('Hata', 'Şifre en az 6 karakter olmalı'); return; }
      if (password !== confirmPassword) { Alert.alert('Hata', 'Şifreler eşleşmiyor'); return; }
    }

    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { email: email.trim().toLowerCase(), password }
        : { name: name.trim(), email: email.trim().toLowerCase(), password };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        // Admin girişi mi kontrol et
        if (data.role === 'admin' && data.token) {
          await AsyncStorage.setItem('admin_token', data.token);
          router.replace('/admin/dashboard');
        } else {
          // Normal kullanıcı girişi
          const token = data.session_token;
          await AsyncStorage.setItem('session_token', token);
          setSessionToken(token);
          setUser(data.user);
          router.replace('/(tabs)');
        }
      } else {
        if (Platform.OS === 'web') { window.alert(data.detail || 'Bir hata oluştu'); }
        else { Alert.alert('Hata', data.detail || 'Bir hata oluştu'); }
      }
    } catch (e) {
      if (Platform.OS === 'web') { window.alert('Bağlantı hatası. Lütfen tekrar deneyin.'); }
      else { Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.'); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800' }}
        style={s.bgImage}
        resizeMode="cover"
      />
      <View style={s.overlay} />

      <SafeAreaView style={s.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.flex}
        >
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {/* Back button */}
            <TouchableOpacity testID="auth-back-btn" style={s.backBtn} onPress={() => router.back()}>
              <Feather name="arrow-left" size={24} color="#FFF" />
            </TouchableOpacity>

            {/* Logo */}
            <View style={s.logoSection}>
              <View style={s.logoBadge}>
                <Feather name="coffee" size={18} color="#800020" />
                <Text style={s.logoBadgeText}>GLOB COFFEE</Text>
              </View>
            </View>

            {/* Form Card */}
            <View style={s.formCard}>
              {/* Tab Switcher */}
              <View style={s.tabRow}>
                <TouchableOpacity
                  testID="login-tab"
                  style={[s.tab, mode === 'login' && s.tabActive]}
                  onPress={() => setMode('login')}
                >
                  <Text style={[s.tabText, mode === 'login' && s.tabTextActive]}>Giriş Yap</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="register-tab"
                  style={[s.tab, mode === 'register' && s.tabActive]}
                  onPress={() => setMode('register')}
                >
                  <Text style={[s.tabText, mode === 'register' && s.tabTextActive]}>Kayıt Ol</Text>
                </TouchableOpacity>
              </View>

              {/* Name field (register only) */}
              {mode === 'register' && (
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>Ad Soyad</Text>
                  <View style={s.inputWrap}>
                    <Feather name="user" size={18} color="#8A8A8A" style={s.inputIcon} />
                    <TextInput
                      testID="auth-name-input"
                      style={s.input}
                      placeholder="Ahmet Yılmaz"
                      placeholderTextColor="#B0B0B0"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              )}

              {/* Email */}
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>Email</Text>
                <View style={s.inputWrap}>
                  <Feather name="mail" size={18} color="#8A8A8A" style={s.inputIcon} />
                  <TextInput
                    testID="auth-email-input"
                    style={s.input}
                    placeholder="ornek@email.com"
                    placeholderTextColor="#B0B0B0"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>Şifre</Text>
                <View style={s.inputWrap}>
                  <Feather name="lock" size={18} color="#8A8A8A" style={s.inputIcon} />
                  <TextInput
                    testID="auth-password-input"
                    style={s.input}
                    placeholder={mode === 'register' ? 'En az 6 karakter' : 'Şifrenizi girin'}
                    placeholderTextColor="#B0B0B0"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#8A8A8A" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password (register only) */}
              {mode === 'register' && (
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>Şifre Tekrar</Text>
                  <View style={s.inputWrap}>
                    <Feather name="lock" size={18} color="#8A8A8A" style={s.inputIcon} />
                    <TextInput
                      testID="auth-confirm-password-input"
                      style={s.input}
                      placeholder="Şifrenizi tekrar girin"
                      placeholderTextColor="#B0B0B0"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                    />
                  </View>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                testID="auth-submit-btn"
                style={s.submitBtn}
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={s.submitBtnText}>
                    {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Switch mode */}
              <TouchableOpacity
                testID="auth-switch-mode"
                style={s.switchBtn}
                onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
              >
                <Text style={s.switchText}>
                  {mode === 'login' ? 'Hesabınız yok mu? ' : 'Zaten hesabınız var mı? '}
                  <Text style={s.switchLink}>
                    {mode === 'login' ? 'Kayıt Ol' : 'Giriş Yap'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>

            {/* Guest link */}
            <TouchableOpacity
              testID="auth-guest-btn"
              style={s.guestBtn}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={s.guestText}>Misafir olarak devam et</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#231F20' },
  bgImage: { position: 'absolute', width: '100%', height: '100%' },
  overlay: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(35,31,32,0.75)' },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 8, marginBottom: 16,
  },

  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  logoBadgeText: { color: '#800020', fontSize: 16, fontWeight: '700', marginLeft: 8, letterSpacing: 2 },

  formCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 24,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.2,
    shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
  },

  tabRow: {
    flexDirection: 'row', backgroundColor: '#F5F0EB',
    borderRadius: 14, padding: 4, marginBottom: 24,
  },
  tab: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  tabActive: { backgroundColor: '#800020' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#8A8A8A' },
  tabTextActive: { color: '#FFF' },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#5C5C5C', marginBottom: 6, marginLeft: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F0EB', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E0DB',
  },
  inputIcon: { marginLeft: 14 },
  input: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 14,
    fontSize: 15, color: '#231F20',
  },
  eyeBtn: { paddingHorizontal: 14 },

  submitBtn: {
    backgroundColor: '#800020', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  switchBtn: { alignItems: 'center', marginTop: 20 },
  switchText: { fontSize: 14, color: '#8A8A8A' },
  switchLink: { color: '#800020', fontWeight: '700' },

  guestBtn: { alignItems: 'center', marginTop: 24, marginBottom: 32 },
  guestText: { fontSize: 14, color: 'rgba(249,245,241,0.6)', fontWeight: '500' },
});

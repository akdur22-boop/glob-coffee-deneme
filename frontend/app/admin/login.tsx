import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Hata', 'Email ve şifre gerekli'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (r.ok) {
        const data = await r.json();
        await AsyncStorage.setItem('admin_token', data.token);
        await AsyncStorage.setItem('admin_data', JSON.stringify(data.admin));
        router.replace('/admin/dashboard');
      } else { const e = await r.json(); Alert.alert('Giriş Başarısız', e.detail || 'Geçersiz giriş bilgileri'); }
    } catch { Alert.alert('Hata', 'Bağlantı hatası'); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.content}>
        <TouchableOpacity testID="admin-back-btn" style={s.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={24} color="#F9F5F1" />
        </TouchableOpacity>
        <View style={s.header}>
          <View style={s.iconWrap}><Feather name="shield" size={32} color="#E67E22" /></View>
          <Text style={s.title}>Admin Paneli</Text>
          <Text style={s.subtitle}>Glob Coffee Yönetim Sistemi</Text>
        </View>
        <View style={s.form}>
          <Text style={s.label}>EMAIL</Text>
          <View style={s.inputWrap}>
            <Feather name="mail" size={18} color="#8A8A8A" />
            <TextInput testID="admin-email-input" style={s.input} placeholder="admin@globcoffee.com" placeholderTextColor="#666" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <Text style={s.label}>ŞİFRE</Text>
          <View style={s.inputWrap}>
            <Feather name="lock" size={18} color="#8A8A8A" />
            <TextInput testID="admin-password-input" style={s.input} placeholder="••••••••" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
            <TouchableOpacity onPress={() => setShowPass(!showPass)}><Feather name={showPass ? 'eye-off' : 'eye'} size={18} color="#8A8A8A" /></TouchableOpacity>
          </View>
          <TouchableOpacity testID="admin-login-btn" style={s.loginBtn} activeOpacity={0.8} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.loginBtnText}>Giriş Yap</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#231F20' }, content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  backBtn: { position: 'absolute', top: 16, left: 24, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(230,126,34,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#F9F5F1', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(249,245,241,0.5)', marginTop: 8 },
  form: {},
  label: { fontSize: 12, fontWeight: '700', color: 'rgba(249,245,241,0.5)', letterSpacing: 1, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  input: { flex: 1, height: 52, color: '#F9F5F1', fontSize: 16, marginLeft: 12 },
  loginBtn: { backgroundColor: '#E67E22', paddingVertical: 18, borderRadius: 9999, alignItems: 'center', marginTop: 8 },
  loginBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) { setLoading(false); return; }
      const r = await fetch(`${API_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { setNotifications(await r.json()); await fetch(`${API_URL}/api/notifications/read-all`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); }
    } catch {} finally { setLoading(false); }
  };

  const getIcon = (t: string) => t.includes('Sipariş') ? 'package' : t.includes('Ödül') || t.includes('Puan') ? 'gift' : 'bell';
  const getColor = (t: string) => t.includes('Sipariş') ? '#1976D2' : t.includes('Ödül') || t.includes('Puan') ? '#27AE60' : '#800020';
  const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return 'Az önce'; if (m < 60) return `${m}dk önce`; const h = Math.floor(m / 60); if (h < 24) return `${h}sa önce`; return `${Math.floor(h / 24)}g önce`; };

  if (loading) return <View style={s.loadingWrap}><ActivityIndicator size="large" color="#800020" /></View>;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity testID="notif-back-btn" onPress={() => router.back()} activeOpacity={0.8}><Feather name="arrow-left" size={24} color="#231F20" /></TouchableOpacity>
        <Text style={s.title}>Bildirimler</Text><View style={{ width: 24 }} />
      </View>
      {!notifications.length ? (
        <View style={s.emptyWrap}><View style={s.emptyIcon}><Feather name="bell-off" size={48} color="#E5E0DB" /></View>
          <Text style={s.emptyTitle}>Bildirim Yok</Text><Text style={s.emptyDesc}>Her şey tamam! Yeni bildirimler burada görünecek.</Text>
        </View>
      ) : (
        <FlatList data={notifications} keyExtractor={(i) => i.notification_id} showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <View style={[s.card, !item.read && s.unread]}>
              <View style={[s.icon, { backgroundColor: getColor(item.title) + '15' }]}><Feather name={getIcon(item.title) as any} size={20} color={getColor(item.title)} /></View>
              <View style={s.content}>
                <View style={s.top}><Text style={s.cardTitle}>{item.title}</Text>{!item.read && <View style={s.dot} />}</View>
                <Text style={s.body}>{item.body}</Text><Text style={s.time}>{timeAgo(item.created_at)}</Text>
              </View>
            </View>
          )} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' }, loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F1' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#231F20' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 48 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F0EAE4', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#231F20', marginBottom: 8 }, emptyDesc: { fontSize: 15, color: '#8A8A8A', textAlign: 'center' },
  listContent: { paddingHorizontal: 24, paddingBottom: 40 },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1 },
  unread: { borderLeftWidth: 3, borderLeftColor: '#800020' },
  icon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  content: { flex: 1 }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#231F20' }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#800020' },
  body: { fontSize: 13, color: '#5C5C5C', lineHeight: 19, marginTop: 4 }, time: { fontSize: 11, color: '#8A8A8A', marginTop: 6 },
});

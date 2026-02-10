import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, sessionToken, logout } = useApp();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (sessionToken) loadOrders(); }, [sessionToken]);
  const loadOrders = async () => { setLoading(true); try { const r = await fetch(`${API_URL}/api/orders`, { headers: { Authorization: `Bearer ${sessionToken}` } }); if (r.ok) setOrders(await r.json()); } catch {} finally { setLoading(false); } };

  const handleLogout = () => Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğinize emin misiniz?', [
    { text: 'İptal', style: 'cancel' },
    { text: 'Çıkış Yap', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
  ]);

  if (!user) return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Text style={styles.title}>Profil</Text></View>
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}><Feather name="user" size={48} color="#E5E0DB" /></View>
        <Text style={styles.emptyTitle}>Giriş Yapılmadı</Text>
        <Text style={styles.emptyDesc}>Profilinizi ve sipariş geçmişinizi görmek için giriş yapın.</Text>
        <TouchableOpacity testID="profile-login-btn" style={styles.loginBtn} activeOpacity={0.8} onPress={() => router.replace('/')}><Text style={styles.loginBtnText}>Giriş Yap</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const statusText: Record<string, string> = { confirmed: 'Onaylandı', preparing: 'Hazırlanıyor', ready: 'Hazır', completed: 'Tamamlandı', cancelled: 'İptal' };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
          <TouchableOpacity testID="logout-btn" onPress={handleLogout} activeOpacity={0.8}><Feather name="log-out" size={22} color="#D32F2F" /></TouchableOpacity>
        </View>
        <View style={styles.userCard}>
          {user.picture ? <Image source={{ uri: user.picture }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={styles.avatarLetter}>{user.name?.[0] || 'K'}</Text></View>}
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statValue}>{user.points}</Text><Text style={styles.statLabel}>Puan</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={styles.statValue}>{user.tier}</Text><Text style={styles.statLabel}>Seviye</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={styles.statValue}>{orders.length}</Text><Text style={styles.statLabel}>Sipariş</Text></View>
          </View>
        </View>
        <View style={styles.linksSection}>
          {[
            { icon: 'bell', label: 'Bildirimler', onPress: () => router.push('/notifications') },
            { icon: 'gift', label: 'Ödüller', onPress: () => router.push('/(tabs)/rewards') },
            { icon: 'map-pin', label: 'Şube Bul', onPress: () => router.push('/(tabs)/stores') },
            { icon: 'qr-code' as any, label: 'QR Kodum', onPress: () => Alert.alert('QR Kodunuz', `Kullanıcı ID: ${user.user_id}\n\nBu kodu şubede göstererek puan kazanabilirsiniz.`) },
          ].map((link, i) => (
            <TouchableOpacity key={i} testID={`profile-link-${i}`} style={styles.linkRow} activeOpacity={0.8} onPress={link.onPress}>
              <View style={styles.linkLeft}><View style={styles.linkIcon}><Feather name={link.icon === 'qr-code' ? 'maximize' : link.icon} size={18} color="#E67E22" /></View><Text style={styles.linkLabel}>{link.label}</Text></View>
              <Feather name="chevron-right" size={18} color="#8A8A8A" />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.ordersSection}>
          <Text style={styles.sectionTitle}>Son Siparişler</Text>
          {loading ? <ActivityIndicator color="#E67E22" /> : orders.length === 0 ? <Text style={styles.noOrders}>Henüz sipariş yok. Kahve zamanı!</Text> :
            orders.slice(0, 5).map((order) => (
              <View key={order.order_id} style={styles.orderCard}>
                <View style={styles.orderTop}><View><Text style={styles.orderStore}>{order.store_name}</Text><Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString('tr-TR')}</Text></View>
                  <View style={styles.orderStatus}><Text style={styles.orderStatusText}>{statusText[order.status] || order.status}</Text></View>
                </View>
                <View style={styles.orderBottom}><Text style={styles.orderItems}>{order.items.length} ürün</Text><Text style={styles.orderTotal}>₺{order.total.toFixed(0)}</Text></View>
              </View>
            ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#231F20' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 48 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F0EAE4', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#231F20', marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: '#8A8A8A', textAlign: 'center', marginBottom: 32 },
  loginBtn: { backgroundColor: '#231F20', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 9999 },
  loginBtnText: { color: '#F9F5F1', fontSize: 16, fontWeight: '600' },
  userCard: { marginHorizontal: 24, backgroundColor: '#FFF', borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 24, elevation: 4 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 16 },
  avatarPlaceholder: { backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 32, fontWeight: '700', color: '#FFF' },
  userName: { fontSize: 22, fontWeight: '700', color: '#231F20', marginBottom: 4 },
  userEmail: { fontSize: 14, color: '#8A8A8A', marginBottom: 20 },
  statsRow: { flexDirection: 'row', width: '100%' },
  stat: { flex: 1, alignItems: 'center' }, statValue: { fontSize: 20, fontWeight: '700', color: '#231F20' },
  statLabel: { fontSize: 12, color: '#8A8A8A', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: '#E5E0DB' },
  linksSection: { marginHorizontal: 24, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0EAE4' },
  linkLeft: { flexDirection: 'row', alignItems: 'center' },
  linkIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF0E1', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  linkLabel: { fontSize: 15, fontWeight: '500', color: '#231F20' },
  ordersSection: { paddingHorizontal: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#231F20', marginBottom: 16 },
  noOrders: { fontSize: 14, color: '#8A8A8A', textAlign: 'center', paddingVertical: 24 },
  orderCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1 },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderStore: { fontSize: 15, fontWeight: '600', color: '#231F20' }, orderDate: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
  orderStatus: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  orderStatusText: { fontSize: 12, fontWeight: '600', color: '#27AE60', textTransform: 'capitalize' },
  orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderItems: { fontSize: 13, color: '#8A8A8A' }, orderTotal: { fontSize: 16, fontWeight: '700', color: '#E67E22' },
});

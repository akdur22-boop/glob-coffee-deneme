import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function OrderConfirmationScreen() {
  const router = useRouter();
  const { orderId, pointsEarned, storeName, total } = useLocalSearchParams<{ orderId: string; pointsEarned: string; storeName: string; total: string }>();
  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <View style={s.successCircle}><View style={s.successInner}><Feather name="check" size={48} color="#FFF" /></View></View>
        <Text style={s.title}>Sipariş Onaylandı!</Text>
        <Text style={s.orderId}>#{orderId?.slice(-8)?.toUpperCase()}</Text>
        <View style={s.card}>
          <View style={s.row}><Feather name="map-pin" size={18} color="#E67E22" /><View style={s.rowText}><Text style={s.label}>Teslim Noktası</Text><Text style={s.value}>{storeName}</Text></View></View>
          <View style={s.divider} />
          <View style={s.row}><Feather name="clock" size={18} color="#E67E22" /><View style={s.rowText}><Text style={s.label}>Tahmini Süre</Text><Text style={s.value}>10-15 dakika</Text></View></View>
          <View style={s.divider} />
          <View style={s.row}><Feather name="credit-card" size={18} color="#E67E22" /><View style={s.rowText}><Text style={s.label}>Toplam</Text><Text style={s.value}>₺{parseFloat(total || '0').toFixed(0)}</Text></View></View>
        </View>
        <View style={s.pointsBanner}><Feather name="star" size={20} color="#E67E22" /><Text style={s.pointsText}>Bu siparişle <Text style={s.pointsBold}>+{pointsEarned} puan</Text> kazandınız!</Text></View>
        <TouchableOpacity testID="back-to-home-btn" style={s.homeBtn} activeOpacity={0.8} onPress={() => router.replace('/(tabs)')}><Text style={s.homeBtnText}>Ana Sayfaya Dön</Text></TouchableOpacity>
        <TouchableOpacity testID="view-orders-btn" style={s.ordersBtn} activeOpacity={0.8} onPress={() => router.replace('/(tabs)/profile')}><Text style={s.ordersBtnText}>Siparişlerimi Gör</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' }, content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  successCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(39,174,96,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  successInner: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#27AE60', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#231F20', marginBottom: 8 }, orderId: { fontSize: 16, color: '#8A8A8A', fontWeight: '600', letterSpacing: 1, marginBottom: 32 },
  card: { width: '100%', backgroundColor: '#FFF', borderRadius: 20, padding: 24, marginBottom: 20, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center' }, rowText: { marginLeft: 14 }, label: { fontSize: 12, color: '#8A8A8A' }, value: { fontSize: 16, fontWeight: '600', color: '#231F20', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F0EAE4', marginVertical: 14 },
  pointsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF0E1', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 32 },
  pointsText: { fontSize: 14, color: '#5C5C5C', marginLeft: 10 }, pointsBold: { fontWeight: '700', color: '#E67E22' },
  homeBtn: { width: '100%', backgroundColor: '#231F20', paddingVertical: 18, borderRadius: 9999, alignItems: 'center', marginBottom: 12 },
  homeBtnText: { color: '#F9F5F1', fontSize: 16, fontWeight: '700' },
  ordersBtn: { width: '100%', borderWidth: 1.5, borderColor: '#E5E0DB', paddingVertical: 16, borderRadius: 9999, alignItems: 'center' },
  ordersBtnText: { color: '#5C5C5C', fontSize: 16, fontWeight: '600' },
});

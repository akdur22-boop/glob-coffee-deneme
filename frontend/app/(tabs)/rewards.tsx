import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function RewardsScreen() {
  const { user, sessionToken, fetchUser } = useApp();
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => { loadRewards(); }, []);
  const loadRewards = async () => { try { const r = await fetch(`${API_URL}/api/rewards`); if (r.ok) setRewards(await r.json()); } catch {} finally { setLoading(false); } };

  const redeemReward = async (reward: any) => {
    if (!sessionToken) { Alert.alert('Giriş Yapın', 'Ödül kullanmak için giriş yapmalısınız.'); return; }
    if ((user?.points || 0) < reward.points_required) { Alert.alert('Yetersiz Puan', `${reward.points_required - (user?.points || 0)} puan daha gerekli.`); return; }
    setRedeeming(reward.reward_id);
    try {
      const r = await fetch(`${API_URL}/api/rewards/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` }, body: JSON.stringify({ reward_id: reward.reward_id }) });
      if (r.ok) { Alert.alert('Tebrikler!', `"${reward.name}" ödülünü kullandınız`); await fetchUser(); } else { const e = await r.json(); Alert.alert('Hata', e.detail || 'Kullanılamadı'); }
    } catch { Alert.alert('Hata', 'Bir sorun oluştu'); } finally { setRedeeming(null); }
  };

  const ti = (() => { const p = user?.points || 0; if (p >= 500) return { next: 'Maksimum seviye!', progress: 1 }; if (p >= 200) return { next: `Altın seviyeye ${500 - p} puan`, progress: p / 500 }; return { next: `Gümüş seviyeye ${200 - p} puan`, progress: p / 200 }; })();
  const iconFor = (c: string) => c === 'İçecek' ? 'coffee' : c === 'Yiyecek' ? 'box' : 'tag';

  if (loading) return <View style={styles.loadingWrap}><ActivityIndicator size="large" color="#800020" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Text style={styles.title}>Ödüller</Text></View>
      <View style={styles.tierCard}>
        <View style={styles.tierTop}>
          <View style={styles.tierLeft}><View style={styles.tierIconWrap}><Feather name="award" size={28} color="#800020" /></View>
            <View><Text style={styles.tierName}>{user?.tier || 'Bronz'} Üye</Text><Text style={styles.tierPoints}>{user?.points || 0} puan</Text></View>
          </View>
        </View>
        <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${ti.progress * 100}%` }]} /></View>
        <Text style={styles.progressLabel}>{ti.next}</Text>
      </View>
      <View style={styles.howItWorks}><Text style={styles.howTitle}>Nasıl Çalışır?</Text>
        <View style={styles.howSteps}>
          {[{ n: '1', t: 'Favori içeceğini sipariş ver', c: '#FFF0F2' }, { n: '2', t: 'Her ₺1 için 10 puan kazan', c: '#E8F5E9' }, { n: '3', t: 'Puanlarını ödüllere dönüştür', c: '#E3F2FD' }].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.howDivider} />}
              <View style={styles.howStep}><View style={[styles.howCircle, { backgroundColor: s.c }]}><Text style={styles.howNum}>{s.n}</Text></View><Text style={styles.howText}>{s.t}</Text></View>
            </React.Fragment>
          ))}
        </View>
      </View>
      <Text style={styles.sectionTitle}>Mevcut Ödüller</Text>
      <FlatList data={rewards} keyExtractor={(i) => i.reward_id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}
        renderItem={({ item }) => { const can = (user?.points || 0) >= item.points_required; return (
          <View style={styles.rewardCard}>
            <View style={[styles.rewardIcon, { backgroundColor: can ? '#FFF0F2' : '#F0EAE4' }]}><Feather name={iconFor(item.category) as any} size={22} color={can ? '#800020' : '#8A8A8A'} /></View>
            <View style={styles.rewardInfo}><Text style={styles.rewardName}>{item.name}</Text><Text style={styles.rewardDesc}>{item.description}</Text><Text style={[styles.rewardPts, { color: can ? '#800020' : '#8A8A8A' }]}>{item.points_required} puan</Text></View>
            <TouchableOpacity testID={`redeem-${item.reward_id}`} style={[styles.redeemBtn, !can && styles.redeemBtnDisabled]} activeOpacity={0.8} onPress={() => redeemReward(item)} disabled={!can || redeeming === item.reward_id}>
              {redeeming === item.reward_id ? <ActivityIndicator size="small" color="#F9F5F1" /> : <Text style={[styles.redeemText, !can && styles.redeemTextDisabled]}>Kullan</Text>}
            </TouchableOpacity>
          </View>
        ); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' }, loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F1' },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 }, title: { fontSize: 28, fontWeight: '700', color: '#231F20' },
  tierCard: { marginHorizontal: 24, backgroundColor: '#FFF', borderRadius: 20, padding: 24, marginBottom: 20, elevation: 3 },
  tierTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }, tierLeft: { flexDirection: 'row', alignItems: 'center' },
  tierIconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(128,0,32,0.12)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  tierName: { fontSize: 18, fontWeight: '700', color: '#231F20' }, tierPoints: { fontSize: 14, color: '#8A8A8A', marginTop: 2 },
  progressBar: { height: 8, backgroundColor: '#F0EAE4', borderRadius: 4, overflow: 'hidden' }, progressFill: { height: 8, backgroundColor: '#800020', borderRadius: 4 },
  progressLabel: { fontSize: 13, color: '#8A8A8A', marginTop: 8 },
  howItWorks: { marginHorizontal: 24, marginBottom: 24 }, howTitle: { fontSize: 16, fontWeight: '700', color: '#231F20', marginBottom: 12 },
  howSteps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, howStep: { alignItems: 'center', flex: 1 },
  howCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 }, howNum: { fontSize: 14, fontWeight: '700', color: '#231F20' },
  howText: { fontSize: 11, color: '#5C5C5C', textAlign: 'center' }, howDivider: { width: 24, height: 2, backgroundColor: '#E5E0DB', marginHorizontal: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#231F20', paddingHorizontal: 24, marginBottom: 12 }, listContent: { paddingHorizontal: 24, paddingBottom: 100 },
  rewardCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1 },
  rewardIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  rewardInfo: { flex: 1 }, rewardName: { fontSize: 15, fontWeight: '600', color: '#231F20' }, rewardDesc: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
  rewardPts: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  redeemBtn: { backgroundColor: '#231F20', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }, redeemBtnDisabled: { backgroundColor: '#E5E0DB' },
  redeemText: { fontSize: 13, fontWeight: '600', color: '#F9F5F1' }, redeemTextDisabled: { color: '#8A8A8A' },
});

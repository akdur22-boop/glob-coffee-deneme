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

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rewards`);
      if (res.ok) setRewards(await res.json());
    } catch (e) {
      console.log('Rewards error', e);
    } finally {
      setLoading(false);
    }
  };

  const redeemReward = async (reward: any) => {
    if (!sessionToken) {
      Alert.alert('Sign In', 'Please sign in to redeem rewards.');
      return;
    }
    if ((user?.points || 0) < reward.points_required) {
      Alert.alert('Not Enough Points', `You need ${reward.points_required - (user?.points || 0)} more points.`);
      return;
    }
    setRedeeming(reward.reward_id);
    try {
      const res = await fetch(`${API_URL}/api/rewards/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ reward_id: reward.reward_id }),
      });
      if (res.ok) {
        Alert.alert('Redeemed!', `You've redeemed "${reward.name}"`);
        await fetchUser();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Failed to redeem');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setRedeeming(null);
    }
  };

  const tierInfo = () => {
    const pts = user?.points || 0;
    if (pts >= 500) return { tier: 'Gold', color: '#E67E22', next: 'Max tier!', progress: 1 };
    if (pts >= 200) return { tier: 'Silver', color: '#95A5A6', next: `${500 - pts} pts to Gold`, progress: pts / 500 };
    return { tier: 'Bronze', color: '#CD7F32', next: `${200 - pts} pts to Silver`, progress: pts / 200 };
  };

  const ti = tierInfo();

  const iconForCategory = (cat: string) => {
    if (cat === 'Drinks') return 'coffee';
    if (cat === 'Food') return 'box';
    return 'tag';
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#E67E22" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Rewards</Text>
      </View>

      {/* Tier Card */}
      <View style={styles.tierCard}>
        <View style={styles.tierTop}>
          <View style={styles.tierLeft}>
            <View style={[styles.tierIconWrap, { backgroundColor: ti.color + '20' }]}>
              <Feather name="award" size={28} color={ti.color} />
            </View>
            <View>
              <Text style={styles.tierName}>{user?.tier || 'Bronze'} Member</Text>
              <Text style={styles.tierPoints}>{user?.points || 0} points</Text>
            </View>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${ti.progress * 100}%`, backgroundColor: ti.color }]} />
        </View>
        <Text style={styles.progressLabel}>{ti.next}</Text>
      </View>

      {/* How it works */}
      <View style={styles.howItWorks}>
        <Text style={styles.howTitle}>How It Works</Text>
        <View style={styles.howSteps}>
          <View style={styles.howStep}>
            <View style={[styles.howCircle, { backgroundColor: '#FEF0E1' }]}>
              <Text style={styles.howNum}>1</Text>
            </View>
            <Text style={styles.howText}>Order your favorite drinks</Text>
          </View>
          <View style={styles.howDivider} />
          <View style={styles.howStep}>
            <View style={[styles.howCircle, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.howNum}>2</Text>
            </View>
            <Text style={styles.howText}>Earn 10 pts per $1 spent</Text>
          </View>
          <View style={styles.howDivider} />
          <View style={styles.howStep}>
            <View style={[styles.howCircle, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.howNum}>3</Text>
            </View>
            <Text style={styles.howText}>Redeem for free items</Text>
          </View>
        </View>
      </View>

      {/* Rewards List */}
      <Text style={styles.sectionTitle}>Available Rewards</Text>
      <FlatList
        data={rewards}
        keyExtractor={(item) => item.reward_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const canRedeem = (user?.points || 0) >= item.points_required;
          return (
            <View style={styles.rewardCard}>
              <View style={[styles.rewardIcon, { backgroundColor: canRedeem ? '#FEF0E1' : '#F0EAE4' }]}>
                <Feather name={iconForCategory(item.category)} size={22} color={canRedeem ? '#E67E22' : '#8A8A8A'} />
              </View>
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardName}>{item.name}</Text>
                <Text style={styles.rewardDesc}>{item.description}</Text>
                <Text style={[styles.rewardPts, { color: canRedeem ? '#E67E22' : '#8A8A8A' }]}>{item.points_required} pts</Text>
              </View>
              <TouchableOpacity
                testID={`redeem-${item.reward_id}`}
                style={[styles.redeemBtn, !canRedeem && styles.redeemBtnDisabled]}
                activeOpacity={0.8}
                onPress={() => redeemReward(item)}
                disabled={!canRedeem || redeeming === item.reward_id}
              >
                {redeeming === item.reward_id ? (
                  <ActivityIndicator size="small" color="#F9F5F1" />
                ) : (
                  <Text style={[styles.redeemText, !canRedeem && styles.redeemTextDisabled]}>Redeem</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F1' },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#231F20' },

  tierCard: { marginHorizontal: 24, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  tierTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  tierLeft: { flexDirection: 'row', alignItems: 'center' },
  tierIconWrap: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  tierName: { fontSize: 18, fontWeight: '700', color: '#231F20' },
  tierPoints: { fontSize: 14, color: '#8A8A8A', marginTop: 2 },
  progressBar: { height: 8, backgroundColor: '#F0EAE4', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  progressLabel: { fontSize: 13, color: '#8A8A8A', marginTop: 8 },

  howItWorks: { marginHorizontal: 24, marginBottom: 24 },
  howTitle: { fontSize: 16, fontWeight: '700', color: '#231F20', marginBottom: 12 },
  howSteps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  howStep: { alignItems: 'center', flex: 1 },
  howCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  howNum: { fontSize: 14, fontWeight: '700', color: '#231F20' },
  howText: { fontSize: 11, color: '#5C5C5C', textAlign: 'center' },
  howDivider: { width: 24, height: 2, backgroundColor: '#E5E0DB', marginHorizontal: 4 },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#231F20', paddingHorizontal: 24, marginBottom: 12 },
  listContent: { paddingHorizontal: 24, paddingBottom: 100 },
  rewardCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  rewardIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  rewardInfo: { flex: 1 },
  rewardName: { fontSize: 15, fontWeight: '600', color: '#231F20' },
  rewardDesc: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
  rewardPts: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  redeemBtn: { backgroundColor: '#231F20', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  redeemBtnDisabled: { backgroundColor: '#E5E0DB' },
  redeemText: { fontSize: 13, fontWeight: '600', color: '#F9F5F1' },
  redeemTextDisabled: { color: '#8A8A8A' },
});

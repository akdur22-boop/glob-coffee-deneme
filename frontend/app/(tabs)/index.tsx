import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, sessionToken, fetchUser } = useApp();
  const [featuredItems, setFeaturedItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadData();
  }, [sessionToken]);

  const loadData = async () => {
    try {
      const menuRes = await fetch(`${API_URL}/api/menu`);
      if (menuRes.ok) {
        const items = await menuRes.json();
        setFeaturedItems(items.filter((i: any) => i.popular));
      }
      if (sessionToken) {
        await fetchUser();
        const notifRes = await fetch(`${API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (notifRes.ok) {
          const notifs = await notifRes.json();
          setUnreadCount(notifs.filter((n: any) => !n.read).length);
        }
      }
    } catch (e) {
      console.log('Home load error', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [sessionToken]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E67E22" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.userName}>{user?.name || 'Coffee Lover'}</Text>
          </View>
          <TouchableOpacity
            testID="notifications-btn"
            style={styles.notifBtn}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.8}
          >
            <Feather name="bell" size={22} color="#231F20" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Points Card */}
        {user && (
          <TouchableOpacity
            testID="loyalty-card"
            style={styles.pointsCard}
            activeOpacity={0.9}
            onPress={() => router.push('/(tabs)/rewards')}
          >
            <View style={styles.pointsTop}>
              <View>
                <Text style={styles.pointsLabel}>YOUR BALANCE</Text>
                <Text style={styles.pointsValue}>{user.points} pts</Text>
              </View>
              <View style={styles.tierBadge}>
                <Feather name="award" size={16} color="#E67E22" />
                <Text style={styles.tierText}>{user.tier}</Text>
              </View>
            </View>
            <View style={styles.pointsBar}>
              <View style={[styles.pointsFill, { width: `${Math.min((user.points / 500) * 100, 100)}%` }]} />
            </View>
            <Text style={styles.pointsHint}>
              {user.points < 500 ? `${500 - user.points} pts to Gold tier` : 'You\'re Gold! Enjoy premium rewards'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity testID="quick-order-btn" style={styles.quickBtn} activeOpacity={0.8} onPress={() => router.push('/(tabs)/menu')}>
            <View style={[styles.quickIcon, { backgroundColor: '#FEF0E1' }]}>
              <Feather name="coffee" size={22} color="#E67E22" />
            </View>
            <Text style={styles.quickLabel}>Order</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="quick-rewards-btn" style={styles.quickBtn} activeOpacity={0.8} onPress={() => router.push('/(tabs)/rewards')}>
            <View style={[styles.quickIcon, { backgroundColor: '#E8F5E9' }]}>
              <Feather name="gift" size={22} color="#27AE60" />
            </View>
            <Text style={styles.quickLabel}>Rewards</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="quick-stores-btn" style={styles.quickBtn} activeOpacity={0.8} onPress={() => router.push('/(tabs)/stores')}>
            <View style={[styles.quickIcon, { backgroundColor: '#E3F2FD' }]}>
              <Feather name="map-pin" size={22} color="#1976D2" />
            </View>
            <Text style={styles.quickLabel}>Stores</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="quick-cart-btn" style={styles.quickBtn} activeOpacity={0.8} onPress={() => router.push('/cart')}>
            <View style={[styles.quickIcon, { backgroundColor: '#F3E5F5' }]}>
              <Feather name="shopping-bag" size={22} color="#7B1FA2" />
            </View>
            <Text style={styles.quickLabel}>Cart</Text>
          </TouchableOpacity>
        </View>

        {/* Featured */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Picks</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/menu')} activeOpacity={0.8}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredScroll}>
          {featuredItems.map((item) => (
            <TouchableOpacity
              key={item.item_id}
              testID={`featured-${item.item_id}`}
              style={styles.featuredCard}
              activeOpacity={0.85}
              onPress={() => router.push(`/item/${item.item_id}`)}
            >
              <Image source={{ uri: item.image_url }} style={styles.featuredImage} resizeMode="cover" />
              <View style={styles.featuredInfo}>
                <Text style={styles.featuredName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.featuredPrice}>${item.price.toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Promo Banner */}
        <TouchableOpacity testID="promo-banner" style={styles.promoBanner} activeOpacity={0.9}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>HAPPY HOUR</Text>
            <Text style={styles.promoSub}>2-for-1 Cold Brews</Text>
            <Text style={styles.promoTime}>Every day, 2 PM – 5 PM</Text>
          </View>
          <Feather name="chevron-right" size={24} color="#F9F5F1" />
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F1' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  greeting: { fontSize: 14, color: '#8A8A8A', fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' },
  userName: { fontSize: 28, fontWeight: '700', color: '#231F20', letterSpacing: -0.5, marginTop: 2 },
  notifBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  badge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#D32F2F', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  pointsCard: { marginHorizontal: 24, backgroundColor: '#231F20', borderRadius: 20, padding: 24, marginBottom: 24 },
  pointsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  pointsLabel: { fontSize: 12, color: 'rgba(249,245,241,0.5)', fontWeight: '600', letterSpacing: 1 },
  pointsValue: { fontSize: 36, fontWeight: '800', color: '#F9F5F1', marginTop: 4 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(230,126,34,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tierText: { color: '#E67E22', fontSize: 13, fontWeight: '700', marginLeft: 6 },
  pointsBar: { height: 6, backgroundColor: 'rgba(249,245,241,0.15)', borderRadius: 3, overflow: 'hidden' },
  pointsFill: { height: 6, backgroundColor: '#E67E22', borderRadius: 3 },
  pointsHint: { fontSize: 13, color: 'rgba(249,245,241,0.5)', marginTop: 10 },

  quickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, marginBottom: 32 },
  quickBtn: { alignItems: 'center' },
  quickIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 12, fontWeight: '600', color: '#5C5C5C' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#231F20' },
  seeAll: { fontSize: 14, fontWeight: '600', color: '#E67E22' },

  featuredScroll: { paddingLeft: 24, paddingRight: 8 },
  featuredCard: { width: width * 0.42, backgroundColor: '#FFFFFF', borderRadius: 16, marginRight: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  featuredImage: { width: '100%', height: 140 },
  featuredInfo: { padding: 12 },
  featuredName: { fontSize: 15, fontWeight: '600', color: '#231F20', marginBottom: 4 },
  featuredPrice: { fontSize: 16, fontWeight: '700', color: '#E67E22' },

  promoBanner: { marginHorizontal: 24, marginTop: 24, backgroundColor: '#E67E22', borderRadius: 20, padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  promoContent: {},
  promoTitle: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 2 },
  promoSub: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  promoTime: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
});

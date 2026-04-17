import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  RefreshControl, Dimensions, ActivityIndicator, Modal, Animated,
  Platform, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

let QRCode: any = null;
try { QRCode = require('react-native-qrcode-svg').default; } catch {}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width, height: screenHeight } = Dimensions.get('window');

// ─── QR Code Modal ───
function QRCodeModal({ user, onClose }: { user: any; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="slide">
      <View style={qr.overlay}>
        <View style={qr.container}>
          <TouchableOpacity testID="qr-close" style={qr.closeBtn} onPress={onClose}>
            <Feather name="x" size={24} color="#231F20" />
          </TouchableOpacity>
          <Text style={qr.title}>QR Kodum</Text>
          <Text style={qr.subtitle}>Kasada bu kodu göstererek puan kazanın</Text>

          <View style={qr.codeWrap}>
            {QRCode ? (
              <QRCode
                value={user.user_id}
                size={200}
                color="#231F20"
                backgroundColor="#FFF"
              />
            ) : (
              <View style={qr.fallbackQR}>
                <Feather name="maximize" size={64} color="#800020" />
                <Text style={qr.fallbackText}>{user.user_id}</Text>
              </View>
            )}
          </View>

          <View style={qr.userInfo}>
            <Text style={qr.userName}>{user.name}</Text>
            <View style={qr.pointsRow}>
              <Feather name="star" size={16} color="#800020" />
              <Text style={qr.pointsText}>{user.points} puan</Text>
              <View style={qr.tierBadge}>
                <Text style={qr.tierText}>{user.tier}</Text>
              </View>
            </View>
          </View>

          <Text style={qr.hint}>Kasadaki yetkili bu kodu okutarak puanınızı ekleyecektir</Text>
        </View>
      </View>
    </Modal>
  );
}

// ─── Full-Screen Story Viewer ───
function StoryViewer({ campaigns, initialIndex, campaignImages, onClose }: {
  campaigns: any[]; initialIndex: number; campaignImages: Record<string, string>; onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const STORY_DURATION = 5000;

  const campaign = campaigns[currentIndex];

  const startProgress = useCallback(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) goNext();
    });
  }, [currentIndex]);

  useEffect(() => {
    startProgress();
    return () => { progressAnim.stopAnimation(); };
  }, [currentIndex]);

  const goNext = () => {
    if (currentIndex < campaigns.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleTap = (x: number) => {
    if (x < width * 0.3) goPrev();
    else goNext();
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={sv.container}>
        <Image
          source={{ uri: campaignImages[campaign.campaign_id] }}
          style={sv.bgImage}
          resizeMode="cover"
        />
        <View style={sv.bgOverlay} />

        {/* Progress bars */}
        <SafeAreaView edges={['top']} style={sv.topBar}>
          <View style={sv.progressRow}>
            {campaigns.map((_, i) => (
              <View key={i} style={sv.progressBg}>
                {i < currentIndex ? (
                  <View style={[sv.progressFill, { width: '100%' }]} />
                ) : i === currentIndex ? (
                  <Animated.View style={[sv.progressFill, {
                    width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                  }]} />
                ) : null}
              </View>
            ))}
          </View>
          <TouchableOpacity testID="story-close" style={sv.closeBtn} onPress={onClose}>
            <Feather name="x" size={24} color="#FFF" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Touch areas */}
        <TouchableOpacity
          style={sv.touchArea}
          activeOpacity={1}
          onPress={(e) => handleTap(e.nativeEvent.locationX)}
        >
          <View style={sv.contentArea}>
            <View style={sv.badge}>
              <Text style={sv.badgeText}>
                {campaign.discount_type === 'percent'
                  ? `%${campaign.discount_value}`
                  : `₺${campaign.discount_value}`} İNDİRİM
              </Text>
            </View>
            <Text style={sv.storyTitle}>{campaign.title}</Text>
            <Text style={sv.storyDesc}>{campaign.description}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Spin Wheel Component ───
function SpinWheel({ prizes, onClose, sessionToken }: { prizes: any[]; onClose: () => void; sessionToken: string | null }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const rotation = useRef(new Animated.Value(0)).current;
  const WHEEL_SIZE = Math.min(width * 0.75, 300);

  const spin = async () => {
    if (spinning || !sessionToken) return;
    setSpinning(true);
    try {
      const r = await fetch(`${API_URL}/api/wheel/spin`, { method: 'POST', headers: { Authorization: `Bearer ${sessionToken}` } });
      const data = await r.json();
      if (data.already_spun) {
        setResult(data.prize);
        setSpinning(false);
        return;
      }
      const idx = data.prize_index || 0;
      const sliceAngle = 360 / prizes.length;
      const targetAngle = 360 * 5 + (360 - idx * sliceAngle - sliceAngle / 2);
      Animated.timing(rotation, { toValue: targetAngle, duration: 4000, useNativeDriver: true }).start(() => {
        setResult(data.prize);
        setSpinning(false);
      });
    } catch {
      setResult({ label: 'Hata oluştu', type: 'error', value: 0 });
      setSpinning(false);
    }
  };

  const rotateStr = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const defaultColors = ['#800020', '#27AE60', '#1976D2', '#D32F2F', '#7B1FA2', '#FF6F00', '#00838F', '#C2185B'];

  return (
    <Modal visible transparent animationType="fade">
      <View style={ws.overlay}>
        <View style={ws.container}>
          <TouchableOpacity testID="wheel-close" style={ws.closeBtn} onPress={onClose}>
            <Feather name="x" size={24} color="#231F20" />
          </TouchableOpacity>
          <Text style={ws.title}>Günlük Şans Çarkı</Text>
          <Text style={ws.subtitle}>Her gün bir kez çevirme hakkınız var!</Text>

          {result ? (
            <View style={ws.resultWrap}>
              <View style={ws.resultCircle}><Feather name="gift" size={48} color="#800020" /></View>
              <Text style={ws.resultTitle}>Tebrikler!</Text>
              <Text style={ws.resultPrize}>{result.label}</Text>
              <TouchableOpacity style={ws.resultBtn} onPress={onClose}>
                <Text style={ws.resultBtnText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={ws.wheelWrap}>
              <View style={ws.pointer}><Text style={{ fontSize: 24 }}>▼</Text></View>
              <Animated.View style={[ws.wheel, { width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2, transform: [{ rotate: rotateStr }] }]}>
                {prizes.map((p, i) => {
                  const angle = (i * 360) / prizes.length;
                  const color = p.color || defaultColors[i % defaultColors.length];
                  return (
                    <View key={p.prize_id} style={[ws.slice, { transform: [{ rotate: `${angle}deg` }], width: WHEEL_SIZE, height: WHEEL_SIZE }]}>
                      <View style={[ws.sliceInner, { backgroundColor: color, borderTopLeftRadius: WHEEL_SIZE / 2, borderBottomLeftRadius: WHEEL_SIZE / 2 }]}>
                        <Text style={ws.sliceLabel} numberOfLines={1}>{p.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </Animated.View>
              <TouchableOpacity testID="spin-btn" style={ws.spinBtn} activeOpacity={0.8} onPress={spin} disabled={spinning}>
                <Text style={ws.spinBtnText}>{spinning ? '...' : 'ÇEVİR'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Home Screen ───
export default function HomeScreen() {
  const router = useRouter();
  const { user, sessionToken, fetchUser } = useApp();
  const [featuredItems, setFeaturedItems] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showWheel, setShowWheel] = useState(false);
  const [wheelPrizes, setWheelPrizes] = useState<any[]>([]);
  const [alreadySpunToday, setAlreadySpunToday] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const campaignScrollRef = useRef<FlatList>(null);

  useEffect(() => { loadData(); }, [sessionToken]);

  const loadData = async () => {
    try {
      const [menuRes, campRes, wheelRes] = await Promise.all([
        fetch(`${API_URL}/api/menu`), fetch(`${API_URL}/api/campaigns`), fetch(`${API_URL}/api/wheel-prizes`)
      ]);
      if (menuRes.ok) { const items = await menuRes.json(); setFeaturedItems(items.filter((i: any) => i.popular)); }
      if (campRes.ok) setCampaigns(await campRes.json());
      if (wheelRes.ok) setWheelPrizes(await wheelRes.json());
      if (sessionToken) {
        await fetchUser();
        const notifRes = await fetch(`${API_URL}/api/notifications`, { headers: { Authorization: `Bearer ${sessionToken}` } });
        if (notifRes.ok) { const n = await notifRes.json(); setUnreadCount(n.filter((x: any) => !x.read).length); }
        const lastSpin = await AsyncStorage.getItem('last_spin_date');
        const today = new Date().toISOString().split('T')[0];
        if (lastSpin === today) setAlreadySpunToday(true);
        else if (!lastSpin) { setShowWheel(true); }
      }
    } catch {} finally { setLoading(false); }
  };

  const handleSpinClose = async () => {
    setShowWheel(false);
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem('last_spin_date', today);
    setAlreadySpunToday(true);
    if (sessionToken) await fetchUser();
  };

  const onRefresh = useCallback(async () => { setRefreshing(true); await loadData(); setRefreshing(false); }, [sessionToken]);
  const greeting = () => { const h = new Date().getHours(); if (h < 12) return 'Günaydın'; if (h < 17) return 'İyi Öğlenler'; return 'İyi Akşamlar'; };

  if (loading) return <View style={s.loadingWrap}><ActivityIndicator size="large" color="#800020" /></View>;

  const campaignImages: Record<string, string> = {};
  const defaultCampImages = [
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600',
    'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600',
    'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600',
  ];
  campaigns.forEach((c, i) => {
    campaignImages[c.campaign_id] = c.image_url || defaultCampImages[i % defaultCampImages.length];
  });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Modals */}
      {showWheel && wheelPrizes.length > 0 && sessionToken && (
        <SpinWheel prizes={wheelPrizes} onClose={handleSpinClose} sessionToken={sessionToken} />
      )}
      {showQR && user && <QRCodeModal user={user} onClose={() => setShowQR(false)} />}
      {storyViewerIndex !== null && campaigns.length > 0 && (
        <StoryViewer
          campaigns={campaigns}
          initialIndex={storyViewerIndex}
          campaignImages={campaignImages}
          onClose={() => setStoryViewerIndex(null)}
        />
      )}

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#800020" />}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting()}</Text>
            <Text style={s.userName}>{user?.name || 'Kahve Sever'}</Text>
          </View>
          <View style={s.headerRight}>
            {sessionToken && !alreadySpunToday && (
              <TouchableOpacity testID="wheel-trigger" style={s.wheelBtn} onPress={() => setShowWheel(true)} activeOpacity={0.8}>
                <Text style={{ fontSize: 20 }}>🎡</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="notifications-btn" style={s.notifBtn} onPress={() => router.push('/notifications')} activeOpacity={0.8}>
              <Feather name="bell" size={22} color="#231F20" />
              {unreadCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{unreadCount}</Text></View>}
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Instagram Stories ─── */}
        {campaigns.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storiesScroll}>
            {campaigns.map((c, i) => (
              <TouchableOpacity
                key={c.campaign_id}
                testID={`story-${c.campaign_id}`}
                style={s.storyItem}
                activeOpacity={0.8}
                onPress={() => setStoryViewerIndex(i)}
              >
                <View style={s.storyRing}>
                  <Image source={{ uri: campaignImages[c.campaign_id] }} style={s.storyImage} resizeMode="cover" />
                </View>
                <Text style={s.storyLabel} numberOfLines={1}>{c.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Points Card + QR Button */}
        {user && (
          <View style={s.pointsSection}>
            <TouchableOpacity testID="loyalty-card" style={s.pointsCard} activeOpacity={0.9} onPress={() => router.push('/(tabs)/rewards')}>
              <View style={s.pointsTop}>
                <View>
                  <Text style={s.pointsLabel}>PUAN BAKİYENİZ</Text>
                  <Text style={s.pointsValue}>{user.points} puan</Text>
                </View>
                <View style={s.tierBadge}>
                  <Feather name="award" size={16} color="#800020" />
                  <Text style={s.tierText}>{user.tier}</Text>
                </View>
              </View>
              <View style={s.pointsBar}>
                <View style={[s.pointsFill, { width: `${Math.min((user.points / 500) * 100, 100)}%` }]} />
              </View>
              <Text style={s.pointsHint}>
                {user.points < 500 ? `Altın seviyeye ${500 - user.points} puan` : 'Altın seviyedesiniz!'}
              </Text>
            </TouchableOpacity>

            {/* QR Code Button */}
            <TouchableOpacity testID="qr-button" style={s.qrButton} activeOpacity={0.8} onPress={() => setShowQR(true)}>
              <View style={s.qrIconWrap}>
                <Feather name="maximize" size={24} color="#FFF" />
              </View>
              <View style={s.qrTextWrap}>
                <Text style={s.qrTitle}>QR Kodum</Text>
                <Text style={s.qrSubtitle}>Kasada göster, puan kazan</Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(249,245,241,0.5)" />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={s.quickActions}>
          {[
            { icon: 'coffee', label: 'Sipariş', color: '#FFF0F2', ic: '#800020', route: '/(tabs)/menu' },
            { icon: 'gift', label: 'Ödüller', color: '#E8F5E9', ic: '#27AE60', route: '/(tabs)/rewards' },
            { icon: 'map-pin', label: 'Şubeler', color: '#E3F2FD', ic: '#1976D2', route: '/(tabs)/stores' },
            { icon: 'shopping-bag', label: 'Sepet', color: '#F3E5F5', ic: '#7B1FA2', route: '/cart' },
          ].map((a, i) => (
            <TouchableOpacity key={i} testID={`quick-${a.icon}`} style={s.quickBtn} activeOpacity={0.8} onPress={() => router.push(a.route as any)}>
              <View style={[s.quickIcon, { backgroundColor: a.color }]}><Feather name={a.icon as any} size={22} color={a.ic} /></View>
              <Text style={s.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Popular Products */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Popüler Ürünler</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/menu')}><Text style={s.seeAll}>Tümünü Gör</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.featuredScroll}>
          {featuredItems.map((item) => (
            <TouchableOpacity key={item.item_id} testID={`featured-${item.item_id}`} style={s.featuredCard} activeOpacity={0.85} onPress={() => router.push(`/item/${item.item_id}`)}>
              <Image source={{ uri: item.image_url }} style={s.featuredImage} resizeMode="cover" />
              <View style={s.featuredInfo}>
                <Text style={s.featuredName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.featuredPrice}>₺{item.price}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ─── Campaign Slider ─── */}
        {campaigns.length > 0 && (
          <View style={s.campaignSection}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Kampanyalar</Text>
              <Text style={s.campaignCounter}>{campaigns.length} aktif</Text>
            </View>
            <FlatList
              ref={campaignScrollRef}
              data={campaigns}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.campaign_id}
              contentContainerStyle={s.campaignListContent}
              snapToInterval={width - 48}
              decelerationRate="fast"
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={`campaign-card-${item.campaign_id}`}
                  style={s.campaignCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    const idx = campaigns.findIndex(c => c.campaign_id === item.campaign_id);
                    setStoryViewerIndex(idx >= 0 ? idx : 0);
                  }}
                >
                  <Image source={{ uri: campaignImages[item.campaign_id] }} style={s.campaignImage} resizeMode="cover" />
                  <View style={s.campaignOverlay} />
                  <View style={s.campaignContent}>
                    <View style={s.campaignBadge}>
                      <Text style={s.campaignBadgeText}>
                        {item.discount_type === 'percent' ? `%${item.discount_value}` : `₺${item.discount_value}`} İNDİRİM
                      </Text>
                    </View>
                    <Text style={s.campaignTitle}>{item.title}</Text>
                    <Text style={s.campaignDesc} numberOfLines={2}>{item.description}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── QR Modal Styles ───
const qr = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#FFF', borderRadius: 24, padding: 32, width: width * 0.88, alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  title: { fontSize: 24, fontWeight: '800', color: '#231F20', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8A8A8A', marginBottom: 24 },
  codeWrap: { padding: 20, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 2, borderColor: '#800020', marginBottom: 20 },
  fallbackQR: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF0F2', borderRadius: 12 },
  fallbackText: { fontSize: 11, color: '#8A8A8A', marginTop: 8, textAlign: 'center' },
  userInfo: { alignItems: 'center', marginBottom: 16 },
  userName: { fontSize: 18, fontWeight: '700', color: '#231F20', marginBottom: 8 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pointsText: { fontSize: 15, fontWeight: '600', color: '#231F20' },
  tierBadge: { backgroundColor: '#FFF0F2', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  tierText: { fontSize: 12, fontWeight: '700', color: '#800020' },
  hint: { fontSize: 12, color: '#8A8A8A', textAlign: 'center', lineHeight: 18 },
});

// ─── Story Viewer Styles ───
const sv = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bgImage: { position: 'absolute', width, height: screenHeight },
  bgOverlay: { position: 'absolute', width, height: screenHeight, backgroundColor: 'rgba(0,0,0,0.35)' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingTop: 8 },
  progressRow: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  progressBg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: '#FFF', borderRadius: 2 },
  closeBtn: { alignSelf: 'flex-end', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  touchArea: { flex: 1, justifyContent: 'flex-end' },
  contentArea: { paddingHorizontal: 24, paddingBottom: 80 },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(128,0,32,0.9)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  badgeText: { fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  storyTitle: { fontSize: 32, fontWeight: '800', color: '#FFF', marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  storyDesc: { fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 24, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
});

// ─── Spin Wheel Styles ───
const ws = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, width: width * 0.9, maxHeight: '85%', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  title: { fontSize: 24, fontWeight: '800', color: '#231F20', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8A8A8A', marginBottom: 20 },
  wheelWrap: { alignItems: 'center', position: 'relative' },
  pointer: { zIndex: 10, marginBottom: -10 },
  wheel: { overflow: 'hidden', position: 'relative', borderWidth: 4, borderColor: '#231F20' },
  slice: { position: 'absolute', top: 0, left: 0, justifyContent: 'center' },
  sliceInner: { width: '50%', height: '100%', justifyContent: 'center', paddingLeft: 16 },
  sliceLabel: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  spinBtn: { backgroundColor: '#800020', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginTop: 20, borderWidth: 3, borderColor: '#FFF', elevation: 4 },
  spinBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  resultWrap: { alignItems: 'center', paddingVertical: 20 },
  resultCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF0F2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  resultTitle: { fontSize: 28, fontWeight: '800', color: '#231F20', marginBottom: 8 },
  resultPrize: { fontSize: 20, fontWeight: '700', color: '#800020', marginBottom: 24 },
  resultBtn: { backgroundColor: '#231F20', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 9999 },
  resultBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

// ─── Main Styles ───
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F1' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { fontSize: 14, color: '#8A8A8A', fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' },
  userName: { fontSize: 28, fontWeight: '700', color: '#231F20', letterSpacing: -0.5, marginTop: 2 },
  wheelBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF0F2', justifyContent: 'center', alignItems: 'center' },
  notifBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  badge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#D32F2F', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Stories
  storiesScroll: { paddingHorizontal: 20, paddingVertical: 12 },
  storyItem: { alignItems: 'center', marginRight: 16, width: 72 },
  storyRing: { width: 68, height: 68, borderRadius: 34, padding: 3, borderWidth: 2.5, borderColor: '#800020', justifyContent: 'center', alignItems: 'center' },
  storyImage: { width: 56, height: 56, borderRadius: 28 },
  storyLabel: { fontSize: 11, fontWeight: '600', color: '#5C5C5C', marginTop: 6, textAlign: 'center' },

  // Points + QR
  pointsSection: { paddingHorizontal: 24, marginBottom: 24 },
  pointsCard: { backgroundColor: '#231F20', borderRadius: 20, padding: 24, marginBottom: 12 },
  pointsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  pointsLabel: { fontSize: 12, color: 'rgba(249,245,241,0.5)', fontWeight: '600', letterSpacing: 1 },
  pointsValue: { fontSize: 36, fontWeight: '800', color: '#F9F5F1', marginTop: 4 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(128,0,32,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tierText: { color: '#800020', fontSize: 13, fontWeight: '700', marginLeft: 6 },
  pointsBar: { height: 6, backgroundColor: 'rgba(249,245,241,0.15)', borderRadius: 3, overflow: 'hidden' },
  pointsFill: { height: 6, backgroundColor: '#800020', borderRadius: 3 },
  pointsHint: { fontSize: 13, color: 'rgba(249,245,241,0.5)', marginTop: 10 },

  qrButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#800020', borderRadius: 16, padding: 16 },
  qrIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  qrTextWrap: { flex: 1 },
  qrTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  qrSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Quick Actions
  quickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, marginBottom: 32 },
  quickBtn: { alignItems: 'center' },
  quickIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 12, fontWeight: '600', color: '#5C5C5C' },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#231F20' },
  seeAll: { fontSize: 14, fontWeight: '600', color: '#800020' },

  // Featured
  featuredScroll: { paddingLeft: 24, paddingRight: 8 },
  featuredCard: { width: width * 0.42, backgroundColor: '#FFF', borderRadius: 16, marginRight: 16, overflow: 'hidden', elevation: 3 },
  featuredImage: { width: '100%', height: 140 },
  featuredInfo: { padding: 12 },
  featuredName: { fontSize: 15, fontWeight: '600', color: '#231F20', marginBottom: 4 },
  featuredPrice: { fontSize: 16, fontWeight: '700', color: '#800020' },

  // Campaign Slider
  campaignSection: { marginTop: 24 },
  campaignCounter: { fontSize: 14, fontWeight: '600', color: '#8A8A8A' },
  campaignListContent: { paddingHorizontal: 24 },
  campaignCard: { width: width - 64, height: 200, borderRadius: 20, overflow: 'hidden', marginRight: 16, position: 'relative' },
  campaignImage: { width: '100%', height: '100%', position: 'absolute' },
  campaignOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 },
  campaignContent: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  campaignBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(128,0,32,0.9)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  campaignBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  campaignTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  campaignDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
});

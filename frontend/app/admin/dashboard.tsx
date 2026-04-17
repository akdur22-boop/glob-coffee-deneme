import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, FlatList, RefreshControl, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// CameraView only works on native - lazy import to prevent web crash
let CameraView: any = null;
if (Platform.OS !== 'web') {
  try { CameraView = require('expo-camera').CameraView; } catch {}
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type Section = 'home' | 'menu' | 'campaigns' | 'notifications' | 'scanner' | 'stores' | 'managers' | 'orders' | 'rewards' | 'users' | 'wheel';

export default function AdminDashboard() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [admin, setAdmin] = useState<any>(null);
  const [section, setSection] = useState<Section>('home');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [wheelPrizes, setWheelPrizes] = useState<any[]>([]);

  // Forms
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});

  // Scanner
  const [scanning, setScanning] = useState(false);
  const [scannedUser, setScannedUser] = useState('');
  const [addingPoints, setAddingPoints] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanSettings, setScanSettings] = useState<any>(null);

  // Notification form
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

  useEffect(() => { init(); }, []);

  const init = async () => {
    const t = await AsyncStorage.getItem('admin_token');
    const a = await AsyncStorage.getItem('admin_data');
    if (!t) { router.replace('/admin/login'); return; }
    setToken(t); setAdmin(a ? JSON.parse(a) : null);
    await loadStats(t); setLoading(false);
  };

  const loadStats = async (t: string) => {
    try { const r = await fetch(`${API_URL}/api/admin/stats`, { headers: { Authorization: `Bearer ${t}` } }); if (r.ok) setStats(await r.json()); else { router.replace('/admin/login'); } } catch {}
  };

  const loadSection = async (s: Section) => {
    setSection(s);
    setShowForm(false);
    setFormData({});
    const h = { Authorization: `Bearer ${token}` };
    try {
      if (s === 'menu') { const r = await fetch(`${API_URL}/api/menu`); if (r.ok) setMenuItems(await r.json()); }
      if (s === 'campaigns') { const r = await fetch(`${API_URL}/api/admin/campaigns`, { headers: h }); if (r.ok) setCampaigns(await r.json()); }
      if (s === 'orders') { const r = await fetch(`${API_URL}/api/admin/orders`, { headers: h }); if (r.ok) setOrders(await r.json()); }
      if (s === 'stores') { const r = await fetch(`${API_URL}/api/stores`); if (r.ok) setStores(await r.json()); }
      if (s === 'managers') { const r = await fetch(`${API_URL}/api/admin/managers`, { headers: h }); if (r.ok) setManagers(await r.json()); }
      if (s === 'rewards') { const r = await fetch(`${API_URL}/api/rewards`); if (r.ok) setRewards(await r.json()); }
      if (s === 'users') { const r = await fetch(`${API_URL}/api/admin/users`, { headers: h }); if (r.ok) setUsers(await r.json()); }
      if (s === 'wheel') { const r = await fetch(`${API_URL}/api/admin/wheel-prizes`, { headers: h }); if (r.ok) setWheelPrizes(await r.json()); }
      if (s === 'scanner') { loadScanSettings(); }
    } catch {}
  };

  const onRefresh = useCallback(async () => { setRefreshing(true); await loadStats(token); if (section !== 'home') await loadSection(section); setRefreshing(false); }, [token, section]);

  const handleLogout = async () => { await AsyncStorage.multiRemove(['admin_token', 'admin_data']); router.replace('/admin/login'); };

  // ─── CRUD Handlers ───
  const addMenuItem = async () => {
    try {
      const r = await fetch(`${API_URL}/api/admin/menu`, { method: 'POST', headers: headers(), body: JSON.stringify({ ...formData, price: parseFloat(formData.price || '0'), sizes: formData.sizes ? formData.sizes.split(',').map((s: string) => s.trim()) : [], popular: false }) });
      if (r.ok) { Alert.alert('Başarılı', 'Ürün eklendi'); setShowForm(false); setFormData({}); loadSection('menu'); }
    } catch { Alert.alert('Hata', 'Ürün eklenemedi'); }
  };

  const deleteMenuItem = (id: string) => Alert.alert('Sil', 'Bu ürünü silmek istiyor musunuz?', [{ text: 'İptal' }, { text: 'Sil', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/admin/menu/${id}`, { method: 'DELETE', headers: headers() }); loadSection('menu'); } }]);

  const addCampaign = async () => {
    try {
      const r = await fetch(`${API_URL}/api/admin/campaigns`, { method: 'POST', headers: headers(), body: JSON.stringify({ ...formData, discount_value: parseFloat(formData.discount_value || '10'), discount_type: formData.discount_type || 'percent', active: true }) });
      if (r.ok) { Alert.alert('Başarılı', 'Kampanya oluşturuldu'); setShowForm(false); setFormData({}); loadSection('campaigns'); }
    } catch { Alert.alert('Hata', 'Kampanya oluşturulamadı'); }
  };

  const deleteCampaign = (id: string) => Alert.alert('Sil', 'Bu kampanyayı silmek istiyor musunuz?', [{ text: 'İptal' }, { text: 'Sil', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/admin/campaigns/${id}`, { method: 'DELETE', headers: headers() }); loadSection('campaigns'); } }]);

  const addStore = async () => {
    try {
      const r = await fetch(`${API_URL}/api/admin/stores`, { method: 'POST', headers: headers(), body: JSON.stringify({ ...formData, lat: parseFloat(formData.lat || '0'), lng: parseFloat(formData.lng || '0') }) });
      if (r.ok) { Alert.alert('Başarılı', 'Şube eklendi'); setShowForm(false); setFormData({}); loadSection('stores'); }
    } catch { Alert.alert('Hata', 'Şube eklenemedi'); }
  };

  const deleteStore = (id: string) => Alert.alert('Sil', 'Bu şubeyi silmek istiyor musunuz?', [{ text: 'İptal' }, { text: 'Sil', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/admin/stores/${id}`, { method: 'DELETE', headers: headers() }); loadSection('stores'); } }]);

  const addManager = async () => {
    try {
      const r = await fetch(`${API_URL}/api/admin/managers`, { method: 'POST', headers: headers(), body: JSON.stringify(formData) });
      if (r.ok) { Alert.alert('Başarılı', 'Yetkili oluşturuldu'); setShowForm(false); setFormData({}); loadSection('managers'); }
      else { const e = await r.json(); Alert.alert('Hata', e.detail || 'Oluşturulamadı'); }
    } catch { Alert.alert('Hata', 'Yetkili oluşturulamadı'); }
  };

  const deleteManager = (id: string) => Alert.alert('Sil', 'Bu yetkiliyi silmek istiyor musunuz?', [{ text: 'İptal' }, { text: 'Sil', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/admin/managers/${id}`, { method: 'DELETE', headers: headers() }); loadSection('managers'); } }]);

  const updateOrderStatus = (orderId: string, status: string) => {
    fetch(`${API_URL}/api/admin/orders/${orderId}/status`, { method: 'PUT', headers: headers(), body: JSON.stringify({ status }) }).then(() => loadSection('orders'));
  };

  const sendNotification = async () => {
    if (!notifTitle || !notifBody) { Alert.alert('Hata', 'Başlık ve mesaj gerekli'); return; }
    setSendingNotif(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/notifications/send`, { method: 'POST', headers: headers(), body: JSON.stringify({ title: notifTitle, body: notifBody }) });
      if (r.ok) { const d = await r.json(); Alert.alert('Başarılı', d.message); setNotifTitle(''); setNotifBody(''); }
    } catch { Alert.alert('Hata', 'Gönderilemedi'); } finally { setSendingNotif(false); }
  };

  const handleQRScan = async ({ data }: { data: string }) => {
    if (addingPoints) return;
    setScanning(false);
    setScannedUser(data);
    // Otomatik puan ekle
    autoAddPoints(data);
  };

  const autoAddPoints = async (userId?: string) => {
    const uid = userId || scannedUser;
    if (!uid) { Alert.alert('Hata', 'Kullanıcı ID gerekli'); return; }
    setAddingPoints(true);
    setScanResult(null);
    try {
      const r = await fetch(`${API_URL}/api/admin/scan-checkin`, { method: 'POST', headers: headers(), body: JSON.stringify({ user_id: uid.trim() }) });
      const d = await r.json();
      if (r.ok) {
        setScanResult({ success: true, ...d });
        Alert.alert('Başarılı ✅', `${d.user_name} kullanıcısına otomatik ${d.points_added} puan eklendi.\nToplam: ${d.new_points} puan (${d.tier})`);
        setScannedUser('');
      } else {
        setScanResult({ success: false, message: d.detail });
        Alert.alert('Uyarı', d.detail || 'Puan eklenemedi');
      }
    } catch { Alert.alert('Hata', 'Bağlantı hatası'); } finally { setAddingPoints(false); }
  };

  const loadScanSettings = async () => {
    try {
      const r = await fetch(`${API_URL}/api/admin/scan-settings`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setScanSettings(await r.json());
    } catch {}
  };

  const addReward = async () => {
    try {
      const r = await fetch(`${API_URL}/api/admin/rewards`, { method: 'POST', headers: headers(), body: JSON.stringify({ ...formData, points_required: parseInt(formData.points_required || '0') }) });
      if (r.ok) { Alert.alert('Başarılı', 'Ödül eklendi'); setShowForm(false); setFormData({}); loadSection('rewards'); }
    } catch { Alert.alert('Hata', 'Ödül eklenemedi'); }
  };

  const deleteReward = (id: string) => Alert.alert('Sil', 'Bu ödülü silmek istiyor musunuz?', [{ text: 'İptal' }, { text: 'Sil', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/admin/rewards/${id}`, { method: 'DELETE', headers: headers() }); loadSection('rewards'); } }]);

  const addWheelPrize = async () => {
    try {
      const r = await fetch(`${API_URL}/api/admin/wheel-prizes`, { method: 'POST', headers: headers(), body: JSON.stringify({ label: formData.label || 'Hediye', type: formData.type || 'points', value: parseInt(formData.value || '10'), color: formData.color || '#800020', probability: parseFloat(formData.probability || '10') }) });
      if (r.ok) { Alert.alert('Başarılı', 'Çark ödülü eklendi'); setShowForm(false); setFormData({}); loadSection('wheel'); }
      else { const e = await r.json(); Alert.alert('Hata', e.detail || 'Eklenemedi'); }
    } catch { Alert.alert('Hata', 'Çark ödülü eklenemedi'); }
  };

  const deleteWheelPrize = (id: string) => Alert.alert('Sil', 'Bu çark ödülünü silmek istiyor musunuz?', [{ text: 'İptal' }, { text: 'Sil', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/admin/wheel-prizes/${id}`, { method: 'DELETE', headers: headers() }); loadSection('wheel'); } }]);

  // useCallback MUST be before any early returns (Rules of Hooks)
  const updateField = useCallback((field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  }, []);

  const renderFormInput = (label: string, field: string, placeholder: string, kbType?: any) => (
    <View style={s.formGroup} key={field}><Text style={s.formLabel}>{label}</Text>
      <TextInput style={s.formInput} placeholder={placeholder} placeholderTextColor="#999" value={formData[field] || ''} onChangeText={(t) => updateField(field, t)} keyboardType={kbType || 'default'} />
    </View>
  );

  if (loading) return <View style={s.loadingWrap}><ActivityIndicator size="large" color="#800020" /></View>;

  const menuItems_nav: { icon: string; label: string; key: Section; color: string }[] = [
    { icon: 'home', label: 'Panel', key: 'home', color: '#800020' },
    { icon: 'coffee', label: 'Menü', key: 'menu', color: '#8B4513' },
    { icon: 'tag', label: 'Kampanya', key: 'campaigns', color: '#27AE60' },
    { icon: 'bell', label: 'Bildirim', key: 'notifications', color: '#1976D2' },
    { icon: 'disc', label: 'Çark', key: 'wheel', color: '#FF6F00' },
    { icon: 'maximize', label: 'QR Tara', key: 'scanner', color: '#7B1FA2' },
    { icon: 'map-pin', label: 'Şubeler', key: 'stores', color: '#D32F2F' },
    { icon: 'users', label: 'Yetkililer', key: 'managers', color: '#00695C' },
    { icon: 'package', label: 'Siparişler', key: 'orders', color: '#0288D1' },
    { icon: 'gift', label: 'Ödüller', key: 'rewards', color: '#C2185B' },
    { icon: 'user', label: 'Müşteriler', key: 'users', color: '#5C6BC0' },
  ];

  const statusOptions = [
    { value: 'confirmed', label: 'Onaylandı', color: '#27AE60' },
    { value: 'preparing', label: 'Hazırlanıyor', color: '#800020' },
    { value: 'ready', label: 'Hazır', color: '#1976D2' },
    { value: 'completed', label: 'Tamamlandı', color: '#5C6BC0' },
    { value: 'cancelled', label: 'İptal', color: '#D32F2F' },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View><Text style={s.adminLabel}>ADMİN PANELİ</Text><Text style={s.adminName}>{admin?.name}</Text></View>
        <TouchableOpacity testID="admin-logout-btn" onPress={handleLogout} activeOpacity={0.8}><Feather name="log-out" size={22} color="#D32F2F" /></TouchableOpacity>
      </View>

      {/* Nav */}
      <View style={s.navWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.navScroll}>
          {menuItems_nav.map((item) => (
            <TouchableOpacity key={item.key} testID={`nav-${item.key}`} style={[s.navItem, section === item.key && { backgroundColor: item.color + '20' }]}
              activeOpacity={0.8} onPress={() => { if (item.key === 'home') { setSection('home'); loadStats(token); } else loadSection(item.key); }}>
              <Feather name={item.icon as any} size={16} color={section === item.key ? item.color : '#8A8A8A'} />
              <Text style={[s.navLabel, section === item.key && { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#800020" />} contentContainerStyle={s.contentPad}>

          {/* HOME */}
          {section === 'home' && stats && (<View>
            <Text style={s.sectionTitle}>Genel Bakış</Text>
            <View style={s.statsGrid}>
              {[
                { label: 'Müşteriler', value: stats.total_users, icon: 'users', color: '#800020' },
                { label: 'Siparişler', value: stats.total_orders, icon: 'package', color: '#1976D2' },
                { label: 'Gelir', value: `₺${stats.total_revenue}`, icon: 'trending-up', color: '#27AE60' },
                { label: 'Menü Ürünü', value: stats.total_menu_items, icon: 'coffee', color: '#8B4513' },
                { label: 'Şubeler', value: stats.total_stores, icon: 'map-pin', color: '#D32F2F' },
                { label: 'Kampanyalar', value: stats.total_campaigns, icon: 'tag', color: '#7B1FA2' },
              ].map((st, i) => (
                <View key={i} style={s.statCard}><View style={[s.statIcon, { backgroundColor: st.color + '15' }]}><Feather name={st.icon as any} size={20} color={st.color} /></View>
                  <Text style={s.statValue}>{st.value}</Text><Text style={s.statLabel}>{st.label}</Text>
                </View>
              ))}
            </View>
          </View>)}

          {/* MENU */}
          {section === 'menu' && (<View>
            <View style={s.sectionHeader}><Text style={s.sectionTitle}>Menü Yönetimi</Text>
              <TouchableOpacity testID="add-menu-btn" style={s.addButton} onPress={() => { setFormData({}); setShowForm(true); }}><Feather name="plus" size={18} color="#FFF" /><Text style={s.addButtonText}>Ekle</Text></TouchableOpacity>
            </View>
            {menuItems.map((item) => (
              <View key={item.item_id} style={s.listCard}><View style={s.listCardMain}>
                <View><Text style={s.listCardTitle}>{item.name}</Text><Text style={s.listCardSub}>{item.category} · ₺{item.price}</Text></View>
                <TouchableOpacity testID={`delete-menu-${item.item_id}`} onPress={() => deleteMenuItem(item.item_id)}><Feather name="trash-2" size={18} color="#D32F2F" /></TouchableOpacity>
              </View></View>
            ))}
            <Modal visible={showForm} transparent animationType="slide"><View style={s.modalOverlay}><View style={s.modalContent}>
              <Text style={s.modalTitle}>Yeni Ürün Ekle</Text>
              {renderFormInput("İsim", "name", "Ürün adı")}
              {renderFormInput("Açıklama", "description", "Ürün açıklaması")}
              {renderFormInput("Fiyat (₺)", "price", "45", "numeric")}
              {renderFormInput("Kategori", "category", "Espresso, Latte, vb.")}
              {renderFormInput("Boyutlar (virgülle)", "sizes", "Küçük, Orta, Büyük")}
              {renderFormInput("Görsel URL", "image_url", "https://...")}
              <View style={s.modalActions}><TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}><Text style={s.cancelBtnText}>İptal</Text></TouchableOpacity>
                <TouchableOpacity testID="confirm-add-menu" style={s.confirmBtn} onPress={addMenuItem}><Text style={s.confirmBtnText}>Ekle</Text></TouchableOpacity>
              </View>
            </View></View></Modal>
          </View>)}

          {/* CAMPAIGNS */}
          {section === 'campaigns' && (<View>
            <View style={s.sectionHeader}><Text style={s.sectionTitle}>Kampanyalar</Text>
              <TouchableOpacity testID="add-campaign-btn" style={s.addButton} onPress={() => { setFormData({ discount_type: 'percent' }); setShowForm(true); }}><Feather name="plus" size={18} color="#FFF" /><Text style={s.addButtonText}>Ekle</Text></TouchableOpacity>
            </View>
            {campaigns.map((c) => (
              <View key={c.campaign_id} style={s.listCard}><View style={s.listCardMain}>
                <View style={{ flex: 1 }}><Text style={s.listCardTitle}>{c.title}</Text><Text style={s.listCardSub}>{c.description}</Text>
                  <Text style={[s.listCardSub, { color: '#27AE60' }]}>{c.discount_type === 'percent' ? `%${c.discount_value} indirim` : `₺${c.discount_value} indirim`}{c.active ? ' · Aktif' : ' · Pasif'}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteCampaign(c.campaign_id)}><Feather name="trash-2" size={18} color="#D32F2F" /></TouchableOpacity>
              </View></View>
            ))}
            <Modal visible={showForm} transparent animationType="slide"><View style={s.modalOverlay}><View style={s.modalContent}>
              <Text style={s.modalTitle}>Yeni Kampanya</Text>
              {renderFormInput("Başlık", "title", "Kampanya başlığı")}
              {renderFormInput("Açıklama", "description", "Kampanya detayı")}
              {renderFormInput("İndirim Değeri", "discount_value", "10", "numeric")}
              <View style={s.formGroup}><Text style={s.formLabel}>İndirim Türü</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['percent', 'fixed'].map((t) => (
                    <TouchableOpacity key={t} style={[s.typeChip, formData.discount_type === t && s.typeChipActive]} onPress={() => setFormData({ ...formData, discount_type: t })}>
                      <Text style={[s.typeChipText, formData.discount_type === t && s.typeChipTextActive]}>{t === 'percent' ? 'Yüzde (%)' : 'Sabit (₺)'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={s.modalActions}><TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}><Text style={s.cancelBtnText}>İptal</Text></TouchableOpacity>
                <TouchableOpacity testID="confirm-add-campaign" style={s.confirmBtn} onPress={addCampaign}><Text style={s.confirmBtnText}>Oluştur</Text></TouchableOpacity>
              </View>
            </View></View></Modal>
          </View>)}

          {/* NOTIFICATIONS */}
          {section === 'notifications' && (<View>
            <Text style={s.sectionTitle}>Toplu Bildirim Gönder</Text>
            <View style={s.notifCard}>
              <View style={s.formGroup}><Text style={s.formLabel}>Başlık</Text><TextInput testID="notif-title" style={s.formInput} placeholder="Bildirim başlığı" placeholderTextColor="#999" value={notifTitle} onChangeText={setNotifTitle} /></View>
              <View style={s.formGroup}><Text style={s.formLabel}>Mesaj</Text><TextInput testID="notif-body" style={[s.formInput, { height: 100, textAlignVertical: 'top' }]} placeholder="Tüm kullanıcılara gönderilecek mesaj..." placeholderTextColor="#999" value={notifBody} onChangeText={setNotifBody} multiline /></View>
              <TouchableOpacity testID="send-notif-btn" style={s.sendBtn} activeOpacity={0.8} onPress={sendNotification} disabled={sendingNotif}>
                {sendingNotif ? <ActivityIndicator color="#FFF" /> : <><Feather name="send" size={18} color="#FFF" /><Text style={s.sendBtnText}>Tüm Kullanıcılara Gönder</Text></>}
              </TouchableOpacity>
            </View>
          </View>)}

          {/* SCANNER */}
          {section === 'scanner' && (<View>
            <Text style={s.sectionTitle}>QR Kod ile Otomatik Puan</Text>
            <View style={s.scanInfoCard}>
              <Feather name="shield" size={20} color="#27AE60" />
              <Text style={s.scanInfoText}>Sistem otomatik sabit puan ekler. Yetkili puan miktarını değiştiremez. (Her tarama: {scanSettings?.scan_points || 50} puan, Bekleme: {scanSettings?.cooldown_minutes || 120} dk)</Text>
            </View>
            {scanning && CameraView ? (
              <View style={s.scannerWrap}>
                <CameraView style={s.scanner} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={(result: any) => handleQRScan({ data: result.data })} />
                <TouchableOpacity style={s.scanCloseBtn} onPress={() => setScanning(false)}><Feather name="x" size={24} color="#FFF" /></TouchableOpacity>
              </View>
            ) : (
              <View style={s.scannerSection}>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity testID="start-scan-btn" style={s.scanButton} activeOpacity={0.8} onPress={() => setScanning(true)}>
                    <Feather name="camera" size={32} color="#800020" />
                    <Text style={s.scanButtonText}>QR Kod Tara</Text>
                    <Text style={s.scanButtonSub}>Müşterinin telefonundaki QR kodu okutun</Text>
                  </TouchableOpacity>
                )}
                {Platform.OS === 'web' && (
                  <View style={s.scanButton}>
                    <Feather name="smartphone" size={32} color="#800020" />
                    <Text style={s.scanButtonText}>QR Tarama</Text>
                    <Text style={s.scanButtonSub}>Kamera tarama mobil cihazda çalışır. Aşağıdan manuel ID girin.</Text>
                  </View>
                )}
                <Text style={s.orText}>veya manuel giriş</Text>
                <View style={s.formGroup}><Text style={s.formLabel}>Müşteri ID</Text>
                  <TextInput testID="manual-user-id" style={s.formInput} placeholder="user_xxxx" placeholderTextColor="#999" value={scannedUser} onChangeText={setScannedUser} /></View>
                <TouchableOpacity testID="auto-scan-btn" style={[s.confirmBtn, { width: '100%', flexDirection: 'row', gap: 8, justifyContent: 'center' }]} activeOpacity={0.8} onPress={() => autoAddPoints()} disabled={addingPoints}>
                  {addingPoints ? <ActivityIndicator color="#FFF" /> : <><Feather name="zap" size={18} color="#FFF" /><Text style={s.confirmBtnText}>Otomatik Puan Ekle</Text></>}
                </TouchableOpacity>

                {scanResult && (
                  <View style={[s.scanResultCard, { borderLeftColor: scanResult.success ? '#27AE60' : '#D32F2F' }]}>
                    <Feather name={scanResult.success ? 'check-circle' : 'alert-circle'} size={20} color={scanResult.success ? '#27AE60' : '#D32F2F'} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      {scanResult.success ? (
                        <>
                          <Text style={s.scanResultTitle}>{scanResult.user_name}</Text>
                          <Text style={s.scanResultSub}>+{scanResult.points_added} puan eklendi · Toplam: {scanResult.new_points} ({scanResult.tier})</Text>
                        </>
                      ) : (
                        <Text style={s.scanResultTitle}>{scanResult.message}</Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>)}

          {/* STORES */}
          {section === 'stores' && (<View>
            <View style={s.sectionHeader}><Text style={s.sectionTitle}>Şube Yönetimi</Text>
              <TouchableOpacity testID="add-store-btn" style={s.addButton} onPress={() => { setFormData({}); setShowForm(true); }}><Feather name="plus" size={18} color="#FFF" /><Text style={s.addButtonText}>Ekle</Text></TouchableOpacity>
            </View>
            {stores.map((st) => (
              <View key={st.store_id} style={s.listCard}><View style={s.listCardMain}>
                <View style={{ flex: 1 }}><Text style={s.listCardTitle}>{st.name}</Text><Text style={s.listCardSub}>{st.address}, {st.city}</Text><Text style={s.listCardSub}>{st.hours} · {st.phone}</Text></View>
                <TouchableOpacity onPress={() => deleteStore(st.store_id)}><Feather name="trash-2" size={18} color="#D32F2F" /></TouchableOpacity>
              </View></View>
            ))}
            <Modal visible={showForm} transparent animationType="slide"><View style={s.modalOverlay}><View style={s.modalContent}>
              <Text style={s.modalTitle}>Yeni Şube Ekle</Text>
              {renderFormInput("Şube Adı", "name", "Glob Coffee — Taksim")}
              {renderFormInput("Adres", "address", "İstiklal Cad. No:42")}
              {renderFormInput("Şehir", "city", "İstanbul")}
              {renderFormInput("Çalışma Saatleri", "hours", "08:00 - 22:00")}
              {renderFormInput("Telefon", "phone", "(212) 555-0505")}
              <View style={s.modalActions}><TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}><Text style={s.cancelBtnText}>İptal</Text></TouchableOpacity>
                <TouchableOpacity testID="confirm-add-store" style={s.confirmBtn} onPress={addStore}><Text style={s.confirmBtnText}>Ekle</Text></TouchableOpacity>
              </View>
            </View></View></Modal>
          </View>)}

          {/* MANAGERS */}
          {section === 'managers' && (<View>
            <View style={s.sectionHeader}><Text style={s.sectionTitle}>Şube Yetkilileri</Text>
              <TouchableOpacity testID="add-manager-btn" style={s.addButton} onPress={() => { setFormData({}); setShowForm(true); }}><Feather name="plus" size={18} color="#FFF" /><Text style={s.addButtonText}>Ekle</Text></TouchableOpacity>
            </View>
            {managers.length === 0 ? <Text style={s.emptyText}>Henüz yetkili eklenmemiş.</Text> :
              managers.map((m) => (
                <View key={m.admin_id} style={s.listCard}><View style={s.listCardMain}>
                  <View style={{ flex: 1 }}><Text style={s.listCardTitle}>{m.name}</Text><Text style={s.listCardSub}>{m.email}</Text><Text style={s.listCardSub}>Şube: {m.store_id || 'Atanmamış'}</Text></View>
                  <TouchableOpacity onPress={() => deleteManager(m.admin_id)}><Feather name="trash-2" size={18} color="#D32F2F" /></TouchableOpacity>
                </View></View>
              ))}
            <Modal visible={showForm} transparent animationType="slide"><View style={s.modalOverlay}><View style={s.modalContent}>
              <Text style={s.modalTitle}>Yeni Yetkili Oluştur</Text>
              {renderFormInput("İsim Soyisim", "name", "Ahmet Yılmaz")}
              {renderFormInput("Email", "email", "ahmet@globcoffee.com")}
              {renderFormInput("Şifre", "password", "••••••••")}
              {renderFormInput("Şube ID (opsiyonel)", "store_id", "store_001")}
              <View style={s.modalActions}><TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}><Text style={s.cancelBtnText}>İptal</Text></TouchableOpacity>
                <TouchableOpacity testID="confirm-add-manager" style={s.confirmBtn} onPress={addManager}><Text style={s.confirmBtnText}>Oluştur</Text></TouchableOpacity>
              </View>
            </View></View></Modal>
          </View>)}

          {/* ORDERS */}
          {section === 'orders' && (<View>
            <Text style={s.sectionTitle}>Sipariş Yönetimi</Text>
            {orders.length === 0 ? <Text style={s.emptyText}>Henüz sipariş yok.</Text> :
              orders.map((o) => (
                <View key={o.order_id} style={s.listCard}>
                  <View style={s.listCardMain}><View style={{ flex: 1 }}>
                    <Text style={s.listCardTitle}>#{o.order_id.slice(-6)}</Text>
                    <Text style={s.listCardSub}>{o.store_name} · {o.items.length} ürün · ₺{o.total}</Text>
                    <Text style={s.listCardSub}>{new Date(o.created_at).toLocaleString('tr-TR')}</Text>
                  </View></View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {statusOptions.map((st) => (
                      <TouchableOpacity key={st.value} testID={`status-${o.order_id}-${st.value}`} style={[s.statusChip, o.status === st.value && { backgroundColor: st.color + '15', borderColor: st.color }]}
                        onPress={() => updateOrderStatus(o.order_id, st.value)}>
                        <Text style={[s.statusChipText, o.status === st.value && { color: st.color }]}>{st.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ))}
          </View>)}

          {/* REWARDS */}
          {section === 'rewards' && (<View>
            <View style={s.sectionHeader}><Text style={s.sectionTitle}>Ödül Yönetimi</Text>
              <TouchableOpacity testID="add-reward-btn" style={s.addButton} onPress={() => { setFormData({}); setShowForm(true); }}><Feather name="plus" size={18} color="#FFF" /><Text style={s.addButtonText}>Ekle</Text></TouchableOpacity>
            </View>
            {rewards.map((r) => (
              <View key={r.reward_id} style={s.listCard}><View style={s.listCardMain}>
                <View style={{ flex: 1 }}><Text style={s.listCardTitle}>{r.name}</Text><Text style={s.listCardSub}>{r.description} · {r.points_required} puan</Text></View>
                <TouchableOpacity onPress={() => deleteReward(r.reward_id)}><Feather name="trash-2" size={18} color="#D32F2F" /></TouchableOpacity>
              </View></View>
            ))}
            <Modal visible={showForm} transparent animationType="slide"><View style={s.modalOverlay}><View style={s.modalContent}>
              <Text style={s.modalTitle}>Yeni Ödül Ekle</Text>
              {renderFormInput("Ödül Adı", "name", "Ücretsiz Latte")}
              {renderFormInput("Açıklama", "description", "Bir adet latte hediye")}
              {renderFormInput("Gerekli Puan", "points_required", "200", "numeric")}
              {renderFormInput("Kategori", "category", "İçecek, Yiyecek, vb.")}
              <View style={s.modalActions}><TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}><Text style={s.cancelBtnText}>İptal</Text></TouchableOpacity>
                <TouchableOpacity testID="confirm-add-reward" style={s.confirmBtn} onPress={addReward}><Text style={s.confirmBtnText}>Ekle</Text></TouchableOpacity>
              </View>
            </View></View></Modal>
          </View>)}

          {/* WHEEL PRIZES */}
          {section === 'wheel' && (<View>
            <View style={s.sectionHeader}><Text style={s.sectionTitle}>Çark Ödülleri</Text>
              <TouchableOpacity testID="add-wheel-btn" style={s.addButton} onPress={() => { setFormData({ type: 'points', color: '#800020' }); setShowForm(true); }}><Feather name="plus" size={18} color="#FFF" /><Text style={s.addButtonText}>Ekle</Text></TouchableOpacity>
            </View>
            {wheelPrizes.length === 0 ? <Text style={s.emptyText}>Henüz çark ödülü eklenmemiş.</Text> :
              wheelPrizes.map((p) => (
                <View key={p.prize_id} style={s.listCard}><View style={s.listCardMain}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.color || '#800020', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{p.type === 'points' ? 'P' : '🎁'}</Text>
                    </View>
                    <View style={{ flex: 1 }}><Text style={s.listCardTitle}>{p.label}</Text>
                      <Text style={s.listCardSub}>Tür: {p.type === 'points' ? 'Puan' : p.type === 'free_drink' ? 'Ücretsiz İçecek' : p.type} · Değer: {p.value} · Olasılık: %{p.probability}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => deleteWheelPrize(p.prize_id)}><Feather name="trash-2" size={18} color="#D32F2F" /></TouchableOpacity>
                </View></View>
              ))}
            <Modal visible={showForm} transparent animationType="slide"><View style={s.modalOverlay}><View style={s.modalContent}>
              <Text style={s.modalTitle}>Yeni Çark Ödülü</Text>
              {renderFormInput("Ödül Adı", "label", "25 Puan")}
              <View style={s.formGroup}><Text style={s.formLabel}>Ödül Türü</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[{ key: 'points', label: 'Puan' }, { key: 'free_drink', label: 'Ücretsiz İçecek' }, { key: 'discount', label: 'İndirim' }].map((t) => (
                    <TouchableOpacity key={t.key} style={[s.typeChip, formData.type === t.key && s.typeChipActive]} onPress={() => setFormData({ ...formData, type: t.key })}>
                      <Text style={[s.typeChipText, formData.type === t.key && s.typeChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {renderFormInput("Değer", "value", "25", "numeric")}
              {renderFormInput("Olasılık (%)", "probability", "15", "numeric")}
              {renderFormInput("Renk (HEX)", "color", "#800020")}
              <View style={s.modalActions}><TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}><Text style={s.cancelBtnText}>İptal</Text></TouchableOpacity>
                <TouchableOpacity testID="confirm-add-wheel" style={s.confirmBtn} onPress={addWheelPrize}><Text style={s.confirmBtnText}>Ekle</Text></TouchableOpacity>
              </View>
            </View></View></Modal>
          </View>)}

          {/* USERS */}
          {section === 'users' && (<View>
            <Text style={s.sectionTitle}>Müşteriler ({users.length})</Text>
            {users.map((u) => (
              <View key={u.user_id} style={s.listCard}><View style={s.listCardMain}><View style={{ flex: 1 }}>
                <Text style={s.listCardTitle}>{u.name}</Text><Text style={s.listCardSub}>{u.email}</Text>
                <Text style={s.listCardSub}>{u.points} puan · {u.tier}</Text>
              </View></View></View>
            ))}
          </View>)}

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Admin link on welcome */}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F1' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#231F20' },
  adminLabel: { fontSize: 10, color: 'rgba(249,245,241,0.5)', fontWeight: '700', letterSpacing: 1 },
  adminName: { fontSize: 18, fontWeight: '700', color: '#F9F5F1' },
  navWrap: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E0DB' },
  navScroll: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  navItem: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 4, flexDirection: 'row', alignItems: 'center' },
  navLabel: { fontSize: 11, fontWeight: '600', color: '#8A8A8A', marginLeft: 4 },
  contentPad: { padding: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#231F20', marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, elevation: 1 },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#231F20' },
  statLabel: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#800020', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  addButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  listCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 1 },
  listCardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listCardTitle: { fontSize: 15, fontWeight: '600', color: '#231F20' },
  listCardSub: { fontSize: 13, color: '#8A8A8A', marginTop: 2 },
  emptyText: { fontSize: 14, color: '#8A8A8A', textAlign: 'center', paddingVertical: 32 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#231F20', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E0DB', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#5C5C5C' },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#800020', alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  // Forms
  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#8A8A8A', letterSpacing: 0.5, marginBottom: 6 },
  formInput: { backgroundColor: '#F5F0EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#231F20', borderWidth: 1, borderColor: '#E5E0DB' },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E0DB', alignItems: 'center' },
  typeChipActive: { backgroundColor: '#231F20', borderColor: '#231F20' },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#5C5C5C' },
  typeChipTextActive: { color: '#F9F5F1' },
  // Notifications
  notifCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 1 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1976D2', paddingVertical: 16, borderRadius: 12 },
  sendBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  // Scanner
  scannerWrap: { height: 300, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  scanner: { flex: 1 },
  scanCloseBtn: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  scannerSection: { alignItems: 'center' },
  scanButton: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 32, alignItems: 'center', elevation: 2, borderWidth: 2, borderColor: '#800020', borderStyle: 'dashed', marginBottom: 16 },
  scanButtonText: { fontSize: 18, fontWeight: '700', color: '#231F20', marginTop: 12 },
  scanButtonSub: { fontSize: 13, color: '#8A8A8A', marginTop: 4 },
  orText: { fontSize: 14, color: '#8A8A8A', marginVertical: 12 },
  scanInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14, marginBottom: 16, gap: 10 },
  scanInfoText: { flex: 1, fontSize: 13, color: '#2E7D32', lineHeight: 18 },
  scanResultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginTop: 16, borderLeftWidth: 4, elevation: 1 },
  scanResultTitle: { fontSize: 15, fontWeight: '700', color: '#231F20' },
  scanResultSub: { fontSize: 13, color: '#8A8A8A', marginTop: 2 },
  // Status chips
  statusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E5E0DB', marginRight: 6 },
  statusChipText: { fontSize: 12, fontWeight: '600', color: '#8A8A8A' },
});

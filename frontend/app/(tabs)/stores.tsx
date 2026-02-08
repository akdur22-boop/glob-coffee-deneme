import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function StoresScreen() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stores`);
      if (res.ok) setStores(await res.json());
    } catch (e) {
      console.log('Stores error', e);
    } finally {
      setLoading(false);
    }
  };

  const openMaps = (store: any) => {
    const url = `https://maps.google.com/?q=${store.lat},${store.lng}`;
    Linking.openURL(url);
  };

  const callStore = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
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
        <Text style={styles.title}>Our Stores</Text>
        <Text style={styles.subtitle}>{stores.length} locations</Text>
      </View>

      <FlatList
        data={stores}
        keyExtractor={(item) => item.store_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.storeCard}>
            <Image source={{ uri: item.image_url }} style={styles.storeImage} resizeMode="cover" />
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{item.name}</Text>
              <View style={styles.infoRow}>
                <Feather name="map-pin" size={14} color="#8A8A8A" />
                <Text style={styles.infoText}>{item.address}, {item.city}</Text>
              </View>
              <View style={styles.infoRow}>
                <Feather name="clock" size={14} color="#8A8A8A" />
                <Text style={styles.infoText}>{item.hours}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  testID={`directions-${item.store_id}`}
                  style={styles.dirBtn}
                  activeOpacity={0.8}
                  onPress={() => openMaps(item)}
                >
                  <Feather name="navigation" size={16} color="#F9F5F1" />
                  <Text style={styles.dirBtnText}>Directions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`call-${item.store_id}`}
                  style={styles.callBtn}
                  activeOpacity={0.8}
                  onPress={() => callStore(item.phone)}
                >
                  <Feather name="phone" size={16} color="#231F20" />
                  <Text style={styles.callBtnText}>Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F1' },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#231F20' },
  subtitle: { fontSize: 14, color: '#8A8A8A', marginTop: 4 },

  listContent: { paddingHorizontal: 24, paddingBottom: 100 },
  storeCard: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  storeImage: { width: '100%', height: 160 },
  storeInfo: { padding: 20 },
  storeName: { fontSize: 18, fontWeight: '700', color: '#231F20', marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  infoText: { fontSize: 14, color: '#5C5C5C', marginLeft: 8 },
  actions: { flexDirection: 'row', marginTop: 14, gap: 12 },
  dirBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#231F20', paddingVertical: 12, borderRadius: 12 },
  dirBtnText: { color: '#F9F5F1', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EAE4', paddingVertical: 12, borderRadius: 12 },
  callBtnText: { color: '#231F20', fontSize: 14, fontWeight: '600', marginLeft: 8 },
});

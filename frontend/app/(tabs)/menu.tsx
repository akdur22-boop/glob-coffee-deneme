import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function MenuScreen() {
  const router = useRouter();
  const { cart } = useApp();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      const res = await fetch(`${API_URL}/api/menu`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        const cats = ['All', ...new Set(data.map((i: any) => i.category))] as string[];
        setCategories(cats);
      }
    } catch (e) {
      console.log('Menu error', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = selectedCat === 'All' ? items : items.filter((i) => i.category === selectedCat);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      testID={`menu-item-${item.item_id}`}
      style={styles.itemCard}
      activeOpacity={0.85}
      onPress={() => router.push(`/item/${item.item_id}`)}
    >
      <Image source={{ uri: item.image_url }} style={styles.itemImage} resizeMode="cover" />
      <View style={styles.itemInfo}>
        <View style={styles.itemTop}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          {item.popular && (
            <View style={styles.popularBadge}>
              <Feather name="trending-up" size={10} color="#E67E22" />
              <Text style={styles.popularText}>Popular</Text>
            </View>
          )}
        </View>
        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.itemBottom}>
          <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
          <TouchableOpacity
            testID={`add-${item.item_id}`}
            style={styles.addBtn}
            activeOpacity={0.8}
            onPress={() => router.push(`/item/${item.item_id}`)}
          >
            <Feather name="plus" size={18} color="#F9F5F1" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#E67E22" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <TouchableOpacity testID="menu-cart-btn" style={styles.cartBtn} activeOpacity={0.8} onPress={() => router.push('/cart')}>
          <Feather name="shopping-bag" size={22} color="#231F20" />
          {cart.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cart.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <FlatList
        horizontal
        data={categories}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catScroll}
        keyExtractor={(item) => item}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            testID={`cat-${cat}`}
            style={[styles.catChip, selectedCat === cat && styles.catChipActive]}
            onPress={() => setSelectedCat(cat)}
            activeOpacity={0.8}
          >
            <Text style={[styles.catText, selectedCat === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Items */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.item_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F1' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#231F20' },
  cartBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cartBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#E67E22', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  catScroll: { paddingHorizontal: 24, marginBottom: 16 },
  catChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, backgroundColor: '#FFFFFF', marginRight: 10, borderWidth: 1, borderColor: '#E5E0DB' },
  catChipActive: { backgroundColor: '#231F20', borderColor: '#231F20' },
  catText: { fontSize: 14, fontWeight: '600', color: '#5C5C5C' },
  catTextActive: { color: '#F9F5F1' },

  listContent: { paddingHorizontal: 24, paddingBottom: 100 },
  itemCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  itemImage: { width: 110, height: 120 },
  itemInfo: { flex: 1, padding: 14, justifyContent: 'space-between' },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemName: { fontSize: 16, fontWeight: '600', color: '#231F20', flex: 1 },
  popularBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF0E1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
  popularText: { fontSize: 10, fontWeight: '600', color: '#E67E22', marginLeft: 3 },
  itemDesc: { fontSize: 13, color: '#8A8A8A', lineHeight: 18, marginTop: 4 },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  itemPrice: { fontSize: 18, fontWeight: '700', color: '#E67E22' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#231F20', justifyContent: 'center', alignItems: 'center' },
});

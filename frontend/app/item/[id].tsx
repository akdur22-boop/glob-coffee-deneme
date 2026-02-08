import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToCart } = useApp();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    loadItem();
  }, [id]);

  const loadItem = async () => {
    try {
      const res = await fetch(`${API_URL}/api/menu/${id}`);
      if (res.ok) {
        const data = await res.json();
        setItem(data);
        if (data.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
        }
      }
    } catch (e) {
      console.log('Item error', e);
    } finally {
      setLoading(false);
    }
  };

  const sizePrice = () => {
    if (!item) return 0;
    const base = item.price;
    if (selectedSize === 'Large') return base + 1.0;
    if (selectedSize === 'Medium') return base + 0.5;
    if (selectedSize === 'Double') return base + 1.5;
    return base;
  };

  const handleAddToCart = () => {
    if (!item) return;
    addToCart({
      item_id: item.item_id,
      name: item.name,
      size: selectedSize || 'Regular',
      quantity,
      price: sizePrice(),
      image_url: item.image_url,
    });
    Alert.alert('Added to Cart', `${quantity}x ${item.name} (${selectedSize || 'Regular'})`, [
      { text: 'Continue Shopping', onPress: () => router.back() },
      { text: 'View Cart', onPress: () => router.push('/cart') },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#E67E22" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={{ color: '#8A8A8A' }}>Item not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={styles.imageWrap}>
          <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
          <TouchableOpacity testID="item-back-btn" style={styles.backBtn} activeOpacity={0.8} onPress={() => router.back()}>
            <Feather name="x" size={22} color="#231F20" />
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.content}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDesc}>{item.description}</Text>

          {/* Sizes */}
          {item.sizes && item.sizes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SIZE</Text>
              <View style={styles.sizeRow}>
                {item.sizes.map((size: string) => (
                  <TouchableOpacity
                    key={size}
                    testID={`size-${size}`}
                    style={[styles.sizeChip, selectedSize === size && styles.sizeChipActive]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedSize(size)}
                  >
                    <Text style={[styles.sizeText, selectedSize === size && styles.sizeTextActive]}>{size}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Quantity */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>QUANTITY</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                testID="qty-minus"
                style={styles.qtyBtn}
                activeOpacity={0.8}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Feather name="minus" size={18} color="#231F20" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                testID="qty-plus"
                style={styles.qtyBtn}
                activeOpacity={0.8}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Feather name="plus" size={18} color="#231F20" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.priceWrap}>
          <Text style={styles.priceLabel}>Total</Text>
          <Text style={styles.priceValue}>${(sizePrice() * quantity).toFixed(2)}</Text>
        </View>
        <TouchableOpacity testID="add-to-cart-btn" style={styles.addBtn} activeOpacity={0.8} onPress={handleAddToCart}>
          <Feather name="shopping-bag" size={18} color="#F9F5F1" />
          <Text style={styles.addBtnText}>Add to Cart</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F1' },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 320 },
  backBtn: { position: 'absolute', top: 52, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },

  content: { padding: 24 },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: '#FEF0E1', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  categoryText: { fontSize: 12, fontWeight: '600', color: '#E67E22', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemName: { fontSize: 28, fontWeight: '700', color: '#231F20', marginBottom: 8 },
  itemDesc: { fontSize: 16, color: '#5C5C5C', lineHeight: 24, marginBottom: 24 },

  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#8A8A8A', letterSpacing: 1, marginBottom: 12 },
  sizeRow: { flexDirection: 'row', gap: 12 },
  sizeChip: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E0DB', alignItems: 'center' },
  sizeChipActive: { borderColor: '#231F20', backgroundColor: '#231F20' },
  sizeText: { fontSize: 14, fontWeight: '600', color: '#5C5C5C' },
  sizeTextActive: { color: '#F9F5F1' },

  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E0DB', justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 20, fontWeight: '700', color: '#231F20', marginHorizontal: 24 },

  bottomBar: { backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#E5E0DB' },
  priceWrap: {},
  priceLabel: { fontSize: 12, color: '#8A8A8A' },
  priceValue: { fontSize: 24, fontWeight: '800', color: '#231F20' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E67E22', paddingHorizontal: 28, paddingVertical: 16, borderRadius: 9999 },
  addBtnText: { color: '#F9F5F1', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});

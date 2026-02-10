import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function CartScreen() {
  const router = useRouter();
  const { cart = [], removeFromCart, clearCart, cartTotal, sessionToken, authHeaders, fetchUser } = useApp();
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [ordering, setOrdering] = useState(false);
  const [showStores, setShowStores] = useState(false);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stores`);
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        if (data.length > 0) setSelectedStore(data[0]);
      }
    } catch (e) {
      console.log('Stores error', e);
    }
  };

  const placeOrder = async () => {
    if (!sessionToken) {
      Alert.alert('Sign In Required', 'Please sign in to place an order.', [
        { text: 'Cancel' },
        { text: 'Sign In', onPress: () => router.replace('/') },
      ]);
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add some items first!');
      return;
    }
    if (!selectedStore) {
      Alert.alert('Select Store', 'Please select a pickup store.');
      return;
    }
    setOrdering(true);
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          items: cart.map((c) => ({ item_id: c.item_id, name: c.name, size: c.size, quantity: c.quantity, price: c.price })),
          store_id: selectedStore.store_id,
          store_name: selectedStore.name,
          total: cartTotal,
        }),
      });
      if (res.ok) {
        const order = await res.json();
        clearCart();
        await fetchUser();
        router.replace({ pathname: '/order-confirmation', params: { orderId: order.order_id, pointsEarned: String(order.points_earned), storeName: selectedStore.name, total: String(cartTotal) } });
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Failed to place order');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setOrdering(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="cart-back-btn" onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={24} color="#231F20" />
        </TouchableOpacity>
        <Text style={styles.title}>Your Cart</Text>
        {cart.length > 0 && (
          <TouchableOpacity testID="clear-cart-btn" onPress={() => { Alert.alert('Clear Cart', 'Remove all items?', [{ text: 'Cancel' }, { text: 'Clear', style: 'destructive', onPress: clearCart }]); }} activeOpacity={0.8}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Feather name="shopping-bag" size={48} color="#E5E0DB" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyDesc}>Browse our menu and add your favorite drinks.</Text>
          <TouchableOpacity testID="browse-menu-btn" style={styles.browseBtn} activeOpacity={0.8} onPress={() => router.push('/(tabs)/menu')}>
            <Text style={styles.browseBtnText}>Browse Menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={(_, i) => String(i)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <View style={styles.cartItem}>
                <Image source={{ uri: item.image_url }} style={styles.cartImage} resizeMode="cover" />
                <View style={styles.cartInfo}>
                  <Text style={styles.cartName}>{item.name}</Text>
                  <Text style={styles.cartSize}>{item.size} · Qty: {item.quantity}</Text>
                  <Text style={styles.cartPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                </View>
                <TouchableOpacity testID={`remove-item-${index}`} style={styles.removeBtn} activeOpacity={0.8} onPress={() => removeFromCart(index)}>
                  <Feather name="trash-2" size={16} color="#D32F2F" />
                </TouchableOpacity>
              </View>
            )}
            ListFooterComponent={() => (
              <View>
                {/* Store Selection */}
                <Text style={styles.pickupLabel}>PICKUP STORE</Text>
                <TouchableOpacity
                  testID="select-store-btn"
                  style={styles.storeSelector}
                  activeOpacity={0.8}
                  onPress={() => setShowStores(!showStores)}
                >
                  <View style={styles.storeSelectorLeft}>
                    <Feather name="map-pin" size={18} color="#E67E22" />
                    <Text style={styles.storeSelectorText}>{selectedStore?.name || 'Select a store'}</Text>
                  </View>
                  <Feather name={showStores ? 'chevron-up' : 'chevron-down'} size={18} color="#8A8A8A" />
                </TouchableOpacity>

                {showStores && stores.map((store) => (
                  <TouchableOpacity
                    key={store.store_id}
                    testID={`store-option-${store.store_id}`}
                    style={[styles.storeOption, selectedStore?.store_id === store.store_id && styles.storeOptionActive]}
                    activeOpacity={0.8}
                    onPress={() => { setSelectedStore(store); setShowStores(false); }}
                  >
                    <Text style={styles.storeOptionName}>{store.name}</Text>
                    <Text style={styles.storeOptionAddr}>{store.address}</Text>
                  </TouchableOpacity>
                ))}

                {/* Summary */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>${cartTotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Points to Earn</Text>
                    <Text style={[styles.summaryValue, { color: '#27AE60' }]}>+{Math.floor(cartTotal * 10)} pts</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>${cartTotal.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            )}
          />

          {/* Order Button */}
          <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
            <TouchableOpacity testID="place-order-btn" style={styles.orderBtn} activeOpacity={0.8} onPress={placeOrder} disabled={ordering}>
              {ordering ? (
                <ActivityIndicator color="#F9F5F1" />
              ) : (
                <>
                  <Text style={styles.orderBtnText}>Place Order</Text>
                  <Text style={styles.orderBtnPrice}>${cartTotal.toFixed(2)}</Text>
                </>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#231F20' },
  clearText: { fontSize: 14, fontWeight: '600', color: '#D32F2F' },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 48 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F0EAE4', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#231F20', marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: '#8A8A8A', textAlign: 'center', marginBottom: 32 },
  browseBtn: { backgroundColor: '#E67E22', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 9999 },
  browseBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  listContent: { paddingHorizontal: 24, paddingBottom: 24 },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cartImage: { width: 64, height: 64, borderRadius: 12 },
  cartInfo: { flex: 1, marginLeft: 14 },
  cartName: { fontSize: 15, fontWeight: '600', color: '#231F20' },
  cartSize: { fontSize: 13, color: '#8A8A8A', marginTop: 2 },
  cartPrice: { fontSize: 16, fontWeight: '700', color: '#E67E22', marginTop: 4 },
  removeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDE8E8', justifyContent: 'center', alignItems: 'center' },

  pickupLabel: { fontSize: 12, fontWeight: '700', color: '#8A8A8A', letterSpacing: 1, marginTop: 16, marginBottom: 10 },
  storeSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E0DB' },
  storeSelectorLeft: { flexDirection: 'row', alignItems: 'center' },
  storeSelectorText: { fontSize: 15, fontWeight: '500', color: '#231F20', marginLeft: 10 },
  storeOption: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#E5E0DB' },
  storeOptionActive: { borderColor: '#E67E22', backgroundColor: '#FEF0E1' },
  storeOptionName: { fontSize: 14, fontWeight: '600', color: '#231F20' },
  storeOptionAddr: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },

  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginTop: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: '#8A8A8A' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#231F20' },
  divider: { height: 1, backgroundColor: '#E5E0DB', marginVertical: 10 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#231F20' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#231F20' },

  bottomBar: { backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#E5E0DB' },
  orderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E67E22', paddingVertical: 18, borderRadius: 9999 },
  orderBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  orderBtnPrice: { color: 'rgba(255,255,255,0.8)', fontSize: 17, fontWeight: '600', marginLeft: 8 },
});

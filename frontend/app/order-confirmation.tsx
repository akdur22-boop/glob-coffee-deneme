import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function OrderConfirmationScreen() {
  const router = useRouter();
  const { orderId, pointsEarned, storeName, total } = useLocalSearchParams<{
    orderId: string;
    pointsEarned: string;
    storeName: string;
    total: string;
  }>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.successCircle}>
          <View style={styles.successInner}>
            <Feather name="check" size={48} color="#FFFFFF" />
          </View>
        </View>

        <Text style={styles.title}>Order Confirmed!</Text>
        <Text style={styles.orderId}>#{orderId?.slice(-8)?.toUpperCase()}</Text>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Feather name="map-pin" size={18} color="#E67E22" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Pickup at</Text>
              <Text style={styles.detailValue}>{storeName}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Feather name="clock" size={18} color="#E67E22" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Estimated Time</Text>
              <Text style={styles.detailValue}>10-15 minutes</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Feather name="dollar-sign" size={18} color="#E67E22" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Total</Text>
              <Text style={styles.detailValue}>${parseFloat(total || '0').toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Points Earned */}
        <View style={styles.pointsBanner}>
          <Feather name="star" size={20} color="#E67E22" />
          <Text style={styles.pointsText}>You earned <Text style={styles.pointsBold}>+{pointsEarned} points</Text> with this order!</Text>
        </View>

        {/* Actions */}
        <TouchableOpacity
          testID="back-to-home-btn"
          style={styles.homeBtn}
          activeOpacity={0.8}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="view-orders-btn"
          style={styles.ordersBtn}
          activeOpacity={0.8}
          onPress={() => router.replace('/(tabs)/profile')}
        >
          <Text style={styles.ordersBtnText}>View My Orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F1' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },

  successCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(39,174,96,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  successInner: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#27AE60', justifyContent: 'center', alignItems: 'center' },

  title: { fontSize: 28, fontWeight: '800', color: '#231F20', marginBottom: 8 },
  orderId: { fontSize: 16, color: '#8A8A8A', fontWeight: '600', letterSpacing: 1, marginBottom: 32 },

  detailsCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailText: { marginLeft: 14 },
  detailLabel: { fontSize: 12, color: '#8A8A8A' },
  detailValue: { fontSize: 16, fontWeight: '600', color: '#231F20', marginTop: 2 },
  detailDivider: { height: 1, backgroundColor: '#F0EAE4', marginVertical: 14 },

  pointsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF0E1', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 32 },
  pointsText: { fontSize: 14, color: '#5C5C5C', marginLeft: 10 },
  pointsBold: { fontWeight: '700', color: '#E67E22' },

  homeBtn: { width: '100%', backgroundColor: '#231F20', paddingVertical: 18, borderRadius: 9999, alignItems: 'center', marginBottom: 12 },
  homeBtnText: { color: '#F9F5F1', fontSize: 16, fontWeight: '700' },
  ordersBtn: { width: '100%', borderWidth: 1.5, borderColor: '#E5E0DB', paddingVertical: 16, borderRadius: 9999, alignItems: 'center' },
  ordersBtnText: { color: '#5C5C5C', fontSize: 16, fontWeight: '600' },
});

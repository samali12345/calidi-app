import React, { useEffect, useState } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { ChevronLeft, Package } from 'lucide-react-native';

export default function AdminOrdersScreen() {
  const { token, isAdmin } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isAdmin && token) fetchOrders();
  }, [isAdmin, token]);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data.orders || []);
    } catch (e: any) {
      console.error('[Admin Orders] Error:', e.message);
      Alert.alert('Error', 'Failed to fetch admin orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await axios.put(`${API_BASE_URL}/admin/orders/${orderId}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchOrders();
    } catch (e: any) {
      console.error('[Update Status] Error:', e.response?.data || e.message);
      Alert.alert('Error', e.response?.data?.error || 'Failed to update order status');
    }
  };

  const showStatusMenu = (order: any) => {
    Alert.alert('Update Status', `Current status: ${order.status}`, [
      { text: 'Pending', onPress: () => updateStatus(order.orderId, 'pending') },
      { text: 'Paid', onPress: () => updateStatus(order.orderId, 'paid') },
      { text: 'Processing', onPress: () => updateStatus(order.orderId, 'processing') },
      { text: 'Shipped', onPress: () => updateStatus(order.orderId, 'shipped') },
      { text: 'Delivered', onPress: () => updateStatus(order.orderId, 'delivered') },
      { text: 'Refunded', onPress: () => updateStatus(order.orderId, 'refunded') },
      { text: 'Cancelled', onPress: () => updateStatus(order.orderId, 'cancelled'), style: 'destructive' },
      { text: 'Close', style: 'cancel' }
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#000" strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MANAGE ORDERS</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Package size={48} color="#DDD" strokeWidth={1} />
            <Text style={styles.emptyTitle}>No Orders Found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.orderCard} onPress={() => showStatusMenu(item)}>
            <View style={styles.orderTop}>
              <View>
                <Text style={styles.orderId}>#{item.orderId || item._id.slice(-8).toUpperCase()}</Text>
                <Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.customerText}>Customer: {item.shippingAddress?.fullName || 'Unknown'}</Text>
            <View style={styles.orderBottom}>
              <Text style={styles.orderTotal}>Rs. {item.total?.toLocaleString()}</Text>
              <Text style={styles.tapText}>Tap to update</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FAF9F6',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 16,
    color: '#000',
    letterSpacing: 2,
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyTitle: { marginTop: 16, fontSize: 16, color: '#888', fontFamily: 'CormorantGaramond_600SemiBold' },
  list: { padding: 16 },
  orderCard: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderId: { fontSize: 14, color: '#000', fontFamily: 'CormorantGaramond_700Bold' },
  orderDate: { fontSize: 12, color: '#888', fontFamily: 'CormorantGaramond_400Regular', marginTop: 2 },
  statusBadge: { backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { fontSize: 10, color: '#333', fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 1 },
  customerText: { fontSize: 13, color: '#555', fontFamily: 'CormorantGaramond_500Medium', marginBottom: 12 },
  orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 12 },
  orderTotal: { fontSize: 16, color: '#000', fontFamily: 'CormorantGaramond_700Bold' },
  tapText: { fontSize: 10, color: '#AAA', fontFamily: 'CormorantGaramond_400Regular' }
});

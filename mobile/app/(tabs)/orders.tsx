import React, { useEffect, useState } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, Platform
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { Package, ChevronRight, ShoppingBag, X } from 'lucide-react-native';

interface Order {
  _id: string;
  orderId: string; // The human-readable ID needed for refunds
  createdAt: string;
  status: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number }>;
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B',
  processing: '#3B82F6',
  shipped: '#8B5CF6',
  delivered: '#10B981',
  cancelled: '#EF4444',
};

export default function OrdersScreen() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user && token) fetchOrders();
    else if (!loading) setLoading(false);
  }, [user, token]);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/mobile/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      setOrders(response.data);
    } catch (e: any) {
      console.error('[Orders] Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleRefundPress = async (orderId: string) => {
    try {
      // Check if refund already exists using the human-readable orderId
      const res = await axios.get(`${API_BASE_URL}/refunds/status/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const statusMsg = `Your refund is currently: ${res.data.status.toUpperCase()}\n\nReason: ${res.data.reason}\n${res.data.adminComment ? `Admin: ${res.data.adminComment}` : ''}`;
      
      if (Platform.OS === 'web') {
        window.alert(statusMsg);
      } else {
        Alert.alert('Refund Status', statusMsg);
      }
    } catch (e: any) {
      if (e.response && e.response.status === 404) {
        // No refund requested yet, open modal
        setSelectedOrderId(orderId);
        setRefundReason('');
        setRefundModalVisible(true);
      } else {
        const errorMsg = 'Failed to check refund status';
        if (Platform.OS === 'web') window.alert(errorMsg);
        else Alert.alert('Error', errorMsg);
      }
    }
  };

  const submitRefund = async () => {
    if (!refundReason.trim()) {
      if (Platform.OS === 'web') window.alert('Please provide a reason');
      else Alert.alert('Error', 'Please provide a reason');
      return;
    }
    
    setRefundSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/refunds/request/${selectedOrderId}`, 
        { reason: refundReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (Platform.OS === 'web') {
        window.alert('Refund request submitted successfully');
      } else {
        Alert.alert('Success', 'Refund request submitted successfully');
      }
      setRefundModalVisible(false);
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || 'Failed to submit refund request';
      if (Platform.OS === 'web') window.alert(errorMsg);
      else Alert.alert('Error', errorMsg);
    } finally {
      setRefundSubmitting(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MY ORDERS</Text>
        </View>
        <View style={styles.center}>
          <ShoppingBag size={48} color="#DDD" strokeWidth={1} />
          <Text style={styles.emptyTitle}>Not Signed In</Text>
          <Text style={styles.emptySubtitle}>Sign in to view your order history</Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/profile')}>
            <Text style={styles.signInBtnText}>SIGN IN</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MY ORDERS</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MY ORDERS</Text>
        <Text style={styles.headerCount}>{orders.length} orders</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        contentContainerStyle={orders.length === 0 ? styles.emptyList : { padding: 16 }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Package size={48} color="#DDD" strokeWidth={1} />
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptySubtitle}>Start shopping to see your orders here</Text>
            <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/')}>
              <Text style={styles.signInBtnText}>BROWSE SHOP</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const statusColor = STATUS_COLOR[item.status] || '#888';
          const date = new Date(item.createdAt).toLocaleDateString('en-US', {
            day: 'numeric', month: 'short', year: 'numeric'
          });
          // Use orderId if available, fallback to shortened _id
          const displayId = item.orderId || `#${item._id.slice(-8).toUpperCase()}`;
          const rawId = item.orderId || item._id;

          return (
            <View style={styles.orderCard}>
              <View style={styles.orderTop}>
                <View>
                  <Text style={styles.orderId}>{displayId}</Text>
                  <Text style={styles.orderDate}>{date}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              {item.items.slice(0, 2).map((it, idx) => (
                <Text key={idx} style={styles.itemRow} numberOfLines={1}>
                  {it.quantity}× {it.name}
                </Text>
              ))}
              {item.items.length > 2 && (
                <Text style={styles.moreItems}>+{item.items.length - 2} more items</Text>
              )}
              <View style={styles.orderBottom}>
                <Text style={styles.orderTotal}>Rs. {item.total?.toLocaleString()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  {item.status !== 'pending' && item.status !== 'cancelled' && (
                    <TouchableOpacity onPress={() => handleRefundPress(rawId)} style={styles.refundBtn}>
                      <Text style={styles.refundBtnText}>REFUND</Text>
                    </TouchableOpacity>
                  )}
                  <ChevronRight size={18} color="#CCC" strokeWidth={1.5} />
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={refundModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>REQUEST REFUND</Text>
              <TouchableOpacity onPress={() => setRefundModalVisible(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Order {selectedOrderId}</Text>
            
            <TextInput
              style={styles.textInput}
              placeholder="Please provide a detailed reason for your refund..."
              multiline
              numberOfLines={4}
              value={refundReason}
              onChangeText={setRefundReason}
            />

            <TouchableOpacity 
              style={[styles.submitBtn, refundSubmitting && { opacity: 0.7 }]} 
              onPress={submitRefund}
              disabled={refundSubmitting}
            >
              {refundSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>SUBMIT REQUEST</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FAF9F6',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  headerTitle: {
    fontSize: 22,
    color: '#000',
    letterSpacing: 2,
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },
  headerCount: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'CormorantGaramond_400Regular',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyList: { flex: 1 },
  emptyTitle: {
    fontSize: 20,
    color: '#333',
    marginTop: 16,
    fontFamily: 'PlayfairDisplay_500Medium',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'CormorantGaramond_400Regular',
  },
  signInBtn: {
    backgroundColor: '#000',
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginTop: 20,
  },
  signInBtnText: {
    color: '#FFF',
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  orderCard: {
    backgroundColor: '#FFF',
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 0.5,
  },
  orderDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontFamily: 'CormorantGaramond_400Regular',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginBottom: 12 },
  itemRow: {
    fontSize: 13,
    color: '#555',
    fontFamily: 'CormorantGaramond_400Regular',
    marginBottom: 4,
  },
  moreItems: {
    fontSize: 12,
    color: '#AAA',
    fontFamily: 'CormorantGaramond_400Regular',
    marginTop: 2,
  },
  orderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  orderTotal: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  refundBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 4,
  },
  refundBtnText: {
    fontSize: 10,
    color: '#DC2626',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'CormorantGaramond_500Medium',
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 4,
    padding: 12,
    height: 100,
    textAlignVertical: 'top',
    fontFamily: 'CormorantGaramond_400Regular',
    fontSize: 14,
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: '#000',
    padding: 14,
    alignItems: 'center',
    borderRadius: 4,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
  },
});

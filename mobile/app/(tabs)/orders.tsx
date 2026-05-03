import React, { useEffect, useState } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, Platform, ScrollView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { Package, ChevronRight, ShoppingBag, X, Info, Image as ImageIcon, CheckCircle2 } from 'lucide-react-native';

interface Order {
  _id: string;
  orderId: string;
  createdAt: string;
  status: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  refundStatus?: string | null;
  refundReason?: string | null;
  adminComment?: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B',
  processing: '#3B82F6',
  shipped: '#8B5CF6',
  delivered: '#10B981',
  cancelled: '#EF4444',
};

const REFUND_STATUS_COLOR: Record<string, string> = {
  pending: '#D97706',
  approved: '#059669',
  rejected: '#DC2626',
};

const QUICK_REASONS = [
  'Damaged Product',
  'Wrong Size Sent',
  'Wrong Item Delivered',
  'Quality Not as Expected',
  'Missing Items',
  'Changed my Mind'
];

export default function OrdersScreen() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Refund Modal State
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [selectedReasonCat, setSelectedReasonCat] = useState('');
  const [imageUrl, setImageUrl] = useState('');
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

  const handleRefundPress = (order: Order) => {
    if (order.refundStatus) {
      const statusMsg = `Your refund is: ${order.refundStatus.toUpperCase()}\n\nReason: ${order.refundReason}\n${order.adminComment ? `Admin: ${order.adminComment}` : ''}`;
      if (Platform.OS === 'web') window.alert(statusMsg);
      else Alert.alert('Refund Status', statusMsg);
      return;
    }

    setSelectedOrderId(order.orderId);
    setRefundReason('');
    setSelectedReasonCat('');
    setImageUrl('');
    setRefundModalVisible(true);
  };

  const submitRefund = async () => {
    const finalReason = selectedReasonCat ? `[${selectedReasonCat}] ${refundReason}` : refundReason;
    
    if (!finalReason.trim()) {
      const msg = 'Please select a reason or provide a description';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
      return;
    }
    
    setRefundSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/refunds/request/${selectedOrderId}`, 
        { 
          reason: finalReason,
          reasonCategory: selectedReasonCat || 'Other',
          images: imageUrl ? [imageUrl] : []
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const successMsg = 'Refund request submitted successfully. Our team will review it within 24-48 hours.';
      if (Platform.OS === 'web') window.alert(successMsg);
      else Alert.alert('Success', successMsg);
      
      setRefundModalVisible(false);
      fetchOrders(); // Refresh list to show new status
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || e.message || 'Failed to submit refund request';
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
          const refundColor = item.refundStatus ? REFUND_STATUS_COLOR[item.refundStatus] : null;
          const date = new Date(item.createdAt).toLocaleDateString('en-US', {
            day: 'numeric', month: 'short', year: 'numeric'
          });
          const displayId = item.orderId || `#${item._id.slice(-8).toUpperCase()}`;

          return (
            <View style={styles.orderCard}>
              <View style={styles.orderTop}>
                <View>
                  <Text style={styles.orderId}>{displayId}</Text>
                  <Text style={styles.orderDate}>{date}</Text>
                </View>
                <View style={{ gap: 6, alignItems: 'flex-end' }}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                  {item.refundStatus && (
                    <View style={[styles.statusBadge, { backgroundColor: refundColor + '15', borderStyle: 'dashed', borderWidth: 0.5, borderColor: refundColor }]}>
                      <Text style={[styles.statusText, { color: refundColor, fontSize: 8 }]}>
                        REFUND: {item.refundStatus.toUpperCase()}
                      </Text>
                    </View>
                  )}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {item.status !== 'pending' && item.status !== 'cancelled' && (
                    <TouchableOpacity 
                      onPress={() => handleRefundPress(item)} 
                      style={[styles.refundBtn, item.refundStatus ? styles.refundRequestedBtn : null]}
                    >
                      <Text style={[styles.refundBtnText, item.refundStatus ? {color: '#888'} : null]}>
                        {item.refundStatus ? 'VIEW REFUND' : 'REQUEST REFUND'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <ChevronRight size={18} color="#CCC" strokeWidth={1.5} />
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={refundModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>RETURN & REFUND</Text>
              <TouchableOpacity onPress={() => setRefundModalVisible(false)} style={styles.closeBtn}>
                <X size={22} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Instructions */}
              <View style={styles.instructionCard}>
                <Info size={16} color="#3B82F6" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.instructionTitle}>How it works</Text>
                  <Text style={styles.instructionText}>
                    Select a reason, provide details, and attach proof. Our team will review your request and process the refund to your original payment method.
                  </Text>
                </View>
              </View>

              <Text style={styles.modalLabel}>SELECT REASON</Text>
              <View style={styles.reasonGrid}>
                {QUICK_REASONS.map(reason => (
                  <TouchableOpacity 
                    key={reason} 
                    style={[styles.reasonChip, selectedReasonCat === reason && styles.selectedChip]}
                    onPress={() => setSelectedReasonCat(reason)}
                  >
                    <Text style={[styles.reasonChipText, selectedReasonCat === reason && styles.selectedChipText]}>
                      {reason}
                    </Text>
                    {selectedReasonCat === reason && <CheckCircle2 size={12} color="#FFF" style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.modalLabel}>ADDITIONAL DETAILS</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Tell us more about the issue..."
                multiline
                numberOfLines={4}
                value={refundReason}
                onChangeText={setRefundReason}
              />

              <Text style={styles.modalLabel}>ATTACH PROOF (OPTIONAL)</Text>
              <View style={styles.imageInputRow}>
                <ImageIcon size={20} color="#AAA" />
                <TextInput
                  style={styles.imageUrlInput}
                  placeholder="Paste image URL here..."
                  value={imageUrl}
                  onChangeText={setImageUrl}
                />
              </View>
              <Text style={styles.imageHint}>Please provide a URL to an image showing the issue.</Text>

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
            </ScrollView>
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
    paddingVertical: 18,
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
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
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
    borderRadius: 2,
  },
  statusText: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  divider: { height: 1, backgroundColor: '#F8F8F8', marginBottom: 14 },
  itemRow: {
    fontSize: 13,
    color: '#555',
    fontFamily: 'CormorantGaramond_400Regular',
    marginBottom: 5,
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
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F8F8F8',
  },
  orderTotal: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  refundBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#000',
  },
  refundRequestedBtn: {
    borderColor: '#EEE',
    backgroundColor: '#FAFAFA',
  },
  refundBtnText: {
    fontSize: 10,
    color: '#000',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 1.5,
    color: '#000',
  },
  closeBtn: { padding: 4 },
  instructionCard: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  instructionTitle: { fontSize: 12, color: '#1E40AF', fontFamily: 'CormorantGaramond_700Bold', marginBottom: 4 },
  instructionText: { fontSize: 11, color: '#3B82F6', fontFamily: 'CormorantGaramond_400Regular', lineHeight: 16 },
  modalLabel: {
    fontSize: 10,
    color: '#888',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedChip: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  reasonChipText: { fontSize: 12, color: '#555', fontFamily: 'CormorantGaramond_500Medium' },
  selectedChipText: { color: '#FFF' },
  textInput: {
    borderWidth: 1,
    borderColor: '#EFEFEF',
    padding: 14,
    fontSize: 14,
    fontFamily: 'CormorantGaramond_500Medium',
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
    marginBottom: 20,
  },
  imageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
  },
  imageUrlInput: {
    flex: 1,
    padding: 12,
    fontSize: 13,
    fontFamily: 'CormorantGaramond_400Regular',
  },
  imageHint: { fontSize: 10, color: '#AAA', marginTop: 6, fontFamily: 'CormorantGaramond_400Regular', marginBottom: 24 },
  submitBtn: {
    backgroundColor: '#000',
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 2,
  },
});

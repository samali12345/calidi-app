import React, { useEffect, useState } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, Platform, ScrollView, Image
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { Package, ChevronRight, ShoppingBag, X, Info, Image as ImageIcon, CheckCircle2, Camera, Truck, Clock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

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
  refunded: '#6B7280',
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [selectedReasonCat, setSelectedReasonCat] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImageAndGetUrl = async (uri: string): Promise<string | null> => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'upload.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      // @ts-ignore
      formData.append('image', { uri, name: filename, type });

      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      });

      return response.data.url;
    } catch (e) {
      console.error('[Upload] Failed:', e);
      return null;
    }
  };

  const handleRefundPress = (order: Order) => {
    if (order.refundStatus) {
      const statusMsg = `Your refund is: ${order.refundStatus.toUpperCase()}\n\nReason: ${order.refundReason}\n${order.adminComment ? `Admin: ${order.adminComment}` : ''}`;
      if (Platform.OS === 'web') window.alert(statusMsg);
      else Alert.alert('Refund Status', statusMsg);
      return;
    }

    setSelectedOrder(order);
    setRefundReason('');
    setSelectedReasonCat('');
    setSelectedImage(null);
    setRefundModalVisible(true);
  };

  const submitRefund = async () => {
    if (!selectedOrder) return;
    const finalReason = selectedReasonCat ? `[${selectedReasonCat}] ${refundReason}` : refundReason;
    
    if (!finalReason.trim()) {
      const msg = 'Please select a reason or provide a description';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
      return;
    }
    
    setRefundSubmitting(true);
    let uploadedUrl = null;

    if (selectedImage) {
      setUploadingImage(true);
      uploadedUrl = await uploadImageAndGetUrl(selectedImage);
      setUploadingImage(false);
      
      if (!uploadedUrl) {
        setRefundSubmitting(false);
        const failMsg = 'Failed to upload image. Please try again.';
        if (Platform.OS === 'web') window.alert(failMsg);
        else Alert.alert('Error', failMsg);
        return;
      }
    }

    try {
      await axios.post(`${API_BASE_URL}/refunds/request/${selectedOrder.orderId}`, 
        { 
          reason: finalReason,
          reasonCategory: selectedReasonCat || 'Other',
          images: uploadedUrl ? [uploadedUrl] : []
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const successMsg = 'Refund request submitted successfully. Our team will review it within 24-48 hours.';
      if (Platform.OS === 'web') window.alert(successMsg);
      else Alert.alert('Success', successMsg);
      
      setRefundModalVisible(false);
      fetchOrders(); 
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
          
          // Calculate Refund Expiry
          const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
          const timeSinceOrder = Date.now() - new Date(item.createdAt).getTime();
          const timeLeft = sevenDaysInMs - timeSinceOrder;
          const isWithinWindow = timeLeft > 0;
          const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));

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
                  {item.status !== 'pending' && item.status !== 'cancelled' && item.status !== 'refunded' && (
                    <View style={{ alignItems: 'flex-end' }}>
                      {item.refundStatus ? (
                         <TouchableOpacity onPress={() => handleRefundPress(item)} style={[styles.refundBtn, styles.refundRequestedBtn]}>
                           <Text style={[styles.refundBtnText, {color: '#888'}]}>VIEW STATUS</Text>
                         </TouchableOpacity>
                      ) : isWithinWindow ? (
                        <>
                          <TouchableOpacity onPress={() => handleRefundPress(item)} style={styles.refundBtn}>
                            <Text style={styles.refundBtnText}>REQUEST REFUND</Text>
                          </TouchableOpacity>
                          <View style={styles.countdownRow}>
                            <Clock size={10} color="#F59E0B" />
                            <Text style={styles.countdownText}>
                              {daysLeft === 1 ? 'Ends today' : `${daysLeft} days left`}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <Text style={styles.expiredLabel}>Refund Window Closed</Text>
                      )}
                    </View>
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
              <View style={styles.instructionCard}>
                <Info size={16} color="#3B82F6" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.instructionTitle}>Important: 7-Day Policy</Text>
                  <Text style={styles.instructionText}>
                    Refunds are only available within 7 days of purchase. Please ensure all tags are intact.
                  </Text>
                </View>
              </View>

              {/* Return Process Info */}
              {(selectedOrder?.status === 'shipped' || selectedOrder?.status === 'delivered') && (
                <View style={styles.returnProcessCard}>
                  <Truck size={16} color="#059669" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.returnTitle}>Return Process (Dispatched)</Text>
                    <Text style={styles.returnText}>
                      Since your item has been dispatched, please return it to:
                      {"\n"}• CALIDI Boutique, No 45, Flower Road, Colombo 07.
                      {"\n"}• Include the original invoice.
                    </Text>
                  </View>
                </View>
              )}

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

              <Text style={styles.modalLabel}>ATTACH EVIDENCE PHOTO</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                {selectedImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                    <View style={styles.imageOverlay}>
                      <Camera size={20} color="#FFF" />
                      <Text style={styles.changePhotoText}>CHANGE PHOTO</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera size={32} color="#AAA" />
                    <Text style={styles.imagePlaceholderText}>TAP TO ATTACH PHOTO</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.submitBtn, (refundSubmitting || uploadingImage) && { opacity: 0.7 }]} 
                onPress={submitRefund}
                disabled={refundSubmitting || uploadingImage}
              >
                {refundSubmitting || uploadingImage ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.submitBtnText}>{uploadingImage ? 'UPLOADING...' : 'SUBMITTING...'}</Text>
                  </View>
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
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  countdownText: {
    fontSize: 9,
    color: '#F59E0B',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  expiredLabel: {
    fontSize: 10,
    color: '#AAA',
    fontFamily: 'CormorantGaramond_400Regular',
    fontStyle: 'italic',
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  instructionTitle: { fontSize: 12, color: '#1E40AF', fontFamily: 'CormorantGaramond_700Bold', marginBottom: 4 },
  instructionText: { fontSize: 11, color: '#3B82F6', fontFamily: 'CormorantGaramond_400Regular', lineHeight: 16 },
  returnProcessCard: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  returnTitle: { fontSize: 12, color: '#166534', fontFamily: 'CormorantGaramond_700Bold', marginBottom: 4 },
  returnText: { fontSize: 11, color: '#059669', fontFamily: 'CormorantGaramond_400Regular', lineHeight: 16 },
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
    marginBottom: 24,
  },
  imagePickerBtn: {
    width: '100%',
    height: 180,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
    gap: 12,
  },
  imagePlaceholderText: {
    fontSize: 10,
    color: '#AAA',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
  },
  imagePreviewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  changePhotoText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
  },
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

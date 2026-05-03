import React, { useEffect, useState } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { ChevronLeft, CheckCircle, XCircle, X } from 'lucide-react-native';

interface Refund {
  _id: string;
  orderId: string;
  userId: string;
  reason: string;
  amount: number;
  status: string;
  adminComment: string;
  createdAt: string;
}

export default function AdminRefundsScreen() {
  const { token, isAdmin } = useAuth();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Action Modal State
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [newStatus, setNewStatus] = useState<'approved' | 'rejected'>('approved');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    if (isAdmin && token) fetchRefunds();
    else if (!loading) setLoading(false);
  }, [isAdmin, token]);

  const fetchRefunds = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/refunds`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      setRefunds(response.data);
    } catch (e: any) {
      console.error('[Admin] Fetch refunds error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRefunds();
  };

  const openActionModal = (refund: Refund, status: 'approved' | 'rejected') => {
    setSelectedRefund(refund);
    setNewStatus(status);
    setComment('');
    setActionModalVisible(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedRefund) return;
    
    setSubmitting(true);
    try {
      await axios.put(
        `${API_BASE_URL}/admin/refunds/${selectedRefund._id}`,
        { status: newStatus, adminComment: comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (Platform.OS === 'web') {
        window.alert(`Refund ${newStatus} successfully`);
      } else {
        Alert.alert('Success', `Refund ${newStatus} successfully`);
      }
      
      setActionModalVisible(false);
      fetchRefunds();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to update refund';
      if (Platform.OS === 'web') window.alert(errorMsg);
      else Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Access Restricted</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MANAGE REFUNDS</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={refunds}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No refund requests found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>ORDER ID: {item.orderId.slice(-8).toUpperCase()}</Text>
              <View style={[styles.statusBadge, item.status === 'pending' ? styles.statusPending : item.status === 'approved' ? styles.statusApproved : styles.statusRejected]}>
                <Text style={[styles.statusText, item.status === 'pending' ? {color:'#D97706'} : item.status === 'approved' ? {color:'#059669'} : {color:'#DC2626'}]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>AMOUNT</Text>
              <Text style={styles.infoValue}>Rs. {item.amount.toLocaleString()}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>REASON</Text>
              <Text style={styles.infoValue}>{item.reason}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>DATE</Text>
              <Text style={styles.infoValue}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>

            {item.adminComment ? (
              <View style={styles.commentBox}>
                <Text style={styles.commentLabel}>ADMIN COMMENT</Text>
                <Text style={styles.commentText}>{item.adminComment}</Text>
              </View>
            ) : null}

            {item.status === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={[styles.btn, styles.approveBtn]} 
                  onPress={() => openActionModal(item, 'approved')}
                >
                  <CheckCircle size={14} color="#FFF" />
                  <Text style={styles.btnText}>APPROVE</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.btn, styles.rejectBtn]} 
                  onPress={() => openActionModal(item, 'rejected')}
                >
                  <XCircle size={14} color="#FFF" />
                  <Text style={styles.btnText}>REJECT</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />

      {/* ACTION MODAL */}
      <Modal visible={actionModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {newStatus === 'approved' ? 'APPROVE REFUND' : 'REJECT REFUND'}
              </Text>
              <TouchableOpacity onPress={() => setActionModalVisible(false)}>
                <X size={22} color="#000" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalLabel}>ADD ADMIN COMMENT (OPTIONAL)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="E.g. Approved after verifying return package..."
              multiline
              numberOfLines={3}
              value={comment}
              onChangeText={setComment}
            />

            <TouchableOpacity 
              style={[
                styles.submitBtn, 
                newStatus === 'approved' ? {backgroundColor:'#059669'} : {backgroundColor:'#DC2626'},
                submitting && { opacity: 0.7 }
              ]} 
              onPress={handleUpdateStatus}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>CONFIRM {newStatus.toUpperCase()}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FAF9F6',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'PlayfairDisplay_600SemiBold',
    letterSpacing: 2,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'CormorantGaramond_500Medium',
  },
  card: {
    backgroundColor: '#FFF',
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 9,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
  },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusApproved: { backgroundColor: '#D1FAE5' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 10, color: '#AAA', fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 1 },
  infoValue: { fontSize: 13, color: '#333', fontFamily: 'CormorantGaramond_500Medium', flex: 1, textAlign: 'right', marginLeft: 20 },
  commentBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F9F9F9',
    borderLeftWidth: 2,
    borderLeftColor: '#DDD',
  },
  commentLabel: { fontSize: 9, color: '#888', fontFamily: 'CormorantGaramond_700Bold', marginBottom: 4 },
  commentText: { fontSize: 12, color: '#555', fontFamily: 'CormorantGaramond_400Regular', fontStyle: 'italic' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  approveBtn: { backgroundColor: '#059669' },
  rejectBtn: { backgroundColor: '#DC2626' },
  btnText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    letterSpacing: 1,
  },
  modalLabel: {
    fontSize: 10,
    color: '#888',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#EFEFEF',
    padding: 12,
    fontSize: 14,
    fontFamily: 'CormorantGaramond_500Medium',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitBtn: {
    padding: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 2,
  },
});

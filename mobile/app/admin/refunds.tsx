import React, { useEffect, useState } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Image, ScrollView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { ChevronLeft, CheckCircle, XCircle, X, ExternalLink, Search, Filter, AlertCircle } from 'lucide-react-native';

interface Refund {
  _id: string;
  orderId: string;
  userId: string;
  reason: string;
  reasonCategory?: string;
  images?: string[];
  amount: number;
  status: string;
  adminComment: string;
  createdAt: string;
}

export default function AdminRefundsScreen() {
  const { token, isAdmin } = useAuth();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [filteredRefunds, setFilteredRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  
  // Action Modal State
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [newStatus, setNewStatus] = useState<'approved' | 'rejected'>('approved');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    if (token) fetchRefunds();
    else {
      setLoading(false);
      setError("No authentication token found. Please sign in.");
    }
  }, [token]);

  useEffect(() => {
    applyFilters();
  }, [refunds, searchQuery, statusFilter]);

  const fetchRefunds = async () => {
    try {
      setError(null);
      console.log('[Admin Refunds] Fetching from:', `${API_BASE_URL}/admin/refunds`);
      const response = await axios.get(`${API_BASE_URL}/admin/refunds`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      
      if (Array.isArray(response.data)) {
        setRefunds(response.data);
      } else {
        console.error('[Admin Refunds] Invalid data format:', response.data);
        setError("Received invalid data format from server.");
      }
    } catch (e: any) {
      console.error('[Admin] Fetch refunds error:', e.response?.data || e.message);
      const msg = e.response?.data?.error || e.message || 'Failed to fetch refunds';
      setError(`Server Error: ${msg}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let result = [...refunds];
    
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.orderId.toLowerCase().includes(q) || 
        r.reason.toLowerCase().includes(q) ||
        (r.reasonCategory && r.reasonCategory.toLowerCase().includes(q))
      );
    }
    
    setFilteredRefunds(result);
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
      
      const successMsg = `Refund ${newStatus} successfully`;
      if (Platform.OS === 'web') window.alert(successMsg);
      else Alert.alert('Success', successMsg);
      
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Loading requests...</Text>
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
        <Text style={styles.headerTitle}>REFUND MANAGER</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ERROR BANNER */}
      {error && (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchRefunds} style={styles.retryBtn}>
            <Text style={styles.retryText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SEARCH & FILTER BAR */}
      <View style={styles.filterBar}>
        <View style={styles.searchContainer}>
          <Search size={16} color="#AAA" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Order ID or Reason..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['all', 'pending', 'approved', 'rejected'].map((stat) => (
            <TouchableOpacity 
              key={stat}
              onPress={() => setStatusFilter(stat as any)}
              style={[styles.filterChip, statusFilter === stat && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, statusFilter === stat && styles.filterChipTextActive]}>
                {stat.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredRefunds}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Filter size={48} color="#EEE" strokeWidth={1} />
            <Text style={styles.emptyText}>No matching refund requests found</Text>
            <TouchableOpacity onPress={() => {setSearchQuery(''); setStatusFilter('all')}}>
              <Text style={styles.clearText}>Clear all filters</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.orderId}>ORDER {item.orderId.toUpperCase()}</Text>
                <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={[styles.statusBadge, item.status === 'pending' ? styles.statusPending : item.status === 'approved' ? styles.statusApproved : styles.statusRejected]}>
                <Text style={[styles.statusText, item.status === 'pending' ? {color:'#D97706'} : item.status === 'approved' ? {color:'#059669'} : {color:'#DC2626'}]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>CATEGORY</Text>
              <Text style={[styles.infoValue, {fontWeight: 'bold', color: '#000'}]}>{item.reasonCategory || 'OTHER'}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>AMOUNT</Text>
              <Text style={styles.infoValue}>Rs. {item.amount.toLocaleString()}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>REASON</Text>
              <Text style={styles.infoValue}>{item.reason}</Text>
            </View>

            {/* Evidence Images */}
            {item.images && item.images.length > 0 && (
              <View style={styles.evidenceSection}>
                <Text style={styles.infoLabel}>EVIDENCE PHOTOS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {item.images.map((img, idx) => (
                    <TouchableOpacity key={idx} onPress={() => {
                      if (Platform.OS === 'web') window.open(img, '_blank');
                    }} style={styles.evidenceThumb}>
                      <Image source={{ uri: img }} style={styles.thumbImage} resizeMode="cover" />
                      <View style={styles.expandIcon}>
                        <ExternalLink size={10} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

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
    paddingVertical: 18,
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
  errorBanner: {
    backgroundColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    color: '#DC2626',
    fontFamily: 'CormorantGaramond_500Medium',
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 2,
  },
  retryText: {
    fontSize: 9,
    color: '#FFF',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    fontFamily: 'CormorantGaramond_400Regular',
  },
  filterScroll: { flexDirection: 'row' },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EEE',
    backgroundColor: '#FFF',
  },
  filterChipActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  filterChipText: {
    fontSize: 9,
    color: '#888',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  loadingText: { marginTop: 12, fontSize: 12, color: '#888', fontFamily: 'CormorantGaramond_400Regular' },
  emptyText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'CormorantGaramond_500Medium',
    marginTop: 12,
  },
  clearText: {
    fontSize: 12,
    color: '#3B82F6',
    fontFamily: 'CormorantGaramond_700Bold',
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: '#FFF',
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  dateText: { fontSize: 10, color: '#AAA', fontFamily: 'CormorantGaramond_400Regular', marginTop: 2 },
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
  divider: { height: 1, backgroundColor: '#F8F8F8', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 10, color: '#AAA', fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 1 },
  infoValue: { fontSize: 13, color: '#333', fontFamily: 'CormorantGaramond_500Medium', flex: 1, textAlign: 'right', marginLeft: 20 },
  evidenceSection: { marginTop: 12, marginBottom: 4 },
  evidenceThumb: { width: 60, height: 60, marginRight: 10, borderRadius: 4, overflow: 'hidden', position: 'relative' },
  thumbImage: { width: '100%', height: '100%' },
  expandIcon: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 2, padding: 2 },
  commentBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderLeftWidth: 3,
    borderLeftColor: '#DDD',
  },
  commentLabel: { fontSize: 9, color: '#888', fontFamily: 'CormorantGaramond_700Bold', marginBottom: 4 },
  commentText: { fontSize: 12, color: '#555', fontFamily: 'CormorantGaramond_400Regular', fontStyle: 'italic' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#F8F8F8',
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
    borderRadius: 4,
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
    padding: 14,
    fontSize: 14,
    fontFamily: 'CormorantGaramond_500Medium',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    backgroundColor: '#FAFAFA',
  },
  submitBtn: {
    padding: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 2,
  },
});

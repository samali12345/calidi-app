import React, { useEffect, useState } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl, Alert, TextInput
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react-native';

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
  const router = useRouter();

  useEffect(() => {
    if (isAdmin && token) fetchRefunds();
    else setLoading(false);
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

  const handleUpdateStatus = (refundId: string, status: string) => {
    Alert.prompt(
      `${status === 'approved' ? 'Approve' : 'Reject'} Refund`,
      'Add an optional comment:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async (comment) => {
            try {
              await axios.put(
                `${API_BASE_URL}/admin/refunds/${refundId}`,
                { status, adminComment: comment || '' },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', `Refund ${status} successfully`);
              fetchRefunds();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to update refund');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text>Access Restricted</Text>
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
          <ArrowLeft size={24} color="#000" />
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
              <Text style={styles.orderId}>Order: {item.orderId}</Text>
              <Text style={[styles.statusBadge, item.status === 'pending' ? styles.statusPending : item.status === 'approved' ? styles.statusApproved : styles.statusRejected]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.detailText}>Amount: <Text style={styles.amountText}>Rs. {item.amount.toLocaleString()}</Text></Text>
            <Text style={styles.detailText}>Reason: {item.reason}</Text>
            <Text style={styles.detailText}>Date: {new Date(item.createdAt).toLocaleString()}</Text>
            {item.adminComment ? (
              <Text style={styles.commentText}>Admin Comment: {item.adminComment}</Text>
            ) : null}

            {item.status === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => handleUpdateStatus(item._id, 'approved')}>
                  <CheckCircle size={16} color="#FFF" />
                  <Text style={styles.btnText}>APPROVE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => handleUpdateStatus(item._id, 'rejected')}>
                  <XCircle size={16} color="#FFF" />
                  <Text style={styles.btnText}>REJECT</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'PlayfairDisplay_600SemiBold',
    letterSpacing: 1.5,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'CormorantGaramond_500Medium',
  },
  card: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 12,
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
    fontSize: 14,
    color: '#000',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  statusBadge: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: 'CormorantGaramond_700Bold',
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusPending: { backgroundColor: '#FEF3C7', color: '#D97706' },
  statusApproved: { backgroundColor: '#D1FAE5', color: '#059669' },
  statusRejected: { backgroundColor: '#FEE2E2', color: '#DC2626' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginBottom: 12 },
  detailText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
    fontFamily: 'CormorantGaramond_400Regular',
  },
  amountText: {
    color: '#000',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  commentText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
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
    paddingVertical: 10,
    gap: 8,
  },
  approveBtn: { backgroundColor: '#059669' },
  rejectBtn: { backgroundColor: '#DC2626' },
  btnText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
  },
});

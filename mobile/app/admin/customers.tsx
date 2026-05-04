import React, { useEffect, useState } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { ChevronLeft, Users, Mail, Phone, Calendar } from 'lucide-react-native';

export default function AdminCustomersScreen() {
  const { token, isAdmin } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const handleUpdateUser = async (userId: string, updates: any) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/mobile/admin/users/${userId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        Alert.alert('Updated', 'User profile updated successfully.');
        fetchCustomers();
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to update user');
    }
  };

  const showRolePicker = (user: any) => {
    Alert.alert(
      'Change User Role',
      `Select new role for ${user.name || user.email}`,
      [
        { text: 'Customer', onPress: () => handleUpdateUser(user._id, { role: 'customer' }) },
        { text: 'Admin', onPress: () => handleUpdateUser(user._id, { role: 'admin' }) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const toggleStatus = (user: any) => {
    const newStatus = !user.isActive;
    Alert.alert(
      newStatus ? 'Activate User' : 'Deactivate User',
      `Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: newStatus ? 'default' : 'destructive',
          onPress: () => handleUpdateUser(user._id, { isActive: newStatus }) 
        }
      ]
    );
  };

  useEffect(() => {
    if (isAdmin && token) fetchCustomers();
  }, [isAdmin, token]);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/mobile/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data || []);
    } catch (e: any) {
      console.error('[Admin Customers] Error:', e.message);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomers();
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
        <Text style={styles.headerTitle}>USER MANAGEMENT</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Users size={48} color="#DDD" strokeWidth={1} />
            <Text style={styles.emptyTitle}>No Users Found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, item.isActive === false && styles.cardInactive]}>
            <View style={styles.cardTop}>
              <View style={[styles.avatar, item.role === 'admin' && { backgroundColor: '#E91E63' }]}>
                <Text style={styles.avatarLetter}>{(item.name || item.email || 'U').substring(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.name}>{item.name || 'Unknown'}</Text>
                  {item.isActive === false && (
                    <View style={styles.deactivatedBadge}>
                      <Text style={styles.deactivatedText}>DEACTIVATED</Text>
                    </View>
                  )}
                </View>
                <View style={styles.row}>
                  <Mail size={12} color="#888" />
                  <Text style={styles.detail}>{item.email}</Text>
                </View>
                {item.mobileNumber && (
                  <View style={styles.row}>
                    <Phone size={12} color="#888" />
                    <Text style={styles.detail}>{item.mobileNumber}</Text>
                  </View>
                )}
              </View>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => showRolePicker(item)}>
                <Text style={styles.actionBtnText}>CHANGE ROLE</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, item.isActive ? styles.btnDanger : styles.btnSuccess]} 
                onPress={() => toggleStatus(item)}
              >
                <Text style={[styles.actionBtnText, { color: '#FFF' }]}>
                  {item.isActive ? 'DEACTIVATE' : 'ACTIVATE'}
                </Text>
              </TouchableOpacity>
            </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FAF9F6',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, color: '#000', letterSpacing: 2, fontFamily: 'PlayfairDisplay_600SemiBold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyTitle: { marginTop: 16, fontSize: 16, color: '#888', fontFamily: 'CormorantGaramond_600SemiBold' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  avatarLetter: { color: '#FFF', fontSize: 18, fontFamily: 'PlayfairDisplay_600SemiBold' },
  info: { flex: 1 },
  name: { fontSize: 15, color: '#000', fontFamily: 'CormorantGaramond_700Bold', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  detail: { fontSize: 12, color: '#666', fontFamily: 'CormorantGaramond_500Medium' },
  roleBadge: { backgroundColor: '#F5F5F5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleText: { fontSize: 9, color: '#333', fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 1 },
  cardInactive: { opacity: 0.8, backgroundColor: '#FAFAFA', borderStyle: 'dashed' },
  deactivatedBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  deactivatedText: { fontSize: 8, color: '#D32F2F', fontFamily: 'CormorantGaramond_700Bold' },
  cardActions: { 
    flexDirection: 'row', 
    marginTop: 16, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#F5F5F5',
    gap: 10
  },
  actionBtn: { 
    flex: 1, 
    height: 34, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#000' 
  },
  actionBtnText: { fontSize: 10, color: '#000', fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 1 },
  btnDanger: { backgroundColor: '#D32F2F', borderColor: '#D32F2F' },
  btnSuccess: { backgroundColor: '#388E3C', borderColor: '#388E3C' },
});

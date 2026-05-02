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

  useEffect(() => {
    if (isAdmin && token) fetchCustomers();
  }, [isAdmin, token]);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/mobile/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data);
    } catch (e: any) {
      console.error('[Admin Customers] Error:', e.message);
      // Fallback if the endpoint doesn't exist or fails
      setCustomers([]);
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
        <Text style={styles.headerTitle}>VIEW CUSTOMERS</Text>
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
            <Text style={styles.emptyTitle}>No Customers Found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{(item.name || item.email || 'U').substring(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name || 'Unknown'}</Text>
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
});

import React, { useEffect, useState } from 'react';
import {
  StyleSheet, ScrollView, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import {
  ShoppingCart, Package, Users, DollarSign,
  TrendingUp, ShieldOff, Settings, ChevronRight
} from 'lucide-react-native';

interface Stats {
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  totalRevenue: number;
  pendingOrders: number;
}

export default function AdminScreen() {
  const { user, token, isAdmin, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isAdmin && token) fetchStats();
    else setLoading(false);
  }, [isAdmin, token]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/mobile/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      setStats(response.data);
    } catch (e: any) {
      console.error('[Admin] Stats error:', e.message);
      // Show placeholder stats if API fails
      setStats({ totalOrders: 0, totalProducts: 0, totalUsers: 0, totalRevenue: 0, pendingOrders: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (!user || !isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ADMIN</Text>
        </View>
        <View style={styles.center}>
          <ShieldOff size={56} color="#DDD" strokeWidth={1} />
          <Text style={styles.accessTitle}>Access Restricted</Text>
          <Text style={styles.accessSubtitle}>This area is for administrators only</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ADMIN PANEL</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>LOADING DASHBOARD...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ADMIN PANEL</Text>
        <Text style={styles.headerSub}>CALIDI BOUTIQUE</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        contentContainerStyle={styles.content}
      >
        {/* Admin Profile Section */}
        <View style={styles.adminProfileCard}>
          <View style={styles.adminProfileInfo}>
            <Text style={styles.adminName}>{user?.name?.toUpperCase() || 'ADMINISTRATOR'}</Text>
            <Text style={styles.adminEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <Text style={styles.sectionLabel}>OVERVIEW</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon={<ShoppingCart size={24} color="#3B82F6" strokeWidth={1.5} />}
            label="Orders"
            value={String(stats?.totalOrders ?? 0)}
            sub={`${stats?.pendingOrders ?? 0} pending`}
            accent="#3B82F6"
          />
          <StatCard
            icon={<Package size={24} color="#10B981" strokeWidth={1.5} />}
            label="Products"
            value={String(stats?.totalProducts ?? 0)}
            sub="in catalog"
            accent="#10B981"
          />
          <StatCard
            icon={<Users size={24} color="#F59E0B" strokeWidth={1.5} />}
            label="Customers"
            value={String(stats?.totalUsers ?? 0)}
            sub="registered"
            accent="#F59E0B"
          />
          <StatCard
            icon={<DollarSign size={24} color="#E91E63" strokeWidth={1.5} />}
            label="Revenue"
            value={`Rs. ${((stats?.totalRevenue ?? 0) / 1000).toFixed(0)}K`}
            sub="total earnings"
            accent="#E91E63"
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.actionsCard}>
          <ActionRow
            icon={<ShoppingCart size={20} color="#333" strokeWidth={1.5} />}
            label="Manage Orders"
            onPress={() => router.push('/admin/orders')}
          />
          <ActionRow
            icon={<Package size={20} color="#333" strokeWidth={1.5} />}
            label="Manage Products"
            onPress={() => router.push('/admin/products')}
          />
          <ActionRow
            icon={<Users size={20} color="#333" strokeWidth={1.5} />}
            label="View Customers"
            onPress={() => router.push('/admin/customers')}
          />
          <ActionRow
            icon={<TrendingUp size={20} color="#333" strokeWidth={1.5} />}
            label="Sales Reports"
            onPress={() => Alert.alert('Coming Soon', 'Reports coming soon')}
          />
          <ActionRow
            icon={<DollarSign size={20} color="#333" strokeWidth={1.5} />}
            label="Manage Coupons"
            onPress={() => Alert.alert('Promotions', 'Coupon management interface')}
          />
          <ActionRow
            icon={<Settings size={20} color="#333" strokeWidth={1.5} />}
            label="Settings"
            onPress={() => Alert.alert('Coming Soon', 'Settings coming soon')}
            last
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, sub, accent }: any) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent, borderTopWidth: 3 }]}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function ActionRow({ icon, label, onPress, last }: any) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, !last && { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' }]}
      onPress={onPress}
    >
      {icon}
      <Text style={styles.actionLabel}>{label}</Text>
      <ChevronRight size={18} color="#CCC" strokeWidth={1.5} style={{ marginLeft: 'auto' }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#FFF',
    letterSpacing: 3,
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },
  headerSub: {
    fontSize: 10,
    color: '#888',
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_500Medium',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  accessTitle: {
    fontSize: 22,
    color: '#333',
    marginTop: 16,
    fontFamily: 'PlayfairDisplay_500Medium',
  },
  accessSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'CormorantGaramond_400Regular',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 11,
    letterSpacing: 2,
    color: '#888',
    fontFamily: 'CormorantGaramond_500Medium',
  },
  content: { padding: 16 },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#AAA',
    fontFamily: 'CormorantGaramond_700Bold',
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#FFF',
    width: '48%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    color: '#000',
    marginTop: 8,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#555',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  statSub: {
    fontSize: 11,
    color: '#AAA',
    fontFamily: 'CormorantGaramond_400Regular',
  },
  actionsCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  actionLabel: {
    fontSize: 15,
    color: '#222',
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  adminProfileCard: {
    backgroundColor: '#000',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  adminProfileInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 14,
    color: '#FFF',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
  },
  adminEmail: {
    fontSize: 11,
    color: '#AAA',
    fontFamily: 'CormorantGaramond_400Regular',
    marginTop: 4,
  },
  logoutBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 10,
    color: '#FFF',
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 1,
  },
});

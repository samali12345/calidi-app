import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, SafeAreaView, StatusBar,
  TouchableOpacity, ActivityIndicator, ScrollView, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, TrendingUp, DollarSign, ShoppingCart, Users } from 'lucide-react-native';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { useAuth } from '../../context/AuthContext';

export default function AdminReportsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/mobile/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
        <Text style={styles.headerTitle}>SALES REPORTS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <TrendingUp size={32} color="#10B981" />
          <Text style={styles.summaryValue}>Rs. {stats?.totalRevenue?.toLocaleString() ?? '0'}</Text>
          <Text style={styles.summaryLabel}>TOTAL GROSS REVENUE</Text>
        </View>

        <View style={styles.grid}>
          <ReportCard 
            icon={<ShoppingCart size={20} color="#3B82F6" />}
            label="Total Orders"
            value={stats?.totalOrders ?? 0}
          />
          <ReportCard 
            icon={<Users size={20} color="#F59E0B" />}
            label="Total Customers"
            value={stats?.totalUsers ?? 0}
          />
          <ReportCard 
            icon={<DollarSign size={20} color="#E91E63" />}
            label="Avg. Order Value"
            value={`Rs. ${stats?.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(0) : 0}`}
          />
        </View>

        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartTitle}>WEEKLY PERFORMANCE</Text>
          <View style={styles.bars}>
             {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
               <View key={i} style={[styles.bar, { height: h }]} />
             ))}
          </View>
          <View style={styles.days}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} style={styles.dayText}>{d}</Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportCard({ icon, label, value }: any) {
  return (
    <View style={styles.card}>
      {icon}
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 14, letterSpacing: 2, fontFamily: 'PlayfairDisplay_600SemiBold' },
  content: { padding: 20 },
  summaryCard: {
    backgroundColor: '#000',
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryValue: { fontSize: 28, color: '#FFF', fontFamily: 'PlayfairDisplay_700Bold', marginTop: 10 },
  summaryLabel: { fontSize: 10, color: '#AAA', letterSpacing: 2, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: {
    backgroundColor: '#FFF',
    width: '48%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEE',
    gap: 6
  },
  cardValue: { fontSize: 18, fontFamily: 'PlayfairDisplay_700Bold' },
  cardLabel: { fontSize: 9, color: '#888', letterSpacing: 1 },
  chartPlaceholder: {
    backgroundColor: '#FFF',
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  chartTitle: { fontSize: 10, letterSpacing: 1.5, color: '#888', marginBottom: 20 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, paddingHorizontal: 10 },
  bar: { width: 20, backgroundColor: '#000' },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 10 },
  dayText: { fontSize: 10, color: '#BBB' }
});

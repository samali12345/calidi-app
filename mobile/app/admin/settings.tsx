import React, { useState } from 'react';
import {
  StyleSheet, View, Text, SafeAreaView, StatusBar,
  TouchableOpacity, Switch, ScrollView, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Shield, Bell, Eye, Trash2 } from 'lucide-react-native';

export default function AdminSettingsScreen() {
  const router = useRouter();
  const [notifs, setNotifs] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [publicView, setPublicView] = useState(true);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>APP SETTINGS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SettingSection title="GENERAL SETTINGS">
          <SettingRow 
            icon={<Bell size={20} color="#555" />}
            label="Order Notifications"
            value={notifs}
            onToggle={setNotifs}
          />
          <SettingRow 
            icon={<Eye size={20} color="#555" />}
            label="Public Catalog Visible"
            value={publicView}
            onToggle={setPublicView}
          />
        </SettingSection>

        <SettingSection title="MAINTENANCE">
          <SettingRow 
            icon={<Shield size={20} color="#E91E63" />}
            label="Maintenance Mode"
            value={maintenance}
            onToggle={setMaintenance}
          />
        </SettingSection>

        <SettingSection title="DANGER ZONE">
          <TouchableOpacity 
            style={styles.dangerBtn}
            onPress={() => Alert.alert('Clear Cache', 'Are you sure?', [{text: 'No'}, {text: 'Yes'}])}
          >
            <Trash2 size={20} color="#FFF" />
            <Text style={styles.dangerText}>CLEAR APP CACHE</Text>
          </TouchableOpacity>
        </SettingSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingSection({ title, children }: any) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SettingRow({ icon, label, value, onToggle }: any) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        {icon}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Switch 
        value={value} 
        onValueChange={onToggle}
        trackColor={{ false: "#DDD", true: "#000" }}
        thumbColor="#FFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
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
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 10, letterSpacing: 1.5, color: '#AAA', marginBottom: 15 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 8,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { fontSize: 14, color: '#333', fontFamily: 'CormorantGaramond_600SemiBold' },
  dangerBtn: {
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  dangerText: { color: '#FFF', fontSize: 12, letterSpacing: 1, fontFamily: 'CormorantGaramond_700Bold' }
});

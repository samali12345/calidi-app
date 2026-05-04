import React from 'react';
import {
  StyleSheet, View, Text, SafeAreaView, StatusBar,
  TouchableOpacity, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Lock, ChevronRight, Bell, Shield, CircleHelp } from 'lucide-react-native';

export default function UserSettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#000" strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY</Text>
          <SettingItem 
            icon={<Lock size={20} color="#333" strokeWidth={1.5} />} 
            label="Change Password" 
            onPress={() => router.push('/update-password')}
          />
          <SettingItem 
            icon={<Shield size={20} color="#333" strokeWidth={1.5} />} 
            label="Privacy Policy" 
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          <SettingItem 
            icon={<Bell size={20} color="#333" strokeWidth={1.5} />} 
            label="Push Notifications" 
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          <SettingItem 
            icon={<CircleHelp size={20} color="#333" strokeWidth={1.5} />} 
            label="Help Center" 
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.version}>VERSION 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingItem({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <View style={styles.itemLeft}>
        {icon}
        <Text style={styles.itemLabel}>{label}</Text>
      </View>
      <ChevronRight size={18} color="#CCC" strokeWidth={1.5} />
    </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 14,
    color: '#000',
    letterSpacing: 2,
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },
  content: { padding: 24 },
  section: { marginBottom: 30 },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#AAA',
    fontFamily: 'CormorantGaramond_700Bold',
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  itemLabel: {
    fontSize: 14,
    color: '#222',
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  version: {
    fontSize: 9,
    color: '#CCC',
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_700Bold',
  },
});

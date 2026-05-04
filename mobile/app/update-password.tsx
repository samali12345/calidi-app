import React, { useState } from 'react';
import {
  StyleSheet, View, Text, SafeAreaView, StatusBar,
  TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../constants/Config';
import { ChevronLeft, Lock, Eye, EyeOff } from 'lucide-react-native';

export default function UpdatePasswordScreen() {
  const { token } = useAuth();
  const router = useRouter();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Required', 'Please fill in all fields.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Invalid', 'New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await axios.post(`${API_BASE_URL}/auth/update-password`, {
        currentPassword,
        newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data) {
        Alert.alert('Success', 'Your password has been updated successfully.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Failed to update password';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#000" strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CHANGE PASSWORD</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Ensure your account stays secure by using a strong password that you don't use elsewhere.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>CURRENT PASSWORD</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              secureTextEntry={!showCurrent}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
              {showCurrent ? <EyeOff size={18} color="#AAA" /> : <Eye size={18} color="#AAA" />}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>NEW PASSWORD</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              secureTextEntry={!showNew}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)}>
              {showNew ? <EyeOff size={18} color="#AAA" /> : <Eye size={18} color="#AAA" />}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Re-enter new password"
              secureTextEntry={!showNew}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]} 
          onPress={handleUpdate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>UPDATE PASSWORD</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  infoBox: {
    backgroundColor: '#000',
    padding: 16,
    marginBottom: 30,
  },
  infoText: {
    color: '#FFF',
    fontSize: 11,
    lineHeight: 18,
    fontFamily: 'CormorantGaramond_500Medium',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  form: { gap: 20, marginBottom: 40 },
  label: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#888',
    fontFamily: 'CormorantGaramond_700Bold',
    marginBottom: -12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontFamily: 'CormorantGaramond_500Medium',
  },
  submitBtn: {
    backgroundColor: '#000',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_700Bold',
  },
});

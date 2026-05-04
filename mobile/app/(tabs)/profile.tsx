import React, { useState } from 'react';
import {
  StyleSheet, TouchableOpacity, TextInput, ActivityIndicator,
  ScrollView, View, Text, SafeAreaView, StatusBar, Alert, Platform
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  Mail, Lock, User as UserIcon, LogOut,
  ChevronRight, Package, Heart, Settings,
  Eye, EyeOff, Trash2
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, login, signup, logout, loading } = useAuth();
  const router = useRouter();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your email and password');
      return;
    }
    if (isSigningUp && !name.trim()) {
      Alert.alert('Required', 'Please enter your name');
      return;
    }

    try {
      setLoggingIn(true);
      if (isSigningUp) {
        await signup(email.trim().toLowerCase(), password, name.trim());
      } else {
        await login(email.trim().toLowerCase(), password);
      }
    } catch (e: any) {
      const msg = e.response?.status === 401 
        ? 'Wrong username or password' 
        : (e.response?.data?.message || e.message || 'Error occurred');
      Alert.alert(isSigningUp ? 'Signup Failed' : 'Login Failed', msg);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and will delete all your data. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Permanently', 
          style: 'destructive', 
          onPress: async () => {
            try {
              setDeleting(true);
              const response = await axios.delete(`${API_BASE_URL}/mobile/me`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (response.data.success) {
                Alert.alert('Deleted', 'Your account has been successfully removed.');
                logout();
              }
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error || 'Failed to delete account');
            } finally {
              setDeleting(false);
            }
          } 
        },
      ]
    );
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

  // ─── NOT LOGGED IN ────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
        <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
          <View style={styles.loginHeader}>
            <Text style={styles.loginTitle}>{isSigningUp ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</Text>
            <Text style={styles.loginSubtitle}>
              {isSigningUp ? 'JOIN THE CALIDI COMMUNITY' : 'SIGN IN TO YOUR CALIDI ACCOUNT'}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            {isSigningUp && (
              <View style={styles.inputWrap}>
                <UserIcon size={18} color="#AAA" strokeWidth={1.5} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#BBB"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}
            <View style={styles.inputWrap}>
              <Mail size={18} color="#AAA" strokeWidth={1.5} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#BBB"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
            <View style={styles.inputWrap}>
              <Lock size={18} color="#AAA" strokeWidth={1.5} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#BBB"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loggingIn && { opacity: 0.7 }]}
            onPress={handleAuth}
            disabled={loggingIn}
          >
            {loggingIn
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={styles.loginBtnText}>{isSigningUp ? 'SIGN UP' : 'SIGN IN'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.toggleBtn} 
            onPress={() => setIsSigningUp(!isSigningUp)}
          >
            <Text style={styles.toggleText}>
              {isSigningUp ? 'ALREADY HAVE AN ACCOUNT? SIGN IN' : 'DON\'T HAVE AN ACCOUNT? SIGN UP'}
            </Text>
          </TouchableOpacity>

          {!isSigningUp && (
            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>TEST ACCOUNTS</Text>
              <Text style={styles.demoItem}>👤 user@calidi.com  /  user123</Text>
              <Text style={styles.demoItem}>🛡️ admin@calidi.com  /  admin123</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── LOGGED IN ────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      <ScrollView>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {(user.name || user.email).substring(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{(user.name || 'Guest').toUpperCase()}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            {user.role === 'admin' && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>ADMINISTRATOR</Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MY ACCOUNT</Text>
          <MenuItem 
            icon={<Package size={20} color="#333" strokeWidth={1.5} />} 
            label="My Orders" 
            onPress={() => router.push('/orders')}
          />
          <MenuItem 
            icon={<Heart size={20} color="#333" strokeWidth={1.5} />} 
            label="Wishlist" 
            onPress={() => Alert.alert('Wishlist', 'Feature coming soon!')}
          />
          <MenuItem 
            icon={<Settings size={20} color="#333" strokeWidth={1.5} />} 
            label="Settings" 
            onPress={() => router.push('/settings')}
          />
        </View>

        {/* Logout & Account Actions */}
        <View style={{ marginTop: 20 }}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={18} color="#E53935" strokeWidth={1.5} />
            <Text style={styles.logoutText}>SIGN OUT</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.deleteBtn, deleting && { opacity: 0.5 }]} 
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            <Trash2 size={16} color="#AAA" strokeWidth={1.5} />
            <Text style={styles.deleteText}>DELETE MY ACCOUNT PERMANENTLY</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      {icon}
      <Text style={styles.menuLabel}>{label}</Text>
      <ChevronRight size={18} color="#CCC" strokeWidth={1.5} style={{ marginLeft: 'auto' }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Login
  loginContent: { padding: 28, paddingTop: 60 },
  loginHeader: { marginBottom: 40 },
  loginTitle: {
    fontSize: 32,
    color: '#000',
    letterSpacing: 2,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 11,
    color: '#999',
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_500Medium',
  },
  inputGroup: { marginBottom: 24 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#000',
    fontFamily: 'CormorantGaramond_500Medium',
  },
  loginBtn: {
    backgroundColor: '#000',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 13,
    letterSpacing: 3,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  toggleBtn: {
    alignItems: 'center',
    marginBottom: 40,
  },
  toggleText: {
    fontSize: 11,
    color: '#000',
    letterSpacing: 1.5,
    fontFamily: 'CormorantGaramond_700Bold',
    textDecorationLine: 'underline',
  },
  demoBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    gap: 6,
  },
  demoTitle: {
    fontSize: 10,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 2,
    color: '#888',
    marginBottom: 6,
  },
  demoItem: {
    fontSize: 13,
    color: '#444',
    fontFamily: 'CormorantGaramond_400Regular',
  },

  // Profile
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 24,
    paddingTop: 30,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E91E63',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_400Regular',
  },
  profileInfo: { marginLeft: 16 },
  profileName: {
    color: '#FFF',
    fontSize: 18,
    letterSpacing: 1,
    fontFamily: 'PlayfairDisplay_500Medium',
  },
  profileEmail: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'CormorantGaramond_400Regular',
  },
  adminBadge: {
    backgroundColor: '#E91E63',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  adminBadgeText: {
    color: '#FFF',
    fontSize: 9,
    letterSpacing: 1.5,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  section: { backgroundColor: '#FFF', marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#BBB',
    fontFamily: 'CormorantGaramond_700Bold',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 14,
  },
  menuLabel: {
    fontSize: 14,
    color: '#222',
    letterSpacing: 0.5,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  logoutText: {
    fontSize: 13,
    color: '#E53935',
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    marginTop: 10,
    marginBottom: 30,
  },
  deleteText: {
    fontSize: 10,
    color: '#AAA',
    letterSpacing: 1.5,
    fontFamily: 'CormorantGaramond_500Medium',
    textDecorationLine: 'underline',
  },
});

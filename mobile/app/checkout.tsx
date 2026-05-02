import React, { useState } from 'react';
import {
  StyleSheet, View, Text, SafeAreaView, StatusBar,
  TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../constants/Config';
import { ChevronLeft } from 'lucide-react-native';

export default function CheckoutScreen() {
  const { items: cart, totalAmount, clearCart } = useCart();
  const { user, token } = useAuth();
  const router = useRouter();
  
  const [address, setAddress] = useState('123 Main St');
  const [city, setCity] = useState('Colombo');
  const [zip, setZip] = useState('00100');
  const [submitting, setSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    if (!address || !city || !zip) {
      Alert.alert('Required', 'Please fill in all delivery details.');
      return;
    }
    
    try {
      setSubmitting(true);
      const orderData = {
        items: cart,
        shippingAddress: {
          fullName: user?.name || 'Customer',
          street: address,
          city: city,
          state: 'Western',
          zip: zip,
          country: 'Sri Lanka'
        },
        deliveryMethod: 'standard'
      };

      const response = await axios.post(`${API_BASE_URL}/mobile/orders`, orderData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        clearCart();
        Alert.alert('Order Confirmed!', 'Your order has been placed successfully.', [
          { text: 'View Orders', onPress: () => {
            router.back();
            router.push('/orders');
          }}
        ]);
      }
    } catch (e: any) {
      console.error('[Checkout] error:', e.message);
      Alert.alert('Checkout Failed', e.response?.data?.error || 'Could not place order');
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
        <Text style={styles.headerTitle}>CHECKOUT</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>DELIVERY DETAILS</Text>
        
        <View style={styles.form}>
          <Text style={styles.inputLabel}>STREET ADDRESS</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="E.g. 123 Main St"
          />

          <Text style={styles.inputLabel}>CITY</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="E.g. Colombo"
          />

          <Text style={styles.inputLabel}>POSTAL CODE</Text>
          <TextInput
            style={styles.input}
            value={zip}
            onChangeText={setZip}
            placeholder="E.g. 00100"
            keyboardType="number-pad"
          />
        </View>

        <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
        <View style={styles.paymentBox}>
          <View style={styles.radioActive} />
          <Text style={styles.paymentText}>Cash on Delivery</Text>
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items ({cart.length})</Text>
            <Text style={styles.summaryValue}>Rs. {totalAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>Rs. 350</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>Rs. {(totalAmount + 350).toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={handlePlaceOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.checkoutBtnText}>CONFIRM ORDER</Text>
          )}
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    fontSize: 16,
    color: '#000',
    letterSpacing: 3,
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },
  content: { padding: 20 },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#888',
    fontFamily: 'CormorantGaramond_700Bold',
    marginBottom: 16,
    marginTop: 8,
  },
  form: { marginBottom: 30 },
  inputLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#333',
    fontFamily: 'CormorantGaramond_600SemiBold',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'CormorantGaramond_500Medium',
    marginBottom: 16,
  },
  paymentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#000',
    padding: 16,
    marginBottom: 30,
  },
  radioActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#000',
    marginRight: 12,
  },
  paymentText: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  summaryBox: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'CormorantGaramond_500Medium',
  },
  summaryValue: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  totalValue: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  checkoutBtn: {
    backgroundColor: '#000',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#FFF',
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_700Bold',
  },
});

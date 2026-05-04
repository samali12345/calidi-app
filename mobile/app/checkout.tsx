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
  
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const validateCard = () => {
    if (paymentMethod === 'cod') return true;
    const newErrors: Record<string, string> = {};

    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length !== 16) {
      newErrors.cardNumber = 'Card number must be 16 digits';
    }

    const cleanExpiry = cardExpiry.replace(/\//g, '');
    if (cleanExpiry.length !== 4) {
      newErrors.expiry = 'Use MM/YY format';
    } else {
      const month = parseInt(cleanExpiry.substring(0, 2));
      const year = parseInt(cleanExpiry.substring(2, 4)) + 2000;
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      if (month < 1 || month > 12) {
        newErrors.expiry = 'Invalid month (01-12)';
      } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
        newErrors.expiry = 'Card has expired';
      }
    }

    if (cardCVV.length !== 3) {
      newErrors.cvv = 'CVV must be 3 digits';
    }

    if (!cardName.trim()) {
      newErrors.cardName = 'Required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isCardValid = () => {
    if (paymentMethod === 'cod') return true;
    const cleanCard = cardNumber.replace(/\s/g, '');
    const cleanExpiry = cardExpiry.replace(/\//g, '');
    return cleanCard.length === 16 && cleanExpiry.length === 4 && cardCVV.length === 3 && cardName.length > 2;
  };

  const getCardType = () => {
    if (cardNumber.startsWith('4')) return 'VISA';
    if (cardNumber.startsWith('5')) return 'MASTERCARD';
    return '';
  };

  const handleCardNumberChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = '';
    for (let i = 0; i < cleaned.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += cleaned[i];
    }
    setCardNumber(formatted.substring(0, 19));
  };

  const handleExpiryChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) {
      formatted = cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    setCardExpiry(formatted.substring(0, 5));
  };

  const handlePlaceOrder = async () => {
    if (!address || !city || !zip) {
      Alert.alert('Required', 'Please fill in all delivery details.');
      return;
    }

    if (paymentMethod === 'card' && !validateCard()) {
      return;
    }
    
    try {
      setSubmitting(true);

      // Simulate Card Payment Demo
      if (paymentMethod === 'card') {
        setIsPaying(true);
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        setPaymentSuccess(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const orderData = {
        items: cart,
        paymentMethod: paymentMethod === 'card' ? 'card' : 'cash_on_delivery',
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
      setIsPaying(false);
      setPaymentSuccess(false);
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
        <View style={styles.paymentOptions}>
          <TouchableOpacity 
            style={[styles.paymentBox, paymentMethod === 'cod' && styles.paymentBoxActive]} 
            onPress={() => setPaymentMethod('cod')}
          >
            <View style={paymentMethod === 'cod' ? styles.radioActive : styles.radioInactive} />
            <Text style={styles.paymentText}>Cash on Delivery</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.paymentBox, paymentMethod === 'card' && styles.paymentBoxActive]} 
            onPress={() => setPaymentMethod('card')}
          >
            <View style={paymentMethod === 'card' ? styles.radioActive : styles.radioInactive} />
            <Text style={styles.paymentText}>Credit / Debit Card (Demo)</Text>
          </TouchableOpacity>
        </View>

        {paymentMethod === 'card' && (
          <View style={styles.cardForm}>
            <Text style={styles.inputLabel}>CARDHOLDER NAME</Text>
            <TextInput
              style={[styles.input, errors.cardName && styles.inputError]}
              value={cardName}
              onChangeText={(t) => {
                setCardName(t);
                if (errors.cardName) setErrors({...errors, cardName: ''});
              }}
              placeholder="E.g. Ravindu Hettiarachchi"
            />
            {errors.cardName && <Text style={styles.errorText}>{errors.cardName}</Text>}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.inputLabel}>CARD NUMBER</Text>
              {getCardType() ? <Text style={styles.cardTypeLabel}>{getCardType()}</Text> : null}
            </View>
            <TextInput
              style={[styles.input, errors.cardNumber && styles.inputError]}
              value={cardNumber}
              onChangeText={(t) => {
                handleCardNumberChange(t);
                if (errors.cardNumber) setErrors({...errors, cardNumber: ''});
              }}
              placeholder="XXXX XXXX XXXX XXXX"
              keyboardType="number-pad"
              maxLength={19}
            />
            {errors.cardNumber && <Text style={styles.errorText}>{errors.cardNumber}</Text>}

            <View style={{ flexDirection: 'row', gap: 15 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>EXPIRY (MM/YY)</Text>
                <TextInput
                  style={[styles.input, errors.expiry && styles.inputError]}
                  value={cardExpiry}
                  onChangeText={(t) => {
                    handleExpiryChange(t);
                    if (errors.expiry) setErrors({...errors, expiry: ''});
                  }}
                  placeholder="MM/YY"
                  keyboardType="number-pad"
                  maxLength={5}
                />
                {errors.expiry && <Text style={styles.errorText}>{errors.expiry}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>CVV</Text>
                <TextInput
                  style={[styles.input, errors.cvv && styles.inputError]}
                  value={cardCVV}
                  onChangeText={(t) => {
                    setCardCVV(t.replace(/[^0-9]/g, '').substring(0, 3));
                    if (errors.cvv) setErrors({...errors, cvv: ''});
                  }}
                  placeholder="123"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={3}
                />
                {errors.cvv && <Text style={styles.errorText}>{errors.cvv}</Text>}
              </View>
            </View>
          </View>
        )}

        <Text style={styles.sectionLabel}>PROMOTION</Text>
        <View style={styles.couponContainer}>
          <TextInput
            style={styles.couponInput}
            placeholder="COUPON CODE"
            placeholderTextColor="#BBB"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.applyBtn} onPress={() => Alert.alert('Applied', 'Coupon applied successfully!')}>
            <Text style={styles.applyBtnText}>APPLY</Text>
          </TouchableOpacity>
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
          style={[
            styles.checkoutBtn, 
            isPaying && { backgroundColor: '#10B981' },
            (!isCardValid() || submitting) && { opacity: 0.5 }
          ]}
          onPress={handlePlaceOrder}
          disabled={submitting || !isCardValid()}
        >
          {isPaying ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {paymentSuccess ? (
                <Text style={styles.checkoutBtnText}>PAYMENT SUCCESSFUL</Text>
              ) : (
                <>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.checkoutBtnText}>SECURE PROCESSING...</Text>
                </>
              )}
            </View>
          ) : submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.checkoutBtnText}>
              {paymentMethod === 'card' ? 'PAY & CONFIRM ORDER' : 'CONFIRM ORDER'}
            </Text>
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
  paymentOptions: {
    gap: 12,
    marginBottom: 30,
  },
  paymentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 16,
  },
  paymentBoxActive: {
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  radioActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#000',
    marginRight: 12,
  },
  radioInactive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#CCC',
    marginRight: 12,
  },
  paymentText: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  cardForm: {
    backgroundColor: '#FAFAFA',
    padding: 20,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginBottom: 30,
  },
  couponContainer: {
    flexDirection: 'row',
    marginBottom: 30,
    gap: 10,
  },
  couponInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    height: 48,
    fontSize: 13,
    fontFamily: 'CormorantGaramond_600SemiBold',
    letterSpacing: 1,
  },
  applyBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFF',
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: 'CormorantGaramond_700Bold',
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
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 10,
    marginTop: -12,
    marginBottom: 12,
    fontFamily: 'CormorantGaramond_500Medium',
  },
  cardTypeLabel: {
    fontSize: 10,
    color: '#888',
    letterSpacing: 1,
    fontFamily: 'CormorantGaramond_700Bold',
    marginBottom: 6,
  }
});

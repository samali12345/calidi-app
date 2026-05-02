import React from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, Image,
  View, Text, SafeAreaView, StatusBar, Alert
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react-native';

export default function CartScreen() {
  const { items: cart, removeFromCart, updateQuantity, totalAmount, clearCart } = useCart();
  const { user, token } = useAuth();
  const router = useRouter();
  const [checkingOut, setCheckingOut] = React.useState(false);

  const handleCheckout = () => {
    if (!user || !token) {
      Alert.alert('Login Required', 'Please login to proceed to checkout', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/profile') }
      ]);
      return;
    }
    router.push('/checkout');
  };

  if (cart.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MY CART</Text>
        </View>
        <View style={styles.empty}>
          <ShoppingBag size={56} color="#DDD" strokeWidth={1} />
          <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
          <Text style={styles.emptySubtitle}>Add items from the shop to get started</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/')}>
            <Text style={styles.shopBtnText}>BROWSE SHOP</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MY CART</Text>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearText}>CLEAR</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cart}
        keyExtractor={(item) => `${item.productId}-${item.size}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.cartItem}>
            <Image
              source={{ uri: item.image }}
              style={styles.itemImg}
              resizeMode="cover"
            />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.itemSize}>SIZE: {item.size}</Text>
              <Text style={styles.itemPrice}>Rs. {item.price?.toLocaleString()}</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                >
                  <Minus size={14} color="#000" strokeWidth={2} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.productId, item.size, item.quantity + 1)}
                >
                  <Plus size={14} color="#000" strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeFromCart(item.productId, item.size)}
                >
                  <Trash2 size={16} color="#E53935" strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>SUBTOTAL ({cart.length} ITEMS)</Text>
          <Text style={styles.summaryValue}>Rs. {totalAmount.toLocaleString()}</Text>
        </View>
        <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
          <Text style={styles.checkoutBtnText}>PROCEED TO CHECKOUT</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FAF9F6',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  headerTitle: {
    fontSize: 22,
    color: '#000',
    letterSpacing: 2,
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },
  clearText: {
    fontSize: 11,
    color: '#E53935',
    letterSpacing: 1.5,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyTitle: {
    fontSize: 22,
    color: '#333',
    marginTop: 20,
    fontFamily: 'PlayfairDisplay_500Medium',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'CormorantGaramond_400Regular',
  },
  shopBtn: {
    backgroundColor: '#000',
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 24,
  },
  shopBtnText: {
    color: '#FFF',
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  list: { padding: 16 },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  itemImg: { width: 90, height: 110, backgroundColor: '#F5F5F5' },
  itemInfo: { flex: 1, marginLeft: 14 },
  itemName: {
    fontSize: 14,
    color: '#222',
    lineHeight: 19,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  itemSize: {
    fontSize: 11,
    color: '#888',
    letterSpacing: 1,
    marginTop: 4,
    fontFamily: 'CormorantGaramond_500Medium',
  },
  itemPrice: {
    fontSize: 16,
    color: '#000',
    marginTop: 6,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  qtyBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 15,
    color: '#000',
    fontFamily: 'CormorantGaramond_700Bold',
    minWidth: 20,
    textAlign: 'center',
  },
  removeBtn: { marginLeft: 'auto' as any },
  summary: {
    backgroundColor: '#FFF',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#888',
    letterSpacing: 1,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  summaryValue: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'CormorantGaramond_700Bold',
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

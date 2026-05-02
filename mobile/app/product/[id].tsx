import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Image, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, View, Text, SafeAreaView,
  StatusBar, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { useCart } from '../../context/CartContext';
import { ChevronLeft, ShoppingCart, Check } from 'lucide-react-native';

interface Product {
  p_id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  brand?: string;
  sizes: string[];
  stock: number;
  image?: string;  // CDN URL already built by API
  img?: string;    // fallback
}

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();
  const router = useRouter();

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/products/${id}`, { timeout: 10000 });
      setProduct(response.data);
      const sizes = response.data.sizes || ['S', 'M', 'L', 'XL', 'XXL'];
      setSelectedSize(sizes[0]);
    } catch (e: any) {
      console.error('[Product] Error:', e.message);
      Alert.alert('Error', 'Failed to load product. Please go back and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (!selectedSize) {
      Alert.alert('Select Size', 'Please select a size before adding to cart');
      return;
    }
    addToCart({
      productId: product.p_id,
      name: product.name,
      price: product.price,
      quantity: 1,
      size: selectedSize,
      image: product.image || product.img || '',
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#000" strokeWidth={1.5} />
        </TouchableOpacity>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#000" strokeWidth={1.5} />
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Product not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sizes = product.sizes?.length ? product.sizes : ['S', 'M', 'L', 'XL', 'XXL'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      <ScrollView style={styles.scroll} bounces={false}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: product.image || product.img || '' }}
            style={styles.image}
            resizeMode="cover"
          />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={22} color="#000" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Details */}
        <View style={styles.details}>
          {product.brand && (
            <Text style={styles.brand}>{product.brand.toUpperCase()}</Text>
          )}
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>Rs. {product.price?.toLocaleString()}</Text>

          {product.category && (
            <View style={styles.catTag}>
              <Text style={styles.catTagText}>{product.category.toUpperCase()}</Text>
            </View>
          )}

          {/* Size Selector */}
          <View style={styles.sizeSection}>
            <Text style={styles.sizeLabel}>SELECT SIZE</Text>
            <View style={styles.sizeRow}>
              {sizes.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[styles.sizeBtn, selectedSize === size && styles.sizeBtnActive]}
                  onPress={() => setSelectedSize(size)}
                >
                  <Text style={[styles.sizeBtnText, selectedSize === size && styles.sizeBtnTextActive]}>
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          {product.description ? (
            <View style={styles.descSection}>
              <Text style={styles.descLabel}>DESCRIPTION</Text>
              <Text style={styles.desc}>{product.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Add to Cart Footer */}
      <View style={styles.footer}>
        <View style={styles.footerPrice}>
          <Text style={styles.footerPriceLabel}>PRICE</Text>
          <Text style={styles.footerPriceValue}>Rs. {product.price?.toLocaleString()}</Text>
        </View>
        <TouchableOpacity
          style={[styles.cartBtn, added && styles.cartBtnAdded]}
          onPress={handleAddToCart}
          activeOpacity={0.85}
        >
          {added
            ? <Check size={20} color="#FFF" strokeWidth={2.5} />
            : <ShoppingCart size={20} color="#FFF" strokeWidth={1.5} />
          }
          <Text style={styles.cartBtnText}>{added ? 'ADDED!' : 'ADD TO CART'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFoundText: {
    fontSize: 18,
    color: '#888',
    fontFamily: 'CormorantGaramond_400Regular',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 0.75, // 3:4 aspect ratio to prevent cropping
    backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  details: {
    backgroundColor: '#FAF9F6',
    padding: 20,
    paddingBottom: 10,
  },
  brand: {
    fontSize: 11,
    color: '#999',
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_600SemiBold',
    marginBottom: 6,
  },
  name: {
    fontSize: 26,
    color: '#000',
    lineHeight: 32,
    fontFamily: 'PlayfairDisplay_500Medium',
    marginBottom: 10,
  },
  price: {
    fontSize: 22,
    color: '#000',
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 14,
  },
  catTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 20,
  },
  catTagText: {
    fontSize: 10,
    color: '#888',
    letterSpacing: 1.5,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  sizeSection: { marginBottom: 24 },
  sizeLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#555',
    fontFamily: 'CormorantGaramond_700Bold',
    marginBottom: 12,
  },
  sizeRow: { flexDirection: 'row', gap: 10 },
  sizeBtn: {
    minWidth: 46,
    height: 46,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  sizeBtnActive: { backgroundColor: '#000', borderColor: '#000' },
  sizeBtnText: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  sizeBtnTextActive: { color: '#FFF' },
  descSection: { marginBottom: 20 },
  descLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#555',
    fontFamily: 'CormorantGaramond_700Bold',
    marginBottom: 10,
  },
  desc: {
    fontSize: 15,
    color: '#555',
    lineHeight: 24,
    fontFamily: 'CormorantGaramond_400Regular',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    gap: 14,
  },
  footerPrice: { flex: 1 },
  footerPriceLabel: {
    fontSize: 10,
    color: '#AAA',
    letterSpacing: 1.5,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  footerPriceValue: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'PlayfairDisplay_700Bold',
    marginTop: 2,
  },
  cartBtn: {
    flex: 2,
    backgroundColor: '#000',
    flexDirection: 'row',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  cartBtnAdded: { backgroundColor: '#10B981' },
  cartBtnText: {
    color: '#FFF',
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_700Bold',
  },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, ScrollView, View, Text, SafeAreaView,
  StatusBar, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { Search } from 'lucide-react-native';

interface Product {
  p_id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  stock: number;
  lowStockThreshold: number;
  image?: string;  // CDN URL from API
  img?: string;    // fallback
}

const CATEGORIES = ['ALL', 'NEW', 'ETHNIC', 'WESTERN', 'ACCESSORIES'];

export default function ShopScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [selectedCategory, products]);

  const fetchProducts = async () => {
    try {
      setError(null);
      console.log('[Shop] Fetching from:', `${API_BASE_URL}/products`);
      const response = await axios.get(`${API_BASE_URL}/products`, { timeout: 10000 });
      console.log('[Shop] Got', response.data.length, 'products');
      setProducts(response.data);
    } catch (err: any) {
      console.error('[Shop] Error:', err.message, err.code);
      setError(`Could not load products.\n${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, []);

  const filterProducts = () => {
    if (selectedCategory === 'ALL') {
      setFilteredProducts(products);
    } else if (selectedCategory === 'NEW') {
      setFilteredProducts([...products].sort((a, b) => b.p_id - a.p_id).slice(0, 20));
    } else {
      const q = selectedCategory.toLowerCase();
      setFilteredProducts(products.filter(p =>
        (p.category || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q)
      ));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
        <View style={styles.header}>
          <Text style={styles.brand}>CALIDI</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>CURATING YOUR COLLECTION...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
        <View style={styles.header}>
          <Text style={styles.brand}>CALIDI</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchProducts}>
            <Text style={styles.retryBtnText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>CALIDI</Text>
        <TouchableOpacity>
          <Search size={22} color="#000" strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setSelectedCategory(cat)}
            style={[styles.catTab, selectedCategory === cat && styles.catTabActive]}
          >
            <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products Grid */}
      <FlatList
        data={filteredProducts}
        numColumns={2}
        keyExtractor={(item) => String(item.p_id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/product/${item.p_id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.imgBox}>
              <Image
                source={{ uri: item.image || item.img || '' }}
                style={styles.img}
                resizeMode="cover"
              />
              {item.stock <= (item.lowStockThreshold || 10) && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>LIMITED</Text>
                </View>
              )}
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.cardPrice}>Rs. {item.price?.toLocaleString()}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No items in this collection</Text>
          </View>
        }
        contentContainerStyle={styles.grid}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
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
  brand: {
    fontSize: 24,
    letterSpacing: 6,
    color: '#000',
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#FAF9F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 11,
    letterSpacing: 2,
    color: '#888',
    fontFamily: 'CormorantGaramond_500Medium',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'CormorantGaramond_400Regular',
    marginBottom: 24,
  },
  retryBtn: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  retryBtnText: {
    fontSize: 12,
    letterSpacing: 2,
    color: '#000',
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  catScroll: {
    backgroundColor: '#FAF9F6',
    flexGrow: 0,
  },
  catContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  catTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  catTabActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  catText: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#888',
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  catTextActive: {
    color: '#FFF',
  },
  grid: {
    padding: 8,
  },
  card: {
    flex: 1,
    margin: 8,
    backgroundColor: '#FFFFFF',
  },
  imgBox: {
    aspectRatio: 0.75,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    position: 'relative',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#FFF',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  cardInfo: {
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  cardName: {
    fontSize: 13,
    color: '#222',
    letterSpacing: 0.3,
    lineHeight: 18,
    fontFamily: 'CormorantGaramond_500Medium',
  },
  cardPrice: {
    fontSize: 14,
    color: '#000',
    marginTop: 4,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'CormorantGaramond_400Regular',
  },
});

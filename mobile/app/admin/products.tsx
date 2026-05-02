import React, { useEffect, useState } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl, Alert, TextInput, Image, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { ChevronLeft, Package, Trash2, Edit3, X } from 'lucide-react-native';

export default function AdminProductsScreen() {
  const { token, isAdmin } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin && token) fetchProducts();
  }, [isAdmin, token]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/mobile/admin/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data);
    } catch (e: any) {
      console.error('[Admin Products] Error:', e.message);
      Alert.alert('Error', 'Failed to fetch products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deleteProduct = (pid: number) => {
    Alert.alert('Delete Product', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await axios.delete(`${API_BASE_URL}/mobile/admin/products/${pid}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          fetchProducts();
        } catch (e) {
          Alert.alert('Error', 'Failed to delete product');
        }
      }}
    ]);
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setEditName(product.name || '');
    setEditPrice(String(product.price || 0));
    setEditStock(String(product.stock || 0));
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingProduct(null);
  };

  const saveProductEdit = async () => {
    if (!editName || !editPrice || !editStock) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    try {
      setSaving(true);
      await axios.put(`${API_BASE_URL}/mobile/admin/products/${editingProduct.p_id}`, {
        name: editName,
        price: Number(editPrice),
        stock: Number(editStock)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      closeEditModal();
      fetchProducts();
    } catch (e: any) {
      console.error('[Edit Product Error]', e.message);
      Alert.alert('Error', 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#000" strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MANAGE PRODUCTS</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => String(item.p_id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchProducts} tintColor="#000" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Package size={48} color="#DDD" strokeWidth={1} />
            <Text style={styles.emptyTitle}>No Products Found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image 
              source={{ uri: item.image || item.img || 'https://via.placeholder.com/150' }} 
              style={styles.thumbnail} 
              resizeMode="cover"
            />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.pid}>PID: {item.p_id} | {item.category}</Text>
              <View style={styles.priceStockRow}>
                <Text style={styles.price}>Rs. {item.price?.toLocaleString()}</Text>
                <View style={[styles.stockBadge, item.stock < 10 ? styles.stockLow : styles.stockGood]}>
                  <Text style={styles.stockText}>Stock: {item.stock}</Text>
                </View>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
                <Edit3 size={18} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteProduct(item.p_id)} style={[styles.actionBtn, styles.deleteBtn]}>
                <Trash2 size={18} color="#E53935" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* EDIT MODAL */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>EDIT PRODUCT</Text>
              <TouchableOpacity onPress={closeEditModal} style={styles.closeBtn}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>PRODUCT NAME</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>PRICE (Rs.)</Text>
                <TextInput
                  style={styles.input}
                  value={editPrice}
                  onChangeText={setEditPrice}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>STOCK QTY</Text>
                <TextInput
                  style={styles.input}
                  value={editStock}
                  onChangeText={setEditStock}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={saveProductEdit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>SAVE CHANGES</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  headerTitle: { fontSize: 16, color: '#000', letterSpacing: 2, fontFamily: 'PlayfairDisplay_600SemiBold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyTitle: { marginTop: 16, fontSize: 16, color: '#888', fontFamily: 'CormorantGaramond_600SemiBold' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#FFF',
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 60,
    height: 80,
    backgroundColor: '#F5F5F5',
    marginRight: 12,
  },
  info: { flex: 1, paddingRight: 8 },
  name: { fontSize: 14, color: '#000', fontFamily: 'CormorantGaramond_700Bold', marginBottom: 4 },
  pid: { fontSize: 11, color: '#888', fontFamily: 'CormorantGaramond_500Medium', marginBottom: 6 },
  priceStockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 13, color: '#333', fontFamily: 'CormorantGaramond_600SemiBold' },
  stockBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stockGood: { backgroundColor: '#E8F5E9' },
  stockLow: { backgroundColor: '#FFEBEE' },
  stockText: { fontSize: 9, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 1 },
  actions: { flexDirection: 'column', gap: 8 },
  actionBtn: { padding: 8, backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  deleteBtn: { backgroundColor: '#FFF', borderColor: '#FFEBEE' },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 16,
    color: '#000',
    letterSpacing: 2,
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },
  closeBtn: { padding: 4 },
  formGroup: { marginBottom: 16 },
  formRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#666',
    fontFamily: 'CormorantGaramond_600SemiBold',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'CormorantGaramond_500Medium',
  },
  saveBtn: {
    backgroundColor: '#000',
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: 'CormorantGaramond_700Bold',
  },
});

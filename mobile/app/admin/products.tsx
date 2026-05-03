import React, { useEffect, useState } from 'react';
import {
  StyleSheet, FlatList, TouchableOpacity, View, Text,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl, Alert, TextInput, Image, Modal, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/Config';
import { ChevronLeft, Package, Trash2, Edit3, X, Plus, Camera, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

export default function AdminProductsScreen() {
  const { token, isAdmin } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPid, setEditingPid] = useState<number | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const msg = 'Sorry, we need camera roll permissions to make this work!';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Permission Denied', msg);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.5,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImageAndGetId = async (uri: string): Promise<string | null> => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'product.jpg';
      
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('image', blob, filename);
      } else {
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        // @ts-ignore
        formData.append('image', { uri, name: filename, type });
      }

      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      });

      // We need the raw GridFS files_id string
      // The upload route returns { url: ".../image/ID" }
      const urlParts = response.data.url.split('/');
      return urlParts[urlParts.length - 1];
    } catch (e) {
      console.error('[Upload] Failed:', e);
      return null;
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingPid(null);
    setName('');
    setPrice('');
    setStock('');
    setBrand('CALIDI');
    setCategory('Boutique');
    setSelectedImage(null);
    setModalVisible(true);
  };

  const openEditModal = (product: any) => {
    setIsEditing(true);
    setEditingPid(product.p_id);
    setName(product.name || '');
    setPrice(String(product.price || 0));
    setStock(String(product.stock || 0));
    setBrand(product.brand || '');
    setCategory(product.category || '');
    setSelectedImage(product.image || product.img || null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !price || !stock) {
      const msg = 'Please fill all required fields';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
      return;
    }

    setSaving(true);
    try {
      let imageId = null;
      // If selectedImage is a local URI (not a http URL), upload it
      if (selectedImage && !selectedImage.startsWith('http')) {
        imageId = await uploadImageAndGetId(selectedImage);
      }

      const payload = {
        name,
        price: Number(price),
        stock: Number(stock),
        brand,
        category,
        ...(imageId && { image_id: imageId })
      };

      if (isEditing && editingPid) {
        await axios.put(`${API_BASE_URL}/mobile/admin/products/${editingPid}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_BASE_URL}/mobile/admin/products`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setModalVisible(false);
      fetchProducts();
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Failed to save product';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = (pid: number) => {
    const performDelete = async () => {
      try {
        await axios.delete(`${API_BASE_URL}/mobile/admin/products/${pid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchProducts();
      } catch (e) {
        if (Platform.OS !== 'web') Alert.alert('Error', 'Failed to delete product');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this product?')) performDelete();
    } else {
      Alert.alert('Delete Product', 'Are you sure you want to delete this product?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete }
      ]);
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
        <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
          <Plus size={22} color="#000" />
        </TouchableOpacity>
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

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'EDIT PRODUCT' : 'ADD PRODUCT'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {selectedImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                    <View style={styles.imageOverlay}>
                      <Camera size={20} color="#FFF" />
                      <Text style={styles.changeText}>CHANGE PHOTO</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <ImageIcon size={32} color="#AAA" />
                    <Text style={styles.placeholderText}>TAP TO UPLOAD PHOTO</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.formGroup}>
                <Text style={styles.label}>PRODUCT NAME</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Elegant Silk Saree" />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>PRICE (Rs.)</Text>
                  <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="4500" />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>STOCK QTY</Text>
                  <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="numeric" placeholder="10" />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>BRAND</Text>
                  <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="CALIDI" />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>CATEGORY</Text>
                  <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Saree" />
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{isEditing ? 'SAVE CHANGES' : 'CREATE PRODUCT'}</Text>}
              </TouchableOpacity>
            </ScrollView>
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
  addBtn: { padding: 4 },
  headerTitle: { fontSize: 13, color: '#000', letterSpacing: 2, fontFamily: 'PlayfairDisplay_600SemiBold' },
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
  thumbnail: { width: 60, height: 80, backgroundColor: '#F5F5F5', marginRight: 12 },
  info: { flex: 1, paddingRight: 8 },
  name: { fontSize: 14, color: '#000', fontFamily: 'CormorantGaramond_700Bold', marginBottom: 4 },
  pid: { fontSize: 10, color: '#888', fontFamily: 'CormorantGaramond_500Medium', marginBottom: 6 },
  priceStockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 13, color: '#333', fontFamily: 'CormorantGaramond_600SemiBold' },
  stockBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stockGood: { backgroundColor: '#E8F5E9' },
  stockLow: { backgroundColor: '#FFEBEE' },
  stockText: { fontSize: 9, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 1 },
  actions: { flexDirection: 'column', gap: 8 },
  actionBtn: { padding: 8, backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  deleteBtn: { backgroundColor: '#FFF', borderColor: '#FFEBEE' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 16, color: '#000', letterSpacing: 2, fontFamily: 'PlayfairDisplay_600SemiBold' },
  closeBtn: { padding: 4 },
  
  imagePicker: { width: '100%', height: 200, backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 24, overflow: 'hidden' },
  imagePlaceholder: { alignItems: 'center', gap: 12 },
  placeholderText: { fontSize: 10, color: '#AAA', fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 1 },
  imagePreviewContainer: { width: '100%', height: '100%', position: 'relative' },
  imagePreview: { width: '100%', height: '100%' },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  changeText: { color: '#FFF', fontSize: 10, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 1 },

  formGroup: { marginBottom: 16 },
  formRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 10, letterSpacing: 1.5, color: '#666', fontFamily: 'CormorantGaramond_600SemiBold', marginBottom: 6 },
  input: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#E0E0E0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'CormorantGaramond_500Medium' },
  saveBtn: { backgroundColor: '#000', padding: 16, alignItems: 'center', marginTop: 10, marginBottom: 40 },
  saveBtnText: { color: '#FFF', fontSize: 12, letterSpacing: 2, fontFamily: 'CormorantGaramond_700Bold' },
});

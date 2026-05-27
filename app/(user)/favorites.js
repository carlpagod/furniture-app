import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { COLORS, RADIUS, FURNITURE_IMAGES, FONTS, SEED_FURNITURE, COLOR_OPTIONS, MATERIAL_OPTIONS } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedButton from '../../components/AnimatedButton';

const parseProductColors = (colorsField) => {
  if (!colorsField) return [];
  if (Array.isArray(colorsField)) return colorsField;
  if (typeof colorsField === 'string') {
    try {
      const parsed = JSON.parse(colorsField);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) { }
    if (colorsField.startsWith('[') && colorsField.endsWith(']')) {
      try {
        const cleaned = colorsField.replace(/'/g, '"');
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) { }
    }
    if (colorsField.includes(',')) {
      return colorsField.split(',').map(c => c.trim());
    }
    return [colorsField.trim()];
  }
  return [];
};

const parseProductMaterials = (materialsField) => {
  if (!materialsField) return [];
  if (Array.isArray(materialsField)) return materialsField;
  if (typeof materialsField === 'string') {
    try {
      const parsed = JSON.parse(materialsField);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) { }
    if (materialsField.startsWith('[') && materialsField.endsWith(']')) {
      try {
        const cleaned = materialsField.replace(/'/g, '"');
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) { }
    }
    if (materialsField.includes(',')) {
      return materialsField.split(',').map(c => c.trim());
    }
    return [materialsField.trim()];
  }
  return [];
};

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cartItems, setCartItems] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [selectedQty, setSelectedQty] = useState(1);

  const [showCustomColor, setShowCustomColor] = useState(false);
  const [customColor, setCustomColor] = useState('');
  const [showCustomMaterial, setShowCustomMaterial] = useState(false);
  const [customMaterial, setCustomMaterial] = useState('');
  const [productColors, setProductColors] = useState([]);
  const [productMaterials, setProductMaterials] = useState([]);
  const [materialsList, setMaterialsList] = useState(MATERIAL_OPTIONS);

  async function loadData() {
    try {
      // 1. Load favorites list
      const favsStr = await AsyncStorage.getItem(`favorites_${user?.id || 'demo'}`);
      const favIds = favsStr ? JSON.parse(favsStr) : [];
      setFavorites(favIds);

      // 2. Load furniture items
      let loadedItems = [];
      const localAdminItems = await AsyncStorage.getItem('admin_furniture');
      const localItems = localAdminItems ? JSON.parse(localAdminItems) : [];

      let dbItems = [];
      if (user?.id !== 'demo-admin-id' && user?.id !== 'demo-customer-id') {
        let data = null, error = null;
        try {
          const result = await Promise.race([
            supabase.from('furniture').select('*'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('favorites timeout')), 5000)),
          ]);
          data = result?.data;
          error = result?.error;
        } catch (timeoutErr) {
          console.warn('Favorites: Supabase timed out');
        }
        if (!error && data) {
          dbItems = data;
        }
      }

      // Combine all sources: dbItems, localItems, and SEED_FURNITURE to guarantee favorited items display!
      const itemMap = new Map();
      SEED_FURNITURE.forEach(item => {
        itemMap.set(String(item.id), item);
      });
      localItems.forEach(item => {
        itemMap.set(String(item.id), item);
      });
      dbItems.forEach(item => {
        itemMap.set(String(item.id), item);
      });
      loadedItems = Array.from(itemMap.values());

      // Proactively patch cabinet image if needed
      loadedItems = loadedItems.map(i => {
        if (i.image_url && i.image_url.includes('photo-1558997519-83ea9252eaf8')) {
          return { ...i, image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80' };
        }
        return i;
      });

      setItems(loadedItems);

      // 3. Load cart items to check in-cart status
      const cartKey = `cart_${user?.id || 'demo'}`;
      const cartStr = await AsyncStorage.getItem(cartKey);
      setCartItems(cartStr ? JSON.parse(cartStr) : []);

      // 4. Load custom materials
      try {
        const storedMats = await AsyncStorage.getItem('admin_materials');
        const mats = storedMats ? JSON.parse(storedMats) : MATERIAL_OPTIONS;
        setMaterialsList(mats);
      } catch (_) {
        setMaterialsList(MATERIAL_OPTIONS);
      }

    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [user]);

  async function toggleFavorite(id) {
    const updated = favorites.filter(fid => String(fid) !== String(id));
    setFavorites(updated);
    try {
      await AsyncStorage.setItem(`favorites_${user?.id || 'demo'}`, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
  }

  async function handleCartPress(item) {
    if (!user) { Alert.alert('Sign in required', 'Please sign in to add items to cart.'); return; }

    const existing = cartItems.find(c => c.furniture_id === item.id);
    setSelectedProduct(item);

    const colors = parseProductColors(item.colors);
    setProductColors(colors);
    const mats = parseProductMaterials(item.material);
    setProductMaterials(mats);
    setShowCustomColor(false);
    setShowCustomMaterial(false);
    setCustomColor('');
    setCustomMaterial('');

    if (existing) {
      setSelectedColor(existing.selected_color || colors[0] || '#8B5E3C');
      setSelectedMaterial(existing.selected_material || mats[0] || 'Wood');
      setSelectedQty(existing.quantity || 1);
    } else {
      setSelectedColor(colors[0] || '#8B5E3C');
      setSelectedMaterial(mats[0] || 'Wood');
      setSelectedQty(1);
    }
    setModalVisible(true);
  }

  async function confirmAddToCart() {
    if (!selectedProduct) return;
    setModalVisible(false);
    try {
      const cartKey = `cart_${user.id}`;
      const localCart = await AsyncStorage.getItem(cartKey);
      let cart = localCart ? JSON.parse(localCart) : [];

      const existingIdx = cart.findIndex(c => c.furniture_id === selectedProduct.id);
      if (existingIdx !== -1) {
        cart[existingIdx].quantity = selectedQty;
        cart[existingIdx].selected_color = selectedColor;
        cart[existingIdx].selected_material = selectedMaterial;
      } else {
        cart.push({
          id: `cart-item-${Date.now()}`,
          furniture_id: selectedProduct.id,
          quantity: selectedQty,
          selected_color: selectedColor,
          selected_material: selectedMaterial,
          furniture: selectedProduct
        });
      }

      await AsyncStorage.setItem(cartKey, JSON.stringify(cart));
      setCartItems(cart);

      if (user.id !== 'demo-customer-id' && user.id !== 'demo-admin-id') {
        try {
          const { data: existing } = await supabase.from('cart_items').select('id, quantity').eq('user_id', user.id).eq('furniture_id', selectedProduct.id).single();
          if (existing) {
            await supabase.from('cart_items').update({
              quantity: selectedQty,
              selected_color: selectedColor,
            }).eq('id', existing.id);
          } else {
            await supabase.from('cart_items').insert({
              user_id: user.id,
              furniture_id: selectedProduct.id,
              quantity: selectedQty,
              selected_color: selectedColor,
            });
          }
        } catch (_) { /* offline graceful */ }
      }
    } catch (e) {
      console.warn('Favorites modal confirm add cart error:', e);
    } finally {
      setSelectedProduct(null);
    }
  }

  async function addCustomMaterial() {
    const val = customMaterial.trim();
    if (val) {
      const formattedVal = val.charAt(0).toUpperCase() + val.slice(1);
      const storedMats = await AsyncStorage.getItem('admin_materials');
      let matsList = storedMats ? JSON.parse(storedMats) : ['Wood', 'Metal', 'Leather', 'Fabric', 'Marble'];

      if (matsList.includes(formattedVal)) {
        Alert.alert('Duplicate Material', 'This material already exists.');
        return;
      }
      const updated = [...matsList, formattedVal];
      setSelectedMaterial(formattedVal);
      setCustomMaterial('');
      setShowCustomMaterial(false);
      try {
        await AsyncStorage.setItem('admin_materials', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }
  }

  function addCustomColor() {
    if (customColor.trim()) {
      const hex = customColor.trim().startsWith('#') ? customColor.trim() : '#' + customColor.trim();
      if (!productColors.includes(hex)) {
        setProductColors(prev => [...prev, hex]);
      }
      setSelectedColor(hex);
      setCustomColor('');
      setShowCustomColor(false);
    }
  }

  async function removeCartItemFromModal() {
    if (!selectedProduct) return;
    setModalVisible(false);
    try {
      const cartKey = `cart_${user.id}`;
      const filtered = cartItems.filter(c => c.furniture_id !== selectedProduct.id);
      setCartItems(filtered);
      await AsyncStorage.setItem(cartKey, JSON.stringify(filtered));

      if (user.id !== 'demo-customer-id' && user.id !== 'demo-admin-id') {
        try {
          await supabase.from('cart_items').delete().eq('user_id', user.id).eq('furniture_id', selectedProduct.id);
        } catch (e) {
          console.warn('Supabase modal remove failed:', e);
        }
      }
    } catch (e) {
      console.warn('Modal remove item error:', e);
    } finally {
      setSelectedProduct(null);
    }
  }

  function getImage(item) {
    const url = item?.image_url;
    if (url && typeof url === 'string' && url.trim().length > 0) {
      return { uri: url.trim() };
    }
    const rawCat = item?.category || '';
    const cat = rawCat ? rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase() : '';
    return { uri: FURNITURE_IMAGES[cat] || FURNITURE_IMAGES.placeholder };
  }

  // Filter only items that are favorited using type-robust string comparisons
  const favoritedItems = items.filter(item => favorites.map(String).includes(String(item.id)));

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.black} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>My Favorites</Text>
        </View>
        <Text style={styles.countText}>{favoritedItems.length} items</Text>
      </View>

      <FlatList
        data={favoritedItems}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.black} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.heartCircle}>
              <MaterialCommunityIcons name="heart-outline" size={48} color="#D67A32" />
            </View>
            <Text style={styles.emptyTitle}>Your favorites are empty</Text>
            <Text style={styles.emptyDesc}>Save items you love here to find them easily later!</Text>
            <AnimatedButton
              style={styles.browseBtn}
              onPress={() => router.push('/(user)/home')}
            >
              <Text style={styles.browseBtnText}>Explore Furniture</Text>
            </AnimatedButton>
          </View>
        }
        renderItem={({ item }) => {
          const inCart = cartItems.some(c => c.furniture_id === item.id);
          return (
            <View style={styles.card}>
              <Image source={getImage(item)} style={styles.image} resizeMode="cover" />
              <View style={styles.body}>
                <View style={styles.topRow}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={styles.heartBtn}>
                    <MaterialCommunityIcons name="heart" size={20} color="#D67A32" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.cat}>{item.category}</Text>
                <Text style={styles.price}>
                  ₱{Number(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.detailsBtn}
                    onPress={() => router.push(`/(user)/product/${item.id}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.detailsBtnText}>Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cartBtn, inCart && styles.cartBtnAdded]}
                    onPress={() => handleCartPress(item)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <MaterialCommunityIcons
                        name={inCart ? "pencil" : "cart-plus"}
                        size={14}
                        color={inCart ? COLORS.themeButtonBg : COLORS.white}
                      />
                      <Text style={[styles.cartBtnText, inCart && styles.cartBtnTextAdded]}>
                        {inCart ? 'Edit' : 'Add to Cart'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Variation Selection Pop-up Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>Select Variation</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={22} color={COLORS.themeText} />
              </TouchableOpacity>
            </View>

            {selectedProduct && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {/* Product Brief */}
                <View style={styles.briefRow}>
                  <Image source={getImage(selectedProduct)} style={styles.briefImage} resizeMode="cover" />
                  <View style={styles.briefDetails}>
                    <Text style={styles.briefName} numberOfLines={1}>{selectedProduct.name}</Text>
                    <Text style={styles.briefCat}>{selectedProduct.category}</Text>
                    <Text style={styles.briefPrice}>
                      ₱{Number(selectedProduct.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>

                {/* Color Selection */}
                <Text style={styles.sectionLabel}>Color Variation</Text>
                <View style={styles.variationRow}>
                  {COLOR_OPTIONS.filter(c => productColors.map(col => String(col).trim().toLowerCase()).includes(c.value.toLowerCase())).map(color => {
                    const isSel = selectedColor?.toLowerCase() === color.value.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={color.value}
                        style={[styles.colorBubble, { backgroundColor: color.value }, isSel && styles.colorBubbleActive]}
                        onPress={() => setSelectedColor(color.value)}
                      >
                        {isSel && (
                          <MaterialCommunityIcons
                            name="check"
                            size={16}
                            color={color.value.toLowerCase() === '#ffffff' ? '#000000' : '#FFFFFF'}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {productColors.filter(c => !COLOR_OPTIONS.find(o => o.value.toLowerCase() === c.toLowerCase())).map(color => {
                    const isSel = selectedColor?.toLowerCase() === color.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={color}
                        style={[styles.colorBubble, { backgroundColor: color }, isSel && styles.colorBubbleActive]}
                        onPress={() => setSelectedColor(color)}
                      >
                        {isSel && (
                          <MaterialCommunityIcons
                            name="check"
                            size={16}
                            color={color.toLowerCase() === '#ffffff' ? '#000000' : '#FFFFFF'}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                </View>

                {/* Material Selection */}
                {productMaterials.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>Material Variation</Text>
                    <View style={styles.variationRow}>
                      {productMaterials.map(mat => {
                        const isActive = selectedMaterial?.toLowerCase() === mat.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={mat}
                            style={[
                              styles.matChip,
                              isActive && styles.matChipActive,
                            ]}
                            onPress={() => setSelectedMaterial(mat)}
                          >
                            <Text style={[styles.matChipText, isActive && styles.matChipTextActive]}>
                              {mat}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* Quantity Row */}
                <View style={styles.qtyContainer}>
                  <Text style={styles.sectionLabel}>Quantity</Text>
                  <View style={styles.qtySelector}>
                    <TouchableOpacity
                      style={styles.qtyAdjustBtn}
                      onPress={() => setSelectedQty(prev => Math.max(1, prev - 1))}
                    >
                      <Text style={styles.qtyAdjustText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyVal}>{selectedQty}</Text>
                    <TouchableOpacity
                      style={styles.qtyAdjustBtn}
                      onPress={() => setSelectedQty(prev => prev + 1)}
                    >
                      <Text style={styles.qtyAdjustText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Action Button */}
                <AnimatedButton style={styles.modalAddBtn} onPress={confirmAddToCart}>
                  <Text style={styles.modalAddBtnText}>
                    {cartItems.some(c => c.furniture_id === selectedProduct.id) ? 'Save Changes' : 'Confirm Add'} • ₱{(Number(selectedProduct.price) * selectedQty).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Text>
                </AnimatedButton>

                {cartItems.some(c => c.furniture_id === selectedProduct.id) && (
                  <AnimatedButton style={[styles.modalAddBtn, { backgroundColor: '#EF4444', marginTop: 10 }]} onPress={removeCartItemFromModal}>
                    <Text style={styles.modalAddBtnText}>Remove from Cart</Text>
                  </AnimatedButton>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.themeInputBorder,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  backArrow: { fontSize: 24, color: COLORS.themeText, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  countText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary },
  list: { padding: 16, paddingBottom: 100, gap: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.themeCardBg,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.themeCardBorder,
  },
  image: { width: 100, height: '100%', alignSelf: 'stretch', backgroundColor: COLORS.themeInputBg },
  body: { flex: 1, padding: 12, gap: 2 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { flex: 1, fontSize: 14, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText, marginRight: 8 },
  heartBtn: { padding: 4 },
  cat: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary },
  price: { fontSize: 14, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText, marginVertical: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  detailsBtn: {
    width: 75,
    backgroundColor: COLORS.themeInputBg,
    borderWidth: 1,
    borderColor: COLORS.themeInputBorder,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtnText: { color: COLORS.themeText, fontSize: 11, fontFamily: FONTS.bold, fontWeight: '700' },
  cartBtn: {
    width: 105,
    backgroundColor: COLORS.themeButtonBg,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtnAdded: {
    backgroundColor: COLORS.themeInputBg,
    borderWidth: 1,
    borderColor: COLORS.themeButtonBg,
  },
  cartBtnText: { color: COLORS.white, fontSize: 11, fontFamily: FONTS.bold, fontWeight: '700' },
  cartBtnTextAdded: { color: COLORS.themeButtonBg },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 16, paddingHorizontal: 32 },
  heartCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FDDAB5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D67A32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  emptyDesc: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, textAlign: 'center', lineHeight: 18 },
  browseBtn: {
    backgroundColor: COLORS.themeButtonBg,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    shadowColor: COLORS.themeText,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  browseBtnText: { color: COLORS.white, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 14 },

  // Modal Styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.themeBeige, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.themeInputBorder, paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  closeBtn: { padding: 4 },
  briefRow: { flexDirection: 'row', gap: 12, marginBottom: 20, backgroundColor: COLORS.themeCardBg, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.themeCardBorder },
  briefImage: { width: 70, height: 70, borderRadius: RADIUS.sm },
  briefDetails: { flex: 1, justifyContent: 'center', gap: 2 },
  briefName: { fontSize: 15, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText },
  briefCat: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary },
  briefPrice: { fontSize: 14, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  sectionLabel: { fontSize: 13, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText, marginVertical: 8 },
  variationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  colorBubble: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 1 },
  colorBubbleActive: { borderColor: COLORS.themeButtonBg },
  matChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.themeInputBg, borderWidth: 1.5, borderColor: COLORS.themeInputBorder },
  matChipActive: { backgroundColor: COLORS.themeButtonBg, borderColor: COLORS.themeButtonBg },
  matChipText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.themeText },
  matChipTextActive: { color: COLORS.white, fontWeight: '700' },
  qtyContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.themeInputBorder, paddingTop: 16, paddingBottom: 8 },
  qtySelector: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.themeInputBorder, borderRadius: RADIUS.md, backgroundColor: COLORS.themeInputBg, overflow: 'hidden' },
  qtyAdjustBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  qtyAdjustText: { fontSize: 20, fontWeight: '600', color: COLORS.themeText },
  qtyVal: { fontSize: 15, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText, paddingHorizontal: 12 },
  modalAddBtn: { backgroundColor: COLORS.themeButtonBg, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  modalAddBtnText: { color: COLORS.white, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 14 },
  addColorBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder, justifyContent: 'center', alignItems: 'center' },
  addColorText: { fontSize: 16, color: COLORS.themeTextSecondary, fontWeight: 'bold' },
  input: { backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.themeText },
  addBtn: { backgroundColor: COLORS.themeDarkBrown, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 14 },
});

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Image,
  useWindowDimensions, Animated, Modal, ScrollView,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { COLORS, CATEGORIES, RADIUS, FURNITURE_IMAGES, FONTS, SEED_FURNITURE, COLOR_OPTIONS, MATERIAL_OPTIONS } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AnimatedButton from '../../components/AnimatedButton';

const PAGE_SIZE = 6;

function getImageSource(item) {
  const url = item?.image_url;
  if (url && typeof url === 'string' && url.trim().length > 0) return { uri: url.trim() };
  const cat = (item?.category || '');
  const nc = cat ? cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase() : '';
  return { uri: FURNITURE_IMAGES[nc] || FURNITURE_IMAGES.placeholder };
}

function ProductImage({ item, style }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cat = (item?.category || '');
  const nc = cat ? cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase() : '';
  const fallbackSource = { uri: FURNITURE_IMAGES[nc] || FURNITURE_IMAGES.placeholder };
  const source = failed ? fallbackSource : getImageSource(item);

  const onLoad = () => {
    setLoaded(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  return (
    <View style={style}>
      {!loaded && (
        <View style={[style, styles.imagePlaceholder]}>
          <ActivityIndicator size="small" color={COLORS.themeButtonBg} />
        </View>
      )}
      <Animated.Image
        source={source}
        style={[style, { opacity: fadeAnim, position: loaded ? 'relative' : 'absolute' }]}
        resizeMode="cover"
        onLoad={onLoad}
        onError={() => { setFailed(true); onLoad(); }}
      />
    </View>
  );
}

const parseProductColors = (colorsField) => {
  if (!colorsField) return [];
  if (Array.isArray(colorsField)) return colorsField;
  if (typeof colorsField === 'string') {
    try {
      const parsed = JSON.parse(colorsField);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    if (colorsField.startsWith('[') && colorsField.endsWith(']')) {
      try {
        const cleaned = colorsField.replace(/'/g, '"');
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
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
    } catch (_) {}
    if (materialsField.startsWith('[') && materialsField.endsWith(']')) {
      try {
        const cleaned = materialsField.replace(/'/g, '"');
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
    if (materialsField.includes(',')) {
      return materialsField.split(',').map(c => c.trim());
    }
    return [materialsField.trim()];
  }
  return [];
};

function StarRating({ rating, count, productId, productName, small }) {
  let finalRating = rating;
  let finalCount = count;

  if (!finalRating) {
    let hash = 0;
    const str = String(productId || productName || '');
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    finalRating = 4.3 + (Math.abs(hash) % 7) * 0.1;
    finalCount = 24 + (Math.abs(hash) % 165);
  }

  const full = Math.floor(finalRating);
  const half = finalRating - full >= 0.5;
  const stars = [];
  
  for (let i = 1; i <= 5; i++) {
    if (i <= full) {
      stars.push(<MaterialCommunityIcons key={i} name="star" size={small ? 11 : 13} color="#D97706" />);
    } else if (i === full + 1 && half) {
      stars.push(<MaterialCommunityIcons key={i} name="star-half-full" size={small ? 11 : 13} color="#D97706" />);
    } else {
      stars.push(<MaterialCommunityIcons key={i} name="star-outline" size={small ? 11 : 13} color="#D97706" />);
    }
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>{stars}</View>
      <Text style={{ fontSize: small ? 10 : 11, color: COLORS.themeTextSecondary, fontFamily: FONTS.regular, marginLeft: 2 }}>
        {finalRating.toFixed(1)} ({finalCount})
      </Text>
    </View>
  );
}

function CartToast({ visible }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  return (
    <Animated.View style={[styles.cartToast, { opacity: fadeAnim }]} pointerEvents="none">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <MaterialCommunityIcons name="cart-arrow-down" size={16} color={COLORS.white} />
        <Text style={styles.cartToastText}>Added to Cart</Text>
      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const numColumns = windowWidth >= 900 ? 3 : 2;
  const HPAD = 16;
  const GAP = 10;
  const cardWidth = (windowWidth - HPAD * 2 - GAP * (numColumns - 1)) / numColumns;

  const [furniture, setFurniture] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [displayed, setDisplayed] = useState([]);
  const [search, setSearch] = useState('');
  const [categoriesList, setCategoriesList] = useState(CATEGORIES);
  const [materialsList, setMaterialsList] = useState(['Wood', 'Metal', 'Leather', 'Fabric', 'Marble']);
  const [activeCategory, setActiveCategory] = useState('All');
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingItemId, setAddingItemId] = useState(null);
  const [addedItemId, setAddedItemId] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [selectedQty, setSelectedQty] = useState(1);
  const [page, setPage] = useState(1);
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef(null);

  const [showCustomColor, setShowCustomColor] = useState(false);
  const [customColor, setCustomColor] = useState('');
  const [showCustomMaterial, setShowCustomMaterial] = useState(false);
  const [customMaterial, setCustomMaterial] = useState('');
  const [productColors, setProductColors] = useState([]);
  const [productMaterials, setProductMaterials] = useState([]);

  const spinValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (loading) {
      Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 3000, useNativeDriver: true })).start();
    } else { spinValue.setValue(0); }
  }, [loading]);

  const logoSpin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const favBadgeAnim = useRef(new Animated.Value(0)).current;
  const cartBadgeAnim = useRef(new Animated.Value(0)).current;
  const prevFavLength = useRef(favorites.length);
  const prevCartCount = useRef(cartCount);

  useEffect(() => {
    if (favorites.length > 0 && favorites.length !== prevFavLength.current) {
      favBadgeAnim.setValue(15);
      Animated.spring(favBadgeAnim, {
        toValue: 0,
        friction: 4,
        tension: 60,
        useNativeDriver: true
      }).start();
    }
    prevFavLength.current = favorites.length;
  }, [favorites.length]);

  useEffect(() => {
    if (cartCount > 0 && cartCount !== prevCartCount.current) {
      cartBadgeAnim.setValue(15);
      Animated.spring(cartBadgeAnim, {
        toValue: 0,
        friction: 4,
        tension: 60,
        useNativeDriver: true
      }).start();
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  async function fetchCartCount() {
    try {
      const key = user?.id ? `cart_${user.id}` : null;
      if (!key) return;
      const localCart = await AsyncStorage.getItem(key);
      if (localCart) {
        const cart = JSON.parse(localCart);
        setCartItems(cart);
        setCartCount(cart.reduce((sum, c) => sum + (c.quantity || 1), 0));
      } else {
        setCartItems([]);
        setCartCount(0);
      }
    } catch (e) { console.warn(e); }
  }

  async function fetchFavorites() {
    try {
      const favs = await AsyncStorage.getItem(`favorites_${user?.id || 'demo'}`);
      if (favs) setFavorites(JSON.parse(favs));
    } catch (e) { console.warn(e); }
  }

  async function toggleFavorite(id) {
    const isFav = favorites.map(String).includes(String(id));
    const newFavs = isFav
      ? favorites.filter(fid => String(fid) !== String(id))
      : [...favorites, id];
    setFavorites(newFavs);
    try { await AsyncStorage.setItem(`favorites_${user?.id || 'demo'}`, JSON.stringify(newFavs)); }
    catch (e) { console.warn(e); }
  }

  async function fetchFurniture() {
    try {
      const localAdminItems = await AsyncStorage.getItem('admin_furniture');
      let localItems = localAdminItems ? JSON.parse(localAdminItems) : [];

      // Race the Supabase query against a 5-second timeout
      let data = null, error = null;
      try {
        const result = await Promise.race([
          supabase.from('furniture').select('*').eq('is_visible', true).order('created_at', { ascending: false }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('furniture timeout')), 5000)),
        ]);
        data = result?.data;
        error = result?.error;
      } catch (timeoutErr) {
        console.warn('Home: furniture fetch timed out — using offline fallback');
      }

      let combined;
      if (!error && data && data.length > 0) { combined = data; }
      else if (localItems.length > 0) { combined = localItems.filter(i => i.is_visible !== false); }
      else { combined = SEED_FURNITURE; }

      // Patch the known 404 cabinet image
      combined = combined.map(i => {
        if (i.image_url && i.image_url.includes('photo-1558997519-83ea9252eaf8')) {
          return { ...i, image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80' };
        }
        return i;
      });

      setFurniture(combined);
      applyFilters(combined, search, activeCategory, 1);
    } catch (e) {
      console.warn('Supabase failed, using offline data:', e);
      const combined = SEED_FURNITURE;
      setFurniture(combined);
      applyFilters(combined, search, activeCategory, 1);
    } finally { setLoading(false); setRefreshing(false); }
  }


  function applyFilters(data, q, cat, newPage = 1) {
    let result = data;
    if (cat !== 'All') result = result.filter(i => i.category === cat);
    if (q.trim()) result = result.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
    setFiltered(result);
    setPage(newPage);
    setDisplayed(result.slice(0, PAGE_SIZE * newPage));
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    setDisplayed(filtered.slice(0, PAGE_SIZE * nextPage));
  }

  useEffect(() => {
    if (furniture && furniture.length > 0) {
      const dbCats = furniture.map(i => i.category).filter(Boolean).map(c => c.trim());
      const uniqueCats = ['All', ...new Set([...CATEGORIES.filter(c => c !== 'All'), ...dbCats])];
      setCategoriesList(uniqueCats);

      const dbMats = furniture.map(i => i.material).filter(Boolean).map(m => m.trim());
      const uniqueMats = [...new Set([...MATERIAL_OPTIONS, ...dbMats])];
      setMaterialsList(uniqueMats);
    } else {
      setCategoriesList(CATEGORIES);
      setMaterialsList(MATERIAL_OPTIONS);
    }
  }, [furniture]);

  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
      fetchCartCount();
    }, [user])
  );

  useEffect(() => { fetchFurniture(); }, []);
  useEffect(() => { applyFilters(furniture, search, activeCategory, 1); }, [search, activeCategory, furniture]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchFurniture(); fetchFavorites(); fetchCartCount(); }, []);

  async function handleCartPress(item) {
    if (!user) { Alert.alert('Sign in required', 'Please sign in to add items to cart.'); return; }
    
    const existing = cartItems.find(c => c.furniture_id === item.id);
    setSelectedProduct(item);
    
    // Set custom variation states
    const colors = parseProductColors(item.colors);
    setProductColors(colors);
    const mats = parseProductMaterials(item.material);
    setProductMaterials(mats);
    setShowCustomColor(false);
    setShowCustomMaterial(false);
    setCustomColor('');
    setCustomMaterial('');

    if (existing) {
      // Edit mode: pre-populate selections
      setSelectedColor(existing.selected_color || colors[0] || '#8B5E3C');
      setSelectedMaterial(existing.selected_material || mats[0] || 'Wood');
      setSelectedQty(existing.quantity || 1);
    } else {
      // Add mode: default selections
      setSelectedColor(colors[0] || '#8B5E3C');
      setSelectedMaterial(mats[0] || 'Wood'); // Default material selection
      setSelectedQty(1);
    }
    setModalVisible(true);
  }

  async function confirmAddToCart() {
    if (!selectedProduct) return;
    setModalVisible(false);
    setAddingItemId(selectedProduct.id);
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
      setCartCount(cart.reduce((sum, c) => sum + (c.quantity || 1), 0));

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

      setAddedItemId(selectedProduct.id);
      setShowToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => { setAddedItemId(null); setShowToast(false); }, 1800);
    } catch (e) {
      console.warn('Add to cart error:', e);
    } finally {
      setAddingItemId(null);
      setSelectedProduct(null);
    }
  }

  async function addCustomMaterial() {
    const val = customMaterial.trim();
    if (val) {
      const formattedVal = val.charAt(0).toUpperCase() + val.slice(1);
      if (materialsList.includes(formattedVal)) {
        Alert.alert('Duplicate Material', 'This material already exists.');
        return;
      }
      const updated = [...materialsList, formattedVal];
      setMaterialsList(updated);
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
      setCartCount(filtered.reduce((sum, c) => sum + (c.quantity || 1), 0));
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

  async function addToCart(item, redirect = false) {
    if (!user) { Alert.alert('Sign in required', 'Please sign in to add items to cart.'); return; }
    
    if (redirect) {
      // Buy Now: direct add with defaults & redirect
      setAddingItemId(item.id);
      try {
        const cartKey = `cart_${user.id}`;
        const localCart = await AsyncStorage.getItem(cartKey);
        let cart = localCart ? JSON.parse(localCart) : [];
        const existingIdx = cart.findIndex(c => c.furniture_id === item.id);
        if (existingIdx !== -1) {
          cart[existingIdx].quantity += 1;
        } else {
          cart.push({
            id: `cart-item-${Date.now()}`,
            furniture_id: item.id,
            quantity: 1,
            selected_color: item.colors?.[0] || '#8B5E3C',
            selected_material: 'Wood',
            furniture: item
          });
        }
        await AsyncStorage.setItem(cartKey, JSON.stringify(cart));
        setCartItems(cart);
        setCartCount(cart.reduce((sum, c) => sum + (c.quantity || 1), 0));

        if (user.id !== 'demo-customer-id' && user.id !== 'demo-admin-id') {
          try {
            const { data: existing } = await supabase.from('cart_items').select('id, quantity').eq('user_id', user.id).eq('furniture_id', item.id).single();
            if (existing) { await supabase.from('cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id); }
            else { await supabase.from('cart_items').insert({ user_id: user.id, furniture_id: item.id, quantity: 1, selected_color: item.colors?.[0] || '#8B5E3C' }); }
          } catch (_) { /* offline graceful */ }
        }
        router.push('/(user)/cart');
      } catch (e) {
        console.warn('Buy now direct error:', e);
      } finally {
        setAddingItemId(null);
      }
    } else {
      // Add to cart: toggle remove OR open variation modal popup!
      handleCartPress(item);
    }
  }

  const renderItem = ({ item }) => {
    const itemInCart = cartItems.some(c => c.furniture_id === item.id);
    const isAdded = addedItemId === item.id || itemInCart;
    const isAdding = addingItemId === item.id;
    return (
      <TouchableOpacity style={[styles.card, { width: cardWidth }]} onPress={() => router.push(`/(user)/product/${item.id}`)} activeOpacity={0.88}>
        <View style={styles.cardImageWrap}>
          <ProductImage item={item} style={styles.cardImage} />
          {isAdded && (
            <View style={styles.addedOverlay}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialCommunityIcons name="check-bold" size={13} color={COLORS.white} />
                <Text style={styles.addedOverlayText}>Added</Text>
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.wishBtn} onPress={() => toggleFavorite(item.id)} activeOpacity={0.7}>
            <MaterialCommunityIcons
              name={favorites.map(String).includes(String(item.id)) ? "heart" : "heart-outline"}
              size={18}
              color={favorites.map(String).includes(String(item.id)) ? '#EF4444' : COLORS.themeTextSecondary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardCatTag}><Text style={styles.cardCatTagText}>{item.category}</Text></View>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          <StarRating rating={item.rating} count={item.ratingCount} productId={item.id} productName={item.name} small />
          <Text style={styles.cardPrice}>
            ₱{Number(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.cardActionBtn, itemInCart && styles.cardActionBtnAdded, { flex: 1 }]}
              onPress={() => handleCartPress(item)}
              disabled={isAdding}
              activeOpacity={0.8}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={COLORS.themeButtonBg} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <MaterialCommunityIcons name={itemInCart ? 'pencil' : 'cart-plus'} size={14} color={COLORS.themeTextSecondary} />
                  <Text style={[styles.cardActionBtnText, itemInCart && { color: COLORS.themeTextSecondary }]}>{itemInCart ? 'Edit' : 'Add'}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardActionBtnBuy, { flex: 1 }]}
              onPress={() => router.push(`/(user)/product/${item.id}`)}
              disabled={isAdding}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <MaterialCommunityIcons name="flash-outline" size={13} color={COLORS.white} />
                <Text style={styles.cardActionBtnBuyText}>Buy</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const hasMore = displayed.length < filtered.length;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Animated.Image source={require('../../assets/logo.png')} style={[styles.loadingIllustration, { transform: [{ rotate: logoSpin }] }]} resizeMode="contain" />
          <Text style={styles.loadingText}>Loading furniture...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <CartToast visible={showToast} />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>FurniCute</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity style={styles.favBadgeBtn} onPress={() => router.push('/(user)/favorites')}>
            <MaterialCommunityIcons name="heart-outline" size={26} color="#8B5E3C" />
            {favorites.length > 0 && (
              <Animated.View style={[styles.favBadge, { transform: [{ translateY: favBadgeAnim }] }]}>
                <Text style={styles.favBadgeText}>{favorites.length > 99 ? '99+' : favorites.length}</Text>
              </Animated.View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Page Title Section */}
      <View style={styles.titleSection}>
        <Text style={styles.greeting}>Hello, {profile?.username?.split(' ')[0] || 'Friend'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={styles.headerTitle}>Find Your Perfect Furniture</Text>
          <MaterialCommunityIcons name="sofa" size={24} color="#D67A32" />
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={18} color="#8B5E3C" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search furniture..."
          placeholderTextColor={COLORS.gray400}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <View style={{ height: 50 }}>
        <FlatList
          data={categoriesList}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c}
          contentContainerStyle={styles.catList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.catChip, activeCategory === item && styles.catChipActive]}
              onPress={() => setActiveCategory(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.catChipText, activeCategory === item && styles.catChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Results Count */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>Showing {displayed.length} of {filtered.length} items</Text>
      </View>

      {/* Grid */}
      <FlatList
        key={numColumns}
        data={displayed}
        numColumns={numColumns}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.grid, { paddingHorizontal: HPAD }]}
        columnWrapperStyle={numColumns > 1 ? { gap: GAP } : null}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.themeButtonBg} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image source={require('../../assets/logo.png')} style={[styles.emptyIllustration, { opacity: 0.15 }]} resizeMode="contain" />
            <Text style={styles.emptyText}>No furniture found</Text>
            <Text style={styles.emptySubText}>Try a different search or category</Text>
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <AnimatedButton style={styles.seeMoreBtn} onPress={loadMore}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="chevron-down" size={16} color={COLORS.themeButtonText} />
                <Text style={styles.seeMoreText}>See More</Text>
              </View>
            </AnimatedButton>
          ) : filtered.length > PAGE_SIZE ? (
            <Text style={styles.allLoadedText}>All items shown</Text>
          ) : null
        }
        renderItem={renderItem}
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
                  <ProductImage item={selectedProduct} style={styles.briefImage} />
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
  loadingIllustration: { width: 36, height: 36 },
  loadingText: { fontSize: 16, color: COLORS.themeText, fontFamily: FONTS.bold, fontWeight: '700' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, flexDirection: 'row', alignItems: 'center' },
  logoIcon: { width: 22, height: 22 },
  logoText: { fontSize: 18, fontFamily: FONTS.bold, fontWeight: '800', color: COLORS.themeTextSecondary, letterSpacing: -0.5 },
  titleSection: { paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },
  greeting: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText, letterSpacing: -0.3 },
  cartBadgeBtn: { position: 'relative', padding: 8 },
  favBadgeBtn: { position: 'relative', padding: 8 },
  favBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#D67A32', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  favBadgeText: { fontSize: 10, color: COLORS.white, fontWeight: '800', fontFamily: FONTS.bold },
  cartBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: COLORS.themeButtonBg, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  cartBadgeText: { fontSize: 10, color: COLORS.white, fontWeight: '800', fontFamily: FONTS.bold },
  cartToast: { position: 'absolute', top: 90, alignSelf: 'center', backgroundColor: COLORS.themeButtonBg, borderRadius: RADIUS.full, paddingHorizontal: 20, paddingVertical: 10, zIndex: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10 },
  cartToastText: { color: '#fff', fontFamily: FONTS.bold, fontWeight: '700', fontSize: 14 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.themeInputBorder, shadowColor: COLORS.themeButtonBg, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.themeText },
  clearIcon: { fontSize: 14, color: COLORS.gray400, paddingLeft: 8 },
  catList: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder },
  catChipActive: { backgroundColor: COLORS.themeButtonBg, borderColor: COLORS.themeButtonBg },
  catChipText: { color: COLORS.themeTextSecondary, fontSize: 13, fontFamily: FONTS.medium, fontWeight: '600' },
  catChipTextActive: { color: COLORS.themeButtonText },
  resultsRow: { paddingHorizontal: 16, marginBottom: 8, marginTop: 4 },
  resultsText: { fontSize: 11, color: COLORS.themeTextSecondary, fontFamily: FONTS.regular },
  grid: { gap: 10, paddingBottom: 100 },
  card: { backgroundColor: COLORS.themeCardBg, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 0, borderWidth: 1, borderColor: COLORS.themeCardBorder },
  cardImageWrap: { position: 'relative', width: '100%', aspectRatio: 1 },
  cardImage: { width: '100%', aspectRatio: 1 },
  imagePlaceholder: { position: 'absolute', justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.themeInputBg },
  addedOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(214,122,50,0.88)', paddingVertical: 6, alignItems: 'center' },
  addedOverlayText: { color: COLORS.white, fontSize: 11, fontFamily: FONTS.bold, fontWeight: '700' },
  wishBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  cardBody: { padding: 10, gap: 4 },
  cardCatTag: { alignSelf: 'flex-start', backgroundColor: COLORS.themeInputBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  cardCatTagText: { fontSize: 9, fontFamily: FONTS.bold, fontWeight: '700', color: COLORS.themeTextSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  cardName: { fontSize: 12, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText, lineHeight: 16, height: 32 },
  cardPrice: { fontSize: 13, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 4 },
  cardActionBtn: { width: 68, paddingVertical: 7, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder },
  cardActionBtnAdded: { borderColor: COLORS.themeButtonBg },
  cardActionBtnText: { color: COLORS.themeTextSecondary, fontSize: 11, fontFamily: FONTS.bold, fontWeight: '600' },
  cardActionBtnBuy: { width: 68, paddingVertical: 7, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.themeButtonBg },
  cardActionBtnBuyText: { color: COLORS.themeButtonText, fontSize: 11, fontFamily: FONTS.bold, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIllustration: { width: 100, height: 100 },
  emptyText: { fontSize: 16, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText },
  emptySubText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary },
  seeMoreBtn: { marginHorizontal: 16, marginTop: 12, marginBottom: 20, backgroundColor: COLORS.themeButtonBg, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center' },
  seeMoreText: { color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 14 },
  allLoadedText: { textAlign: 'center', color: COLORS.themeTextSecondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 12, marginBottom: 20 },

  /* Modal Styles */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.themeBg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 20, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.themeInputBorder, paddingBottom: 10 },
  modalTitle: { fontSize: 18, fontFamily: FONTS.bold, fontWeight: '800', color: COLORS.themeText },
  closeBtn: { padding: 4 },
  briefRow: { flexDirection: 'row', gap: 14, marginBottom: 16, backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 12, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  briefImage: { width: 70, height: 70, borderRadius: RADIUS.sm, backgroundColor: COLORS.themeInputBg },
  briefDetails: { flex: 1, justifyContent: 'center', gap: 2 },
  briefName: { fontSize: 15, fontFamily: FONTS.bold, fontWeight: '700', color: COLORS.themeText },
  briefCat: { fontSize: 12, color: COLORS.themeTextSecondary, fontFamily: FONTS.regular },
  briefPrice: { fontSize: 16, fontFamily: FONTS.bold, fontWeight: '800', color: COLORS.themeText },
  sectionLabel: { fontSize: 13, fontFamily: FONTS.bold, fontWeight: '700', color: COLORS.themeText, marginTop: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  variationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  colorBubble: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  colorBubbleActive: { borderWidth: 3, borderColor: '#D67A32' },
  matChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.md, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.themeInputBorder },
  matChipActive: { backgroundColor: COLORS.themeButtonBg, borderColor: COLORS.themeButtonBg },
  matChipText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary },
  matChipTextActive: { color: COLORS.white, fontFamily: FONTS.bold },
  qtyContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 20, backgroundColor: COLORS.white, padding: 12, borderRadius: RADIUS.md },
  qtySelector: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyAdjustBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.themeInputBg, justifyContent: 'center', alignItems: 'center' },
  qtyAdjustText: { fontSize: 16, fontWeight: 'bold', color: COLORS.themeText },
  qtyVal: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.themeText, minWidth: 20, textAlign: 'center' },
  modalAddBtn: { backgroundColor: COLORS.themeButtonBg, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  modalAddBtnText: { color: COLORS.white, fontSize: 14, fontFamily: FONTS.bold, fontWeight: '700' },
  addColorBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder, justifyContent: 'center', alignItems: 'center' },
  addColorText: { fontSize: 16, color: COLORS.themeTextSecondary, fontWeight: 'bold' },
  input: { backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.themeText },
  addBtn: { backgroundColor: COLORS.themeDarkBrown, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 14 },
});

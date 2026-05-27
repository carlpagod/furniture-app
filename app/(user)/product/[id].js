import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Image, Platform, TextInput, Modal,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { COLORS, RADIUS, FURNITURE_IMAGES, COLOR_OPTIONS, MATERIAL_OPTIONS, FONTS, SEED_FURNITURE } from '../../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AnimatedButton from '../../../components/AnimatedButton';

function StarRating({ rating, count, productId, productName }) {
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
      stars.push(<MaterialCommunityIcons key={i} name="star" size={16} color="#D97706" />);
    } else if (i === full + 1 && half) {
      stars.push(<MaterialCommunityIcons key={i} name="star-half-full" size={16} color="#D97706" />);
    } else {
      stars.push(<MaterialCommunityIcons key={i} name="star-outline" size={16} color="#D97706" />);
    }
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>{stars}</View>
      <Text style={{ fontSize: 13, color: COLORS.themeTextSecondary, fontFamily: FONTS.medium, marginLeft: 2 }}>
        {finalRating.toFixed(1)} · {finalCount} reviews
      </Text>
    </View>
  );
}

function getImageSource(product) {
  const url = product?.image_url;
  if (url && typeof url === 'string' && url.trim().length > 0) return { uri: url.trim() };
  const cat = (product?.category || '');
  const nc = cat ? cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase() : '';
  return { uri: FURNITURE_IMAGES[nc] || FURNITURE_IMAGES.placeholder };
}

function ProductHeroImage({ product, style }) {
  const [failed, setFailed] = useState(false);
  const cat = (product?.category || '');
  const nc = cat ? cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase() : '';
  const fallbackSource = { uri: FURNITURE_IMAGES[nc] || FURNITURE_IMAGES.placeholder };
  const source = failed ? fallbackSource : getImageSource(product);
  return <Image source={source} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
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

export default function ProductScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const screenW = Dimensions.get('window').width;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState(null);
  const [materialsList, setMaterialsList] = useState(MATERIAL_OPTIONS);
  const [selectedMaterial, setSelectedMaterial] = useState('Wood');
  const [addingCart, setAddingCart] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const [showCustomColor, setShowCustomColor] = useState(false);
  const [customColor, setCustomColor] = useState('');
  const [showCustomMaterial, setShowCustomMaterial] = useState(false);
  const [customMaterial, setCustomMaterial] = useState('');
  const [productColors, setProductColors] = useState([]);
  const [productMaterials, setProductMaterials] = useState([]);

  // Buy Now 2-step modal
  const [buyNowModal, setBuyNowModal] = useState(false);   // Step 1: variants
  const [paymentModal, setPaymentModal] = useState(false); // Step 2: payment
  const [payingMethod, setPayingMethod] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setProduct(null);
    setSelectedColor(null);
    setSelectedMaterial('Wood');
    setProductColors([]);
    setProductMaterials([]);
    setShowCustomColor(false);
    setShowCustomMaterial(false);

    async function fetch() {
      try {
        const storedMats = await AsyncStorage.getItem('admin_materials');
        if (storedMats) {
          setMaterialsList(JSON.parse(storedMats));
        } else {
          setMaterialsList(MATERIAL_OPTIONS);
        }

        const localAdminItems = await AsyncStorage.getItem('admin_furniture');
        const localItems = localAdminItems ? JSON.parse(localAdminItems) : [];
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        let data = null, error = null;
        if (isUuid) {
          try {
            const result = await Promise.race([
              supabase.from('furniture').select('*').eq('id', id).single(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('product detail fetch timeout')), 5000)),
            ]);
            data = result?.data;
            error = result?.error;
          } catch (timeoutErr) {
            console.warn('ProductDetail: Supabase fetch timed out');
          }
        } else {
          error = new Error('Not a valid UUID');
        }

        if (!error && data) {
          setProduct(data);
          const colors = parseProductColors(data.colors);
          setProductColors(colors);
          if (colors.length > 0) setSelectedColor(colors[0]);

          const mats = parseProductMaterials(data.material);
          setProductMaterials(mats);
          if (mats.length > 0) setSelectedMaterial(mats[0]);
        } else {
          const matched = [...localItems, ...SEED_FURNITURE].find(item => String(item.id) === String(id));
          if (matched) { 
            setProduct(matched); 
            const colors = parseProductColors(matched.colors);
            setProductColors(colors);
            if (colors.length > 0) setSelectedColor(colors[0]); 

            const mats = parseProductMaterials(matched.material);
            setProductMaterials(mats);
            if (mats.length > 0) setSelectedMaterial(mats[0]);
          }
        }
      } catch (e) {
        const matched = SEED_FURNITURE.find(item => String(item.id) === String(id));
        if (matched) { 
          setProduct(matched); 
          const colors = parseProductColors(matched.colors);
          setProductColors(colors);
          if (colors.length > 0) setSelectedColor(colors[0]); 

          const mats = parseProductMaterials(matched.material);
          setProductMaterials(mats);
          if (mats.length > 0) setSelectedMaterial(mats[0]);
        }
      } finally { setLoading(false); }
    }
    fetch();
  }, [id]);

  async function addToCart() {
    if (!user) return Alert.alert('Sign in required', 'Please sign in to add items to cart.');
    setAddingCart(true);
    try {
      const cartKey = `cart_${user.id}`;
      const localCart = await AsyncStorage.getItem(cartKey);
      let cart = localCart ? JSON.parse(localCart) : [];
      const existingIdx = cart.findIndex(ci => ci.furniture_id === id);
      if (existingIdx !== -1) {
        cart[existingIdx].quantity += 1;
        cart[existingIdx].selected_color = selectedColor || null;
        cart[existingIdx].selected_material = selectedMaterial;
      } else {
        cart.push({
          id: `cart-item-${Date.now()}`,
          furniture_id: id,
          quantity: 1,
          selected_color: selectedColor || null,
          selected_material: selectedMaterial,
          furniture: product
        });
      }
      await AsyncStorage.setItem(cartKey, JSON.stringify(cart));

      if (user.id !== 'demo-customer-id' && user.id !== 'demo-admin-id') {
        try {
          const { data: existing } = await supabase.from('cart_items').select('id, quantity').eq('user_id', user.id).eq('furniture_id', id).single();
          if (existing) { await supabase.from('cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id); }
          else { await supabase.from('cart_items').insert({ user_id: user.id, furniture_id: id, quantity: 1, selected_color: selectedColor || null }); }
        } catch (_) { /* offline graceful */ }
      }

      setCartAdded(true);
      setTimeout(() => setCartAdded(false), 2000);
    } catch (e) {
      Alert.alert('Error', 'Could not add to cart. Please try again.');
    } finally { setAddingCart(false); }
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

  // Opens Step 1 — variant selection modal
  function buyNow() {
    if (!user) return Alert.alert('Sign in required', 'Please sign in to buy.');
    setPayingMethod(null);
    setBuyNowModal(true);
  }

  // Step 1 → Step 2: move from variant to payment modal
  function proceedToPayment() {
    setBuyNowModal(false);
    setPaymentModal(true);
  }

  // Final: confirm order directly (bypasses cart screen)
  async function confirmBuyNow(paymentMethod) {
    setOrderLoading(true);
    const now = new Date().toISOString();
    try {
      const orderItem = {
        id: `sale-${Date.now()}`,
        furniture_name: product?.name || 'Item',
        category: product?.category || 'General',
        quantity: 1,
        price: Number(product?.price || 0),
        selected_color: selectedColor,
        selected_material: selectedMaterial,
        payment_method: paymentMethod,
        status: 'pending',
        created_at: now,
      };

      // Save locally to sales_history for general/demo history
      const salesLocal = await AsyncStorage.getItem('sales_history');
      const sales = salesLocal ? JSON.parse(salesLocal) : [];
      sales.unshift(orderItem);
      await AsyncStorage.setItem('sales_history', JSON.stringify(sales));

      // Always write to user-specific notifications cache for instant local display
      const userNotifKey = `notifications_${user.id}`;
      const userNotifRaw = await AsyncStorage.getItem(userNotifKey);
      const userNotifs = userNotifRaw ? JSON.parse(userNotifRaw) : [];
      userNotifs.unshift(orderItem);
      await AsyncStorage.setItem(userNotifKey, JSON.stringify(userNotifs));

      // Save to admin_logs for admin panel activity tracking
      try {
        const logsLocal = await AsyncStorage.getItem('admin_logs');
        const logs = logsLocal ? JSON.parse(logsLocal) : [];
        logs.unshift({
          id: `log-${Date.now()}`,
          action: 'PURCHASE',
          furniture_name: product?.name || 'Item',
          details: `User ${profile?.username || user?.email || 'Customer'} purchased 1x ${product?.name} (Color: ${selectedColor || 'N/A'}, Material: ${selectedMaterial || 'N/A'}) for ₱${product?.price} via ${paymentMethod}`,
          created_at: now,
        });
        await AsyncStorage.setItem('admin_logs', JSON.stringify(logs));
      } catch (logErr) {
        console.warn('Failed to insert buy now log locally:', logErr);
      }

      // Save to Supabase for real users
      if (user.id !== 'demo-customer-id' && user.id !== 'demo-admin-id') {
        try {
          await supabase.from('sales').insert([{
            user_id: user.id,
            furniture_name: product?.name || 'Item',
            category: product?.category || 'General',
            quantity: 1,
            price: Number(product?.price || 0),
            payment_method: paymentMethod,
            status: 'pending',
          }]);

          // Log purchase to activity_logs table for admin
          await supabase.from('activity_logs').insert([{
            admin_id: null,
            action: 'PURCHASE',
            furniture_id: product.id,
            furniture_name: product.name,
            details: `User ${profile?.username || user.email || 'Customer'} purchased 1x ${product.name} (Color: ${selectedColor || 'N/A'}, Material: ${selectedMaterial || 'N/A'}) for ₱${product.price} via ${paymentMethod}`
          }]);

          // Refresh notification cache from database to sync
          const { data: freshSales } = await supabase
            .from('sales').select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (freshSales) {
            await AsyncStorage.setItem(userNotifKey, JSON.stringify(freshSales));
          }
        } catch (supabaseErr) {
          console.warn('Supabase order sync failed (running in offline grace mode):', supabaseErr);
        }
      }
      setPaymentModal(false);
      setOrderLoading(false);
      Alert.alert(
        'Order Placed! 🎉',
        `${product?.name} ordered successfully!\nPayment: ${paymentMethod}\n\nDelivery in 3–7 business days. Check Notifications for updates.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      setOrderLoading(false);
      console.warn('Buy Now error:', e);
      Alert.alert('Error', 'Could not place order. Please try again.');
    }
  }

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator color={COLORS.black} size="large" /></View>;

  if (!product) return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.errorText}>Product not found</Text>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCenter}>
        <Text style={styles.backBtnText}>← Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const colors = product.colors || [];
  const imageHeight = screenW * 0.82;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}>
        {/* Hero Image */}
        <View style={styles.imageWrap}>
          <ProductHeroImage product={product} style={[styles.productImage, { height: imageHeight }]} />
          <TouchableOpacity style={[styles.backBtn, { top: insets.top + 12 }]} onPress={() => router.back()}>
            <Text style={styles.backBtnIcon}>←</Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          {/* Category */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{product.category}</Text>
          </View>

          {/* Name */}
          <Text style={styles.productName}>{product.name}</Text>

          {/* Price */}
          <Text style={styles.productPrice}>
            ₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </Text>


          {/* Rating */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <StarRating rating={product.rating} count={product.ratingCount} productId={product.id} productName={product.name} />
            <View style={styles.rateSection}>
              <Text style={styles.rateSectionLabel}>{ratingSubmitted ? 'Your Rating:' : 'Rate:'}</Text>
              <View style={styles.rateStarsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity key={star} onPress={() => { setUserRating(star); setRatingSubmitted(true); }} activeOpacity={0.7}>
                    <Text style={[styles.rateStar, star <= userRating && styles.rateStarFilled]}>{star <= userRating ? '★' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {ratingSubmitted && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialCommunityIcons name="star-face" size={14} color={COLORS.themeButtonBg} />
                    <Text style={styles.rateThankText}>Thanks!</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setUserRating(0); setRatingSubmitted(false); }}
                    style={styles.rateCancelBtn}
                  >
                    <Text style={styles.rateCancelText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Description */}
          <View style={styles.descSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descText}>
              {product.description || 'Elevate your living space with this beautifully crafted piece. Designed with both form and function in mind, this furniture brings a touch of elegance to any room.'}
            </Text>
          </View>

          {/* Colors */}
          <View style={styles.colorSection}>
            <Text style={styles.sectionTitle}>Available Colors</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.filter(c => productColors.map(col => String(col).trim().toLowerCase()).includes(c.value.toLowerCase())).map(c => (
                <TouchableOpacity key={c.value}
                  style={[styles.colorDot, { backgroundColor: c.value }, c.value === '#FFFFFF' && styles.colorDotWhite, selectedColor?.toLowerCase() === c.value.toLowerCase() && styles.colorDotSelected]}
                  onPress={() => setSelectedColor(c.value)}
                />
              ))}

              {productColors.filter(c => !COLOR_OPTIONS.find(o => o.value.toLowerCase() === c.toLowerCase())).map(c => (
                <TouchableOpacity key={c}
                  style={[styles.colorDot, { backgroundColor: c }, c === '#FFFFFF' && styles.colorDotWhite, selectedColor?.toLowerCase() === c.toLowerCase() && styles.colorDotSelected]}
                  onPress={() => setSelectedColor(c)}
                />
              ))}
            </View>
          </View>

          {/* Material Options */}
          <View style={styles.colorSection}>
            <Text style={styles.sectionTitle}>Material Variant</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: 'row', alignItems: 'center' }}>
              {(productMaterials.length > 0 ? productMaterials : parseProductMaterials(product?.material || 'Wood')).map(mat => {
                const isSelected = selectedMaterial === mat;
                return (
                  <TouchableOpacity
                    key={mat}
                    style={[
                      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.themeCardBorder, backgroundColor: COLORS.themeInputBg },
                      isSelected && { backgroundColor: COLORS.themeDarkBrown, borderColor: COLORS.themeDarkBrown }
                    ]}
                    onPress={() => setSelectedMaterial(mat)}
                  >
                    <Text style={{ fontSize: 13, fontFamily: FONTS.semibold, fontWeight: '600', color: isSelected ? COLORS.themeButtonText : COLORS.themeText }}>
                      {mat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Specs */}
          <View style={styles.specsRow}>
            <View style={styles.specItem}>
              <MaterialCommunityIcons name="truck-delivery-outline" size={24} color="#D67A32" style={{ marginBottom: 4 }} />
              <Text style={styles.specText}>Free Delivery</Text>
            </View>
            <View style={styles.specItem}>
              <MaterialCommunityIcons name="cached" size={24} color="#D67A32" style={{ marginBottom: 4 }} />
              <Text style={styles.specText}>30-Day Return</Text>
            </View>
            <View style={styles.specItem}>
              <MaterialCommunityIcons name="shield-check-outline" size={24} color="#D67A32" style={{ marginBottom: 4 }} />
              <Text style={styles.specText}>2-Year Warranty</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Buttons — each in its own View to prevent hit-area bleed */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 6, 12) }]}>
        <TouchableOpacity
          style={[styles.cartBtn, { flex: 1 }]}
          onPress={addToCart}
          disabled={addingCart || orderLoading}
          activeOpacity={0.8}
        >
          {addingCart ? (
            <ActivityIndicator color={COLORS.themeText} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 6 }}>
              <MaterialCommunityIcons name={cartAdded ? 'cart-check' : 'cart-plus'} size={18} color={COLORS.themeText} />
              <Text style={styles.cartBtnText}>{cartAdded ? 'Added' : 'Add to Cart'}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buyBtn, { flex: 1 }]}
          onPress={buyNow}
          disabled={addingCart || orderLoading}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 6 }}>
            <MaterialCommunityIcons name="flash-outline" size={18} color={COLORS.themeButtonText} />
            <Text style={styles.buyBtnText}>Buy Now</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── STEP 1: Variant Selection Modal ─────────────────────── */}
      <Modal
        visible={buyNowModal}
        transparent
        animationType="slide"
        onRequestClose={() => setBuyNowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Product preview header */}
            <View style={styles.modalProductRow}>
              {product && (
                <Image
                  source={getImageSource(product)}
                  style={styles.modalProductImg}
                  resizeMode="cover"
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={2}>{product?.name}</Text>
                <Text style={styles.modalPrice}>
                  ₱{Number(product?.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            <View style={styles.modalDivider} />

            {/* Color picker */}
            {productColors.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={styles.variantLabel}>COLOR</Text>
                <View style={styles.colorRow}>
                  {COLOR_OPTIONS.filter(c => productColors.map(col => String(col).trim().toLowerCase()).includes(c.value.toLowerCase())).map(c => (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c.value },
                        c.value === '#FFFFFF' && styles.colorDotWhite,
                        selectedColor?.toLowerCase() === c.value.toLowerCase() && styles.colorDotSelected,
                      ]}
                      onPress={() => setSelectedColor(c.value)}
                    />
                  ))}
                  {productColors.filter(c => !COLOR_OPTIONS.find(o => o.value.toLowerCase() === c.toLowerCase())).map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        c === '#FFFFFF' && styles.colorDotWhite,
                        selectedColor?.toLowerCase() === c.toLowerCase() && styles.colorDotSelected,
                      ]}
                      onPress={() => setSelectedColor(c)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Material picker */}
            {productMaterials.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={styles.variantLabel}>MATERIAL</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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
                </ScrollView>
              </View>
            )}

            {/* Selected summary */}
            <View style={styles.variantSummary}>
              {selectedColor && (
                <View style={styles.variantSummaryItem}>
                  <View style={[styles.variantColorDot, { backgroundColor: selectedColor }]} />
                  <Text style={styles.variantSummaryText}>Color selected</Text>
                </View>
              )}
              <Text style={styles.variantSummaryText}>
                Material: <Text style={{ fontFamily: FONTS.bold, fontWeight: '700', color: '#D67A32' }}>{selectedMaterial}</Text>
              </Text>
            </View>

            <TouchableOpacity style={styles.proceedBtn} onPress={proceedToPayment} activeOpacity={0.85}>
              <Text style={styles.proceedBtnText}>Continue to Payment →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setBuyNowModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── STEP 2: Payment Method Modal ─────────────────────────── */}
      <Modal
        visible={paymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => !orderLoading && setPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Choose Payment Method</Text>
            <Text style={styles.modalSub}>Select how you'd like to pay</Text>

            {[
              { id: 'Cash on Delivery', icon: 'cash',               label: 'Cash on Delivery',   sub: 'Pay when your order arrives' },
              { id: 'GCash',           icon: 'cellphone',           label: 'GCash',               sub: 'Send via GCash mobile wallet' },
              { id: 'Maya',            icon: 'credit-card-outline', label: 'Maya',                sub: 'Pay using Maya e-wallet' },
              { id: 'Credit Card',     icon: 'credit-card',         label: 'Credit / Debit Card', sub: 'Visa, Mastercard, JCB' },
            ].map(pm => (
              <TouchableOpacity
                key={pm.id}
                style={[styles.pmRow, payingMethod === pm.id && styles.pmRowActive]}
                onPress={() => setPayingMethod(pm.id)}
                activeOpacity={0.8}
                disabled={orderLoading}
              >
                <View style={[styles.pmIcon, payingMethod === pm.id && styles.pmIconActive]}>
                  <MaterialCommunityIcons name={pm.icon} size={22} color={payingMethod === pm.id ? '#FFF' : '#D67A32'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pmLabel, payingMethod === pm.id && styles.pmLabelActive]}>{pm.label}</Text>
                  <Text style={styles.pmSub}>{pm.sub}</Text>
                </View>
                {payingMethod === pm.id && <MaterialCommunityIcons name="check-circle" size={22} color="#D67A32" />}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.confirmBtn, (!payingMethod || orderLoading) && styles.confirmBtnDisabled]}
              onPress={() => payingMethod && confirmBuyNow(payingMethod)}
              disabled={!payingMethod || orderLoading}
              activeOpacity={0.85}
            >
              {orderLoading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.confirmBtnText}>Confirm Order{payingMethod ? ` · ${payingMethod}` : ''}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { if (!orderLoading) { setPaymentModal(false); setBuyNowModal(true); } }}
              disabled={orderLoading}
            >
              <Text style={styles.cancelBtnText}>← Back to Variants</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  center: { justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.themeTextSecondary, fontFamily: FONTS.regular, fontSize: 16, marginBottom: 16 },
  backBtnCenter: { paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: COLORS.themeText, fontWeight: '600', fontFamily: FONTS.bold, fontSize: 16 },
  imageWrap: { position: 'relative' },
  productImage: { width: '100%', backgroundColor: '#F1F5F9' },
  backBtn: { position: 'absolute', left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  backBtnIcon: { color: COLORS.themeText, fontSize: 20, fontWeight: '700' },
  infoSection: { backgroundColor: COLORS.themeBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, paddingTop: 28, paddingHorizontal: 24, paddingBottom: 20, gap: 16 },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: COLORS.themeInputBg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  categoryBadgeText: { color: COLORS.themeTextSecondary, fontSize: 12, fontWeight: '700', fontFamily: FONTS.bold, letterSpacing: 0.5, textTransform: 'uppercase' },
  productName: { fontSize: 26, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText, lineHeight: 32 },
  productPrice: { fontSize: 28, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  divider: { height: 1, backgroundColor: COLORS.themeInputBorder },
  descSection: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeTextSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  descText: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.themeText, lineHeight: 22 },
  colorSection: { gap: 10 },
  colorRow: { flexDirection: 'row', gap: 12 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotWhite: { borderWidth: 1, borderColor: '#E2E8F0' },
  colorDotSelected: { borderWidth: 3, borderColor: COLORS.themeText },
  specsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.themeInputBg, borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: COLORS.themeInputBorder },
  specItem: { alignItems: 'center', gap: 6, flex: 1 },
  specText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, fontWeight: '600', textAlign: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 10, backgroundColor: COLORS.themeBg, borderTopWidth: 1, borderTopColor: COLORS.themeInputBorder },
  cartBtn: { flex: 1, backgroundColor: COLORS.themeInputBg, paddingVertical: 17, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.themeInputBorder },
  cartBtnText: { color: COLORS.themeText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
  buyBtn: { flex: 1, backgroundColor: COLORS.themeButtonBg, paddingVertical: 17, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  buyBtnText: { color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
  // Rating
  rateSection: { alignItems: 'flex-end', gap: 2 },
  rateSectionLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, fontWeight: '600' },
  rateStarsRow: { flexDirection: 'row', gap: 4 },
  rateStar: { fontSize: 22, color: '#D4C5A9' },
  rateStarFilled: { color: '#D97706' },
  rateThankText: { fontSize: 11, color: COLORS.themeButtonBg, fontFamily: FONTS.bold, fontWeight: '700' },
  rateCancelBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#EEE', justifyContent: 'center', alignItems: 'center',
  },
  rateCancelText: { fontSize: 10, color: COLORS.themeTextSecondary, fontWeight: '700' },

  addColorBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder, justifyContent: 'center', alignItems: 'center' },
  addColorText: { fontSize: 16, color: COLORS.themeTextSecondary, fontWeight: 'bold' },
  input: { backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.themeText },
  addBtn: { backgroundColor: COLORS.themeDarkBrown, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 14 },

  // ── Buy Now Modals ──────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.themeBg,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, gap: 14,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D4C5A9', alignSelf: 'center', marginBottom: 4 },
  modalProductRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modalProductImg: { width: 72, height: 72, borderRadius: RADIUS.md, backgroundColor: COLORS.themeInputBg },
  modalTitle: { fontSize: 17, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  modalPrice: { fontSize: 16, fontWeight: '800', fontFamily: FONTS.bold, color: '#D67A32', marginTop: 4 },
  modalSub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, textAlign: 'center' },
  modalDivider: { height: 1, backgroundColor: COLORS.themeCardBorder },
  variantLabel: { fontSize: 11, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeTextSecondary, letterSpacing: 1 },
  matChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: '#E6D5C0', backgroundColor: COLORS.themeInputBg,
  },
  matChipActive: { backgroundColor: '#D67A32', borderColor: '#D67A32' },
  matChipText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, fontWeight: '600' },
  matChipTextActive: { color: '#FFF', fontWeight: '700' },
  variantSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#FDF3E7', borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E6D5C0',
  },
  variantSummaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  variantColorDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#D4C5A9' },
  variantSummaryText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary },
  proceedBtn: {
    backgroundColor: '#D67A32', paddingVertical: 16,
    borderRadius: RADIUS.md, alignItems: 'center',
  },
  proceedBtnText: { color: '#FFF', fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
  pmRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.themeCardBg, borderRadius: RADIUS.md,
    padding: 14, borderWidth: 1.5, borderColor: COLORS.themeCardBorder,
  },
  pmRowActive: { borderColor: '#D67A32', backgroundColor: '#FDF3E7' },
  pmIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FDF3E7', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E6D5C0',
  },
  pmIconActive: { backgroundColor: '#D67A32', borderColor: '#D67A32' },
  pmLabel: { fontSize: 14, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText },
  pmLabelActive: { color: '#D67A32' },
  pmSub: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, marginTop: 1 },
  confirmBtn: {
    backgroundColor: '#D67A32', paddingVertical: 16,
    borderRadius: RADIUS.md, alignItems: 'center', marginTop: 4,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { color: '#FFF', fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelBtnText: { fontSize: 14, fontFamily: FONTS.medium, fontWeight: '600', color: COLORS.themeTextSecondary },
});

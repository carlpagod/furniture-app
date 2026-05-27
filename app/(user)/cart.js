import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Platform, Modal,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { COLORS, RADIUS, FURNITURE_IMAGES, FONTS, SEED_FURNITURE } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import AnimatedButton from '../../components/AnimatedButton';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [payingMethod, setPayingMethod] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);

  async function fetchCart() {
    if (!user) { setLoading(false); return; }
    try {
      const cartKey = `cart_${user.id}`;
      const localCart = await AsyncStorage.getItem(cartKey);
      let items = localCart ? JSON.parse(localCart) : [];

      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        if (items.length === 0) {
          // Seed a default cart item for presentation
          const defaultCart = [
            {
              id: 'demo-cart-1',
              furniture_id: '1',
              quantity: 1,
              selected_color: '#000000',
              selected_material: 'Wood',
              furniture: {
                id: '1',
                name: 'Nordic Accent Chair',
                price: 4999.00,
                category: 'Chair',
                image_url: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80'
              }
            }
          ];
          items = defaultCart;
          await AsyncStorage.setItem(cartKey, JSON.stringify(defaultCart));
        }
      } else {
        // If it's a real user and AsyncStorage is empty, try loading/restoring from Supabase!
        if (items.length === 0) {
          let data = null, error = null;
          try {
            const result = await Promise.race([
              supabase.from('cart_items').select('*, furniture(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('cart timeout')), 5000)),
            ]);
            data = result?.data;
            error = result?.error;
          } catch (timeoutErr) {
            console.warn('Cart: Supabase fetch timed out');
          }

          if (!error && data && data.length > 0) {
            const localAdminItems = await AsyncStorage.getItem('admin_furniture');
            const localItems = localAdminItems ? JSON.parse(localAdminItems) : [];
            const allLocal = [...SEED_FURNITURE, ...localItems];

            const hydratedData = data.map(item => {
              if (!item.furniture) {
                const matched = allLocal.find(f => f.id === item.furniture_id);
                if (matched) {
                  return { ...item, furniture: matched };
                }
              }
              return item;
            }).filter(item => item.furniture);

            if (hydratedData.length > 0) {
              items = hydratedData;
              await AsyncStorage.setItem(cartKey, JSON.stringify(hydratedData));
            }
          }
        }
      }

      // Proactively patch cabinet image if needed
      items = items.map(i => {
        if (i.furniture?.image_url && i.furniture.image_url.includes('photo-1558997519-83ea9252eaf8')) {
          return { ...i, furniture: { ...i.furniture, image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80' } };
        }
        return i;
      });

      setCartItems(items);
    } catch (e) {
      console.warn('Cart loading failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchCart();
    }, [user])
  );

  useEffect(() => {
    if (user) {
      fetchCart();
    }
  }, [user]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchCart(); }, [user]);

  async function updateQuantity(itemId, delta, currentQty) {
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      Alert.alert('Remove Item', 'Remove this item from cart?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeItem(itemId) },
      ]);
      return;
    }

    const updated = cartItems.map(i => i.id === itemId ? { ...i, quantity: newQty } : i);
    setCartItems(updated);
    await AsyncStorage.setItem(`cart_${user.id}`, JSON.stringify(updated));

    if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
      return;
    }

    try {
      await supabase.from('cart_items').update({ quantity: newQty }).eq('id', itemId);
    } catch (e) {
      console.error('Supabase update failed:', e);
    }
  }

  async function removeItem(itemId) {
    const filtered = cartItems.filter(i => i.id !== itemId);
    setCartItems(filtered);
    await AsyncStorage.setItem(`cart_${user.id}`, JSON.stringify(filtered));

    if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
      return;
    }

    try {
      await supabase.from('cart_items').delete().eq('id', itemId);
    } catch (e) {
      console.error('Supabase delete failed:', e);
    }
  }

  async function clearCart() {
    Alert.alert('Clear Cart', 'Remove all items from cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive',
        onPress: async () => {
          setCartItems([]);
          await AsyncStorage.removeItem(`cart_${user.id}`);
          if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
            return;
          }
          try {
            await supabase.from('cart_items').delete().eq('user_id', user.id);
          } catch (e) {
            console.error('Supabase clear failed:', e);
          }
        }
      }
    ]);
  }

  function checkout() {
    // Open payment method selection modal
    setPayingMethod(null);
    setPaymentModal(true);
  }

  async function confirmCheckout(paymentMethod) {
    setOrderLoading(true);
    const now = new Date().toISOString();

    try {
      // 1. Record locally in AsyncStorage (works for demo + offline)
      const salesLocal = await AsyncStorage.getItem('sales_history');
      const sales = salesLocal ? JSON.parse(salesLocal) : [];
      cartItems.forEach(item => {
        sales.unshift({
          id: `sale-${Date.now()}-${item.id}`,
          furniture_name: item.furniture?.name || 'Item',
          category: item.furniture?.category || 'General',
          quantity: item.quantity || 1,
          price: Number(item.furniture?.price || 0),
          payment_method: paymentMethod,
          status: 'pending',
          created_at: now,
        });
      });
      await AsyncStorage.setItem('sales_history', JSON.stringify(sales));

      // Save locally to admin_logs for admin activity tracking
      try {
        const logsLocal = await AsyncStorage.getItem('admin_logs');
        const logs = logsLocal ? JSON.parse(logsLocal) : [];
        cartItems.forEach(item => {
          logs.unshift({
            id: `log-${Date.now()}-${item.id}`,
            action: 'PURCHASE',
            furniture_name: item.furniture?.name || 'Item',
            details: `User ${profile?.username || user?.email || 'Customer'} purchased ${item.quantity}x ${item.furniture?.name} (Color: ${item.selected_color || 'N/A'}, Material: ${item.selected_material || 'N/A'}) for ₱${item.furniture?.price} each via ${paymentMethod}`,
            created_at: now,
          });
        });
        await AsyncStorage.setItem('admin_logs', JSON.stringify(logs));
      } catch (logErr) {
        console.warn('Failed to insert cart checkout log locally:', logErr);
      }

      // 2. Save to Supabase sales table (real users only)
      if (user.id !== 'demo-customer-id' && user.id !== 'demo-admin-id') {
        const supabaseSales = cartItems.map(item => ({
          user_id: user.id,
          furniture_name: item.furniture?.name || 'Item',
          category: item.furniture?.category || 'General',
          quantity: item.quantity || 1,
          price: Number(item.furniture?.price || 0),
          payment_method: paymentMethod,
          status: 'pending',
        }));
        await supabase.from('sales').insert(supabaseSales);

        // Log purchase to activity_logs table for admin
        try {
          const logEntries = cartItems.map(item => ({
            admin_id: null,
            action: 'PURCHASE',
            furniture_id: item.furniture_id,
            furniture_name: item.furniture?.name || 'Item',
            details: `User ${profile?.username || user.email || 'Customer'} purchased ${item.quantity}x ${item.furniture?.name} (Color: ${item.selected_color || 'N/A'}, Material: ${item.selected_material || 'N/A'}) for ₱${item.furniture?.price} each via ${paymentMethod}`
          }));
          await supabase.from('activity_logs').insert(logEntries);
        } catch (logErr) {
          console.warn('Failed to insert cart checkout logs to Supabase activity_logs:', logErr);
        }

        // 3. Clear cart from Supabase
        await supabase.from('cart_items').delete().eq('user_id', user.id);

        // 4. Cache notifications for immediate display
        const { data: freshSales } = await supabase
          .from('sales')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (freshSales) {
          await AsyncStorage.setItem(`notifications_${user.id}`, JSON.stringify(freshSales));
        }
      }

      // 5. Clear local cart
      setCartItems([]);
      await AsyncStorage.removeItem(`cart_${user.id}`);

      setPaymentModal(false);
      setOrderLoading(false);

      Alert.alert(
        'Order Placed! 🎉',
        `Thank you for your purchase!\nPayment via ${paymentMethod}.\n\nYour furniture will be delivered within 3–7 business days. Check Notifications for updates.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      setOrderLoading(false);
      console.warn('Checkout error:', e);
      Alert.alert('Error', 'Something went wrong placing your order. Please try again.');
    }
  }

  const total = cartItems.reduce((sum, item) => {
    return sum + (Number(item.furniture?.price || 0) * item.quantity);
  }, 0);

  function getImage(item) {
    const url = item.furniture?.image_url;
    if (url && typeof url === 'string' && url.trim().length > 0) {
      return { uri: url.trim() };
    }
    const rawCat = item.furniture?.category || '';
    const cat = rawCat ? rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase() : '';
    return { uri: FURNITURE_IMAGES[cat] || FURNITURE_IMAGES.placeholder };
  }

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.headerTitle}>My Cart</Text>
          <MaterialCommunityIcons name="cart-outline" size={24} color="#D67A32" />
        </View>
        {cartItems.length > 0 && (
          <TouchableOpacity onPress={clearCart}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="cart-off" size={60} color="#D67A32" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add furniture from the home screen</Text>
          <AnimatedButton style={styles.shopBtn} onPress={() => router.push('/(user)/home')}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </AnimatedButton>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.black} />}
            renderItem={({ item }) => (
              <View style={styles.cartCard}>
                <TouchableOpacity
                  onPress={() => router.push(`/(user)/product/${item.furniture_id}`)}
                  style={{ alignSelf: 'stretch' }}
                >
                  <Image source={getImage(item)} style={styles.cartImage} resizeMode="cover" />
                </TouchableOpacity>
                <View style={styles.cartInfo}>
                  <Text style={styles.cartName} numberOfLines={2}>{item.furniture?.name}</Text>
                  <Text style={styles.cartPrice}>
                    ₱{Number(item.furniture?.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Text>
                  {(item.selected_color || item.selected_material) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      {item.selected_color && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontSize: 11, color: COLORS.themeTextSecondary }}>Color:</Text>
                          <View style={[styles.colorDot, { backgroundColor: item.selected_color, width: 12, height: 12, borderRadius: 6 }]} />
                        </View>
                      )}
                      {item.selected_material && (
                        <Text style={{ fontSize: 11, color: COLORS.themeTextSecondary }}>
                          Material: <Text style={{ fontFamily: FONTS.bold, fontWeight: '700' }}>{item.selected_material}</Text>
                        </Text>
                      )}
                    </View>
                  )}
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.id, -1, item.quantity)}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.id, 1, item.quantity)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeItem(item.id)}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />

          {/* Summary + Checkout */}
          <View style={[styles.summary, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items ({cartItems.length})</Text>
              <Text style={styles.summaryValue}>
                ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success, fontFamily: FONTS.bold }]}>FREE</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <AnimatedButton style={styles.checkoutBtn} onPress={checkout}>
              <Text style={styles.checkoutBtnText}>Place Order →</Text>
            </AnimatedButton>
          </View>
        </>
      )}

      {/* ── Payment Method Modal ─────────────────────────────── */}
      <Modal
        visible={paymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => !orderLoading && setPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Handle bar */}
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Choose Payment Method</Text>
            <Text style={styles.modalSub}>Select how you'd like to pay for your order</Text>

            {[
              { id: 'Cash on Delivery', icon: 'cash',                 label: 'Cash on Delivery',  sub: 'Pay when your order arrives' },
              { id: 'GCash',           icon: 'cellphone',             label: 'GCash',              sub: 'Send via GCash mobile wallet' },
              { id: 'Maya',            icon: 'credit-card-outline',   label: 'Maya',               sub: 'Pay using Maya e-wallet' },
              { id: 'Credit Card',     icon: 'credit-card',           label: 'Credit / Debit Card',sub: 'Visa, Mastercard, JCB' },
            ].map(pm => (
              <TouchableOpacity
                key={pm.id}
                style={[
                  styles.pmRow,
                  payingMethod === pm.id && styles.pmRowActive,
                ]}
                onPress={() => setPayingMethod(pm.id)}
                activeOpacity={0.8}
                disabled={orderLoading}
              >
                <View style={[styles.pmIcon, payingMethod === pm.id && styles.pmIconActive]}>
                  <MaterialCommunityIcons
                    name={pm.icon}
                    size={22}
                    color={payingMethod === pm.id ? '#FFF' : '#D67A32'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pmLabel, payingMethod === pm.id && styles.pmLabelActive]}>
                    {pm.label}
                  </Text>
                  <Text style={styles.pmSub}>{pm.sub}</Text>
                </View>
                {payingMethod === pm.id && (
                  <MaterialCommunityIcons name="check-circle" size={22} color="#D67A32" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!payingMethod || orderLoading) && styles.confirmBtnDisabled,
              ]}
              onPress={() => payingMethod && confirmCheckout(payingMethod)}
              activeOpacity={0.85}
              disabled={!payingMethod || orderLoading}
            >
              {orderLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.confirmBtnText}>
                  Confirm Order {payingMethod ? `· ${payingMethod}` : ''}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => !orderLoading && setPaymentModal(false)}
              disabled={orderLoading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  clearText: { color: COLORS.error, fontSize: 14, fontFamily: FONTS.medium, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  cartCard: {
    flexDirection: 'row', backgroundColor: COLORS.themeCardBg,
    borderRadius: RADIUS.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.themeCardBorder,
  },
  cartImage: { width: 100, height: '100%', minHeight: 100, backgroundColor: COLORS.themeInputBg },
  cartInfo: { flex: 1, padding: 12, gap: 4 },
  cartName: { fontSize: 13, fontWeight: '700', fontFamily: FONTS.medium, color: COLORS.themeText, lineHeight: 18 },
  cartPrice: { fontSize: 15, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: COLORS.themeInputBorder },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.themeInputBg,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { color: COLORS.themeText, fontSize: 18, fontWeight: '700', lineHeight: 20 },
  qtyText: { fontSize: 15, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText, minWidth: 24, textAlign: 'center' },
  removeBtn: { marginLeft: 'auto' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  emptySubtitle: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary },
  shopBtn: {
    backgroundColor: COLORS.themeButtonBg, paddingHorizontal: 28,
    paddingVertical: 14, borderRadius: RADIUS.md, marginTop: 8,
  },
  shopBtnText: { color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
  summary: {
    backgroundColor: COLORS.themeCardBg, borderTopWidth: 1, borderTopColor: COLORS.themeCardBorder,
    padding: 20, gap: 10,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary },
  summaryValue: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.themeText, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: COLORS.themeCardBorder, paddingTop: 10, marginTop: 2 },
  totalLabel: { fontSize: 16, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  totalValue: { fontSize: 18, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  checkoutBtn: {
    backgroundColor: COLORS.themeButtonBg, paddingVertical: 16,
    borderRadius: RADIUS.md, alignItems: 'center', marginTop: 4,
  },
  checkoutBtnText: { color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 16 },

  // ── Payment Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.themeBg,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, gap: 12,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D4C5A9', alignSelf: 'center', marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20, fontWeight: '800', fontFamily: FONTS.bold,
    color: COLORS.themeText, textAlign: 'center',
  },
  modalSub: {
    fontSize: 13, fontFamily: FONTS.regular,
    color: COLORS.themeTextSecondary, textAlign: 'center', marginBottom: 4,
  },
  pmRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.themeCardBg,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1.5, borderColor: COLORS.themeCardBorder,
  },
  pmRowActive: {
    borderColor: '#D67A32',
    backgroundColor: '#FDF3E7',
  },
  pmIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FDF3E7',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E6D5C0',
  },
  pmIconActive: { backgroundColor: '#D67A32', borderColor: '#D67A32' },
  pmLabel: {
    fontSize: 14, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText,
  },
  pmLabelActive: { color: '#D67A32' },
  pmSub: {
    fontSize: 11, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, marginTop: 1,
  },
  confirmBtn: {
    backgroundColor: '#D67A32', paddingVertical: 16,
    borderRadius: RADIUS.md, alignItems: 'center', marginTop: 8,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { color: '#FFF', fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: {
    fontSize: 14, fontFamily: FONTS.medium, fontWeight: '600',
    color: COLORS.themeTextSecondary,
  },
});

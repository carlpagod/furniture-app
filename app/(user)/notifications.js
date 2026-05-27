import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal, ScrollView
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { COLORS, RADIUS, FONTS, SEED_FURNITURE, FURNITURE_IMAGES } from '../../lib/constants';

const ACTIVE_COLOR = '#D67A32';

const PAYMENT_ICONS = {
  'Cash on Delivery': 'cash',
  'GCash': 'cellphone',
  'Maya': 'credit-card-outline',
  'Credit Card': 'credit-card',
  'Debit Card': 'card-bulleted-outline',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#D97706', bg: '#FEF3C7', icon: 'clock-outline' },
  confirmed: { label: 'Confirmed', color: '#2563EB', bg: '#DBEAFE', icon: 'check-circle-outline' },
  delivered: { label: 'Delivered', color: '#16A34A', bg: '#DCFCE7', icon: 'package-variant-closed-check' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

function NotificationCard({ item, onCancel, onMarkAsRead, onClear, onEdit }) {
  const statusKey = item.status || 'pending';
  const status = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
  const paymentIcon = PAYMENT_ICONS[item.payment_method] || 'cash';

  const date = new Date(item.created_at);
  const dateStr = date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  // Dynamically look up high-res product photo from seed data
  const matchingProduct = SEED_FURNITURE.find(
    f => f.name.toLowerCase() === (item.furniture_name || '').toLowerCase()
  ) || SEED_FURNITURE.find(
    f => f.category.toLowerCase() === (item.category || '').toLowerCase()
  );
  const imageUrl = item.image_url || matchingProduct?.image_url || FURNITURE_IMAGES.placeholder;

  const isUnread = item.read !== true;

  return (
    <TouchableOpacity
      style={[styles.card, isUnread && styles.cardUnread]}
      onPress={() => onMarkAsRead(item.id)}
      activeOpacity={0.9}
    >
      {/* Unread indicator dot */}
      {isUnread && <View style={styles.unreadDot} />}

      {/* Header row */}
      <View style={styles.cardHeader}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#E6D5C0' }}
          resizeMode="cover"
        />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.furniture_name || 'Furniture Item'}</Text>
          <Text style={styles.cardSub}>{item.category || 'General'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <MaterialCommunityIcons name={status.icon} size={12} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Details row */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="counter" size={13} color={COLORS.themeTextSecondary} />
          <Text style={styles.detailText}>Qty: {item.quantity}</Text>
        </View>
        <View style={styles.detailItem}>
          <MaterialCommunityIcons name={paymentIcon} size={13} color={COLORS.themeTextSecondary} />
          <Text style={styles.detailText}>{item.payment_method || 'Cash on Delivery'}</Text>
        </View>
        <Text style={styles.priceText}>
          ₱{Number(item.price * (item.quantity || 1)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </Text>
      </View>

      {/* Footer & Cancel Button row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <View style={styles.cardFooter}>
          <MaterialCommunityIcons name="calendar-outline" size={12} color={COLORS.gray400} />
          <Text style={styles.dateText}>{dateStr} · {timeStr}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {statusKey === 'pending' && (
            <>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => onCancel(item.id)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="close-circle-outline" size={13} color={COLORS.error} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => onEdit(item)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="pencil-outline" size={13} color={COLORS.themeTextSecondary} />
                <Text style={styles.editBtnText}>Edit Order</Text>
              </TouchableOpacity>
            </>
          )}

          {statusKey === 'cancelled' && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => onClear(item.id)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={13} color={COLORS.themeTextSecondary} />
              <Text style={styles.clearBtnText}>Clear Notif</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function parseColors(colors) {
  if (!colors) return [];
  if (Array.isArray(colors)) return colors;
  if (typeof colors === 'string') {
    return colors.split(',').map(c => c.trim()).filter(Boolean);
  }
  return [];
}

function parseMaterials(material) {
  if (!material) return ['Wood'];
  if (Array.isArray(material)) return material;
  if (typeof material === 'string') {
    return material.split(',').map(m => m.trim()).filter(Boolean);
  }
  return ['Wood'];
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Custom confirmation modal states
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);

  // Edit Order Modal States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [selectedQty, setSelectedQty] = useState(1);

  function handleCancelOrder(orderId) {
    setOrderToCancel(orderId);
    setCancelModalVisible(true);
  }

  function handleEditOrder(order) {
    const matchingProduct = SEED_FURNITURE.find(
      f => f.name.toLowerCase() === (order.furniture_name || '').toLowerCase()
    );
    setEditingOrder(order);
    const colors = parseColors(matchingProduct?.colors);
    setSelectedColor(order.selected_color || colors[0] || '#8B5E3C');
    const mats = parseMaterials(matchingProduct?.material);
    setSelectedMaterial(order.selected_material || mats[0] || 'Wood');
    setSelectedQty(order.quantity || 1);
    setEditModalVisible(true);
  }

  async function confirmEditOrder() {
    if (!editingOrder) return;
    setEditModalVisible(false);
    try {
      const orderId = editingOrder.id;
      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        const raw = await AsyncStorage.getItem('sales_history');
        let local = raw ? JSON.parse(raw) : [];
        local = local.map(o => o.id === orderId ? {
          ...o,
          selected_color: selectedColor,
          selected_material: selectedMaterial,
          quantity: selectedQty
        } : o);
        await AsyncStorage.setItem('sales_history', JSON.stringify(local));
        setOrders(local);
      } else {
        // Real user - Update quantity in Supabase
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUuid = uuidRegex.test(orderId);

        if (isValidUuid) {
          const { error } = await supabase
            .from('sales')
            .update({
              quantity: selectedQty
            })
            .eq('id', orderId);
          if (error) throw error;
        }

        // persistence in local cache (retains color/material/quantity)
        const cacheKey = `notifications_${user.id}`;
        const cachedRaw = await AsyncStorage.getItem(cacheKey);
        if (cachedRaw) {
          let cachedOrders = JSON.parse(cachedRaw);
          cachedOrders = cachedOrders.map(o => String(o.id) === String(orderId) ? {
            ...o,
            selected_color: selectedColor,
            selected_material: selectedMaterial,
            quantity: selectedQty
          } : o);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedOrders));
          setOrders(cachedOrders);
        }
        await fetchOrders();
      }
      Alert.alert('Success 🎉', 'Order variations updated successfully.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not update order.');
    } finally {
      setEditingOrder(null);
    }
  }

  // Click on a notification to mark it as read immediately and clear the badge count smoothly!
  async function handleMarkAsRead(orderId) {
    try {
      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          return { ...o, read: true };
        }
        return o;
      });
      setOrders(updatedOrders);

      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        await AsyncStorage.setItem('sales_history', JSON.stringify(updatedOrders));
      } else {
        await AsyncStorage.setItem(`notifications_${user.id}`, JSON.stringify(updatedOrders));
      }
    } catch (_) { }
  }

  // Deletes notification from AsyncStorage and Supabase (only works on status === 'cancelled')
  async function handleDeleteNotification(orderId) {
    try {
      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        const raw = await AsyncStorage.getItem('sales_history');
        let local = raw ? JSON.parse(raw) : [];
        local = local.filter(o => o.id !== orderId);
        await AsyncStorage.setItem('sales_history', JSON.stringify(local));
        setOrders(local);
      } else {
        // Real user - Delete from remote Supabase
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUuid = uuidRegex.test(orderId);
        if (isValidUuid) {
          const { error } = await supabase.from('sales').delete().eq('id', orderId);
          if (error) throw error;
        }
        // Also update local cache
        const cacheKey = `notifications_${user.id}`;
        const cachedRaw = await AsyncStorage.getItem(cacheKey);
        if (cachedRaw) {
          let cachedOrders = JSON.parse(cachedRaw);
          cachedOrders = cachedOrders.filter(o => String(o.id) !== String(orderId));
          await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedOrders));
          setOrders(cachedOrders);
        }
        await fetchOrders();
      }
      Alert.alert('Cleared 🧹', 'Notification cleared successfully.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not clear notification.');
    }
  }

  async function confirmCancelOrder() {
    if (!orderToCancel) return;
    setCancelModalVisible(false);
    try {
      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        const raw = await AsyncStorage.getItem('sales_history');
        let local = raw ? JSON.parse(raw) : [];
        local = local.map(o => o.id === orderToCancel ? { ...o, status: 'cancelled', read: false } : o); // reset to unread so they get a badge reminder of cancellation!
        await AsyncStorage.setItem('sales_history', JSON.stringify(local));
        setOrders(local);
      } else {
        // Validate if orderToCancel is a valid UUID before querying Supabase to prevent type-mismatch crashes
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUuid = uuidRegex.test(orderToCancel);

        if (isValidUuid) {
          const { error } = await supabase
            .from('sales')
            .update({ status: 'cancelled' })
            .eq('id', orderToCancel);
          if (error) throw error;
        }

        // Also update local cache so order cancel displays correctly even under database sync lag or empty remote db fallback
        const cacheKey = `notifications_${user.id}`;
        const cachedRaw = await AsyncStorage.getItem(cacheKey);
        if (cachedRaw) {
          let cachedOrders = JSON.parse(cachedRaw);
          cachedOrders = cachedOrders.map(o => String(o.id) === String(orderToCancel) ? { ...o, status: 'cancelled', read: false } : o);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedOrders));
          setOrders(cachedOrders);
        }

        await fetchOrders();
      }
      Alert.alert('Order Cancelled 🚫', 'Your order has been cancelled successfully.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not cancel order.');
    } finally {
      setOrderToCancel(null);
    }
  }

  async function fetchOrders() {
    if (!user) { setLoading(false); return; }

    try {
      let fetched = [];
      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        const raw = await AsyncStorage.getItem('sales_history');
        fetched = raw ? JSON.parse(raw) : [];
      } else {
        // Real users — query Supabase sales table
        const { data, error } = await Promise.race([
          supabase
            .from('sales')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 7000)
          ),
        ]);
        if (!error && data && data.length > 0) {
          fetched = data;
          await AsyncStorage.setItem(`notifications_${user.id}`, JSON.stringify(data));
        } else {
          const cached = await AsyncStorage.getItem(`notifications_${user.id}`);
          fetched = cached ? JSON.parse(cached) : [];
        }
      }

      // Mark all orders as read automatically when screen loads/opens!
      const hasUnread = fetched.some(o => o.read !== true);
      if (hasUnread) {
        const readOrders = fetched.map(o => ({ ...o, read: true }));
        setOrders(readOrders);
        if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
          await AsyncStorage.setItem('sales_history', JSON.stringify(readOrders));
        } else {
          await AsyncStorage.setItem(`notifications_${user.id}`, JSON.stringify(readOrders));
        }
      } else {
        setOrders(fetched);
      }
    } catch (e) {
      console.warn('Notifications fetch error:', e);
      // Offline fallback
      try {
        const cached = await AsyncStorage.getItem(`notifications_${user.id}`);
        if (cached) {
          const cachedOrders = JSON.parse(cached);
          const hasUnread = cachedOrders.some(o => o.read !== true);
          if (hasUnread) {
            const readOrders = cachedOrders.map(o => ({ ...o, read: true }));
            setOrders(readOrders);
            await AsyncStorage.setItem(`notifications_${user.id}`, JSON.stringify(readOrders));
          } else {
            setOrders(cachedOrders);
          }
        }
      } catch (_) { }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchOrders();
    }, [user])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [user]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={ACTIVE_COLOR} size="large" />
      </View>
    );
  }

  const unreadCount = orders.filter(o => o.read !== true).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialCommunityIcons name="bell-outline" size={26} color={ACTIVE_COLOR} />
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="bell-off-outline" size={64} color="#D4C5A9" />
          <Text style={styles.emptyTitle}>No Notifications Yet</Text>
          <Text style={styles.emptySubtitle}>
            Your order history will appear here once you make a purchase.
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item, i) => String(item.id || i)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACTIVE_COLOR}
              colors={[ACTIVE_COLOR]}
            />
          }
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>Order History ({orders.length})</Text>
          }
          renderItem={({ item }) => (
            <NotificationCard
              item={item}
              onCancel={handleCancelOrder}
              onMarkAsRead={handleMarkAsRead}
              onClear={handleDeleteNotification}
              onEdit={handleEditOrder}
            />
          )}
        />
      )}

      {/* Custom Confirmation Modal matching FurniCute Warm Beige & Espresso design */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={cancelModalVisible}
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="close-circle-outline" size={36} color={COLORS.error} />
            </View>

            <Text style={styles.modalTitle}>Cancel Order?</Text>

            <Text style={styles.modalDescription}>
              Are you sure you want to cancel this order? This action will permanently cancel your purchase.
            </Text>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalKeepBtn}
                onPress={() => {
                  setCancelModalVisible(false);
                  setOrderToCancel(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalKeepText}>No, Keep</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelConfirmBtn}
                onPress={confirmCancelOrder}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelConfirmText}>Yes, Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Variation Selection & Edit Order Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Order Variations</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setEditModalVisible(false)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={22} color={COLORS.themeText} />
              </TouchableOpacity>
            </View>

            {editingOrder && (() => {
              const matchingProduct = SEED_FURNITURE.find(
                f => f.name.toLowerCase() === (editingOrder.furniture_name || '').toLowerCase()
              );
              const colors = parseColors(matchingProduct?.colors);
              const mats = parseMaterials(matchingProduct?.material);
              const imageUrl = editingOrder.image_url || matchingProduct?.image_url || FURNITURE_IMAGES.placeholder;

              return (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                  {/* Product Brief Summary Card */}
                  <View style={styles.briefRow}>
                    <Image source={{ uri: imageUrl }} style={styles.briefImage} resizeMode="cover" />
                    <View style={styles.briefDetails}>
                      <Text style={styles.briefName} numberOfLines={1}>{editingOrder.furniture_name}</Text>
                      <Text style={styles.briefCat}>{editingOrder.category}</Text>
                      <Text style={styles.briefPrice}>₱{Number(editingOrder.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
                    </View>
                  </View>

                  {/* Colors Row */}
                  {colors.length > 0 && (
                    <>
                      <Text style={styles.modalSectionLabel}>Select Color</Text>
                      <View style={styles.variationRow}>
                        {colors.map(col => {
                          const isActive = selectedColor === col;
                          return (
                            <TouchableOpacity
                              key={col}
                              style={[
                                styles.colorBubble,
                                { backgroundColor: col },
                                isActive && styles.colorBubbleActive,
                              ]}
                              onPress={() => setSelectedColor(col)}
                              activeOpacity={0.8}
                            >
                              {isActive && (
                                <MaterialCommunityIcons
                                  name="check"
                                  size={16}
                                  color={col.toLowerCase() === '#ffffff' || col.toLowerCase() === '#fff' ? '#000' : '#FFF'}
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  )}

                  {/* Materials Row */}
                  {mats.length > 0 && (
                    <>
                      <Text style={styles.modalSectionLabel}>Select Material</Text>
                      <View style={styles.variationRow}>
                        {mats.map(mat => {
                          const isActive = selectedMaterial === mat;
                          return (
                            <TouchableOpacity
                              key={mat}
                              style={[
                                styles.matChip,
                                isActive && styles.matChipActive,
                              ]}
                              onPress={() => setSelectedMaterial(mat)}
                              activeOpacity={0.8}
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

                  {/* Quantity Adjusted Row */}
                  <View style={styles.qtyContainer}>
                    <Text style={[styles.modalSectionLabel, { marginTop: 0, marginBottom: 0 }]}>Quantity</Text>
                    <View style={styles.qtySelector}>
                      <TouchableOpacity
                        style={styles.qtyAdjustBtn}
                        onPress={() => setSelectedQty(prev => Math.max(1, prev - 1))}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.qtyAdjustText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyVal}>{selectedQty}</Text>
                      <TouchableOpacity
                        style={styles.qtyAdjustBtn}
                        onPress={() => setSelectedQty(prev => prev + 1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.qtyAdjustText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Confirm Action Button */}
                  <TouchableOpacity style={styles.modalAddBtn} onPress={confirmEditOrder} activeOpacity={0.95}>
                    <Text style={styles.modalAddBtnText}>
                      Save Changes • ₱{(Number(editingOrder.price) * selectedQty).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 22, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText,
  },
  countBadge: {
    backgroundColor: ACTIVE_COLOR, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  countText: {
    color: '#FFF', fontSize: 12, fontWeight: '700', fontFamily: FONTS.bold,
  },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  sectionLabel: {
    fontSize: 13, fontFamily: FONTS.medium, fontWeight: '600',
    color: COLORS.themeTextSecondary, marginBottom: 4,
  },

  // Card
  card: {
    backgroundColor: COLORS.themeCardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.themeCardBorder,
    padding: 14, gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FDF3E7', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E6D5C0',
  },
  cardTitle: {
    fontSize: 14, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText,
  },
  cardSub: {
    fontSize: 11, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  statusText: {
    fontSize: 11, fontWeight: '700', fontFamily: FONTS.bold,
  },

  detailsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.themeCardBorder,
  },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary },
  priceText: {
    marginLeft: 'auto', fontSize: 14, fontWeight: '800',
    fontFamily: FONTS.bold, color: ACTIVE_COLOR,
  },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: {
    fontSize: 11, fontFamily: FONTS.regular, color: COLORS.gray400,
  },

  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: RADIUS.md,
  },
  cancelBtnText: {
    color: COLORS.error,
    fontSize: 11,
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },

  // Custom Modal Confirmation Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(53, 37, 24, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.themeCardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.themeCardBorder,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    fontWeight: '800',
    color: COLORS.themeText,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.themeTextSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  modalActionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalKeepBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: COLORS.themeInputBorder,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalKeepText: {
    color: COLORS.themeText,
    fontSize: 13,
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },
  modalCancelConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelConfirmText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },

  cardUnread: {
    backgroundColor: '#FAF0E4',
    borderColor: '#E6CDB3',
    borderWidth: 1.5,
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D67A32',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAE0D5',
    borderWidth: 1,
    borderColor: '#D2C2B2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
  },
  clearBtnText: {
    color: COLORS.themeTextSecondary,
    fontSize: 11,
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },

  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EAE0D5',
    borderWidth: 1,
    borderColor: '#D2C2B2',
    borderRadius: RADIUS.md,
  },
  editBtnText: {
    color: COLORS.themeTextSecondary,
    fontSize: 11,
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },

  /* Variation Edit Modal Styles */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(53, 37, 24, 0.4)', justifyContent: 'flex-end' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.themeCardBorder, paddingBottom: 10 },
  closeBtn: { padding: 4 },
  briefRow: { flexDirection: 'row', gap: 14, marginBottom: 16, backgroundColor: '#FFF', borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.themeCardBorder },
  briefImage: { width: 70, height: 70, borderRadius: RADIUS.sm, backgroundColor: '#FDF3E7' },
  briefDetails: { flex: 1, justifyContent: 'center', gap: 2 },
  briefName: { fontSize: 15, fontFamily: FONTS.bold, fontWeight: '700', color: COLORS.themeText },
  briefCat: { fontSize: 12, color: COLORS.themeTextSecondary, fontFamily: FONTS.regular },
  briefPrice: { fontSize: 16, fontFamily: FONTS.bold, fontWeight: '800', color: ACTIVE_COLOR },
  modalSectionLabel: { fontSize: 13, fontFamily: FONTS.bold, fontWeight: '700', color: COLORS.themeText, marginTop: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  variationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  colorBubble: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  colorBubbleActive: { borderWidth: 3, borderColor: '#D67A32' },
  matChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.md, backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.themeCardBorder },
  matChipActive: { backgroundColor: COLORS.themeButtonBg, borderColor: COLORS.themeButtonBg },
  matChipText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary },
  matChipTextActive: { color: '#FFF', fontFamily: FONTS.bold },
  qtyContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 20, backgroundColor: '#FFF', padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.themeCardBorder },
  qtySelector: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyAdjustBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FDF3E7', justifyContent: 'center', alignItems: 'center' },
  qtyAdjustText: { fontSize: 16, fontWeight: 'bold', color: COLORS.themeText },
  qtyVal: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.themeText, minWidth: 20, textAlign: 'center' },
  modalAddBtn: { backgroundColor: COLORS.themeButtonBg, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  modalAddBtnText: { color: '#FFF', fontSize: 14, fontFamily: FONTS.bold, fontWeight: '700' },

  // Empty
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  emptyTitle: {
    fontSize: 20, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText,
  },
  emptySubtitle: {
    fontSize: 14, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary,
    textAlign: 'center', lineHeight: 22,
  },
});

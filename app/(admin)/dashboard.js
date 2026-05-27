import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, TextInput, ScrollView,
  Platform,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { COLORS, RADIUS, FURNITURE_IMAGES, FONTS, CATEGORIES, SEED_FURNITURE } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AnimatedButton from '../../components/AnimatedButton';

const fallbackAdminData = SEED_FURNITURE;

const ACTION_COLORS = {
  ADD: '#16A34A',
  EDIT: '#2563EB',
  DELETE: '#DC2626',
  HIDE: '#D97706',
  SHOW: '#059669',
  PURCHASE: '#D67A32',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, visible: 0, hidden: 0 });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [categoriesList, setCategoriesList] = useState(CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState('All');

  async function fetchItemsAndLogs() {
    try {
      // 1. Fetch Items
      let fetchedItems = [];
      if (user?.id === 'demo-admin-id' || user?.id === 'demo-customer-id') {
        const local = await AsyncStorage.getItem('admin_furniture');
        fetchedItems = local ? JSON.parse(local) : fallbackAdminData;
      } else {
        let data = null, fetchError = null;
        try {
          const result = await Promise.race([
            supabase.from('furniture').select('*').order('created_at', { ascending: false }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('furniture timeout')), 5000)),
          ]);
          data = result?.data;
          fetchError = result?.error;
        } catch (timeoutErr) {
          console.warn('Dashboard: Supabase furniture fetch timed out — using seed data');
        }
        if (!fetchError && data && data.length > 0) {
          fetchedItems = data;
        } else if (fetchError) {
          console.warn('Furniture fetch error:', fetchError.message);
          fetchedItems = fallbackAdminData;
        } else {
          // Supabase table is empty or timed out — use seed data and seed it in the background
          fetchedItems = fallbackAdminData;
          if (user && user.id !== 'demo-admin-id' && user.id !== 'demo-customer-id') {
            (async () => {
              try {
                console.log('Seeding empty remote database...');
                for (const item of fallbackAdminData) {
                  await supabase.from('furniture').upsert({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    category: item.category,
                    description: item.description,
                    is_visible: item.is_visible,
                    colors: item.colors,
                    material: item.material || 'Wood',
                    image_url: item.image_url
                  });
                }
                console.log('Remote database successfully seeded!');
              } catch (seedErr) {
                console.warn('Database seeding failed:', seedErr);
              }
            })();
          }
        }
      }

      // Proactively patch the 404 cabinet image
      fetchedItems = fetchedItems.map(i => {
        if (i.image_url && i.image_url.includes('photo-1558997519-83ea9252eaf8')) {
          return { ...i, image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80' };
        }
        return i;
      });

      setItems(fetchedItems);
      setStats({
        total: fetchedItems.length,
        visible: fetchedItems.filter(i => i.is_visible).length,
        hidden: fetchedItems.filter(i => !i.is_visible).length,
      });

      // 2. Fetch Logs
      if (user?.id === 'demo-admin-id' || user?.id === 'demo-customer-id') {
        const localLogs = await AsyncStorage.getItem('admin_logs');
        if (localLogs) {
          setLogs(JSON.parse(localLogs).slice(0, 15));
        } else {
          const defaultLogs = [
            {
              id: 'log-1',
              action: 'ADD',
              furniture_name: 'Nordic Accent Chair',
              details: 'Added Chair item at ₱4999.00',
              created_at: new Date(Date.now() - 30 * 60000).toISOString(),
            },
            {
              id: 'log-2',
              action: 'HIDE',
              furniture_name: 'Platform Bed Frame',
              details: 'Item hidden from users',
              created_at: new Date(Date.now() - 120 * 60000).toISOString(),
            }
          ];
          setLogs(defaultLogs);
          await AsyncStorage.setItem('admin_logs', JSON.stringify(defaultLogs));
        }
      } else {
        let logsData = null;
        let salesData = null;
        try {
          const logsResult = await Promise.race([
            supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(15),
            new Promise((_, reject) => setTimeout(() => reject(new Error('logs timeout')), 5000)),
          ]);
          logsData = logsResult?.data;
        } catch (timeoutErr) {
          console.warn('Dashboard: activity_logs fetch timed out');
        }

        try {
          const salesResult = await Promise.race([
            supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(15),
            new Promise((_, reject) => setTimeout(() => reject(new Error('sales timeout')), 5000)),
          ]);
          salesData = salesResult?.data;
        } catch (timeoutErr) {
          console.warn('Dashboard: sales fetch timed out');
        }

        let combined = [];
        if (logsData) {
          combined = [...logsData];
        }
        if (salesData) {
          salesData.forEach(sale => {
            combined.push({
              id: `sale-${sale.id}`,
              action: 'PURCHASE',
              furniture_name: sale.furniture_name,
              details: `User ordered ${sale.quantity}x ${sale.furniture_name} for ₱${sale.price} each via ${sale.payment_method} (Status: ${sale.status})`,
              created_at: sale.created_at
            });
          });
        }

        // Sort chronologically (newest first) and limit to 15 logs
        combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setLogs(combined.slice(0, 15));
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (items && items.length > 0) {
      const dbCats = items.map(i => i.category).filter(Boolean).map(c => c.trim());
      const uniqueCats = ['All', ...new Set([...CATEGORIES.filter(c => c !== 'All'), ...dbCats])];
      setCategoriesList(uniqueCats);
    } else {
      setCategoriesList(CATEGORIES);
    }
  }, [items]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchItemsAndLogs();
      }
    }, [user])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchItemsAndLogs();
  }, []);

  async function logAction(action, item, details) {
    try {
      if (user?.id === 'demo-admin-id' || user?.id === 'demo-customer-id') {
        const logsLocal = await AsyncStorage.getItem('admin_logs');
        const currentLogs = logsLocal ? JSON.parse(logsLocal) : [];
        const newLog = {
          id: `log-${Date.now()}`,
          admin_name: profile?.username || 'Administrator',
          action,
          furniture_name: item.name,
          details,
          created_at: new Date().toISOString(),
        };
        currentLogs.unshift(newLog);
        await AsyncStorage.setItem('admin_logs', JSON.stringify(currentLogs));
        setLogs(currentLogs.slice(0, 15));
        return;
      }

      try {
        await Promise.race([
          supabase.from('activity_logs').insert({
            admin_id: profile.id,
            action,
            furniture_id: item.id,
            furniture_name: item.name,
            details,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('log timeout')), 5000)),
        ]);
      } catch (logErr) {
        console.warn('Logging timed out:', logErr);
      }

      // Refresh logs
      let logsData = null;
      try {
        const result = await Promise.race([
          supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(15),
          new Promise((_, reject) => setTimeout(() => reject(new Error('refresh logs timeout')), 5000)),
        ]);
        logsData = result?.data;
      } catch (e) {
        console.warn('Logs refresh timed out');
      }
      if (logsData) setLogs(logsData);
    } catch (e) {
      console.warn('Logging skipped:', e);
    }
  }

  async function toggleVisibility(item) {
    const newVal = !item.is_visible;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
    if (user?.id === 'demo-admin-id' || user?.id === 'demo-customer-id' || !isUuid) {
      const updated = items.map(i => i.id === item.id ? { ...i, is_visible: newVal } : i);
      setItems(updated);
      await AsyncStorage.setItem('admin_furniture', JSON.stringify(updated));
      await logAction(newVal ? 'SHOW' : 'HIDE', item, `Item ${newVal ? 'shown' : 'hidden'}`);
      setStats(prev => ({
        ...prev,
        visible: newVal ? prev.visible + 1 : prev.visible - 1,
        hidden: newVal ? prev.hidden - 1 : prev.hidden + 1,
      }));
      return;
    }

    try {
      await Promise.race([
        supabase.from('furniture').update({ is_visible: newVal }).eq('id', item.id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('visibility update timeout')), 5000)),
      ]);
      await logAction(newVal ? 'SHOW' : 'HIDE', item, `Item ${newVal ? 'shown to' : 'hidden from'} users`);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_visible: newVal } : i));
      setStats(prev => ({
        ...prev,
        visible: newVal ? prev.visible + 1 : prev.visible - 1,
        hidden: newVal ? prev.hidden - 1 : prev.hidden + 1,
      }));
    } catch (e) {
      Alert.alert('Error', 'Visibility update timed out. Please try again.');
    }
  }

  async function deleteItem(item) {
    Alert.alert(
      'Delete Item',
      `Delete "${item.name}"? This item will be removed from display.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
            if (user?.id === 'demo-admin-id' || user?.id === 'demo-customer-id' || !isUuid) {
              const updated = items.filter(i => i.id !== item.id);
              setItems(updated);
              await AsyncStorage.setItem('admin_furniture', JSON.stringify(updated));
              await logAction('DELETE', item, 'Item deleted');
              setStats({
                total: updated.length,
                visible: updated.filter(i => i.is_visible).length,
                hidden: updated.filter(i => !i.is_visible).length,
              });
              return;
            }

            try {
              await Promise.race([
                supabase.from('furniture').delete().eq('id', item.id),
                new Promise((_, reject) => setTimeout(() => reject(new Error('delete item timeout')), 5000)),
              ]);
              await logAction('DELETE', item, 'Item removed from database');
              fetchItemsAndLogs();
            } catch (e) {
              Alert.alert('Error', 'Delete item timed out. Please try again.');
            }
          }
        }
      ]
    );
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

  // Filtered List computed locally
  const filteredItems = items.filter(item => {
    const name = (item.name || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || cat.includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.black} size="large" />
      </View>
    );
  }

  // Render Single product item card
  const renderItemCard = (item) => (
    <View key={item.id} style={[styles.card, !item.is_visible && styles.cardHidden]}>
      <Image source={getImage(item)} style={styles.cardImg} resizeMode="cover" />
      <View style={styles.cardInfo}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          {!item.is_visible && (
            <View style={styles.hiddenBadge}>
              <Text style={styles.hiddenBadgeText}>Hidden</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardCat}>{item.category}</Text>
        <Text style={styles.cardPrice}>
          ₱{Number(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </Text>
        <View style={styles.actionRow}>
          <AnimatedButton
            style={styles.editBtn}
            onPress={() => router.push(`/(admin)/edit-item/${item.id}`)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <MaterialCommunityIcons name="pencil" size={12} color={COLORS.white} />
              <Text style={styles.editBtnText}>Edit</Text>
            </View>
          </AnimatedButton>
          <AnimatedButton
            style={[styles.visBtn, item.is_visible ? styles.visBtnHide : styles.visBtnShow]}
            onPress={() => toggleVisibility(item)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <MaterialCommunityIcons
                name={item.is_visible ? "eye-off" : "eye"}
                size={12}
                color={item.is_visible ? COLORS.themeText : COLORS.white}
              />
              <Text style={[styles.visBtnText, !item.is_visible && { color: COLORS.white }]}>
                {item.is_visible ? 'Hide' : 'Show'}
              </Text>
            </View>
          </AnimatedButton>
          <AnimatedButton style={styles.delBtn} onPress={() => deleteItem(item)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="delete" size={14} color={COLORS.white} />
            </View>
          </AnimatedButton>
        </View>
      </View>
    </View>
  );

  const renderAnalyticsButton = () => (
    <View style={styles.analyticsSection}>
      <AnimatedButton
        style={styles.analyticsBtn}
        onPress={() => router.push('/(admin)/sales-analytics')}
      >
        <View style={styles.analyticsBtnContent}>
          <View style={styles.analyticsIconBg}>
            <MaterialCommunityIcons name="chart-line" size={22} color={COLORS.white} />
          </View>
          <View style={styles.analyticsTextWrap}>
            <Text style={styles.analyticsBtnTitle}>Sales Reports & Analytics</Text>
            <Text style={styles.analyticsBtnDesc}>Monitor units sold each day, month, and year</Text>
          </View>
          <Text style={styles.analyticsBtnArrow}>→</Text>
        </View>
      </AnimatedButton>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.black} />}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerSub}>Admin Portal</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={styles.headerTitle}>FurniCute Panel</Text>
                  <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#D67A32" />
                </View>
              </View>
              <AnimatedButton style={styles.newProductBtn} onPress={() => router.push('/(admin)/add-item')}>
                <Text style={styles.newProductBtnText}>+ Add Item</Text>
              </AnimatedButton>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <StatCard label="Total Products" value={stats.total} icon="package-variant-closed" />
              <StatCard label="Visible" value={stats.visible} icon="eye-outline" />
              <StatCard label="Hidden" value={stats.hidden} icon="eye-off-outline" />
            </View>

            {/* Dedicated Sales Analytics Entry Button */}
            {renderAnalyticsButton()}

            {/* Filters */}
            <View style={styles.filterSection}>
              <View style={styles.searchBarWrap}>
                <MaterialCommunityIcons name="magnify" size={18} color="#D67A32" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search items..."
                  value={search}
                  onChangeText={setSearch}
                  placeholderTextColor={COLORS.gray500}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {categoriesList.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catTab, selectedCategory === cat && styles.catTabActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={[styles.catTabText, selectedCategory === cat && styles.catTabTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Inventory Header Label */}
            <Text style={[styles.paneTitle, { marginHorizontal: 16, marginBottom: 12 }]}>Manage Inventory</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="package-variant" size={44} color="#D67A32" />
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        }
        renderItem={({ item }) => renderItemCard(item)}
      />
    </View>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statLabel}>{label}</Text>
        <MaterialCommunityIcons name={icon} size={18} color="#D67A32" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerSub: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  newProductBtn: { backgroundColor: COLORS.themeDarkBrown, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md },
  newProductBtnText: { color: COLORS.white, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: COLORS.themeInputBg, borderRadius: RADIUS.md,
    padding: 16, gap: 8, borderWidth: 1, borderColor: COLORS.themeInputBorder,
  },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  statLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, fontWeight: '600' },
  filterSection: { paddingHorizontal: 16, marginBottom: 16, gap: 12 },
  searchBarWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder, borderRadius: RADIUS.md, paddingHorizontal: 14 },
  searchInput: { flex: 1, paddingVertical: 12, color: COLORS.themeText, fontSize: 14, fontFamily: FONTS.regular },
  categoryRow: { gap: 8 },
  catTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder },
  catTabActive: { backgroundColor: COLORS.themeDarkBrown, borderColor: COLORS.themeDarkBrown },
  catTabText: { color: COLORS.themeTextSecondary, fontSize: 12, fontFamily: FONTS.medium, fontWeight: '600' },
  catTabTextActive: { color: COLORS.themeButtonText },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
  paneTitle: { fontSize: 14, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText },
  card: {
    flexDirection: 'row', backgroundColor: COLORS.themeCardBg,
    borderRadius: RADIUS.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.themeCardBorder,
  },
  cardHidden: { opacity: 0.55 },
  cardImg: { width: 100, height: '100%', alignSelf: 'stretch', backgroundColor: COLORS.themeInputBg },
  cardInfo: { flex: 1, padding: 10, gap: 2 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardName: { flex: 1, fontSize: 13, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText },
  hiddenBadge: { backgroundColor: COLORS.themeInputBorder, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  hiddenBadgeText: { fontSize: 9, color: COLORS.themeTextSecondary, fontFamily: FONTS.bold, fontWeight: '700' },
  cardCat: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary },
  cardPrice: { fontSize: 14, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  actionRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  editBtn: { width: 75, paddingVertical: 7, backgroundColor: COLORS.themeDarkBrown, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  editBtnText: { color: COLORS.themeButtonText, fontSize: 11, fontFamily: FONTS.bold, fontWeight: '600' },
  visBtn: { width: 85, paddingVertical: 7, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  visBtnHide: { backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder },
  visBtnShow: { backgroundColor: COLORS.themeDarkBrown },
  visBtnText: { color: COLORS.themeText, fontSize: 11, fontFamily: FONTS.bold, fontWeight: '600' },
  delBtn: { width: 36, paddingVertical: 7, backgroundColor: COLORS.error, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary },
  // Sales Analytics Button Styles
  analyticsSection: { paddingHorizontal: 16, marginBottom: 16 },
  analyticsBtn: {
    backgroundColor: COLORS.themeDarkBrown,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.themeDarkBrown,
  },
  analyticsBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  analyticsIconBg: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsTextWrap: { flex: 1, gap: 2 },
  analyticsBtnTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  analyticsBtnDesc: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontFamily: FONTS.regular,
  },
  analyticsBtnArrow: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },
});

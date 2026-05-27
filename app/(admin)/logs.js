import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { COLORS, RADIUS, FONTS } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ACTION_COLORS = {
  ADD: '#16A34A',
  EDIT: '#2563EB',
  DELETE: '#DC2626',
  HIDE: '#D97706',
  SHOW: '#059669',
  PURCHASE: '#D67A32',
};

const ACTION_ICONS = {
  ADD: 'plus-circle-outline',
  EDIT: 'pencil-outline',
  DELETE: 'delete-outline',
  HIDE: 'eye-off-outline',
  SHOW: 'eye-outline',
  PURCHASE: 'cart-outline',
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

export default function LogsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchLogs() {
    console.log('fetchLogs: started, user =', user);
    try {
      if (user?.id === 'demo-admin-id' || user?.id === 'demo-customer-id') {
        console.log('fetchLogs: demo user detected');
        const local = await AsyncStorage.getItem('admin_logs');
        const localSales = await AsyncStorage.getItem('sales_history');
        
        const parsedLogs = local ? JSON.parse(local) : [];
        const parsedSales = localSales ? JSON.parse(localSales) : [];

        // Format local demo sales as transactions with full user and item details
        const formattedSales = parsedSales.map(sale => ({
          id: `sale-${sale.id}`,
          action: 'PURCHASE',
          furniture_name: sale.furniture_name || sale.furniture?.name || 'Furniture Item',
          details: `Ordered by: Store Customer (customer@furnicute.com) [UID: demo-customer-id] | Item: ${sale.furniture_name || sale.furniture?.name || 'Item'} [${sale.category || 'General'}] | Qty: ${sale.quantity}x @ ₱${sale.price || sale.furniture?.price} | Total: ₱${Number((sale.quantity || 1) * (sale.price || sale.furniture?.price)).toLocaleString('en-PH', { minimumFractionDigits: 2 })} | Paid via: ${sale.payment_method || 'Cash on Delivery'} | Status: ${(sale.status || 'pending').toUpperCase()}`,
          created_at: sale.created_at || new Date().toISOString(),
        }));

        const combined = [...parsedLogs, ...formattedSales]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setLogs(combined);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('fetchLogs: querying Supabase activity_logs and sales...');
      let logsData = null;
      let salesData = null;
      let profilesData = null;

      try {
        const logsResult = await Promise.race([
          supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100),
          new Promise((_, reject) => setTimeout(() => reject(new Error('logs timeout')), 5000)),
        ]);
        logsData = logsResult?.data || [];
      } catch (err) {
        console.warn('fetchLogs: activity_logs fetch timed out');
      }

      try {
        const salesResult = await Promise.race([
          supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(100),
          new Promise((_, reject) => setTimeout(() => reject(new Error('sales timeout')), 5000)),
        ]);
        salesData = salesResult?.data || [];
      } catch (err) {
        console.warn('fetchLogs: sales fetch timed out');
      }

      try {
        const profilesResult = await Promise.race([
          supabase.from('profiles').select('id, username, email'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('profiles timeout')), 5000)),
        ]);
        profilesData = profilesResult?.data || [];
      } catch (err) {
        console.warn('fetchLogs: profiles fetch timed out');
      }

      const profilesMap = {};
      if (profilesData) {
        profilesData.forEach(p => {
          profilesMap[p.id] = p;
        });
      }

      let combined = [];
      if (logsData) {
        combined = [...logsData];
      }

      if (salesData) {
        salesData.forEach(sale => {
          const userProfile = profilesMap[sale.user_id];
          const userStr = userProfile ? `${userProfile.username || userProfile.email || 'Customer'}` : 'Customer';
          const emailStr = userProfile?.email ? ` (${userProfile.email})` : '';

          combined.push({
            id: `sale-${sale.id}`,
            action: 'PURCHASE',
            furniture_name: sale.furniture_name || 'Furniture Item',
            details: `Ordered by: ${userStr}${emailStr} [UID: ${sale.user_id || 'N/A'}] | Item: ${sale.furniture_name} [${sale.category || 'General'}] | Qty: ${sale.quantity}x @ ₱${sale.price} | Total: ₱${Number(sale.quantity * sale.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })} | Paid via: ${sale.payment_method} | Status: ${(sale.status || 'pending').toUpperCase()}`,
            created_at: sale.created_at,
          });
        });
      }

      // Sort chronologically (newest first)
      combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setLogs(combined);
    } catch (e) {
      console.error('fetchLogs: exception:', e);
    } finally {
      console.log('fetchLogs: setting loading to false');
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchLogs(); }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.black} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.replace('/(admin)/dashboard')}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.headerTitle}>Transactions</Text>
            <MaterialCommunityIcons name="clipboard-list-outline" size={24} color="#D67A32" />
          </View>
        </View>
        <Text style={styles.headerSub}>{logs.length} transactions recorded</Text>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.black} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color="#D67A32" />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubText}>Transactions will appear here</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.logCard}>
            <View style={[styles.actionBadge, { backgroundColor: (ACTION_COLORS[item.action] || '#555') + '22' }]}>
              <MaterialCommunityIcons
                name={ACTION_ICONS[item.action] || 'note-text-outline'}
                size={22}
                color={ACTION_COLORS[item.action] || COLORS.themeTextSecondary}
              />
              <Text style={[styles.actionLabel, { color: ACTION_COLORS[item.action] || COLORS.themeTextSecondary }]}>
                {item.action}
              </Text>
            </View>
            <View style={styles.logBody}>
              <Text style={styles.logItem} numberOfLines={1}>{item.furniture_name || 'Unknown Item'}</Text>
              <Text style={styles.logDetails} numberOfLines={2}>{item.details}</Text>
              <Text style={styles.logTime}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 16, gap: 2 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backIcon: { fontSize: 24, color: COLORS.themeText, lineHeight: Platform.OS === 'web' ? 24 : undefined },
  headerTitle: { fontSize: 24, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  headerSub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, marginLeft: 38 },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
  logCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: COLORS.themeCardBg, borderRadius: RADIUS.lg,
    padding: 14, borderWidth: 1, borderColor: COLORS.themeCardBorder,
  },
  actionBadge: {
    alignItems: 'center', gap: 4, padding: 10,
    borderRadius: RADIUS.md, minWidth: 60,
  },
  actionLabel: { fontSize: 10, fontFamily: FONTS.bold, fontWeight: '800', letterSpacing: 0.5 },
  logBody: { flex: 1, gap: 3 },
  logItem: { fontSize: 14, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText },
  logDetails: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, lineHeight: 18 },
  logTime: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText },
  emptySubText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary },
});

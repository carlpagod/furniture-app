import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { COLORS, RADIUS, FONTS } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText, Line, G } from 'react-native-svg';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PERIOD_THEMES = {
  Day:   { primary: '#D67A32', lightBg: '#FDF3E7', borderColor: '#E6D5C0', glow: '#9E5016', label: 'Daily Sales' },
  Month: { primary: '#D67A32', lightBg: '#FDF3E7', borderColor: '#E6D5C0', glow: '#9E5016', label: 'Monthly Sales' },
  Year:  { primary: '#D67A32', lightBg: '#FDF3E7', borderColor: '#E6D5C0', glow: '#9E5016', label: 'Yearly Sales' },
};

const CATEGORY_COLORS = {
  Chair: { bg: '#FEF3C7', text: '#D97706' },
  Sofa: { bg: '#DBEAFE', text: '#2563EB' },
  Table: { bg: '#F3E8FF', text: '#9333EA' },
  Bed: { bg: '#E0F2FE', text: '#0284C7' },
  Cabinet: { bg: '#F1F5F9', text: '#475569' },
  Lighting: { bg: '#FCE7F3', text: '#DB2777' },
  placeholder: { bg: '#E2E8F0', text: '#64748B' },
};

function LineChart({ values, labels, theme }) {
  const maxVal = Math.max(...values, 5);
  const width = 500;
  const height = 180;
  
  const paddingLeft = 35;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 25;
  
  const graphW = width - paddingLeft - paddingRight;
  const graphH = height - paddingTop - paddingBottom;

  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    let startTime = Date.now();
    const duration = 500;
    let animId;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function: easeOutQuad
      const eased = progress * (2 - progress);
      setAnimatedProgress(eased);
      
      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      }
    };
    
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [values]);
  
  const points = values.map((val, idx) => {
    const x = paddingLeft + (values.length > 1 ? (idx / (values.length - 1)) * graphW : graphW / 2);
    const targetY = paddingTop + graphH - (val / maxVal) * graphH;
    const baselineY = paddingTop + graphH;
    const y = baselineY - (baselineY - targetY) * animatedProgress;
    return { x, y, val, label: labels[idx] };
  });
  
  // Create line path d-string
  let linePath = '';
  let areaPath = '';
  
  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    points.forEach((p, i) => {
      if (i > 0) linePath += ` L ${p.x} ${p.y}`;
    });
    
    areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + graphH} L ${points[0].x} ${paddingTop + graphH} Z`;
  }
  
  const midVal = Math.round(maxVal / 2);
  
  return (
    <View style={{ height: 180, width: '100%', overflow: 'hidden', paddingRight: 4 }}>
      <Svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
        <Defs>
          <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.primary} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={theme.primary} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>
        
        {/* Grid lines */}
        <Line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#E6D5C0" strokeWidth="1" strokeDasharray="4 4" />
        <Line x1={paddingLeft} y1={paddingTop + graphH / 2} x2={width - paddingRight} y2={paddingTop + graphH / 2} stroke="#E6D5C0" strokeWidth="1" strokeDasharray="4 4" />
        <Line x1={paddingLeft} y1={paddingTop + graphH} x2={width - paddingRight} y2={paddingTop + graphH} stroke="#C4956A" strokeWidth="1" />
        
        {/* Y Axis text labels */}
        <SvgText x={paddingLeft - 8} y={paddingTop + 3} fontSize="9" fontWeight="700" fill="#C4956A" textAnchor="end" fontFamily={FONTS.bold}>{maxVal}</SvgText>
        <SvgText x={paddingLeft - 8} y={paddingTop + graphH / 2 + 3} fontSize="9" fontWeight="700" fill="#C4956A" textAnchor="end" fontFamily={FONTS.bold}>{midVal}</SvgText>
        <SvgText x={paddingLeft - 8} y={paddingTop + graphH + 3} fontSize="9" fontWeight="700" fill="#C4956A" textAnchor="end" fontFamily={FONTS.bold}>0</SvgText>
        
        {/* Filled Area */}
        {areaPath ? <Path d={areaPath} fill="url(#chartGrad)" /> : null}
        
        {/* Stroke Line */}
        {linePath ? (
          <Path
            d={linePath}
            fill="none"
            stroke={theme.primary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        
        {/* Points Dots and Val Badges */}
        {points.map((p, idx) => (
          <G key={idx}>
            {/* Outer soft glow circle */}
            <Circle cx={p.x} cy={p.y} r="7" fill={theme.primary} fillOpacity="0.18" />
            {/* Main point circle */}
            <Circle
              cx={p.x}
              cy={p.y}
              r="4.5"
              fill={COLORS.white}
              stroke={theme.primary}
              strokeWidth="2.2"
            />
            
            {/* Value tooltip above point */}
            {animatedProgress >= 0.8 && (
              <SvgText
                x={p.x}
                y={p.y - 9}
                fontSize="9"
                fontWeight="800"
                fill={theme.glow}
                textAnchor="middle"
                fontFamily={FONTS.bold}
              >
                {p.val}
              </SvgText>
            )}
            
            {/* X-axis label */}
            <SvgText
              x={p.x}
              y={paddingTop + graphH + 15}
              fontSize="9"
              fontWeight="700"
              fill="#C4956A"
              textAnchor="middle"
              fontFamily={FONTS.bold}
            >
              {p.label}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
}

const DEFAULT_SALES = () => {
  const now = new Date();
  return [
    { id: 's-1', furniture_name: 'Nordic Accent Chair', category: 'Chair', quantity: 2, price: 4999.00, created_at: now.toISOString() },
    { id: 's-2', furniture_name: 'Luxe 3-Seater Sofa', category: 'Sofa', quantity: 1, price: 18999.00, created_at: now.toISOString() },
    { id: 's-3', furniture_name: 'Marble Dining Table', category: 'Table', quantity: 1, price: 12500.00, created_at: new Date(now - 24 * 3600000).toISOString() },
    { id: 's-4', furniture_name: 'Arc Floor Lamp', category: 'Lighting', quantity: 3, price: 3299.00, created_at: new Date(now - 24 * 3600000).toISOString() },
    { id: 's-5', furniture_name: 'Platform Bed Frame', category: 'Bed', quantity: 1, price: 15999.00, created_at: new Date(now - 3 * 86400000).toISOString() },
    { id: 's-6', furniture_name: 'Storage Cabinet', category: 'Cabinet', quantity: 2, price: 8750.00, created_at: new Date(now - 4 * 86400000).toISOString() },
    { id: 's-7', furniture_name: 'Luxe 3-Seater Sofa', category: 'Sofa', quantity: 2, price: 18999.00, created_at: new Date(now - 20 * 86400000).toISOString() },
    { id: 's-8', furniture_name: 'Nordic Accent Chair', category: 'Chair', quantity: 4, price: 4999.00, created_at: new Date(now - 45 * 86400000).toISOString() },
    { id: 's-9', furniture_name: 'Marble Dining Table', category: 'Table', quantity: 3, price: 12500.00, created_at: new Date(now - 75 * 86400000).toISOString() },
    { id: 's-10', furniture_name: 'Ergonomic Office Chair', category: 'Chair', quantity: 12, price: 6999.00, created_at: new Date(now - 200 * 86400000).toISOString() },
  ];
};

export default function SalesAnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [salesHistory, setSalesHistory] = useState([]);
  const [salesStats, setSalesStats] = useState({ day: 0, month: 0, year: 0 });
  const [salesPeriod, setSalesPeriod] = useState('Day');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchSales() {
    try {
      let loadedSales = [];
      if (user?.id === 'demo-admin-id' || user?.id === 'demo-customer-id') {
        const local = await AsyncStorage.getItem('sales_history');
        loadedSales = local ? JSON.parse(local) : [];
      } else {
        let data = null, error = null;
        try {
          const result = await Promise.race([
            supabase.from('sales').select('*').order('created_at', { ascending: false }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('sales timeout')), 5000)),
          ]);
          data = result?.data;
          error = result?.error;
        } catch (timeoutErr) {
          console.warn('fetchSales: Supabase timed out — using default sales data');
        }
        if (!error && data) { loadedSales = data; }
        else {
          const local = await AsyncStorage.getItem('sales_history');
          loadedSales = local ? JSON.parse(local) : [];
        }
      }
      if (loadedSales.length === 0) {
        loadedSales = DEFAULT_SALES();
        await AsyncStorage.setItem('sales_history', JSON.stringify(loadedSales));
      }
      setSalesHistory(loadedSales);
      const nowTime = new Date();
      const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
      const startOfMonth = new Date(nowTime.getFullYear(), nowTime.getMonth(), 1).getTime();
      const startOfYear = new Date(nowTime.getFullYear(), 0, 1).getTime();
      setSalesStats({
        day:   loadedSales.filter(s => new Date(s.created_at).getTime() >= startOfDay).reduce((sum, s) => sum + s.quantity, 0),
        month: loadedSales.filter(s => new Date(s.created_at).getTime() >= startOfMonth).reduce((sum, s) => sum + s.quantity, 0),
        year:  loadedSales.filter(s => new Date(s.created_at).getTime() >= startOfYear).reduce((sum, s) => sum + s.quantity, 0),
      });
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => {
    if (user) {
      fetchSales();
    }
  }, [user]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchSales(); }, []);

  function getDailyData() {
    const labels = [], values = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
      const start = new Date(new Date(d).setHours(0,0,0,0)).getTime();
      const end = new Date(new Date(d).setHours(23,59,59,999)).getTime();
      values.push(salesHistory.filter(s => { const t = new Date(s.created_at).getTime(); return t >= start && t <= end; }).reduce((sum, s) => sum + s.quantity, 0));
    }
    return { labels, values };
  }
  function getMonthlyData() {
    const labels = [], values = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
      const m = d.getMonth(), y = d.getFullYear();
      values.push(salesHistory.filter(s => { const sd = new Date(s.created_at); return sd.getMonth() === m && sd.getFullYear() === y; }).reduce((sum, s) => sum + s.quantity, 0));
    }
    return { labels, values };
  }
  function getYearlyData() {
    const labels = [], values = [];
    const cy = new Date().getFullYear();
    for (let i = 2; i >= 0; i--) {
      const y = cy - i; labels.push(String(y));
      values.push(salesHistory.filter(s => new Date(s.created_at).getFullYear() === y).reduce((sum, s) => sum + s.quantity, 0));
    }
    return { labels, values };
  }

  const chartData = salesPeriod === 'Day' ? getDailyData() : salesPeriod === 'Month' ? getMonthlyData() : getYearlyData();
  const maxChartVal = Math.max(...chartData.values, 5);
  const activeTheme = PERIOD_THEMES[salesPeriod];

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator color={COLORS.black} size="large" /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(admin)/dashboard')}>
          <Text style={styles.backBtnText}>← Dashboard</Text>
        </TouchableOpacity>
        <View style={styles.titleWithIcon}>
          <MaterialCommunityIcons name="chart-bar" size={20} color="#D67A32" />
          <Text style={styles.headerTitle}>Sales Analytics</Text>
        </View>
      </View>

      <FlatList
        data={salesHistory}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.black} />}
        ListHeaderComponent={
          <View style={styles.headerGroup}>
            {/* Stat Cards */}
            <View style={styles.statsRow}>
              {['Day', 'Month', 'Year'].map(period => {
                const theme = PERIOD_THEMES[period];
                const isActive = salesPeriod === period;
                const value = period === 'Day' ? salesStats.day : period === 'Month' ? salesStats.month : salesStats.year;
                const label = period === 'Day' ? 'Today' : period === 'Month' ? 'This Month' : 'This Year';
                return (
                  <TouchableOpacity key={period} activeOpacity={0.8}
                    style={[styles.salesStatCard, isActive && { backgroundColor: theme.lightBg, borderColor: theme.borderColor, borderWidth: 1.5 }]}
                    onPress={() => setSalesPeriod(period)}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={[styles.salesStatLabel, isActive && { color: theme.glow, fontWeight: '700' }]}>{label}</Text>
                      {isActive && <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />}
                    </View>
                    <Text style={[styles.salesStatValue, isActive && { color: theme.glow }]}>{value}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Line Chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartCardHeader}>
                <View>
                  <Text style={styles.chartCardTitle}>Sales Trend Over Time</Text>
                  <Text style={[styles.chartCardSubText, { color: activeTheme.glow }]}>{activeTheme.label} Overview</Text>
                </View>
                <View style={styles.chartPeriodTabs}>
                  {['Day', 'Month', 'Year'].map(period => (
                    <TouchableOpacity key={period}
                      style={[styles.periodTab, salesPeriod === period && { backgroundColor: PERIOD_THEMES[period].primary }]}
                      onPress={() => setSalesPeriod(period)}>
                      <Text style={[styles.periodTabText, salesPeriod === period && styles.periodTabTextActive]}>{period}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <LineChart values={chartData.values} labels={chartData.labels} theme={activeTheme} />
            </View>

            <View style={styles.historyTitleRow}>
              <Text style={styles.historyTitle}>Audit & Transactions</Text>
              <Text style={styles.historySub}>{salesHistory.length} sales recorded</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>PRODUCT</Text>
              <Text style={[styles.tableHeaderCell, { width: 50, textAlign: 'center' }]}>QTY</Text>
              <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'right' }]}>REVENUE</Text>
              <Text style={[styles.tableHeaderCell, { width: 75, textAlign: 'right' }]}>TIME</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="chart-line" size={44} color="#D67A32" style={{ marginBottom: 6 }} />
            <Text style={styles.emptyText}>No sales recorded yet.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const ct = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.placeholder;
          return (
            <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
              <View style={[styles.tableCell, { flex: 2 }]}>
                <Text style={styles.transName} numberOfLines={1}>{item.furniture_name}</Text>
                <View style={[styles.categoryBadge, { backgroundColor: ct.bg }]}><Text style={[styles.categoryBadgeText, { color: ct.text }]}>{item.category}</Text></View>
              </View>
              <View style={[styles.tableCell, { width: 50, alignItems: 'center' }]}><Text style={styles.transQty}>x{item.quantity}</Text></View>
              <View style={[styles.tableCell, { width: 90, alignItems: 'flex-end' }]}><Text style={styles.transPrice}>₱{Number(item.price * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text></View>
              <View style={[styles.tableCell, { width: 75, alignItems: 'flex-end' }]}><Text style={styles.transTime}>{timeAgo(item.created_at)}</Text></View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: COLORS.themeInputBorder },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.themeInputBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.themeInputBorder },
  backBtnText: { fontSize: 13, fontFamily: FONTS.bold, fontWeight: '700', color: COLORS.themeText },
  titleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  scrollContent: { paddingBottom: 100 },
  headerGroup: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  statsRow: { flexDirection: 'row', gap: 10 },
  salesStatCard: { flex: 1, backgroundColor: COLORS.themeCardBg, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.themeCardBorder, gap: 4 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  salesStatValue: { fontSize: 22, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  salesStatLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, fontWeight: '600' },
  chartCard: { backgroundColor: COLORS.themeCardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.themeCardBorder, padding: 16, gap: 16 },
  chartCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chartCardTitle: { fontSize: 13, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  chartCardSubText: { fontSize: 10, fontFamily: FONTS.medium, marginTop: 1 },
  chartPeriodTabs: { flexDirection: 'row', gap: 4, backgroundColor: COLORS.themeInputBg, padding: 3, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.themeInputBorder },
  periodTab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm },
  periodTabText: { fontSize: 10, fontFamily: FONTS.bold, fontWeight: '700', color: COLORS.themeTextSecondary },
  periodTabTextActive: { color: COLORS.white },
  chartArea: { height: 170, justifyContent: 'flex-end', paddingTop: 10, position: 'relative' },
  gridLinesWrap: { position: 'absolute', top: 12, bottom: 24, left: 0, right: 0, justifyContent: 'space-between', zIndex: 1 },
  gridLine: { borderBottomWidth: 1, borderBottomColor: COLORS.themeInputBorder, borderStyle: 'dashed', width: '100%' },
  barsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: '100%', zIndex: 2 },
  chartColumn: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', gap: 4 },
  barValBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full, marginBottom: 2 },
  barValBadgeText: { fontSize: 9, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.white },
  barTrack: { width: 22, height: '65%', backgroundColor: COLORS.themeInputBg, borderRadius: RADIUS.full, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  chartLabelText: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, marginTop: 2 },
  historyTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 },
  historyTitle: { fontSize: 15, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  historySub: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary },
  tableHeader: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: COLORS.themeText, marginTop: 8 },
  tableHeaderCell: { fontSize: 10, fontFamily: FONTS.bold, fontWeight: '700', color: COLORS.themeText, letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.themeCardBorder, alignItems: 'center', paddingHorizontal: 16 },
  tableRowAlt: { backgroundColor: COLORS.themeInputBg },
  tableCell: { justifyContent: 'center' },
  transName: { fontSize: 13, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.themeText },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full, marginTop: 4 },
  categoryBadgeText: { fontSize: 9, fontFamily: FONTS.bold, fontWeight: '700' },
  transQty: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.themeText },
  transPrice: { fontSize: 13, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  transTime: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary },
});

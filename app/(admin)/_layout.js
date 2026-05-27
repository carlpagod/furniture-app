import { Tabs, Slot, useRouter, usePathname } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Image, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FONTS, COLORS, RADIUS } from '../../lib/constants';
import { useAuth } from '../../lib/auth';

const ACTIVE_COLOR   = '#D67A32';
const INACTIVE_COLOR = '#C4956A';
const SIDEBAR_BG     = '#FDF3E7';
const SIDEBAR_BORDER = '#E6D5C0';

const ADMIN_NAV = [
  { name: 'dashboard',       route: '/(admin)/dashboard',       icon: 'view-dashboard-outline', label: 'Dashboard'  },
  { name: 'sales-analytics', route: '/(admin)/sales-analytics', icon: 'chart-bar',              label: 'Analytics'  },
  { name: 'add-item',        route: '/(admin)/add-item',        icon: 'plus-box-outline',        label: 'Add Item'   },
  { name: 'logs',            route: '/(admin)/logs',            icon: 'clipboard-list-outline',  label: 'Transactions' },
  { name: 'profile',         route: '/(admin)/profile',         icon: 'account-cog-outline',     label: 'My Profile' },
];

// ── Web Left Sidebar ─────────────────────────────────────────────────────────

function WebSidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();

  const avatarUrl  = profile?.avatar_url || null;
  const username   = profile?.username   || 'Administrator';

  return (
    <View style={styles.sidebar}>
      {/* Logo */}
      <View style={styles.sidebarBrand}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.sidebarLogo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.sidebarDivider} />

      {/* Nav Items */}
      <ScrollView style={styles.sideNavList} showsVerticalScrollIndicator={false}>
        {ADMIN_NAV.filter(item => item.name !== 'profile').map(item => {
          const isActive = pathname === `/${item.name}` || pathname.startsWith(`/${item.name}`);
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.sideItem, isActive && styles.sideItemActive]}
              onPress={() => router.replace(item.route)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={19}
                color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
              />
              <Text style={[styles.sideLabel, isActive && styles.sideLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Admin Profile Footer */}
      <View style={{ borderTopWidth: 1, borderTopColor: SIDEBAR_BORDER, paddingTop: 12, marginTop: 8 }}>
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: RADIUS.md,
            backgroundColor: '#FDDAB5',
          }}
          onPress={() => router.replace('/(admin)/profile')}
          activeOpacity={0.8}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: ACTIVE_COLOR }} />
          ) : (
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: ACTIVE_COLOR, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: FONTS.bold, color: COLORS.white }}>
                {username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', fontFamily: FONTS.bold, color: ACTIVE_COLOR }} numberOfLines={1}>
              {username}
            </Text>
            <Text style={{ fontSize: 10, fontFamily: FONTS.regular, color: INACTIVE_COLOR }}>
              Admin
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={16} color={INACTIVE_COLOR} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Mobile Bottom Tab Bar ────────────────────────────────────────────────────

function MobileTabBar({ state, descriptors, navigation }) {
  const visibleRoutes = state.routes.filter(route => {
    const { options } = descriptors[route.key];
    return options.href !== null;
  });

  return (
    <View style={styles.mobileBar}>
      {visibleRoutes.map((route, index) => {
        const isFocused = state.index === index;
        const navItem   = ADMIN_NAV.find(n => n.name === route.name);
        if (!navItem) return null;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate({ name: route.name, merge: true });
        };

        return (
          <TouchableOpacity key={route.key} style={styles.mobileBarItem} onPress={onPress} activeOpacity={0.8}>
            <View style={[styles.mobilePill, isFocused && styles.mobilePillActive]}>
              <MaterialCommunityIcons name={navItem.icon} size={21} color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR} />
            </View>
            <Text style={[styles.mobileLabel, isFocused && styles.mobileLabelActive]}>
              {navItem.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Access Denied ────────────────────────────────────────────────────────────

function AccessDenied() {
  const router = useRouter();
  return (
    <View style={styles.denied}>
      <MaterialCommunityIcons name="shield-lock-outline" size={72} color="#D67A32" />
      <Text style={styles.deniedTitle}>Access Denied</Text>
      <Text style={styles.deniedSub}>
        This area is restricted to administrators only.{'\n'}
        Your account does not have permission to access this page.
      </Text>
      <TouchableOpacity style={styles.deniedBtn} onPress={() => router.replace('/(user)/home')} activeOpacity={0.85}>
        <MaterialCommunityIcons name="home-outline" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
        <Text style={styles.deniedBtnText}>Go to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Admin Layout ─────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const { profile, loading, user } = useAuth();
  const isWeb = Platform.OS === 'web';

  if (loading || (user && !profile)) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.themeBg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={ACTIVE_COLOR} size="large" />
      </View>
    );
  }

  if (!profile || profile.role !== 'admin') return <AccessDenied />;

  // ── WEB: Sidebar + Slot ──────────────────────────────────────────────────
  if (isWeb) {
    return (
      <View style={styles.webRoot}>
        <WebSidebar />
        <View style={styles.webContent}>
          <Slot />
        </View>
      </View>
    );
  }

  // ── MOBILE: Bottom Tabs ──────────────────────────────────────────────────
  return (
    <Tabs
      tabBar={props => <MobileTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard"       options={{ tabBarIcon: () => null }} />
      <Tabs.Screen name="sales-analytics" options={{ tabBarIcon: () => null }} />
      <Tabs.Screen name="add-item"        options={{ tabBarIcon: () => null }} />
      <Tabs.Screen name="logs"            options={{ tabBarIcon: () => null }} />
      <Tabs.Screen name="profile"         options={{ tabBarIcon: () => null }} />
      <Tabs.Screen name="edit-item/[id]"  options={{ href: null }} />
    </Tabs>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Web root: row layout
  webRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.themeBg,
  },
  webContent: {
    flex: 1,
    overflow: 'hidden',
  },

  // ── Sidebar ──────────────────────────────────────────────────────────────
  sidebar: {
    width: 210,
    minWidth: 210,
    maxWidth: 210,
    backgroundColor: SIDEBAR_BG,
    borderRightWidth: 1,
    borderRightColor: SIDEBAR_BORDER,
    paddingBottom: 16,
    paddingTop: 16,
    paddingHorizontal: 10,
    shadowColor: '#D67A32',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'column',
  },
  sidebarBrand: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  sidebarLogo: {
    width: 150,
    height: 80,
  },
  sidebarBrandText: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: ACTIVE_COLOR,
    letterSpacing: -0.3,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: SIDEBAR_BORDER,
    marginBottom: 12,
    marginHorizontal: 6,
  },
  sideNavList: {
    flex: 1,
  },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    marginBottom: 2,
  },
  sideItemActive: {
    backgroundColor: '#FDDAB5',
  },
  sideLabel: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: INACTIVE_COLOR,
    fontWeight: '500',
  },
  sideLabelActive: {
    color: ACTIVE_COLOR,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: SIDEBAR_BORDER,
    paddingTop: 12,
    marginTop: 8,
  },
  profileFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#FDDAB5',
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: ACTIVE_COLOR,
  },
  profileAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ACTIVE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  profileTextWrap: {
    flex: 1,
  },
  profileName: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: ACTIVE_COLOR,
  },
  profileRole: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: INACTIVE_COLOR,
  },

  // ── Mobile Bottom Bar ─────────────────────────────────────────────────────
  mobileBar: {
    flexDirection: 'row',
    backgroundColor: SIDEBAR_BG,
    borderTopWidth: 1,
    borderTopColor: SIDEBAR_BORDER,
    height: 74,
    paddingBottom: 8,
    paddingTop: 6,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
    shadowColor: '#D67A32',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  mobileBarItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  mobilePill: { width: 40, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  mobilePillActive: { backgroundColor: '#FDDAB5' },
  mobileLabel: { fontSize: 9, color: INACTIVE_COLOR, fontFamily: FONTS.regular, fontWeight: '500', textAlign: 'center' },
  mobileLabelActive: { color: ACTIVE_COLOR, fontWeight: '700', fontFamily: FONTS.bold },

  // ── Access Denied ─────────────────────────────────────────────────────────
  denied: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.themeBg, padding: 32, gap: 12,
  },
  deniedTitle: { fontSize: 26, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText, textAlign: 'center' },
  deniedSub: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, textAlign: 'center', lineHeight: 22 },
  deniedBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.themeDarkBrown,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.md, marginTop: 8,
  },
  deniedBtnText: { color: COLORS.white, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
});

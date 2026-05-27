import { useEffect, useState, useCallback } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Animated, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONTS, COLORS } from '../../lib/constants';
import { useAuth } from '../../lib/auth';

const ACTIVE_COLOR = '#D67A32';
const INACTIVE_COLOR = '#C4956A';

const USER_NAV = [
  { name: 'home',          icon: 'sofa',           label: 'Home' },
  { name: 'cart',          icon: 'cart-outline',   label: 'Cart' },
  { name: 'notifications', icon: 'bell-outline',   label: 'Notifications' },
  { name: 'profile',       icon: 'account-outline', label: 'Profile' },
];


// AnimatedBadge component with bouncy scale animation for premium micro-interactions
function AnimatedBadge({ count, style, textStyle }) {
  const [scale] = useState(new Animated.Value(0));

  useEffect(() => {
    if (count > 0) {
      Animated.spring(scale, {
        toValue: 1,
        tension: 80,
        friction: 4,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(scale, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [count]);

  if (count === 0) return null;

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Text style={textStyle}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
}

// Reads unread notification count from AsyncStorage (only counts transactions where read !== true)
function useNotifCount(user) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        const raw = await AsyncStorage.getItem('sales_history');
        const list = raw ? JSON.parse(raw) : [];
        const unread = list.filter(o => o.read !== true);
        setCount(unread.length);
        return;
      }
      const raw = await AsyncStorage.getItem(`notifications_${user.id}`);
      const list = raw ? JSON.parse(raw) : [];
      const unread = list.filter(o => o.read !== true);
      setCount(unread.length);
    } catch (_) {}
  }, [user]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [user, refresh]);

  return count;
}

// Reads cart item quantities from AsyncStorage
function useCartCount(user) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const raw = await AsyncStorage.getItem(`cart_${user.id}`);
      const list = raw ? JSON.parse(raw) : [];
      const totalQty = list.reduce((sum, item) => sum + (item.quantity || 1), 0);
      setCount(totalQty);
    } catch (_) {}
  }, [user]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [user, refresh]);

  return count;
}

function CustomTabBar({ state, descriptors, navigation, user }) {
  const notifCount = useNotifCount(user);
  const cartCount = useCartCount(user);

  return (
    <View style={styles.mobileBar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        if (options.href === null) return null;
        const isFocused = state.index === index;
        const navItem = USER_NAV.find(n => n.name === route.name);
        if (!navItem) return null;

        const isNotif = route.name === 'notifications';
        const isCart = route.name === 'cart';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate({ name: route.name, merge: true });
        };

        return (
          <TouchableOpacity key={route.key} style={styles.mobileBarItem} onPress={onPress} activeOpacity={0.8}>
            <View style={[styles.mobilePill, isFocused && styles.mobilePillActive]}>
              <MaterialCommunityIcons
                name={navItem.icon}
                size={22}
                color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
              />
              
              {/* Animated Notification badge */}
              {isNotif && (
                <AnimatedBadge
                  count={notifCount}
                  style={styles.notifBadge}
                  textStyle={styles.notifBadgeText}
                />
              )}

              {/* Animated Cart badge */}
              {isCart && (
                <AnimatedBadge
                  count={cartCount}
                  style={styles.notifBadge}
                  textStyle={styles.notifBadgeText}
                />
              )}
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

export default function UserLayout() {
  const { profile, loading, user } = useAuth();

  // While auth is loading, show a spinner — never render user tabs prematurely
  if (loading || (user && !profile)) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.themeBg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={ACTIVE_COLOR} size="large" />
      </View>
    );
  }

  // Block admin users — redirect immediately to admin dashboard
  if (profile?.role === 'admin') {
    return <Redirect href="/(admin)/dashboard" />;
  }

  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} user={user} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ tabBarIcon: () => null }} />
      <Tabs.Screen name="cart" options={{ tabBarIcon: () => null }} />
      <Tabs.Screen name="notifications" options={{ tabBarIcon: () => null }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: () => null }} />
      <Tabs.Screen name="product/[id]" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  mobileBar: {
    flexDirection: 'row',
    backgroundColor: '#FDF3E7',
    borderTopWidth: 1, borderTopColor: '#E6D5C0',
    height: 74, paddingBottom: 8, paddingTop: 6, paddingHorizontal: 8,
    justifyContent: 'space-around',
    shadowColor: '#D67A32',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 8,
  },
  mobileBarItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  mobilePill: {
    width: 44, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  mobilePillActive: { backgroundColor: '#FDDAB5' },
  mobileLabel: { fontSize: 10, color: INACTIVE_COLOR, fontFamily: FONTS.regular, fontWeight: '500' },
  mobileLabelActive: { color: ACTIVE_COLOR, fontWeight: '700', fontFamily: FONTS.bold },

  // Notification badge on bell icon
  notifBadge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: '#D67A32',
    borderRadius: 10, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#FDF3E7',
  },
  notifBadgeText: {
    fontSize: 9, fontWeight: '800', fontFamily: FONTS.bold, color: '#FFF',
  },
});

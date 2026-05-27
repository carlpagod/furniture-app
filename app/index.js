import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Image, Platform, Text } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth';
import { COLORS, FONTS } from '../lib/constants';

export default function SplashScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const dotAnim   = useRef(new Animated.Value(0)).current;

  // Track when the minimum display time (2s) has elapsed
  const [minTimeDone, setMinTimeDone] = useState(false);
  // Track if we've already navigated (prevent double-navigate)
  const navigated = useRef(false);

  // ── WEB: skip splash, let _layout.js handle routing ──────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (loading) return;
    if (user && profile) return; // _layout.js will navigate
    router.replace('/(auth)/login');
  }, [loading, user, profile]);

  if (Platform.OS === 'web') {
    return <View style={styles.container} />;
  }

  // ── MOBILE: animated logo splash ──────────────────────────────────────────

  // Fade + scale in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();

    // Pulsing dots animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    // Minimum display time — 2 seconds
    const minTimer = setTimeout(() => setMinTimeDone(true), 2000);
    return () => clearTimeout(minTimer);
  }, []);

  // Navigate only when BOTH auth is resolved AND minimum time has passed
  useEffect(() => {
    if (loading) return;          // Auth still resolving
    if (!minTimeDone) return;     // Minimum display time not reached
    if (navigated.current) return; // Already navigated

    navigated.current = true;

    // Fade out then navigate
    Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(async () => {
      if (user && profile) {
        if (profile.role === 'admin') {
          router.replace('/(admin)/dashboard');
        } else {
          router.replace('/(user)/home');
        }
      } else {
        const seen = await AsyncStorage.getItem('onboarding_seen');
        if (seen) {
          router.replace('/(auth)/login');
        } else {
          router.replace('/onboarding');
        }
      }
    });
  }, [loading, minTimeDone, user, profile]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Animated.View style={[styles.dotsRow, { opacity: dotAnim }]}>
          <View style={styles.dot} />
          <View style={[styles.dot, { opacity: 0.6 }]} />
          <View style={[styles.dot, { opacity: 0.3 }]} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.themeBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  logo: {
    width: 240,
    height: 240,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D67A32',
  },
});

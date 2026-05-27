import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions,
  TouchableOpacity, Animated, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS } from '../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Discover Premium Furniture',
    subtitle: 'Explore thousands of curated pieces designed to transform your living space.',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    icon: 'home-outline',
  },
  {
    id: '2',
    title: 'Shop with Ease',
    subtitle: 'Browse by category, compare styles, and find exactly what you need in seconds.',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
    icon: 'cart-outline',
  },
  {
    id: '3',
    title: 'Fast & Secure Delivery',
    subtitle: 'Your furniture arrives safely and on time, every time. Shop with confidence.',
    image: 'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=600&q=80',
    icon: 'truck-delivery-outline',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const flatRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  async function finish() {
    await AsyncStorage.setItem('onboarding_seen', 'true');
    router.replace('/(auth)/login');
  }

  function handleNext() {
    if (currentIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      finish();
    }
  }

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image source={{ uri: item.image }} style={styles.slideImage} resizeMode="cover" />
            <View style={styles.content}>
              <MaterialCommunityIcons name={item.icon} size={36} color="#D67A32" />
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />

      {/* Indicators */}
      <View style={styles.footer}>
        <View style={styles.indicators}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity }]}
              />
            );
          })}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={finish} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  slide: { width, height },
  slideImage: {
    width: '100%',
    height: '55%',
    backgroundColor: COLORS.themeInputBg,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.themeBg,
    paddingHorizontal: 32,
    paddingTop: 32,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.themeText,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.themeTextSecondary,
    lineHeight: 22,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  indicators: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.black,
  },
  nextBtn: {
    width: '100%',
    backgroundColor: COLORS.themeButtonBg,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  nextText: {
    color: COLORS.themeButtonText,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  skipBtn: { paddingVertical: 8 },
  skipText: {
    color: COLORS.themeTextSecondary,
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
});

import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
  ActivityIndicator, Image,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { COLORS, RADIUS, FONTS } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedButton from '../../components/AnimatedButton';

const IS_WEB = Platform.OS === 'web';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function validate() {
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleLogin() {
    if (!validate()) { shake(); return; }
    setLoading(true);
    try {
      const result = await signIn(email.trim().toLowerCase(), password);

      // Route based on role returned by the database
      const role = result?.profile?.role;
      if (role === 'admin') {
        router.replace('/(admin)/dashboard');
      } else {
        router.replace('/(user)/home');
      }
    } catch (err) {
      shake();
      Alert.alert('Login Failed', err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Platform Badge */}
          <View style={[styles.platformBadge, IS_WEB ? styles.platformBadgeAdmin : styles.platformBadgeUser]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons
                name={IS_WEB ? "shield-account-outline" : "cart-outline"}
                size={15}
                color={COLORS.white}
              />
              <Text style={styles.platformBadgeText}>
                {IS_WEB ? 'Admin Portal' : 'Customer App'}
              </Text>
            </View>
          </View>

          <Text style={styles.titleText}>
            {IS_WEB ? 'Admin Sign In' : 'Welcome back'}
          </Text>
          <Text style={styles.subtitleText}>
            {IS_WEB ? 'Manage your store inventory' : 'Sign in to continue shopping'}
          </Text>

          <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email address</Text>
              <View style={[styles.inputWrap, errors.email && styles.inputWrapError]}>
                <MaterialCommunityIcons name="email-outline" size={16} color={COLORS.gray400} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.gray400}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrap, errors.password && styles.inputWrapError]}>
                <MaterialCommunityIcons name="lock-outline" size={16} color={COLORS.gray400} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.gray400}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <MaterialCommunityIcons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={COLORS.gray500}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Sign In Button */}
            <AnimatedButton
              style={[styles.signInBtn, IS_WEB && styles.signInBtnAdmin, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.themeButtonText} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 6 }}>
                  <MaterialCommunityIcons name="login" size={18} color={COLORS.themeButtonText} />
                  <Text style={styles.signInBtnText}>
                    {IS_WEB ? 'Sign In as Admin' : 'Sign In'}
                  </Text>
                </View>
              )}
            </AnimatedButton>

            {/* Divider and SignUp option (only shown on Mobile customer app, hidden on Web Admin) */}
            {!IS_WEB && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>New to FurniCute?</Text>
                  <View style={styles.dividerLine} />
                </View>

                <AnimatedButton
                  style={styles.signUpBtn}
                  onPress={() => router.push('/(auth)/signup')}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 6 }}>
                    <MaterialCommunityIcons name="account-plus-outline" size={18} color={COLORS.themeText} />
                    <Text style={styles.signUpBtnText}>Create Account</Text>
                  </View>
                </AnimatedButton>
              </>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Footer furniture decoration (behind the card) */}
      <View style={styles.footerContainer} pointerEvents="none">
        <Image
          source={require('../../assets/footer-furniture.png')}
          style={styles.footerFurnitureImage}
          resizeMode="cover"
        />
        {IS_WEB && (
          <>
            <Image
              source={require('../../assets/footer-furniture.png')}
              style={styles.footerFurnitureImage}
              resizeMode="cover"
            />
            <Image
              source={require('../../assets/footer-furniture.png')}
              style={styles.footerFurnitureImage}
              resizeMode="cover"
            />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },

  logoSection: { alignItems: 'center', marginBottom: 4 },
  logoImage: { width: 180, height: 180 },

  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.themeBeige,
    borderRadius: 24,
    padding: 28,
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#D4C5A9',
  },

  platformBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 16,
  },
  platformBadgeAdmin: { backgroundColor: COLORS.themeDarkBrown },
  platformBadgeUser: { backgroundColor: COLORS.themeButtonBg },
  platformBadgeText: { color: COLORS.white, fontFamily: FONTS.bold, fontWeight: '700', fontSize: 13 },

  titleText: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.themeText,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.themeTextSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },

  form: { gap: 16 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', fontFamily: FONTS.medium, color: COLORS.themeText, letterSpacing: 0.2 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.themeInputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputWrapError: { borderColor: COLORS.error },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.themeText },
  eyeBtn: { padding: 4 },
  errorText: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.error },

  signInBtn: {
    backgroundColor: COLORS.themeButtonBg,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: COLORS.themeText,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  signInBtnAdmin: { backgroundColor: COLORS.themeDarkBrown },
  btnDisabled: { opacity: 0.6 },
  signInBtnText: { color: COLORS.white, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 16 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.themeInputBorder },
  dividerText: { color: COLORS.themeTextSecondary, fontFamily: FONTS.regular, fontSize: 13 },

  signUpBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.themeButtonBg,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.themeButtonBg,
  },
  signUpBtnText: { color: COLORS.white, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },

  footerContainer: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    height: 160,
    flexDirection: 'row',
    alignItems: 'flex-end',
    zIndex: -1,
    opacity: 0.85,
    overflow: 'hidden',
  },
  footerFurnitureImage: {
    height: 150,
    flex: 1,
  },
});

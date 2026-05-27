import { useState, useRef, useEffect } from 'react';
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

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  // Prevent admin signups on web by redirecting to login page
  useEffect(() => {
    if (IS_WEB) {
      router.replace('/(auth)/login');
    }
  }, []);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Signup is only for customer (user) accounts.
  // Admin accounts are managed directly in the Supabase dashboard.
  const role = 'user';

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function validate() {
    const e = {};
    if (!username.trim()) e.username = 'Name is required';
    else if (username.trim().length < 2) e.username = 'Name must be at least 2 characters';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(password)) e.password = 'Must contain at least one uppercase letter';
    else if (!/[0-9]/.test(password)) e.password = 'Must contain at least one number';
    if (!confirm) e.confirm = 'Please confirm your password';
    else if (confirm !== password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSignup() {
    if (!validate()) { shake(); return; }
    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password, username.trim(), role);
      Alert.alert(
        'Account Created! 🎉',
        `Your account has been registered successfully as ${role === 'admin' ? 'an Administrator' : 'a Customer'}. Please sign in.`,
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err) {
      shake();
      Alert.alert('Sign Up Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Platform badge */}
          <View style={[styles.platformBadge, IS_WEB ? styles.platformBadgeAdmin : styles.platformBadgeUser]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons
                name={IS_WEB ? "shield-account-outline" : "cart-outline"}
                size={15}
                color={COLORS.white}
              />
              <Text style={styles.platformBadgeText}>{IS_WEB ? 'Admin Portal' : 'Customer App'}</Text>
            </View>
          </View>

          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>{IS_WEB ? 'Register an admin account' : 'Join FurniCute today'}</Text>
          </View>

          <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
            {/* Username */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Username</Text>
              <View style={[styles.passwordRow, errors.username && styles.inputError, { paddingLeft: 12 }]}>
                <MaterialCommunityIcons name="account-outline" size={16} color={COLORS.gray400} style={{ marginRight: 8, marginTop: Platform.OS === 'web' ? 0 : 2 }} />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Choose a username"
                  placeholderTextColor={COLORS.gray500}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>
              {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
            </View>

            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.passwordRow, errors.email && styles.inputError, { paddingLeft: 12 }]}>
                <MaterialCommunityIcons name="email-outline" size={16} color={COLORS.gray400} style={{ marginRight: 8, marginTop: Platform.OS === 'web' ? 0 : 2 }} />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.gray500}
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
              <View style={[styles.passwordRow, errors.password && styles.inputError, { paddingLeft: 12 }]}>
                <MaterialCommunityIcons name="lock-outline" size={16} color={COLORS.gray400} style={{ marginRight: 8, marginTop: Platform.OS === 'web' ? 0 : 2 }} />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  placeholderTextColor={COLORS.gray500}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                  <MaterialCommunityIcons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.gray500} />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[styles.passwordRow, errors.confirm && styles.inputError, { paddingLeft: 12 }]}>
                <MaterialCommunityIcons name="lock-outline" size={16} color={COLORS.gray400} style={{ marginRight: 8, marginTop: Platform.OS === 'web' ? 0 : 2 }} />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Re-enter password"
                  placeholderTextColor={COLORS.gray500}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showCpw}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowCpw(!showCpw)} style={styles.eyeBtn}>
                  <MaterialCommunityIcons name={showCpw ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.gray500} />
                </TouchableOpacity>
              </View>
              {errors.confirm && <Text style={styles.errorText}>{errors.confirm}</Text>}
            </View>

            <AnimatedButton
              style={[styles.signupBtn, loading && styles.btnDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 6 }}>
                  <MaterialCommunityIcons name="account-plus-outline" size={18} color={COLORS.themeButtonText} />
                  <Text style={styles.signupBtnText}>Create Account</Text>
                </View>
              )}
            </AnimatedButton>

            <AnimatedButton onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>
                Already have an account? <Text style={styles.loginLinkBold}>Sign In</Text>
              </Text>
            </AnimatedButton>
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
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  logoSection: { alignItems: 'center', marginBottom: 8 },
  logoImage: { width: 140, height: 140 },
  card: { width: '100%', maxWidth: 420, backgroundColor: COLORS.themeBeige, borderRadius: 24, padding: 28, shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 12, borderWidth: 1, borderColor: '#D4C5A9' },
  platformBadge: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginBottom: 12 },
  platformBadgeAdmin: { backgroundColor: COLORS.themeDarkBrown },
  platformBadgeUser: { backgroundColor: COLORS.themeButtonBg },
  platformBadgeText: { color: COLORS.themeButtonText, fontFamily: FONTS.bold, fontWeight: '700', fontSize: 13 },
  header: { marginBottom: 20 },
  backBtn: { padding: 4, marginBottom: 8 },
  backIcon: { fontSize: 24, color: COLORS.themeText },
  title: { fontSize: 28, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, marginTop: 6 },
  form: { gap: 16 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', fontFamily: FONTS.medium, color: COLORS.themeText, letterSpacing: 0.3 },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.error },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.themeInputBg,
    borderWidth: 1,
    borderColor: COLORS.themeInputBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
  },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.themeText },
  eyeBtn: { padding: 4 },
  signupBtn: {
    backgroundColor: COLORS.themeButtonBg,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  signupBtnText: { color: COLORS.white, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 16 },
  loginLink: { alignItems: 'center', paddingVertical: 12 },
  loginLinkText: { color: COLORS.themeTextSecondary, fontFamily: FONTS.regular, fontSize: 14 },
  loginLinkBold: { color: COLORS.themeText, fontWeight: '700', fontFamily: FONTS.bold },
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

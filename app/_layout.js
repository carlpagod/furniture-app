import React, { useEffect, useState, Component } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Platform, LogBox } from 'react-native';
import { COLORS, RADIUS, FONTS } from '../lib/constants';
import { registerAlertListener, Alert } from '../lib/alert';

// ── Web DOM removeChild Polyfill/Patch (fixes fatal DOMException crash on fast refresh / unmount) ──
if (Platform.OS === 'web' && typeof Node !== 'undefined' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      return child;
    }
    return originalRemoveChild.call(this, child);
  };
}

// Silence non-critical third-party dependency warnings to ensure a premium developer environment
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const msg = args.map(arg => String(arg)).join(' ');
    if (
      msg.includes("shared value's .value inside reanimated inline style") ||
      msg.includes("VirtualizedLists should never be nested") ||
      msg.includes("defaultProps will be removed")
    ) {
      return;
    }
    originalWarn(...args);
  };
}

LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Support for defaultProps will be removed',
  'Reanimated 3.x is not supported with the New Architecture',
  'Sending...',
  'Key "cancelled" in the image picker result is deprecated',
  "It looks like you might be using shared value's .value inside reanimated inline style",
]);

function RootLayoutNav() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [alertData, setAlertData] = useState(null);

  useEffect(() => {
    return registerAlertListener((data) => {
      setAlertData(data);
    });
  }, []);

  useEffect(() => {
    if (loading || (user && !profile)) return;

    const inAuthGroup  = segments[0] === '(auth)';
    const inUserGroup  = segments[0] === '(user)';
    const inAdminGroup = segments[0] === '(admin)';

    if (!user) {
      if (inUserGroup || inAdminGroup) {
        router.replace('/(auth)/login');
      }
    } else if (user && profile) {
      if (profile.role === 'admin') {
        // Admin must always be in the admin group
        if (!inAdminGroup) {
          router.replace('/(admin)/dashboard');
        }
      } else {
        // Regular user must always be in the user group
        if (!inUserGroup) {
          router.replace('/(user)/home');
        }
      }
    }
  }, [user, profile, loading, segments]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(user)" />
        <Stack.Screen name="(admin)" />
      </Stack>

      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.themeBg, justifyContent: 'center', alignItems: 'center', zIndex: 999 }]}>
          <ActivityIndicator color={COLORS.black} size="large" />
        </View>
      )}

      {/* Custom Cross-Platform Web Alert Modal overlay */}
      {alertData && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>{alertData.title}</Text>
            {alertData.message ? (
              <Text style={styles.alertMessage}>{alertData.message}</Text>
            ) : null}
            <View style={styles.alertButtons}>
              {alertData.buttons && alertData.buttons.length > 0 ? (
                alertData.buttons.map((btn, idx) => (
                  <TouchableOpacity
                     key={idx}
                     style={[
                       styles.alertBtn,
                       btn.style === 'destructive'
                         ? styles.alertBtnDestructive
                         : btn.style === 'cancel'
                         ? styles.alertBtnCancel
                         : styles.alertBtnDefault,
                     ]}
                     onPress={() => {
                       setAlertData(null);
                       if (btn.onPress) btn.onPress();
                     }}
                     activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.alertBtnText,
                        btn.style === 'destructive'
                          ? styles.alertBtnTextDestructive
                          : btn.style === 'cancel'
                          ? styles.alertBtnTextCancel
                          : styles.alertBtnTextDefault,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <TouchableOpacity
                  style={[styles.alertBtn, styles.alertBtnDefault, { width: '100%' }]}
                  onPress={() => setAlertData(null)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.alertBtnText, styles.alertBtnTextDefault]}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Error Boundary (catches removeChild DOM crash on web) ────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(err) { console.warn('Layout error caught:', err?.message); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#FAFAF9', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 460, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, borderWidth: 1.5, borderColor: '#000000' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#000000', marginBottom: 12, textAlign: 'center' }}>
              Something went wrong
            </Text>
            <Text style={{ fontSize: 13, color: '#DC2626', marginBottom: 20, textAlign: 'center', fontFamily: 'monospace', backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5' }}>
              {this.state.error?.message || 'A rendering error occurred.'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                this.setState({ hasError: false, error: null });
                if (typeof window !== 'undefined') window.location.reload();
              }}
              style={{ backgroundColor: '#000000', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Reload Page</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <StatusBar style="light" />
        <RootLayoutNav />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    padding: 24,
  },
  alertCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1.5,
    borderColor: COLORS.black,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.black,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.themeTextSecondary,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    width: '100%',
  },
  alertBtn: {
    flex: 1,
    minWidth: 80,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBtnDefault: {
    backgroundColor: COLORS.black,
  },
  alertBtnDestructive: {
    backgroundColor: COLORS.error,
  },
  alertBtnCancel: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.themeInputBorder,
  },
  alertBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },
  alertBtnTextDefault: {
    color: COLORS.white,
  },
  alertBtnTextDestructive: {
    color: COLORS.white,
  },
  alertBtnTextCancel: {
    color: COLORS.black,
  },
});

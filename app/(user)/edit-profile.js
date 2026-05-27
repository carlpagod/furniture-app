import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { COLORS, RADIUS, FONTS } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [address, setAddress] = useState('');
  const [mobile, setMobile] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setAddress(profile.address || '');
      setMobile(profile.mobile || '');
      setBirthdate(profile.birthdate || '');
      setGender(profile.gender || '');
    }
  }, [profile]);

  function validate() {
    const e = {};
    if (!username.trim()) e.username = 'Username is required';
    if (mobile && !/^[0-9+\-\s]{7,15}$/.test(mobile)) e.mobile = 'Enter a valid phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setLoading(true);
    try {
      const updates = {
        username: username.trim(),
        address: address.trim(),
        mobile: mobile.trim(),
        birthdate: birthdate.trim(),
        gender: gender.trim(),
      };

      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        const updatedProfile = { ...profile, ...updates };
        await AsyncStorage.setItem('furnicute_session', JSON.stringify({ user, profile: updatedProfile }));
        await refreshProfile();
        Alert.alert('Saved ✅', 'Profile updated.', [{ text: 'OK', onPress: () => router.back() }]);
        return;
      }

      let error = null;
      try {
        const result = await Promise.race([
          supabase.from('profiles').update(updates).eq('id', user.id),
          new Promise((_, reject) => setTimeout(() => reject(new Error('profile update timeout')), 5000)),
        ]);
        error = result?.error;
      } catch (timeoutErr) {
        throw new Error('Server connection timed out. Please try again.');
      }
      if (error) throw error;
      await refreshProfile();
      Alert.alert('Saved ✅', 'Profile updated.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save.');
    } finally {
      setLoading(false);
    }
  }

  const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>

        {/* Read-only Email */}
        <View style={styles.readOnlyCard}>
          <MaterialCommunityIcons name="email-outline" size={20} color="#D67A32" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.readOnlyLabel}>Email (cannot be changed)</Text>
            <Text style={styles.readOnlyValue}>{user?.email || '—'}</Text>
          </View>
          <MaterialCommunityIcons name="lock-outline" size={18} color="#9CA3AF" />
        </View>

        <View style={styles.form}>
          {/* Username */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={[styles.input, errors.username && styles.inputError]}
              value={username}
              onChangeText={setUsername}
              placeholder="Choose a username"
              placeholderTextColor={COLORS.gray500}
              autoCapitalize="none"
            />
            {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
          </View>

          {/* Mobile */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={[styles.input, errors.mobile && styles.inputError]}
              value={mobile}
              onChangeText={setMobile}
              placeholder="+63 9XX XXX XXXX"
              placeholderTextColor={COLORS.gray500}
              keyboardType="phone-pad"
            />
            {errors.mobile && <Text style={styles.errorText}>{errors.mobile}</Text>}
          </View>

          {/* Address */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Delivery Address</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Street, Barangay, City, Province"
              placeholderTextColor={COLORS.gray500}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Birthdate */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Birthdate</Text>
            <TextInput
              style={styles.input}
              value={birthdate}
              onChangeText={setBirthdate}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={COLORS.gray500}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {/* Gender */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.genderChip, gender === opt && styles.genderChipActive]}
                  onPress={() => setGender(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.genderChipText, gender === opt && styles.genderChipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.disabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={COLORS.themeButtonText} />
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 24, color: COLORS.themeText },
  headerTitle: { fontSize: 22, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },

  readOnlyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.themeInputBg, borderWidth: 1,
    borderColor: COLORS.themeInputBorder, borderRadius: RADIUS.md,
    padding: 14, marginBottom: 20, opacity: 0.75,
  },
  readOnlyLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  readOnlyValue: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.themeText, marginTop: 2 },

  form: { gap: 16, marginBottom: 28 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', fontFamily: FONTS.medium, color: COLORS.themeText },
  input: {
    backgroundColor: COLORS.themeInputBg, borderWidth: 1,
    borderColor: COLORS.themeInputBorder, borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: FONTS.regular, color: COLORS.themeText,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.error },

  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genderChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder,
  },
  genderChipActive: { backgroundColor: COLORS.themeButtonBg, borderColor: COLORS.themeButtonBg },
  genderChipText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary },
  genderChipTextActive: { color: COLORS.themeButtonText },

  saveBtn: {
    backgroundColor: COLORS.themeButtonBg, paddingVertical: 16,
    borderRadius: RADIUS.md, alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  saveBtnText: { color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 16 },
});

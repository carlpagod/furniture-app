import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { Alert } from '../../lib/alert';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { COLORS, RADIUS, DEFAULT_AVATAR, FONTS } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedButton from '../../components/AnimatedButton';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [avatarLoading, setAvatarLoading] = useState(false);

  useFocusEffect(useCallback(() => { refreshProfile(); }, []));

  async function pickAndUploadAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow photo library access in settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;

    setAvatarLoading(true);
    try {
      const uri = result.assets[0].uri;
      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        // Simulated local save for demo mode
        const updatedProfile = { ...profile, avatar_url: uri };
        await AsyncStorage.setItem('furnicute_session', JSON.stringify({ user, profile: updatedProfile }));
        await refreshProfile();
        Alert.alert('Success ✅', 'Profile photo updated (Simulated).');
        setAvatarLoading(false);
        return;
      }

      const filename = `avatar-${user.id}-${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      
      let uploadError = null;
      try {
        const result = await Promise.race([
          supabase.storage.from('avatars').upload(filename, blob, { contentType: 'image/jpeg', upsert: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('avatar upload timeout')), 5000)),
        ]);
        uploadError = result?.error;
      } catch (timeoutErr) {
        throw new Error('Avatar upload timed out.');
      }
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filename);
      
      let updateError = null;
      try {
        const result = await Promise.race([
          supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id),
          new Promise((_, reject) => setTimeout(() => reject(new Error('profile avatar update timeout')), 5000)),
        ]);
        updateError = result?.error;
      } catch (timeoutErr) {
        throw new Error('Profile update timed out.');
      }
      if (updateError) throw updateError;

      await refreshProfile();
    } catch (e) {
      Alert.alert('Upload Failed', e.message || 'Could not upload avatar.');
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  const avatarUri = profile?.avatar_url || DEFAULT_AVATAR;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 28 }}>
        <Text style={[styles.headerTitle, { marginBottom: 0 }]}>My Profile</Text>
        <MaterialCommunityIcons name="account-outline" size={26} color="#D67A32" />
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={pickAndUploadAvatar} style={styles.avatarWrap} disabled={avatarLoading}>
          {avatarLoading
            ? <View style={[styles.avatar, styles.avatarLoading]}><ActivityIndicator color={COLORS.black} /></View>
            : <Image source={{ uri: avatarUri }} style={styles.avatar} />
          }
          <View style={styles.editBadge}>
            <MaterialCommunityIcons name="camera" size={14} color={COLORS.white} />
          </View>
        </TouchableOpacity>
        <Text style={styles.username}>{profile?.username || 'User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Info Cards */}
      <View style={styles.infoSection}>
        <InfoRow icon="account-outline" label="Username" value={profile?.username || '—'} />
        <InfoRow icon="map-marker-outline" label="Address" value={profile?.address || 'Not set'} />
        <InfoRow icon="phone-outline" label="Mobile" value={profile?.mobile || 'Not set'} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <AnimatedButton
          style={styles.editBtn}
          onPress={() => router.push('/(user)/edit-profile')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 12 }}>
            <MaterialCommunityIcons name="account-edit-outline" size={20} color={COLORS.white} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </View>
        </AnimatedButton>

        <AnimatedButton style={styles.logoutBtn} onPress={handleLogout}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 12 }}>
            <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </View>
        </AnimatedButton>
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={20} color="#D67A32" style={{ marginRight: 2 }} />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  scroll: { paddingHorizontal: 24 },
  headerTitle: { fontSize: 24, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText, marginBottom: 28 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.themeInputBg, borderWidth: 2, borderColor: COLORS.themeInputBorder,
  },
  avatarLoading: { justifyContent: 'center', alignItems: 'center' },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.black, width: 28, height: 28,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  username: { fontSize: 20, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  email: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, marginTop: 4 },
  infoSection: {
    backgroundColor: COLORS.themeCardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.themeCardBorder, marginBottom: 20, overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.themeCardBorder,
  },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.themeText, marginTop: 2, fontWeight: '500' },
  actions: { gap: 12 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.black, padding: 16, borderRadius: RADIUS.md,
    justifyContent: 'center',
  },
  editBtnText: { color: COLORS.white, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.themeInputBg, padding: 16, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.themeInputBorder,
    justifyContent: 'center',
  },
  logoutText: { color: COLORS.error, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
});

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { Alert } from '../../lib/alert';
import AnimatedButton from '../../components/AnimatedButton';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { COLORS, RADIUS, DEFAULT_AVATAR, FONTS } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AdminProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useFocusEffect(useCallback(() => { refreshProfile(); }, []));

  async function pickAndUploadAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow photo library access in settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled) return;
    setAvatarLoading(true);
    try {
      const uri = result.assets[0].uri;
      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        const updatedProfile = { ...profile, avatar_url: uri };
        await AsyncStorage.setItem('furnicute_session', JSON.stringify({ user, profile: updatedProfile }));
        await refreshProfile();
        Alert.alert('Success ✅', 'Admin photo updated.');
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

  async function saveName() {
    if (!newName.trim()) return;
    setSavingName(true);
    try {
      if (user.id === 'demo-customer-id' || user.id === 'demo-admin-id') {
        const updatedProfile = { ...profile, username: newName.trim() };
        await AsyncStorage.setItem('furnicute_session', JSON.stringify({ user, profile: updatedProfile }));
        await refreshProfile();
      } else {
        let error = null;
        try {
          const result = await Promise.race([
            supabase.from('profiles').update({ username: newName.trim() }).eq('id', user.id),
            new Promise((_, reject) => setTimeout(() => reject(new Error('profile name update timeout')), 5000)),
          ]);
          error = result?.error;
        } catch (timeoutErr) {
          throw new Error('Profile save timed out.');
        }
        if (error) throw error;
        await refreshProfile();
      }
      setEditingName(false);
      Alert.alert('Saved ✅', 'Admin name updated.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save name.');
    } finally {
      setSavingName(false);
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
      <View style={styles.adminBadge}>
        <Text style={styles.adminBadgeText}>ADMIN</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 28 }}>
        <Text style={[styles.headerTitle, { marginBottom: 0 }]}>My Profile</Text>
        <MaterialCommunityIcons name="account-cog-outline" size={26} color="#D67A32" />
      </View>

      {/* Avatar — tap to change photo */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={pickAndUploadAvatar} style={styles.avatarWrap} disabled={avatarLoading}>
          {avatarLoading
            ? <View style={[styles.avatar, styles.avatarCenter]}><ActivityIndicator color={COLORS.themeBrown} /></View>
            : <Image source={{ uri: avatarUri }} style={styles.avatar} />
          }
          <View style={styles.editBadge}>
            <MaterialCommunityIcons name="camera" size={14} color={COLORS.white} />
          </View>
        </TouchableOpacity>
        <Text style={styles.username}>{profile?.username || 'Admin'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>Administrator</Text>
        </View>
      </View>

      {/* Editable: Name */}
      <Text style={styles.sectionLabel}>EDITABLE FIELDS</Text>
      <View style={styles.infoSection}>
        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => { setNewName(profile?.username || ''); setEditingName(true); }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="account-outline" size={20} color="#D67A32" style={{ marginRight: 6 }} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>{profile?.username || '—'}</Text>
          </View>
          <MaterialCommunityIcons name="pencil-outline" size={18} color="#D67A32" />
        </TouchableOpacity>
      </View>

      {/* Read-only: Email */}
      <Text style={styles.sectionLabel}>READ-ONLY</Text>
      <View style={styles.infoSection}>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <MaterialCommunityIcons name="email-outline" size={20} color="#D67A32" style={{ marginRight: 6 }} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || '—'}</Text>
          </View>
          <MaterialCommunityIcons name="lock-outline" size={18} color="#9CA3AF" />
        </View>
      </View>

      <View style={styles.noteCard}>
        <MaterialCommunityIcons name="information-outline" size={18} color="#D67A32" style={{ marginRight: 8, marginTop: 2 }} />
        <Text style={styles.noteText}>Tap your photo to change it. Tap the edit icon to edit your username. Email cannot be changed.</Text>
      </View>

      <AnimatedButton style={styles.logoutBtn} onPress={handleLogout}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="logout" size={18} color={COLORS.error} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </View>
      </AnimatedButton>

      {/* Edit Name Modal */}
      <Modal visible={editingName} transparent animationType="fade" onRequestClose={() => setEditingName(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Username</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter new username"
              placeholderTextColor={COLORS.gray400}
              autoFocus
              autoCapitalize="none"
            />
            <View style={styles.modalBtns}>
              <AnimatedButton style={styles.modalCancelBtn} onPress={() => setEditingName(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </AnimatedButton>
              <AnimatedButton
                style={[styles.modalSaveBtn, savingName && { opacity: 0.6 }]}
                onPress={saveName}
                disabled={savingName}
              >
                {savingName
                  ? <ActivityIndicator color={COLORS.themeButtonText} />
                  : <Text style={styles.modalSaveText}>Save</Text>
                }
              </AnimatedButton>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  scroll: { paddingHorizontal: 24 },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', fontFamily: FONTS.bold,
    color: COLORS.themeTextSecondary, letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 8, marginTop: 20,
  },
  adminBadge: {
    alignSelf: 'flex-start', backgroundColor: COLORS.themeDarkBrown,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full, marginBottom: 8,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeButtonText, letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText, marginBottom: 28 },
  avatarSection: { alignItems: 'center', marginBottom: 8 },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.themeInputBg, borderWidth: 3, borderColor: COLORS.themeInputBorder },
  avatarCenter: { justifyContent: 'center', alignItems: 'center' },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.themeBrown, width: 30, height: 30,
    borderRadius: 15, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  username: { fontSize: 20, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  email: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, marginTop: 4 },
  rolePill: { marginTop: 10, backgroundColor: COLORS.themeDarkBrown, paddingHorizontal: 14, paddingVertical: 5, borderRadius: RADIUS.full },
  rolePillText: { fontSize: 12, color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold },
  infoSection: {
    backgroundColor: COLORS.themeCardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.themeCardBorder, marginBottom: 4, overflow: 'hidden',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: COLORS.themeCardBorder },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.themeTextSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.themeText, marginTop: 2, fontWeight: '500' },
  noteCard: {
    flexDirection: 'row', gap: 10, backgroundColor: COLORS.themeCardBg,
    borderRadius: RADIUS.md, padding: 14, marginBottom: 20, marginTop: 16,
    borderWidth: 1, borderColor: COLORS.themeCardBorder,
  },
  noteText: { flex: 1, fontSize: 13, fontFamily: FONTS.regular, color: COLORS.themeTextSecondary, lineHeight: 20 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.themeInputBg, padding: 16, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.themeInputBorder, justifyContent: 'center',
  },
  logoutText: { color: COLORS.error, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalCard: { backgroundColor: COLORS.themeBeige, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  modalInput: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.themeInputBorder,
    borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, fontFamily: FONTS.regular, color: COLORS.themeText,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: RADIUS.md, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.themeInputBorder, backgroundColor: COLORS.white,
  },
  modalCancelText: { color: COLORS.themeText, fontWeight: '600', fontFamily: FONTS.medium, fontSize: 15 },
  modalSaveBtn: { flex: 1, paddingVertical: 13, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: COLORS.themeDarkBrown },
  modalSaveText: { color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 15 },
});

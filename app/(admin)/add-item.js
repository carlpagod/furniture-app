import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Alert } from '../../lib/alert';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { COLORS, RADIUS, CATEGORIES, COLOR_OPTIONS, MATERIAL_OPTIONS, FONTS } from '../../lib/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AnimatedButton from '../../components/AnimatedButton';

const CATS = CATEGORIES.filter(c => c !== 'All');

export default function AddItemScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  
  const [categoriesList, setCategoriesList] = useState(CATS);
  const [category, setCategory] = useState('Chair');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  const [materialsList, setMaterialsList] = useState(MATERIAL_OPTIONS);
  const [selectedMaterials, setSelectedMaterials] = useState(['Wood']);
  const [showCustomMaterial, setShowCustomMaterial] = useState(false);
  const [customMaterial, setCustomMaterial] = useState('');

  function toggleMaterial(val) {
    if (!val) return;
    setSelectedMaterials(prev => {
      const updated = prev.includes(val) ? prev.filter(m => m !== val) : [...prev, val];
      return updated.length > 0 ? updated : [val];
    });
  }

  const [imageUri, setImageUri] = useState(null);
  const [selectedColors, setSelectedColors] = useState([]);
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [customColor, setCustomColor] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    async function loadCustomOptions() {
      try {
        const storedCats = await AsyncStorage.getItem('admin_categories');
        let cats = storedCats ? JSON.parse(storedCats) : CATS;
        
        const storedMats = await AsyncStorage.getItem('admin_materials');
        let mats = storedMats ? JSON.parse(storedMats) : MATERIAL_OPTIONS;

        // Fetch distinct categories and materials from Supabase (with 5s timeout)
        try {
          const result = await Promise.race([
            supabase.from('furniture').select('category, material'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('sync timeout')), 5000)),
          ]);
          const data = result?.data;
          if (data && data.length > 0) {
            const dbCats = data.map(i => i.category).filter(Boolean).map(c => c.trim());
            const dbMats = data.map(i => i.material).filter(Boolean).map(m => m.trim());
            cats = [...new Set([...cats, ...dbCats])];
            mats = [...new Set([...mats, ...dbMats])];
          }
        } catch (syncErr) {
          console.warn('add-item: Supabase category sync timed out');
        }

        setCategoriesList(cats);
        setMaterialsList(mats);
      } catch (e) {
        console.warn('Error loading custom options:', e);
      }
    }
    loadCustomOptions();
  }, []);

  useEffect(() => {
    const catLower = (category || '').trim().toLowerCase();
    if (catLower === 'table' || catLower === 'cabinet' || catLower === 'lighting') {
      setSelectedMaterials(prev => prev.filter(mat => {
        const mLower = mat.toLowerCase();
        return mLower !== 'fabric' && mLower !== 'velvet' && mLower !== 'leather';
      }));
    }
  }, [category]);

  function toggleColor(val) {
    if (!val) return;
    setSelectedColors(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]);
  }

  function addCustomColor() {
    if (customColor.trim()) {
      const hex = customColor.trim().startsWith('#') ? customColor.trim() : '#' + customColor.trim();
      toggleColor(hex);
      setCustomColor('');
      setShowCustomColor(false);
    }
  }

  async function addCustomCategory() {
    const val = customCategory.trim();
    if (val) {
      const formattedVal = val.charAt(0).toUpperCase() + val.slice(1);
      if (categoriesList.includes(formattedVal)) {
        Alert.alert('Duplicate Category', 'This category already exists.');
        return;
      }
      const updated = [...categoriesList, formattedVal];
      setCategoriesList(updated);
      setCategory(formattedVal);
      setCustomCategory('');
      setShowCustomCategory(false);
      try {
        await AsyncStorage.setItem('admin_categories', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }
  }

  async function addCustomMaterial() {
    const val = customMaterial.trim();
    if (val) {
      const formattedVal = val.charAt(0).toUpperCase() + val.slice(1);
      if (materialsList.includes(formattedVal)) {
        Alert.alert('Duplicate Material', 'This material already exists.');
        return;
      }
      const updated = [...materialsList, formattedVal];
      setMaterialsList(updated);
      toggleMaterial(formattedVal);
      setCustomMaterial('');
      setShowCustomMaterial(false);
      try {
        await AsyncStorage.setItem('admin_materials', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function uploadImage(uri) {
    if (user?.id === 'demo-admin-id' || user?.id === 'demo-customer-id') {
      return uri; // Return uri itself for local display
    }
    const filename = `furniture-${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from('furniture-images').upload(filename, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    const { data } = supabase.storage.from('furniture-images').getPublicUrl(filename);
    return data.publicUrl;
  }

  function validate() {
    const e = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!price.trim()) e.price = 'Price is required';
    else if (isNaN(Number(price)) || Number(price) <= 0) e.price = 'Enter a valid price';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleAdd() {
    if (!validate()) return;
    setLoading(true);
    try {
      let image_url = null;
      if (imageUri) image_url = await uploadImage(imageUri);

      if (user?.id === 'demo-admin-id' || user?.id === 'demo-customer-id') {
        // Offline demo mode simulated insert
        const local = await AsyncStorage.getItem('admin_furniture');
        const data = local ? JSON.parse(local) : [];
        const newItem = {
          id: `local-${Date.now()}`,
          name: name.trim(),
          price: Number(price),
          description: description.trim(),
          category,
          material: selectedMaterials.join(', '),
          image_url,
          colors: selectedColors,
          is_visible: true,
          created_at: new Date().toISOString()
        };
        data.unshift(newItem);
        await AsyncStorage.setItem('admin_furniture', JSON.stringify(data));

        // Add dummy activity log
        const logsLocal = await AsyncStorage.getItem('admin_logs');
        const logs = logsLocal ? JSON.parse(logsLocal) : [];
        logs.unshift({
          id: `log-${Date.now()}`,
          admin_name: profile?.username || 'Administrator',
          action: 'ADD',
          furniture_name: name,
          details: `Added ${category} item at ₱${price}`,
          created_at: new Date().toISOString()
        });
        await AsyncStorage.setItem('admin_logs', JSON.stringify(logs));

        Alert.alert('Item Added ✅', `"${name}" added successfully.`, [
          { text: 'Add Another', onPress: () => { setName(''); setPrice(''); setDescription(''); setImageUri(null); setSelectedColors([]); } },
          { text: 'Dashboard', onPress: () => router.push('/(admin)/dashboard') },
        ]);
        return;
      }

      const { data: dbData, error } = await supabase.from('furniture').insert({
        name: name.trim(), price: Number(price),
        description: description.trim(), category, material: selectedMaterials.join(', '), image_url,
        colors: selectedColors, is_visible: true,
      }).select().single();
      if (error) throw error;
      await supabase.from('activity_logs').insert({
        admin_id: profile.id, action: 'ADD',
        furniture_id: dbData.id, furniture_name: dbData.name,
        details: `Added ${category} item at ₱${price}`,
      });
      Alert.alert('Item Added ✅', `"${name}" added to the store.`, [
        { text: 'Add Another', onPress: () => { setName(''); setPrice(''); setDescription(''); setImageUri(null); setSelectedColors([]); } },
        { text: 'Dashboard', onPress: () => router.push('/(admin)/dashboard') },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not add item.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/(admin)/dashboard')}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.headerTitle}>Add New Item</Text>
            <MaterialCommunityIcons name="plus-box-outline" size={24} color="#D67A32" />
          </View>
        </View>

        <View style={styles.imagePicker}>
          {imageUri
            ? <Image source={{ uri: imageUri }} style={styles.previewImg} resizeMode="cover" />
            : <View style={styles.imgPlaceholder}>
                <MaterialCommunityIcons name="image-plus" size={36} color="#D67A32" style={{ marginBottom: 6 }} />
                <Text style={styles.imgHint}>Add Product Image</Text>
              </View>
          }
          <View style={styles.imgBtnRow}>
            <TouchableOpacity style={styles.imgBtn} onPress={pickImage}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="image-area" size={16} color={COLORS.themeTextSecondary} />
                <Text style={styles.imgBtnText}>From Gallery</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imgBtn} onPress={takePhoto}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="camera" size={16} color={COLORS.themeTextSecondary} />
                <Text style={styles.imgBtnText}>Take Photo</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {categoriesList.map(cat => (
              <TouchableOpacity key={cat} style={[styles.catChip, category === cat && styles.catChipActive]} onPress={() => setCategory(cat)}>
                <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.addColorBtn,
                showCustomCategory && { backgroundColor: COLORS.themeDarkBrown, borderColor: COLORS.themeDarkBrown }
              ]}
              onPress={() => setShowCustomCategory(!showCustomCategory)}
            >
              <Text style={[styles.addColorText, showCustomCategory && { color: COLORS.themeButtonText }]}>
                {showCustomCategory ? '✕' : '+'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {showCustomCategory && (
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
              <TextInput style={[styles.input, { flex: 1, paddingVertical: 10 }]} value={customCategory} onChangeText={setCustomCategory} placeholder="Category Name (e.g. Desk)" placeholderTextColor={COLORS.gray500} />
              <TouchableOpacity style={[styles.addBtn, { marginTop: 0, paddingHorizontal: 16, paddingVertical: 10 }]} onPress={addCustomCategory}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Material</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {materialsList.filter(mat => {
              const catLower = (category || '').trim().toLowerCase();
              const mLower = mat.toLowerCase();
              const isSoft = mLower === 'fabric' || mLower === 'velvet' || mLower === 'leather';
              if (isSoft && (catLower === 'table' || catLower === 'cabinet' || catLower === 'lighting')) {
                return false;
              }
              return true;
            }).map(mat => {
              const isActive = selectedMaterials.includes(mat);
              return (
                <TouchableOpacity key={mat} style={[styles.catChip, isActive && styles.catChipActive]} onPress={() => toggleMaterial(mat)}>
                  <Text style={[styles.catText, isActive && styles.catTextActive]}>{mat}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[
                styles.addColorBtn,
                showCustomMaterial && { backgroundColor: COLORS.themeDarkBrown, borderColor: COLORS.themeDarkBrown }
              ]}
              onPress={() => setShowCustomMaterial(!showCustomMaterial)}
            >
              <Text style={[styles.addColorText, showCustomMaterial && { color: COLORS.themeButtonText }]}>
                {showCustomMaterial ? '✕' : '+'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {showCustomMaterial && (
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
              <TextInput style={[styles.input, { flex: 1, paddingVertical: 10 }]} value={customMaterial} onChangeText={setCustomMaterial} placeholder="Material Name (e.g. Marble)" placeholderTextColor={COLORS.gray500} />
              <TouchableOpacity style={[styles.addBtn, { marginTop: 0, paddingHorizontal: 16, paddingVertical: 10 }]} onPress={addCustomMaterial}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Furniture Name</Text>
          <TextInput style={[styles.input, errors.name && styles.inputError]} value={name} onChangeText={setName} placeholder="e.g. Nordic Accent Chair" placeholderTextColor={COLORS.gray500} />
          {errors.name && <Text style={styles.errText}>{errors.name}</Text>}
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Price (₱)</Text>
          <TextInput style={[styles.input, errors.price && styles.inputError]} value={price} onChangeText={setPrice} placeholder="e.g. 4999.00" placeholderTextColor={COLORS.gray500} keyboardType="decimal-pad" />
          {errors.price && <Text style={styles.errText}>{errors.price}</Text>}
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="Brief product description..." placeholderTextColor={COLORS.gray500} multiline numberOfLines={4} />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Color Variants (optional)</Text>
          <View style={styles.colorRow}>
            {COLOR_OPTIONS.map(c => (
              <TouchableOpacity key={c.value} style={[styles.colorDot, { backgroundColor: String(c.value) }, c.value === '#FFFFFF' && { borderColor: COLORS.themeInputBorder }, selectedColors.includes(c.value) && styles.colorSelected]} onPress={() => toggleColor(c.value)}>
                {selectedColors.includes(c.value) && <Text style={{ fontSize: 11, color: c.value === '#FFFFFF' ? COLORS.black : COLORS.white }}>✓</Text>}
              </TouchableOpacity>
            ))}

            {selectedColors.filter(c => !COLOR_OPTIONS.find(o => o.value === c)).map(c => (
              <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, c === '#FFFFFF' && { borderColor: COLORS.themeInputBorder }, styles.colorSelected]} onPress={() => toggleColor(c)}>
                <Text style={{ fontSize: 11, color: c === '#FFFFFF' ? COLORS.black : COLORS.white }}>✓</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[
                styles.addColorBtn,
                showCustomColor && { backgroundColor: COLORS.themeDarkBrown, borderColor: COLORS.themeDarkBrown }
              ]}
              onPress={() => setShowCustomColor(!showCustomColor)}
            >
              <Text style={[styles.addColorText, showCustomColor && { color: COLORS.themeButtonText }]}>
                {showCustomColor ? '✕' : '+'}
              </Text>
            </TouchableOpacity>
          </View>

          {showCustomColor && (
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
              <TextInput style={[styles.input, { flex: 1, paddingVertical: 10 }]} value={customColor} onChangeText={setCustomColor} placeholder="Hex Code (e.g. #FF0000)" placeholderTextColor={COLORS.gray500} />
              <TouchableOpacity style={[styles.addBtn, { marginTop: 0, paddingHorizontal: 16, paddingVertical: 10 }]} onPress={addCustomColor}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <AnimatedButton style={[styles.addBtn, loading && styles.disabled]} onPress={handleAdd} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.addBtnText}>Add Item</Text>}
        </AnimatedButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.themeBg },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  backIcon: { fontSize: 24, color: COLORS.themeText },
  headerTitle: { fontSize: 24, fontWeight: '800', fontFamily: FONTS.bold, color: COLORS.themeText },
  imagePicker: { marginBottom: 20 },
  previewImg: { width: '100%', height: 200, borderRadius: RADIUS.lg, backgroundColor: COLORS.themeInputBg, marginBottom: 10 },
  imgPlaceholder: { width: '100%', height: 160, borderRadius: RADIUS.lg, backgroundColor: COLORS.themeInputBg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.themeInputBorder, borderStyle: 'dashed', marginBottom: 10 },
  imgHint: { color: COLORS.themeTextSecondary, fontFamily: FONTS.regular, marginTop: 8, fontSize: 13 },
  imgBtnRow: { flexDirection: 'row', gap: 10 },
  imgBtn: { flex: 1, backgroundColor: COLORS.themeInputBg, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.themeInputBorder },
  imgBtnText: { color: COLORS.themeText, fontSize: 13, fontFamily: FONTS.bold, fontWeight: '600' },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', fontFamily: FONTS.bold, color: COLORS.themeText, marginBottom: 8 },
  catRow: { gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder },
  catChipActive: { backgroundColor: COLORS.themeDarkBrown, borderColor: COLORS.themeDarkBrown },
  catText: { color: COLORS.themeTextSecondary, fontSize: 13, fontFamily: FONTS.medium, fontWeight: '600' },
  catTextActive: { color: COLORS.themeButtonText },
  input: { backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.themeText },
  inputError: { borderColor: COLORS.error },
  errText: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.error, marginTop: 4 },
  colorRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  colorSelected: { borderWidth: 3, borderColor: COLORS.themeDarkBrown },
  addColorBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.themeInputBg, borderWidth: 1, borderColor: COLORS.themeInputBorder, justifyContent: 'center', alignItems: 'center' },
  addColorText: { fontSize: 18, color: COLORS.themeTextSecondary, fontWeight: 'bold' },
  addBtn: { backgroundColor: COLORS.themeDarkBrown, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.6 },
  addBtnText: { color: COLORS.themeButtonText, fontWeight: '700', fontFamily: FONTS.bold, fontSize: 16 },
});

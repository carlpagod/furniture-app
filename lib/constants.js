import { Platform } from 'react-native';

// ─── Color Palette ───────────────────────────────────────────────────────────
export const COLORS = {
  black: '#000000',
  white: '#FFFFFF',
  gray100: '#F5F5F5',
  gray200: '#E5E5E5',
  gray300: '#D4D4D4',
  gray400: '#A3A3A3',
  gray500: '#737373',
  gray600: '#525252',
  gray700: '#404040',
  gray800: '#262626',
  gray900: '#171717',
  accent: '#1A1A1A',
  error: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',

  // FurniCute Theme — Warm Beige / Brown / Dark
  themeBg: '#F5E6D3',           // Warm beige background (matches logo)
  themeText: '#352518',          // Beautiful warm dark cocoa/espresso brown instead of harsh black
  themeTextSecondary: '#8B5E3C', // Warm brown (logo accent)
  themeInputBg: '#FFFFFF',       // White inputs
  themeInputBorder: '#D4C5A9',   // Beige border
  themeCardBg: '#FFFFFF',
  themeCardBorder: '#E6D5C0',    // Warm beige card border
  themeButtonBg: '#D67A32',      // Darker Orange button (Admin style, applied globally)
  themeButtonText: '#FFFFFF',    // White text on button
  themeBrown: '#E78B45',         // Warm orange-brown accent
  themeBeige: '#F5E6D3',         // Beige accent
  themeDarkBrown: '#D67A32',     // Darker orange for admin buttons
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const FONTS = {
  regular: Platform.select({
    web: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    default: 'System',
  }),
  medium: Platform.select({
    web: 'Inter-Medium, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    default: 'System',
  }),
  bold: Platform.select({
    web: 'Inter-Bold, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    default: 'System',
  }),
  light: Platform.select({
    web: 'Inter-Light, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    default: 'System',
  }),
};

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// ─── Border Radius ────────────────────────────────────────────────────────────
export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 32,
  full: 9999,
};

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const SHADOWS = {
  sm: { shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  lg: { shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 24, elevation: 8 },
};

// ─── Furniture Categories ─────────────────────────────────────────────────────
export const CATEGORIES = ['All', 'Chair', 'Sofa', 'Table', 'Bed', 'Cabinet', 'Lighting'];

// ─── Furniture Color Options ──────────────────────────────────────────────────
export const COLOR_OPTIONS = [
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#FFFFFF' },
  { label: 'Gray', value: '#737373' },
  { label: 'Beige', value: '#D4C5A9' },
  { label: 'Brown', value: '#8B5E3C' },
  { label: 'Pink', value: '#E6B8B8' },
];

// ─── Furniture Material Options ───────────────────────────────────────────────
export const MATERIAL_OPTIONS = ['Wood', 'Metal', 'Plastic', 'Glass', 'Fabric', 'Leather', 'Velvet'];

// ─── Unsplash Furniture Images ────────────────────────────────────────────────
export const FURNITURE_IMAGES = {
  Chair: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80',
  Sofa: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
  Table: 'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=600&q=80',
  Bed: 'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=600&q=80',
  Cabinet: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
  Lighting: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&q=80',
  placeholder: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
};

// ─── Default Avatar ───────────────────────────────────────────────────────────
export const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=200&q=80';

// ─── Seed Furniture Data (2 items per category) ───────────────────────────────
export const SEED_FURNITURE = [
  // Chairs (2)
  {
    id: '00000000-0000-0000-0000-000000000001', name: 'Nordic Accent Chair', price: 4999.00, category: 'Chair',
    description: 'Elevate your living space with this cozy Nordic design chair, crafted from sustainable oak with premium fabric upholstery.',
    is_visible: true, colors: ['#000000', '#FFFFFF', '#737373', '#D4C5A9', '#8B5E3C', '#E6B8B8'], rating: 4.8, ratingCount: 124,
    material: 'Wood, Fabric, Velvet, Leather',
    image_url: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80',
  },
  {
    id: '00000000-0000-0000-0000-000000000002', name: 'Ergonomic Office Chair', price: 6999.00, category: 'Chair',
    description: 'Full posture support with breathable mesh and 10-point structural adjustments. Ideal for long working hours.',
    is_visible: true, colors: ['#000000', '#FFFFFF', '#737373', '#D4C5A9'], rating: 4.6, ratingCount: 89,
    material: 'Metal, Plastic, Fabric',
    image_url: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=600&q=80',
  },

  // Sofas (2)
  {
    id: '00000000-0000-0000-0000-000000000004', name: 'Luxe 3-Seater Sofa', price: 18999.00, category: 'Sofa',
    description: 'Spacious fabric sofa with premium density cushion padding. A centerpiece for modern living rooms.',
    is_visible: true, colors: ['#737373', '#8B5E3C', '#FFFFFF', '#E6B8B8', '#D4C5A9'], rating: 4.9, ratingCount: 201,
    material: 'Fabric, Velvet, Leather',
    image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
  },
  {
    id: '00000000-0000-0000-0000-000000000005', name: 'L-Shaped Corner Sofa', price: 24500.00, category: 'Sofa',
    description: 'Maximize your room corners with this luxury modular sectional sofa. Includes storage ottoman.',
    is_visible: true, colors: ['#737373', '#000000', '#8B5E3C', '#D4C5A9'], rating: 4.7, ratingCount: 156,
    material: 'Fabric, Leather, Velvet',
    image_url: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&q=80',
  },

  // Tables (2)
  {
    id: '00000000-0000-0000-0000-000000000007', name: 'Marble Dining Table', price: 12500.00, category: 'Table',
    description: 'Authentic polished white marble top with minimalist powder-coated steel frame. Seats 6 comfortably.',
    is_visible: true, colors: ['#FFFFFF', '#000000', '#D4C5A9', '#737373'], rating: 4.5, ratingCount: 73,
    material: 'Glass, Metal, Wood',
    image_url: 'https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=600&q=80',
  },
  {
    id: '00000000-0000-0000-0000-000000000008', name: 'Solid Oak Coffee Table', price: 5200.00, category: 'Table',
    description: 'Rustic solid oak wood block top featuring clean iron hairpin legs. Perfect for your living room centerpiece.',
    is_visible: true, colors: ['#8B5E3C', '#000000', '#D4C5A9', '#FFFFFF'], rating: 4.7, ratingCount: 98,
    material: 'Wood, Metal, Glass',
    image_url: 'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=600&q=80',
  },

  // Beds (2)
  {
    id: '00000000-0000-0000-0000-000000000010', name: 'Platform Bed Frame', price: 15999.00, category: 'Bed',
    description: 'Low profile platform bed frame crafted from solid ash wood. Compatible with all mattress types.',
    is_visible: true, colors: ['#8B5E3C', '#000000', '#FFFFFF', '#D4C5A9'], rating: 4.8, ratingCount: 167,
    material: 'Wood, Metal, Fabric',
    image_url: 'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=600&q=80',
  },
  {
    id: '00000000-0000-0000-0000-000000000011', name: 'King Size Wooden Bed', price: 21000.00, category: 'Bed',
    description: 'Grand mahogany tall headboard bed frame with reinforced slat system. Matches all modern bedrooms.',
    is_visible: true, colors: ['#8B5E3C', '#000000', '#D4C5A9', '#FFFFFF'], rating: 4.6, ratingCount: 112,
    material: 'Wood, Leather, Velvet',
    image_url: 'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?w=600&q=80',
  },

  // Cabinets (2)
  {
    id: '00000000-0000-0000-0000-000000000013', name: 'Minimalist Storage Cabinet', price: 8750.00, category: 'Cabinet',
    description: 'Multi-compartment storage cabinet with smooth matte slide doors. Ideal for bedroom or living room.',
    is_visible: true, colors: ['#737373', '#FFFFFF', '#D4C5A9', '#000000'], rating: 4.4, ratingCount: 55,
    material: 'Wood, Metal, Plastic',
    image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
  },
  {
    id: '00000000-0000-0000-0000-000000000014', name: 'Oak Sideboard Buffet', price: 11200.00, category: 'Cabinet',
    description: 'Stunning solid oak buffet credenza with three main drawer slots and hidden compartments.',
    is_visible: true, colors: ['#8B5E3C', '#D4C5A9', '#000000', '#FFFFFF'], rating: 4.9, ratingCount: 88,
    material: 'Wood, Metal',
    image_url: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600&q=80',
  },

  // Lighting (2)
  {
    id: '00000000-0000-0000-0000-000000000016', name: 'Arc Floor Lamp', price: 3299.00, category: 'Lighting',
    description: 'Curved stainless steel adjustable overhead lighting lamp with dimmable warm LED bulb included.',
    is_visible: true, colors: ['#000000', '#FFFFFF', '#737373', '#D4C5A9'], rating: 4.5, ratingCount: 64,
    material: 'Metal, Plastic, Glass',
    image_url: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&q=80',
  },
  {
    id: '00000000-0000-0000-0000-000000000017', name: 'Modern Pendant Chandelier', price: 7900.00, category: 'Lighting',
    description: 'Glass sphere multi-bulb ceiling hanging pendant light. Adds dramatic elegance to any dining space.',
    is_visible: true, colors: ['#000000', '#D4C5A9', '#FFFFFF', '#737373'], rating: 4.7, ratingCount: 43,
    material: 'Glass, Metal, Plastic',
    image_url: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=600&q=80',
  },
];

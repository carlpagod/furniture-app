-- ============================================================
-- FurniCute — Complete Supabase Setup SQL
-- Run this entire file in: Supabase Dashboard > SQL Editor
-- ============================================================


-- ============================================================
-- STEP 0: EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";


-- ============================================================
-- STEP 1: DROP EXISTING TABLES (clean slate — safe to re-run)
-- ============================================================
drop table if exists public.sales          cascade;
drop table if exists public.activity_logs  cascade;
drop table if exists public.cart_items     cascade;
drop table if exists public.furniture      cascade;
drop table if exists public.profiles       cascade;


-- ============================================================
-- STEP 2: PROFILES TABLE
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text,
  avatar_url  text,
  address     text    default '',
  mobile      text    default '',
  role        text    not null default 'user' check (role in ('admin', 'user')),
  created_at  timestamptz default now()
);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    'user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- STEP 3: FURNITURE TABLE
-- ============================================================
create table public.furniture (
  id          uuid primary key default gen_random_uuid(),
  name        text          not null,
  price       numeric(10,2) not null,
  description text          default '',
  category    text          not null default 'Chair',
  material    text          not null default 'Wood',
  image_url   text,
  colors      jsonb         default '[]',
  is_visible  boolean       not null default true,
  created_at  timestamptz   default now(),
  updated_at  timestamptz   default now()
);

-- Auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists furniture_updated_at on public.furniture;
create trigger furniture_updated_at
  before update on public.furniture
  for each row execute procedure public.set_updated_at();


-- ============================================================
-- STEP 4: CART ITEMS TABLE
-- ============================================================
create table public.cart_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid          not null references public.profiles(id) on delete cascade,
  furniture_id      uuid          not null references public.furniture(id) on delete cascade,
  quantity          int           not null default 1 check (quantity > 0),
  selected_color    text,
  selected_material text          default 'Wood',
  created_at        timestamptz   default now(),
  -- prevent duplicate cart entries for the same item per user
  unique (user_id, furniture_id)
);


-- ============================================================
-- STEP 5: ACTIVITY LOGS TABLE
-- ============================================================
create table public.activity_logs (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid references public.profiles(id) on delete set null,
  admin_name     text,
  action         text not null check (action in ('ADD','EDIT','DELETE','HIDE','SHOW')),
  furniture_id   uuid,
  furniture_name text,
  details        text,
  created_at     timestamptz default now()
);


-- ============================================================
-- STEP 6: SALES TABLE
-- ============================================================
create table public.sales (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete set null,
  furniture_id   uuid references public.furniture(id) on delete set null,
  furniture_name text          not null,
  category       text          not null,
  material       text          default 'Wood',
  quantity       int           not null default 1,
  price          numeric(10,2) not null,
  selected_color text,
  created_at     timestamptz   default now()
);


-- ============================================================
-- STEP 7: REVIEWS TABLE (optional — for product ratings)
-- ============================================================
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  furniture_id uuid not null references public.furniture(id) on delete cascade,
  rating       int  not null check (rating between 1 and 5),
  comment      text default '',
  created_at   timestamptz default now(),
  unique (user_id, furniture_id)
);


-- ============================================================
-- STEP 8: FAVORITES TABLE
-- ============================================================
create table public.favorites (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  furniture_id uuid not null references public.furniture(id) on delete cascade,
  created_at   timestamptz default now(),
  unique (user_id, furniture_id)
);


-- ============================================================
-- STEP 9: ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.furniture     enable row level security;
alter table public.cart_items    enable row level security;
alter table public.activity_logs enable row level security;
alter table public.sales         enable row level security;
alter table public.reviews       enable row level security;
alter table public.favorites     enable row level security;


-- ── PROFILES ──────────────────────────────────────────────
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);


-- ── FURNITURE ─────────────────────────────────────────────
create policy "Public can view visible furniture"
  on public.furniture for select using (is_visible = true);

create policy "Admins can view all furniture"
  on public.furniture for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert furniture"
  on public.furniture for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update furniture"
  on public.furniture for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete furniture"
  on public.furniture for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ── CART ITEMS ────────────────────────────────────────────
create policy "Users can view own cart"
  on public.cart_items for select using (auth.uid() = user_id);

create policy "Users can insert into own cart"
  on public.cart_items for insert with check (auth.uid() = user_id);

create policy "Users can update own cart"
  on public.cart_items for update using (auth.uid() = user_id);

create policy "Users can delete from own cart"
  on public.cart_items for delete using (auth.uid() = user_id);


-- ── ACTIVITY LOGS ─────────────────────────────────────────
create policy "Admins can view logs"
  on public.activity_logs for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert logs"
  on public.activity_logs for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ── SALES ─────────────────────────────────────────────────
create policy "Users can view own sales"
  on public.sales for select using (auth.uid() = user_id);

create policy "Admins can view all sales"
  on public.sales for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Authenticated users can insert sales"
  on public.sales for insert with check (auth.uid() = user_id);


-- ── REVIEWS ───────────────────────────────────────────────
create policy "Anyone can view reviews"
  on public.reviews for select using (true);

create policy "Users can insert own reviews"
  on public.reviews for insert with check (auth.uid() = user_id);

create policy "Users can update own reviews"
  on public.reviews for update using (auth.uid() = user_id);

create policy "Users can delete own reviews"
  on public.reviews for delete using (auth.uid() = user_id);


-- ── FAVORITES ─────────────────────────────────────────────
create policy "Users can view own favorites"
  on public.favorites for select using (auth.uid() = user_id);

create policy "Users can insert own favorites"
  on public.favorites for insert with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on public.favorites for delete using (auth.uid() = user_id);


-- ============================================================
-- STEP 10: STORAGE BUCKETS
-- Run these in SQL Editor OR create manually in Storage tab
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('furniture-images', 'furniture-images', true)
  on conflict (id) do nothing;

-- Storage Policies — Avatars
create policy "Avatar images are publicly viewable"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects for insert with check (
    bucket_id = 'avatars' and auth.uid() is not null
  );

create policy "Users can update own avatar"
  on storage.objects for update using (
    bucket_id = 'avatars' and auth.uid() is not null
  );

-- Storage Policies — Furniture Images
create policy "Furniture images are publicly viewable"
  on storage.objects for select using (bucket_id = 'furniture-images');

create policy "Admins can upload furniture images"
  on storage.objects for insert with check (
    bucket_id = 'furniture-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update furniture images"
  on storage.objects for update using (
    bucket_id = 'furniture-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete furniture images"
  on storage.objects for delete using (
    bucket_id = 'furniture-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ============================================================
-- STEP 11: SEED FURNITURE DATA (36 items across 6 categories)
-- ============================================================
insert into public.furniture (name, price, description, category, material, image_url, colors, is_visible) values

-- CHAIRS (6)
('Nordic Accent Chair',          4999.00, 'Elevate your living space with this cozy Nordic design chair.',                           'Chair',   'Wood',    'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80', '["#000000","#FFFFFF","#737373"]',  true),
('Ergonomic Office Chair',       6999.00, 'Full posture support with breathable mesh and structural adjustments.',                   'Chair',   'Metal',   'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=600&q=80', '["#000000","#737373"]',             true),
('Vintage Leather Armchair',     9500.00, 'Classic distressed leather armchair with solid wood base.',                              'Chair',   'Leather', 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&q=80', '["#8B5E3C","#000000"]',            true),
('Modern Velvet Dining Chair',   3800.00, 'Plush velvet seating with gold-capped metal legs for a sophisticated look.',             'Chair',   'Fabric',  'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&q=80', '["#1B2A4A","#FFFFFF"]',            true),
('Minimalist Rattan Lounge Chair',5400.00,'Handcrafted natural rattan accent chair with breathable design.',                        'Chair',   'Wood',    'https://images.unsplash.com/photo-1580481072645-022f9a6dbf27?w=600&q=80', '["#D4C5A9","#8B5E3C"]',            true),
('High-back Director Chair',     8200.00, 'Swivel director chair featuring cushioned armrests and leather finish.',                 'Chair',   'Leather', 'https://images.unsplash.com/photo-1503602642458-232111445657?w=600&q=80', '["#000000","#737373"]',             true),

-- SOFAS (6)
('Luxe 3-Seater Sofa',          18999.00, 'Spacious fabric sofa with premium density cushion padding.',                            'Sofa',    'Fabric',  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80', '["#737373","#8B5E3C","#FFFFFF"]',  true),
('L-Shaped Corner Sofa',        24500.00, 'Maximize your room corners with this luxury modular sectional.',                        'Sofa',    'Fabric',  'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&q=80', '["#737373","#000000"]',            true),
('Velvet Loveseat Sofa',        14800.00, 'Charming velvet-finish compact loveseat for two.',                                      'Sofa',    'Fabric',  'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=600&q=80', '["#1B2A4A","#737373"]',            true),
('Modern Futon Convertible Bed',12900.00, 'Multi-functional sleeper futon that easily folds into a guest bed.',                    'Sofa',    'Fabric',  'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=600&q=80', '["#737373","#000000"]',            true),
('Chesterfield Buttoned Sofa',  29500.00, 'Traditional deep buttoned tufted sofa with rolling scroll arms.',                       'Sofa',    'Leather', 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?w=600&q=80', '["#8B5E3C","#000000"]',             true),
('Bouclé Upholstered Loveseat', 16500.00, 'Cozy textured bouclé fabric loveseat with rounded sculptural silhouette.',             'Sofa',    'Fabric',  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80', '["#FFFFFF","#D4C5A9"]',            true),

-- TABLES (6)
('Marble Dining Table',         12500.00, 'Authentic polished white marble top with minimalist steel frame.',                      'Table',   'Marble',  'https://images.unsplash.com/photo-1530018352490-b6b33e931671?w=600&q=80', '["#FFFFFF","#000000"]',             true),
('Solid Oak Coffee Table',       5200.00, 'Rustic solid oak wood block top featuring clean iron hairpin legs.',                    'Table',   'Wood',    'https://images.unsplash.com/photo-1581428982868-e410dd047a90?w=600&q=80', '["#8B5E3C","#000000"]',             true),
('Minimalist Study Desk',        4300.00, 'Simplistic and functional design desktop with integrated storage drawer.',              'Table',   'Wood',    'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&q=80', '["#FFFFFF","#8B5E3C"]',             true),
('Round Glass Bistro Table',     4800.00, 'Tempered glass top table with black metal legs, perfect for breakfast nooks.',         'Table',   'Metal',   'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=600&q=80', '["#FFFFFF","#000000"]',             true),
('Extendable Wooden Dining Table',15500.00,'Solid pine wood dining table that extends to seat up to 8 guests.',                   'Table',   'Wood',    'https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=600&q=80', '["#8B5E3C"]',                       true),
('Industrial Console Entry Table', 5900.00,'Slim hall table combining distressed wood surfaces with steel frames.',               'Table',   'Wood',    'https://images.unsplash.com/photo-1499933374294-4584851497cc?w=600&q=80', '["#000000","#8B5E3C"]',             true),

-- BEDS (6)
('Platform Bed Frame',          15999.00, 'Low profile platform bed frame crafted from solid ash wood.',                          'Bed',     'Wood',    'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=600&q=80', '["#8B5E3C","#000000"]',             true),
('King Size Wooden Bed',        21000.00, 'Grand mahogany tall headboard bed frame matching modern bedrooms.',                    'Bed',     'Wood',    'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?w=600&q=80', '["#8B5E3C"]',                       true),
('Canopy Daybed',               13500.00, 'Chic lounge daybed with overhead fabric support columns.',                             'Bed',     'Metal',   'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&q=80', '["#FFFFFF","#D4C5A9"]',             true),
('Upholstered Tufted Bed Frame',18500.00, 'Elegant tall headboard with diamond button tufting and grey fabric.',                  'Bed',     'Fabric',  'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=600&q=80', '["#737373","#FFFFFF"]',             true),
('Metal Frame Loft Bed',        11900.00, 'Space-saving loft bed frame with safety guardrails and ladder.',                       'Bed',     'Metal',   'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80', '["#000000","#FFFFFF"]',             true),
('Velvet Daybed with Drawers',  15800.00, 'Premium velvet daybed featuring dual pull-out storage drawers below.',                 'Bed',     'Fabric',  'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=600&q=80', '["#1B2A4A","#737373"]',             true),

-- CABINETS (6)
('Minimalist Storage Cabinet',   8750.00, 'Multi-compartment storage cabinet with matte slide doors.',                            'Cabinet', 'Wood',    'https://images.unsplash.com/photo-1601084881623-cef5a7de343a?w=600&q=80', '["#737373","#FFFFFF"]',             true),
('Oak Sideboard Buffet',        11200.00, 'Stunning oak buffet credenza with three main drawer slots.',                           'Cabinet', 'Wood',    'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600&q=80', '["#8B5E3C","#D4C5A9"]',             true),
('Tall Bookshelf Cabinet',       6800.00, 'Vertical five-tier shelf cabinet with solid wood siding.',                             'Cabinet', 'Wood',    'https://images.unsplash.com/photo-1597072689227-8d56bd853555?w=600&q=80', '["#000000","#8B5E3C"]',             true),
('Mirrored Wardrobe Cabinet',   19500.00, 'Large bedroom wardrobe with mirrored front panels and hanging rails.',                 'Cabinet', 'Wood',    'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=600&q=80', '["#FFFFFF","#737373"]',             true),
('Walnut Media TV Console',     10400.00, 'Sleek walnut veneer TV stand with open media shelves and cabinets.',                  'Cabinet', 'Wood',    'https://images.unsplash.com/photo-1532372320978-9b4d8a3a0245?w=600&q=80', '["#8B5E3C","#000000"]',             true),
('Industrial Metal Mesh Locker', 7900.00, 'Vintage steel locker cabinet with grid wire mesh cupboard doors.',                    'Cabinet', 'Metal',   'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=600&q=80', '["#000000","#737373"]',             true),

-- LIGHTING (6)
('Arc Floor Lamp',               3299.00, 'Curved stainless steel adjustable overhead lighting lamp.',                            'Lighting','Metal',   'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&q=80', '["#000000","#FFFFFF"]',             true),
('Modern Pendant Chandelier',    7900.00, 'Glass sphere multi-bulb ceiling hanging pendant light.',                               'Lighting','Metal',   'https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=600&q=80', '["#000000","#D4C5A9"]',             true),
('Brass Table Lamp',             2450.00, 'Warm antique brass frame table desk reading light.',                                   'Lighting','Metal',   'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80', '["#D4C5A9","#000000"]',             true),
('Crystal Drop Ceiling Lamp',   11500.00, 'Ornate crystal bead chandelier dispersing beautiful light patterns.',                  'Lighting','Metal',   'https://images.unsplash.com/photo-1543198126-a8ad8e47fb21?w=600&q=80', '["#FFFFFF","#D4C5A9"]',             true),
('Modern LED Ring Chandelier',   9200.00, 'Double circular ring suspended ceiling light with adjustable cables.',                 'Lighting','Metal',   'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=600&q=80', '["#000000","#FFFFFF"]',             true),
('Matte Black Swing Arm Sconce', 3100.00, 'Minimalist industrial wall-mounted reading sconce light.',                            'Lighting','Metal',   'https://images.unsplash.com/photo-1517999144091-3d9dca6d1e43?w=600&q=80', '["#000000"]',                       true);


-- ============================================================
-- STEP 12: SEED DEFAULT ACTIVITY LOGS (optional demo data)
-- ============================================================
-- These are for demo display only; they don't require real admin_id
insert into public.activity_logs (admin_name, action, furniture_name, details) values
  ('Administrator', 'ADD',  'Nordic Accent Chair',  'Added Chair item at ₱4999.00'),
  ('Administrator', 'ADD',  'Luxe 3-Seater Sofa',   'Added Sofa item at ₱18999.00'),
  ('Administrator', 'HIDE', 'Platform Bed Frame',    'Item hidden from users'),
  ('Administrator', 'ADD',  'Marble Dining Table',   'Added Table item at ₱12500.00'),
  ('Administrator', 'EDIT', 'Arc Floor Lamp',        'Updated price to ₱3299.00');


-- ============================================================
-- STEP 13: SEED DEFAULT SALES DATA (optional demo data)
-- ============================================================
insert into public.sales (furniture_name, category, material, quantity, price) values
  ('Nordic Accent Chair',   'Chair',    'Wood',   2,  4999.00),
  ('Luxe 3-Seater Sofa',    'Sofa',     'Fabric', 1, 18999.00),
  ('Marble Dining Table',   'Table',    'Marble', 1, 12500.00),
  ('Arc Floor Lamp',        'Lighting', 'Metal',  3,  3299.00),
  ('Platform Bed Frame',    'Bed',      'Wood',   1, 15999.00),
  ('Minimalist Storage Cabinet', 'Cabinet', 'Wood', 2, 8750.00);


-- ============================================================
-- STEP 14: GRANT ADMIN ROLE
-- ============================================================
-- After signing up in the app with your admin account, run:
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'your-admin@email.com');
--
-- Replace 'your-admin@email.com' with your actual admin email.


-- ============================================================
-- DONE ✅
-- Tables:   profiles, furniture, cart_items, activity_logs,
--           sales, reviews, favorites
-- Triggers: auto-create profile on signup, auto-update updated_at
-- RLS:      all tables secured
-- Storage:  avatars + furniture-images buckets with policies
-- Seed:     36 furniture items + sample logs + sample sales
-- ============================================================

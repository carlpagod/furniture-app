import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = 'https://izwsssbuuikxyiorrwnz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d3Nzc2J1dWlreHlpb3Jyd256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4NzE5NCwiZXhwIjoyMDk0NzYzMTk0fQ.hhkSS1rRcg2fuKWKkXkgKMmvs-9jSPacWkgAvFAfooY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ITEMS = [
  { name:'Nordic Accent Chair',           price:4999,  description:'Elevate your living space with this cozy Nordic design chair.',                 category:'Chair',    image_url:'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80', colors:['#000000','#FFFFFF','#737373'], is_visible:true },
  { name:'Ergonomic Office Chair',        price:6999,  description:'Full posture support with breathable mesh and structural adjustments.',         category:'Chair',    image_url:'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=600&q=80', colors:['#000000','#737373'],           is_visible:true },
  { name:'Vintage Leather Armchair',      price:9500,  description:'Classic distressed leather armchair with solid wood base.',                    category:'Chair',    image_url:'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&q=80', colors:['#8B5E3C','#000000'],           is_visible:true },
  { name:'Modern Velvet Dining Chair',    price:3800,  description:'Plush velvet seating with gold-capped metal legs for a sophisticated look.',   category:'Chair',    image_url:'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&q=80', colors:['#1B2A4A','#FFFFFF'],           is_visible:true },
  { name:'Minimalist Rattan Lounge Chair',price:5400,  description:'Handcrafted natural rattan accent chair with breathable design.',              category:'Chair',    image_url:'https://images.unsplash.com/photo-1580481072645-022f9a6dbf27?w=600&q=80', colors:['#D4C5A9','#8B5E3C'],           is_visible:true },
  { name:'High-back Director Chair',      price:8200,  description:'Swivel director chair featuring cushioned armrests and leather finish.',       category:'Chair',    image_url:'https://images.unsplash.com/photo-1503602642458-232111445657?w=600&q=80', colors:['#000000','#737373'],           is_visible:true },
  { name:'Luxe 3-Seater Sofa',           price:18999, description:'Spacious fabric sofa with premium density cushion padding.',                   category:'Sofa',     image_url:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80', colors:['#737373','#8B5E3C','#FFFFFF'], is_visible:true },
  { name:'L-Shaped Corner Sofa',         price:24500, description:'Maximize your room corners with this luxury modular sectional.',               category:'Sofa',     image_url:'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&q=80', colors:['#737373','#000000'],           is_visible:true },
  { name:'Velvet Loveseat Sofa',         price:14800, description:'Charming velvet-finish compact loveseat for two.',                             category:'Sofa',     image_url:'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=600&q=80', colors:['#1B2A4A','#737373'],           is_visible:true },
  { name:'Modern Futon Convertible Bed', price:12900, description:'Multi-functional sleeper futon that easily folds into a guest bed.',           category:'Sofa',     image_url:'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=600&q=80', colors:['#737373','#000000'],           is_visible:true },
  { name:'Chesterfield Buttoned Sofa',   price:29500, description:'Traditional deep buttoned tufted sofa with rolling scroll arms.',              category:'Sofa',     image_url:'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?w=600&q=80', colors:['#8B5E3C','#000000'],           is_visible:true },
  { name:'Bouclé Upholstered Loveseat',  price:16500, description:'Cozy textured bouclé fabric loveseat with rounded sculptural silhouette.',    category:'Sofa',     image_url:'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80', colors:['#FFFFFF','#D4C5A9'],           is_visible:true },
  { name:'Marble Dining Table',          price:12500, description:'Authentic polished white marble top with minimalist steel frame.',            category:'Table',    image_url:'https://images.unsplash.com/photo-1530018352490-b6b33e931671?w=600&q=80', colors:['#FFFFFF','#000000'],           is_visible:true },
  { name:'Solid Oak Coffee Table',       price:5200,  description:'Rustic solid oak wood block top featuring clean iron hairpin legs.',          category:'Table',    image_url:'https://images.unsplash.com/photo-1581428982868-e410dd047a90?w=600&q=80', colors:['#8B5E3C','#000000'],           is_visible:true },
  { name:'Minimalist Study Desk',        price:4300,  description:'Simplistic and functional design desktop with integrated storage drawer.',    category:'Table',    image_url:'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&q=80', colors:['#FFFFFF','#8B5E3C'],           is_visible:true },
  { name:'Round Glass Bistro Table',     price:4800,  description:'Tempered glass top table with black metal legs, perfect for breakfast nooks.',category:'Table',    image_url:'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=600&q=80', colors:['#FFFFFF','#000000'],           is_visible:true },
  { name:'Extendable Wooden Dining Table',price:15500,description:'Solid pine wood dining table that extends to seat up to 8 guests.',          category:'Table',    image_url:'https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=600&q=80', colors:['#8B5E3C'],                     is_visible:true },
  { name:'Industrial Console Entry Table',price:5900, description:'Slim hall table combining distressed wood surfaces with steel frames.',       category:'Table',    image_url:'https://images.unsplash.com/photo-1499933374294-4584851497cc?w=600&q=80', colors:['#000000','#8B5E3C'],           is_visible:true },
  { name:'Platform Bed Frame',           price:15999, description:'Low profile platform bed frame crafted from solid ash wood.',                 category:'Bed',      image_url:'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=600&q=80', colors:['#8B5E3C','#000000'],           is_visible:true },
  { name:'King Size Wooden Bed',         price:21000, description:'Grand mahogany tall headboard bed frame matching modern bedrooms.',           category:'Bed',      image_url:'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?w=600&q=80', colors:['#8B5E3C'],                     is_visible:true },
  { name:'Canopy Daybed',               price:13500,  description:'Chic lounge daybed with overhead fabric support columns.',                   category:'Bed',      image_url:'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&q=80', colors:['#FFFFFF','#D4C5A9'],           is_visible:true },
  { name:'Upholstered Tufted Bed Frame', price:18500, description:'Elegant tall headboard with diamond button tufting and grey fabric.',        category:'Bed',      image_url:'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=600&q=80', colors:['#737373','#FFFFFF'],           is_visible:true },
  { name:'Metal Frame Loft Bed',         price:11900, description:'Space-saving loft bed frame with safety guardrails and ladder.',             category:'Bed',      image_url:'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80', colors:['#000000','#FFFFFF'],           is_visible:true },
  { name:'Velvet Daybed with Drawers',   price:15800, description:'Premium velvet daybed featuring dual pull-out storage drawers below.',       category:'Bed',      image_url:'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=600&q=80', colors:['#1B2A4A','#737373'],           is_visible:true },
  { name:'Minimalist Storage Cabinet',   price:8750,  description:'Multi-compartment storage cabinet with matte slide doors.',                  category:'Cabinet',  image_url:'https://images.unsplash.com/photo-1601084881623-cef5a7de343a?w=600&q=80', colors:['#737373','#FFFFFF'],           is_visible:true },
  { name:'Oak Sideboard Buffet',         price:11200, description:'Stunning oak buffet credenza with three main drawer slots.',                 category:'Cabinet',  image_url:'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600&q=80', colors:['#8B5E3C','#D4C5A9'],           is_visible:true },
  { name:'Tall Bookshelf Cabinet',       price:6800,  description:'Vertical five-tier shelf cabinet with solid wood siding.',                   category:'Cabinet',  image_url:'https://images.unsplash.com/photo-1597072689227-8d56bd853555?w=600&q=80', colors:['#000000','#8B5E3C'],           is_visible:true },
  { name:'Mirrored Wardrobe Cabinet',    price:19500, description:'Large bedroom wardrobe with mirrored front panels and hanging rails.',       category:'Cabinet',  image_url:'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=600&q=80', colors:['#FFFFFF','#737373'],           is_visible:true },
  { name:'Walnut Media TV Console',      price:10400, description:'Sleek walnut veneer TV stand with open media shelves and cabinets.',        category:'Cabinet',  image_url:'https://images.unsplash.com/photo-1532372320978-9b4d8a3a0245?w=600&q=80', colors:['#8B5E3C','#000000'],           is_visible:true },
  { name:'Industrial Metal Mesh Locker', price:7900,  description:'Vintage steel locker cabinet with grid wire mesh cupboard doors.',           category:'Cabinet',  image_url:'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=600&q=80', colors:['#000000','#737373'],           is_visible:true },
  { name:'Arc Floor Lamp',              price:3299,   description:'Curved stainless steel adjustable overhead lighting lamp.',                  category:'Lighting', image_url:'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&q=80', colors:['#000000','#FFFFFF'],           is_visible:true },
  { name:'Modern Pendant Chandelier',   price:7900,   description:'Glass sphere multi-bulb ceiling hanging pendant light.',                     category:'Lighting', image_url:'https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=600&q=80', colors:['#000000','#D4C5A9'],           is_visible:true },
  { name:'Brass Table Lamp',            price:2450,   description:'Warm antique brass frame table desk reading light.',                         category:'Lighting', image_url:'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80', colors:['#D4C5A9','#000000'],           is_visible:true },
  { name:'Crystal Drop Ceiling Lamp',   price:11500,  description:'Ornate crystal bead chandelier dispersing beautiful light patterns.',        category:'Lighting', image_url:'https://images.unsplash.com/photo-1543198126-a8ad8e47fb21?w=600&q=80', colors:['#FFFFFF','#D4C5A9'],           is_visible:true },
  { name:'Modern LED Ring Chandelier',  price:9200,   description:'Double circular ring suspended ceiling light with adjustable cables.',      category:'Lighting', image_url:'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=600&q=80', colors:['#000000','#FFFFFF'],           is_visible:true },
  { name:'Matte Black Swing Arm Sconce',price:3100,   description:'Minimalist industrial wall-mounted reading sconce light.',                  category:'Lighting', image_url:'https://images.unsplash.com/photo-1517999144091-3d9dca6d1e43?w=600&q=80', colors:['#000000'],                     is_visible:true },
];

async function main() {
  console.log('\n🌱 Seeding furniture table...\n');
  // Delete the test row inserted earlier
  await supabase.from('furniture').delete().eq('name','Test');

  const { count } = await supabase.from('furniture').select('*', { count:'exact', head:true });
  if (count > 0) {
    console.log(`ℹ️  Table already has ${count} items — skipping seed.\n`);
    return;
  }

  const rows = ITEMS.map(i => ({ ...i })); // colors passed as-is (jsonb)
  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10);
    const { error } = await supabase.from('furniture').insert(chunk);
    if (error) console.error(`❌ Batch ${i}:`, error.message);
    else console.log(`   ✅ Inserted items ${i+1}–${Math.min(i+10, rows.length)}`);
  }
  console.log('\n🎉 All 36 furniture items seeded!\n');
}
main().catch(console.error);

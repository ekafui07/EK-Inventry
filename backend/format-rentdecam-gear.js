const fs = require('fs');
const path = require('path');

const rawProducts = JSON.parse(fs.readFileSync(path.join(__dirname, 'rentdecam-scraped-products.json'), 'utf-8'));

// Category Normalization Map
function normalizeCategory(cat) {
  const c = cat.toLowerCase();
  if (c.includes('camera') || c.includes('camcoder')) return 'Cameras';
  if (c.includes('lens')) return 'Lenses';
  if (c.includes('light') || c.includes('strobe') || c.includes('diffuser')) return 'Lighting';
  if (c.includes('mic') || c.includes('sound') || c.includes('recorder') || c.includes('audio')) return 'Audio';
  if (c.includes('gimbal') || c.includes('stand') || c.includes('support') || c.includes('bracket')) return 'Grip & Stabilizers';
  if (c.includes('drone')) return 'Drones';
  if (c.includes('battery') || c.includes('power')) return 'Power & Batteries';
  if (c.includes('card') || c.includes('sd')) return 'Media & Storage';
  if (c.includes('monitor') || c.includes('switcher') || c.includes('transmitter') || c.includes('talk')) return 'Monitors & Video';
  if (c.includes('bundle') || c.includes('combo')) return 'Bundles';
  return 'Accessories';
}

const categoryPrefixes = {
  'Cameras': 'RDC-CAM',
  'Lenses': 'RDC-LNS',
  'Lighting': 'RDC-LGT',
  'Audio': 'RDC-AUD',
  'Grip & Stabilizers': 'RDC-GRP',
  'Drones': 'RDC-DRN',
  'Power & Batteries': 'RDC-PWR',
  'Media & Storage': 'RDC-MED',
  'Monitors & Video': 'RDC-VID',
  'Bundles': 'RDC-BDL',
  'Accessories': 'RDC-ACC'
};

const counts = {};
const gearItems = [];

rawProducts.forEach((p, idx) => {
  const normCat = normalizeCategory(p.category);
  counts[normCat] = (counts[normCat] || 0) + 1;
  const num = String(counts[normCat]).padStart(3, '0');
  const prefix = categoryPrefixes[normCat] || 'RDC-EQP';
  
  // Clean product name
  let cleanName = p.name.replace(/\s+/g, ' ').trim();
  
  // Generate assetTag & serialNumber
  const assetTag = `${prefix}-${num}`;
  const serialNumber = `SN-RDC-${prefix.split('-')[1]}-${1000 + idx}`;

  gearItems.push({
    id: `g_rdc_${idx + 1}`,
    name: cleanName,
    category: normCat,
    dailyRate: p.dailyRate || 50,
    assetTag: assetTag,
    serialNumber: serialNumber,
    status: 'Available',
    image: p.image || '',
    originalCategory: p.category,
    createdAt: '2026-09-20T18:00:00.000Z'
  });
});

console.log('Normalized Category Distribution:');
console.log(counts);
console.log('\nTotal Gear Items generated:', gearItems.length);
console.log('\nSample items from each category:');
const samplePerCat = {};
gearItems.forEach(g => {
  if (!samplePerCat[g.category]) {
    samplePerCat[g.category] = g;
  }
});
console.log(JSON.stringify(samplePerCat, null, 2));

// Save formatted gear items
fs.writeFileSync(path.join(__dirname, 'rentdecam-formatted-gear.json'), JSON.stringify(gearItems, null, 2));

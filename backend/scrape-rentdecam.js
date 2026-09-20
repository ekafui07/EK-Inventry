const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseProductsFromHtml(html) {
  const products = [];
  const productWrapRegex = /<div class="product-wrap">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  // Let's use regex to extract each card
  const cards = html.split('<div class="product-wrap">').slice(1);
  
  for (const card of cards) {
    // Category
    const catMatch = card.match(/<div class="product-cat">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const category = catMatch ? catMatch[1].replace(/<[^>]+>/g, '').trim() : 'General';
    
    // Name
    const nameMatch = card.match(/<h3 class="product-name">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    let name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    // decode html entities
    name = name.replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"');

    // Price
    const priceMatch = card.match(/class="new-price">([^<]+)<\/ins>/i) ||
                       card.match(/class="product-price">([\s\S]*?)<\/div>/i);
    let priceText = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    // extract number like ₵100.00 -> 100
    const numMatch = priceText.match(/[\d,.]+/);
    let dailyRate = 50;
    if (numMatch) {
      dailyRate = parseFloat(numMatch[0].replace(/,/g, ''));
    }

    // Image URL
    const imgMatch = card.match(/<img src="([^"]+)"/i);
    const image = imgMatch ? imgMatch[1] : '';

    if (name) {
      products.push({
        name,
        category,
        dailyRate,
        image
      });
    }
  }
  return products;
}

async function scrapeAll() {
  const allProducts = [];
  const seenNames = new Set();

  for (let page = 1; page <= 10; page++) {
    const url = `https://www.rentdecam.com/products?page=${page}`;
    console.log(`Fetching page ${page}: ${url}...`);
    try {
      const html = await fetchUrl(url);
      const items = parseProductsFromHtml(html);
      console.log(`Found ${items.length} items on page ${page}`);
      if (items.length === 0) {
        console.log(`No items on page ${page}, stopping.`);
        break;
      }
      for (const item of items) {
        if (!seenNames.has(item.name)) {
          seenNames.add(item.name);
          allProducts.push(item);
        }
      }
    } catch (err) {
      console.error(`Error on page ${page}:`, err.message);
      break;
    }
  }

  console.log(`\n=== Total unique products scraped: ${allProducts.length} ===`);
  
  // Group by category
  const categories = {};
  allProducts.forEach(p => {
    categories[p.category] = (categories[p.category] || 0) + 1;
  });
  console.log('Categories found:', categories);

  fs.writeFileSync(path.join(__dirname, 'rentdecam-scraped-products.json'), JSON.stringify(allProducts, null, 2));
  console.log('Saved scraped products to rentdecam-scraped-products.json');
}

scrapeAll();

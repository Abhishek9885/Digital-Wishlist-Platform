const Item = require('../models/Item');
const Wishlist = require('../models/Wishlist');
const axios = require('axios');
const cheerio = require('cheerio');

// @desc    Get all items in a wishlist
// @route   GET /api/items/:wishlistId
exports.getItems = async (req, res) => {
  try {
    const wishlist = await Wishlist.findById(req.params.wishlistId);
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }
    if (wishlist.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view these items' });
    }

    // Sort: High priority first, then medium, then low.
    // Since these are strings, we handle it with a map or specific sort if needed.
    // For now, keeping the database sort and we'll refine if the strings don't align.
    const items = await Item.find({ wishlist: req.params.wishlistId }).sort({ priority: -1, createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error('Get items error:', error.message);
    res.status(500).json({ message: 'Server error fetching items' });
  }
};

// @desc    Add an item to a wishlist
// @route   POST /api/items/:wishlistId
exports.createItem = async (req, res) => {
  try {
    const wishlist = await Wishlist.findById(req.params.wishlistId);
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }
    if (wishlist.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to add items' });
    }

    const { name, description, price, url, imageUrl, priority } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    const item = await Item.create({
      wishlist: req.params.wishlistId,
      name: name.trim(),
      description: description ? description.trim() : '',
      price: price || 0,
      url: url ? url.trim() : '',
      imageUrl: imageUrl ? imageUrl.trim() : '',
      priority: priority || 'medium'
    });

    res.status(201).json(item);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    console.error('Create item error:', error.message);
    res.status(500).json({ message: 'Server error creating item' });
  }
};

// @desc    Update an item
// @route   PUT /api/items/:id
exports.updateItem = async (req, res) => {
  try {
    let item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const wishlist = await Wishlist.findById(item.wishlist);
    if (!wishlist || wishlist.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this item' });
    }

    const { name, description, price, url, imageUrl, priority } = req.body;

    if (name !== undefined) item.name = name.trim();
    if (description !== undefined) item.description = description.trim();
    if (price !== undefined) item.price = price;
    if (url !== undefined) item.url = url.trim();
    if (imageUrl !== undefined) item.imageUrl = imageUrl.trim();
    if (priority !== undefined) item.priority = priority;

    await item.save();
    res.json(item);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    console.error('Update item error:', error.message);
    res.status(500).json({ message: 'Server error updating item' });
  }
};

// @desc    Delete an item
// @route   DELETE /api/items/:id
exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const wishlist = await Wishlist.findById(item.wishlist);
    if (!wishlist || wishlist.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete item error:', error.message);
    res.status(500).json({ message: 'Server error deleting item' });
  }
};

// @desc    Guest reserves an item
// @route   PUT /api/items/:id/reserve
exports.reserveItem = async (req, res) => {
  try {
    const { reservedBy } = req.body;

    if (!reservedBy || !reservedBy.trim()) {
      return res.status(400).json({ message: 'Please provide your name to reserve this item' });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.isReserved) {
      return res.status(400).json({ message: 'This item is already reserved' });
    }

    const wishlist = await Wishlist.findById(item.wishlist);
    if (!wishlist || !wishlist.isPublic) {
      return res.status(403).json({ message: 'Cannot reserve items on a private wishlist' });
    }

    item.isReserved = true;
    item.reservedBy = reservedBy.trim();
    await item.save();

    res.json(item);
  } catch (error) {
    console.error('Reserve item error:', error.message);
    res.status(500).json({ message: 'Server error reserving item' });
  }
};

// NOTE: unreserveItem removed to comply with SRS FR-5.5 (Locked Reservations)

// @desc    Get items for a shared wishlist
// @route   GET /api/items/share/:token
exports.getSharedItems = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ shareToken: req.params.token });

    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    if (!wishlist.isPublic) {
      return res.status(403).json({ message: 'This wishlist is private' });
    }

    const items = await Item.find({ wishlist: wishlist._id }).sort({ priority: -1, createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error('Get shared items error:', error.message);
    res.status(500).json({ message: 'Server error fetching shared items' });
  }
};

/**
 * Helper to extract metadata from JSON-LD structured data
 */
const extractJsonLd = ($) => {
  const metadata = {};
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      let json = JSON.parse($(el).html());
      // Flipkart sometimes nests JSON-LD in unusual ways or uses arrays
      const items = Array.isArray(json) ? json : [json];
      
      items.forEach(item => {
        // Check for Product type (handle both string and array types)
        const type = item['@type'];
        const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
        
        if (isProduct) {
          metadata.name = metadata.name || item.name;
          metadata.description = metadata.description || item.description;
          
          // Image can be string, object, or array
          if (item.image) {
            if (typeof item.image === 'string') metadata.imageUrl = metadata.imageUrl || item.image;
            else if (Array.isArray(item.image)) metadata.imageUrl = metadata.imageUrl || item.image[0];
            else if (item.image.url) metadata.imageUrl = metadata.imageUrl || item.image.url;
          }
          
          // Offers contain price info
          if (item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            const firstOffer = offers[0];
            if (firstOffer.price) {
              metadata.price = metadata.price || parseFloat(firstOffer.price.toString().replace(/[^\d.]/g, ''));
            }
          }
        }
      });
    } catch (e) {
      // Skip invalid JSON
    }
  });
  return metadata;
};

// @desc    Scrape product metadata from a URL
// @route   GET /api/items/scrape?url=...
exports.scrapeUrl = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Determine the source site
    const detectSite = (urlStr) => {
      const u = urlStr.toLowerCase();
      if (u.includes('amazon.') || u.includes('amzn.')) return 'Amazon';
      if (u.includes('flipkart.com')) return 'Flipkart';
      return 'Web';
    };

    const sourceSite = detectSite(url);

    // Enhanced headers to bypass basic bot detection
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.google.com/',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand)";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000,
      maxRedirects: 10
    });

    const $ = cheerio.load(html);
    
    // 1. Try JSON-LD first (Most robust for e-commerce)
    const jsonLdData = extractJsonLd($);
    
    const metadata = {
      name: jsonLdData.name || '',
      price: jsonLdData.price || 0,
      description: jsonLdData.description || '',
      imageUrl: jsonLdData.imageUrl || '',
      sourceSite
    };

    const cleanPrice = (priceStr) => {
      if (!priceStr) return 0;
      // Remove currency symbols like ₹, $, etc. but keep digits, commas, dots
      let p = priceStr.replace(/[^\d.,]/g, '');
      
      const lastDot = p.lastIndexOf('.');
      const lastComma = p.lastIndexOf(',');

      if (lastComma > lastDot) {
        if (p.length - lastComma === 3) {
          p = p.replace(/\./g, '').replace(',', '.');
        } else {
          p = p.replace(/,/g, '');
        }
      } else {
        p = p.replace(/,/g, '');
      }
      
      return parseFloat(p) || 0;
    };

    // 2. Open Graph & Meta Tags (Second best)
    metadata.name = metadata.name || 
      $('meta[property="og:title"]').attr('content') || 
      $('meta[name="twitter:title"]').attr('content') ||
      $('meta[name="title"]').attr('content') || 
      $('h1').first().text().trim();

    metadata.imageUrl = metadata.imageUrl || 
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('link[rel="image_src"]').attr('href');

    metadata.description = metadata.description || 
      $('meta[property="og:description"]').attr('content') || 
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content');

    if (metadata.price === 0) {
      const ogPrice = 
        $('meta[property="product:price:amount"]').attr('content') || 
        $('meta[property="og:price:amount"]').attr('content') ||
        $('meta[name="twitter:label1"]').filter((i, el) => $(el).attr('content')?.toLowerCase().includes('price')).next().attr('content');
      
      if (ogPrice) metadata.price = cleanPrice(ogPrice);
    }

    // 3. Site-Specific Fallbacks (if metadata still missing)
    if (sourceSite === 'Amazon') {
      metadata.name = metadata.name || $('#productTitle').text().trim();
      metadata.imageUrl = metadata.imageUrl || $('#landingImage').attr('src') || $('#imgTagWrapperId img').attr('src');
      
      if (metadata.price === 0) {
        const amazonPrice = $('.a-price .a-offscreen').first().text() || $('#priceblock_ourprice').text();
        if (amazonPrice) metadata.price = cleanPrice(amazonPrice);
      }
    } else if (sourceSite === 'Flipkart') {
      // Flipkart classes change often, but some attributes are more stable
      metadata.name = metadata.name || $('.B_NuCI').text().trim() || $('h1').text().trim();
      
      if (metadata.price === 0) {
        const flipPrice = $('._30jeq3').first().text(); // Still trying some common classes
        if (flipPrice) metadata.price = cleanPrice(flipPrice);
      }
    }

    // 4. Final Generic Price Hunt (regex for currency patterns)
    if (metadata.price === 0) {
      const priceSelectors = ['.price', '.amount', '[itemprop="price"]', '.product-price', '.current-price'];
      for (const selector of priceSelectors) {
        const text = $(selector).first().text();
        if (text) {
          metadata.price = cleanPrice(text);
          if (metadata.price > 0) break;
        }
      }
    }

    // Cleanup & Limits
    if (metadata.name && metadata.name.length > 200) {
      metadata.name = metadata.name.substring(0, 197) + '...';
    }
    if (metadata.description && metadata.description.length > 500) {
      metadata.description = metadata.description.substring(0, 497) + '...';
    }
    
    // Ensure image URL is absolute
    if (metadata.imageUrl && !metadata.imageUrl.startsWith('http')) {
      try {
        const baseUrl = new URL(url);
        metadata.imageUrl = new URL(metadata.imageUrl, baseUrl.origin).href;
      } catch (e) {}
    }

    res.json(metadata);
  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ message: 'Failed to extract product details from this URL.' });
  }
};

// @desc    Get global statistics for the user (total value, items, reserved)
// @route   GET /api/items/stats/global
exports.getGlobalStats = async (req, res) => {
  try {
    // We need to find all wishlists for this user first
    const wishlists = await Wishlist.find({ user: req.user.id });
    const wishlistIds = wishlists.map(w => w._id);

    const items = await Item.find({ wishlist: { $in: wishlistIds } });

    const totalValue = items.reduce((sum, item) => sum + (item.price || 0), 0);
    const totalItems = items.length;
    const totalReserved = items.filter(i => i.isReserved).length;

    res.json({
      totalValue,
      totalItems,
      totalReserved
    });
  } catch (error) {
    console.error('Get global stats error:', error.message);
    res.status(500).json({ message: 'Server error fetching statistics' });
  }
};

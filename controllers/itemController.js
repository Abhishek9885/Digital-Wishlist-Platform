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
      if (u.includes('amazon.')) return 'Amazon';
      if (u.includes('flipkart.com')) return 'Flipkart';
      return 'Web';
    };

    const sourceSite = detectSite(url);

    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000
    });

    const $ = cheerio.load(html);
    const metadata = {
      name: '',
      price: 0,
      description: '',
      imageUrl: '',
      sourceSite
    };

    // --- Generic & OG Tags first ---
    metadata.name = 
      $('meta[property="og:title"]').attr('content') || 
      $('meta[name="title"]').attr('content') || 
      $('h1').first().text().trim();

    metadata.imageUrl = 
      $('meta[property="og:image"]').attr('content');

    metadata.description = 
      $('meta[property="og:description"]').attr('content') || 
      $('meta[name="description"]').attr('content');

    // --- Site-Specific Refinement ---
    if (sourceSite === 'Amazon') {
      metadata.name = $('#productTitle').text().trim() || metadata.name;
      metadata.imageUrl = metadata.imageUrl || $('#landingImage').attr('src') || $('#imgTagWrapperId img').attr('src');
      metadata.description = metadata.description || $('#productDescription').text().trim();
      
      const amazonPrice = $('.a-price .a-offscreen').first().text() || $('#priceblock_ourprice').text() || $('#priceblock_dealprice').text();
      if (amazonPrice) {
        const cleaned = amazonPrice.replace(/[^\d.,]/g, '').replace(',', '.');
        metadata.price = parseFloat(cleaned) || 0;
      }
    } else if (sourceSite === 'Flipkart') {
      metadata.name = $('.B_NuCI').text().trim() || metadata.name;
      // Flipkart often puts main image in a specific class or uses a data attribute
      metadata.imageUrl = metadata.imageUrl || $('._396cs4._2amPT_._3q69OO img').attr('src') || $('img._2r_T1_').attr('src');
      
      const flipkartPrice = $('._30jeq3._16G7S8').first().text() || $('._30jeq3').first().text();
      if (flipkartPrice) {
        const cleaned = flipkartPrice.replace(/[^\d]/g, ''); // Flipkart prices usually don't have decimals
        metadata.price = parseFloat(cleaned) || 0;
      }
    }

    // --- Cleanup & Limits ---
    if (metadata.name && metadata.name.length > 100) {
      metadata.name = metadata.name.substring(0, 97) + '...';
    }
    if (metadata.description && metadata.description.length > 500) {
      metadata.description = metadata.description.substring(0, 497) + '...';
    }

    // Try to get price from OG tags if site-specific failed
    if (metadata.price === 0) {
      const ogPrice = $('meta[property="product:price:amount"]').attr('content');
      if (ogPrice) metadata.price = parseFloat(ogPrice.replace(',', '.')) || 0;
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

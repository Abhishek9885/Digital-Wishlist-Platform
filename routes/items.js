const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const Wishlist = require('../models/Wishlist');
const auth = require('../middleware/auth');

// @route   GET /api/items/:wishlistId
// @desc    Get all items in a wishlist
// @access  Private
router.get('/:wishlistId', auth, async (req, res) => {
  try {
    // Verify wishlist belongs to user
    const wishlist = await Wishlist.findById(req.params.wishlistId);
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }
    if (wishlist.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view these items' });
    }

    const items = await Item.find({ wishlist: req.params.wishlistId }).sort({ priority: -1, createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error('Get items error:', error.message);
    res.status(500).json({ message: 'Server error fetching items' });
  }
});

// @route   POST /api/items/:wishlistId
// @desc    Add an item to a wishlist
// @access  Private
router.post('/:wishlistId', auth, async (req, res) => {
  try {
    // Verify wishlist belongs to user
    const wishlist = await Wishlist.findById(req.params.wishlistId);
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }
    if (wishlist.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to add items to this wishlist' });
    }

    const { name, description, price, url, priority } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    const item = await Item.create({
      wishlist: req.params.wishlistId,
      name: name.trim(),
      description: description ? description.trim() : '',
      price: price || 0,
      url: url ? url.trim() : '',
      priority: priority || 'medium'
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create item error:', error.message);
    res.status(500).json({ message: 'Server error creating item' });
  }
});

// @route   PUT /api/items/:id
// @desc    Update an item
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    let item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Verify wishlist belongs to user
    const wishlist = await Wishlist.findById(item.wishlist);
    if (!wishlist || wishlist.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this item' });
    }

    const { name, description, price, url, priority } = req.body;

    if (name !== undefined) item.name = name.trim();
    if (description !== undefined) item.description = description.trim();
    if (price !== undefined) item.price = price;
    if (url !== undefined) item.url = url.trim();
    if (priority !== undefined) item.priority = priority;

    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Update item error:', error.message);
    res.status(500).json({ message: 'Server error updating item' });
  }
});

// @route   DELETE /api/items/:id
// @desc    Delete an item
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Verify wishlist belongs to user
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
});

// @route   PUT /api/items/:id/reserve
// @desc    Guest reserves an item
// @access  Public
router.put('/:id/reserve', async (req, res) => {
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

    // Verify the item's wishlist is public
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
});

// @route   PUT /api/items/:id/unreserve
// @desc    Guest unreserves an item
// @access  Public
router.put('/:id/unreserve', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (!item.isReserved) {
      return res.status(400).json({ message: 'This item is not reserved' });
    }

    // Verify the item's wishlist is public
    const wishlist = await Wishlist.findById(item.wishlist);
    if (!wishlist || !wishlist.isPublic) {
      return res.status(403).json({ message: 'Cannot modify items on a private wishlist' });
    }

    item.isReserved = false;
    item.reservedBy = '';
    await item.save();

    res.json(item);
  } catch (error) {
    console.error('Unreserve item error:', error.message);
    res.status(500).json({ message: 'Server error unreserving item' });
  }
});

// @route   GET /api/items/share/:token
// @desc    Get items for a shared wishlist
// @access  Public
router.get('/share/:token', async (req, res) => {
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
});

module.exports = router;

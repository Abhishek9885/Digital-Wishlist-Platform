const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const Item = require('../models/Item');
const auth = require('../middleware/auth');

// @route   GET /api/wishlists
// @desc    Get all wishlists for the logged-in user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const wishlists = await Wishlist.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(wishlists);
  } catch (error) {
    console.error('Get wishlists error:', error.message);
    res.status(500).json({ message: 'Server error fetching wishlists' });
  }
});

// @route   POST /api/wishlists
// @desc    Create a new wishlist
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, isPublic } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Wishlist title is required' });
    }

    const wishlist = await Wishlist.create({
      user: req.user.id,
      title: title.trim(),
      description: description ? description.trim() : '',
      isPublic: isPublic || false
    });

    res.status(201).json(wishlist);
  } catch (error) {
    console.error('Create wishlist error:', error.message);
    res.status(500).json({ message: 'Server error creating wishlist' });
  }
});

// @route   PUT /api/wishlists/:id
// @desc    Update a wishlist
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    let wishlist = await Wishlist.findById(req.params.id);

    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Ensure user owns the wishlist
    if (wishlist.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this wishlist' });
    }

    const { title, description, isPublic } = req.body;

    if (title !== undefined) wishlist.title = title.trim();
    if (description !== undefined) wishlist.description = description.trim();
    if (isPublic !== undefined) wishlist.isPublic = isPublic;

    await wishlist.save();
    res.json(wishlist);
  } catch (error) {
    console.error('Update wishlist error:', error.message);
    res.status(500).json({ message: 'Server error updating wishlist' });
  }
});

// @route   DELETE /api/wishlists/:id
// @desc    Delete a wishlist and its items
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const wishlist = await Wishlist.findById(req.params.id);

    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Ensure user owns the wishlist
    if (wishlist.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this wishlist' });
    }

    // Cascade delete all items in this wishlist
    await Item.deleteMany({ wishlist: wishlist._id });
    await Wishlist.findByIdAndDelete(req.params.id);

    res.json({ message: 'Wishlist and all its items deleted successfully' });
  } catch (error) {
    console.error('Delete wishlist error:', error.message);
    res.status(500).json({ message: 'Server error deleting wishlist' });
  }
});

// @route   GET /api/wishlists/share/:token
// @desc    Get a public wishlist by share token
// @access  Public
router.get('/share/:token', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ shareToken: req.params.token })
      .populate('user', 'name');

    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    if (!wishlist.isPublic) {
      return res.status(403).json({ message: 'This wishlist is private' });
    }

    res.json(wishlist);
  } catch (error) {
    console.error('Get shared wishlist error:', error.message);
    res.status(500).json({ message: 'Server error fetching shared wishlist' });
  }
});

module.exports = router;

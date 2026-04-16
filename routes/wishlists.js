const express = require('express');
const router = express.Router();
const {
  getWishlists,
  createWishlist,
  updateWishlist,
  deleteWishlist,
  getSharedWishlist
} = require('../controllers/wishlistController');
const auth = require('../middleware/auth');

// @route   GET /api/wishlists
// @desc    Get all wishlists for the logged-in user
// @access  Private
router.get('/', auth, getWishlists);

// @route   POST /api/wishlists
// @desc    Create a new wishlist
// @access  Private
router.post('/', auth, createWishlist);

// @route   PUT /api/wishlists/:id
// @desc    Update a wishlist
// @access  Private
router.put('/:id', auth, updateWishlist);

// @route   DELETE /api/wishlists/:id
// @desc    Delete a wishlist and its items
// @access  Private
router.delete('/:id', auth, deleteWishlist);

// @route   GET /api/wishlists/share/:token
// @desc    Get a public wishlist by share token
// @access  Public
router.get('/share/:token', getSharedWishlist);

module.exports = router;

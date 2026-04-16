const express = require('express');
const router = express.Router();
const {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  reserveItem,
  getSharedItems,
  scrapeUrl,
  getGlobalStats
} = require('../controllers/itemController');
const auth = require('../middleware/auth');

// @route   GET /api/items/stats/global
// @desc    Get global statistics
// @access  Private
router.get('/stats/global', auth, getGlobalStats);

// @route   GET /api/items/scrape
// @desc    Scrape product metadata
// @access  Private
router.get('/scrape', auth, scrapeUrl);

// @route   GET /api/items/:wishlistId
// @desc    Get all items in a wishlist
// @access  Private
router.get('/:wishlistId', auth, getItems);

// @route   POST /api/items/:wishlistId
// @desc    Add an item to a wishlist
// @access  Private
router.post('/:wishlistId', auth, createItem);

// @route   PUT /api/items/:id
// @desc    Update an item
// @access  Private
router.put('/:id', auth, updateItem);

// @route   DELETE /api/items/:id
// @desc    Delete an item
// @access  Private
router.delete('/:id', auth, deleteItem);

// @route   PUT /api/items/:id/reserve
// @desc    Guest reserves an item
// @access  Public
router.put('/:id/reserve', reserveItem);

// NOTE: Unreserve route removed to comply with SRS FR-5.5 (Locked Reservations)

// @route   GET /api/items/share/:token
// @desc    Get items for a shared wishlist
// @access  Public
router.get('/share/:token', getSharedItems);


module.exports = router;

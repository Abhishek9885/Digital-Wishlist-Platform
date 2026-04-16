const Wishlist = require('../models/Wishlist');
const Item = require('../models/Item');

// @desc    Get all wishlists for the logged-in user
// @route   GET /api/wishlists
exports.getWishlists = async (req, res) => {
  try {
    const wishlists = await Wishlist.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(wishlists);
  } catch (error) {
    console.error('Get wishlists error:', error.message);
    res.status(500).json({ message: 'Server error fetching wishlists' });
  }
};

// @desc    Create a new wishlist
// @route   POST /api/wishlists
exports.createWishlist = async (req, res) => {
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
};

// @desc    Update a wishlist
// @route   PUT /api/wishlists/:id
exports.updateWishlist = async (req, res) => {
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
};

// @desc    Delete a wishlist and its items
// @route   DELETE /api/wishlists/:id
exports.deleteWishlist = async (req, res) => {
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
};

// @desc    Get a public wishlist by share token
// @route   GET /api/wishlists/share/:token
exports.getSharedWishlist = async (req, res) => {
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
};

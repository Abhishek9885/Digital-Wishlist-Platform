// ============================================
// Digital Wishlist Platform — Dashboard JS
// ============================================

const API_BASE = '';
let currentWishlistId = null;
let totalItemCount = 0;

// ---- Auth Helpers ----
function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userName');
  localStorage.removeItem('userId');
  window.location.href = '/';
}

// ---- Check authentication ----
(function checkAuth() {
  if (!getToken()) {
    window.location.href = '/';
    return;
  }
  const name = localStorage.getItem('userName');
  document.getElementById('user-name-display').textContent = `Welcome, ${name || 'User'}`;
  loadWishlists();
})();

// ---- Toast ----
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---- Modal Helpers ----
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });
});

// ============================================
// WISHLISTS
// ============================================

async function loadWishlists() {
  try {
    const res = await fetch(`${API_BASE}/api/wishlists`, { headers: authHeaders() });

    if (res.status === 401) {
      logout();
      return;
    }

    const wishlists = await res.json();
    renderWishlists(wishlists);

    // Count total items across wishlists
    totalItemCount = 0;
    for (const wl of wishlists) {
      const itemRes = await fetch(`${API_BASE}/api/items/${wl._id}`, { headers: authHeaders() });
      if (itemRes.ok) {
        const items = await itemRes.json();
        totalItemCount += items.length;
      }
    }
    document.getElementById('stats-items').textContent = totalItemCount;
  } catch (err) {
    showToast('Failed to load wishlists', 'error');
  }
}

function renderWishlists(wishlists) {
  const grid = document.getElementById('wishlists-grid');
  const empty = document.getElementById('empty-state');

  document.getElementById('stats-lists').textContent = wishlists.length;

  if (wishlists.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = wishlists.map((wl, index) => `
    <div class="card wishlist-card animate-fade-in-up" style="animation-delay: ${index * 0.05}s" id="wl-${wl._id}">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(wl.title)}</h3>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editWishlist('${wl._id}')" title="Edit"><i data-lucide="edit-2" class="icon-sm"></i></button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteWishlist('${wl._id}')" title="Delete"><i data-lucide="trash-2" class="icon-sm"></i></button>
        </div>
      </div>
      <div class="card-meta">
        <span class="badge ${wl.isPublic ? 'badge-public' : 'badge-private'}">${wl.isPublic ? '<i data-lucide="globe" class="icon-sm"></i> Public' : '<i data-lucide="lock" class="icon-sm"></i> Private'}</span>
        <span>${formatDate(wl.createdAt)}</span>
      </div>
      ${wl.description ? `<p class="card-description">${escapeHtml(wl.description)}</p>` : ''}
      <div class="card-footer">
        <button class="btn btn-primary btn-sm" onclick="viewItems('${wl._id}', '${escapeHtml(wl.title)}', '${escapeHtml(wl.description || '')}')">View Items <i data-lucide="arrow-right" class="icon-sm"></i></button>
        ${wl.isPublic ? `
          <span class="share-link" onclick="copyShareLink('${wl.shareToken}')" title="Copy share link">
            <i data-lucide="copy" class="icon-sm"></i> Copy Link
          </span>
        ` : '<span class="text-muted" style="font-size:0.8rem;">Make public to share</span>'}
      </div>
    </div>
  `).join('');

  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 0);
  }
}

function openCreateWishlistModal() {
  document.getElementById('wishlist-modal-title').textContent = 'New Wishlist';
  document.getElementById('wishlist-submit-btn').textContent = 'Create Wishlist';
  document.getElementById('wishlist-edit-id').value = '';
  document.getElementById('wishlist-title').value = '';
  document.getElementById('wishlist-description').value = '';
  document.getElementById('wishlist-public').checked = false;
  openModal('wishlist-modal');
}

async function editWishlist(id) {
  try {
    const res = await fetch(`${API_BASE}/api/wishlists`, { headers: authHeaders() });
    const wishlists = await res.json();
    const wl = wishlists.find(w => w._id === id);
    if (!wl) return showToast('Wishlist not found', 'error');

    document.getElementById('wishlist-modal-title').textContent = 'Edit Wishlist';
    document.getElementById('wishlist-submit-btn').textContent = 'Save Changes';
    document.getElementById('wishlist-edit-id').value = id;
    document.getElementById('wishlist-title').value = wl.title;
    document.getElementById('wishlist-description').value = wl.description || '';
    document.getElementById('wishlist-public').checked = wl.isPublic;
    openModal('wishlist-modal');
  } catch (err) {
    showToast('Error loading wishlist', 'error');
  }
}

async function handleWishlistSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('wishlist-edit-id').value;
  const title = document.getElementById('wishlist-title').value.trim();
  const description = document.getElementById('wishlist-description').value.trim();
  const isPublic = document.getElementById('wishlist-public').checked;

  if (!title) return showToast('Title is required', 'error');

  const isEdit = !!id;
  const url = isEdit ? `${API_BASE}/api/wishlists/${id}` : `${API_BASE}/api/wishlists`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify({ title, description, isPublic })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to save wishlist');
    }

    showToast(isEdit ? 'Wishlist updated!' : 'Wishlist created!', 'success');
    closeModal('wishlist-modal');
    loadWishlists();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteWishlist(id) {
  if (!confirm('Delete this wishlist and all its items? This cannot be undone.')) return;

  try {
    const res = await fetch(`${API_BASE}/api/wishlists/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to delete');
    }

    showToast('Wishlist deleted', 'success');

    // If we were viewing items for this wishlist, close that section
    if (currentWishlistId === id) {
      closeItemsSection();
    }

    loadWishlists();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function copyShareLink(token) {
  const link = `${window.location.origin}/share.html?token=${token}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Share link copied to clipboard!', 'success');
  }).catch(() => {
    // Fallback
    prompt('Copy this link:', link);
  });
}

// ============================================
// ITEMS
// ============================================

async function viewItems(wishlistId, title, description) {
  currentWishlistId = wishlistId;
  document.getElementById('items-wishlist-title').textContent = title;
  document.getElementById('items-wishlist-desc').textContent = description;
  document.getElementById('wishlists-grid').classList.add('hidden');
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('items-section').classList.remove('hidden');

  await loadItems(wishlistId);
}

function closeItemsSection() {
  currentWishlistId = null;
  document.getElementById('items-section').classList.add('hidden');
  document.getElementById('wishlists-grid').classList.remove('hidden');
  loadWishlists();
}

async function loadItems(wishlistId) {
  try {
    const res = await fetch(`${API_BASE}/api/items/${wishlistId}`, { headers: authHeaders() });

    if (!res.ok) throw new Error('Failed to load items');

    const items = await res.json();
    renderItems(items);
  } catch (err) {
    showToast('Failed to load items', 'error');
  }
}

function renderItems(items) {
  const list = document.getElementById('items-list');
  const empty = document.getElementById('items-empty-state');

  if (items.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = items.map((item, index) => `
    <div class="item-card animate-fade-in-up ${item.isReserved ? 'reserved' : ''}" style="animation-delay: ${index * 0.05}s" id="item-${item._id}">
      <div class="item-info">
        <div class="item-name">
          ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.name)} <i data-lucide="external-link" class="icon-xs"></i></a>` : escapeHtml(item.name)}
        </div>
        ${item.description ? `<div class="item-desc">${escapeHtml(item.description)}</div>` : ''}
        <div class="item-meta">
          ${item.price > 0 ? `<span class="item-price">₹${item.price.toLocaleString()}</span>` : ''}
          <span class="badge badge-priority-${item.priority}">${item.priority}</span>
          ${item.isReserved ? `<span class="badge badge-reserved"><i data-lucide="gift" class="icon-sm"></i> Reserved by ${escapeHtml(item.reservedBy)}</span>` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm btn-icon" onclick="editItem('${item._id}')" title="Edit"><i data-lucide="edit-2" class="icon-sm"></i></button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteItem('${item._id}')" title="Delete"><i data-lucide="trash-2" class="icon-sm"></i></button>
      </div>
    </div>
  `).join('');

  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 0);
  }
}

function openAddItemModal() {
  document.getElementById('item-modal-title').textContent = 'Add Item';
  document.getElementById('item-submit-btn').textContent = 'Add Item';
  document.getElementById('item-edit-id').value = '';
  document.getElementById('item-name').value = '';
  document.getElementById('item-description').value = '';
  document.getElementById('item-price').value = '';
  document.getElementById('item-url').value = '';
  document.getElementById('item-priority').value = 'medium';
  openModal('item-modal');
}

async function editItem(id) {
  try {
    const res = await fetch(`${API_BASE}/api/items/${currentWishlistId}`, { headers: authHeaders() });
    const items = await res.json();
    const item = items.find(i => i._id === id);
    if (!item) return showToast('Item not found', 'error');

    document.getElementById('item-modal-title').textContent = 'Edit Item';
    document.getElementById('item-submit-btn').textContent = 'Save Changes';
    document.getElementById('item-edit-id').value = id;
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-description').value = item.description || '';
    document.getElementById('item-price').value = item.price || '';
    document.getElementById('item-url').value = item.url || '';
    document.getElementById('item-priority').value = item.priority;
    openModal('item-modal');
  } catch (err) {
    showToast('Error loading item', 'error');
  }
}

async function handleItemSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('item-edit-id').value;
  const name = document.getElementById('item-name').value.trim();
  const description = document.getElementById('item-description').value.trim();
  const price = parseFloat(document.getElementById('item-price').value) || 0;
  const url = document.getElementById('item-url').value.trim();
  const priority = document.getElementById('item-priority').value;

  if (!name) return showToast('Item name is required', 'error');

  const isEdit = !!id;
  const endpoint = isEdit
    ? `${API_BASE}/api/items/${id}`
    : `${API_BASE}/api/items/${currentWishlistId}`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(endpoint, {
      method,
      headers: authHeaders(),
      body: JSON.stringify({ name, description, price, url, priority })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to save item');
    }

    showToast(isEdit ? 'Item updated!' : 'Item added!', 'success');
    closeModal('item-modal');
    loadItems(currentWishlistId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/items/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to delete item');
    }

    showToast('Item deleted', 'success');
    loadItems(currentWishlistId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

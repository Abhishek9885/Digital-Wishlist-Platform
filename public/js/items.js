// ============================================
// Digital Wishlist Platform — Items JS (Wishlist Detail)
// ============================================

const API_BASE = '';
let currentWishlistId = null;

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
  window.location.href = '/login.html';
}

// ---- Init: Get Wishlist ID from URL ----
(async function init() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  currentWishlistId = params.get('id');

  if (!currentWishlistId) {
    window.location.href = '/dashboard.html';
    return;
  }

  const name = localStorage.getItem('userName');
  document.getElementById('user-name-display').innerHTML = `Welcome, <span class="gradient-text">${name || 'User'}</span>`;
  
  await loadWishlistDetail();
  await loadItems();
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
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ============================================
// DATA LOADING
// ============================================

async function loadWishlistDetail() {
  try {
    const res = await fetch(`${API_BASE}/api/wishlists`, { headers: authHeaders() });
    const wishlists = await res.json();
    const wl = wishlists.find(w => w._id === currentWishlistId);
    
    if (!wl) {
      showToast('Wishlist not found', 'error');
      setTimeout(() => window.location.href = '/dashboard.html', 1500);
      return;
    }

    document.getElementById('items-wishlist-title').textContent = wl.title;
    document.getElementById('items-wishlist-desc').textContent = wl.description || '';
    document.title = `${wl.title} — Digital Wishlist Platform`;
  } catch (err) {
    console.error('Error loading wishlist detail:', err);
  }
}

async function loadItems() {
  try {
    const res = await fetch(`${API_BASE}/api/items/${currentWishlistId}`, { headers: authHeaders() });

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

  // Update Stats
  const totalValue = items.reduce((sum, item) => sum + (item.price || 0), 0);
  document.getElementById('stats-item-value').textContent = `₹${totalValue.toLocaleString('en-IN')}`;
  document.getElementById('stats-item-count').textContent = items.length;
  document.getElementById('stats-item-reserved').textContent = items.filter(i => i.isReserved).length;

  if (items.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = items.map((item, index) => `
    <div class="item-card animate-fade-in-up ${item.isReserved ? 'reserved' : ''}" style="animation-delay: ${index * 0.05}s" id="item-${item._id}">
      ${item.imageUrl ? `
        <div class="item-image">
          <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" onerror="this.src='https://placehold.co/400x300?text=No+Image'">
        </div>
      ` : ''}
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

// ============================================
// ITEM OPERATIONS
// ============================================

function openAddItemModal() {
  document.getElementById('item-modal-title').textContent = 'Add Item';
  document.getElementById('item-submit-btn').textContent = 'Add Item';
  document.getElementById('item-edit-id').value = '';
  document.getElementById('item-name').value = '';
  document.getElementById('item-description').value = '';
  document.getElementById('item-price').value = '';
  document.getElementById('item-url').value = '';
  document.getElementById('item-image-url').value = '';
  document.getElementById('item-priority').value = 'medium';
  
  // Reset Scrape Preview (Auto-Fetch Upgrade)
  const preview = document.getElementById('scrape-preview-container');
  if (preview) preview.classList.add('hidden');
  
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
    document.getElementById('item-image-url').value = item.imageUrl || '';
    document.getElementById('item-priority').value = item.priority;
    
    // Hide Scrape Preview in edit mode
    const preview = document.getElementById('scrape-preview-container');
    if (preview) preview.classList.add('hidden');

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
  const imageUrl = document.getElementById('item-image-url').value.trim();
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
      body: JSON.stringify({ name, description, price, url, imageUrl, priority })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to save item');
    }

    showToast(isEdit ? 'Item updated!' : 'Item added!', 'success');
    closeModal('item-modal');
    loadItems();
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
    loadItems();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// AUTO-FETCH SYSTEM (Upgraded with Preview)
// ============================================

document.getElementById('item-url').addEventListener('paste', (e) => {
  const pastedUrl = e.clipboardData.getData('text');
  if (pastedUrl) fetchMetadata(pastedUrl);
});

document.getElementById('item-url').addEventListener('blur', (e) => {
  const url = e.target.value.trim();
  if (url) fetchMetadata(url);
});

async function fetchMetadata(url) {
  if (!url || !url.startsWith('http')) return;

  const submitBtn = document.getElementById('item-submit-btn');
  const originalText = submitBtn.textContent;
  
  // Preview Elements
  const previewContainer = document.getElementById('scrape-preview-container');
  const previewBadge = document.getElementById('preview-site-badge');
  const previewImg = document.getElementById('preview-img');
  const previewTitle = document.getElementById('preview-title');
  const previewPrice = document.getElementById('preview-price');
  
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:14px; height:14px; margin-right:8px;"></span> Fetching...';
    
    const res = await fetch(`${API_BASE}/api/items/scrape?url=${encodeURIComponent(url)}`, {
      headers: authHeaders()
    });
    
    if (!res.ok) throw new Error('Failed to fetch metadata');
    
    const data = await res.json();
    
    // Auto-fill fields
    const nameEl = document.getElementById('item-name');
    const priceEl = document.getElementById('item-price');
    const descEl = document.getElementById('item-description');
    const imgEl = document.getElementById('item-image-url');

    if (data.name) nameEl.value = data.name;
    if (data.price) priceEl.value = data.price;
    if (data.description) descEl.value = data.description;
    if (data.imageUrl) imgEl.value = data.imageUrl;
    
    // Show Preview Card
    if (data.name) {
      previewTitle.textContent = data.name;
      previewPrice.textContent = `₹${data.price.toLocaleString('en-IN')}`;
      previewImg.src = data.imageUrl || 'https://placehold.co/100x100?text=No+Preview';
      
      // Site Badging
      previewBadge.textContent = `Fetched from ${data.sourceSite}`;
      previewBadge.className = `preview-badge site-${data.sourceSite.toLowerCase()}`;
      
      previewContainer.classList.remove('hidden');
      showToast(`Product found on ${data.sourceSite}! ✨`, 'success');
    }
  } catch (err) {
    console.error('Fetch metadata error:', err);
    if (previewContainer) previewContainer.classList.add('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

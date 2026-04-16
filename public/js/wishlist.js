// ============================================
// Digital Wishlist Platform — Wishlist JS (Dashboard)
// ============================================

const API_BASE = '';

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

// ---- Check authentication ----
(function checkAuth() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }
  const name = localStorage.getItem('userName');
  document.getElementById('user-name-display').innerHTML = `Welcome, <span class="gradient-text">${name || 'User'}</span>`;
  loadWishlists();
  loadGlobalStats();
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

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ============================================
// WISHLIST OPERATIONS
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
  } catch (err) {
    showToast('Failed to load wishlists', 'error');
  }
}

async function loadGlobalStats() {
  try {
    const res = await fetch(`${API_BASE}/api/items/stats/global`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load stats');

    const stats = await res.json();
    document.getElementById('stats-total-value').textContent = `₹${stats.totalValue.toLocaleString('en-IN')}`;
    document.getElementById('stats-total-items').textContent = stats.totalItems;
    document.getElementById('stats-total-reserved').textContent = stats.totalReserved;
  } catch (err) {
    console.error('Error loading global stats:', err);
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
        <a href="/wishlist.html?id=${wl._id}" class="btn btn-primary btn-sm">View Items <i data-lucide="arrow-right" class="icon-sm"></i></a>
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
  if (!confirm('Delete this wishlist and all its items?')) return;

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
    prompt('Copy this link:', link);
  });
}

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

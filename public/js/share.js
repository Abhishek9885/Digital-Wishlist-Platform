// ============================================
// Digital Wishlist Platform — Share Page JS
// ============================================

const API_BASE = '';

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

// ---- Get share token from URL ----
function getShareToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

// ---- Init ----
(async function init() {
  const token = getShareToken();

  if (!token) {
    showError('Invalid Link', 'No share token was provided in the URL.');
    return;
  }

  try {
    // Fetch wishlist info
    const wlRes = await fetch(`${API_BASE}/api/wishlists/share/${token}`);
    if (!wlRes.ok) {
      const data = await wlRes.json();
      showError(
        wlRes.status === 403 ? 'Private Wishlist' : 'Not Found',
        data.message || 'Could not load this wishlist.'
      );
      return;
    }

    const wishlist = await wlRes.json();

    // Fetch items
    const itemsRes = await fetch(`${API_BASE}/api/items/share/${token}`);
    const items = itemsRes.ok ? await itemsRes.json() : [];

    // Render
    renderSharePage(wishlist, items);
  } catch (err) {
    showError('Error', 'Something went wrong loading this wishlist.');
  }
})();

function showError(title, message) {
  document.getElementById('share-loader').classList.add('hidden');
  document.getElementById('share-error').classList.remove('hidden');
  document.getElementById('share-error-title').textContent = title;
  document.getElementById('share-error-msg').textContent = message;
}

function renderSharePage(wishlist, items) {
  document.getElementById('share-loader').classList.add('hidden');
  document.getElementById('share-content').classList.remove('hidden');

  document.getElementById('share-title').textContent = wishlist.title;
  document.getElementById('share-description').textContent = wishlist.description || '';
  document.getElementById('share-owner').textContent = wishlist.user?.name || 'Someone';

  // Update page title
  document.title = `${wishlist.title} — Shared Wishlist`;

  if (items.length === 0) {
    document.getElementById('share-items-empty').classList.remove('hidden');
    return;
  }

  renderItems(items);
}

function renderItems(items) {
  const list = document.getElementById('share-items-list');

  list.innerHTML = items.map((item, index) => `
    <div class="item-card animate-fade-in-up ${item.isReserved ? 'reserved' : ''}" style="animation-delay: ${index * 0.05}s" id="share-item-${item._id}">
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
        ${item.isReserved
          ? `<button class="btn btn-danger btn-sm" onclick="unreserveItem('${item._id}')">Unreserve</button>`
          : `<div class="reserve-form">
              <input type="text" id="reserve-name-${item._id}" placeholder="Your name" maxlength="50">
              <button class="btn btn-success btn-sm" onclick="reserveItem('${item._id}')">Reserve</button>
            </div>`
        }
      </div>
    </div>
  `).join('');

  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 0);
  }
}

async function reserveItem(itemId) {
  const nameInput = document.getElementById(`reserve-name-${itemId}`);
  const reservedBy = nameInput ? nameInput.value.trim() : '';

  if (!reservedBy) {
    return showToast('Please enter your name to reserve this item', 'error');
  }

  try {
    const res = await fetch(`${API_BASE}/api/items/${itemId}/reserve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservedBy })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to reserve item');
    }

    showToast(`Item reserved by ${reservedBy}!`, 'success');
    refreshItems();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function unreserveItem(itemId) {
  if (!confirm('Remove your reservation for this item?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/items/${itemId}/unreserve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to unreserve item');
    }

    showToast('Reservation removed', 'success');
    refreshItems();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function refreshItems() {
  const token = getShareToken();
  try {
    const res = await fetch(`${API_BASE}/api/items/share/${token}`);
    if (res.ok) {
      const items = await res.json();
      renderItems(items);
    }
  } catch (err) {
    // Silent fail
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

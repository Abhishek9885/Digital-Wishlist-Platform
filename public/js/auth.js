// ============================================
// Digital Wishlist Platform — Auth JS
// ============================================

const API_BASE = '';

// ---- Toast Notifications ----
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---- Check if already logged in ----
(function checkAuth() {
  const token = localStorage.getItem('token');
  const path = window.location.pathname;
  
  // If logged in and on login/register page, go to dashboard
  if (token && (path === '/login.html' || path === '/register.html')) {
    window.location.href = '/dashboard.html';
  }
})();

// ---- Handle Login ----
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit-btn');

  if (!email || !password) {
    return showToast('Please fill in all fields', 'error');
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging in...';

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    // Store token and user info
    localStorage.setItem('token', data.token);
    localStorage.setItem('userName', data.name);
    localStorage.setItem('userId', data._id);

    showToast('Login successful!', 'success');
    setTimeout(() => window.location.href = '/dashboard.html', 500);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
}

// ---- Handle Register ----
async function handleRegister(event) {
  event.preventDefault();

  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const btn = document.getElementById('register-submit-btn');

  if (!name || !email || !password) {
    return showToast('Please fill in all fields', 'error');
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating account...';

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    // Store token and user info
    localStorage.setItem('token', data.token);
    localStorage.setItem('userName', data.name);
    localStorage.setItem('userId', data._id);

    showToast('Account created successfully!', 'success');
    setTimeout(() => window.location.href = '/dashboard.html', 500);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

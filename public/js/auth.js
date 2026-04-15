// ============================================
// Digital Wishlist Platform — Auth JS
// ============================================

const API_BASE = '';

// ---- Toast Notifications ----
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
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
  if (token) {
    window.location.href = '/dashboard.html';
  }
})();

// ---- Tab Switching ----
function switchTab(tab) {
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (tab === 'login') {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

// ---- Show Auth Section ----
function showAuthSection(tab) {
  document.getElementById('hero-section').classList.add('hidden');
  document.getElementById('auth-section').classList.remove('hidden');
  switchTab(tab);
}

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

  // Client-side validation
  if (!name || !email || !password) {
    return showToast('Please fill in all fields', 'error');
  }

  if (name.length > 50) {
    return showToast('Name must be 50 characters or less', 'error');
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return showToast('Please enter a valid email', 'error');
  }

  if (password.length < 6) {
    return showToast('Password must be at least 6 characters', 'error');
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

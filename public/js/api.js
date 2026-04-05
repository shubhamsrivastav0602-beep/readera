// API Base URL
const API_BASE = '/api';

async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const err = new Error(data.error || data.message || 'Request failed');
        err.status = response.status;
        err.body = data;
        throw err;
    }

    return data;
}

const CartService = {
    getCart: () => JSON.parse(localStorage.getItem('cart') || '[]'),

    addToCart: (book) => {
        const cart = CartService.getCart();
        if (!cart.find((item) => item.id === book.id)) {
            cart.push(book);
            localStorage.setItem('cart', JSON.stringify(cart));
            CartService.updateCartCount();
            showToast('Added to cart!');
            return true;
        }
        showToast('Book already in cart', 'error');
        return false;
    },

    removeFromCart: (bookId) => {
        const cart = CartService.getCart().filter((item) => item.id !== bookId);
        localStorage.setItem('cart', JSON.stringify(cart));
        CartService.updateCartCount();
        showToast('Removed from cart');
    },

    clearCart: () => {
        localStorage.removeItem('cart');
        CartService.updateCartCount();
    },

    updateCartCount: () => {
        const countEl = document.getElementById('cart-count');
        if (countEl) {
            countEl.textContent = CartService.getCart().length;
        }
    },
};

const AuthService = {
    isAuthenticated: () => !!localStorage.getItem('token'),

    getUser: () => {
        const raw = localStorage.getItem('user');
        if (raw) {
            try {
                return JSON.parse(raw);
            } catch {
                return null;
            }
        }
        const name = localStorage.getItem('userName');
        const email = localStorage.getItem('userEmail');
        if (name || email) {
            return { name, email, phone: localStorage.getItem('userPhone') || null };
        }
        return null;
    },

    setSession: (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        if (user.name) localStorage.setItem('userName', user.name);
        if (user.email) localStorage.setItem('userEmail', user.email);
        if (user.phone) localStorage.setItem('userPhone', user.phone);
        else localStorage.removeItem('userPhone');
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userPhone');
        window.location.href = '/index.html';
    },

    refreshNav: () => {
        document.querySelectorAll('.user-only').forEach((el) => {
            el.style.display = AuthService.isAuthenticated() ? '' : 'none';
        });
        document.querySelectorAll('.guest-only').forEach((el) => {
            el.style.display = AuthService.isAuthenticated() ? 'none' : '';
        });
        const u = AuthService.getUser();
        const navName = document.getElementById('nav-username');
        if (navName && u && u.name) navName.textContent = u.name;
    },
};

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        if (container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    CartService.updateCartCount();
    AuthService.refreshNav();
});

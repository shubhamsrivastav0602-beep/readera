// API Base URL
const API_BASE = '/api';

// Fetch helper
async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        throw new Error('Request failed');
    }

    return response.json();
}

// Cart Service
const CartService = {
    getCart: () => JSON.parse(localStorage.getItem('cart') || '[]'),

    addToCart: (book) => {
        const cart = CartService.getCart();
        if (!cart.find(item => item.id === book.id)) {
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
        const cart = CartService.getCart().filter(item => item.id !== bookId);
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
    }
};

// Auth Service
const AuthService = {
    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    },

    getUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    }
};

// Toast notification
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

// Initialize cart count on page load
document.addEventListener('DOMContentLoaded', () => {
    CartService.updateCartCount();
});
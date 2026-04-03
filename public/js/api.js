// Centralized configuration and state
const API_BASE = '/api';

// Utility for fetching data with auth headers
async function fetchAPI(endpoint, options = {}) {
    showLoader();
    const token = localStorage.getItem('token');
    
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    if (options.body && !(options.body instanceof FormData)) {
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json'
        };
        options.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Something went wrong');
        }
        
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    } finally {
        hideLoader();
    }
}

// Authentication Service
const AuthService = {
    login: async (email, password) => {
        const data = await fetchAPI('/auth/login', {
            method: 'POST',
            body: { email, password }
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    },
    
    register: async (name, email, password) => {
        const data = await fetchAPI('/auth/register', {
            method: 'POST',
            body: { name, email, password }
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    },

    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    },

    getUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }
};

// Global UI Utilities
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
        if(container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 3000);
}

function showLoader() {
    const loader = document.getElementById('global-loader');
    if(loader) loader.style.display = 'block';
}

function hideLoader() {
    const loader = document.getElementById('global-loader');
    if(loader) loader.style.display = 'none';
}

// Nav UI updates based on Auth State
document.addEventListener('DOMContentLoaded', () => {
    const isAuth = AuthService.isAuthenticated();
    const user = AuthService.getUser();
    
    document.querySelectorAll('.user-only').forEach(el => {
        el.style.display = isAuth ? 'inline-block' : 'none';
    });
    
    document.querySelectorAll('.guest-only').forEach(el => {
        el.style.display = isAuth ? 'none' : 'inline-block';
    });
    
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = (isAuth && user && user.is_admin) ? 'inline-block' : 'none';
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            AuthService.logout();
        });
    }

    const navUsername = document.getElementById('nav-username');
    if (navUsername && user) {
        navUsername.textContent = user.name;
    }
});

// Shopping Cart Utility (localStorage based before placing order)
const CartService = {
    getCart: () => JSON.parse(localStorage.getItem('cart')) || [],
    
    addToCart: (book) => {
        const cart = CartService.getCart();
        if(!cart.find(item => item.id === book.id)) {
            cart.push(book);
            localStorage.setItem('cart', JSON.stringify(cart));
            showToast('Added to cart!');
            CartService.updateCartCount();
        } else {
            showToast('Book is already in cart', 'error');
        }
    },
    
    removeFromCart: (bookId) => {
        const cart = CartService.getCart().filter(item => item.id !== bookId);
        localStorage.setItem('cart', JSON.stringify(cart));
        CartService.updateCartCount();
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

// Initialize cart count
document.addEventListener('DOMContentLoaded', CartService.updateCartCount);

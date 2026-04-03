// ✅ No API calls — direct static JSON file
const API_BASE = '';

// Fetch books from static JSON file
async function fetchBooks() {
    try {
        const response = await fetch('/books.json');
        if (!response.ok) {
            throw new Error('Failed to load books');
        }
        const books = await response.json();
        return books;
    } catch (error) {
        console.error('Error loading books:', error);
        return [];
    }
}

// Cart Service (localStorage)
const CartService = {
    getCart: () => JSON.parse(localStorage.getItem('cart') || '[]'),

    addToCart: (book) => {
        const cart = CartService.getCart();
        if (!cart.find(item => item.id === book.id)) {
            cart.push(book);
            localStorage.setItem('cart', JSON.stringify(cart));
            showToast('Added to cart!');
            CartService.updateCartCount();
        } else {
            showToast('Book already in cart', 'error');
        }
    },

    removeFromCart: (bookId) => {
        const cart = CartService.getCart().filter(item => item.id !== bookId);
        localStorage.setItem('cart', JSON.stringify(cart));
        CartService.updateCartCount();
    },

    updateCartCount: () => {
        const countEl = document.getElementById('cart-count');
        if (countEl) {
            countEl.textContent = CartService.getCart().length;
        }
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
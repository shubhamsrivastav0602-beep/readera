// Global scripts for Readera
console.log('Readera eBook Platform Initialized');

// Shared UI utilities
const UI = {
    toggleMobileNav: () => {
        const nav = document.querySelector('.nav-links');
        if (nav) {
            nav.classList.toggle('active');
        }
    }
};

// Listen for global events
document.addEventListener('DOMContentLoaded', () => {
    // Add any global initialization logic here
    console.log('Welcome to Readera!');
});

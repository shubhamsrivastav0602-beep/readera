// Global scripts for Readera
console.log('Readera eBook Platform Initialized');

const Theme = {
    storageKey: 'readeraTheme',

    getStoredTheme() {
        return localStorage.getItem(this.storageKey);
    },

    getDefaultTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    },

    getCurrentTheme() {
        return document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    },

    apply(theme) {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        localStorage.setItem(this.storageKey, theme);
        this.updateButtons(theme);
    },

    toggle() {
        const nextTheme = this.getCurrentTheme() === 'dark' ? 'light' : 'dark';
        this.apply(nextTheme);
    },

    updateButtons(theme) {
        document.querySelectorAll('.theme-toggle').forEach(button => {
            button.textContent = theme === 'dark' ? '☀️' : '🌙';
            button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        });
    },

    injectFloatingToggle() {
        if (document.querySelector('.floating-theme-toggle')) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'floating-theme-toggle theme-toggle';
        
        Object.assign(button.style, {
            position: 'fixed',
            bottom: '25px',
            left: '25px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-color, #2b3a55)',
            color: '#fff',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '9999',
            transition: 'transform 0.2s, background-color 0.2s',
            padding: '0'
        });

        button.onmouseover = () => button.style.transform = 'scale(1.1)';
        button.onmouseout = () => button.style.transform = 'scale(1)';

        button.addEventListener('click', () => this.toggle());
        document.body.appendChild(button);

        this.updateButtons(this.getCurrentTheme());
    },

    init() {
        const stored = this.getStoredTheme();
        this.apply(stored || this.getDefaultTheme());
        this.injectFloatingToggle();
    }
};

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
    Theme.init();
    console.log('Welcome to Readera!');
});

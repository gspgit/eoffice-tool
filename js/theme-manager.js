class ThemeManager {
    constructor() {
        this.theme = 'light';
        this.selectors = {
            themeToggle: '[data-theme-toggle]',
            themeStyle: '#theme-styles'
        };
        this.cssVariables = {
            light: {
                '--primary-color': '#2c3e50',
                '--background-color': '#ffffff',
                '--surface-color': '#f8f9fa',
                '--text-color': '#212529',
                '--border-color': '#dee2e6',
                '--hover-color': '#e9ecef'
            },
            dark: {
                '--primary-color': '#3498db',
                '--background-color': '#1a1a1a',
                '--surface-color': '#2d2d2d',
                '--text-color': '#f8f9fa',
                '--border-color': '#495057',
                '--hover-color': '#343a40'
            }
        };
        this.init();
    }

    init() {
        this.loadSavedTheme();
        this.initEventListeners();
        this.injectStyleElement();
        this.applyTheme(this.theme);
    }

    loadSavedTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        this.theme = savedTheme || (systemDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', this.theme);
    }

    initEventListeners() {
        // Theme toggle button
        document.querySelector(this.selectors.themeToggle)?.addEventListener('click', () => 
            this.toggleTheme()
        );

        // System preference changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('theme')) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    injectStyleElement() {
        if (!document.querySelector(this.selectors.themeStyle)) {
            const style = document.createElement('style');
            style.id = 'theme-styles';
            document.head.appendChild(style);
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.theme);
        this.saveTheme();
    }

    applyTheme(theme) {
        // Update data attribute
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update CSS variables
        const variables = this.cssVariables[theme];
        const root = document.documentElement;
        
        Object.entries(variables).forEach(([name, value]) => {
            root.style.setProperty(name, value);
        });

        // Update toggle button
        this.updateToggleButton(theme);
    }

    updateToggleButton(theme) {
        const toggleBtn = document.querySelector(this.selectors.themeToggle);
        if (!toggleBtn) return;

        const icon = toggleBtn.querySelector('i');
        const label = toggleBtn.querySelector('.label');
        
        if (theme === 'dark') {
            icon?.classList.replace('fa-moon', 'fa-sun');
            label && (label.textContent = 'Light Mode');
        } else {
            icon?.classList.replace('fa-sun', 'fa-moon');
            label && (label.textContent = 'Dark Mode');
        }
    }

    saveTheme() {
        localStorage.setItem('theme', this.theme);
    }

    // Public API
    static autoInit() {
        const themeManager = new ThemeManager();
        window.themeManager = themeManager;
        return themeManager;
    }
}

// Initialize automatically when loaded
ThemeManager.autoInit();
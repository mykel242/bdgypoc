/**
 * App State Manager
 * Manages the document-based application state (welcome vs document view)
 */

const AppStateManager = {
    // Constants
    METADATA_KEY: 'expense_tracker_metadata',
    SESSION_KEY: 'expense_tracker_session',
    
    // Current state
    currentState: 'welcome', // 'welcome' or 'document'
    currentLedger: null,
    metadata: null,

    /**
     * Initialize the app state manager
     */
    init() {
        console.log('Initializing App State Manager');
        
        // Load or create metadata
        this.loadMetadata();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check for auto-open ledger (for backward compatibility)
        const session = this.getSession();
        if (session && session.currentLedger) {
            // Auto-open last ledger for now (can be disabled later)
            this.openLedger(session.currentLedger);
        } else {
            // Show welcome screen
            this.showWelcomeScreen();
        }
        
        // Update recent ledgers display
        this.updateRecentLedgers();
    },

    /**
     * Load or create metadata
     */
    loadMetadata() {
        const stored = localStorage.getItem(this.METADATA_KEY);
        if (stored) {
            this.metadata = JSON.parse(stored);
        } else {
            // Create initial metadata structure
            this.metadata = {
                ledgers: [],
                recentFiles: []
            };
            
            // Migrate existing ledgers
            this.migrateExistingLedgers();
        }
    },

    /**
     * Migrate existing ledgers to new metadata structure
     */
    migrateExistingLedgers() {
        console.log('Migrating existing ledgers to metadata');
        
        const ledgers = window.TransactionManager?.getLedgers() || [];
        
        ledgers.forEach(name => {
            const transactions = window.TransactionManager?.getTransactions(name) || [];
            const startingBalance = window.TransactionManager?.getStartingBalance(name) || 0;
            
            // Calculate totals
            let totalDebits = 0;
            let totalCredits = 0;
            transactions.forEach(t => {
                totalDebits += t.debit || 0;
                totalCredits += t.credit || 0;
            });
            
            this.metadata.ledgers.push({
                name: name,
                lastModified: new Date().toISOString(),
                lastOpened: new Date().toISOString(),
                transactionCount: transactions.length,
                totalDebits: totalDebits,
                totalCredits: totalCredits,
                currentBalance: startingBalance + totalCredits - totalDebits,
                isNetworkFile: false,
                networkPath: null,
                isPinned: false
            });
        });
        
        this.saveMetadata();
    },

    /**
     * Save metadata to localStorage
     */
    saveMetadata() {
        localStorage.setItem(this.METADATA_KEY, JSON.stringify(this.metadata));
    },

    /**
     * Get current session
     */
    getSession() {
        const stored = localStorage.getItem(this.SESSION_KEY);
        return stored ? JSON.parse(stored) : null;
    },

    /**
     * Save session
     */
    saveSession() {
        const session = {
            currentLedger: this.currentLedger,
            lastActivity: new Date().toISOString()
        };
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('close-ledger-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeLedger());
        }
        
        // Menu close option
        const closeMenuBtn = document.getElementById('close-ledger-menu-btn');
        if (closeMenuBtn) {
            closeMenuBtn.addEventListener('click', () => this.closeLedger());
        }
        
        // Welcome screen buttons
        const welcomeNewBtn = document.getElementById('welcome-new-btn');
        if (welcomeNewBtn) {
            welcomeNewBtn.addEventListener('click', () => {
                document.getElementById('new-ledger-btn').click();
            });
        }
        
        const welcomeOpenBtn = document.getElementById('welcome-open-network-btn');
        if (welcomeOpenBtn) {
            welcomeOpenBtn.addEventListener('click', () => {
                document.getElementById('open-network-btn').click();
            });
        }
        
        const welcomeImportBtn = document.getElementById('welcome-import-btn');
        if (welcomeImportBtn) {
            welcomeImportBtn.addEventListener('click', () => {
                document.getElementById('import-ledger-btn').click();
            });
        }
        
        const welcomeBrowseBtn = document.getElementById('welcome-browse-all-btn');
        if (welcomeBrowseBtn) {
            welcomeBrowseBtn.addEventListener('click', () => this.showAllLedgers());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + W to close
            if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
                e.preventDefault();
                this.closeLedger();
            }
        });
    },

    /**
     * Show welcome screen
     */
    showWelcomeScreen() {
        console.log('Showing welcome screen');
        
        this.currentState = 'welcome';
        this.currentLedger = null;
        
        // Update body class
        document.body.classList.remove('document-state');
        document.body.classList.add('welcome-state');
        
        // Show/hide elements
        const welcomeScreen = document.getElementById('welcome-screen');
        const ledgerView = document.getElementById('ledger-view');
        
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        if (ledgerView) ledgerView.classList.add('hidden');
        
        // Hide ledger-specific header elements
        document.getElementById('ledger-title-separator')?.classList.add('hidden');
        document.getElementById('ledger-name-container')?.classList.add('hidden');
        document.getElementById('close-ledger-btn')?.classList.add('hidden');
        
        // Update session
        this.saveSession();
        
        // Update recent ledgers
        this.updateRecentLedgers();
    },

    /**
     * Open a ledger
     */
    openLedger(ledgerName) {
        console.log('Opening ledger:', ledgerName);
        
        // Set active ledger in TransactionManager
        if (window.TransactionManager) {
            window.TransactionManager.setActiveLedger(ledgerName);
        }
        
        this.currentState = 'document';
        this.currentLedger = ledgerName;
        
        // Update body class
        document.body.classList.remove('welcome-state');
        document.body.classList.add('document-state');
        
        // Show/hide elements
        const welcomeScreen = document.getElementById('welcome-screen');
        const ledgerView = document.getElementById('ledger-view');
        
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (ledgerView) ledgerView.classList.remove('hidden');
        
        // Show ledger-specific header elements
        document.getElementById('ledger-title-separator')?.classList.remove('hidden');
        document.getElementById('ledger-name-container')?.classList.remove('hidden');
        document.getElementById('close-ledger-btn')?.classList.remove('hidden');
        
        // Update metadata
        this.updateLedgerMetadata(ledgerName, { lastOpened: new Date().toISOString() });
        
        // Update session
        this.saveSession();
        
        // Load ledger data
        if (window.LedgerController) {
            window.LedgerController.loadLedger();
        }
        
        // Update selector
        if (window.LedgerManager) {
            window.LedgerManager.updateLedgerSelector();
        }
    },

    /**
     * Close current ledger
     */
    closeLedger() {
        console.log('Closing ledger:', this.currentLedger);
        
        if (!this.currentLedger) return;
        
        // Update metadata before closing
        if (this.currentLedger) {
            this.updateCurrentLedgerMetadata();
        }
        
        // Clear current ledger
        this.currentLedger = null;
        
        // Show welcome screen
        this.showWelcomeScreen();
    },

    /**
     * Update metadata for a specific ledger
     */
    updateLedgerMetadata(ledgerName, updates) {
        if (!this.metadata) return;
        
        let ledgerMeta = this.metadata.ledgers.find(l => l.name === ledgerName);
        
        if (!ledgerMeta) {
            // Create new metadata entry
            ledgerMeta = {
                name: ledgerName,
                lastModified: new Date().toISOString(),
                lastOpened: new Date().toISOString(),
                transactionCount: 0,
                totalDebits: 0,
                totalCredits: 0,
                currentBalance: 0,
                isNetworkFile: false,
                networkPath: null,
                isPinned: false
            };
            this.metadata.ledgers.push(ledgerMeta);
        }
        
        // Apply updates
        Object.assign(ledgerMeta, updates);
        
        this.saveMetadata();
    },

    /**
     * Update current ledger metadata with latest data
     */
    updateCurrentLedgerMetadata() {
        if (!this.currentLedger || !window.TransactionManager) return;
        
        const transactions = window.TransactionManager.getTransactions(this.currentLedger) || [];
        const startingBalance = window.TransactionManager.getStartingBalance(this.currentLedger) || 0;
        
        // Calculate totals
        let totalDebits = 0;
        let totalCredits = 0;
        transactions.forEach(t => {
            totalDebits += t.debit || 0;
            totalCredits += t.credit || 0;
        });
        
        this.updateLedgerMetadata(this.currentLedger, {
            lastModified: new Date().toISOString(),
            transactionCount: transactions.length,
            totalDebits: totalDebits,
            totalCredits: totalCredits,
            currentBalance: startingBalance + totalCredits - totalDebits
        });
    },

    /**
     * Update recent ledgers display
     */
    updateRecentLedgers() {
        const listContainer = document.getElementById('recent-ledgers-list');
        const noLedgersMsg = document.getElementById('no-ledgers-message');
        
        if (!listContainer) return;
        
        // Get all ledgers sorted by last opened
        const ledgers = [...(this.metadata?.ledgers || [])]
            .sort((a, b) => new Date(b.lastOpened) - new Date(a.lastOpened))
            .slice(0, 10); // Show top 10
        
        if (ledgers.length === 0) {
            listContainer.innerHTML = '';
            if (noLedgersMsg) noLedgersMsg.classList.remove('hidden');
            return;
        }
        
        if (noLedgersMsg) noLedgersMsg.classList.add('hidden');
        
        // Build HTML
        listContainer.innerHTML = ledgers.map(ledger => {
            const balanceClass = ledger.currentBalance >= 0 ? 'positive' : 'negative';
            const balance = Math.abs(ledger.currentBalance).toFixed(2);
            const lastModified = this.formatRelativeTime(ledger.lastModified);
            
            return `
                <div class="recent-ledger-item" data-ledger="${ledger.name}">
                    <div class="recent-ledger-info">
                        <div class="recent-ledger-name">${ledger.name}</div>
                        <div class="recent-ledger-meta">
                            <span>📅 ${lastModified}</span>
                            <span>📝 ${ledger.transactionCount} transactions</span>
                        </div>
                    </div>
                    <div class="recent-ledger-balance ${balanceClass}">
                        ${ledger.currentBalance >= 0 ? '+' : '-'}$${balance}
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        listContainer.querySelectorAll('.recent-ledger-item').forEach(item => {
            item.addEventListener('click', () => {
                const ledgerName = item.dataset.ledger;
                this.openLedger(ledgerName);
            });
        });
    },

    /**
     * Format relative time
     */
    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    },

    /**
     * Show all ledgers browser
     */
    showAllLedgers() {
        // TODO: Implement full ledger browser
        console.log('Show all ledgers browser');
        alert('Ledger browser coming soon! For now, use the recent ledgers list.');
    },

    /**
     * Check if a ledger is open
     */
    isLedgerOpen() {
        return this.currentState === 'document' && this.currentLedger !== null;
    },

    /**
     * Get current ledger name
     */
    getCurrentLedger() {
        return this.currentLedger;
    }
};

// Export for use
window.AppStateManager = AppStateManager;
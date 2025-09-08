/**
 * App State Manager - Simplified for File-System Architecture
 * Manages document-based application state transitions only
 * File operations and metadata handled by FileManager/RegistryManager
 */

const AppStateManager = {
    // Current state
    currentState: 'welcome', // 'welcome' or 'document'
    currentLedgerData: null,

    /**
     * Initialize the app state manager
     */
    init() {
        console.log('Initializing App State Manager (File-System Architecture)');
        
        // Initialize new file-system components
        if (window.FileManager) FileManager.init();
        if (window.RegistryManager) RegistryManager.init();
        if (window.ChangelogManager) ChangelogManager.init();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Clear any current sessions
        this.clearCurrentSession();
        
        // Always show welcome screen by default
        this.showWelcomeScreen();
    },

    /**
     * Clear current session
     */
    clearCurrentSession() {
        if (window.FileManager) FileManager.clearCurrentSession();
        if (window.ChangelogManager) ChangelogManager.clearSession();
        
        this.currentLedgerData = null;
        this.currentState = 'welcome';
        console.log('Cleared current sessions');
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
            welcomeNewBtn.addEventListener('click', () => this.createNewLedger());
        }
        
        const welcomeOpenBtn = document.getElementById('welcome-open-network-btn');
        if (welcomeOpenBtn) {
            welcomeOpenBtn.addEventListener('click', () => this.openFromFileSystem());
        }
        
        const welcomeImportBtn = document.getElementById('welcome-import-btn');
        if (welcomeImportBtn) {
            welcomeImportBtn.addEventListener('click', () => this.importBase64Ledger());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + W to close ledger
            if ((e.metaKey || e.ctrlKey) && e.key === 'w' && this.currentState === 'document') {
                e.preventDefault();
                this.closeLedger();
            }
            
            // Cmd/Ctrl + S to save current ledger
            if ((e.metaKey || e.ctrlKey) && e.key === 's' && this.currentState === 'document') {
                e.preventDefault();
                this.saveLedger();
            }
            
            // Cmd/Ctrl + Z for undo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && this.currentState === 'document') {
                e.preventDefault();
                this.undo();
            }
            
            // Cmd/Ctrl + Y for redo
            if ((e.metaKey || e.ctrlKey) && e.key === 'y' && this.currentState === 'document') {
                e.preventDefault();
                this.redo();
            }
        });
    },

    /**
     * Show welcome screen
     */
    showWelcomeScreen() {
        console.log('Showing welcome screen');
        
        this.currentState = 'welcome';
        this.currentLedgerData = null;
        
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
        document.getElementById('current-ledger-name')?.classList.add('hidden');
        document.getElementById('close-ledger-btn')?.classList.add('hidden');
        
        // Update recent ledgers from registry
        this.updateRecentLedgers();
    },

    /**
     * Show document view with ledger data
     * @param {object} ledgerData - Complete ledger data from FileManager
     */
    showDocumentView(ledgerData) {
        console.log('Showing document view for:', ledgerData.metadata.title);
        
        this.currentState = 'document';
        this.currentLedgerData = ledgerData;
        
        // Load changelog for this ledger
        if (window.ChangelogManager) {
            ChangelogManager.loadChangelog(ledgerData.fileId);
        }
        
        // Update registry with access time
        if (window.RegistryManager) {
            RegistryManager.updateLastAccessed(ledgerData.fileId);
        }
        
        // Update body class
        document.body.classList.remove('welcome-state');
        document.body.classList.add('document-state');
        
        // Show/hide elements
        const welcomeScreen = document.getElementById('welcome-screen');
        const ledgerView = document.getElementById('ledger-view');
        
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (ledgerView) ledgerView.classList.remove('hidden');
        
        // Show ledger-specific header elements
        const separator = document.getElementById('ledger-title-separator');
        const ledgerNameSpan = document.getElementById('current-ledger-name');
        const closeBtn = document.getElementById('close-ledger-btn');
        
        if (separator) separator.classList.remove('hidden');
        if (ledgerNameSpan) {
            ledgerNameSpan.textContent = ledgerData.metadata.title;
            ledgerNameSpan.classList.remove('hidden');
        }
        if (closeBtn) closeBtn.classList.remove('hidden');
        
        // Render ledger data
        this.renderLedgerData(ledgerData);
        
        console.log('Document view ready');
    },
    
    /**
     * Open ledger from registry entry
     * @param {object} registryEntry - Registry entry with fileId and filePath
     */
    async openLedgerFromRegistry(registryEntry) {
        try {
            console.log('Opening ledger from registry:', registryEntry.title);
            
            // For now, we'll need to integrate with the existing system
            // This is a bridge until we fully migrate
            if (window.TransactionManager) {
                const ledgers = window.TransactionManager.getLedgers() || [];
                if (ledgers.includes(registryEntry.title)) {
                    window.TransactionManager.setActiveLedger(registryEntry.title);
                    
                    // Create fake ledger data structure for compatibility
                    const fakeData = {
                        fileId: registryEntry.fileId,
                        metadata: {
                            title: registryEntry.title
                        }
                    };
                    
                    this.showDocumentView(fakeData);
                    
                    // Render using existing system
                    setTimeout(() => {
                        if (window.LedgerController && window.LedgerController.renderLedger) {
                            window.LedgerController.renderLedger();
                        }
                    }, 100);
                }
            }
        } catch (error) {
            console.error('Error opening ledger from registry:', error);
            alert('Error opening ledger: ' + error.message);
        }
    },

    /**
     * Close current ledger
     */
    closeLedger() {
        console.log('Closing current ledger');
        
        if (this.currentState !== 'document') return;
        
        // Save current ledger if there are unsaved changes
        this.promptSaveIfNeeded();
        
        // Clear current session
        this.clearCurrentSession();
        
        // Return to welcome screen
        this.showWelcomeScreen();
    },

    /**
     * Render ledger data to the UI
     * @param {object} ledgerData - Complete ledger data
     */
    renderLedgerData(ledgerData) {
        // This would integrate with LedgerRenderer/LedgerController
        // For now, use existing system as bridge
        setTimeout(() => {
            if (window.LedgerController) {
                const ledgerBody = document.querySelector('#ledger tbody');
                if (ledgerBody && window.LedgerController.renderLedger) {
                    window.LedgerController.renderLedger();
                }
            }
        }, 100);
    },
    
    /**
     * Save current ledger
     */
    async saveLedger() {
        if (!this.currentLedgerData || !window.FileManager) {
            console.warn('No ledger to save or FileManager not available');
            return;
        }
        
        try {
            const filePath = await FileManager.saveCurrentLedger();
            if (filePath) {
                console.log('Ledger saved to:', filePath);
                // Update registry if needed
                if (window.RegistryManager) {
                    const summary = RegistryManager.calculateSummary(this.currentLedgerData);
                    RegistryManager.updateSummary(this.currentLedgerData.fileId, summary);
                }
            }
        } catch (error) {
            console.error('Error saving ledger:', error);
            alert('Error saving ledger: ' + error.message);
        }
    },
    
    /**
     * Check if current ledger has unsaved changes
     */
    hasUnsavedChanges() {
        if (!window.ChangelogManager) return false;
        
        const stats = ChangelogManager.getStats();
        return stats.undoCount > 0;
    },
    
    /**
     * Prompt to save if there are unsaved changes
     */
    async promptSaveIfNeeded() {
        if (this.hasUnsavedChanges()) {
            const save = confirm('You have unsaved changes. Save before closing?');
            if (save) {
                await this.saveLedger();
            }
        }
    },
    
    /**
     * Undo last action
     */
    async undo() {
        if (!window.ChangelogManager) return;
        
        try {
            const undoneCommand = await ChangelogManager.undo();
            if (undoneCommand) {
                console.log('Undid:', undoneCommand.description);
                // Refresh UI
                this.refreshLedgerView();
            }
        } catch (error) {
            console.error('Error undoing:', error);
        }
    },
    
    /**
     * Redo last undone action
     */
    async redo() {
        if (!window.ChangelogManager) return;
        
        try {
            const redoneCommand = await ChangelogManager.redo();
            if (redoneCommand) {
                console.log('Redid:', redoneCommand.description);
                // Refresh UI
                this.refreshLedgerView();
            }
        } catch (error) {
            console.error('Error redoing:', error);
        }
    },
    
    /**
     * Refresh ledger view after undo/redo operations
     */
    refreshLedgerView() {
        if (this.currentState === 'document' && window.LedgerController) {
            setTimeout(() => {
                if (window.LedgerController.renderLedger) {
                    window.LedgerController.renderLedger();
                }
            }, 50);
        }
    },

    /**
     * Update recent ledgers display from registry
     */
    updateRecentLedgers() {
        const listContainer = document.getElementById('recent-ledgers-list');
        const noLedgersMsg = document.getElementById('no-ledgers-message');
        
        if (!listContainer) return;
        
        // Get recent ledgers from registry
        const recentLedgers = window.RegistryManager ? 
            RegistryManager.getRecentLedgers(10) : [];
        
        // Also get legacy ledgers from TransactionManager for transition period
        const legacyLedgers = this.getLegacyLedgers();
        
        // Combine and deduplicate
        const allLedgers = [...recentLedgers, ...legacyLedgers]
            .filter((ledger, index, self) => 
                index === self.findIndex(l => l.title === ledger.title)
            )
            .slice(0, 10);
        
        if (allLedgers.length === 0) {
            listContainer.innerHTML = '';
            if (noLedgersMsg) noLedgersMsg.classList.remove('hidden');
            return;
        }
        
        if (noLedgersMsg) noLedgersMsg.classList.add('hidden');
        
        // Build HTML
        listContainer.innerHTML = allLedgers.map(ledger => {
            const summary = ledger.summary || { currentBalance: 0, transactionCount: 0 };
            const balanceClass = summary.currentBalance >= 0 ? 'positive' : 'negative';
            const balance = Math.abs(summary.currentBalance).toFixed(2);
            const lastAccessed = this.formatRelativeTime(ledger.lastAccessed || ledger.lastOpened);
            
            return `
                <div class="recent-ledger-item" data-ledger="${ledger.title}" data-file-id="${ledger.fileId || ''}">
                    <div class="recent-ledger-info">
                        <div class="recent-ledger-name">${ledger.title}</div>
                        <div class="recent-ledger-meta">
                            <span>${lastAccessed}</span>
                            <span>${summary.transactionCount} transactions</span>
                        </div>
                    </div>
                    <div class="recent-ledger-balance ${balanceClass}">
                        ${summary.currentBalance >= 0 ? '+' : '-'}$${balance}
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        listContainer.querySelectorAll('.recent-ledger-item').forEach(item => {
            item.addEventListener('click', () => {
                const ledgerTitle = item.getAttribute('data-ledger');
                const fileId = item.getAttribute('data-file-id');
                
                if (fileId && window.RegistryManager) {
                    // Use new file-system approach
                    const registryEntry = RegistryManager.findLedger(fileId);
                    if (registryEntry) {
                        this.openLedgerFromRegistry(registryEntry);
                    }
                } else if (ledgerTitle) {
                    // Fallback to legacy approach
                    this.openLegacyLedger(ledgerTitle);
                }
            });
        });
    },
    
    /**
     * Get legacy ledgers for transition period
     */
    getLegacyLedgers() {
        if (!window.TransactionManager) return [];
        
        const ledgers = window.TransactionManager.getLedgers() || [];
        return ledgers.map(name => {
            // Calculate summary for legacy ledger
            const previousActive = window.TransactionManager.getActiveLedger();
            window.TransactionManager.setActiveLedger(name);
            
            const transactions = window.TransactionManager.getTransactions() || [];
            const startingBalance = window.TransactionManager.getStartingBalance() || 0;
            
            let totalDebits = 0, totalCredits = 0;
            transactions.forEach(t => {
                totalDebits += t.debit || 0;
                totalCredits += t.credit || 0;
            });
            
            const currentBalance = startingBalance + totalCredits - totalDebits;
            
            // Restore previous active ledger
            if (previousActive) {
                window.TransactionManager.setActiveLedger(previousActive);
            }
            
            return {
                title: name,
                fileId: null, // Legacy ledgers don't have file IDs yet
                lastAccessed: new Date().toISOString(),
                summary: {
                    transactionCount: transactions.length,
                    currentBalance: currentBalance
                }
            };
        });
    },
    
    /**
     * Open legacy ledger (bridge method)
     */
    openLegacyLedger(ledgerName) {
        if (window.TransactionManager) {
            window.TransactionManager.setActiveLedger(ledgerName);
            
            const fakeData = {
                fileId: 'legacy_' + ledgerName,
                metadata: { title: ledgerName }
            };
            
            this.showDocumentView(fakeData);
            
            setTimeout(() => {
                if (window.LedgerController && window.LedgerController.renderLedger) {
                    window.LedgerController.renderLedger();
                }
            }, 100);
        }
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
     * Check if a ledger is open
     */
    isLedgerOpen() {
        return this.currentState === 'document' && this.currentLedgerData !== null;
    },

    /**
     * Get current ledger data
     */
    getCurrentLedgerData() {
        return this.currentLedgerData;
    },

    /**
     * Create a new ledger using file-system approach
     */
    async createNewLedger() {
        const title = prompt(
            'Enter a title for the new ledger:',
            `Budget ${new Date().toLocaleDateString()}`
        );
        
        if (!title || !title.trim()) return;
        
        try {
            // Create ledger in memory using FileManager
            if (window.FileManager) {
                const ledgerData = FileManager.createLedger(title.trim());
                
                // Show document view immediately
                this.showDocumentView(ledgerData);
                
                // Prompt to save to file system
                setTimeout(async () => {
                    const filePath = await FileManager.saveCurrentLedger();
                    if (filePath) {
                        // Add to registry
                        if (window.RegistryManager) {
                            const summary = RegistryManager.calculateSummary(ledgerData);
                            RegistryManager.addLedger(
                                ledgerData.fileId,
                                ledgerData.metadata.title,
                                filePath,
                                summary
                            );
                        }
                        
                        console.log('New ledger created and saved');
                    } else {
                        // User cancelled save, close the ledger
                        this.closeLedger();
                    }
                }, 500);
            } else {
                // Fallback to legacy system
                const ledgers = window.TransactionManager?.getLedgers() || [];
                if (ledgers.includes(title)) {
                    alert(`A ledger named "${title}" already exists. Please choose a different name.`);
                    return;
                }
                
                if (window.TransactionManager) {
                    window.TransactionManager.createLedger(title);
                    this.openLegacyLedger(title);
                }
            }
        } catch (error) {
            console.error('Error creating new ledger:', error);
            alert('Error creating new ledger: ' + error.message);
        }
    },

    /**
     * Open ledger from file system
     */
    async openFromFileSystem() {
        if (!window.FileManager) {
            alert('FileManager not available');
            return;
        }
        
        try {
            const ledgerData = await FileManager.openLedger();
            if (ledgerData) {
                // Show document view
                this.showDocumentView(ledgerData);
                
                // Add/update registry entry
                if (window.RegistryManager) {
                    const summary = RegistryManager.calculateSummary(ledgerData);
                    RegistryManager.addLedger(
                        ledgerData.fileId,
                        ledgerData.metadata.title,
                        FileManager.getCurrentFilePath(),
                        summary
                    );
                }
                
                console.log('Opened ledger from file system');
            }
        } catch (error) {
            console.error('Error opening ledger:', error);
            alert('Error opening ledger: ' + error.message);
        }
    },

    /**
     * Import ledger from base64 file (legacy compatibility)
     */
    importBase64Ledger() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.txt';
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const base64Data = event.target.result;
                    
                    // Use legacy import for now
                    if (window.TransactionManager && window.TransactionManager.importLedgerData) {
                        const result = window.TransactionManager.importLedgerData(base64Data);
                        
                        if (result.success) {
                            this.updateRecentLedgers();
                            
                            if (result.ledgerName) {
                                this.openLegacyLedger(result.ledgerName);
                            }
                            
                            alert(result.message);
                        } else {
                            alert(result.message);
                        }
                    }
                } catch (error) {
                    console.error('Error importing file:', error);
                    alert('Error importing file: ' + error.message);
                }
            };
            
            reader.readAsText(file);
        });
        
        fileInput.click();
    }
};

// Export for use
window.AppStateManager = AppStateManager;
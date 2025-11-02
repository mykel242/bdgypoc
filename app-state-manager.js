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
        
        // Recent ledgers removed - pure file-based approach
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
     * Open ledger from registry entry with error handling
     * @param {object} registryEntry - Registry entry with fileId and filePath
     * @param {HTMLElement} itemElement - The clicked ledger item element
     */
    async openLedgerFromRegistry(registryEntry, itemElement) {
        try {
            console.log('Opening ledger from registry:', registryEntry.title);
            
            // First try to load from stored data
            let ledgerData = null;
            if (window.RegistryManager) {
                ledgerData = window.RegistryManager.getLedgerData(registryEntry.fileId);
            }
            
            if (ledgerData) {
                console.log('Loaded ledger from stored data');
                
                // Set in FileManager
                if (window.FileManager) {
                    window.FileManager.setCurrentLedger(ledgerData);
                }
                
                this.showDocumentView(ledgerData);
                
                setTimeout(() => {
                    if (window.LedgerController && window.LedgerController.renderLedger) {
                        window.LedgerController.renderLedger();
                    }
                    
                    // Update summary after viewing ledger
                    this.updateLedgerSummaryFromViewing(ledgerData.metadata.title);
                }, 100);
            } else {
                // No stored data, prompt user to open the .budgie file
                console.log('No stored data, prompting for file');
                if (window.FileManager) {
                    ledgerData = await window.FileManager.openLedger();
                    if (ledgerData) {
                        // Verify it matches the expected ledger
                        if (ledgerData.fileId !== registryEntry.fileId) {
                            const proceed = confirm(`The opened file appears to be a different ledger ("${ledgerData.metadata.title}"). Continue anyway?`);
                            if (!proceed) return;
                        }
                        
                        // Store for next time
                        if (window.RegistryManager) {
                            window.RegistryManager.storeLedgerData(ledgerData.fileId, ledgerData);
                        }
                        
                        this.showDocumentView(ledgerData);
                        
                        setTimeout(() => {
                            if (window.LedgerController && window.LedgerController.renderLedger) {
                                window.LedgerController.renderLedger();
                            }
                            
                            // Update summary after viewing ledger
                            this.updateLedgerSummaryFromViewing(ledgerData.metadata.title);
                        }, 100);
                    }
                } else {
                    throw new Error('FileManager not available');
                }
            }
        } catch (error) {
            console.error('Error opening ledger from registry:', error);
            this.showLedgerError(registryEntry.title, error.message, itemElement);
        }
    },
    
    /**
     * Open legacy ledger with error handling
     * @param {string} ledgerTitle - Title of the ledger
     * @param {HTMLElement} itemElement - The clicked ledger item element
     */
    async openLegacyLedgerWithErrorHandling(ledgerTitle, itemElement) {
        try {
            if (!window.TransactionManager) {
                throw new Error('TransactionManager not available');
            }
            
            const ledgers = window.TransactionManager.getLedgers() || [];
            if (!ledgers.includes(ledgerTitle)) {
                throw new Error(`Ledger "${ledgerTitle}" no longer exists in local storage.`);
            }
            
            this.openLegacyLedger(ledgerTitle);
        } catch (error) {
            console.error('Error opening legacy ledger:', error);
            this.showLedgerError(ledgerTitle, error.message, itemElement);
        }
    },

    /**
     * Close current ledger
     */
    closeLedger() {
        console.log('Closing current ledger');
        
        if (this.currentState !== 'document') return;
        
        // Update summary before closing
        if (this.currentLedgerData && this.currentLedgerData.metadata.title) {
            this.updateLedgerSummaryFromViewing(this.currentLedgerData.metadata.title);
        }
        
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
     * Add registry cleanup button to welcome screen
     */
    addRegistryCleanupButton() {
        // Find the welcome actions section
        const welcomeActions = document.querySelector('.welcome-actions');
        if (!welcomeActions) return;
        
        // Check if cleanup button already exists
        if (document.getElementById('cleanup-registry-btn')) return;
        
        // Create cleanup button
        const cleanupBtn = document.createElement('button');
        cleanupBtn.id = 'cleanup-registry-btn';
        cleanupBtn.className = 'welcome-btn';
        cleanupBtn.innerHTML = '<span class="btn-icon">🧹</span> Clean Up';
        cleanupBtn.title = 'Remove invalid entries from recent ledgers';
        
        cleanupBtn.addEventListener('click', () => this.showRegistryCleanupDialog());
        
        // Add button to the actions
        welcomeActions.appendChild(cleanupBtn);
    },
    
    /**
     * Show registry cleanup dialog
     */
    async showRegistryCleanupDialog() {
        if (!window.RegistryManager) {
            alert('Registry manager not available');
            return;
        }
        
        try {
            // Get current registry stats
            const stats = RegistryManager.getStats();
            const allLedgers = RegistryManager.getAllLedgers();
            
            const message = `Registry Cleanup\n\n` +
                `Total ledgers: ${stats.totalLedgers}\n` +
                `Cache age: ${this.formatCacheAge(stats.cacheAge)}\n\n` +
                `This will:\n` +
                `- Remove entries for missing files\n` +
                `- Validate file accessibility\n` +
                `- Clean up duplicate entries\n\n` +
                `Continue with cleanup?`;
            
            if (confirm(message)) {
                const result = await RegistryManager.refreshCache();
                
                const resultMessage = `Cleanup Complete\n\n` +
                    `Processed: ${result.total} entries\n` +
                    `Updated: ${result.updated}\n` +
                    `Removed: ${result.removed}\n` +
                    `Errors: ${result.errors}`;
                
                alert(resultMessage);
                
                // Recent ledgers removed - pure file-based approach
            }
        } catch (error) {
            console.error('Error during registry cleanup:', error);
            alert('Error during cleanup: ' + error.message);
        }
    },
    
    /**
     * Format cache age for display
     */
    formatCacheAge(ageMs) {
        if (!ageMs) return 'Unknown';
        
        const minutes = Math.floor(ageMs / 60000);
        const hours = Math.floor(ageMs / 3600000);
        const days = Math.floor(ageMs / 86400000);
        
        if (minutes < 60) return `${minutes} minutes`;
        if (hours < 24) return `${hours} hours`;
        return `${days} days`;
    },
    
    
    /**
     * Get legacy ledgers for transition period (without balance calculation)
     */
    getLegacyLedgers() {
        if (!window.TransactionManager) return [];
        
        const ledgers = window.TransactionManager.getLedgers() || [];
        return ledgers.map(name => {
            return {
                title: name,
                fileId: null, // Legacy ledgers don't have file IDs yet
                lastAccessed: new Date().toISOString(),
                hasBeenViewed: false, // Legacy ledgers haven't been viewed in new system yet
                summary: {
                    transactionCount: 0, // Will be populated when ledger is viewed
                    currentBalance: null // Balance unavailable until viewed
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
            
            // Get data from TransactionManager and convert to .budgie format
            const transactions = window.TransactionManager.getTransactions() || [];
            const startingBalance = window.TransactionManager.getStartingBalance() || 0;
            const startingDate = window.TransactionManager.getStartingBalanceDate() || new Date().toISOString().split('T')[0];
            
            const ledgerData = {
                fileId: 'legacy_' + ledgerName.replace(/[^a-zA-Z0-9]/g, '_'),
                version: '2.0.0',
                metadata: { 
                    title: ledgerName,
                    created: new Date().toISOString(),
                    lastModified: new Date().toISOString()
                },
                data: {
                    startingBalance: startingBalance,
                    startingDate: startingDate,
                    transactions: transactions
                }
            };
            
            // Set in FileManager if available
            if (window.FileManager) {
                window.FileManager.setCurrentLedger(ledgerData);
            }
            
            this.showDocumentView(ledgerData);
            
            setTimeout(() => {
                if (window.LedgerController && window.LedgerController.renderLedger) {
                    window.LedgerController.renderLedger();
                }
                
                // Update summary after viewing ledger
                this.updateLedgerSummaryFromViewing(ledgerName);
            }, 100);
        }
    },
    
    /**
     * Update ledger summary when viewed (single source of truth)
     * Uses FileManager data when available
     */
    updateLedgerSummaryFromViewing(ledgerName) {
        let transactions = [];
        let startingBalance = 0;
        let currentBalance = 0;
        let fileId = null;
        
        // Get data from FileManager if available
        if (window.FileManager && window.FileManager.getCurrentLedger()) {
            const ledgerData = window.FileManager.getCurrentLedger();
            fileId = ledgerData.fileId;
            transactions = ledgerData.data.transactions || [];
            startingBalance = ledgerData.data.startingBalance || 0;
            
            // Calculate balance from FileManager data
            let totalDebits = 0, totalCredits = 0;
            transactions.forEach(t => {
                totalDebits += t.debit || 0;
                totalCredits += t.credit || 0;
            });
            currentBalance = startingBalance + totalCredits - totalDebits;
            console.log('Calculated balance from FileManager:', currentBalance);
            
        } else if (window.TransactionManager) {
            // Fallback to TransactionManager for legacy ledgers
            const previousActive = window.TransactionManager.getActiveLedger();
            window.TransactionManager.setActiveLedger(ledgerName);
            
            transactions = window.TransactionManager.getTransactions() || [];
            startingBalance = window.TransactionManager.getStartingBalance() || 0;
            fileId = 'legacy_' + ledgerName;
            
            let totalDebits = 0, totalCredits = 0;
            transactions.forEach(t => {
                totalDebits += t.debit || 0;
                totalCredits += t.credit || 0;
            });
            currentBalance = startingBalance + totalCredits - totalDebits;
            console.log('Calculated balance from TransactionManager:', currentBalance);
            
            // Restore previous active ledger
            if (previousActive) {
                window.TransactionManager.setActiveLedger(previousActive);
            }
        }
        
        // Update or add to registry with summary
        if (window.RegistryManager) {
            const summary = {
                transactionCount: transactions.length,
                currentBalance: Math.round(currentBalance * 100) / 100
            };
            
            RegistryManager.addLedger(fileId, ledgerName, ledgerName, summary, true);
            console.log('Updated summary for', ledgerName, ':', summary);
        }
    },
    
    /**
     * Handle missing ledger error
     */
    handleMissingLedger(ledgerTitle, fileId, itemElement) {
        console.error('Ledger not found in registry:', fileId);
        this.showLedgerError(ledgerTitle, 'Ledger not found in registry. It may have been deleted.', itemElement);
    },
    
    /**
     * Handle invalid ledger item
     */
    handleInvalidLedgerItem(itemElement) {
        console.error('Invalid ledger item clicked');
        this.showLedgerError('Unknown', 'Invalid ledger entry. No identifier found.', itemElement);
    },
    
    /**
     * Show error dialog for ledger loading issues
     */
    showLedgerError(ledgerTitle, errorMessage, itemElement) {
        const fullMessage = `Cannot open "${ledgerTitle}"\n\n${errorMessage}\n\nWould you like to remove this entry from your recent ledgers?`;
        
        if (confirm(fullMessage)) {
            this.removeLedgerFromRecents(ledgerTitle, itemElement);
        }
    },
    
    /**
     * Remove ledger from recent ledgers list
     */
    removeLedgerFromRecents(ledgerTitle, itemElement) {
        try {
            const fileId = itemElement.getAttribute('data-file-id');
            
            // Remove from registry if it has a file ID
            if (fileId && window.RegistryManager) {
                RegistryManager.removeLedger(fileId);
                console.log('Removed ledger from registry:', fileId);
            }
            
            // Remove the UI element
            itemElement.remove();
            
            // Check if we need to show the "no ledgers" message
            const listContainer = document.getElementById('recent-ledgers-list');
            const noLedgersMsg = document.getElementById('no-ledgers-message');
            
            if (listContainer && listContainer.children.length === 0 && noLedgersMsg) {
                noLedgersMsg.classList.remove('hidden');
            }
            
            console.log(`Removed "${ledgerTitle}" from recent ledgers`);
            
        } catch (error) {
            console.error('Error removing ledger from recents:', error);
            alert('Error removing ledger from list: ' + error.message);
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
     * Import ledger from base64 file and convert to .budgie
     */
    importBase64Ledger() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.txt';
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const base64Data = event.target.result;
                    
                    // Decode base64 to get ledger data
                    const jsonString = decodeURIComponent(escape(atob(base64Data)));
                    const importData = JSON.parse(jsonString);
                    
                    // Convert to .budgie format
                    const ledgerData = {
                        fileId: window.FileFormats ? window.FileFormats.generateFileId() : 'import_' + Date.now(),
                        version: '2.0.0',
                        metadata: {
                            title: importData.name || 'Imported Ledger',
                            created: new Date().toISOString(),
                            lastModified: new Date().toISOString()
                        },
                        data: {
                            startingBalance: parseFloat(importData.startingBalance) || 0,
                            startingDate: importData.startingBalanceDate || new Date().toISOString().split('T')[0],
                            transactions: importData.transactions || []
                        }
                    };
                    
                    // Set in FileManager
                    if (window.FileManager) {
                        window.FileManager.setCurrentLedger(ledgerData);
                    }
                    
                    // Open the ledger
                    this.showDocumentView(ledgerData);
                    
                    // Render and prompt to save
                    setTimeout(async () => {
                        if (window.LedgerController && window.LedgerController.renderLedger) {
                            window.LedgerController.renderLedger();
                        }
                        
                        // Prompt to save as .budgie file
                        alert(`Successfully imported "${ledgerData.metadata.title}". Please save this ledger as a .budgie file.`);
                        
                        if (window.FileManager) {
                            const filePath = await window.FileManager.saveCurrentLedger();
                            if (filePath) {
                                alert('Ledger saved successfully!');
                            }
                        }
                    }, 100);
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
// Developer helper functions
window.clearRegistryData = function() {
    if (window.RegistryManager) {
        RegistryManager.clearCache();
        // Recent ledgers removed - pure file-based approach
        console.log('Registry data cleared.');
    } else {
        console.log('RegistryManager not available');
    }
};

console.log('Developer helper available: clearRegistryData()');

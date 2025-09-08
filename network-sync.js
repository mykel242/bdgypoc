/**
 * Network Sync Module
 * Handles synchronization of ledger data with network drives
 * Uses File System Access API for network drive integration
 */

const NetworkSync = {
    // Configuration
    CONFIG: {
        FILE_EXTENSION: '.budgie',
        SYNC_VERSION: '1.0',
        LOCK_TIMEOUT: 30000, // 30 seconds
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    },

    // State
    currentHandle: null,
    syncEnabled: false,
    lastSyncTime: null,
    lockId: null,

    /**
     * Initialize network sync functionality
     */
    init() {
        this.setupEventListeners();
        this.checkFileSystemAPISupport();
    },

    /**
     * Check if File System Access API is supported
     */
    checkFileSystemAPISupport() {
        if (!('showOpenFilePicker' in window)) {
            console.warn('File System Access API not supported. Network sync will use fallback method.');
            return false;
        }
        return true;
    },

    /**
     * Setup event listeners for network sync buttons
     */
    setupEventListeners() {
        const openNetworkBtn = document.getElementById('open-network-btn');
        const saveNetworkBtn = document.getElementById('save-network-btn');

        if (openNetworkBtn) {
            openNetworkBtn.addEventListener('click', () => this.openFromNetwork());
        }

        if (saveNetworkBtn) {
            saveNetworkBtn.addEventListener('click', () => this.saveToNetwork());
        }

        // Listen for storage events from other tabs/windows
        window.addEventListener('storage', (e) => this.handleStorageSync(e));

        // Auto-save to network if a file is open
        window.addEventListener('beforeunload', () => {
            if (this.currentHandle && this.syncEnabled) {
                this.autoSave();
            }
        });
    },

    /**
     * Open a ledger file from network drive
     */
    async openFromNetwork() {
        try {
            // Use File System Access API if available
            if ('showOpenFilePicker' in window) {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Budgie Ledger Files',
                        accept: {
                            'application/json': ['.budgie', '.json']
                        }
                    }],
                    multiple: false
                });

                this.currentHandle = fileHandle;
                const file = await fileHandle.getFile();
                const contents = await file.text();
                
                await this.loadNetworkData(contents, file.name);
                this.syncEnabled = true;
                this.showNotification('Ledger opened from network', 'success');
                
                // Start auto-sync
                this.startAutoSync();
            } else {
                // Fallback to file input
                this.openWithFileInput();
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Failed to open network file:', err);
                // Only show error if it's not a user cancellation
                if (err.message && !err.message.includes('cancel')) {
                    this.showNotification('Failed to open network file', 'error');
                }
            }
        }
    },

    /**
     * Save current ledger to network drive
     */
    async saveToNetwork() {
        try {
            const ledgerData = this.getCurrentLedgerData();
            
            if (!ledgerData) {
                this.showNotification('No ledger data to save', 'warning');
                return;
            }

            // Use existing handle or get new one
            if (!this.currentHandle) {
                if ('showSaveFilePicker' in window) {
                    this.currentHandle = await window.showSaveFilePicker({
                        suggestedName: `${ledgerData.name || 'ledger'}.budgie`,
                        types: [{
                            description: 'Budgie Ledger Files',
                            accept: {
                                'application/json': ['.budgie']
                            }
                        }]
                    });
                } else {
                    // Fallback to download
                    this.downloadAsFile(ledgerData);
                    return;
                }
            }

            // Write to file with lock mechanism
            await this.writeWithLock(this.currentHandle, ledgerData);
            this.syncEnabled = true;
            this.lastSyncTime = Date.now();
            this.showNotification('Ledger saved to network', 'success');
            
            // Start auto-sync if not already running
            this.startAutoSync();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Failed to save to network:', err);
                this.showNotification('Failed to save to network', 'error');
            }
        }
    },

    /**
     * Write data to file with lock mechanism to prevent conflicts
     */
    async writeWithLock(fileHandle, data) {
        const writable = await fileHandle.createWritable();
        
        try {
            // Create sync metadata
            const syncData = {
                version: this.CONFIG.SYNC_VERSION,
                lastModified: Date.now(),
                lockId: this.generateLockId(),
                data: data
            };

            const contents = JSON.stringify(syncData, null, 2);
            await writable.write(contents);
        } finally {
            await writable.close();
        }
    },

    /**
     * Load network data into the application
     */
    async loadNetworkData(contents, filename) {
        try {
            const syncData = JSON.parse(contents);
            
            // Check version compatibility
            if (syncData.version !== this.CONFIG.SYNC_VERSION) {
                if (!confirm('This file was created with a different version. Continue anyway?')) {
                    return;
                }
            }

            // Check for lock
            if (syncData.lockId && this.isLockActive(syncData.lastModified)) {
                if (!confirm('This file may be open on another computer. Open anyway?')) {
                    return;
                }
            }

            // Load the data
            const ledgerData = syncData.data || syncData; // Handle both wrapped and unwrapped data
            
            // Import into TransactionManager
            if (window.TransactionManager && window.TransactionManager.importLedger) {
                const ledgerName = this.extractLedgerName(filename);
                window.TransactionManager.importLedger(ledgerName, ledgerData);
                
                // Switch to the imported ledger
                if (window.LedgerManager) {
                    window.LedgerManager.setActiveLedger(ledgerName);
                }
            }
        } catch (err) {
            console.error('Failed to parse network file:', err);
            this.showNotification('Invalid file format', 'error');
        }
    },

    /**
     * Auto-sync functionality
     */
    startAutoSync() {
        // Clear existing interval
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }

        // Auto-save every 30 seconds if file is open
        this.autoSyncInterval = setInterval(() => {
            if (this.currentHandle && this.syncEnabled) {
                this.autoSave();
            }
        }, 30000);
    },

    /**
     * Auto-save current data
     */
    async autoSave() {
        if (!this.currentHandle) return;

        try {
            const ledgerData = this.getCurrentLedgerData();
            if (ledgerData) {
                await this.writeWithLock(this.currentHandle, ledgerData);
                this.lastSyncTime = Date.now();
            }
        } catch (err) {
            console.error('Auto-save failed:', err);
        }
    },

    /**
     * Get current ledger data from TransactionManager
     */
    getCurrentLedgerData() {
        if (!window.TransactionManager) return null;

        const activeLedger = window.TransactionManager.getActiveLedger();
        if (!activeLedger) return null;

        return {
            name: activeLedger,
            transactions: window.TransactionManager.getTransactions(activeLedger),
            startingBalance: window.TransactionManager.getStartingBalance(activeLedger),
            startingBalanceDate: window.TransactionManager.getStartingBalanceDate(activeLedger),
            exportDate: new Date().toISOString(),
            version: this.CONFIG.SYNC_VERSION
        };
    },

    /**
     * Fallback: Open file using input element
     */
    openWithFileInput() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.budgie,.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const contents = await file.text();
                    await this.loadNetworkData(contents, file.name);
                    // Only show one success notification
                    this.showNotification('Ledger loaded from file', 'success');
                } catch (err) {
                    console.error('Error loading file:', err);
                    this.showNotification('Failed to load file', 'error');
                }
            }
        };
        
        input.click();
    },

    /**
     * Fallback: Download file
     */
    downloadAsFile(data) {
        const syncData = {
            version: this.CONFIG.SYNC_VERSION,
            lastModified: Date.now(),
            data: data
        };

        const blob = new Blob([JSON.stringify(syncData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.name || 'ledger'}.budgie`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Ledger downloaded', 'success');
    },

    /**
     * Handle storage sync events from other tabs
     */
    handleStorageSync(event) {
        if (event.key && event.key.startsWith('budgie_network_sync_')) {
            // Another tab has made changes
            if (this.syncEnabled && this.currentHandle) {
                // Reload from network to get latest changes
                this.reloadFromNetwork();
            }
        }
    },

    /**
     * Reload data from network file
     */
    async reloadFromNetwork() {
        if (!this.currentHandle) return;

        try {
            const file = await this.currentHandle.getFile();
            const contents = await file.text();
            await this.loadNetworkData(contents, file.name);
        } catch (err) {
            console.error('Failed to reload from network:', err);
        }
    },

    /**
     * Generate a unique lock ID
     */
    generateLockId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Check if a lock is still active
     */
    isLockActive(lastModified) {
        return (Date.now() - lastModified) < this.CONFIG.LOCK_TIMEOUT;
    },

    /**
     * Extract ledger name from filename
     */
    extractLedgerName(filename) {
        return filename.replace(/\.(budgie|json)$/i, '');
    },

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Get all existing notifications
        const existingNotifications = document.querySelectorAll('.network-notification');
        
        // Calculate offset based on existing notifications
        let bottomOffset = 20;
        existingNotifications.forEach(notif => {
            if (!notif.classList.contains('fade-out')) {
                bottomOffset += notif.offsetHeight + 10;
            }
        });
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `network-notification ${type}`;
        notification.textContent = message;
        notification.style.bottom = `${bottomOffset}px`;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
                // Reposition remaining notifications
                this.repositionNotifications();
            }, 300);
        }, 3000);
    },

    /**
     * Reposition notifications after one is removed
     */
    repositionNotifications() {
        const notifications = document.querySelectorAll('.network-notification:not(.fade-out)');
        let bottomOffset = 20;
        
        notifications.forEach(notif => {
            notif.style.transition = 'bottom 0.3s ease-out';
            notif.style.bottom = `${bottomOffset}px`;
            bottomOffset += notif.offsetHeight + 10;
        });
    },

    /**
     * Get sync status
     */
    getSyncStatus() {
        return {
            enabled: this.syncEnabled,
            hasFile: !!this.currentHandle,
            lastSync: this.lastSyncTime,
            filename: this.currentHandle?.name
        };
    },

    /**
     * Disconnect from network file
     */
    disconnect() {
        this.currentHandle = null;
        this.syncEnabled = false;
        this.lastSyncTime = null;
        
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
        
        this.showNotification('Disconnected from network file', 'info');
    }
};

// Export for use in other modules
window.NetworkSync = NetworkSync;
// file-manager.js
/**
 * FileManager - Handles all file system operations for .budgie files
 * Replaces TransactionManager with file-first approach
 */

const FileManager = {
    // Current session state
    currentFileId: null,
    currentFilePath: null,
    currentData: null,
    hasFileSystemAPI: false,

    /**
     * Initialize FileManager
     */
    init() {
        console.log('Initializing FileManager');
        this.hasFileSystemAPI = this.checkFileSystemAPISupport();
        
        if (!this.hasFileSystemAPI) {
            console.warn('File System Access API not supported. Using fallback methods.');
        }
    },

    /**
     * Check if File System Access API is supported
     * @returns {boolean} True if supported
     */
    checkFileSystemAPISupport() {
        return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
    },

    /**
     * Create a new ledger in memory
     * @param {string} title - Human-readable title for the ledger
     * @param {number} startingBalance - Initial balance (default: 0)
     * @param {string} startingDate - Starting date (default: today)
     * @returns {object} New ledger data with unique file ID
     */
    createLedger(title, startingBalance = 0, startingDate = null) {
        console.log('Creating new ledger:', title);
        
        const fileId = FileFormats.generateFileId();
        const ledgerData = FileFormats.createBudgieFile(fileId, title, startingBalance, startingDate);
        
        // Set as current session data
        this.currentFileId = fileId;
        this.currentFilePath = null; // Will be set when saved
        this.currentData = ledgerData;
        
        console.log('Created ledger with ID:', fileId);
        return ledgerData;
    },

    /**
     * Save current ledger to file system
     * @param {string} suggestedName - Suggested filename (optional)
     * @returns {Promise<string|null>} File path if successful, null if cancelled
     */
    async saveCurrentLedger(suggestedName = null) {
        if (!this.currentData || !this.currentFileId) {
            throw new Error('No current ledger to save');
        }

        try {
            const filename = suggestedName || FileFormats.getBudgieFilename(this.currentFileId);
            const filePath = await this.promptSaveLocation(filename);
            
            if (!filePath) {
                return null; // User cancelled
            }

            await this.saveLedgerToPath(this.currentData, filePath);
            this.currentFilePath = filePath;
            
            console.log('Saved ledger to:', filePath);
            return filePath;
            
        } catch (error) {
            console.error('Error saving ledger:', error);
            throw error;
        }
    },

    /**
     * Save ledger data to specific file path
     * @param {object} ledgerData - Complete ledger data
     * @param {string|FileSystemFileHandle} filePath - File path or handle
     */
    async saveLedgerToPath(ledgerData, filePath) {
        // Update last modified timestamp
        ledgerData.metadata.lastModified = new Date().toISOString();
        ledgerData.metadata.lastSavedBy = FileFormats.getDeviceId();

        const jsonData = JSON.stringify(ledgerData, null, 2);

        if (this.hasFileSystemAPI && filePath instanceof FileSystemFileHandle) {
            // Use File System Access API
            const writable = await filePath.createWritable();
            await writable.write(jsonData);
            await writable.close();
        } else {
            // Fallback: trigger download
            this.downloadFile(jsonData, filePath, 'application/json');
        }
    },

    /**
     * Open ledger from file system
     * @returns {Promise<object|null>} Ledger data if successful, null if cancelled
     */
    async openLedger() {
        try {
            if (this.hasFileSystemAPI) {
                return await this.openWithFileSystemAPI();
            } else {
                return await this.openWithFallback();
            }
        } catch (error) {
            console.error('Error opening ledger:', error);
            throw error;
        }
    },

    /**
     * Open ledger using File System Access API
     * @returns {Promise<object|null>} Ledger data or null if cancelled
     */
    async openWithFileSystemAPI() {
        try {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Budgie Ledger Files',
                    accept: { 'application/json': ['.budgie'] }
                }],
                multiple: false
            });

            const file = await fileHandle.getFile();
            const jsonData = await file.text();
            const ledgerData = JSON.parse(jsonData);

            // Validate file format
            const validation = FileFormats.validateBudgieFile(ledgerData);
            if (!validation.success) {
                throw new Error('Invalid file format: ' + validation.errors.join(', '));
            }

            // Set as current session data
            this.currentFileId = ledgerData.fileId;
            this.currentFilePath = fileHandle;
            this.currentData = ledgerData;

            console.log('Opened ledger:', ledgerData.metadata.title);
            return ledgerData;

        } catch (error) {
            if (error.name === 'AbortError') {
                return null; // User cancelled
            }
            throw error;
        }
    },

    /**
     * Open ledger using fallback method (file input)
     * @returns {Promise<object|null>} Ledger data or null if cancelled
     */
    async openWithFallback() {
        return new Promise((resolve, reject) => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.budgie,application/json';
            
            fileInput.addEventListener('change', async (event) => {
                try {
                    const file = event.target.files[0];
                    if (!file) {
                        resolve(null);
                        return;
                    }

                    const jsonData = await file.text();
                    const ledgerData = JSON.parse(jsonData);

                    // Validate file format
                    const validation = FileFormats.validateBudgieFile(ledgerData);
                    if (!validation.success) {
                        throw new Error('Invalid file format: ' + validation.errors.join(', '));
                    }

                    // Set as current session data
                    this.currentFileId = ledgerData.fileId;
                    this.currentFilePath = file.name;
                    this.currentData = ledgerData;

                    console.log('Opened ledger:', ledgerData.metadata.title);
                    resolve(ledgerData);

                } catch (error) {
                    reject(error);
                }
            });

            fileInput.addEventListener('cancel', () => resolve(null));
            fileInput.click();
        });
    },

    /**
     * Prompt user for save location
     * @param {string} suggestedName - Suggested filename
     * @returns {Promise<string|FileSystemFileHandle|null>} File path/handle or null if cancelled
     */
    async promptSaveLocation(suggestedName) {
        if (this.hasFileSystemAPI) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{
                        description: 'Budgie Ledger Files',
                        accept: { 'application/json': ['.budgie'] }
                    }]
                });
                
                return fileHandle;
            } catch (error) {
                if (error.name === 'AbortError') {
                    return null;
                }
                throw error;
            }
        } else {
            // For fallback, return the suggested filename
            // The actual save will trigger a download
            return suggestedName;
        }
    },

    /**
     * Download file (fallback method)
     * @param {string} content - File content
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        URL.revokeObjectURL(url);
    },

    /**
     * Get current ledger data
     * @returns {object|null} Current ledger data
     */
    getCurrentLedger() {
        return this.currentData;
    },

    /**
     * Get current file ID
     * @returns {string|null} Current file ID
     */
    getCurrentFileId() {
        return this.currentFileId;
    },

    /**
     * Get current file path
     * @returns {string|FileSystemFileHandle|null} Current file path
     */
    getCurrentFilePath() {
        return this.currentFilePath;
    },

    /**
     * Update current ledger data
     * @param {object} updatedData - Updated ledger data
     */
    updateCurrentLedger(updatedData) {
        if (!this.currentFileId) {
            throw new Error('No current ledger to update');
        }
        
        this.currentData = updatedData;
        this.currentData.metadata.lastModified = new Date().toISOString();
    },

    /**
     * Add transaction to current ledger
     * @param {object} transaction - Transaction data
     */
    addTransaction(transaction) {
        if (!this.currentData) {
            throw new Error('No current ledger');
        }
        
        // Generate ID if not provided
        if (!transaction.id) {
            transaction.id = 'txn_' + FileFormats.generateFileId().substr(0, 12);
        }
        
        // Add timestamp if not provided
        if (!transaction.createdAt) {
            transaction.createdAt = new Date().toISOString();
        }
        
        this.currentData.data.transactions.push(transaction);
        this.updateCurrentLedger(this.currentData);
        
        return transaction;
    },

    /**
     * Update transaction in current ledger
     * @param {string} transactionId - Transaction ID
     * @param {object} updates - Updated transaction data
     * @returns {object|null} Updated transaction or null if not found
     */
    updateTransaction(transactionId, updates) {
        if (!this.currentData) {
            throw new Error('No current ledger');
        }
        
        const transactions = this.currentData.data.transactions;
        const index = transactions.findIndex(t => t.id === transactionId);
        
        if (index !== -1) {
            transactions[index] = { ...transactions[index], ...updates };
            this.updateCurrentLedger(this.currentData);
            return transactions[index];
        }
        
        return null;
    },

    /**
     * Delete transaction from current ledger
     * @param {string} transactionId - Transaction ID
     * @returns {boolean} True if deleted, false if not found
     */
    deleteTransaction(transactionId) {
        if (!this.currentData) {
            throw new Error('No current ledger');
        }
        
        const transactions = this.currentData.data.transactions;
        const initialLength = transactions.length;
        
        this.currentData.data.transactions = transactions.filter(t => t.id !== transactionId);
        
        if (this.currentData.data.transactions.length < initialLength) {
            this.updateCurrentLedger(this.currentData);
            return true;
        }
        
        return false;
    },

    /**
     * Get all transactions from current ledger
     * @returns {array} Array of transactions
     */
    getTransactions() {
        if (!this.currentData) {
            return [];
        }
        
        return this.currentData.data.transactions || [];
    },

    /**
     * Get starting balance from current ledger
     * @returns {number} Starting balance
     */
    getStartingBalance() {
        if (!this.currentData) {
            return 0;
        }
        
        return this.currentData.data.startingBalance || 0;
    },

    /**
     * Update starting balance in current ledger
     * @param {number} balance - New starting balance
     */
    updateStartingBalance(balance) {
        if (!this.currentData) {
            throw new Error('No current ledger');
        }
        
        this.currentData.data.startingBalance = balance;
        this.updateCurrentLedger(this.currentData);
    },

    /**
     * Clear current session
     */
    clearCurrentSession() {
        this.currentFileId = null;
        this.currentFilePath = null;
        this.currentData = null;
        console.log('Cleared current session');
    },

    /**
     * Export methods for compatibility with existing code
     */
    exports() {
        return {
            init: this.init.bind(this),
            createLedger: this.createLedger.bind(this),
            openLedger: this.openLedger.bind(this),
            saveCurrentLedger: this.saveCurrentLedger.bind(this),
            getCurrentLedger: this.getCurrentLedger.bind(this),
            getCurrentFileId: this.getCurrentFileId.bind(this),
            addTransaction: this.addTransaction.bind(this),
            updateTransaction: this.updateTransaction.bind(this),
            deleteTransaction: this.deleteTransaction.bind(this),
            getTransactions: this.getTransactions.bind(this),
            getStartingBalance: this.getStartingBalance.bind(this),
            updateStartingBalance: this.updateStartingBalance.bind(this),
            clearCurrentSession: this.clearCurrentSession.bind(this)
        };
    }
};

// Export for use
window.FileManager = FileManager.exports();
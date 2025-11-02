// registry-manager.js
/**
 * RegistryManager - Handles lightweight ledger registry with localStorage caching
 * Provides fast access to ledger metadata for welcome screen without loading full files
 */

const RegistryManager = {
    CACHE_KEY: 'budgie_registry_cache',
    MAX_RECENT_LEDGERS: 20,
    CACHE_REFRESH_THRESHOLD_MS: 24 * 60 * 60 * 1000, // 24 hours

    /**
     * Initialize RegistryManager
     */
    init() {
        console.log('Initializing RegistryManager');
        this.loadCache();
    },

    /**
     * Add or update ledger in registry
     * @param {string} fileId - Unique file identifier
     * @param {string} title - Ledger title
     * @param {string|FileSystemFileHandle} filePath - File path or handle
     * @param {object} summary - Ledger summary data (optional)
     * @param {boolean} updateAccess - Whether to update lastAccessed timestamp
     * @returns {object} Registry entry
     */
    addLedger(fileId, title, filePath, summary = null, updateAccess = true) {
        console.log('Adding ledger to registry:', fileId, title);
        
        const cache = this.getCache();
        const now = new Date().toISOString();
        
        // Find existing entry or create new one
        let ledgerEntry = cache.ledgers.find(l => l.fileId === fileId);
        
        if (ledgerEntry) {
            // Update existing entry
            ledgerEntry.title = title;
            ledgerEntry.filePath = filePath;
            if (summary) {
                ledgerEntry.summary = summary;
            }
            if (updateAccess) {
                ledgerEntry.lastAccessed = now;
            }
            ledgerEntry.status = 'synced';
        } else {
            // Create new entry
            ledgerEntry = {
                fileId: fileId,
                title: title,
                filePath: filePath,
                lastAccessed: now,
                summary: summary || {
                    transactionCount: 0,
                    currentBalance: 0,
                    dateRange: [null, null]
                },
                status: 'synced',
                ledgerData: null // Will be populated separately if needed
            };
            cache.ledgers.push(ledgerEntry);
        }
        
        // Sort by lastAccessed (most recent first) and limit entries
        cache.ledgers.sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed));
        cache.ledgers = cache.ledgers.slice(0, this.MAX_RECENT_LEDGERS);
        
        cache.lastUpdated = now;
        this.saveCache(cache);
        
        return ledgerEntry;
    },

    /**
     * Remove ledger from registry
     * @param {string} fileId - File ID to remove
     * @returns {boolean} True if removed, false if not found
     */
    removeLedger(fileId) {
        console.log('Removing ledger from registry:', fileId);
        
        const cache = this.getCache();
        const initialLength = cache.ledgers.length;
        
        cache.ledgers = cache.ledgers.filter(l => l.fileId !== fileId);
        
        if (cache.ledgers.length < initialLength) {
            cache.lastUpdated = new Date().toISOString();
            this.saveCache(cache);
            return true;
        }
        
        return false;
    },

    /**
     * Update ledger summary data
     * @param {string} fileId - File ID to update
     * @param {object} summary - New summary data
     * @returns {boolean} True if updated, false if not found
     */
    updateSummary(fileId, summary) {
        console.log('Updating ledger summary:', fileId);
        
        const cache = this.getCache();
        const ledgerEntry = cache.ledgers.find(l => l.fileId === fileId);
        
        if (ledgerEntry) {
            ledgerEntry.summary = { ...ledgerEntry.summary, ...summary };
            cache.lastUpdated = new Date().toISOString();
            this.saveCache(cache);
            return true;
        }
        
        return false;
    },

    /**
     * Update ledger access timestamp
     * @param {string} fileId - File ID to update
     * @returns {boolean} True if updated, false if not found
     */
    updateLastAccessed(fileId) {
        const cache = this.getCache();
        const ledgerEntry = cache.ledgers.find(l => l.fileId === fileId);
        
        if (ledgerEntry) {
            ledgerEntry.lastAccessed = new Date().toISOString();
            
            // Resort by access time
            cache.ledgers.sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed));
            cache.lastUpdated = new Date().toISOString();
            this.saveCache(cache);
            return true;
        }
        
        return false;
    },

    /**
     * Get all ledgers from registry
     * @returns {array} Array of ledger entries, sorted by last accessed
     */
    getAllLedgers() {
        const cache = this.getCache();
        return [...cache.ledgers]; // Return copy
    },

    /**
     * Get recent ledgers for welcome screen
     * @param {number} limit - Maximum number of ledgers to return
     * @returns {array} Array of recent ledger entries
     */
    getRecentLedgers(limit = 10) {
        const cache = this.getCache();
        return cache.ledgers.slice(0, limit);
    },

    /**
     * Find ledger by file ID
     * @param {string} fileId - File ID to find
     * @returns {object|null} Ledger entry or null if not found
     */
    findLedger(fileId) {
        const cache = this.getCache();
        return cache.ledgers.find(l => l.fileId === fileId) || null;
    },

    /**
     * Search ledgers by title
     * @param {string} query - Search query
     * @returns {array} Array of matching ledger entries
     */
    searchLedgers(query) {
        if (!query || query.trim() === '') {
            return this.getAllLedgers();
        }
        
        const cache = this.getCache();
        const searchTerm = query.toLowerCase().trim();
        
        return cache.ledgers.filter(ledger => 
            ledger.title.toLowerCase().includes(searchTerm)
        );
    },

    /**
     * Calculate summary data from ledger data
     * @param {object} ledgerData - Complete ledger data from .budgie file
     * @returns {object} Summary data for registry
     */
    calculateSummary(ledgerData) {
        const transactions = ledgerData.data.transactions || [];
        const startingBalance = ledgerData.data.startingBalance || 0;
        
        let currentBalance = startingBalance;
        let dateRange = [null, null];
        
        if (transactions.length > 0) {
            // Calculate total credits and debits (same method as legacy system)
            let totalCredits = 0;
            let totalDebits = 0;
            transactions.forEach(txn => {
                totalCredits += txn.credit || 0;
                totalDebits += txn.debit || 0;
            });
            
            currentBalance = startingBalance + totalCredits - totalDebits;
            
            // Find date range
            const dates = transactions
                .map(txn => txn.date)
                .filter(date => date)
                .sort();
            
            if (dates.length > 0) {
                dateRange = [dates[0], dates[dates.length - 1]];
            }
        }
        
        // Add starting date if available and no transaction dates
        if (!dateRange[0] && ledgerData.data.startingDate) {
            dateRange[0] = ledgerData.data.startingDate;
            if (!dateRange[1]) {
                dateRange[1] = ledgerData.data.startingDate;
            }
        }
        
        return {
            transactionCount: transactions.length,
            currentBalance: Math.round(currentBalance * 100) / 100, // Round to 2 decimal places
            dateRange: dateRange
        };
    },

    /**
     * Load registry cache from localStorage
     * @returns {object} Cache data structure
     */
    loadCache() {
        try {
            const cacheData = localStorage.getItem(this.CACHE_KEY);
            if (cacheData) {
                const parsed = JSON.parse(cacheData);
                console.log('Loaded registry cache with', parsed.ledgers?.length || 0, 'entries');
                return parsed;
            }
        } catch (error) {
            console.warn('Error loading registry cache:', error);
        }
        
        // Return empty cache structure
        const emptyCache = {
            lastUpdated: new Date().toISOString(),
            ledgers: []
        };
        
        this.saveCache(emptyCache);
        return emptyCache;
    },

    /**
     * Save registry cache to localStorage
     * @param {object} cache - Cache data to save
     */
    saveCache(cache) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
            console.log('Saved registry cache with', cache.ledgers?.length || 0, 'entries');
        } catch (error) {
            console.error('Error saving registry cache:', error);
        }
    },

    /**
     * Get current cache data
     * @returns {object} Current cache structure
     */
    getCache() {
        return this.loadCache();
    },

    /**
     * Check if cache needs refresh based on age
     * @returns {boolean} True if cache is stale
     */
    isCacheStale() {
        const cache = this.getCache();
        if (!cache.lastUpdated) {
            return true;
        }
        
        const lastUpdated = new Date(cache.lastUpdated);
        const now = new Date();
        const ageMs = now - lastUpdated;
        
        return ageMs > this.CACHE_REFRESH_THRESHOLD_MS;
    },

    /**
     * Refresh cache by validating file paths and updating summaries
     * This is a background operation that can be run periodically
     * @returns {Promise<object>} Refresh results
     */
    async refreshCache() {
        console.log('Starting registry cache refresh...');
        
        const cache = this.getCache();
        const results = {
            total: cache.ledgers.length,
            updated: 0,
            removed: 0,
            errors: 0
        };
        
        // Check each ledger entry
        for (let i = cache.ledgers.length - 1; i >= 0; i--) {
            const ledger = cache.ledgers[i];
            let shouldRemove = false;
            
            try {
                // Check if this is a mock/test entry (fake file paths)
                if (typeof ledger.filePath === 'string' && 
                    (ledger.filePath.startsWith('/mock/') || 
                     ledger.filePath.startsWith('/fake/') ||
                     ledger.filePath === '/test/path.budgie')) {
                    console.log('Removing test/mock entry:', ledger.title);
                    shouldRemove = true;
                }
                
                // Check if ledger exists in TransactionManager (for legacy entries)
                else if (window.TransactionManager && typeof ledger.filePath === 'string') {
                    const ledgers = window.TransactionManager.getLedgers() || [];
                    if (!ledgers.includes(ledger.title)) {
                        console.log('Removing orphaned legacy entry:', ledger.title);
                        shouldRemove = true;
                    } else {
                        ledger.status = 'legacy';
                    }
                }
                
                // Try FileSystemFileHandle validation
                else if (ledger.filePath instanceof FileSystemFileHandle) {
                    try {
                        await ledger.filePath.getFile();
                        ledger.status = 'synced';
                    } catch (error) {
                        console.log('Removing inaccessible file entry:', ledger.title);
                        shouldRemove = true;
                    }
                }
                
                // Remove entries with invalid or missing identifiers
                else if (!ledger.fileId || !ledger.title) {
                    console.log('Removing invalid entry with missing data');
                    shouldRemove = true;
                }
                
                // Remove the entry if flagged
                if (shouldRemove) {
                    cache.ledgers.splice(i, 1);
                    results.removed++;
                } else {
                    results.updated++;
                }
                
            } catch (error) {
                console.warn('Error refreshing ledger entry:', ledger.fileId, error);
                // Remove entries that cause errors
                cache.ledgers.splice(i, 1);
                results.errors++;
            }
        }
        
        cache.lastUpdated = new Date().toISOString();
        this.saveCache(cache);
        
        console.log('Registry cache refresh completed:', results);
        return results;
    },

    /**
     * Clear all registry cache data
     */
    clearCache() {
        console.log('Clearing registry cache');
        localStorage.removeItem(this.CACHE_KEY);
    },

    /**
     * Get registry statistics
     * @returns {object} Statistics about the registry
     */
    getStats() {
        const cache = this.getCache();
        
        return {
            totalLedgers: cache.ledgers.length,
            lastUpdated: cache.lastUpdated,
            cacheAge: cache.lastUpdated ? 
                Date.now() - new Date(cache.lastUpdated).getTime() : null,
            isStale: this.isCacheStale()
        };
    },

    /**
     * Export methods for compatibility
     */
    exports() {
        return {
            init: this.init.bind(this),
            addLedger: this.addLedger.bind(this),
            removeLedger: this.removeLedger.bind(this),
            updateSummary: this.updateSummary.bind(this),
            updateLastAccessed: this.updateLastAccessed.bind(this),
            getAllLedgers: this.getAllLedgers.bind(this),
            getRecentLedgers: this.getRecentLedgers.bind(this),
            findLedger: this.findLedger.bind(this),
            searchLedgers: this.searchLedgers.bind(this),
            calculateSummary: this.calculateSummary.bind(this),
            loadCache: this.loadCache.bind(this),
            saveCache: this.saveCache.bind(this),
            getCache: this.getCache.bind(this),
            isCacheStale: this.isCacheStale.bind(this),
            refreshCache: this.refreshCache.bind(this),
            clearCache: this.clearCache.bind(this),
            getStats: this.getStats.bind(this)
        };
    }
};

// Export for use
window.RegistryManager = RegistryManager.exports();
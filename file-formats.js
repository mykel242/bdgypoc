// file-formats.js
/**
 * Budgie File Format Definitions and Utilities
 * Defines the structure for .budgie and .budgie.changelog files
 */

const FileFormats = {
    VERSION: "2.0.0",
    
    /**
     * Generate a unique file ID for new ledgers
     * Uses crypto.randomUUID() if available, falls back to timestamp + random
     */
    generateFileId() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID().replace(/-/g, '');
        }
        
        // Fallback for browsers without crypto.randomUUID
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `${timestamp}${random}`.substr(0, 16);
    },

    /**
     * Create a new .budgie file structure
     * @param {string} fileId - Unique identifier for the file
     * @param {string} title - Human-readable title for the ledger
     * @param {number} startingBalance - Initial balance (default: 0)
     * @param {string} startingDate - Starting date (default: today)
     * @returns {object} Complete .budgie file structure
     */
    createBudgieFile(fileId, title, startingBalance = 0, startingDate = null) {
        const now = new Date().toISOString();
        
        return {
            fileId: fileId,
            version: this.VERSION,
            metadata: {
                title: title,
                created: now,
                lastModified: now,
                lastSavedBy: this.getDeviceId()
            },
            data: {
                startingBalance: startingBalance,
                startingDate: startingDate || new Date().toISOString().split('T')[0],
                transactions: []
            }
        };
    },

    /**
     * Create a new .budgie.changelog file structure
     * @param {string} fileId - Matching file ID from .budgie file
     * @returns {object} Complete changelog file structure
     */
    createChangelogFile(fileId) {
        return {
            fileId: fileId,
            version: this.VERSION,
            deviceId: this.getDeviceId(),
            commands: []
        };
    },

    /**
     * Validate .budgie file format
     * @param {object} data - Parsed JSON data from .budgie file
     * @returns {object} Validation result with success flag and errors
     */
    validateBudgieFile(data) {
        const errors = [];
        
        // Required top-level fields
        if (!data.fileId) errors.push("Missing required field: fileId");
        if (!data.version) errors.push("Missing required field: version");
        if (!data.metadata) errors.push("Missing required field: metadata");
        if (!data.data) errors.push("Missing required field: data");
        
        // Metadata validation
        if (data.metadata) {
            if (!data.metadata.title) errors.push("Missing metadata.title");
            if (!data.metadata.created) errors.push("Missing metadata.created");
            if (!data.metadata.lastModified) errors.push("Missing metadata.lastModified");
        }
        
        // Data validation
        if (data.data) {
            if (typeof data.data.startingBalance !== 'number') {
                errors.push("data.startingBalance must be a number");
            }
            if (!Array.isArray(data.data.transactions)) {
                errors.push("data.transactions must be an array");
            }
        }
        
        // Version compatibility
        if (data.version && !this.isVersionCompatible(data.version)) {
            errors.push(`Unsupported file version: ${data.version}`);
        }
        
        return {
            success: errors.length === 0,
            errors: errors,
            warnings: this.getVersionWarnings(data.version)
        };
    },

    /**
     * Validate .budgie.changelog file format
     * @param {object} data - Parsed JSON data from changelog file
     * @returns {object} Validation result with success flag and errors
     */
    validateChangelogFile(data) {
        const errors = [];
        
        // Required fields
        if (!data.fileId) errors.push("Missing required field: fileId");
        if (!data.version) errors.push("Missing required field: version");
        if (!data.deviceId) errors.push("Missing required field: deviceId");
        if (!Array.isArray(data.commands)) errors.push("commands must be an array");
        
        // Validate commands structure
        if (data.commands) {
            data.commands.forEach((command, index) => {
                if (!command.id) errors.push(`Command ${index}: missing id`);
                if (!command.timestamp) errors.push(`Command ${index}: missing timestamp`);
                if (!command.type) errors.push(`Command ${index}: missing type`);
                if (!this.isValidCommandType(command.type)) {
                    errors.push(`Command ${index}: invalid type '${command.type}'`);
                }
            });
        }
        
        return {
            success: errors.length === 0,
            errors: errors,
            warnings: []
        };
    },

    /**
     * Check if file version is compatible with current implementation
     * @param {string} version - Version string from file
     * @returns {boolean} True if compatible
     */
    isVersionCompatible(version) {
        if (!version) return false;
        
        const [major] = version.split('.');
        const [currentMajor] = this.VERSION.split('.');
        
        // Same major version = compatible
        return major === currentMajor;
    },

    /**
     * Get version warnings for older compatible files
     * @param {string} version - Version string from file
     * @returns {array} Array of warning messages
     */
    getVersionWarnings(version) {
        const warnings = [];
        
        if (!version) return warnings;
        
        if (version < this.VERSION) {
            warnings.push(`File format is older (${version}), consider updating`);
        }
        
        return warnings;
    },

    /**
     * Valid command types for changelog
     */
    COMMAND_TYPES: {
        'transaction_add': { undoable: true, description: 'Add transaction' },
        'transaction_edit': { undoable: true, description: 'Edit transaction' },
        'transaction_delete': { undoable: true, description: 'Delete transaction' },
        'transaction_reorder': { undoable: true, description: 'Reorder transactions' },
        'starting_balance_change': { undoable: true, description: 'Change starting balance' },
        'bulk_edit': { undoable: true, description: 'Bulk edit transactions' },
        'import_transactions': { undoable: true, description: 'Import transactions' },
        'ledger_rename': { undoable: false, description: 'Rename ledger' },
        'checkpoint_save': { undoable: false, description: 'Save checkpoint' },
        'changelog_purge': { undoable: false, description: 'Purge changelog' }
    },

    /**
     * Check if command type is valid
     * @param {string} type - Command type to validate
     * @returns {boolean} True if valid
     */
    isValidCommandType(type) {
        return type in this.COMMAND_TYPES;
    },

    /**
     * Get device identifier for tracking changes
     * @returns {string} Unique device identifier
     */
    getDeviceId() {
        // Try to get stored device ID first
        let deviceId = localStorage.getItem('budgie_device_id');
        
        if (!deviceId) {
            // Generate new device ID
            deviceId = 'device_' + this.generateFileId().substr(0, 12);
            localStorage.setItem('budgie_device_id', deviceId);
        }
        
        return deviceId;
    },

    /**
     * Generate filename for .budgie file
     * @param {string} fileId - Unique file identifier
     * @returns {string} Filename with .budgie extension
     */
    getBudgieFilename(fileId) {
        return `${fileId}.budgie`;
    },

    /**
     * Generate filename for changelog file
     * @param {string} fileId - Unique file identifier
     * @returns {string} Filename with .budgie.changelog extension
     */
    getChangelogFilename(fileId) {
        return `${fileId}.budgie.changelog`;
    },

    /**
     * Extract file ID from filename
     * @param {string} filename - Full filename
     * @returns {string|null} File ID or null if not a valid budgie file
     */
    extractFileIdFromFilename(filename) {
        const budgieMatch = filename.match(/^(.+)\.budgie$/);
        if (budgieMatch) {
            return budgieMatch[1];
        }
        
        const changelogMatch = filename.match(/^(.+)\.budgie\.changelog$/);
        if (changelogMatch) {
            return changelogMatch[1];
        }
        
        return null;
    }
};

// Export for use in other modules
window.FileFormats = FileFormats;
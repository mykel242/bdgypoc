// changelog-manager.js
/**
 * ChangelogManager - Handles command-based undo/redo system with .budgie.changelog files
 * Implements infinite retention changelog with command sequencing
 */

const ChangelogManager = {
    // Current session state
    currentFileId: null,
    currentChangelog: null,
    currentSequence: 0,
    undoStack: [],
    redoStack: [],

    /**
     * Initialize ChangelogManager
     */
    init() {
        console.log('Initializing ChangelogManager');
    },

    /**
     * Load changelog for a specific ledger file
     * @param {string} fileId - File ID to load changelog for
     * @returns {Promise<object>} Changelog data structure
     */
    async loadChangelog(fileId) {
        console.log('Loading changelog for file:', fileId);
        
        try {
            // Try to load existing changelog
            const changelogData = await this.loadChangelogFromFile(fileId);
            
            this.currentFileId = fileId;
            this.currentChangelog = changelogData;
            this.currentSequence = this.getMaxSequence(changelogData) + 1;
            
            // Build undo stack from commands (exclude non-undoable commands)
            this.undoStack = changelogData.commands.filter(cmd => 
                FileFormats.COMMAND_TYPES[cmd.type]?.undoable
            );
            this.redoStack = [];
            
            console.log('Loaded changelog with', changelogData.commands.length, 'commands');
            return changelogData;
            
        } catch (error) {
            console.log('No existing changelog found, creating new one');
            
            // Create new changelog
            const newChangelog = FileFormats.createChangelogFile(fileId);
            this.currentFileId = fileId;
            this.currentChangelog = newChangelog;
            this.currentSequence = 1;
            this.undoStack = [];
            this.redoStack = [];
            
            return newChangelog;
        }
    },

    /**
     * Record a new command in the changelog
     * @param {string} type - Command type (must be valid COMMAND_TYPE)
     * @param {string} description - Human-readable description
     * @param {object} data - Command data for execution
     * @param {object} undoData - Data needed to undo this command (if undoable)
     * @returns {object} Created command object
     */
    recordCommand(type, description, data, undoData = null) {
        if (!this.currentChangelog) {
            throw new Error('No changelog loaded. Call loadChangelog() first.');
        }

        if (!FileFormats.isValidCommandType(type)) {
            throw new Error(`Invalid command type: ${type}`);
        }

        const command = {
            id: this.generateCommandId(),
            sequence: this.currentSequence++,
            timestamp: new Date().toISOString(),
            type: type,
            description: description,
            data: data,
            undoData: undoData
        };

        // Add to changelog
        this.currentChangelog.commands.push(command);

        // If this is an undoable command, add to undo stack
        if (FileFormats.COMMAND_TYPES[type]?.undoable) {
            this.undoStack.push(command);
            // Clear redo stack when new command is recorded
            this.redoStack = [];
        }

        console.log('Recorded command:', type, description);
        return command;
    },

    /**
     * Undo the last undoable command
     * @returns {Promise<object|null>} Undone command or null if nothing to undo
     */
    async undo() {
        if (!this.canUndo()) {
            return null;
        }

        const commandToUndo = this.undoStack.pop();
        console.log('Undoing command:', commandToUndo.type, commandToUndo.description);

        // Record the undo as a new command
        const undoCommand = this.recordCommand(
            commandToUndo.type + '_undo',
            `Undo: ${commandToUndo.description}`,
            commandToUndo.undoData,
            commandToUndo.data
        );

        // Move original command to redo stack
        this.redoStack.push(commandToUndo);

        // Apply the undo data to current ledger
        await this.applyCommandData(commandToUndo.undoData, commandToUndo.type);

        return commandToUndo;
    },

    /**
     * Redo the last undone command
     * @returns {Promise<object|null>} Redone command or null if nothing to redo
     */
    async redo() {
        if (!this.canRedo()) {
            return null;
        }

        const commandToRedo = this.redoStack.pop();
        console.log('Redoing command:', commandToRedo.type, commandToRedo.description);

        // Record the redo as a new command
        const redoCommand = this.recordCommand(
            commandToRedo.type + '_redo',
            `Redo: ${commandToRedo.description}`,
            commandToRedo.data,
            commandToRedo.undoData
        );

        // Move back to undo stack
        this.undoStack.push(commandToRedo);

        // Apply the original data to current ledger
        await this.applyCommandData(commandToRedo.data, commandToRedo.type);

        return commandToRedo;
    },

    /**
     * Check if undo is possible
     * @returns {boolean} True if can undo
     */
    canUndo() {
        return this.undoStack.length > 0;
    },

    /**
     * Check if redo is possible
     * @returns {boolean} True if can redo
     */
    canRedo() {
        return this.redoStack.length > 0;
    },

    /**
     * Get count of undoable commands
     * @returns {number} Number of commands that can be undone
     */
    getUndoCount() {
        return this.undoStack.length;
    },

    /**
     * Get count of redoable commands
     * @returns {number} Number of commands that can be redone
     */
    getRedoCount() {
        return this.redoStack.length;
    },

    /**
     * Get the last undoable command description
     * @returns {string|null} Description of command that would be undone
     */
    getUndoDescription() {
        if (!this.canUndo()) return null;
        return this.undoStack[this.undoStack.length - 1].description;
    },

    /**
     * Get the last redoable command description
     * @returns {string|null} Description of command that would be redone
     */
    getRedoDescription() {
        if (!this.canRedo()) return null;
        return this.redoStack[this.redoStack.length - 1].description;
    },

    /**
     * Save changelog to file system
     * @returns {Promise<void>} Promise that resolves when saved
     */
    async saveChangelog() {
        if (!this.currentChangelog || !this.currentFileId) {
            throw new Error('No changelog to save');
        }

        await this.saveChangelogToFile(this.currentFileId, this.currentChangelog);
        console.log('Saved changelog with', this.currentChangelog.commands.length, 'commands');
    },

    /**
     * Get all commands from current changelog
     * @param {object} filters - Optional filters for command retrieval
     * @returns {array} Array of command objects
     */
    getCommands(filters = {}) {
        if (!this.currentChangelog) {
            return [];
        }

        let commands = [...this.currentChangelog.commands];

        // Apply filters
        if (filters.type) {
            commands = commands.filter(cmd => cmd.type === filters.type);
        }

        if (filters.undoableOnly) {
            commands = commands.filter(cmd => 
                FileFormats.COMMAND_TYPES[cmd.type]?.undoable
            );
        }

        if (filters.since) {
            const sinceDate = new Date(filters.since);
            commands = commands.filter(cmd => 
                new Date(cmd.timestamp) >= sinceDate
            );
        }

        return commands;
    },

    /**
     * Get changelog statistics
     * @returns {object} Statistics about current changelog
     */
    getStats() {
        if (!this.currentChangelog) {
            return {
                totalCommands: 0,
                undoableCommands: 0,
                undoCount: 0,
                redoCount: 0,
                lastCommand: null
            };
        }

        const commands = this.currentChangelog.commands;
        const undoableCommands = commands.filter(cmd => 
            FileFormats.COMMAND_TYPES[cmd.type]?.undoable
        );

        return {
            totalCommands: commands.length,
            undoableCommands: undoableCommands.length,
            undoCount: this.getUndoCount(),
            redoCount: this.getRedoCount(),
            lastCommand: commands.length > 0 ? commands[commands.length - 1] : null
        };
    },

    /**
     * Clear current changelog session
     */
    clearSession() {
        this.currentFileId = null;
        this.currentChangelog = null;
        this.currentSequence = 0;
        this.undoStack = [];
        this.redoStack = [];
        console.log('Cleared changelog session');
    },

    // === PRIVATE METHODS ===

    /**
     * Generate unique command ID
     * @returns {string} Unique command identifier
     */
    generateCommandId() {
        const timestamp = Date.now();
        const sequence = this.currentSequence.toString().padStart(3, '0');
        return `cmd_${timestamp}_${sequence}`;
    },

    /**
     * Get maximum sequence number from changelog
     * @param {object} changelogData - Changelog data
     * @returns {number} Maximum sequence number
     */
    getMaxSequence(changelogData) {
        if (!changelogData.commands || changelogData.commands.length === 0) {
            return 0;
        }
        
        return Math.max(...changelogData.commands.map(cmd => cmd.sequence || 0));
    },

    /**
     * Load changelog from file system
     * @param {string} fileId - File ID to load changelog for
     * @returns {Promise<object>} Changelog data
     */
    async loadChangelogFromFile(fileId) {
        // This would integrate with FileManager's file operations
        // For now, try localStorage as fallback
        const filename = FileFormats.getChangelogFilename(fileId);
        const storageKey = `changelog_${fileId}`;
        
        const cachedData = localStorage.getItem(storageKey);
        if (cachedData) {
            const changelogData = JSON.parse(cachedData);
            const validation = FileFormats.validateChangelogFile(changelogData);
            
            if (!validation.success) {
                throw new Error('Invalid changelog format: ' + validation.errors.join(', '));
            }
            
            return changelogData;
        }
        
        throw new Error('Changelog file not found');
    },

    /**
     * Save changelog to file system
     * @param {string} fileId - File ID
     * @param {object} changelogData - Changelog data to save
     * @returns {Promise<void>} Promise that resolves when saved
     */
    async saveChangelogToFile(fileId, changelogData) {
        // For now, save to localStorage as fallback
        // This should integrate with FileManager's file operations
        const storageKey = `changelog_${fileId}`;
        const jsonData = JSON.stringify(changelogData, null, 2);
        localStorage.setItem(storageKey, jsonData);
    },

    /**
     * Apply command data to current ledger
     * @param {object} commandData - Data to apply
     * @param {string} commandType - Original command type for context
     * @returns {Promise<void>} Promise that resolves when applied
     */
    async applyCommandData(commandData, commandType) {
        // This would integrate with FileManager to apply changes
        // The specific implementation depends on the command type
        
        if (!FileManager.getCurrentLedger()) {
            throw new Error('No current ledger to apply command to');
        }

        switch (commandType) {
            case 'transaction_add':
                if (commandData.transaction) {
                    FileManager.addTransaction(commandData.transaction);
                }
                break;
                
            case 'transaction_edit':
                if (commandData.transactionId && commandData.updates) {
                    FileManager.updateTransaction(commandData.transactionId, commandData.updates);
                }
                break;
                
            case 'transaction_delete':
                if (commandData.transactionId) {
                    FileManager.deleteTransaction(commandData.transactionId);
                }
                break;
                
            case 'starting_balance_change':
                if (typeof commandData.balance === 'number') {
                    FileManager.updateStartingBalance(commandData.balance);
                }
                break;
                
            default:
                console.warn('Unknown command type for application:', commandType);
        }
    },

    /**
     * Export methods for compatibility
     */
    exports() {
        return {
            init: this.init.bind(this),
            loadChangelog: this.loadChangelog.bind(this),
            recordCommand: this.recordCommand.bind(this),
            undo: this.undo.bind(this),
            redo: this.redo.bind(this),
            canUndo: this.canUndo.bind(this),
            canRedo: this.canRedo.bind(this),
            getUndoCount: this.getUndoCount.bind(this),
            getRedoCount: this.getRedoCount.bind(this),
            getUndoDescription: this.getUndoDescription.bind(this),
            getRedoDescription: this.getRedoDescription.bind(this),
            saveChangelog: this.saveChangelog.bind(this),
            getCommands: this.getCommands.bind(this),
            getStats: this.getStats.bind(this),
            clearSession: this.clearSession.bind(this)
        };
    }
};

// Export for use
window.ChangelogManager = ChangelogManager.exports();
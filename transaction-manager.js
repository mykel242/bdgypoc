// transaction-manager.js
const TransactionManager = {
  // Base storage key for all ledgers
  BASE_STORAGE_KEY: "expense_tracker",

  // Key for storing the ledger list
  LEDGER_LIST_KEY: "expense_tracker_ledgers",

  // Key for storing the currently active ledger
  ACTIVE_LEDGER_KEY: "expense_tracker_active_ledger",

  // Generate a ledger-specific storage key
  getTransactionStorageKey(ledgerName) {
    return `${this.BASE_STORAGE_KEY}_${ledgerName}_transactions`;
  },

  // Get the storage key for starting balance of a specific ledger
  getStartingBalanceKey(ledgerName) {
    return `${this.BASE_STORAGE_KEY}_${ledgerName}_startingBalance`;
  },

  // Get the storage key for starting balance date of a specific ledger
  getStartingBalanceDateKey(ledgerName) {
    return `${this.BASE_STORAGE_KEY}_${ledgerName}_startingBalanceDate`;
  },

  // Generate UUID for transactions
  generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0,
          v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  },

  // Get all available ledgers
  getLedgers() {
    const stored = localStorage.getItem(this.LEDGER_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  // Save the list of ledgers
  saveLedgers(ledgers) {
    localStorage.setItem(this.LEDGER_LIST_KEY, JSON.stringify(ledgers));
  },

  // Create a new ledger
  createLedger(name) {
    const ledgers = this.getLedgers();

    // Check if a ledger with this name already exists
    if (ledgers.includes(name)) {
      return false; // Ledger already exists
    }

    // Add the new ledger
    ledgers.push(name);
    this.saveLedgers(ledgers);

    // If this is the first ledger, make it active
    if (ledgers.length === 1) {
      this.setActiveLedger(name);
    }

    return true;
  },

  // Delete a ledger and all its data
  deleteLedger(name) {
    const ledgers = this.getLedgers();
    const index = ledgers.indexOf(name);

    if (index === -1) {
      return false; // Ledger doesn't exist
    }

    // Remove ledger from list
    ledgers.splice(index, 1);
    this.saveLedgers(ledgers);

    // Clear ledger data
    localStorage.removeItem(this.getTransactionStorageKey(name));
    localStorage.removeItem(this.getStartingBalanceKey(name));
    localStorage.removeItem(this.getStartingBalanceDateKey(name));

    // If the active ledger was deleted and other ledgers exist, select the first one
    if (this.getActiveLedger() === name && ledgers.length > 0) {
      this.setActiveLedger(ledgers[0]);
    } else if (ledgers.length === 0) {
      // If no ledgers left, clear active ledger
      localStorage.removeItem(this.ACTIVE_LEDGER_KEY);
    }

    return true;
  },

  // Get the active ledger
  getActiveLedger() {
    return localStorage.getItem(this.ACTIVE_LEDGER_KEY) || null;
  },

  setActiveLedger(name) {
    localStorage.setItem(this.ACTIVE_LEDGER_KEY, name);
  },

  getTransactions() {
    const activeLedger = this.getActiveLedger();
    if (!activeLedger) {
      return []; // No active ledger
    }

    const stored = localStorage.getItem(
      this.getTransactionStorageKey(activeLedger),
    );
    return stored ? JSON.parse(stored) : [];
  },

  saveTransactions(transactions) {
    const activeLedger = this.getActiveLedger();
    if (!activeLedger) {
      return false; // No active ledger
    }

    localStorage.setItem(
      this.getTransactionStorageKey(activeLedger),
      JSON.stringify(transactions),
    );
    return true;
  },

  getStartingBalance() {
    const activeLedger = this.getActiveLedger();
    if (!activeLedger) {
      return 0; // No active ledger
    }

    const stored = localStorage.getItem(
      this.getStartingBalanceKey(activeLedger),
    );
    return stored ? parseFloat(stored) : 0;
  },

  saveStartingBalance(balance) {
    const activeLedger = this.getActiveLedger();
    if (!activeLedger) {
      return false; // No active ledger
    }

    localStorage.setItem(
      this.getStartingBalanceKey(activeLedger),
      balance.toFixed(2),
    );
    return true;
  },

  getStartingBalanceDate() {
    const activeLedger = this.getActiveLedger();
    if (!activeLedger) {
      return new Date().toISOString().split("T")[0]; // Default to today's date
    }

    const stored = localStorage.getItem(
      this.getStartingBalanceDateKey(activeLedger),
    );
    return stored || new Date().toISOString().split("T")[0]; // Default to today's date
  },

  saveStartingBalanceDate(date) {
    const activeLedger = this.getActiveLedger();
    if (!activeLedger) {
      return false; // No active ledger
    }

    localStorage.setItem(this.getStartingBalanceDateKey(activeLedger), date);
    return true;
  },

  // Create a new transaction object
  createTransaction(data = {}) {
    const transactions = this.getTransactions();
    const highestSequence =
      transactions.length > 0
        ? Math.max(...transactions.map((t) => t.sequence))
        : -1;

    const newTransaction = {
      id: this.generateUUID(),
      sequence: highestSequence + 1,
      date: data.date || new Date().toISOString().split("T")[0],
      description: data.description || "",
      credit: parseFloat(data.credit || 0),
      debit: parseFloat(data.debit || 0),
      isPaid: !!data.isPaid,
      isCleared: !!data.isCleared,
      createdAt: new Date().toISOString(),
    };

    return newTransaction;
  },

  addTransaction(transaction) {
    const transactions = this.getTransactions();
    const newTransaction = this.createTransaction(transaction);
    transactions.push(newTransaction);
    this.saveTransactions(transactions);
    return newTransaction;
  },

  updateTransaction(id, updates) {
    const transactions = this.getTransactions();
    const index = transactions.findIndex((t) => t.id === id);

    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...updates };
      this.saveTransactions(transactions);
      return transactions[index];
    }

    return null;
  },

  deleteTransaction(id) {
    const transactions = this.getTransactions();
    const filtered = transactions.filter((t) => t.id !== id);

    if (filtered.length !== transactions.length) {
      this.saveTransactions(filtered);
      return true;
    }

    return false;
  },

  reorderTransactions(orderedIds) {
    const transactions = this.getTransactions();

    // Create map for quick lookup
    const transactionMap = transactions.reduce((map, transaction) => {
      map[transaction.id] = transaction;
      return map;
    }, {});

    // Create new ordered array
    const ordered = orderedIds
      .map((id, index) => {
        if (transactionMap[id]) {
          return { ...transactionMap[id], sequence: index };
        }
        return null;
      })
      .filter((t) => t !== null);

    this.saveTransactions(ordered);
    return ordered;
  },

  getSortedTransactions() {
    const transactions = this.getTransactions();
    return [...transactions].sort((a, b) => a.sequence - b.sequence);
  },

  clearActiveLedgerData() {
    const activeLedger = this.getActiveLedger();
    if (!activeLedger) {
      return false; // No active ledger
    }

    localStorage.removeItem(this.getTransactionStorageKey(activeLedger));
    localStorage.removeItem(this.getStartingBalanceKey(activeLedger));
    localStorage.removeItem(this.getStartingBalanceDateKey(activeLedger));

    return true;
  },

  clearAllData() {
    const ledgers = this.getLedgers();

    // Clear each ledger's data
    ledgers.forEach((ledger) => {
      localStorage.removeItem(this.getTransactionStorageKey(ledger));
      localStorage.removeItem(this.getStartingBalanceKey(ledger));
      localStorage.removeItem(this.getStartingBalanceDateKey(ledger));
    });

    // Clear ledger list and active ledger
    localStorage.removeItem(this.LEDGER_LIST_KEY);
    localStorage.removeItem(this.ACTIVE_LEDGER_KEY);

    return true;
  },

  // Export ledger data as base64-encoded JSON
  exportLedgerData(ledgerName) {
    // If no ledger name provided, use active ledger
    const targetLedger = ledgerName || this.getActiveLedger();

    if (!targetLedger) {
      return { success: false, message: "No ledger selected" };
    }

    try {
      // Gather all data for this ledger
      const transactions =
        JSON.parse(
          localStorage.getItem(this.getTransactionStorageKey(targetLedger)),
        ) || [];

      const startingBalance =
        parseFloat(
          localStorage.getItem(this.getStartingBalanceKey(targetLedger)),
        ) || 0;

      const startingBalanceDate =
        localStorage.getItem(this.getStartingBalanceDateKey(targetLedger)) ||
        new Date().toISOString().split("T")[0];

      // Create a data object with all ledger information
      const ledgerData = {
        name: targetLedger,
        startingBalance: startingBalance,
        startingBalanceDate: startingBalanceDate,
        transactions: transactions,
        exportDate: new Date().toISOString(),
        version: "1.0",
      };

      // Convert to JSON and then to base64
      const jsonString = JSON.stringify(ledgerData);
      const base64Data = btoa(unescape(encodeURIComponent(jsonString)));

      return {
        success: true,
        data: base64Data,
        ledgerName: targetLedger,
      };
    } catch (error) {
      console.error("Error exporting ledger data:", error);
      return {
        success: false,
        message: "Error exporting ledger data: " + error.message,
      };
    }
  },

  // Import ledger data from base64-encoded string
  importLedgerData(base64Data) {
    try {
      // Decode base64 to JSON
      const jsonString = decodeURIComponent(escape(atob(base64Data)));
      const ledgerData = JSON.parse(jsonString);

      // Validate the data structure
      if (
        !ledgerData.name ||
        !ledgerData.version ||
        !Array.isArray(ledgerData.transactions)
      ) {
        return {
          success: false,
          message: "Invalid ledger data format",
        };
      }

      // Check if a ledger with this name already exists
      const ledgers = this.getLedgers();
      let ledgerName = ledgerData.name;

      // If ledger exists, ask for a different name or allow merging
      if (ledgers.includes(ledgerName)) {
        // Add a suffix to make the name unique
        let counter = 1;
        const baseName = ledgerName;
        while (ledgers.includes(ledgerName)) {
          ledgerName = `${baseName} (Import ${counter})`;
          counter++;
        }
      }

      // Create the new ledger
      this.createLedger(ledgerName);

      // Set starting balance and date
      this.setActiveLedger(ledgerName);
      this.saveStartingBalance(parseFloat(ledgerData.startingBalance) || 0);
      this.saveStartingBalanceDate(
        ledgerData.startingBalanceDate ||
          new Date().toISOString().split("T")[0],
      );

      // Import all transactions
      this.saveTransactions(ledgerData.transactions);

      return {
        success: true,
        message: `Ledger "${ledgerName}" imported successfully`,
        ledgerName: ledgerName,
      };
    } catch (error) {
      console.error("Error importing ledger data:", error);
      return {
        success: false,
        message: "Error importing ledger data: " + error.message,
      };
    }
  },

  // Add to transaction-manager.js
  renameLedger(oldName, newName) {
    // Get all ledgers
    const ledgers = this.getLedgers();

    // Check if old name exists
    if (!ledgers.includes(oldName)) {
      return {
        success: false,
        message: `Ledger "${oldName}" does not exist`,
      };
    }

    // Check if new name already exists
    if (ledgers.includes(newName)) {
      return {
        success: false,
        message: `A ledger named "${newName}" already exists`,
      };
    }

    // Get all data for the old ledger
    const transactionKey = this.getTransactionStorageKey(oldName);
    const startingBalanceKey = this.getStartingBalanceKey(oldName);
    const startingBalanceDateKey = this.getStartingBalanceDateKey(oldName);

    const transactions = localStorage.getItem(transactionKey);
    const startingBalance = localStorage.getItem(startingBalanceKey);
    const startingBalanceDate = localStorage.getItem(startingBalanceDateKey);

    // Create new ledger with the same data
    this.createLedger(newName);

    // Save the old data to the new ledger
    if (transactions) {
      localStorage.setItem(
        this.getTransactionStorageKey(newName),
        transactions,
      );
    }

    if (startingBalance) {
      localStorage.setItem(
        this.getStartingBalanceKey(newName),
        startingBalance,
      );
    }

    if (startingBalanceDate) {
      localStorage.setItem(
        this.getStartingBalanceDateKey(newName),
        startingBalanceDate,
      );
    }

    // Remove the old ledger from the list
    const updatedLedgers = ledgers.filter((name) => name !== oldName);
    updatedLedgers.push(newName);
    this.saveLedgers(updatedLedgers);

    // Check if the old ledger was active, and if so, set the new one as active
    const activeLedger = this.getActiveLedger();
    if (activeLedger === oldName) {
      this.setActiveLedger(newName);
    }

    // Remove old ledger data
    localStorage.removeItem(transactionKey);
    localStorage.removeItem(startingBalanceKey);
    localStorage.removeItem(startingBalanceDateKey);

    return {
      success: true,
      message: `Ledger renamed from "${oldName}" to "${newName}"`,
      newName: newName,
    };
  },

  exports: function () {
    return {
      // Base keys
      BASE_STORAGE_KEY: this.BASE_STORAGE_KEY,
      LEDGER_LIST_KEY: this.LEDGER_LIST_KEY,
      ACTIVE_LEDGER_KEY: this.ACTIVE_LEDGER_KEY,

      // Ledger management
      getLedgers: this.getLedgers.bind(this),
      createLedger: this.createLedger.bind(this),
      deleteLedger: this.deleteLedger.bind(this),
      getActiveLedger: this.getActiveLedger.bind(this),
      setActiveLedger: this.setActiveLedger.bind(this),

      // Transaction methods
      generateUUID: this.generateUUID.bind(this),
      getTransactions: this.getTransactions.bind(this),
      saveTransactions: this.saveTransactions.bind(this),
      getStartingBalance: this.getStartingBalance.bind(this),
      saveStartingBalance: this.saveStartingBalance.bind(this),
      getStartingBalanceDate: this.getStartingBalanceDate.bind(this),
      saveStartingBalanceDate: this.saveStartingBalanceDate.bind(this),
      createTransaction: this.createTransaction.bind(this),
      addTransaction: this.addTransaction.bind(this),
      updateTransaction: this.updateTransaction.bind(this),
      deleteTransaction: this.deleteTransaction.bind(this),
      reorderTransactions: this.reorderTransactions.bind(this),
      getSortedTransactions: this.getSortedTransactions.bind(this),

      // Import/Export
      exportLedgerData: this.exportLedgerData.bind(this),
      importLedgerData: this.importLedgerData.bind(this),
      renameLedger: this.renameLedger.bind(this),

      // Utilities
      clearActiveLedgerData: this.clearActiveLedgerData.bind(this),
      clearAllData: this.clearAllData.bind(this),
    };
  },
};

// Make available globally
window.TransactionManager = TransactionManager.exports();

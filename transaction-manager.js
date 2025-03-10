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

  // Set the active ledger
  setActiveLedger(name) {
    localStorage.setItem(this.ACTIVE_LEDGER_KEY, name);
  },

  // Get transactions for the current active ledger
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

  // Save transactions for the current active ledger
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

  // Get starting balance for the current active ledger
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

  // Save starting balance for the current active ledger
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

  // Get starting balance date for the current active ledger
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

  // Save starting balance date for the current active ledger
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

  // Add a transaction to the current active ledger
  addTransaction(transaction) {
    const transactions = this.getTransactions();
    const newTransaction = this.createTransaction(transaction);
    transactions.push(newTransaction);
    this.saveTransactions(transactions);
    return newTransaction;
  },

  // Update a transaction in the current active ledger
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

  // Delete a transaction from the current active ledger
  deleteTransaction(id) {
    const transactions = this.getTransactions();
    const filtered = transactions.filter((t) => t.id !== id);

    if (filtered.length !== transactions.length) {
      this.saveTransactions(filtered);
      return true;
    }

    return false;
  },

  // Reorder transactions in the current active ledger
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

  // Get transactions sorted by sequence for the current active ledger
  getSortedTransactions() {
    const transactions = this.getTransactions();
    return [...transactions].sort((a, b) => a.sequence - b.sequence);
  },

  // For testing purposes - adds test data to current active ledger
  addTestData() {
    const testData = [
      {
        id: this.generateUUID(),
        sequence: 0,
        date: "2025-03-01",
        description: "Test Income",
        credit: 1000,
        debit: 0,
        isPaid: true,
        isCleared: true,
      },
      {
        id: this.generateUUID(),
        sequence: 1,
        date: "2025-03-05",
        description: "Test Expense",
        credit: 0,
        debit: 350,
        isPaid: true,
        isCleared: false,
      },
    ];

    // Add test data only if there's an active ledger
    if (this.getActiveLedger()) {
      this.saveTransactions(testData);
      return testData;
    }

    return [];
  },

  // Clear all data for the current active ledger
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

  // Clear all data for all ledgers
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

  // Migrate data from the old storage format to the new ledger format
  migrateOldData(ledgerName = "Default Ledger") {
    // Check if the old data exists
    const oldTransactions = localStorage.getItem(
      "expense_tracker_transactions",
    );
    const oldStartingBalance = localStorage.getItem("startingBalance");
    const oldStartingBalanceDate = localStorage.getItem("startingBalanceDate");

    if (!oldTransactions && !oldStartingBalance && !oldStartingBalanceDate) {
      return false; // No old data to migrate
    }

    // Create the new ledger
    this.createLedger(ledgerName);
    this.setActiveLedger(ledgerName);

    // Migrate transactions
    if (oldTransactions) {
      const transactions = JSON.parse(oldTransactions);
      this.saveTransactions(transactions);
    }

    // Migrate starting balance
    if (oldStartingBalance) {
      const balance = parseFloat(oldStartingBalance);
      this.saveStartingBalance(balance);
    }

    // Migrate starting balance date
    if (oldStartingBalanceDate) {
      this.saveStartingBalanceDate(oldStartingBalanceDate);
    }

    // Optionally, clear old data after migration
    localStorage.removeItem("expense_tracker_transactions");
    localStorage.removeItem("startingBalance");
    localStorage.removeItem("startingBalanceDate");

    return true;
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

      // Utilities
      addTestData: this.addTestData.bind(this),
      clearActiveLedgerData: this.clearActiveLedgerData.bind(this),
      clearAllData: this.clearAllData.bind(this),
      migrateOldData: this.migrateOldData.bind(this),
    };
  },
};

// Make available globally
window.TransactionManager = TransactionManager.exports();

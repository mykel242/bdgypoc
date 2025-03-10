// transaction-manager.js
const TransactionManager = {
  STORAGE_KEY: "expense_tracker_transactions",

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

  getTransactions() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  saveTransactions(transactions) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(transactions));
  },

  getStartingBalance() {
    const stored = localStorage.getItem("startingBalance");
    return stored ? parseFloat(stored) : 0;
  },

  saveStartingBalance(balance) {
    localStorage.setItem("startingBalance", balance.toFixed(2));
  },

  getStartingBalanceDate() {
    const stored = localStorage.getItem("startingBalanceDate");
    return normalizeDate(stored);
  },

  saveStartingBalanceDate(date) {
    localStorage.setItem("startingBalanceDate", date);
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

  // Add a transaction
  addTransaction(transaction) {
    const transactions = this.getTransactions();
    const newTransaction = this.createTransaction(transaction);
    transactions.push(newTransaction);
    this.saveTransactions(transactions);
    return newTransaction;
  },

  // Update a transaction
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

  // Delete a transaction
  deleteTransaction(id) {
    const transactions = this.getTransactions();
    const filtered = transactions.filter((t) => t.id !== id);

    if (filtered.length !== transactions.length) {
      this.saveTransactions(filtered);
      return true;
    }

    return false;
  },

  // Reorder transactions
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

  // Get transactions sorted by sequence
  getSortedTransactions() {
    const transactions = this.getTransactions();
    return [...transactions].sort((a, b) => a.sequence - b.sequence);
  },

  // For testing purposes
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
    this.saveTransactions(testData);
    return testData;
  },

  clearAllData() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem("startingBalance");
    localStorage.removeItem("startingBalanceDate");
    return true;
  },

  exports: function () {
    return {
      // Existing exports...
      STORAGE_KEY: this.STORAGE_KEY,
      generateUUID: this.generateUUID,
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
      addTestData: this.addTestData.bind(this),
      clearAllData: this.clearAllData.bind(this),
    };
  },
};

// Make available globally
window.TransactionManager = TransactionManager.exports();

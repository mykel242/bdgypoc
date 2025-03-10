// ledger-renderer.js
const LedgerRenderer = {
  renderLedger(ledgerBody) {
    console.log("Rendering ledger");

    this.clearTransactionRows(ledgerBody);

    // Get actual transactions from the transaction manager
    const transactions = TransactionManager.getTransactions();
    console.log("Transactions to render:", transactions.length);

    // Get reference to totals row
    const totalsRow = ledgerBody.querySelector('tr[data-row-type="totals"]');

    // Render each transaction row
    transactions.forEach((transaction) => {
      const row = this.createTransactionRow(transaction);
      ledgerBody.insertBefore(row, totalsRow);
    });

    // Ensure new transaction row exists
    this.ensureNewTransactionRow(ledgerBody);
  },

  clearTransactionRows(ledgerBody) {
    const rows = Array.from(
      ledgerBody.querySelectorAll(
        'tr:not([data-row-type="starting-balance"]):not([data-row-type="totals"])',
      ),
    );

    rows.forEach((row) => row.remove());
  },

  // Update to createTransactionRow method in ledger-renderer.js
  createTransactionRow(transaction) {
    const row = document.createElement("tr");
    row.dataset.transactionId = transaction.id;
    row.dataset.sequence = transaction.sequence;

    // Add a class to newly created transactions for animation
    // We'll identify newly created transactions by checking if they were created in the last 5 seconds
    const fiveSecondsAgo = new Date(new Date().getTime() - 5000).toISOString();
    if (transaction.createdAt && transaction.createdAt > fiveSecondsAgo) {
      row.classList.add("new-transaction");

      // Remove the class after animation completes
      setTimeout(() => {
        row.classList.remove("new-transaction");
      }, 2000); // Match animation duration
    }

    // Create date cell
    const dateCell = document.createElement("td");
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = transaction.date;
    dateCell.appendChild(dateInput);
    row.appendChild(dateCell);

    // Create description cell
    const descCell = document.createElement("td");
    const descInput = document.createElement("input");
    descInput.type = "text";
    descInput.value = transaction.description;
    descCell.appendChild(descInput);
    row.appendChild(descCell);

    // Create credit cell
    const creditCell = document.createElement("td");
    const creditInput = document.createElement("input");
    creditInput.type = "number";
    creditInput.step = "0.01";
    creditInput.value = transaction.credit > 0 ? transaction.credit : "";
    creditCell.appendChild(creditInput);
    row.appendChild(creditCell);

    // Create debit cell
    const debitCell = document.createElement("td");
    const debitInput = document.createElement("input");
    debitInput.type = "number";
    debitInput.step = "0.01";
    debitInput.value = transaction.debit > 0 ? transaction.debit : "";
    debitCell.appendChild(debitInput);
    row.appendChild(debitCell);

    // Create balance cell (will be calculated later)
    const balanceCell = document.createElement("td");
    balanceCell.textContent = "0.00";
    row.appendChild(balanceCell);

    // Create paid cell
    const paidCell = document.createElement("td");
    const paidCheckbox = document.createElement("input");
    paidCheckbox.type = "checkbox";
    paidCheckbox.checked = transaction.isPaid;
    paidCell.appendChild(paidCheckbox);
    row.appendChild(paidCell);

    // Create cleared cell
    const clearedCell = document.createElement("td");
    const clearedCheckbox = document.createElement("input");
    clearedCheckbox.type = "checkbox";
    clearedCheckbox.checked = transaction.isCleared;
    clearedCell.appendChild(clearedCheckbox);
    row.appendChild(clearedCell);

    return row;
  },

  ensureNewTransactionRow(ledgerBody) {
    console.log("Ensuring new transaction row");

    // Check if a row with id="add-transaction-row" exists
    const existingNewRow = document.getElementById("add-transaction-row");
    const totalsRow = ledgerBody.querySelector('tr[data-row-type="totals"]');

    if (!existingNewRow) {
      console.log("Creating new transaction row");

      // Create a new row
      const newRow = document.createElement("tr");
      newRow.id = "add-transaction-row";

      // Create date cell
      const dateCell = document.createElement("td");
      const dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.value = new Date().toISOString().split("T")[0]; // Today's date
      dateCell.appendChild(dateInput);
      newRow.appendChild(dateCell);

      // Create description cell
      const descCell = document.createElement("td");
      const descInput = document.createElement("input");
      descInput.type = "text";
      descInput.placeholder = "New Transaction";
      descCell.appendChild(descInput);
      newRow.appendChild(descCell);

      // Create credit cell
      const creditCell = document.createElement("td");
      const creditInput = document.createElement("input");
      creditInput.type = "number";
      creditInput.step = "0.01";
      creditCell.appendChild(creditInput);
      newRow.appendChild(creditCell);

      // Create debit cell
      const debitCell = document.createElement("td");
      const debitInput = document.createElement("input");
      debitInput.type = "number";
      debitInput.step = "0.01";
      debitCell.appendChild(debitInput);
      newRow.appendChild(debitCell);

      // Create balance cell
      const balanceCell = document.createElement("td");
      balanceCell.textContent = "0.00";
      newRow.appendChild(balanceCell);

      // Create paid cell
      const paidCell = document.createElement("td");
      const paidCheckbox = document.createElement("input");
      paidCheckbox.type = "checkbox";
      paidCell.appendChild(paidCheckbox);
      newRow.appendChild(paidCell);

      // Create cleared cell
      const clearedCell = document.createElement("td");
      const clearedCheckbox = document.createElement("input");
      clearedCheckbox.type = "checkbox";
      clearedCell.appendChild(clearedCheckbox);
      newRow.appendChild(clearedCell);

      // Insert the new row before the totals row
      ledgerBody.insertBefore(newRow, totalsRow);

      return newRow;
    }

    return existingNewRow;
  },

  // Export for use in other files
  exports() {
    return {
      renderLedger: this.renderLedger.bind(this),
      clearTransactionRows: this.clearTransactionRows.bind(this),
      createTransactionRow: this.createTransactionRow.bind(this),
      ensureNewTransactionRow: this.ensureNewTransactionRow.bind(this),
    };
  },
};

// Make available globally
window.LedgerRenderer = LedgerRenderer.exports();

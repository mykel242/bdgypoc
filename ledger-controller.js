// ledger-controller.js
const LedgerController = {
  init() {
    console.log("Initializing LedgerController");
    this.ledgerBody = document.querySelector("#ledger tbody");

    // Initialize starting balance
    this.initializeStartingBalance();

    // Render the ledger with stored transactions
    this.renderLedger();

    // Set up listeners for all transaction rows
    this.setupEventListeners();
  },

  initializeStartingBalance() {
    const startingBalanceRow = document.querySelector(
      'tr[data-row-type="starting-balance"]',
    );
    if (!startingBalanceRow) return;

    const startingDateInput =
      startingBalanceRow.querySelector('input[type="date"]');
    const startingBalanceCell =
      startingBalanceRow.querySelector("td:nth-child(5)");

    // Load saved date if available - ensure we're using the fixed version
    try {
      const savedDate = TransactionManager.getStartingBalanceDate();
      startingDateInput.value = savedDate;
    } catch (error) {
      console.error("Error setting starting balance date:", error);
      // Fallback to today's date if there's an error
      startingDateInput.value = new Date().toISOString().split("T")[0];
    }

    // Add event listener to save date changes
    startingDateInput.addEventListener("change", () => {
      TransactionManager.saveStartingBalanceDate(startingDateInput.value);
    });

    // Make balance editable
    startingBalanceCell.setAttribute("contenteditable", "true");
    startingBalanceCell.addEventListener("blur", () => {
      const newBalance = parseFloat(startingBalanceCell.textContent) || 0;
      TransactionManager.saveStartingBalance(newBalance);
      this.updateTotals();
    });

    // Load starting balance
    const balance = TransactionManager.getStartingBalance();
    startingBalanceCell.textContent = balance.toFixed(2);
  },

  renderLedger() {
    LedgerRenderer.renderLedger(this.ledgerBody);

    // Set up event listeners for newly created rows
    const transactionRows = this.ledgerBody.querySelectorAll(
      'tr:not([data-row-type="starting-balance"]):not([data-row-type="totals"])',
    );

    transactionRows.forEach((row) => {
      this.setupRowListeners(row);
    });

    // Initial totals update
    this.updateTotals();
  },

  setupEventListeners() {
    // Global event listeners if needed
    document.addEventListener("keydown", (e) => {
      // Handle keyboard shortcuts
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        console.log("Save shortcut pressed");
        // Additional save functionality if needed
      }
    });
  },

  updateTotals() {
    console.log("updateTotals() called");
    const startingBalanceRow = document.querySelector(
      'tr[data-row-type="starting-balance"]',
    );
    if (!startingBalanceRow) return;

    const startingBalanceCell =
      startingBalanceRow.querySelector("td:nth-child(5)");
    const startingBalance = parseFloat(startingBalanceCell.textContent) || 0;

    const rows = Array.from(
      this.ledgerBody.querySelectorAll(
        'tr:not([data-row-type="starting-balance"]):not([data-row-type="totals"])',
      ),
    );

    console.log("Found transaction rows:", rows.length);

    let totalCredit = 0;
    let totalDebit = 0;
    let runningBalance = startingBalance;

    rows.forEach((row) => {
      const creditInput = row.querySelector("td:nth-child(3) input");
      const debitInput = row.querySelector("td:nth-child(4) input");
      const balanceCell = row.querySelector("td:nth-child(5)");

      const credit = parseFloat(creditInput.value || 0);
      const debit = parseFloat(debitInput.value || 0);

      totalCredit += credit;
      totalDebit += debit;
      runningBalance += credit - debit;

      // Update balance cell
      balanceCell.textContent = runningBalance.toFixed(2);
    });

    // Update totals row
    const totalsRow = this.ledgerBody.querySelector(
      'tr[data-row-type="totals"]',
    );
    if (totalsRow) {
      totalsRow.querySelector("td:nth-child(3)").textContent =
        totalCredit.toFixed(2);

      // Format debit total with parentheses
      const debitTotalCell = totalsRow.querySelector("td:nth-child(4)");
      if (totalDebit > 0) {
        debitTotalCell.textContent = `(${totalDebit.toFixed(2)})`;
      } else {
        debitTotalCell.textContent = "0.00";
      }

      totalsRow.querySelector("td:nth-child(5)").textContent =
        runningBalance.toFixed(2);
    }

    console.log("Final totals:", {
      totalCredit: totalCredit.toFixed(2),
      totalDebit: totalDebit.toFixed(2),
      finalBalance: runningBalance.toFixed(2),
    });
  },

  handleTransactionInput(row) {
    const dateInput = row.querySelector("td:nth-child(1) input");
    const descriptionInput = row.querySelector("td:nth-child(2) input");
    const creditInput = row.querySelector("td:nth-child(3) input");
    const debitInput = row.querySelector("td:nth-child(4) input");
    const paidCheckbox = row.querySelector("td:nth-child(6) input");
    const clearedCheckbox = row.querySelector("td:nth-child(7) input");

    // Set today's date if it's empty
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().split("T")[0];
      console.log("Set date to today:", dateInput.value);
    }

    if (row.id === "add-transaction-row") {
      // Check if this is a filled transaction (description and either credit or debit)
      if (descriptionInput.value && (creditInput.value || debitInput.value)) {
        // Create and save the transaction
        const newTransaction = TransactionManager.addTransaction({
          date: dateInput.value,
          description: descriptionInput.value,
          credit: parseFloat(creditInput.value || 0),
          debit: parseFloat(debitInput.value || 0),
          isPaid: paidCheckbox.checked,
          isCleared: clearedCheckbox.checked,
        });

        console.log("Added new transaction:", newTransaction);

        // Remove the ID from the row and add transaction ID
        row.removeAttribute("id");
        row.dataset.transactionId = newTransaction.id;
        row.dataset.sequence = newTransaction.sequence;

        // Ensure a new empty row exists
        const newRow = LedgerRenderer.ensureNewTransactionRow(this.ledgerBody);
        this.setupRowListeners(newRow);
      }
    } else if (row.dataset.transactionId) {
      // This is an existing transaction - update it
      const transactionId = row.dataset.transactionId;

      // Update the transaction
      TransactionManager.updateTransaction(transactionId, {
        date: dateInput.value,
        description: descriptionInput.value,
        credit: parseFloat(creditInput.value || 0),
        debit: parseFloat(debitInput.value || 0),
        isPaid: paidCheckbox.checked,
        isCleared: clearedCheckbox.checked,
      });

      console.log("Updated transaction:", transactionId);
    }
  },

  setupRowListeners(row) {
    const dateInput = row.querySelector("td:nth-child(1) input");
    const descriptionInput = row.querySelector("td:nth-child(2) input");
    const creditInput = row.querySelector("td:nth-child(3) input");
    const debitInput = row.querySelector("td:nth-child(4) input");
    const paidCheckbox = row.querySelector("td:nth-child(6) input");
    const clearedCheckbox = row.querySelector("td:nth-child(7) input");

    // Add date change event listener
    dateInput.addEventListener("change", () => {
      console.log("Date changed to:", dateInput.value);
      this.handleTransactionInput(row);
    });

    // Listen for credit input
    creditInput.addEventListener("input", () => {
      // If credit has value, clear debit
      if (creditInput.value) {
        debitInput.value = "";
      }
    });

    // Listen for debit input and focus events
    debitInput.addEventListener("input", () => {
      // If debit has value, clear credit
      if (debitInput.value) {
        creditInput.value = "";
      }
      this.formatDebitDisplay(debitInput);
    });

    debitInput.addEventListener("focus", () => {
      // Show actual input text when focused
      debitInput.style.color = "";
      const overlay = debitInput.parentNode.querySelector(".debit-overlay");
      if (overlay) {
        overlay.style.visibility = "hidden";
      }
    });

    // Format debit display on blur
    debitInput.addEventListener("blur", () => {
      console.log("Debit input blur event");
      // Hide input text and show formatted overlay
      if (parseFloat(debitInput.value || 0) > 0) {
        debitInput.style.color = "transparent";
        const overlay = debitInput.parentNode.querySelector(".debit-overlay");
        if (overlay) {
          overlay.style.visibility = "visible";
        }
      }
      this.formatDebitDisplay(debitInput);
      this.handleTransactionInput(row);
      this.updateTotals();
    });

    // Update on blur for other inputs
    creditInput.addEventListener("blur", () => {
      console.log("Credit input blur event");
      this.handleTransactionInput(row);
      this.updateTotals();
    });

    descriptionInput.addEventListener("blur", () => {
      this.handleTransactionInput(row);
      this.updateTotals();
    });

    // Handle checkbox changes
    paidCheckbox.addEventListener("change", () => {
      this.handleTransactionInput(row);
    });

    clearedCheckbox.addEventListener("change", () => {
      this.handleTransactionInput(row);
    });

    // Handle enter key press on inputs
    [creditInput, debitInput, descriptionInput].forEach((input) => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          console.log("Enter key pressed on input");
          input.blur();
        }
      });
    });

    // Format any existing debit value
    this.formatDebitDisplay(debitInput);
  },

  formatDebitDisplay(input) {
    // Get the raw value
    const value = parseFloat(input.value || 0);

    if (value > 0) {
      // Format with parentheses
      const displayValue = `(${value.toFixed(2)})`;

      // Create a formatting overlay if it doesn't exist
      let overlay = input.parentNode.querySelector(".debit-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "debit-overlay";
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.right = "0";
        overlay.style.bottom = "0";
        overlay.style.left = "0";
        overlay.style.pointerEvents = "none";
        overlay.style.textAlign = "right";
        overlay.style.paddingRight = "8px";
        overlay.style.fontFamily = "Courier New, monospace";
        overlay.style.fontSize = "14px";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "flex-end";

        // Ensure parent has position
        input.parentNode.style.position = "relative";
        input.parentNode.appendChild(overlay);
      }

      overlay.textContent = displayValue;

      // Hide input value visually when not focused
      if (document.activeElement !== input) {
        input.style.color = "transparent";
        overlay.style.visibility = "visible";
      } else {
        input.style.color = "";
        overlay.style.visibility = "hidden";
      }
    } else {
      // Remove overlay if exists and value is 0
      const overlay = input.parentNode.querySelector(".debit-overlay");
      if (overlay) {
        overlay.textContent = "";
      }
      input.style.color = "";
    }
  },

  exports() {
    return {
      init: this.init.bind(this),
      updateTotals: this.updateTotals.bind(this),
      renderLedger: this.renderLedger.bind(this),
    };
  },
};

// Make available globally
window.LedgerController = LedgerController.exports();

// ledger-controller.js with multiple ledger support
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

  // Update to the LedgerController's initializeStartingBalance method
  initializeStartingBalance() {
    const startingBalanceRow = document.querySelector(
      'tr[data-row-type="starting-balance"]',
    );
    if (!startingBalanceRow) return;

    const startingDateInput =
      startingBalanceRow.querySelector('input[type="date"]');
    const startingBalanceCell =
      startingBalanceRow.querySelector("td:nth-child(5)");

    // Check if we have an active ledger
    const activeLedger = TransactionManager.getActiveLedger();
    if (!activeLedger) {
      // No active ledger, disable input fields
      startingDateInput.disabled = true;
      startingBalanceCell.textContent = "No ledger selected";
      return;
    }

    // Enable inputs since we have an active ledger
    startingDateInput.disabled = false;

    // Load saved date if available
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

    // Make balance editable but with better controls
    startingBalanceCell.removeAttribute("contenteditable"); // Remove contenteditable

    // Create a properly formatted input
    const balanceInput = document.createElement("input");
    balanceInput.type = "number";
    balanceInput.step = "0.01";
    balanceInput.className = "starting-balance-input";

    // Load starting balance
    const balance = TransactionManager.getStartingBalance();
    balanceInput.value = balance.toFixed(2);

    // Clear the cell and add the input
    startingBalanceCell.textContent = "";
    startingBalanceCell.appendChild(balanceInput);

    // Add event listener for balance changes
    balanceInput.addEventListener("blur", () => {
      const newBalance = parseFloat(balanceInput.value) || 0;
      // Ensure proper formatting
      balanceInput.value = newBalance.toFixed(2);
      TransactionManager.saveStartingBalance(newBalance);
      this.updateTotals();
    });

    // Also listen for Enter key
    balanceInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        balanceInput.blur();
      }
    });
  },

  // Update the renderLedger method to set up drag handlers on all rows
  renderLedger() {
    // Check if we have an active ledger
    const activeLedger = TransactionManager.getActiveLedger();
    if (!activeLedger) {
      // No active ledger, clear the transaction rows
      LedgerRenderer.clearTransactionRows(this.ledgerBody);

      // Update the starting balance row to show "No ledger selected"
      this.initializeStartingBalance();

      // Update totals to show zeros
      this.updateTotals();
      return;
    }

    // Add animation class
    document.body.classList.add("ledger-changing");

    // Render the ledger with transactions from the active ledger
    LedgerRenderer.renderLedger(this.ledgerBody);

    // Set up event listeners for newly created rows
    const transactionRows = this.ledgerBody.querySelectorAll(
      'tr:not([data-row-type="starting-balance"]):not([data-row-type="totals"])',
    );

    transactionRows.forEach((row) => {
      this.setupRowListeners(row);

      // Set up drag handlers for transaction rows (not the "add new" row)
      if (row.dataset.transactionId && window.LedgerSelection) {
        LedgerSelection.setupRowHandlers(row);
      }
    });

    // Format all credit/debit fields on initial render
    transactionRows.forEach((row) => {
      const creditInput = row.querySelector("td:nth-child(3) input");
      const debitInput = row.querySelector("td:nth-child(4) input");

      if (creditInput) this.formatCreditDisplay(creditInput);
      if (debitInput) this.formatDebitDisplay(debitInput);
    });

    // Initial totals update
    this.updateTotals();

    // Clear any selection when re-rendering
    if (window.LedgerSelection) {
      LedgerSelection.clearSelection();
    }

    // Remove animation class after a short delay
    setTimeout(() => {
      document.body.classList.remove("ledger-changing");
    }, 500);
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

  // Updated updateTotals to handle invalid cells
  updateTotals() {
    console.log("updateTotals() called");
    const startingBalanceRow = document.querySelector(
      'tr[data-row-type="starting-balance"]',
    );
    if (!startingBalanceRow) return;

    // Get starting balance from the input element
    const startingBalanceInput = startingBalanceRow.querySelector(
      ".starting-balance-input",
    );
    let startingBalance = 0;

    if (startingBalanceInput) {
      // Get value from input
      startingBalance = parseFloat(startingBalanceInput.value) || 0;

      // Apply negative balance styling to starting balance row if needed
      if (startingBalance < 0) {
        startingBalanceRow.classList.add("negative-balance");
      } else {
        startingBalanceRow.classList.remove("negative-balance");
      }
    } else {
      // Fallback to getting from cell text if input doesn't exist yet
      const startingBalanceCell =
        startingBalanceRow.querySelector("td:nth-child(5)");
      startingBalance = parseFloat(startingBalanceCell.textContent) || 0;

      // Apply negative balance styling to starting balance row if needed
      if (startingBalance < 0) {
        startingBalanceRow.classList.add("negative-balance");
      } else {
        startingBalanceRow.classList.remove("negative-balance");
      }
    }

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

      // Skip if inputs don't exist (might happen when no ledger is selected)
      if (!creditInput || !debitInput || !balanceCell) return;

      // Check if either cell is in error state
      const creditCell = creditInput.closest("td");
      const debitCell = debitInput.closest("td");
      const hasError =
        creditCell.classList.contains("invalid-cell") ||
        debitCell.classList.contains("invalid-cell");

      if (hasError) {
        // For rows with errors, show 0.00 balance and add error class to balance
        balanceCell.textContent = "0.00";
        balanceCell.classList.add("balance-error");

        // Add error class to the row
        row.classList.add("row-with-error");

        // Skip this row in the running balance calculation
        return;
      } else {
        // Clear error state if previously set
        balanceCell.classList.remove("balance-error");
        row.classList.remove("row-with-error");
      }

      const credit = parseFloat(creditInput.value || 0);
      const debit = parseFloat(debitInput.value || 0);

      totalCredit += credit;
      totalDebit += debit;
      runningBalance += credit - debit;

      // Update balance cell
      balanceCell.textContent = runningBalance.toFixed(2);

      // Apply negative balance styling if needed
      if (runningBalance < 0) {
        row.classList.add("negative-balance");
      } else {
        row.classList.remove("negative-balance");
      }
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
        debitTotalCell.classList.add("negative-amount");
      } else {
        debitTotalCell.textContent = "0.00";
        debitTotalCell.classList.remove("negative-amount");
      }

      const totalsBalanceCell = totalsRow.querySelector("td:nth-child(5)");
      totalsBalanceCell.textContent = runningBalance.toFixed(2);

      // Apply negative styling to totals row balance if needed
      if (runningBalance < 0) {
        totalsBalanceCell.classList.add("negative-amount");
      } else {
        totalsBalanceCell.classList.remove("negative-amount");
      }
    }

    console.log("Final totals:", {
      totalCredit: totalCredit.toFixed(2),
      totalDebit: totalDebit.toFixed(2),
      finalBalance: runningBalance.toFixed(2),
    });
  },

  handleTransactionInput(row) {
    // Check if we have an active ledger
    if (!TransactionManager.getActiveLedger()) {
      console.log("No active ledger, can't save transaction");
      return;
    }

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

    // Check if any inputs are in error state
    const creditCell = creditInput.closest("td");
    const debitCell = debitInput.closest("td");
    const hasError =
      creditCell.classList.contains("invalid-cell") ||
      debitCell.classList.contains("invalid-cell");

    // Don't save transactions with errors
    if (hasError) {
      console.log("Transaction has errors, not saving");
      return;
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

    // Set min attribute to 0 for credit and debit inputs
    creditInput.min = "0";
    debitInput.min = "0";

    // Add date change event listener
    dateInput.addEventListener("change", () => {
      console.log("Date changed to:", dateInput.value);
      this.handleTransactionInput(row);
    });

    // Listen for debit input and focus events
    debitInput.addEventListener("input", () => {
      // If debit has value, clear credit
      if (debitInput.value) {
        creditInput.value = "";
        // Also clear any error state from credit
        creditInput.classList.remove("input-error");
        const creditCell = creditInput.closest("td");
        if (creditCell) creditCell.classList.remove("invalid-cell");
      }

      this.formatDebitDisplay(debitInput);
      this.formatCreditDisplay(creditInput);

      this.checkDescriptionField(
        row,
        descriptionInput,
        creditInput,
        debitInput,
      );
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

      // Validate the value on blur
      const isValid = this.validateNumberInput(debitInput);

      // If valid, proceed with normal processing
      if (isValid) {
        // Hide input text and show formatted overlay
        if (parseFloat(debitInput.value || 0) > 0) {
          debitInput.style.color = "transparent";
          const overlay = debitInput.parentNode.querySelector(".debit-overlay");
          if (overlay) {
            overlay.style.visibility = "visible";
          }
        }
        this.formatDebitDisplay(debitInput);
        this.formatCreditDisplay(creditInput);
        this.handleTransactionInput(row);
      }

      // Always update totals
      this.updateTotals();
    });

    descriptionInput.addEventListener("input", () => {
      this.checkDescriptionField(
        row,
        descriptionInput,
        creditInput,
        debitInput,
      );
    });

    descriptionInput.addEventListener("blur", () => {
      const descContainer = descriptionInput.closest("td");

      // When blurring, remove the animation but keep the attention style if needed
      descContainer.classList.remove("description-needed");

      // Only keep the attention style if we still need a description
      const creditValue = parseFloat(creditInput.value || 0);
      const debitValue = parseFloat(debitInput.value || 0);
      const hasValue = creditValue > 0 || debitValue > 0;

      if (!hasValue || descriptionInput.value.trim()) {
        descContainer.classList.remove("description-attention");
      }

      // Then call the existing handler
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

    creditInput.addEventListener("input", () => {
      // If credit has value, clear debit
      if (creditInput.value) {
        debitInput.value = "";
        // Also clear any error state from debit
        debitInput.classList.remove("input-error");
        const debitCell = debitInput.closest("td");
        if (debitCell) debitCell.classList.remove("invalid-cell");

        // Clear debit overlay if exists
        const debitOverlay =
          debitInput.parentNode.querySelector(".debit-overlay");
        if (debitOverlay) {
          debitOverlay.style.visibility = "hidden";
          debitOverlay.textContent = "";
        }
        debitInput.style.color = "";
      }

      this.checkDescriptionField(
        row,
        descriptionInput,
        creditInput,
        debitInput,
      );
    });

    creditInput.addEventListener("focus", () => {
      // Show actual input text when focused
      creditInput.style.color = "";
      const overlay = creditInput.parentNode.querySelector(".credit-overlay");
      if (overlay) {
        overlay.style.visibility = "hidden";
      }
    });

    creditInput.addEventListener("blur", () => {
      // Validate the value on blur
      const isValid = this.validateNumberInput(creditInput);

      // If valid, proceed with normal processing
      if (isValid) {
        const value = parseFloat(creditInput.value || 0);
        if (value > 0) {
          // Apply formatting and hide input text
          this.formatCreditDisplay(creditInput);
          creditInput.style.color = "transparent";
          const overlay =
            creditInput.parentNode.querySelector(".credit-overlay");
          if (overlay) {
            overlay.style.visibility = "visible";
          }
        }
        this.handleTransactionInput(row);
      }

      // Always update totals
      this.updateTotals();
    });

    // Format any existing debit value
    this.formatDebitDisplay(debitInput);
    this.formatCreditDisplay(creditInput);
  },

  // Rest of the methods remain unchanged
  checkDescriptionField(row, descriptionInput, creditInput, debitInput) {
    // Only run this for the new transaction row
    if (row.id !== "add-transaction-row") return;

    const creditValue = parseFloat(creditInput.value || 0);
    const debitValue = parseFloat(debitInput.value || 0);
    const hasValue = creditValue > 0 || debitValue > 0;
    const descContainer = descriptionInput.closest("td");

    if (hasValue && !descriptionInput.value.trim()) {
      // Show animation if we have a credit/debit value but no description
      descContainer.classList.add("description-needed");

      // Add a subtle indication that will remain until description is filled
      descContainer.classList.add("description-attention");
    } else {
      // Remove animation if description is filled or no values
      descContainer.classList.remove("description-needed");

      // If no values, also remove the attention style
      if (!hasValue) {
        descContainer.classList.remove("description-attention");
      }
    }
  },

  // Validate number input and show error state if invalid
  validateNumberInput(input) {
    const value = input.value.trim();

    // If empty, it's valid (zero)
    if (!value) {
      input.classList.remove("input-error");
      const cell = input.closest("td");
      if (cell) cell.classList.remove("invalid-cell");
      return true;
    }

    // Test if the value is a valid positive number
    const isValid =
      /^(\d*\.?\d+|\d+\.?\d*)$/.test(value) && parseFloat(value) >= 0;

    if (!isValid) {
      // Mark as invalid
      input.classList.add("input-error");
      const cell = input.closest("td");
      if (cell) cell.classList.add("invalid-cell");
      return false;
    } else {
      // Clear any error state
      input.classList.remove("input-error");
      const cell = input.closest("td");
      if (cell) cell.classList.remove("invalid-cell");

      // Format to ensure proper numeric value
      input.value = parseFloat(value).toString();
      return true;
    }
  },

  // New helper to clean up numeric input values
  cleanupNumberValue(input) {
    if (!input.value) return;

    let value = input.value;

    // First, try to extract a proper number
    const matches = value.match(/(\d*\.?\d*)/);
    if (matches && matches[0]) {
      // If we got something that looks like a number
      const cleanValue = matches[0];

      // If it's different from what's there, update it
      if (cleanValue !== value) {
        input.value = cleanValue;
      }
    }

    // Ensure we don't have multiple decimal points
    const decimalCount = (value.match(/\./g) || []).length;
    if (decimalCount > 1) {
      // Keep only the first decimal and everything before plus digits after
      const parts = value.split(".");
      input.value = parts[0] + "." + parts.slice(1).join("");
    }

    // Handle specifically the case of double values (e.g., "111.00 2222")
    const spaceSeparated = value.split(/\s+/);
    if (spaceSeparated.length > 1) {
      // Just keep the first value
      input.value = spaceSeparated[0];

      // Visual feedback
      input.classList.add("input-error");
      setTimeout(() => {
        input.classList.remove("input-error");
      }, 500);
    }
  },

  // New helper method to enforce single value in the input field
  setupSingleValueInput(input) {
    // Store the last valid value
    input.setAttribute("data-last-valid-value", "");

    // Check on keydown (before value changes)
    input.addEventListener("keydown", (e) => {
      // Allow navigation keys and special keys
      const allowedKeys = [
        "Backspace",
        "Delete",
        "ArrowLeft",
        "ArrowRight",
        "Tab",
        "Enter",
      ];
      if (allowedKeys.includes(e.key)) return;

      // Allow numeric keys, period, and numpad
      if (
        /^\d$/.test(e.key) ||
        e.key === "." ||
        (e.key.startsWith("Numpad") && !isNaN(parseInt(e.key.slice(6))))
      ) {
        // If input already has a value and selection is not replacing everything
        if (
          input.value &&
          (input.selectionStart !== 0 ||
            input.selectionEnd !== input.value.length)
        ) {
          e.preventDefault();

          // Add shake animation for visual feedback
          input.classList.add("input-error");
          setTimeout(() => {
            input.classList.remove("input-error");
          }, 500);
        }
      } else {
        // Block all other keys
        e.preventDefault();
      }
    });

    // Backup validation on input event
    input.addEventListener("input", function () {
      const currentValue = this.value;

      // If multiple values detected, revert to last valid value
      if ((currentValue.match(/\./g) || []).length > 1) {
        this.value = this.getAttribute("data-last-valid-value") || "";
        return;
      }

      // Save valid value
      this.setAttribute("data-last-valid-value", this.value);
    });
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
        overlay.className = "debit-overlay negative-amount"; // Add negative-amount class
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

  formatCreditDisplay(input) {
    // Get the raw value
    const value = parseFloat(input.value || 0);

    if (value > 0) {
      // Format with 2 decimal places
      const displayValue = `${value.toFixed(2)}`;

      // Create a formatting overlay if it doesn't exist
      let overlay = input.parentNode.querySelector(".credit-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "credit-overlay";
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
      const overlay = input.parentNode.querySelector(".credit-overlay");
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
      initializeStartingBalance: this.initializeStartingBalance.bind(this),
    };
  },
};

// Make available globally
window.LedgerController = LedgerController.exports();

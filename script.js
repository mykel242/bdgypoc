document.addEventListener("DOMContentLoaded", () => {
  const ledgerBody = document.querySelector("#ledger tbody");
  const addTransactionRow = document.querySelector("#add-transaction-row");

  // Expose updateTotals to global scope for debugging
  window.updateTotals = updateTotals;

  // Load or initialize starting balance
  function initializeStartingBalance() {
    const startingBalanceRow = document.querySelector(
      'tr[data-row-type="starting-balance"]',
    );
    const startingDateInput =
      startingBalanceRow.querySelector('input[type="date"]');
    const startingBalanceCell =
      startingBalanceRow.querySelector("td:nth-child(5)");

    // Make balance editable
    startingBalanceCell.setAttribute("contenteditable", "true");
    startingBalanceCell.addEventListener("blur", () => {
      const newBalance = parseFloat(startingBalanceCell.textContent) || 0;
      localStorage.setItem("startingBalance", newBalance.toFixed(2));
      updateTotals();
    });

    // Load starting balance or default to 0
    const storedStartingBalance = localStorage.getItem("startingBalance");
    const balance = storedStartingBalance
      ? parseFloat(storedStartingBalance)
      : 0;
    startingBalanceCell.textContent = balance.toFixed(2);
  }

  // Function to update totals
  function updateTotals() {
    console.log("updateTotals() called");
    const startingBalanceRow = document.querySelector(
      'tr[data-row-type="starting-balance"]',
    );
    const startingBalanceCell =
      startingBalanceRow.querySelector("td:nth-child(5)");
    const startingBalance = parseFloat(startingBalanceCell.textContent) || 0;

    const rows = Array.from(
      ledgerBody.querySelectorAll(
        'tr:not([data-row-type="starting-balance"]):not([data-row-type="totals"])',
      ),
    );

    console.log("Found transaction rows:", rows.length);

    let totalCredit = 0;
    let totalDebit = 0;
    let runningBalance = startingBalance;

    rows.forEach((row, index) => {
      const dateInput = row.querySelector("td:nth-child(1) input");
      const descriptionInput = row.querySelector("td:nth-child(2) input");
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
      console.log(
        `Updated balance for row ${index + 1}:`,
        runningBalance.toFixed(2),
      );
    });

    // Update totals row
    const totalsRow = ledgerBody.querySelector('tr[data-row-type="totals"]');
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

    console.log("Final totals:", {
      totalCredit: totalCredit.toFixed(2),
      totalDebit: totalDebit.toFixed(2),
      finalBalance: runningBalance.toFixed(2),
    });

    // Ensure new transaction row is always at the bottom
    ensureNewTransactionRow();
  }

  // Function to format debit display with parentheses
  function formatDebitDisplay(input) {
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

      // Hide input value visually but keep it for calculations
      input.style.color = "transparent";
    } else {
      // Remove overlay if exists and value is 0
      const overlay = input.parentNode.querySelector(".debit-overlay");
      if (overlay) {
        overlay.textContent = "";
      }
      input.style.color = "";
    }
  }

  // Function to handle transaction input
  function handleTransactionInput(row) {
    const dateInput = row.querySelector("td:nth-child(1) input");
    const descriptionInput = row.querySelector("td:nth-child(2) input");
    const creditInput = row.querySelector("td:nth-child(3) input");
    const debitInput = row.querySelector("td:nth-child(4) input");

    // Set today's date if it's empty
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().split("T")[0];
      console.log("Set date to today:", dateInput.value);
    }

    // Check if this is a filled transaction (description and either credit or debit)
    if (descriptionInput.value && (creditInput.value || debitInput.value)) {
      // This is no longer a "new" row, remove the ID
      row.removeAttribute("id");
      console.log("Converted to regular transaction row");

      // Make sure we have a new empty row
      ensureNewTransactionRow();
    }
  }

  // Ensure new transaction row is always present
  function ensureNewTransactionRow() {
    console.log("Ensuring new transaction row exists");

    // Check if a row with id="add-transaction-row" exists
    const existingNewRow = document.getElementById("add-transaction-row");
    const totalsRow = ledgerBody.querySelector('tr[data-row-type="totals"]');

    if (!existingNewRow) {
      console.log("No new row found, creating one");

      // Clone the template row (we need a reference to it first)
      // If you don't have a template stored, create a new row from scratch
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

      // Setup listeners for the new row
      setupRowListeners(newRow);

      console.log("New transaction row created");
    } else {
      console.log("New row already exists");
    }
  }

  // Setup row-specific listeners
  function setupRowListeners(row) {
    const dateInput = row.querySelector("td:nth-child(1) input");
    const descriptionInput = row.querySelector("td:nth-child(2) input");
    const creditInput = row.querySelector("td:nth-child(3) input");
    const debitInput = row.querySelector("td:nth-child(4) input");

    // Listen for credit input
    creditInput.addEventListener("input", () => {
      // If credit has value, clear debit
      if (creditInput.value) {
        debitInput.value = "";
      }
    });

    // Listen for debit input
    debitInput.addEventListener("input", () => {
      // If debit has value, clear credit
      if (debitInput.value) {
        creditInput.value = "";
      }
      formatDebitDisplay(debitInput);
    });

    // Format debit display on blur
    debitInput.addEventListener("blur", () => {
      console.log("Debit input blur event");
      formatDebitDisplay(debitInput);
      handleTransactionInput(row);
      updateTotals();
    });

    // Update on blur for all inputs
    creditInput.addEventListener("blur", () => {
      console.log("Credit input blur event");
      handleTransactionInput(row);
      updateTotals();
    });

    descriptionInput.addEventListener("blur", () => {
      handleTransactionInput(row);
      updateTotals();
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
    formatDebitDisplay(debitInput);
  }

  // Initialize
  document.querySelectorAll('input[type="number"]').forEach((input) => {
    if (input.closest("td:nth-child(4)")) {
      formatDebitDisplay(input);
    }
  });

  // Initial setup for existing rows
  ledgerBody
    .querySelectorAll(
      'tr:not([data-row-type="starting-balance"]):not([data-row-type="totals"])',
    )
    .forEach(setupRowListeners);

  // Initialize starting balance
  initializeStartingBalance();

  // Ensure new transaction row is always present
  ensureNewTransactionRow();

  // Initial totals update
  updateTotals();
});

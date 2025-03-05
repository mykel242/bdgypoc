document.addEventListener("DOMContentLoaded", () => {
  const ledgerBody = document.querySelector("#ledger tbody");
  const addTransactionRow = document.querySelector("#add-transaction-row");

  // Expose updateTotals to global scope for debugging
  window.updateTotals = updateTotals;

  window.ensureNewTransactionRow = ensureNewTransactionRow;

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

  function updateTotals() {
    console.log("updateTotals() called");

    // Debug starting balance
    const startingBalanceRow = document.querySelector(
      'tr[data-row-type="starting-balance"]',
    );
    const startingBalanceCell =
      startingBalanceRow.querySelector("td:nth-child(5)");
    const startingBalance = parseFloat(startingBalanceCell.textContent) || 0;
    console.log("Starting balance:", startingBalance);

    // Debug row selection
    const rows = Array.from(
      ledgerBody.querySelectorAll(
        'tr:not([data-row-type="starting-balance"]):not([data-row-type="totals"])',
      ),
    );
    console.log("Found transaction rows:", rows.length);

    let totalCredit = 0;
    let totalDebit = 0;
    let runningBalance = startingBalance;

    // Debug each row's calculation
    rows.forEach((row, index) => {
      const dateInput = row.querySelector("td:nth-child(1) input");
      const descriptionInput = row.querySelector("td:nth-child(2) input");
      const creditInput = row.querySelector("td:nth-child(3) input");
      const debitInput = row.querySelector("td:nth-child(4) input");
      const balanceCell = row.querySelector("td:nth-child(5)");

      console.log(`Row ${index + 1}:`, {
        date: dateInput.value,
        description: descriptionInput.value,
        creditRaw: creditInput.value,
        debitRaw: debitInput.value,
      });

      const credit = parseFloat(creditInput.value || 0);
      const debit = parseFloat(debitInput.value || 0);

      totalCredit += credit;
      totalDebit += debit;
      runningBalance += credit - debit;

      console.log(`Calculation for row ${index + 1}:`, {
        credit: credit,
        debit: debit,
        newBalance: runningBalance,
      });

      // Set the balance and verify it was set
      balanceCell.textContent = runningBalance.toFixed(2);
      console.log(
        `Set balance cell to: ${runningBalance.toFixed(2)}, actual content now: ${balanceCell.textContent}`,
      );
    });

    // Update totals row
    const totalsRow = ledgerBody.querySelector('tr[data-row-type="totals"]');
    totalsRow.querySelector("td:nth-child(3)").textContent =
      totalCredit.toFixed(2);
    totalsRow.querySelector("td:nth-child(4)").textContent =
      totalDebit.toFixed(2);
    totalsRow.querySelector("td:nth-child(5)").textContent =
      runningBalance.toFixed(2);

    console.log("Final totals:", {
      totalCredit: totalCredit.toFixed(2),
      totalDebit: totalDebit.toFixed(2),
      finalBalance: runningBalance.toFixed(2),
    });
  }

  // Function to ensure a new transaction row is always present
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
      descInput.placeholder = "Description";
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

  // When a new row is filled in, remove the id="add-transaction-row"
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

  function setupRowListeners(row) {
    const dateInput = row.querySelector("td:nth-child(1) input");
    const descriptionInput = row.querySelector("td:nth-child(2) input");
    const creditInput = row.querySelector("td:nth-child(3) input");
    const debitInput = row.querySelector("td:nth-child(4) input");

    // Only update on blur or submit for credit/debit inputs
    creditInput.addEventListener("blur", () => {
      console.log("Credit input blur event");
      handleTransactionInput(row);
      updateTotals();
    });

    debitInput.addEventListener("blur", () => {
      console.log("Debit input blur event");
      handleTransactionInput(row);
      updateTotals();
    });

    // Handle enter key press on inputs
    [creditInput, debitInput].forEach((input) => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          console.log("Enter key pressed on input");
          input.blur();
          updateTotals();
        }
      });
    });
  }

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

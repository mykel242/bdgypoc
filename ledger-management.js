// ledger-management.js
const LedgerManager = {
  init() {
    console.log("Initializing LedgerManager");

    // Check if we need to migrate old data
    this.checkAndMigrateOldData();

    // Initialize ledger selector with available ledgers
    this.updateLedgerSelector();

    // Set up event listeners
    this.setupEventListeners();
  },

  checkAndMigrateOldData() {
    // Check if we have any ledgers already
    const ledgers = TransactionManager.getLedgers();

    // If no ledgers, check for old data to migrate
    if (ledgers.length === 0) {
      const oldTransactions = localStorage.getItem(
        "expense_tracker_transactions",
      );
      if (oldTransactions) {
        // Ask user if they want to migrate
        const confirmMigrate = confirm(
          "Found existing transaction data. Would you like to migrate it to a new ledger?",
        );

        if (confirmMigrate) {
          const ledgerName = prompt(
            "Enter a name for your ledger:",
            "My Ledger",
          );

          if (ledgerName) {
            TransactionManager.migrateOldData(ledgerName);
            alert(`Data successfully migrated to "${ledgerName}" ledger.`);
          }
        }
      }
    }
  },

  updateLedgerSelector() {
    const selector = document.getElementById("ledger-selector");

    // Clear existing options
    selector.innerHTML = "";

    // Get all ledgers and active ledger
    const ledgers = TransactionManager.getLedgers();
    const activeLedger = TransactionManager.getActiveLedger();

    if (ledgers.length === 0) {
      // No ledgers available - create a default option
      const defaultOption = document.createElement("option");
      defaultOption.disabled = true;
      defaultOption.selected = true;
      defaultOption.textContent = "No ledgers";
      defaultOption.value = "";
      selector.appendChild(defaultOption);

      // Disable the selector and delete button
      selector.disabled = true;
      document.getElementById("delete-ledger-btn").disabled = true;
      return;
    }

    // Add options for each ledger
    ledgers.forEach((ledger) => {
      const option = document.createElement("option");
      option.value = ledger;
      option.textContent = ledger;

      // Select the active ledger
      if (ledger === activeLedger) {
        option.selected = true;
      }

      selector.appendChild(option);
    });

    // Enable the selector and delete button
    selector.disabled = false;
    document.getElementById("delete-ledger-btn").disabled = false;

    // Set active ledger if not already set
    if (!activeLedger && ledgers.length > 0) {
      TransactionManager.setActiveLedger(ledgers[0]);
    }
  },

  setupEventListeners() {
    // Handle ledger selection change
    const selector = document.getElementById("ledger-selector");
    selector.addEventListener("change", (e) => {
      const selectedLedger = e.target.value;

      if (selectedLedger) {
        TransactionManager.setActiveLedger(selectedLedger);

        // Refresh the starting balance first
        if (window.LedgerController) {
          LedgerController.initializeStartingBalance();
        }

        // Then refresh the ledger display
        if (window.LedgerController) {
          LedgerController.renderLedger();
        }
      }
    });

    // Handle new ledger button click
    document.getElementById("new-ledger-btn").addEventListener("click", () => {
      const name = prompt(
        "Enter a name for the new ledger:",
        `Ledger ${new Date().toLocaleDateString()}`,
      );

      if (name) {
        // Check if ledger name already exists
        const ledgers = TransactionManager.getLedgers();
        if (ledgers.includes(name)) {
          alert(
            `A ledger named "${name}" already exists. Please choose a different name.`,
          );
          return;
        }

        // Create the new ledger
        TransactionManager.createLedger(name);

        // Set it as active
        TransactionManager.setActiveLedger(name);

        // Update the UI
        this.updateLedgerSelector();

        // Initialize the starting balance field
        if (window.LedgerController) {
          LedgerController.initializeStartingBalance();
        }

        // Refresh the ledger display
        if (window.LedgerController) {
          LedgerController.renderLedger();
        }
      }
    });

    // Handle delete ledger button click
    document
      .getElementById("delete-ledger-btn")
      .addEventListener("click", () => {
        const activeLedger = TransactionManager.getActiveLedger();

        if (activeLedger) {
          const confirmDelete = confirm(
            `Are you sure you want to delete the ledger "${activeLedger}"? This action cannot be undone.`,
          );

          if (confirmDelete) {
            TransactionManager.deleteLedger(activeLedger);

            // Update the UI
            this.updateLedgerSelector();

            // Refresh the ledger display
            if (window.LedgerController) {
              LedgerController.renderLedger();
            }
          }
        } else {
          alert("No ledger selected.");
        }
      });

    document
      .getElementById("print-ledger-btn")
      .addEventListener("click", () => {
        const activeLedger = TransactionManager.getActiveLedger();
        if (!activeLedger) {
          alert("Please select a ledger to print.");
          return;
        }

        // Create a print-friendly version
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
          alert("Please allow pop-ups to print the ledger.");
          return;
        }

        // Create a clean version of the table data
        const printTable = document.createElement("table");
        printTable.className = "print-table";

        // Clone the header
        const thead = document.querySelector("#ledger thead").cloneNode(true);
        printTable.appendChild(thead);

        // Create new tbody
        const tbody = document.createElement("tbody");

        // Add starting balance row
        const startingBalanceRow = document.querySelector(
          'tr[data-row-type="starting-balance"]',
        );
        const sbDate =
          startingBalanceRow.querySelector('input[type="date"]').value;
        const sbBalance = startingBalanceRow
          .querySelector("td:nth-child(5)")
          .textContent.trim();

        const sbPrintRow = document.createElement("tr");
        sbPrintRow.className = "starting-balance-row";
        sbPrintRow.innerHTML = `
        <td>${formatDate(sbDate)}</td>
        <td>Starting Balance</td>
        <td></td>
        <td></td>
        <td>${sbBalance}</td>
        <td></td>
        <td></td>
      `;
        tbody.appendChild(sbPrintRow);

        // Add transaction rows
        const transactionRows = document.querySelectorAll(
          "tr[data-transaction-id]",
        );
        transactionRows.forEach((row) => {
          const date = row.querySelector("td:nth-child(1) input").value;
          const desc = row.querySelector("td:nth-child(2) input").value;
          let credit = row.querySelector("td:nth-child(3) input").value;
          let debit = row.querySelector("td:nth-child(4) input").value;
          const balance = row
            .querySelector("td:nth-child(5)")
            .textContent.trim();
          const isPaid = row.querySelector("td:nth-child(6) input").checked;
          const isCleared = row.querySelector("td:nth-child(7) input").checked;

          // Format credit and debit
          credit = credit ? parseFloat(credit).toFixed(2) : "";
          debit = debit ? `(${parseFloat(debit).toFixed(2)})` : "";

          const printRow = document.createElement("tr");
          printRow.innerHTML = `
          <td>${formatDate(date)}</td>
          <td>${desc}</td>
          <td>${credit}</td>
          <td>${debit}</td>
          <td>${balance}</td>
          <td>${isPaid ? "✓" : ""}</td>
          <td>${isCleared ? "✓" : ""}</td>
        `;
          tbody.appendChild(printRow);
        });

        // Add totals row
        const totalsRow = document.querySelector('tr[data-row-type="totals"]');
        const totalCredit = totalsRow
          .querySelector("td:nth-child(3)")
          .textContent.trim();
        const totalDebit = totalsRow
          .querySelector("td:nth-child(4)")
          .textContent.trim();
        const finalBalance = totalsRow
          .querySelector("td:nth-child(5)")
          .textContent.trim();

        const totalsPrintRow = document.createElement("tr");
        totalsPrintRow.className = "totals-row";
        totalsPrintRow.innerHTML = `
        <td><strong>Totals</strong></td>
        <td></td>
        <td>${totalCredit}</td>
        <td>${totalDebit}</td>
        <td>${finalBalance}</td>
        <td></td>
        <td></td>
      `;
        tbody.appendChild(totalsPrintRow);

        printTable.appendChild(tbody);

        // Helper function to format date
        function formatDate(dateStr) {
          if (!dateStr) return "";
          try {
            const date = new Date(dateStr);
            return date.toLocaleDateString();
          } catch (e) {
            return dateStr;
          }
        }

        // Basic print styles
        const printStyles = `
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; }
        h1 { text-align: center; color: #333; margin-bottom: 5px; }
        .print-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .print-date { color: #666; }

        /* Alignment styles */
        td:nth-child(3), td:nth-child(4), td:nth-child(5),
        th:nth-child(3), th:nth-child(4), th:nth-child(5) {
          text-align: right;
          font-family: "Courier New", monospace;
        }

        /* Style the starting balance and totals rows */
        .starting-balance-row { background-color: #f5f5f5; }
        .totals-row { background-color: #f0f0f0; font-weight: bold; border-top: 2px solid #ddd; }

        /* Center the checkmarks */
        td:nth-child(6), td:nth-child(7) {
          text-align: center;
        }
      `;

        // Get formatted date
        const today = new Date();
        const formattedDate = today.toLocaleDateString();

        // Create print HTML
        printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Budgie - ${activeLedger}</title>
            <style>${printStyles}</style>
          </head>
          <body>
            <div class="print-header">
              <h1>Budgie - ${activeLedger}</h1>
              <div class="print-date">Printed on: ${formattedDate}</div>
            </div>
            <div>${printTable.outerHTML}</div>
          </body>
        </html>
      `);

        printWindow.document.close();

        // Wait for resources to load then print
        setTimeout(() => {
          printWindow.print();
        }, 500);
      });
  },

  exports() {
    return {
      init: this.init.bind(this),
      updateLedgerSelector: this.updateLedgerSelector.bind(this),
    };
  },
};

// Make available globally
window.LedgerManager = LedgerManager.exports();

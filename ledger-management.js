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

        // Get the table data
        const table = document.getElementById("ledger");
        const tableClone = table.cloneNode(true);

        // Basic print styles
        const printStyles = `
          body { font-family: Arial, sans-serif; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
          h1 { text-align: center; color: #333; }
          .print-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .print-date { color: #666; }
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
              <div>${tableClone.outerHTML}</div>
            </body>
          </html>
        `);

        printWindow.document.close();

        // Wait for resources to load then print
        setTimeout(() => {
          printWindow.print();
          // Optional: close the window after printing
          // printWindow.close();
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

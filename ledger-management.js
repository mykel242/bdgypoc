// ledger-management.js
const LedgerManager = {
  init() {
    console.log("Initializing LedgerManager");

    // Add ledger management UI to the page
    this.createLedgerUI();

    // Check if we need to migrate old data
    this.checkAndMigrateOldData();

    // Initialize ledger selector with available ledgers
    this.updateLedgerSelector();

    // Set up event listeners
    this.setupEventListeners();
  },

  createLedgerUI() {
    // Create a container for the ledger management UI
    const container = document.createElement("div");
    container.className = "ledger-management";
    container.style.marginBottom = "20px";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";

    // Left side: ledger selector and actions
    const leftSide = document.createElement("div");
    leftSide.style.display = "flex";
    leftSide.style.alignItems = "center";
    leftSide.style.gap = "10px";

    // Create ledger selector
    const ledgerSelector = document.createElement("select");
    ledgerSelector.id = "ledger-selector";
    ledgerSelector.style.padding = "8px";
    ledgerSelector.style.borderRadius = "4px";
    ledgerSelector.style.border = "1px solid #ddd";

    // Add an option group label
    const label = document.createElement("option");
    label.disabled = true;
    label.textContent = "Select Ledger:";
    label.value = "";
    ledgerSelector.appendChild(label);

    leftSide.appendChild(ledgerSelector);

    // Create new ledger button
    const newLedgerBtn = document.createElement("button");
    newLedgerBtn.id = "new-ledger-btn";
    newLedgerBtn.textContent = "New Ledger";
    newLedgerBtn.className = "ledger-btn";
    leftSide.appendChild(newLedgerBtn);

    // Create delete ledger button
    const deleteLedgerBtn = document.createElement("button");
    deleteLedgerBtn.id = "delete-ledger-btn";
    deleteLedgerBtn.textContent = "Delete Ledger";
    deleteLedgerBtn.className = "ledger-btn danger";
    leftSide.appendChild(deleteLedgerBtn);

    container.appendChild(leftSide);

    // Right side: current ledger info
    const rightSide = document.createElement("div");

    // Create current ledger display
    const currentLedger = document.createElement("div");
    currentLedger.id = "current-ledger-display";
    currentLedger.textContent = "No ledger selected";
    currentLedger.style.fontSize = "16px";
    currentLedger.style.fontWeight = "bold";
    rightSide.appendChild(currentLedger);

    container.appendChild(rightSide);

    // Add styles for the ledger buttons
    const style = document.createElement("style");
    style.textContent = `
      .ledger-btn {
        padding: 8px 12px;
        border-radius: 4px;
        border: none;
        background-color: #4a90e2;
        color: white;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s;
      }

      .ledger-btn:hover {
        background-color: #357ae8;
      }

      .ledger-btn.danger {
        background-color: #e74c3c;
      }

      .ledger-btn.danger:hover {
        background-color: #c0392b;
      }
    `;
    document.head.appendChild(style);

    // Insert into the DOM before the main table
    const table = document.getElementById("ledger");
    table.parentNode.insertBefore(container, table);
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
    const currentLedgerDisplay = document.getElementById(
      "current-ledger-display",
    );

    // Clear existing options, keeping only the first (label) option
    while (selector.options.length > 1) {
      selector.remove(1);
    }

    // Get all ledgers and active ledger
    const ledgers = TransactionManager.getLedgers();
    const activeLedger = TransactionManager.getActiveLedger();

    if (ledgers.length === 0) {
      // No ledgers available
      selector.disabled = true;
      document.getElementById("delete-ledger-btn").disabled = true;
      currentLedgerDisplay.textContent = "No ledgers available";
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

    // Update the current ledger display
    if (activeLedger) {
      currentLedgerDisplay.textContent = `Current Ledger: ${activeLedger}`;
    } else if (ledgers.length > 0) {
      // No active ledger but we have ledgers - select the first one
      TransactionManager.setActiveLedger(ledgers[0]);
      currentLedgerDisplay.textContent = `Current Ledger: ${ledgers[0]}`;
    }
  },

  setupEventListeners() {
    // Handle ledger selection change
    const selector = document.getElementById("ledger-selector");
    selector.addEventListener("change", (e) => {
      const selectedLedger = e.target.value;

      if (selectedLedger) {
        TransactionManager.setActiveLedger(selectedLedger);
        document.getElementById("current-ledger-display").textContent =
          `Current Ledger: ${selectedLedger}`;

        // Refresh the ledger display
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

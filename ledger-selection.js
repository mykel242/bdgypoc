// ledger-selection.js
const LedgerSelection = {
  selectedRowId: null,

  init() {
    console.log("Initializing LedgerSelection");
    this.ledgerBody = document.querySelector("#ledger tbody");

    // Add global click listener to handle row selection
    this.ledgerBody.addEventListener("click", (e) => {
      this.handleRowClick(e);
    });

    // Add global click listener to detect clicks outside the table (to deselect)
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#ledger")) {
        this.clearSelection();
      }
    });
  },

  handleRowClick(e) {
    // Find the closest row to the clicked element
    const row = e.target.closest("tr");

    // Ignore clicks on starting-balance row, totals row, or the new transaction row
    if (
      !row ||
      row.dataset.rowType === "starting-balance" ||
      row.dataset.rowType === "totals" ||
      row.id === "add-transaction-row"
    ) {
      return;
    }

    // Also ignore clicks on input elements in the starting balance row
    // (belt and suspenders approach)
    if (e.target.closest('tr[data-row-type="starting-balance"]')) {
      return;
    }

    // Get transaction ID
    const transactionId = row.dataset.transactionId;
    if (!transactionId) return;

    // If already selected, don't do anything (actions will handle it)
    if (e.target.closest(".row-actions") || e.target.closest(".row-handle")) {
      return;
    }

    // Toggle selection
    if (this.selectedRowId === transactionId) {
      this.clearSelection();
    } else {
      this.selectRow(transactionId);
    }
  },

  selectRow(transactionId) {
    // Clear any existing selection
    this.clearSelection();

    // Find the row with this transaction ID
    const row = this.ledgerBody.querySelector(
      `tr[data-transaction-id="${transactionId}"]`,
    );
    if (!row) return;

    // Set the selected row ID
    this.selectedRowId = transactionId;

    // Add selected class
    row.classList.add("selected-row");

    // Add the drag handle (left side)
    const firstCell = row.querySelector("td:first-child");
    const dragHandle = document.createElement("div");
    dragHandle.className = "row-handle";
    dragHandle.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 18h8v-2H8v2zm0-4h8v-2H8v2zm0-4h8V8H8v2zm-4 8h2v-2H4v2zm0-4h2v-2H4v2zm0-4h2V8H4v2zm0-4h2V4H4v2zm16 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V8h2v2zm0-4h-2V4h2v2z"></path></svg>';
    firstCell.prepend(dragHandle);

    // Add the action buttons (right side)
    const lastCell = row.querySelector("td:last-child");
    const actionButtons = document.createElement("div");
    actionButtons.className = "row-actions";

    // Delete button with trash icon
    const deleteButton = document.createElement("button");
    deleteButton.className = "action-delete";
    deleteButton.title = "Delete transaction";
    deleteButton.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>';

    // Add delete event handler
    deleteButton.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent event bubbling
      this.deleteSelectedTransaction();
    });

    actionButtons.appendChild(deleteButton);
    lastCell.appendChild(actionButtons);
  },

  clearSelection() {
    if (!this.selectedRowId) return;

    // Find the currently selected row
    const selectedRow = this.ledgerBody.querySelector(".selected-row");
    if (selectedRow) {
      // Remove selected class
      selectedRow.classList.remove("selected-row");

      // Remove drag handle
      const dragHandle = selectedRow.querySelector(".row-handle");
      if (dragHandle) dragHandle.remove();

      // Remove action buttons
      const actionButtons = selectedRow.querySelector(".row-actions");
      if (actionButtons) actionButtons.remove();
    }

    // Clear selected row ID
    this.selectedRowId = null;
  },

  deleteSelectedTransaction() {
    if (!this.selectedRowId) return;

    // Ask for confirmation
    if (confirm("Are you sure you want to delete this transaction?")) {
      // Delete the transaction
      TransactionManager.deleteTransaction(this.selectedRowId);

      // Refresh the ledger display
      LedgerController.renderLedger();

      // Clear selection
      this.clearSelection();
    }
  },

  // Export for use in other files
  exports() {
    return {
      init: this.init.bind(this),
      selectRow: this.selectRow.bind(this),
      clearSelection: this.clearSelection.bind(this),
    };
  },
};

// Make available globally
window.LedgerSelection = LedgerSelection.exports();

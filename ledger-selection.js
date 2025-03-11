// ledger-selection.js
const LedgerSelection = {
  selectedRowId: null,
  isDragging: false,
  draggedRow: null,
  dragStartY: 0,
  dragCard: null,
  dropIndicator: null,
  rowHeight: 0,

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

    // Initialize drag and drop
    this.initDragAndDrop();

    // Add mutation observer to add drag handlers to new rows
    this.observeNewRows();

    // Initialize drag handlers on all existing transaction rows
    this.setupExistingRows();
  },

  // Add drag handlers to all existing transaction rows
  setupExistingRows() {
    const rows = this.ledgerBody.querySelectorAll("tr[data-transaction-id]");
    rows.forEach((row) => {
      this.setupRowHandlers(row);
    });
  },

  initDragAndDrop() {
    console.log("Initializing drag and drop functionality");

    // Create the drag card element first
    this.createDragElements();

    // Add global drag event listeners
    document.addEventListener("dragover", (e) => this.handleDragOver(e));
    document.addEventListener("drop", (e) => this.handleDrop(e));
    document.addEventListener("dragend", () => this.handleDragEnd());
  },

  // New method to create drag elements
  createDragElements() {
    // Create the drop indicator element (will be shown between rows)
    this.dropIndicator = document.createElement("div");
    this.dropIndicator.className = "drop-indicator";
    this.dropIndicator.style.display = "none";
    document.body.appendChild(this.dropIndicator);

    // Create the drag card element (will follow the cursor)
    this.dragCard = document.createElement("div");
    this.dragCard.className = "drag-card";
    this.dragCard.style.display = "none";
    document.body.appendChild(this.dragCard);
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

  // Add this to the existing setupRowHandlers method or create it if it doesn't exist
  setupRowHandlers(row) {
    // Get transaction ID from the row
    const transactionId = row.dataset.transactionId;
    if (!transactionId) return;

    // Check if this row already has a drag handle
    if (row.querySelector(".row-handle")) return;

    // Create and add the drag handle
    const firstCell = row.querySelector("td:first-child");
    const dragHandle = document.createElement("div");
    dragHandle.className = "row-handle";
    dragHandle.title = "Drag to reorder";
    dragHandle.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 18h8v-2H8v2zm0-4h8v-2H8v2zm0-4h8V8H8v2zm-4 8h2v-2H4v2zm0-4h2v-2H4v2zm0-4h2V8H4v2zm0-4h2V4H4v2zm16 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V8h2v2zm0-4h-2V4h2v2z"></path></svg>';

    // Make the row draggable via the handle
    dragHandle.draggable = true;

    // Set up drag start handler
    dragHandle.addEventListener("dragstart", (e) => {
      this.handleDragStart(e, row);
    });

    firstCell.prepend(dragHandle);
  },

  handleDragStart(e, row) {
    // Ensure drag elements exist
    if (!this.dragCard || !this.dropIndicator) {
      this.createDragElements();
    }

    // Get transaction ID from the row
    const transactionId = row.dataset.transactionId;
    if (!transactionId) return;

    // Store reference to the dragged row
    this.draggedRow = row;
    this.isDragging = true;

    // Store initial drag position
    this.dragStartY = e.clientY;

    // Get the height of the row for positioning calculations
    this.rowHeight = row.offsetHeight;

    // Set the drag data
    e.dataTransfer.setData("text/plain", transactionId);

    // Set drag effect
    e.dataTransfer.effectAllowed = "move";

    // Create a visual representation of the dragged item
    this.updateDragCard(row);

    // Add a dragging class to the row
    row.classList.add("dragging");

    // Add dragging class to body to prevent text selection
    document.body.classList.add("dragging");

    // Set the drag image to the drag card
    // Use setTimeout to ensure the card is rendered before setting as dragImage
    setTimeout(() => {
      if (this.dragCard) {
        e.dataTransfer.setDragImage(
          this.dragCard,
          this.dragCard.offsetWidth / 2,
          30,
        );
      }
    }, 0);
  },

  // Renamed from createDragCard to updateDragCard
  updateDragCard(row) {
    // Ensure dragCard exists
    if (!this.dragCard) {
      this.createDragElements();
    }

    // Get data from the row
    const dateInput = row.querySelector("td:nth-child(1) input");
    const descInput = row.querySelector("td:nth-child(2) input");
    const creditInput = row.querySelector("td:nth-child(3) input");
    const debitInput = row.querySelector("td:nth-child(4) input");

    const date = dateInput ? dateInput.value : "";
    const description = descInput ? descInput.value : "";
    const credit = creditInput ? parseFloat(creditInput.value || 0) : 0;
    const debit = debitInput ? parseFloat(debitInput.value || 0) : 0;

    // Format the date for better display
    let formattedDate = date;
    try {
      if (date) {
        const dateObj = new Date(date);
        formattedDate = dateObj.toLocaleDateString();
      }
    } catch (e) {
      // If date formatting fails, use the original date
      formattedDate = date;
    }

    // Update the drag card with the row data
    this.dragCard.innerHTML = `
      <div class="drag-card-date">${formattedDate}</div>
      <div class="drag-card-description">${description}</div>
      <div class="drag-card-amount ${credit > 0 ? "credit" : "debit"}">
        ${credit > 0 ? `$${credit.toFixed(2)}` : `($${debit.toFixed(2)})`}
      </div>
    `;

    // Display the drag card
    this.dragCard.style.display = "block";

    // Position the drag card near the cursor
    this.dragCard.style.left = `${event.clientX}px`;
    this.dragCard.style.top = `${event.clientY - 30}px`;
  },

  handleDragOver(e) {
    if (!this.isDragging || !this.draggedRow) return;

    // Prevent default to allow drop
    e.preventDefault();

    // Move the drag card with the cursor
    if (this.dragCard) {
      this.dragCard.style.left = `${e.clientX}px`;
      this.dragCard.style.top = `${e.clientY - 30}px`;
    }

    // Find the row we're dragging over
    const targetRow = this.findTargetRow(e.clientY);

    if (targetRow) {
      // Position the drop indicator between rows
      this.showDropIndicator(targetRow, e.clientY);
    } else {
      // Hide the drop indicator if not over a valid target
      if (this.dropIndicator) {
        this.dropIndicator.style.display = "none";
      }
    }
  },

  findTargetRow(clientY) {
    // Get all transaction rows (except the one being dragged, the starting balance, and totals)
    const rows = Array.from(
      this.ledgerBody.querySelectorAll(
        'tr:not(.dragging):not([data-row-type="starting-balance"]):not([data-row-type="totals"])',
      ),
    );

    // Check for new transaction row (will be used as a drop target for "end of list")
    const newTransactionRow = this.ledgerBody.querySelector(
      "#add-transaction-row",
    );
    const totalsRow = this.ledgerBody.querySelector(
      'tr[data-row-type="totals"]',
    );

    // If no regular transaction rows and cursor is above new transaction row,
    // return the new transaction row as the target
    if (rows.length === 1 && rows[0].id === "add-transaction-row") {
      const box = rows[0].getBoundingClientRect();
      if (clientY < box.top + box.height / 2) {
        return rows[0];
      }
      return null;
    }

    // Filter out the "add new transaction" row for the closest calculation
    const transactionRows = rows.filter(
      (row) => row.id !== "add-transaction-row",
    );

    // If we have no actual transaction rows, no valid target
    if (transactionRows.length === 0) return null;

    // Check if we're below the last transaction row but above the new transaction row
    // This is for dropping at the end of the list
    const lastTransactionRow = transactionRows[transactionRows.length - 1];
    const lastRowBox = lastTransactionRow.getBoundingClientRect();

    if (newTransactionRow) {
      const newRowBox = newTransactionRow.getBoundingClientRect();

      // If we're below the last transaction row and above the new transaction row,
      // return the new transaction row as the target
      if (
        clientY > lastRowBox.bottom &&
        clientY < newRowBox.top + newRowBox.height / 2
      ) {
        return newTransactionRow;
      }
    } else if (totalsRow) {
      // If there's no new transaction row, check against totals row
      const totalsRowBox = totalsRow.getBoundingClientRect();
      if (clientY > lastRowBox.bottom && clientY < totalsRowBox.top) {
        // Return the totals row as a marker for "insert at end"
        return totalsRow;
      }
    }

    // Find the closest row the cursor is to (standard case)
    return transactionRows.reduce(
      (closest, row) => {
        const box = row.getBoundingClientRect();
        const offset = clientY - box.top - box.height / 2;

        // Return the closest row
        if (
          (offset < 0 && offset > closest.offset) ||
          (offset > 0 && offset < closest.offset)
        ) {
          return { offset: offset, element: row };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY, element: null },
    ).element;
  },

  showDropIndicator(targetRow, clientY) {
    if (!targetRow || !this.dropIndicator) {
      if (this.dropIndicator) {
        this.dropIndicator.style.display = "none";
      }
      return;
    }

    const rect = targetRow.getBoundingClientRect();
    const middleY = rect.top + rect.height / 2;

    // Determine if we should show indicator above or below the target row
    let top;

    // Special case for "add new transaction" row and totals row
    if (
      targetRow.id === "add-transaction-row" ||
      targetRow.dataset.rowType === "totals"
    ) {
      // Always show above these special rows
      top = rect.top;
    } else if (clientY < middleY) {
      // Show above
      top = rect.top;
    } else {
      // Show below
      top = rect.bottom;
    }

    // Calculate the left position to align with the table
    const tableRect = this.ledgerBody.parentElement.getBoundingClientRect();

    // Position and show the indicator
    this.dropIndicator.style.top = `${top}px`;
    this.dropIndicator.style.left = `${tableRect.left}px`;
    this.dropIndicator.style.width = `${tableRect.width}px`;
    this.dropIndicator.style.display = "block";
  },

  handleDrop(e) {
    if (!this.isDragging || !this.draggedRow) return;

    // Prevent default browser action
    e.preventDefault();

    // Hide the drag card immediately
    if (this.dragCard) {
      this.dragCard.style.display = "none";
    }

    // Hide the drop indicator immediately
    if (this.dropIndicator) {
      this.dropIndicator.style.display = "none";
    }

    // Get the transaction ID from the drag data
    const transactionId = e.dataTransfer.getData("text/plain");
    if (!transactionId) {
      this.handleDragEnd(); // Clean up even if no transaction ID
      return;
    }

    // Find the target row
    const targetRow = this.findTargetRow(e.clientY);
    if (!targetRow) {
      this.handleDragEnd(); // Clean up even if no target row
      return;
    }

    // Collect all transaction IDs in their new order
    const rows = Array.from(
      this.ledgerBody.querySelectorAll("tr[data-transaction-id]"),
    );

    // Remove the dragged row from the array
    const orderedRows = rows.filter((row) => row !== this.draggedRow);

    // Special handling for dropping at the end (on "New Transaction" row or totals row)
    if (
      targetRow.id === "add-transaction-row" ||
      targetRow.dataset.rowType === "totals"
    ) {
      // Add the dragged row at the end, before the "New Transaction" row or totals row
      orderedRows.push(this.draggedRow);
    } else {
      // Standard case - determine if we should insert before or after the target row
      const rect = targetRow.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;

      // Find the index of the target row in the ordered array
      const targetIndex = orderedRows.indexOf(targetRow);

      // If target is not found in orderedRows, it might be a special row (add new transaction)
      if (targetIndex === -1) {
        // Just add to the end
        orderedRows.push(this.draggedRow);
      } else {
        // Insert at the appropriate position
        if (e.clientY < middleY) {
          // Insert before
          orderedRows.splice(targetIndex, 0, this.draggedRow);
        } else {
          // Insert after
          orderedRows.splice(targetIndex + 1, 0, this.draggedRow);
        }
      }
    }

    // Get ordered transaction IDs
    const orderedIds = orderedRows.map((row) => row.dataset.transactionId);

    // Call transaction manager to update the sequence
    TransactionManager.reorderTransactions(orderedIds);

    // Clean up drag state (no need to wait for renderLedger)
    this.isDragging = false;
    this.draggedRow = null;

    // Remove dragging class from body
    document.body.classList.remove("dragging");

    // Re-render the ledger to reflect the new order
    LedgerController.renderLedger();
  },

  handleDragEnd() {
    // Clean up after drag operation
    this.isDragging = false;

    // Hide the drag card and drop indicator
    if (this.dragCard) {
      this.dragCard.style.display = "none";
    }

    if (this.dropIndicator) {
      this.dropIndicator.style.display = "none";
    }

    // Remove the dragging class from the row
    if (this.draggedRow) {
      this.draggedRow.classList.remove("dragging");
      this.draggedRow = null;
    }

    // Remove dragging class from body
    document.body.classList.remove("dragging");
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

  // Add a mutation observer to detect when new rows are added
  observeNewRows() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          // Check each added node
          mutation.addedNodes.forEach((node) => {
            // If it's a TR element with a transaction ID
            if (
              node.nodeName === "TR" &&
              node.dataset.transactionId &&
              !node.dataset.rowType &&
              node.id !== "add-transaction-row"
            ) {
              // Add drag handlers to the row
              this.setupRowHandlers(node);
            }
          });
        }
      });
    });

    // Start observing the table body for added nodes
    observer.observe(this.ledgerBody, { childList: true, subtree: true });
  },

  // Export for use in other files
  exports() {
    return {
      init: this.init.bind(this),
      selectRow: this.selectRow.bind(this),
      clearSelection: this.clearSelection.bind(this),
      initDragAndDrop: this.initDragAndDrop.bind(this),
      setupRowHandlers: this.setupRowHandlers.bind(this),
      observeNewRows: this.observeNewRows.bind(this),
      createDragElements: this.createDragElements.bind(this),
      setupExistingRows: this.setupExistingRows.bind(this),
    };
  },
};

// Make available globally
window.LedgerSelection = LedgerSelection.exports();

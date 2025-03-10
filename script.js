// script.js
document.addEventListener("DOMContentLoaded", () => {
  // Initialize the ledger manager first (handles ledger selection and creation)
  LedgerManager.init();

  // Initialize the controller (manages transactions for the active ledger)
  LedgerController.init();

  // Initialize the selection module
  LedgerSelection.init();

  // Expose controller functions for debugging if needed
  window.updateTotals = LedgerController.updateTotals;
});

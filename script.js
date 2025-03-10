// script.js - Simplified
document.addEventListener("DOMContentLoaded", () => {
  // Initialize the controller
  LedgerController.init();

  // Expose controller functions for debugging if needed
  window.updateTotals = LedgerController.updateTotals;
});

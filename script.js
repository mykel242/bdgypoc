// script.js
document.addEventListener("DOMContentLoaded", () => {
  // Initialize the ledger manager first (handles ledger selection and creation)
  LedgerManager.init();

  // Initialize the controller (manages transactions for the active ledger)
  LedgerController.init();

  // Initialize the selection module
  LedgerSelection.init();

  // Initialize network sync functionality
  if (window.NetworkSync) {
    NetworkSync.init();
  }

  // Initialize app state manager (handles welcome screen and document model)
  if (window.AppStateManager) {
    AppStateManager.init();
  }

  // Initialize hamburger menu
  initHamburgerMenu();

  // Expose controller functions for debugging if needed
  window.updateTotals = LedgerController.updateTotals;
});

// Hamburger menu functionality
function initHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburger-menu-btn');
  const dropdownMenu = document.getElementById('dropdown-menu');

  if (!hamburgerBtn || !dropdownMenu) return;

  // Toggle menu on hamburger click
  hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !dropdownMenu.classList.contains('hidden');
    
    if (isOpen) {
      closeHamburgerMenu();
    } else {
      openHamburgerMenu();
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdownMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
      closeHamburgerMenu();
    }
  });

  // Close menu when a menu item is clicked
  dropdownMenu.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      closeHamburgerMenu();
    });
  });

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeHamburgerMenu();
    }
  });

  function openHamburgerMenu() {
    dropdownMenu.classList.remove('hidden');
    hamburgerBtn.classList.add('active');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
  }

  function closeHamburgerMenu() {
    dropdownMenu.classList.add('hidden');
    hamburgerBtn.classList.remove('active');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const ledgerTable = document.getElementById("ledger");
  const addTransactionRow = document.getElementById("add-transaction-row");

  loadLedgerFromStorage();

  ledgerTable.addEventListener("click", function (event) {
    if (event.target.classList.contains("edit-btn")) {
      enterEditMode(event.target.closest("tr"));
    } else if (event.target.classList.contains("save-btn")) {
      exitEditMode(event.target.closest("tr"), true);
      saveLedgerToStorage();
    } else if (event.target.classList.contains("cancel-btn")) {
      exitEditMode(event.target.closest("tr"), false);
    } else if (event.target.classList.contains("delete-btn")) {
      event.target.closest("tr").remove();
      saveLedgerToStorage();
    } else if (event.target.classList.contains("add-btn")) {
      addTransaction();
    }
  });

  function enterEditMode(row) {
    if (!row) return;
    row.classList.add("editing");
    row.querySelectorAll("td").forEach((cell, index) => {
      if (index < 5) {
        const input = document.createElement("input");
        input.value = cell.textContent.trim();
        cell.innerHTML = "";
        cell.appendChild(input);
      }
    });

    row.querySelector(".actions").innerHTML = `
            <button class="save-btn">✅</button>
            <button class="cancel-btn">❌</button>
        `;
  }

  function exitEditMode(row, saveChanges) {
    if (!row) return;
    row.classList.remove("editing");
    row.querySelectorAll("td").forEach((cell, index) => {
      const input = cell.querySelector("input");
      if (input) {
        cell.textContent = saveChanges
          ? input.value.trim()
          : cell.dataset.originalValue;
      }
    });

    row.querySelector(".actions").innerHTML =
      `<button class="edit-btn">✏️</button> <button class="delete-btn">❌</button>`;
  }

  function addTransaction() {
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
            <td><input type="date"></td>
            <td><input type="text"></td>
            <td><input type="number" step="0.01"></td>
            <td><input type="number" step="0.01"></td>
            <td>0.00</td>
            <td><input type="checkbox"></td>
            <td><input type="checkbox"></td>
            <td class="actions"><button class="edit-btn">✏️</button> <button class="delete-btn">❌</button></td>
        `;
    addTransactionRow.parentNode.insertBefore(newRow, addTransactionRow);
    saveLedgerToStorage();
  }

  function saveLedgerToStorage() {
    const rows = [...ledgerTable.querySelectorAll("tbody tr")].filter(
      (row) => row !== addTransactionRow,
    );
    const data = rows.map((row) => ({
      date: row.cells[0]?.textContent.trim(),
      description: row.cells[1]?.textContent.trim(),
      credit: row.cells[2]?.textContent.trim(),
      debit: row.cells[3]?.textContent.trim(),
      balance: row.cells[4]?.textContent.trim(),
    }));
    localStorage.setItem("ledgerData", JSON.stringify(data));
  }

  function loadLedgerFromStorage() {
    const storedData = JSON.parse(localStorage.getItem("ledgerData")) || [];
    storedData.forEach((data) => {
      const newRow = document.createElement("tr");
      newRow.innerHTML = `
                <td>${data.date}</td>
                <td>${data.description}</td>
                <td>${data.credit}</td>
                <td>${data.debit}</td>
                <td>${data.balance}</td>
                <td><input type="checkbox"></td>
                <td><input type="checkbox"></td>
                <td class="actions"><button class="edit-btn">✏️</button> <button class="delete-btn">❌</button></td>
            `;
      addTransactionRow.parentNode.insertBefore(newRow, addTransactionRow);
    });
  }
});

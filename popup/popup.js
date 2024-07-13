document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["spreadsheetId", "sheetName"], (result) => {
    if (result.spreadsheetId) {
      document.getElementById("spreadsheetId").value = result.spreadsheetId;
    }
    if (result.sheetName) {
      document.getElementById("sheetName").value = result.sheetName;
    }
  });
});

document.getElementById("writeButton").addEventListener("click", () => {
  const spreadsheetId = document.getElementById("spreadsheetId").value;
  const sheetName = document.getElementById("sheetName").value;
  const data = document.getElementById("data").value;
  const sheetColumns = JSON.stringify([[data]]);
  chrome.runtime.sendMessage(
    { action: "writeToSheet", data: sheetColumns, spreadsheetId, sheetName },
    (response) => {
      console.log(response.status);
    }
  );
});

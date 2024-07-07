document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["spreadsheetId", "sheetName"], (result) => {
    if (result.spreadsheetId) {
      document.getElementById("spreadsheetId").value = result.spreadsheetId;
    }
    if (result.sheetName) {
      document.getElementById("sheetName").value = result.sheetName;
    }
  });

  document.getElementById("save").addEventListener("click", () => {
    const spreadsheetId = document.getElementById("spreadsheetId").value;
    const sheetName = document.getElementById("sheetName").value;
    chrome.storage.sync.set({ spreadsheetId, sheetName }, () => {
      console.log("Spreadsheet ID is saved:", spreadsheetId);
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(
    ["garoonDomain", "spreadsheetId", "sheetName"],
    (result) => {
      if (result.garoonDomain) {
        document.getElementById("spreadsheetId").value = result.garoonDomain;
      }
      if (result.spreadsheetId) {
        document.getElementById("spreadsheetId").value = result.spreadsheetId;
      }
      if (result.sheetName) {
        document.getElementById("sheetName").value = result.sheetName;
      }
    }
  );

  document.getElementById("save").addEventListener("click", () => {
    const garoonDomain = document.getElementById("garoonDomain").value;
    const spreadsheetId = document.getElementById("spreadsheetId").value;
    const sheetName = document.getElementById("sheetName").value;
    chrome.storage.sync.set({ garoonDomain, spreadsheetId, sheetName }, () => {
      console.log("Saved", garoonDomain, spreadsheetId, sheetName);
    });
  });
});

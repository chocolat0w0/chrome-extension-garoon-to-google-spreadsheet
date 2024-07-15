document.addEventListener("DOMContentLoaded", () => {
  const savedElem = document.getElementById("saved");
  chrome.storage.sync.get(
    ["garoonDomain", "spreadsheetId", "sheetName"],
    (result) => {
      if (result.garoonDomain) {
        document.getElementById("garoonDomain").value = result.garoonDomain;
      }
      if (result.spreadsheetId) {
        document.getElementById("spreadsheetId").value = result.spreadsheetId;
      }
      if (result.sheetName) {
        document.getElementById("sheetName").value = result.sheetName;
      }
    }
  );

  [...document.getElementsByTagName("input")].map((target) => {
    target.addEventListener("input", () => {
      savedElem.style.display = "none";
    });
  });

  document.getElementById("save").addEventListener("click", () => {
    const garoonDomain = document.getElementById("garoonDomain").value;
    const spreadsheetId = document.getElementById("spreadsheetId").value;
    const sheetName = document.getElementById("sheetName").value;
    chrome.storage.sync.set({ garoonDomain, spreadsheetId, sheetName }, () => {
      savedElem.style.display = "inline";
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const savedElem = document.getElementById("saved");
  const errorElem = document.getElementById("error");
  const garoonIntervalErrorElem = document.getElementById(
    "garoonIntervalError"
  );

  chrome.storage.sync.get(
    ["garoonDomain", "garoonInterval", "spreadsheetId", "sheetName"],
    (result) => {
      if (result.garoonDomain) {
        document.getElementById("garoonDomain").value = result.garoonDomain;
      }
      if (result.garoonInterval) {
        document.getElementById("garoonInterval").value = result.garoonInterval;
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
      errorElem.style.display = "none";
    });
  });

  document
    .getElementById("garoonInterval")
    .addEventListener("blur", (event) => {
      if (Number.isNaN(Number(event.currentTarget.value))) {
        garoonIntervalErrorElem.style.display = "block";
      } else {
        garoonIntervalErrorElem.style.display = "none";
      }
    });

  document.getElementById("save").addEventListener("click", () => {
    const garoonDomain = document.getElementById("garoonDomain").value;
    const garoonInterval = Number(
      document.getElementById("garoonInterval").value
    );
    const spreadsheetId = document.getElementById("spreadsheetId").value;
    const sheetName = document.getElementById("sheetName").value;

    if (Number.isNaN(garoonInterval)) {
      errorElem.style.display = "inline";
      return;
    }

    chrome.storage.sync.set(
      { garoonDomain, garoonInterval, spreadsheetId, sheetName },
      () => {
        savedElem.style.display = "inline";
      }
    );

    chrome.alarms.clear("garoonAlarm", (wasCleared) => {
      chrome.alarms.create("garoonAlarm", {
        periodInMinutes: garoonInterval,
      });
    });
  });
});

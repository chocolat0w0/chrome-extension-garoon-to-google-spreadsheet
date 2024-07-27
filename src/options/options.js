document.addEventListener("DOMContentLoaded", () => {
  const successMessageElem = document.getElementById("saved");
  const errorMessageElem = document.getElementById("error");
  const garoonIntervalErrorMessageElem = document.getElementById(
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
      successMessageElem.style.display = "none";
      errorMessageElem.style.display = "none";
    });
  });

  document
    .getElementById("garoonInterval")
    .addEventListener("blur", (event) => {
      const val = Number(event.currentTarget.value);
      if (Number.isNaN(val) || val <= 0) {
        garoonIntervalErrorMessageElem.style.display = "block";
      } else {
        garoonIntervalErrorMessageElem.style.display = "none";
      }
    });

  document.getElementById("save").addEventListener("click", () => {
    const garoonDomain = document.getElementById("garoonDomain").value;
    const garoonInterval = Number(
      document.getElementById("garoonInterval").value
    );
    const spreadsheetId = document.getElementById("spreadsheetId").value;
    const sheetName = document.getElementById("sheetName").value;

    if (Number.isNaN(garoonInterval) || garoonInterval <= 0) {
      errorMessageElem.style.display = "inline";
      return;
    }

    chrome.storage.sync.set(
      { garoonDomain, garoonInterval, spreadsheetId, sheetName },
      () => {
        chrome.runtime.sendMessage({ action: "exec" }, (response) => {
          switch (response.status) {
            case "success":
              successMessageElem.style.display = "inline";
              errorMessageElem.style.display = "none";
              break;

            case "error":
              successMessageElem.style.display = "none";
              errorMessageElem.style.display = "inline";
              break;

            default:
              successMessageElem.style.display = "none";
              errorMessageElem.style.display = "inline";
              break;
          }
        });
      }
    );

    chrome.alarms.clear("garoonAlarm", (wasCleared) => {
      chrome.alarms.create("garoonAlarm", {
        periodInMinutes: garoonInterval,
      });
    });
  });
});

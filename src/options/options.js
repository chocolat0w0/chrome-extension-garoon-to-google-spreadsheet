const showMessage = (status) => {
  document.querySelectorAll("[data-message]").forEach((elem) => {
    elem.style.display = "none";
    if (elem.id === status) {
      elem.style.display = "inline";
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
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
      showMessage("none");
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
      showMessage("error");
      return;
    }

    chrome.storage.sync.set(
      {
        garoonDomain,
        garoonInterval,
        spreadsheetId,
        sheetName,
      },
      () => {
        const timer = setInterval(() => {
          chrome.storage.local.get(["status"], (result) => {
            if (result.status) {
              showMessage(result.status);

              if (["success", "error"].includes(result.status)) {
                clearInterval(timer);
              }
            }
          });
        }, 500);
        chrome.runtime.sendMessage({ action: "start" });
      }
    );

    chrome.alarms.clear("garoonAlarm", (wasCleared) => {
      chrome.alarms.create("garoonAlarm", {
        periodInMinutes: garoonInterval,
      });
    });
  });
});

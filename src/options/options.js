const showMessage = (status) => {
  document.querySelectorAll("[data-message]").forEach((elem) => {
    elem.style.display = "none";
    if (elem.id === status) {
      elem.style.display = "inline";
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const garoonDomainElem = document.getElementById("garoonDomain");
  const garoonIntervalElem = document.getElementById("garoonInterval");
  const spreadsheetIdElem = document.getElementById("spreadsheetId");
  const sheetNameElem = document.getElementById("sheetName");
  const garoonItemsElem = document.getElementById("garoonItems");
  const garoonIntervalErrorMessageElem = document.getElementById(
    "garoonIntervalError"
  );

  chrome.storage.sync.get(
    [
      "garoonDomain",
      "garoonInterval",
      "spreadsheetId",
      "sheetName",
      "garoonItems",
    ],
    (result) => {
      if (result.garoonDomain) {
        garoonDomainElem.value = result.garoonDomain;
      }
      if (result.garoonInterval) {
        garoonIntervalElem.value = result.garoonInterval;
      }
      if (result.spreadsheetId) {
        spreadsheetIdElem.value = result.spreadsheetId;
      }
      if (result.sheetName) {
        sheetNameElem.value = result.sheetName;
      }
      if (result.garoonItems) {
        garoonItemsElem.value = result.garoonItems.join("\n");
      }
    }
  );

  [...document.getElementsByTagName("input")].map((target) => {
    target.addEventListener("input", () => {
      showMessage("none");
    });
  });

  garoonIntervalElem.addEventListener("blur", (event) => {
    const val = Number(event.currentTarget.value);
    if (Number.isNaN(val) || val <= 0) {
      garoonIntervalErrorMessageElem.style.display = "block";
    } else {
      garoonIntervalErrorMessageElem.style.display = "none";
    }
  });

  document.getElementById("save").addEventListener("click", () => {
    const garoonDomain = garoonDomainElem.value;
    const garoonInterval = Number(garoonIntervalElem.value);
    const spreadsheetId = spreadsheetIdElem.value;
    const sheetName = sheetNameElem.value;
    const garoonItems = garoonItemsElem.value.split(/\r?\n/);

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
        garoonItems,
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

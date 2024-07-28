const showError = (details) => {
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  chrome.storage.local.set({ status: "error" });
  chrome.storage.local.set({ error: details });
};

const clearError = () => {
  chrome.action.setBadgeText({ text: "" });
  chrome.storage.local.set({ status: "none" });
  chrome.storage.local.set({ error: null });
};

chrome.runtime.onInstalled.addListener(() => {
  // 定期実行アラームを設定
  chrome.storage.sync.get(["garoonInterval"], (result) => {
    const garoonInterval = result.garoonInterval || 60;
    chrome.alarms.create("garoonAlarm", {
      periodInMinutes: garoonInterval,
    });
  });
});

const start = () => {
  chrome.storage.local.set({ status: "running" });

  chrome.storage.sync.get(["garoonDomain"], (result) => {
    const targetDomain = result.garoonDomain;

    if (!targetDomain) {
      showError("Please set the Garoon domain in the options.");
      throw new Error();
    }

    chrome.tabs.query({}, (tabs) => {
      let executed = false;

      for (let tab of tabs) {
        if (
          !executed &&
          tab.url &&
          tab.url.includes(targetDomain) &&
          tab.status === "complete"
        ) {
          executed = true;
          console.log("executed");
          try {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content/garoon.js"],
              world: "MAIN",
            });
          } catch (error) {
            showError(
              "Garoon is either not open in a tab or the session has expired."
            );
            throw new Error();
          }
        }
      }

      if (!executed) {
        showError(
          "Garoon is either not open in a tab or the session has expired."
        );
        throw new Error();
      }
    });
  });
};

// アラーム発火
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "garoonAlarm") {
    try {
      start();
    } catch (error) {
      showError("Unknown error");
    }
  }
});

const clearSheetData = async (spreadsheetId, sheetName, token) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:Z:clear`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }

  const result = await response.json();
  return result;
};

const writeToSheet = async (spreadsheetId, sheetName, data) => {
  try {
    const token = await getOAuthToken();
    await clearSheetData(spreadsheetId, sheetName, token);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: JSON.parse(data),
        }),
      }
    );
  } catch (error) {
    showError("Could not write to SpreadSheet.");
    throw error;
  }
};

const getOAuthToken = () => {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "start":
      try {
        start();
        sendResponse({ status: "success" });
      } catch (error) {
        showError("Unknown error");
        sendResponse({ status: "error" });
      }
      return true;

    case "writeToSheet":
      chrome.storage.sync.get(["spreadsheetId", "sheetName"], (result) => {
        if (!result.spreadsheetId || !result.sheetName) {
          showError("Please set the SpreadSheet information in the options.");
          sendResponse({ status: "error" });
        }
        (async () => {
          try {
            await writeToSheet(
              result.spreadsheetId,
              result.sheetName,
              request.data
            );
            sendResponse({ status: "success" });
            clearError();
            chrome.storage.local.set({ status: "success" });
            chrome.storage.local.set(
              { success: new Date().toLocaleString() },
              () => {
                console.log("Saved Successfully: ", new Date());
              }
            );
          } catch (error) {
            sendResponse({ status: "error" });
          }
        })();
      });
      return true;

    default:
      sendResponse({ status: "error", details: "unknown message" });
  }
});

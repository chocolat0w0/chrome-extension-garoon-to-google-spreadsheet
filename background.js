chrome.runtime.onInstalled.addListener(() => {
  // 定期実行アラームを設定
  chrome.alarms.create("garoonAlarm", {
    periodInMinutes: 60,
  });
});

// アラーム発火
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "garoonAlarm") {
    chrome.storage.sync.get(["garoonDomain"], (result) => {
      const targetDomain = result.garoonDomain;
      // TODO: ドメイン未設定の場合設定を促す

      chrome.tabs.query({}, (tabs) => {
        for (let tab of tabs) {
          if (tab.url && tab.url.includes(targetDomain)) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content/garoon.js"],
              world: "MAIN",
            });
          }
        }
      });
    });
  }
});

async function clearSheetData(spreadsheetId, sheetName, token) {
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
}

async function writeToSheet(spreadsheetId, sheetName, data) {
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
    const result = await response.json();
  } catch (error) {
    console.error("Error writing to sheet:", error);
  }
}

function getOAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "writeToSheet") {
    chrome.storage.sync.get(["spreadsheetId", "sheetName"], (result) => {
      // TODO: シート設定
      writeToSheet(result.spreadsheetId, result.sheetName, request.data);
    });
    sendResponse({ status: "success" });
  }

  return true;
});

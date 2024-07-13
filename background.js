chrome.runtime.onInstalled.addListener(() => {
  // 定期実行アラームを設定
  // TODO: ドメイン未設定の場合設定を促す
  chrome.alarms.create("garoonAlarm", {
    periodInMinutes: 1,
  });
});

// アラーム発火
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "garoonAlarm") {
    console.log("fire alarm");
    chrome.storage.sync.get(["garoonDomain"], (result) => {
      console.log(result);
      const targetDomain = result.garoonDomain;
      // TODO: ドメイン未設定の場合設定を促す

      chrome.tabs.query({}, (tabs) => {
        for (let tab of tabs) {
          if (tab.url && tab.url.includes(targetDomain)) {
            console.log("fire alarm: " + new Date().toISOString());
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content/fetch-garoon.js"],
              world: "MAIN",
            });
          }
        }
      });
    });
  }
});

async function writeToSheet(spreadsheetId, sheetName, data) {
  try {
    const token = await getOAuthToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [[data]],
        }),
      }
    );
    const result = await response.json();
    console.log(result);
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

// function executeOnSpecificDomain() {
//   const targetDomain = "example.com"; // ここに対象のドメインを指定

//   chrome.tabs.query({}, (tabs) => {
//     for (let tab of tabs) {
//       if (tab.url.includes(targetDomain)) {
//         // content.jsを実行する
//         console.log(targetDomain + ", " + tab.id);
//       }
//     }
//   });
// }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "writeToSheet") {
    writeToSheet(request.data);
    sendResponse({ status: "success" });
  }
});

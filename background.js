chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "writeToSheet") {
    writeToSheet(request.data);
    sendResponse({ status: "success" });
  }
});

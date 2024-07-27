window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data && event.data.type === "WRITE_SHEET") {
    chrome.runtime.sendMessage(
      { action: "writeToSheet", data: event.data.data },
      (response) => {
        // ページに応答を送信
        window.postMessage(
          { type: "WRITE_SHEET_RES", result: response.result },
          "*"
        );
      }
    );
  }
});

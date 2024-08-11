window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data && event.data.type === "WRITE_DATA") {
    chrome.runtime.sendMessage(
      { action: "write", data: event.data.data },
      (response) => {
        // Send response to page
        window.postMessage({ type: "WRITE_DATA_RES", result: response }, "*");
      }
    );
  }
});

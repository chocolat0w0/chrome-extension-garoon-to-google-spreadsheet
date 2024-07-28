document.addEventListener("DOMContentLoaded", () => {
  chrome.action.getBadgeText({}, (badgeText) => {
    if (badgeText === "!") {
      document.getElementById("success").style.display = "none";
      document.getElementById("error").style.display = "block";
      chrome.storage.local.get("error", (result) => {
        if (result.error) {
          document.getElementById("errorDetails").innerText = result.error;
        }
      });
    } else {
      document.getElementById("success").style.display = "block";
      document.getElementById("error").style.display = "none";
      chrome.storage.local.get("success", (result) => {
        if (result.success) {
          document.getElementById("lastUpdatedAt").innerText = result.success;
        }
      });
    }
  });
});

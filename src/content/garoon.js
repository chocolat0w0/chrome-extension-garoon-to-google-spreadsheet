if (typeof garoonInitialized === "undefined") {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === "WRITE_DATA_RES") {
      console.log("Response from extension:", event.data.result);
    }
  });
}

garoon.api(
  `/api/v1/schedule/events?rangeStart=${new Date().toISOString()}&orderBy=start asc`,
  "get",
  {},
  (data) => {
    window.postMessage(
      { type: "WRITE_DATA", data: JSON.stringify(data.data.events) },
      "*"
    );
  }
);

garoonInitialized = true;

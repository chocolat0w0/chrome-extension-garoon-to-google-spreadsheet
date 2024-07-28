if (typeof garoonInitialized === "undefined") {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === "WRITE_SHEET_RES") {
      console.log("Response from extension:", event.data.result);
    }
  });
}

garoon.api(
  `/api/v1/schedule/events?rangeStart=${new Date().toISOString()}&orderBy=start asc`,
  "get",
  {},
  (data) => {
    const info = [
      ["id", "start", "end", "subject", "notes", "creator", "attendees"],
      ...data.data.events.map((ev) => {
        return [
          ev.id,
          ev.start.dateTime,
          ev.end.dateTime,
          ev.subject,
          ev.notes,
          ev.creator.name,
          ev.attendees.map((at) => at.name).join(","),
        ];
      }),
    ];
    window.postMessage(
      { type: "WRITE_SHEET", data: JSON.stringify(info) },
      "*"
    );
  }
);

garoonInitialized = true;

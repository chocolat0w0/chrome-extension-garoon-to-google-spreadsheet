importScripts("config.js");

if (config.mode === "dev") {
  importScripts("data/sample.js");
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const getValue = (obj, path) => {
  const paths = path.split(".");

  const traverse = (currentObj, remainingPaths) => {
    if (remainingPaths.length === 0) {
      return currentObj;
    }

    const [firstPath, ...restPaths] = remainingPaths;

    if (firstPath.endsWith("[]")) {
      const arrayPath = firstPath.slice(0, -2);
      if (Array.isArray(currentObj[arrayPath])) {
        return currentObj[arrayPath].map((item) => traverse(item, restPaths));
      } else {
        return undefined;
      }
    } else {
      return traverse(currentObj[firstPath], restPaths);
    }
  };

  return traverse(obj, paths);
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

  switch (config.mode) {
    case "prod":
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
      break;

    case "dev":
      chrome.storage.sync.get(
        ["calendarEnabled", "spreadsheetEnabled"],
        (result) => {
          if (result.calendarEnabled) {
            try {
              writeToCalendar(sample.data.events);
            } catch (error) {}
          }
          if (result.spreadsheetEnabled) {
            writeToSheet(sample.data.events);
          }
          if (!result.calendarEnabled && !result.spreadsheetEnabled) {
            chrome.storage.local.set({ status: "success" });
            chrome.storage.local.set(
              { success: new Date().toLocaleString() },
              () => {
                console.log("Saved Successfully: ", new Date());
              }
            );
          }
        }
      );
      break;

    default:
      break;
  }
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

const apiGetFutureEvents = async (calendarId, token) => {
  const now = new Date().toISOString();
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${now}&showDeleted=false`;
  let allEvents = [];

  const apiFetch = async (pageToken = null) => {
    let url = baseUrl;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error();
      }

      const events = await response.json();
      allEvents.push(...events.items);

      if (events.nextPageToken) {
        await apiFetch(events.nextPageToken);
      }
    } catch (error) {
      showError("Failed to fetch calendar events.");
      allEvents = [];
    }
  };

  await apiFetch(null);
  return allEvents;
};

const apiDeleteEvent = async (calendarId, eventId, token) => {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (response.ok) {
    console.log(`Event with ID: ${eventId} deleted successfully`);
  } else {
    showError(`Failed to delete calendar event with ID: ${eventId}`);
  }
};

const clearFutureEvents = async (calendarId, token) => {
  const events = await apiGetFutureEvents(calendarId, token);
  console.log("Future events: " + events.length);

  // Memo: Execute synchronously due to API call frequency limitations.
  const garoonEvents = events.filter(
    (event) =>
      event.description && event.description.includes("[Synced from Garoon]")
  );
  for (const event of garoonEvents) {
    await apiDeleteEvent(calendarId, event.id, token);
    await delay(100);
  }
  console.log("Complete to delete events!");
};

const apiWriteToCalendar = async (event, calendarId, token) => {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (response.ok) {
    const eventData = await response.json();
    console.log("Event created:", eventData.htmlLink);
  } else {
    showError("Failed to create calendar events.");
  }
};

const writeToCalendar = (data) => {
  chrome.storage.sync.get(["calendarId"], async (result) => {
    if (!result.calendarId) {
      showError("Please set the Calendar information in the options.");
      if (sendResponse) {
        sendResponse({ status: "error" });
      }
    }

    const token = await getOAuthToken();

    await clearFutureEvents(result.calendarId, token);

    try {
      for (const d of data) {
        const event = {
          summary: d.subject,
          description: `${d.notes}\r\n\r\n----------\r\n[Synced from Garoon] Garoon ID: ${d.id}`,
          start: {
            dateTime: d.start.dateTime,
            timeZone: d.start.timeZone,
          },
          end: {
            dateTime: d.end.dateTime,
            timeZone: d.end.timeZone,
          },
        };

        await apiWriteToCalendar(event, result.calendarId, token);
        await delay(100);
      }

      chrome.storage.local.set({ status: "success" });
      chrome.storage.local.set({ success: new Date().toLocaleString() }, () => {
        console.log("Saved Successfully: ", new Date());
      });
    } catch (error) {
      showError("Could not write to Calendar.");

      throw new Error();
    }
  });
};

const apiClearSheetData = async (spreadsheetId, sheetName, token) => {
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

const apiWriteToSheet = async (spreadsheetId, sheetName, data) => {
  const token = await getOAuthToken();
  await apiClearSheetData(spreadsheetId, sheetName, token);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: data,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }
};

const writeToSheet = (data, sendResponse) => {
  chrome.storage.sync.get(
    ["spreadsheetId", "sheetName", "garoonItems"],
    (result) => {
      if (!result.spreadsheetId || !result.sheetName || !result.garoonItems) {
        showError("Please set the SpreadSheet information in the options.");
        if (sendResponse) {
          sendResponse({ status: "error" });
        }
      }
      (async () => {
        try {
          const info = [
            result.garoonItems,
            ...data.map((event) => {
              return result.garoonItems.map((item) => {
                const value = getValue(event, item);
                return Array.isArray(value) ? value.join(",") : value;
              });
            }),
          ];

          clearError();
          await apiWriteToSheet(result.spreadsheetId, result.sheetName, info);
          if (sendResponse) {
            sendResponse({ status: "success" });
          }
          chrome.storage.local.set({ status: "success" });
          chrome.storage.local.set(
            { success: new Date().toLocaleString() },
            () => {
              console.log("Saved Successfully: ", new Date());
            }
          );
        } catch (error) {
          showError("Could not write to SpreadSheet.");
          if (sendResponse) {
            sendResponse({ status: "error" });
          }
        }
      })();
    }
  );
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

    case "write":
      try {
        chrome.storage.sync.get(
          ["calendarEnabled", "spreadsheetEnabled"],
          (result) => {
            if (result.calendarEnabled) {
              try {
                writeToCalendar(JSON.parse(request.data));
                sendResponse({ status: "success" });
              } catch (error) {
                sendResponse({ status: "error" });
              }
            }
            if (result.spreadsheetEnabled) {
              writeToSheet(JSON.parse(request.data), sendResponse);
            }
            if (!result.calendarEnabled && !result.spreadsheetEnabled) {
              chrome.storage.local.set({ status: "success" });
              chrome.storage.local.set(
                { success: new Date().toLocaleString() },
                () => {
                  console.log("Saved Successfully: ", new Date());
                }
              );
            }
          }
        );
      } catch (error) {
        showError("Invalid data format.");
        sendResponse({ status: "error" });
      }
      return true;

    default:
      sendResponse({ status: "error", details: "unknown message" });
  }
});

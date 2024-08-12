importScripts("config.js");

if (config.mode === "dev") {
  importScripts("data/sample.js");
}

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
            writeToCalendar(sample.data.events);
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

const apiGetFutureEvents = async (calendaId, token) => {
  const now = new Date().toISOString();
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendaId}/events?timeMin=${now}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.ok) {
    const events = await response.json();
    return events.items;
  } else {
    showError("Failed to fetch calendar events.");
    return [];
  }
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
  apiGetFutureEvents(calendarId, token).then((events) => {
    events.forEach((event) => {
      if (event.description && event.description.includes("Garoon ID:")) {
        apiDeleteEvent(calendarId, event.id, token);
      }
    });
  });
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

const writeToCalendar = (data, sendResponse) => {
  chrome.storage.sync.get(["calendarId"], async (result) => {
    if (!result.calendarId) {
      showError("Please set the Calendar information in the options.");
      if (sendResponse) {
        sendResponse({ status: "error" });
      }
    }

    const token = await getOAuthToken();

    await clearFutureEvents(result.calendarId, token);

    Promise.all(
      data.map(async (d) => {
        const event = {
          summary: d.subject,
          description: `${d.notes}\r\n\r\n----------\r\nGaroon ID: ${d.id}`,
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
      })
    )
      .then(() => {
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
      })
      .catch((error) => {
        showError("Could not write to Calendar.");
        if (sendResponse) {
          sendResponse({ status: "error" });
        }
      });
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
        chrome.storage.sync.get(["calendarEnabled"], (result) => {
          if (result.calendarEnabled) {
            writeToCalendar(JSON.parse(request.data), sendResponse);
          }
        });
        chrome.storage.sync.get(["spreadsheetEnabled"], (result) => {
          if (result.spreadsheetEnabled) {
            writeToSheet(JSON.parse(request.data), sendResponse);
          }
        });
      } catch (error) {
        showError("Invalid data format.");
        sendResponse({ status: "error" });
      }
      return true;

    default:
      sendResponse({ status: "error", details: "unknown message" });
  }
});

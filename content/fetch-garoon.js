console.log("fetchGaroon");
garoon.api(
  `/api/v1/schedule/events?rangeStart=${new Date().toISOString()}&orderBy=start asc`,
  "get",
  {},
  console.log
);

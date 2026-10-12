/**
 * Monster Day check-ins.
 *
 * Bind this file to the workout Google Sheet:
 * Extensions → Apps Script, paste this file, then Deploy → New deployment →
 * Web app. Execute as you. Who has access: Anyone.
 * Copy the /exec URL into config.js scriptUrl.
 *
 * Keep TIME_ZONE and RESET_HOUR in step with config.js.
 * Sunday recap reads weekDefeated: monsters all three finished,
 * Monday through Sunday in Pacific time. Redeploy after pasting.
 * The reset minute is 00. The window ends at the next 8:00am Pacific,
 * so daylight-saving nights are 23 or 25 hours and the Beijing label shifts.
 */
var SPREADSHEET_ID = "1C-1jZF_QivTMigTGrF6MoM_9c_y2q13ByX5Jin6HCMM";
var TIME_ZONE = "America/Los_Angeles";
var RESET_HOUR = 8;
var PLAYERS = { p1: "Auntie", p2: "Shelby", p3: "Bernice" };
var OPTIONS = { leg: true, chest: true, back: true, rest: true };

function doGet() {
  return handle_(null);
}

function doPost(e) {
  var body = null;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: "refused" });
  }
  return handle_(body);
}

function handle_(body) {
  if (!body) return json_(readState_());
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return json_({ error: "busy" });
  }
  try {
    var playerId = String(body.playerId || "");
    var option = String(body.option || "");
    if (!PLAYERS[playerId] || !OPTIONS[option]) return json_({ error: "refused" });
    var now = new Date();
    var window = dayWindow_(now);
    upsert_(window.dayId, playerId, option, formatIso_(now), PLAYERS[playerId]);
    return json_(readState_());
  } finally {
    lock.releaseLock();
  }
}

function readState_() {
  var now = new Date();
  var window = dayWindow_(now);
  var groups = readGrouped_();
  var week = weekDayIds_(now);
  var need = Object.keys(PLAYERS).length;
  var defeated = [];
  for (var i = 0; i < week.length; i++) {
    var rows = groups[week[i]] || [];
    if (rows.length >= need) defeated.push(week[i]);
  }
  return {
    dayId: window.dayId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    serverNow: formatIso_(now),
    checkins: groups[window.dayId] || [],
    weekDefeated: defeated,
  };
}

function sheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName("Checkins");
  if (!sh) sh = ss.insertSheet("Checkins");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 5).setNumberFormat("@");
    sh.getRange(1, 1, 1, 5).setValues([["day_id", "player_id", "option", "logged_at", "player_name"]]);
    sh.getRange(1, 1, 1, 5).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function upsert_(dayId, playerId, option, loggedAt, playerName) {
  var sh = sheet_();
  var values = sh.getDataRange().getValues();
  var found = 0;
  for (var i = 1; i < values.length; i++) {
    if (asText_(values[i][0]) === dayId && asText_(values[i][1]) === playerId) {
      found = i + 1;
      break;
    }
  }
  var row = found || sh.getLastRow() + 1;
  var range = sh.getRange(row, 1, 1, 5);
  range.setNumberFormat("@");
  range.setValues([[dayId, playerId, option, loggedAt, playerName]]);
}

function readGrouped_() {
  var sh = sheet_();
  var values = sh.getDataRange().getValues();
  var groups = {};
  for (var i = 1; i < values.length; i++) {
    var dayId = asText_(values[i][0]);
    var playerId = asText_(values[i][1]);
    var option = asText_(values[i][2]);
    if (!dayId || !PLAYERS[playerId] || !OPTIONS[option]) continue;
    if (!groups[dayId]) groups[dayId] = [];
    var list = groups[dayId];
    var dup = false;
    for (var j = 0; j < list.length; j++) {
      if (list[j].playerId === playerId) {
        dup = true;
        break;
      }
    }
    if (dup) continue;
    list.push({
      playerId: playerId,
      option: option,
      loggedAt: asIso_(values[i][3]),
    });
  }
  Object.keys(groups).forEach(function (dayId) {
    groups[dayId].sort(function (a, b) {
      if (a.loggedAt < b.loggedAt) return -1;
      if (a.loggedAt > b.loggedAt) return 1;
      return 0;
    });
  });
  return groups;
}

function weekDayIds_(now) {
  var p = zonedParts_(now, TIME_ZONE);
  var weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  var back = (weekday + 6) % 7;
  var monday = shiftDate_(p.year, p.month, p.day, -back);
  var ids = [];
  for (var i = 0; i < 7; i++) {
    var day = shiftDate_(monday.y, monday.m, monday.d, i);
    var start = wallToUtc_(day.y, day.m, day.d, RESET_HOUR, 0, 0, TIME_ZONE);
    ids.push(formatIso_(start));
  }
  return ids;
}

function asIso_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return formatIso_(value);
  }
  return String(value || "");
}

function asText_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") return asIso_(value);
  return String(value || "");
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatIso_(date) {
  return Utilities.formatDate(date, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function zonedParts_(date, tz) {
  var s = Utilities.formatDate(date, tz, "yyyy-MM-dd-HH-mm-ss");
  var p = s.split("-");
  return {
    year: parseInt(p[0], 10),
    month: parseInt(p[1], 10),
    day: parseInt(p[2], 10),
    hour: parseInt(p[3], 10),
    minute: parseInt(p[4], 10),
    second: parseInt(p[5], 10),
  };
}

function shiftDate_(year, month, day, delta) {
  var dt = new Date(Date.UTC(year, month - 1, day + delta));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function offsetMsAt_(utcMs, tz) {
  var p = zonedParts_(new Date(utcMs), tz);
  var asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - utcMs;
}

function wallToUtc_(year, month, day, hour, minute, second, tz) {
  var desired = Date.UTC(year, month - 1, day, hour, minute, second);
  var utc = desired;
  for (var i = 0; i < 4; i++) {
    var next = desired - offsetMsAt_(utc, tz);
    if (next === utc) return new Date(next);
    utc = next;
  }
  return new Date(utc);
}

function dayWindow_(now) {
  var p = zonedParts_(now, TIME_ZONE);
  var y = p.year;
  var m = p.month;
  var d = p.day;
  if (p.hour < RESET_HOUR) {
    var prev = shiftDate_(y, m, d, -1);
    y = prev.y;
    m = prev.m;
    d = prev.d;
  }
  var start = wallToUtc_(y, m, d, RESET_HOUR, 0, 0, TIME_ZONE);
  var next = shiftDate_(y, m, d, 1);
  var end = wallToUtc_(next.y, next.m, next.d, RESET_HOUR, 0, 0, TIME_ZONE);
  return {
    dayId: formatIso_(start),
    startsAt: formatIso_(start),
    endsAt: formatIso_(end),
  };
}

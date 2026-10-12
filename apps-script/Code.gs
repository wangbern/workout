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
 * Monday through Sunday in Pacific time.
 * weekCheckins is this monster week's rows, Monday 8:00am through
 * Sunday, so the page can color each person's figure.
 * PhoneColors stores one shell color per person. Stickers stores where
 * each person stuck a defeated monster. defeatedAll is every day all
 * three finished. Redeploy after pasting.
 * Passwords are not in this file. Add them under Project Settings → Script
 * properties as PASSWORD_AUNTIE, PASSWORD_SHELBY and PASSWORD_BERNICE.
 * The page sends action "login" to check one, and every save must carry
 * the right password for its player.
 * The reset minute is 00. The window ends at the next 8:00am Pacific,
 * so daylight-saving nights are 23 or 25 hours and the Beijing label shifts.
 */
var SPREADSHEET_ID = "1C-1jZF_QivTMigTGrF6MoM_9c_y2q13ByX5Jin6HCMM";
var TIME_ZONE = "America/Los_Angeles";
var RESET_HOUR = 8;
var PLAYERS = { p1: "Auntie", p2: "Shelby", p3: "Bernice" };
var OPTIONS = { leg: true, chest: true, back: true, rest: true };
var COLORS = {
  teal: true, pink: true, hot: true, green: true, purple: true,
  yellow: true, blue: true, orange: true, grey: true,
};

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
  if (!passwordOk_(body.playerId, body.password)) return json_({ error: "auth" });
  if (String(body.action || "") === "login") return json_(readState_());
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return json_({ error: "busy" });
  }
  try {
    var action = String(body.action || "");
    if (action === "color") return json_(saveColor_(body));
    if (action === "place") return json_(saveSticker_(body));
    if (action === "unstick") return json_(removeSticker_(body));
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

function passwordOk_(playerId, password) {
  var id = String(playerId || "");
  if (!PLAYERS.hasOwnProperty(id)) return false;
  var key = "PASSWORD_" + PLAYERS[id].toUpperCase();
  var want = PropertiesService.getScriptProperties().getProperty(key);
  if (!want) return false;
  return String(password || "").trim().toLowerCase() === String(want).trim().toLowerCase();
}

function readState_() {
  var now = new Date();
  var window = dayWindow_(now);
  var groups = readGrouped_();
  var week = weekDayIds_(now);
  var figureWeek = weekDayIds_(window.start);
  var need = Object.keys(PLAYERS).length;
  var defeated = [];
  var defeatedAll = [];
  var weekCheckins = [];
  Object.keys(groups).forEach(function (id) {
    if ((groups[id] || []).length >= need) defeatedAll.push(id);
  });
  defeatedAll.sort();
  for (var i = 0; i < week.length; i++) {
    var rows = groups[week[i]] || [];
    if (rows.length >= need) defeated.push(week[i]);
  }
  for (var f = 0; f < figureWeek.length; f++) {
    var figureRows = groups[figureWeek[f]] || [];
    for (var r = 0; r < figureRows.length; r++) {
      weekCheckins.push({
        dayId: figureWeek[f],
        playerId: figureRows[r].playerId,
        option: figureRows[r].option,
      });
    }
  }
  return {
    dayId: window.dayId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    serverNow: formatIso_(now),
    checkins: groups[window.dayId] || [],
    weekDefeated: defeated,
    weekCheckins: weekCheckins,
    defeatedAll: defeatedAll,
    phoneColors: readColors_(),
    stickers: readStickers_(),
  };
}

function num_(value) {
  var n = Number(value);
  if (!isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

function saveColor_(body) {
  var playerId = String(body.playerId || "");
  var color = String(body.color || "");
  if (!PLAYERS[playerId] || !COLORS[color]) return { error: "refused" };
  var sh = colorSheet_();
  var values = sh.getDataRange().getValues();
  var found = 0;
  for (var i = 1; i < values.length; i++) {
    if (asText_(values[i][0]) === playerId) {
      found = i + 1;
      break;
    }
  }
  var row = found || sh.getLastRow() + 1;
  var range = sh.getRange(row, 1, 1, 3);
  range.setNumberFormat("@");
  range.setValues([[playerId, color, formatIso_(new Date())]]);
  return readState_();
}

function saveSticker_(body) {
  var playerId = String(body.playerId || "");
  var dayId = String(body.dayId || "");
  var kind = body.kind === "mesh" ? "mesh" : body.kind === "face" ? "face" : "";
  var x = num_(body.x);
  var y = num_(body.y);
  var z = num_(body.z);
  var nx = num_(body.nx);
  var ny = num_(body.ny);
  var nz = num_(body.nz);
  if (!PLAYERS[playerId] || !kind || x === null || y === null || z === null || nx === null || ny === null || nz === null) {
    return { error: "refused" };
  }
  if (kind === "face" && (x < 0 || x > 520 || y < 0 || y > 1040)) return { error: "refused" };
  if (kind === "mesh" && (Math.abs(x) > 900 || Math.abs(y) > 900 || Math.abs(z) > 500)) return { error: "refused" };
  if (!defeatedDay_(dayId)) return { error: "refused" };
  var sh = stickerSheet_();
  var values = sh.getDataRange().getValues();
  var found = 0;
  for (var i = 1; i < values.length; i++) {
    if (asText_(values[i][0]) === playerId && asText_(values[i][1]) === dayId) {
      found = i + 1;
      break;
    }
  }
  var row = found || sh.getLastRow() + 1;
  var range = sh.getRange(row, 1, 1, 9);
  range.setNumberFormat("@");
  range.setValues([[playerId, dayId, kind, String(x), String(y), String(z), String(nx), String(ny), String(nz)]]);
  return readState_();
}

function removeSticker_(body) {
  var playerId = String(body.playerId || "");
  var dayId = String(body.dayId || "");
  if (!PLAYERS[playerId] || !dayId) return { error: "refused" };
  var sh = stickerSheet_();
  var values = sh.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (asText_(values[i][0]) === playerId && asText_(values[i][1]) === dayId) sh.deleteRow(i + 1);
  }
  return readState_();
}

function defeatedDay_(dayId) {
  var groups = readGrouped_();
  var rows = groups[dayId] || [];
  return rows.length >= Object.keys(PLAYERS).length;
}

function colorSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName("PhoneColors");
  if (!sh) sh = ss.insertSheet("PhoneColors");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 3).setNumberFormat("@");
    sh.getRange(1, 1, 1, 3).setValues([["player_id", "color", "updated_at"]]);
    sh.getRange(1, 1, 1, 3).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function stickerSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName("Stickers");
  if (!sh) sh = ss.insertSheet("Stickers");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 9).setNumberFormat("@");
    sh.getRange(1, 1, 1, 9).setValues([[
      "player_id", "day_id", "kind", "x", "y", "z", "nx", "ny", "nz",
    ]]);
    sh.getRange(1, 1, 1, 9).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function readColors_() {
  var sh = colorSheet_();
  var values = sh.getDataRange().getValues();
  var list = [];
  var seen = {};
  for (var i = 1; i < values.length; i++) {
    var playerId = asText_(values[i][0]);
    var color = asText_(values[i][1]);
    if (!PLAYERS[playerId] || !COLORS[color] || seen[playerId]) continue;
    seen[playerId] = true;
    list.push({ playerId: playerId, color: color });
  }
  return list;
}

function readStickers_() {
  var sh = stickerSheet_();
  var values = sh.getDataRange().getValues();
  var list = [];
  var seen = {};
  for (var i = 1; i < values.length; i++) {
    var playerId = asText_(values[i][0]);
    var dayId = asText_(values[i][1]);
    var kind = asText_(values[i][2]);
    if (!PLAYERS[playerId] || !dayId || (kind !== "face" && kind !== "mesh")) continue;
    var key = playerId + "|" + dayId;
    if (seen[key]) continue;
    seen[key] = true;
    list.push({
      playerId: playerId,
      dayId: dayId,
      kind: kind,
      x: num_(values[i][3]),
      y: num_(values[i][4]),
      z: num_(values[i][5]),
      nx: num_(values[i][6]),
      ny: num_(values[i][7]),
      nz: num_(values[i][8]),
    });
  }
  return list;
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
    start: start,
  };
}

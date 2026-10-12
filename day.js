// Shared-day clock. The reset is a wall-clock hour in the anchor timezone.
// The window runs until that same hour comes around again, so most days are
// 24 hours and the two daylight-saving nights are 23 or 25. China has no
// daylight saving, so its label shifts by an hour when the US does.
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MonsterDay = api;
})(function () {
  var WEEK_ZH = {
    Sun: "周日",
    Mon: "周一",
    Tue: "周二",
    Wed: "周三",
    Thu: "周四",
    Fri: "周五",
    Sat: "周六",
  };

  function formatIso(date) {
    return new Date(date.getTime()).toISOString().slice(0, 19) + "Z";
  }

  function zonedParts(date, timeZone) {
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    var map = {};
    fmt.formatToParts(date).forEach(function (part) {
      if (part.type !== "literal") map[part.type] = part.value;
    });
    var hour = parseInt(map.hour, 10);
    if (hour === 24) hour = 0;
    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10),
      day: parseInt(map.day, 10),
      hour: hour,
      minute: parseInt(map.minute, 10),
      second: parseInt(map.second, 10),
      weekday: map.weekday,
    };
  }

  function shiftDate(year, month, day, delta) {
    var dt = new Date(Date.UTC(year, month - 1, day + delta));
    return {
      y: dt.getUTCFullYear(),
      m: dt.getUTCMonth() + 1,
      d: dt.getUTCDate(),
    };
  }

  // Milliseconds to add to UTC to get the zone's wall clock, at this instant.
  function offsetMsAt(utcMs, timeZone) {
    var p = zonedParts(new Date(utcMs), timeZone);
    var asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUTC - utcMs;
  }

  function wallToUtc(year, month, day, hour, minute, second, timeZone) {
    var desired = Date.UTC(year, month - 1, day, hour, minute, second);
    var utc = desired;
    for (var i = 0; i < 4; i++) {
      var next = desired - offsetMsAt(utc, timeZone);
      if (next === utc) return new Date(next);
      utc = next;
    }
    return new Date(utc);
  }

  // Reset minute is 00, so the hour alone decides whether today's reset has happened.
  function dayWindow(now, timeZone, resetHour) {
    var p = zonedParts(now, timeZone);
    var y = p.year;
    var m = p.month;
    var d = p.day;
    if (p.hour < resetHour) {
      var prev = shiftDate(y, m, d, -1);
      y = prev.y;
      m = prev.m;
      d = prev.d;
    }
    var start = wallToUtc(y, m, d, resetHour, 0, 0, timeZone);
    var next = shiftDate(y, m, d, 1);
    var end = wallToUtc(next.y, next.m, next.d, resetHour, 0, 0, timeZone);
    return {
      dayId: formatIso(start),
      startsAt: formatIso(start),
      endsAt: formatIso(end),
      start: start,
      end: end,
    };
  }

  function zhPeriod(hour) {
    if (hour < 5) return "凌晨";
    if (hour < 11) return "早上";
    if (hour < 13) return "中午";
    if (hour < 18) return "下午";
    return "晚上";
  }

  function formatWhen(date, timeZone, lang, zoneLabel) {
    var p = zonedParts(date, timeZone);
    var h12 = p.hour % 12;
    if (h12 === 0) h12 = 12;
    var minute = String(p.minute).padStart(2, "0");
    if (lang === "zh") {
      var text = WEEK_ZH[p.weekday] + zhPeriod(p.hour) + " " + h12 + ":" + minute;
      return zoneLabel ? text + "（" + zoneLabel + "）" : text;
    }
    var ampm = p.hour >= 12 ? "PM" : "AM";
    var text = p.weekday + " " + h12 + ":" + minute + " " + ampm;
    return zoneLabel ? text + " " + zoneLabel : text;
  }

  function weekdayLabel(date, timeZone, lang) {
    var p = zonedParts(date, timeZone);
    if (lang === "zh") return WEEK_ZH[p.weekday] || p.weekday;
    return p.weekday;
  }

  // Monday through Sunday by the clock in timeZone. Each id is that
  // morning's reset, which is the monster for that weekday.
  function weekDayIds(now, timeZone, resetHour) {
    var p = zonedParts(now, timeZone);
    var weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
    var back = (weekday + 6) % 7;
    var monday = shiftDate(p.year, p.month, p.day, -back);
    var ids = [];
    for (var i = 0; i < 7; i++) {
      var day = shiftDate(monday.y, monday.m, monday.d, i);
      var start = wallToUtc(day.y, day.m, day.d, resetHour, 0, 0, timeZone);
      ids.push(formatIso(start));
    }
    return ids;
  }

  function deadlineCopy(endsAt, lang, viewerZone, config) {
    var local = formatWhen(endsAt, viewerZone, lang, null);
    var a = formatWhen(endsAt, config.timezoneA, lang, config.zoneALabel[lang]);
    var b = formatWhen(endsAt, config.timezoneB, lang, config.zoneBLabel[lang]);
    if (lang === "zh") {
      return { local: "到 " + local, both: "到 " + a + "·" + b };
    }
    return { local: "Until " + local, both: "Until " + a + " · " + b };
  }

  return {
    formatIso: formatIso,
    zonedParts: zonedParts,
    dayWindow: dayWindow,
    weekDayIds: weekDayIds,
    weekdayLabel: weekdayLabel,
    deadlineCopy: deadlineCopy,
    formatWhen: formatWhen,
  };
});

(function () {
  var CONFIG = window.MONSTER_CONFIG;
  var COPY = {
    title: { en: "Liping's Workout Tracker", zh: "立平的健身记录" },
    who: { en: "Who Are You?", zh: "你是哪一位？" },
    switchName: { en: "Switch User", zh: "换用户" },
    waiting: { en: "waiting...", zh: "等待" },
    leg: { en: "Legs", zh: "练腿" },
    chest: { en: "Chest/Cardio", zh: "胸/有氧" },
    back: { en: "Back", zh: "练背" },
    rest: { en: "Rest/Walk", zh: "休息/走路" },
    nobody: { en: "A new monster is here!", zh: "一只新怪物来了！" },
    partial: { en: "Nice hit! The others need to join.", zh: "“打得好！其他人也得跟上。”" },
    defeated: { en: "You have defeated today's monster together.", zh: "你们齐心协力击败了今天的怪物。" },
    slip: { en: "Yesterday's slipped away. A new one is here!", zh: "昨天已悄然逝去，新的一天已经到来！" },
    saved: { en: "Congrats, today's workout is saved.", zh: "恭喜，今天的训练已保存。" },
    quiet: { en: "No data received... Trying again.", zh: "未接收到数据……正在重试。" },
    hint: {
      en: "Add the Apps Script web app URL in config.js.",
      zh: "请把 Apps Script 网页应用链接填进 config.js。",
    },
    replay: { en: "Replay", zh: "重播" },
    prevDay: { en: "Previous day", zh: "前一天" },
    nextDay: { en: "Next day", zh: "后一天" },
    prevUser: { en: "Previous user", zh: "上一位" },
    nextUser: { en: "Next user", zh: "下一位" },
    chooseUser: { en: "Choose this user", zh: "选这位" },
    langGroup: { en: "Language", zh: "语言" },
    recap: { en: "Recap", zh: "回顾" },
    recapClose: { en: "Close", zh: "关闭" },
    recapEmpty: { en: "No monsters defeated this week.", zh: "这周没有击败怪物。" },
    sheet: { en: "Sheet connection", zh: "表格连接" },
    decorate: { en: "Decorate", zh: "装饰" },
  };

  var PHONE_COLORS = {
    teal: true, pink: true, hot: true, green: true, purple: true,
    yellow: true, blue: true, orange: true, grey: true,
  };
  var COLOR_NAMES = {
    teal: { en: "Teal", zh: "青色" },
    pink: { en: "Light pink", zh: "浅粉" },
    hot: { en: "Hot pink", zh: "亮粉" },
    green: { en: "Light green", zh: "浅绿" },
    purple: { en: "Soft purple", zh: "淡紫" },
    yellow: { en: "Soft yellow", zh: "浅黄" },
    blue: { en: "Baby blue", zh: "婴儿蓝" },
    orange: { en: "Orange", zh: "橙色" },
    grey: { en: "Moon grey", zh: "月灰" },
  };

  var OPTION_IDS = ["leg", "chest", "back", "rest"];
  var ATTACK = { leg: "kick", chest: "punch", back: "slam", rest: "heat" };

  var lang = "en";
  var playerId = "";
  var state = null;
  var synced = false;
  var sheetError = false;
  var offsetMs = 0;
  var slipUntil = 0;
  var savedUntil = 0;
  var saveSeq = 0;
  var writes = 0;
  var decorWrites = 0;
  var decorateOpen = false;
  var drag = null;
  var writeChain = Promise.resolve();
  var polling = false;
  var animGen = 0;
  var pendingAnims = 0;
  var animChain = Promise.resolve();
  var played = {};
  var visualPlayers = new Set();
  var visualOptions = new Map();
  var browsePlayers = new Set();
  var browseOptions = new Map();
  var localAnimated = null;
  var optimistic = null;
  var monsterDay = "";
  var statusTimer = 0;
  var boundaryTimer = 0;
  var polledEnd = "";
  var recapGen = 0;
  var recapDayId = "";
  var quietUntil = 0;
  var typeTarget = "";
  var typeTimer = 0;
  var viewOffset = 0;
  var VIEW_MIN = -21;
  var VIEW_MAX = 7;
  var picking = false;
  var pickIndex = 0;

  var el = {
    title: document.getElementById("title"),
    title2: document.getElementById("title-2"),
    titleEdge: document.getElementById("title-edge"),
    titleEdge2: document.getElementById("title-edge-2"),
    langGroup: document.getElementById("lang-group"),
    langToggle: document.getElementById("lang-toggle"),
    who: document.getElementById("who"),
    choices: document.getElementById("who-choices"),
    name: document.getElementById("monster-name"),
    descLive: document.getElementById("desc-live"),
    homeStage: document.getElementById("home-stage"),
    pickStage: document.getElementById("pick-stage"),
    signal: document.getElementById("signal"),
    battFill: document.getElementById("batt-fill"),
    pips: document.getElementById("pips"),
    battery: document.getElementById("battery"),
    remain: document.getElementById("remain"),
    localEnd: document.getElementById("local-end"),
    bothEnd: document.getElementById("both-end"),
    hint: document.getElementById("hint"),
    figures: document.getElementById("figures"),
    options: document.getElementById("options"),
    switchName: document.getElementById("switch-name"),
    replay: document.getElementById("replay"),
    dayPrev: document.getElementById("day-prev"),
    dayNext: document.getElementById("day-next"),
    futureMark: document.getElementById("future-mark"),
    lcd: document.querySelector(".lcd"),
    recap: document.getElementById("recap"),
    recapLayer: document.getElementById("recap-layer"),
    recapViewport: document.getElementById("recap-viewport"),
    recapClose: document.getElementById("recap-close"),
    recapStage: document.getElementById("recap-stage"),
    recapCaption: document.getElementById("recap-caption"),
    decorate: document.getElementById("decorate"),
    colorCol: document.getElementById("color-col"),
    stickerCol: document.getElementById("sticker-col"),
    ghost: document.getElementById("sticker-ghost"),
    faceStickers: document.getElementById("face-stickers"),
  };

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function t(key) {
    var row = COPY[key];
    return (row && (row[lang] || row.en)) || "";
  }

  function playerById(id) {
    for (var i = 0; i < CONFIG.players.length; i++) {
      if (CONFIG.players[i].id === id) return CONFIG.players[i];
    }
    return null;
  }

  function playerName(p) {
    if (!p) return "";
    return lang === "zh" ? p.zh : p.en;
  }

  function detectLang() {
    var saved = storageGet("monster.lang");
    if (saved === "en" || saved === "zh") return saved;
    var nav = (navigator.language || "en").toLowerCase();
    return nav.indexOf("zh") === 0 ? "zh" : "en";
  }

  function playedKey(dayId) {
    return "monster.played." + dayId;
  }

  function loadPlayed(dayId) {
    var raw = storageGet(playedKey(dayId));
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function savePlayed() {
    if (!state || !state.dayId) return;
    storageSet(playedKey(state.dayId), JSON.stringify(played));
  }

  function prunePlayed(dayId) {
    var prefix = "monster.played.";
    var keep = prefix + dayId;
    try {
      var drop = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0 && key !== keep) drop.push(key);
      }
      drop.forEach(storageRemove);
    } catch (e) {}
  }

  function readSnap() {
    var raw = storageGet("monster.snapshot");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function writeSnap(snap) {
    storageSet("monster.snapshot", JSON.stringify(snap));
  }

  function noteSlip(prevDayId, prevCount, nextDayId) {
    if (!prevDayId || prevDayId === nextDayId) return;
    if (prevCount < 1 || prevCount > 2) return;
    if (storageGet("monster.slipDay") === nextDayId) return;
    storageSet("monster.slipDay", nextDayId);
    slipUntil = Date.now() + 6000;
  }

  function countRest(map) {
    var n = 0;
    map.forEach(function (opt) {
      if (opt === "rest") n += 1;
    });
    return n;
  }

  function shownCheckins() {
    var list = state && state.checkins ? state.checkins.slice() : [];
    if (!optimistic) return list;
    var row = {
      playerId: optimistic.playerId,
      option: optimistic.option,
      loggedAt: "pending",
    };
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].playerId === optimistic.playerId) {
        list[i] = row;
        found = true;
      }
    }
    if (!found) list.push(row);
    return list;
  }

  function myServerOption() {
    if (!state) return "";
    for (var i = 0; i < state.checkins.length; i++) {
      if (state.checkins[i].playerId === playerId) return state.checkins[i].option;
    }
    return "";
  }

  function cleanState(raw) {
    if (!raw || typeof raw.dayId !== "string" || !raw.endsAt || !raw.serverNow) {
      throw new Error("quiet");
    }
    var checkins = [];
    var weekDefeated = [];
    var weekCheckins = null;
    var seen = {};
    var seenWeek = {};
    if (Array.isArray(raw.weekCheckins)) {
      weekCheckins = [];
      raw.weekCheckins.forEach(function (c) {
        if (!c || typeof c.dayId !== "string" || !c.dayId) return;
        if (!playerById(c.playerId) || OPTION_IDS.indexOf(c.option) < 0) return;
        var key = c.dayId + "|" + c.playerId;
        if (seenWeek[key]) return;
        seenWeek[key] = true;
        weekCheckins.push({
          dayId: c.dayId,
          playerId: c.playerId,
          option: c.option,
        });
      });
    }
    if (Array.isArray(raw.weekDefeated)) {
      raw.weekDefeated.forEach(function (id) {
        if (typeof id === "string" && id) weekDefeated.push(id);
      });
    }
    var defeatedAll = [];
    if (Array.isArray(raw.defeatedAll)) {
      raw.defeatedAll.forEach(function (id) {
        if (typeof id === "string" && id) defeatedAll.push(id);
      });
    } else {
      var keepDefeated = {};
      ((state && state.defeatedAll) || []).forEach(function (id) { keepDefeated[id] = true; });
      weekDefeated.forEach(function (id) { keepDefeated[id] = true; });
      defeatedAll = Object.keys(keepDefeated);
    }
    var phoneColors = [];
    if (Array.isArray(raw.phoneColors)) {
      var seenColor = {};
      raw.phoneColors.forEach(function (row) {
        if (!row || !playerById(row.playerId) || !PHONE_COLORS[row.color] || seenColor[row.playerId]) return;
        seenColor[row.playerId] = true;
        phoneColors.push({ playerId: row.playerId, color: row.color });
      });
    } else if (state && state.phoneColors) {
      phoneColors = state.phoneColors.slice();
    }
    var stickers = [];
    if (Array.isArray(raw.stickers)) {
      var seenSticker = {};
      raw.stickers.forEach(function (row) {
        if (!row || !playerById(row.playerId) || typeof row.dayId !== "string" || !row.dayId) return;
        if (row.kind !== "face" && row.kind !== "mesh") return;
        var key = row.playerId + "|" + row.dayId;
        if (seenSticker[key]) return;
        var place = {
          playerId: row.playerId,
          dayId: row.dayId,
          kind: row.kind,
          x: Number(row.x),
          y: Number(row.y),
          z: Number(row.z),
          nx: Number(row.nx),
          ny: Number(row.ny),
          nz: Number(row.nz),
        };
        if (!isFinite(place.x) || !isFinite(place.y) || !isFinite(place.z)) return;
        if (!isFinite(place.nx) || !isFinite(place.ny) || !isFinite(place.nz)) return;
        seenSticker[key] = true;
        stickers.push(place);
      });
    } else if (state && state.stickers) {
      stickers = state.stickers.slice();
    }
    (raw.checkins || []).forEach(function (c) {
      if (!c || !playerById(c.playerId) || OPTION_IDS.indexOf(c.option) < 0) return;
      if (seen[c.playerId]) return;
      seen[c.playerId] = true;
      checkins.push({
        playerId: c.playerId,
        option: c.option,
        loggedAt: String(c.loggedAt || ""),
      });
    });
    return {
      dayId: raw.dayId,
      startsAt: String(raw.startsAt || raw.dayId),
      endsAt: String(raw.endsAt),
      serverNow: String(raw.serverNow),
      checkins: checkins,
      weekDefeated: weekDefeated,
      weekCheckins: weekCheckins,
      defeatedAll: defeatedAll,
      phoneColors: phoneColors,
      stickers: stickers,
    };
  }

  function scriptUrl() {
    return (CONFIG.scriptUrl || "").trim();
  }

  function withBust(url) {
    var join = url.indexOf("?") >= 0 ? "&" : "?";
    return url + join + "t=" + Date.now();
  }

  function request(method, body) {
    var url = scriptUrl();
    if (!url) return Promise.reject(new Error("quiet"));
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 45000);
    var opts = {
      method: method,
      cache: "no-store",
      signal: ctrl.signal,
    };
    if (method === "GET") {
      url = withBust(url);
    } else {
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (res) {
      if (!res.ok) throw new Error("quiet");
      return res.json();
    }).then(function (data) {
      if (!data || data.error || !data.dayId) throw new Error("quiet");
      return cleanState(data);
    }).finally(function () {
      clearTimeout(timer);
    });
  }

  function showFallback() {
    var now = new Date(Date.now() + offsetMs);
    var w = window.MonsterDay.dayWindow(now, CONFIG.timezoneA, CONFIG.resetHour);
    var next = {
      dayId: w.dayId,
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      serverNow: window.MonsterDay.formatIso(new Date()),
      checkins: state && state.dayId === w.dayId ? state.checkins : [],
      weekDefeated: (state && state.weekDefeated) || [],
      weekCheckins: state && Array.isArray(state.weekCheckins) ? state.weekCheckins : null,
      defeatedAll: (state && state.defeatedAll) || [],
      phoneColors: (state && state.phoneColors) || [],
      stickers: (state && state.stickers) || [],
      provisional: true,
    };
    if (!state || state.dayId !== next.dayId) {
      state = next;
      drawMonster(next.dayId);
      visualPlayers = new Set();
      visualOptions = new Map();
      settleAll();
    } else {
      state = next;
    }
    render();
  }

  function drawMonster(dayId) {
    monsterDay = dayId;
    document.getElementById("home-stage").innerHTML = window.MonsterArt.svgString(dayId, "home");
    document.getElementById("pick-stage").innerHTML = window.MonsterArt.svgString(dayId, "pick");
  }

  function settleAll() {
    var defeated = visualPlayers.size >= 3;
    var restCount = countRest(visualOptions);
    document.querySelectorAll(".monster-svg").forEach(function (svg) {
      window.MonsterArt.settle(svg, { defeated: defeated, restCount: restCount });
    });
    renderPips();
  }

function startDay(next, silentAdopt) {
  animGen += 1;
  pendingAnims = 0;
  animChain = Promise.resolve();
  var wrap = document.querySelector(".stage-wrap");
  if (wrap) wrap.classList.remove("acting");
    visualPlayers = new Set();
    visualOptions = new Map();
    var stored = loadPlayed(next.dayId);
    if (stored) {
      played = stored;
      next.checkins.forEach(function (c) {
        if (played[c.playerId] === c.loggedAt) {
          visualPlayers.add(c.playerId);
          visualOptions.set(c.playerId, c.option);
        }
      });
    } else if (silentAdopt) {
      played = {};
      next.checkins.forEach(function (c) {
        played[c.playerId] = c.loggedAt;
        visualPlayers.add(c.playerId);
        visualOptions.set(c.playerId, c.option);
      });
    } else {
      played = {};
    }
    savePlayed();
    prunePlayed(next.dayId);
    if (viewOffset === 0) {
      drawMonster(next.dayId);
      settleAll();
    }
    consider(next.checkins);
  }

function consider(checkins) {
  var fresh = [];
  checkins.forEach(function (c) {
    if (played[c.playerId] === c.loggedAt) return;
    if (
      localAnimated &&
      localAnimated.playerId === c.playerId &&
      localAnimated.option === c.option
    ) {
      played[c.playerId] = c.loggedAt;
      if (pendingAnims === 0) {
        visualPlayers.add(c.playerId);
        visualOptions.set(c.playerId, c.option);
        settleAll();
      }
      return;
    }
    fresh.push(c);
  });
    fresh.sort(function (a, b) {
      return String(a.loggedAt).localeCompare(String(b.loggedAt));
    });
    if (viewOffset !== 0) {
      fresh.forEach(function (c) {
        played[c.playerId] = c.loggedAt;
        visualPlayers.add(c.playerId);
        visualOptions.set(c.playerId, c.option);
      });
      savePlayed();
      return;
    }
    fresh.forEach(function (c) {
      enqueueHit(c, true);
    });
    savePlayed();
  }

  function enqueueHit(c, stamp) {
    if (stamp) {
      played[c.playerId] = c.loggedAt;
      savePlayed();
    }
    var gen = animGen;
    pendingAnims += 1;
    animChain = animChain.then(function () {
      if (gen !== animGen) return;
      return animateHit(c, gen).then(
        function () {},
        function () {}
      ).then(function () {
        if (gen === animGen) pendingAnims = Math.max(0, pendingAnims - 1);
      });
    });
  }

  function animateHit(c, gen) {
    var svg = document.querySelector("#home-stage .monster-svg");
    if (!svg || gen !== animGen) return Promise.resolve();
    var prev = visualOptions.get(c.playerId) || "";
    var restBefore = countRest(visualOptions);
    var restAfter = restBefore - (prev === "rest" ? 1 : 0) + (c.option === "rest" ? 1 : 0);
    var isNew = !visualPlayers.has(c.playerId);
    var finishing = (isNew && visualPlayers.size >= 2) || visualPlayers.size >= 3;
    var wrap = document.querySelector(".stage-wrap");
    if (wrap) wrap.classList.add("acting");
    return window.MonsterArt.play(svg, ATTACK[c.option], {
      finishing: finishing,
      restBefore: restBefore,
      restAfter: restAfter,
      alive: function () { return gen === animGen && svg.isConnected; },
    }).then(function () {
      if (gen !== animGen) return;
      if (viewOffset === 0) {
        visualPlayers.add(c.playerId);
        visualOptions.set(c.playerId, c.option);
        settleAll();
      } else {
        browsePlayers.add(c.playerId);
        browseOptions.set(c.playerId, c.option);
        var rest = countRest(browseOptions);
        document.querySelectorAll(".monster-svg").forEach(function (svg) {
          window.MonsterArt.settle(svg, { defeated: browsePlayers.size >= 3, restCount: rest });
        });
        setHp(browsePlayers.size);
      }
      if (pendingAnims <= 1 && wrap) wrap.classList.remove("acting");
    });
  }

  function applyState(next) {
    var wasSynced = synced;
    if (!wasSynced) {
      var snap = readSnap();
      if (snap) noteSlip(snap.dayId, snap.count, next.dayId);
    } else if (state && state.dayId !== next.dayId) {
      noteSlip(state.dayId, state.checkins.length, next.dayId);
    }

    var dayChanged = !state || state.dayId !== next.dayId;
    state = next;
    sheetError = false;
    var serverMs = Date.parse(next.serverNow);
    if (!isNaN(serverMs)) offsetMs = serverMs - Date.now();

    if (!wasSynced) {
      startDay(next, true);
      synced = true;
    } else if (dayChanged) {
      optimistic = null;
      localAnimated = null;
      startDay(next, false);
    } else {
      consider(next.checkins);
    }

    writeSnap({ dayId: next.dayId, count: next.checkins.length });
    if (optimistic) {
      var mine = null;
      for (var i = 0; i < next.checkins.length; i++) {
        if (next.checkins[i].playerId === optimistic.playerId) mine = next.checkins[i];
      }
      if (mine && mine.option === optimistic.option) optimistic = null;
    }
    scheduleBoundary();
    render();
    armStatusTimer();
  }

  function poll() {
    if (polling || writes > 0 || decorWrites > 0) return;
    if (!scriptUrl()) {
      sheetError = true;
      if (!state) showFallback();
      else render();
      return;
    }
    polling = true;
    request("GET").then(function (next) {
      applyState(next);
    }).catch(function () {
      sheetError = true;
      if (!synced) showFallback();
      render();
    }).finally(function () {
      polling = false;
    });
  }

  function onOption(option) {
    if (!synced || !playerId || !scriptUrl()) return;
    if (optimistic && optimistic.option === option) return;
    if (!optimistic && myServerOption() === option) return;
    var seq = ++saveSeq;
    optimistic = { playerId: playerId, option: option };
    localAnimated = { playerId: playerId, option: option, seq: seq };
    render();
    enqueueHit(
      { playerId: playerId, option: option, loggedAt: "local-" + seq },
      false
    );
    writes += 1;
    writeChain = writeChain.then(function () {
      if (seq !== saveSeq) {
        writes -= 1;
        return;
      }
      return request("POST", { playerId: playerId, option: option }).then(function (next) {
        if (seq !== saveSeq) return;
        savedUntil = Date.now() + 3500;
        applyState(next);
        if (localAnimated && localAnimated.seq === seq) localAnimated = null;
      }).catch(function () {
        if (seq !== saveSeq) return;
        sheetError = true;
        optimistic = null;
        if (localAnimated && localAnimated.seq === seq) localAnimated = null;
        render();
      }).finally(function () {
        writes -= 1;
      });
    });
  }

  function scheduleBoundary() {
    clearTimeout(boundaryTimer);
    if (!state || !state.endsAt) return;
    var ms = Date.parse(state.endsAt) - (Date.now() + offsetMs);
    if (ms > 0 && ms < 48 * 3600 * 1000) {
      boundaryTimer = setTimeout(poll, ms + 500);
    }
  }

  function formatRemain(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var mm = String(m).padStart(2, "0");
    var ss = String(s).padStart(2, "0");
    if (lang === "zh") {
      if (h > 0) return h + "小时" + mm + "分" + ss + "秒";
      if (m > 0) return m + "分" + ss + "秒";
      return s + "秒";
    }
    if (h > 0) return h + "h " + mm + "m " + ss + "s";
    if (m > 0) return m + "m " + ss + "s";
    return s + "s";
  }

  function pacificNow() {
    return new Date(Date.now() + offsetMs);
  }

  function viewedDay() {
    var today = window.MonsterDay.dayWindow(pacificNow(), CONFIG.timezoneA, CONFIG.resetHour);
    if (viewOffset === 0) return today;
    var probe = new Date(Date.parse(today.startsAt) + viewOffset * 86400000 + 12 * 3600000);
    return window.MonsterDay.dayWindow(probe, CONFIG.timezoneA, CONFIG.resetHour);
  }

  function checkinsForDay(dayId) {
    var today = window.MonsterDay.dayWindow(pacificNow(), CONFIG.timezoneA, CONFIG.resetHour);
    if (dayId === today.dayId) return shownCheckins();
    var out = [];
    var seen = {};
    function add(c) {
      if (!c || c.dayId !== dayId) return;
      if (!playerById(c.playerId) || OPTION_IDS.indexOf(c.option) < 0) return;
      if (seen[c.playerId]) return;
      seen[c.playerId] = true;
      out.push({ playerId: c.playerId, option: c.option, loggedAt: c.loggedAt || "" });
    }
    if (state && Array.isArray(state.weekCheckins)) state.weekCheckins.forEach(add);
    else {
      var cached = readFigureCache();
      if (cached && Array.isArray(cached.checkins)) cached.checkins.forEach(add);
    }
    return out;
  }

  function optionAreas(option) {
    return {
      leg: option === "leg",
      chest: option === "chest",
      back: option === "back",
      rest: option === "rest",
    };
  }

  function paintSettled(dayId, checks) {
    drawMonster(dayId);
    var rest = 0;
    checks.forEach(function (c) {
      if (c.option === "rest") rest += 1;
    });
    document.querySelectorAll(".monster-svg").forEach(function (svg) {
      window.MonsterArt.settle(svg, { defeated: checks.length >= 3, restCount: rest });
    });
    setHp(distinctCheckins(checks));
  }

  function syncBrowse() {
    var future = viewOffset > 0;
    el.lcd.classList.toggle("is-future", future && !picking);
    el.futureMark.hidden = !future || picking;
    el.replay.disabled = !picking && future;
    el.dayPrev.disabled = !picking && viewOffset <= VIEW_MIN;
    el.dayNext.disabled = !picking && viewOffset >= VIEW_MAX;
    if (viewOffset === 0) {
      if (state && monsterDay !== state.dayId) {
        drawMonster(state.dayId);
        settleAll();
      }
      return;
    }
    if (future) return;
    var day = viewedDay();
    if (monsterDay !== day.dayId) paintSettled(day.dayId, checkinsForDay(day.dayId));
  }

  function stepPick(delta) {
    var order = figureOrder();
    var current = CONFIG.players[pickIndex];
    var i = 0;
    order.forEach(function (p, idx) {
      if (current && p.id === current.id) i = idx;
    });
    var next = order[(i + delta + order.length) % order.length];
    CONFIG.players.forEach(function (p, idx) {
      if (p.id === next.id) pickIndex = idx;
    });
    render();
  }

  function confirmPick() {
    var chosen = CONFIG.players[pickIndex];
    if (!chosen) return;
    picking = false;
    setPlayer(chosen.id);
  }

  function stepDay(delta) {
    var next = viewOffset + delta;
    if (next < VIEW_MIN || next > VIEW_MAX) return;
    viewOffset = next;
    animGen += 1;
    pendingAnims = 0;
    animChain = Promise.resolve();
    monsterDay = "";
    render();
  }

  function replayView() {
    if (viewOffset > 0) return;
    var day = viewedDay();
    var checks = checkinsForDay(day.dayId).slice();
    var restorePlayers = visualPlayers;
    var restoreOptions = visualOptions;
    var browsing = viewOffset !== 0;
    animGen += 1;
    var gen = animGen;
    pendingAnims = 0;
    animChain = Promise.resolve();
    if (browsing) {
      browsePlayers = new Set();
      browseOptions = new Map();
    } else {
      visualPlayers = new Set();
      visualOptions = new Map();
    }
    paintSettled(day.dayId, []);
    checks.forEach(function (c) { enqueueHit(c, false); });
    if (!browsing) {
      animChain = animChain.then(function () {
        if (gen !== animGen) {
          visualPlayers = restorePlayers;
          visualOptions = restoreOptions;
        }
      });
    }
  }

  function recapOpen() {
    return window.MonsterDay.zonedParts(pacificNow(), CONFIG.timezoneA).weekday === "Sun";
  }

  function updateRecapEnabled() {
    var open = recapOpen();
    if (el.recap.disabled === !open) return;
    el.recap.disabled = !open;
  }

  function defeatedIds() {
    var allow = {};
    window.MonsterDay.weekDayIds(pacificNow(), CONFIG.timezoneA, CONFIG.resetHour).forEach(function (id) {
      allow[id] = true;
    });
    var seen = {};
    var ids = [];
    function add(id) {
      if (!allow[id] || seen[id]) return;
      seen[id] = true;
      ids.push(id);
    }
    ((state && state.weekDefeated) || []).forEach(add);
    if (state && shownCheckins().length >= CONFIG.players.length) add(state.dayId);
    ids.sort();
    return ids;
  }

  function recapCaptionText(dayId) {
    var traits = window.MonsterArt.traitsFor(dayId);
    var name = lang === "zh" ? traits.nameZh : traits.nameEn;
    var day = window.MonsterDay.weekdayLabel(new Date(dayId), CONFIG.timezoneA, lang);
    return day + " · " + name;
  }

  function prefersReduced() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function recapPlace(x) {
    el.recapStage.style.transform = "translate3d(" + x.toFixed(1) + "px, -50%, 0)";
  }

  function recapBounds() {
    var view = el.recapViewport.clientWidth || window.innerWidth;
    var width = el.recapStage.getBoundingClientRect().width;
    if (!width) width = Math.min(view * 0.78, 280);
    return {
      enter: view + 24,
      center: (view - width) / 2,
      exit: -width - 24,
    };
  }

  function recapMove(from, to, ms, gen) {
    return new Promise(function (resolve) {
      if (gen !== recapGen) {
        resolve(false);
        return;
      }
      if (ms <= 24) {
        recapPlace(to);
        resolve(true);
        return;
      }
      var start = performance.now();
      function frame(now) {
        if (gen !== recapGen) {
          resolve(false);
          return;
        }
        var raw = Math.min(1, (now - start) / ms);
        var p = raw * raw * (3 - 2 * raw);
        recapPlace(from + (to - from) * p);
        if (raw < 1) requestAnimationFrame(frame);
        else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }

  function recapWait(ms, gen) {
    return new Promise(function (resolve) {
      if (gen !== recapGen) {
        resolve(false);
        return;
      }
      setTimeout(function () { resolve(gen === recapGen); }, ms);
    });
  }

  function showRecapMonster(dayId, index, gen) {
    var reduce = prefersReduced();
    el.recapStage.innerHTML = window.MonsterArt.svgString(dayId, "recap" + index + "-" + gen);
    var svg = el.recapStage.querySelector(".monster-svg");
    window.MonsterArt.settle(svg, { defeated: false, restCount: 0 });
    recapDayId = dayId;
    el.recapCaption.textContent = recapCaptionText(dayId);
    el.recapCaption.classList.remove("is-empty");
    var bounds = recapBounds();
    recapPlace(bounds.enter);
    return recapMove(bounds.enter, bounds.center, reduce ? 20 : 720, gen).then(function (ok) {
      if (!ok) return false;
      return recapWait(reduce ? 160 : 780, gen);
    }).then(function (ok) {
      if (!ok) return false;
      return window.MonsterArt.melt(svg, {
        scaleY: 1,
        alive: function () { return gen === recapGen && svg.isConnected; },
      }).then(function () { return gen === recapGen; });
    }).then(function (ok) {
      if (!ok) return false;
      return recapWait(reduce ? 160 : 720, gen);
    }).then(function (ok) {
      if (!ok) return false;
      var latest = recapBounds();
      return recapMove(latest.center, latest.exit, reduce ? 20 : 680, gen);
    });
  }

  function stopRecap() {
    recapGen += 1;
    recapDayId = "";
    el.recapLayer.hidden = true;
    el.recapStage.innerHTML = "";
    el.recapStage.style.transform = "";
    el.recapCaption.textContent = "";
    el.recapCaption.classList.remove("is-empty");
  }

  function startRecap() {
    if (!recapOpen() || !el.recapLayer.hidden) return;
    var ids = defeatedIds();
    recapGen += 1;
    var gen = recapGen;
    recapDayId = "";
    el.recapLayer.hidden = false;
    el.recapClose.textContent = t("recapClose");
    if (!ids.length) {
      el.recapStage.innerHTML = "";
      el.recapStage.style.transform = "";
      el.recapCaption.textContent = t("recapEmpty");
      el.recapCaption.classList.add("is-empty");
      el.recapClose.focus();
      return;
    }
    el.recapCaption.classList.remove("is-empty");
    el.recapClose.focus();
    var chain = Promise.resolve(true);
    ids.forEach(function (dayId, index) {
      chain = chain.then(function (ok) {
        if (!ok || gen !== recapGen) return false;
        return showRecapMonster(dayId, index, gen);
      });
    });
    chain.then(function () {
      if (gen !== recapGen) return;
      stopRecap();
    }).catch(function () {
      if (gen !== recapGen) return;
      stopRecap();
    });
  }

  function tick() {
    updateRecapEnabled();
    if (!state || !state.endsAt) return;
    var left = Date.parse(state.endsAt) - (Date.now() + offsetMs);
    el.remain.textContent = formatRemain(left);
    var startMs = Date.parse(state.startsAt);
    var endMs = Date.parse(state.endsAt);
    var span = endMs - startMs;
    var pct = span > 0 ? Math.max(0, Math.min(1, left / span)) : 0;
    if (el.battFill) {
      el.battFill.style.width = (pct * 100).toFixed(1) + "%";
      el.battFill.classList.toggle("is-low", pct > 0 && pct < 0.15);
    }
    if (left <= 0 && polledEnd !== state.endsAt && writes === 0) {
      polledEnd = state.endsAt;
      poll();
    }
  }

  function statusKey() {
    if (Date.now() < quietUntil) return "quiet";
    if (sheetError) return "quiet";
    var n = shownCheckins().length;
    if (n >= 3) return "defeated";
    if (Date.now() < slipUntil) return "slip";
    if (Date.now() < savedUntil) return "saved";
    if (n === 0) return "nobody";
    return "partial";
  }

  function armStatusTimer() {
    clearTimeout(statusTimer);
    var waits = [slipUntil, savedUntil, quietUntil]
      .map(function (t) { return t - Date.now(); })
      .filter(function (ms) { return ms > 0; });
    if (!waits.length) return;
    var delay = Math.min.apply(null, waits) + 40;
    statusTimer = setTimeout(function () {
      renderStatus();
      armStatusTimer();
    }, delay);
  }

  var POSE = { p1: "auntie", p2: "shelby", p3: "bernice" };

  // Legs, chest, and back stay filled for the monster week. A finished set
  // (all three) or a new week clears that person back to gray. Rest paints
  // the unfilled parts pink and stays until the same reset.
  function cycleAreas(options) {
    var got = { leg: false, chest: false, back: false };
    var rest = false;
    var done = false;
    options.forEach(function (option) {
      if (done) {
        got = { leg: false, chest: false, back: false };
        rest = false;
        done = false;
      }
      if (option === "rest") rest = true;
      else if (option === "leg" || option === "chest" || option === "back") got[option] = true;
      if (got.leg && got.chest && got.back) done = true;
    });
    if (done) return { leg: false, chest: false, back: false, rest: false };
    return { leg: got.leg, chest: got.chest, back: got.back, rest: rest };
  }

  function figureWeekIds() {
    var day = window.MonsterDay.dayWindow(pacificNow(), CONFIG.timezoneA, CONFIG.resetHour);
    return window.MonsterDay.weekDayIds(new Date(day.dayId), CONFIG.timezoneA, CONFIG.resetHour);
  }

  function readFigureCache() {
    var raw = storageGet("monster.figureWeek");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function figureRows() {
    var ids = figureWeekIds();
    var allow = {};
    ids.forEach(function (id) { allow[id] = true; });
    var map = {};
    function add(row) {
      if (!row || !allow[row.dayId] || !playerById(row.playerId)) return;
      if (OPTION_IDS.indexOf(row.option) < 0) return;
      map[row.dayId + "|" + row.playerId] = {
        dayId: row.dayId,
        playerId: row.playerId,
        option: row.option,
      };
    }
    if (state && Array.isArray(state.weekCheckins)) {
      state.weekCheckins.forEach(add);
    } else {
      var cached = readFigureCache();
      if (cached && cached.weekId === ids[0] && Array.isArray(cached.checkins)) {
        cached.checkins.forEach(add);
      }
      if (state && allow[state.dayId]) {
        state.checkins.forEach(function (c) {
          add({ dayId: state.dayId, playerId: c.playerId, option: c.option });
        });
      }
    }
    var confirmed = Object.keys(map).map(function (key) { return map[key]; });
    storageSet("monster.figureWeek", JSON.stringify({ weekId: ids[0], checkins: confirmed }));
    if (state && allow[state.dayId]) {
      shownCheckins().forEach(function (c) {
        add({ dayId: state.dayId, playerId: c.playerId, option: c.option });
      });
    }
    return Object.keys(map).map(function (key) { return map[key]; });
  }

  function areasFor(playerId, rows) {
    var mine = rows.filter(function (c) { return c.playerId === playerId; });
    mine.sort(function (a, b) {
      if (a.dayId < b.dayId) return -1;
      if (a.dayId > b.dayId) return 1;
      return 0;
    });
    return cycleAreas(mine.map(function (c) { return c.option; }));
  }

  function figureLabel(p, areas) {
    var bits = [];
    if (areas.leg) bits.push(t("leg"));
    if (areas.chest) bits.push(t("chest"));
    if (areas.back) bits.push(t("back"));
    if (areas.rest) bits.push(t("rest"));
    return playerName(p) + ", " + (bits.length ? bits.join(", ") : t("waiting"));
  }

  function figureOrder() {
    var others = [];
    var me = null;
    CONFIG.players.forEach(function (p) {
      if (p.id === playerId) me = p;
      else others.push(p);
    });
    if (!me || others.length < 2) return CONFIG.players.slice();
    return [others[0], me, others[1]];
  }

  function renderFigures() {
    if (viewOffset > 0 && !picking) {
      el.figures.innerHTML = "";
      return;
    }
    var rows = figureRows();
    var today = {};
    var source = viewOffset === 0 ? shownCheckins() : checkinsForDay(viewedDay().dayId);
    source.forEach(function (c) { today[c.playerId] = c.option; });
    el.figures.innerHTML = figureOrder().map(function (p) {
      var areas = viewOffset === 0 ? areasFor(p.id, rows) : optionAreas(today[p.id]);
      var cls = "hero " + (POSE[p.id] || "auntie");
      if (areas.rest) cls += " is-rest";
      if (areas.leg) cls += " area-leg";
      if (areas.chest) cls += " area-chest";
      if (areas.back) cls += " area-back";
      var you = p.id === playerId;
      var hot = picking && CONFIG.players[pickIndex] && p.id === CONFIG.players[pickIndex].id;
      var marked = picking ? hot : you;
      var opt = today[p.id];
      var zones = (
        '<i class="zone torso torso-a"></i>' +
        '<i class="zone torso torso-b"></i>' +
        '<i class="zone arms arm-a"></i>' +
        '<i class="zone arms arm-b"></i>' +
        '<i class="zone legs leg-a"></i>' +
        '<i class="zone legs leg-b"></i>'
      );
      return (
        '<div class="figure' + (you ? " is-you" : "") + (hot ? " is-hot" : "") + (marked ? " is-marked" : "") + '">' +
        '<div class="' + cls + '" role="img" aria-label="' + figureLabel(p, areas) + '">' +
        '<div class="layer full"></div>' +
        '<div class="layer cape"></div>' +
        '<div class="layer body">' + zones + "</div>" +
        "</div>" +
        '<p class="figure-caption">' +
        '<span class="figure-name">' + playerName(p) + "</span>" +
        '<span class="figure-sep" aria-hidden="true">|</span>' +
        '<span class="figure-move' + (opt ? " chosen" : "") + '">' +
        (opt ? t(opt) : t("waiting")) +
        "</span>" +
        "</p>" +
        "</div>"
      );
    }).join("");
  }

  function distinctCheckins(checks) {
    var seen = {};
    var n = 0;
    (checks || []).forEach(function (c) {
      if (!c || !c.playerId || seen[c.playerId]) return;
      seen[c.playerId] = true;
      n += 1;
    });
    return n;
  }

  function setHp(count) {
    var n = Math.max(0, Math.min(3, count));
    el.pips.style.setProperty("--hp", String((3 - n) / 3));
  }

  function renderPips() {
    if (viewOffset !== 0) return;
    setHp(visualPlayers.size);
  }

  function renderOptions() {
    var selected = "";
    shownCheckins().forEach(function (c) {
      if (c.playerId === playerId) selected = c.option;
    });
    el.options.innerHTML = OPTION_IDS.map(function (id) {
      var on = selected === id;
      return (
        '<button type="button" class="option' + (on ? " is-on" : "") + '" data-option="' + id + '"' +
        (synced && !picking ? "" : " disabled") +
        ' aria-pressed="' + (on ? "true" : "false") + '">' +
        t(id) +
        "</button>"
      );
    }).join("");
  }

  function renderChoices() {
    el.choices.innerHTML = CONFIG.players.map(function (p) {
      var on = p.id === playerId;
      return (
        '<button type="button" class="choice' + (on ? " is-on" : "") + '" data-player="' + p.id + '"' +
        ' aria-pressed="' + (on ? "true" : "false") + '">' +
        playerName(p) +
        "</button>"
      );
    }).join("");
  }

  function renderClock() {
    if (!state) return;
    var end = new Date(state.endsAt);
    var viewer = "America/Los_Angeles";
    try {
      viewer = Intl.DateTimeFormat().resolvedOptions().timeZone || viewer;
    } catch (e) {}
    var lines = window.MonsterDay.deadlineCopy(end, lang, viewer, CONFIG);
    el.localEnd.textContent = lines.local;
    el.bothEnd.textContent = lines.both;
    tick();
  }

  function typeTo(text) {
    if (text === typeTarget) return;
    typeTarget = text;
    clearInterval(typeTimer);
    if (prefersReduced()) {
      el.name.textContent = text;
      el.name.classList.add("is-done");
      if (el.descLive) el.descLive.textContent = text;
      return;
    }
    var i = 0;
    el.name.textContent = "";
    el.name.classList.remove("is-done");
    typeTimer = setInterval(function () {
      i += 1;
      el.name.textContent = typeTarget.slice(0, i);
      if (i >= typeTarget.length) {
        clearInterval(typeTimer);
        el.name.classList.add("is-done");
        if (el.descLive && el.descLive.textContent !== typeTarget) {
          el.descLive.textContent = typeTarget;
        }
      }
    }, 28);
  }

  function renderStatus() {
    if (!playerId) {
      typeTo(t("who"));
      return;
    }
    if (viewOffset !== 0) {
      var day = viewedDay();
      typeTo(window.MonsterDay.weekdayLabel(new Date(day.dayId), CONFIG.timezoneA, lang));
      return;
    }
    typeTo(t(statusKey()));
  }

  function renderSignal() {
    var on = !!(synced && !sheetError && scriptUrl());
    el.signal.classList.toggle("is-on", on);
    el.signal.setAttribute("aria-pressed", on ? "true" : "false");
    el.signal.setAttribute("aria-label", t("sheet"));
  }

  function myColor() {
    var rows = (state && state.phoneColors) || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].playerId === playerId) return rows[i].color;
    }
    return "blue";
  }

  function myStickers() {
    return ((state && state.stickers) || []).filter(function (row) {
      return row.playerId === playerId;
    });
  }

  function catalogIds() {
    var seen = {};
    var ids = [];
    function add(id) {
      if (!id || seen[id]) return;
      seen[id] = true;
      ids.push(id);
    }
    ((state && state.defeatedAll) || []).forEach(add);
    ((state && state.weekDefeated) || []).forEach(add);
    if (state && shownCheckins().length >= CONFIG.players.length) add(state.dayId);
    ids.sort();
    return ids;
  }

  function stickerWrap(dayId) {
    var svg = window.MonsterArt.stickerSvg(dayId);
    var maskSvg = svg.replace(/fill="[^"]*"/g, 'fill="#ffffff"');
    var mask = "url('data:image/svg+xml;charset=utf-8," + encodeURIComponent(maskSvg) + "')";
    return '<span class="sticker-holo">' + svg +
      '<span class="sticker-sheen" style="mask-image:' + mask + ';-webkit-mask-image:' + mask + '">' +
      '<span class="sticker-sheen-band"></span></span></span>';
  }

  function ensureDecor() {
    if (!state.stickers) state.stickers = [];
    if (!state.phoneColors) state.phoneColors = [];
    if (!state.defeatedAll) state.defeatedAll = [];
  }

  function setLocalColor(color) {
    ensureDecor();
    var found = false;
    state.phoneColors.forEach(function (row) {
      if (row.playerId === playerId) {
        row.color = color;
        found = true;
      }
    });
    if (!found) state.phoneColors.push({ playerId: playerId, color: color });
  }

  function setLocalSticker(place) {
    ensureDecor();
    state.stickers = state.stickers.filter(function (row) {
      return !(row.playerId === playerId && row.dayId === place.dayId);
    });
    state.stickers.push(place);
  }

  function clearLocalSticker(dayId) {
    ensureDecor();
    state.stickers = state.stickers.filter(function (row) {
      return !(row.playerId === playerId && row.dayId === dayId);
    });
  }

  function decorPost(body) {
    if (!scriptUrl()) return;
    decorWrites += 1;
    request("POST", body).then(function (next) {
      applyState(next);
    }).catch(function () {
      // Keep the color and stickers on this phone. A failed save
      // should not replace the workout status line.
    }).finally(function () {
      decorWrites -= 1;
    });
  }

  function renderDecor() {
    if (drag) return;
    var shell = window.PhoneShell;
    if (shell) {
      shell.setColor(myColor());
      shell.setStickers(myStickers());
    }
    if (el.faceStickers) {
      el.faceStickers.innerHTML = myStickers().filter(function (row) {
        return row.kind === "face";
      }).map(function (row) {
        return '<button type="button" class="stuck-face" data-day="' + row.dayId +
          '" style="left:' + row.x + "px;top:" + row.y + 'px">' + stickerWrap(row.dayId) + "</button>";
      }).join("");
    }
    if (!decorateOpen || !el.colorCol || !el.stickerCol) return;
    var order = shell ? shell.order : ["teal", "pink", "hot", "green", "purple", "yellow", "blue", "orange", "grey"];
    var swatches = shell ? shell.swatches : {};
    var current = myColor();
    el.colorCol.innerHTML = order.map(function (id) {
      var hex = swatches[id] ? swatches[id][0] : "#7ec4f2";
      var label = (COLOR_NAMES[id] && (COLOR_NAMES[id][lang] || COLOR_NAMES[id].en)) || id;
      return '<button type="button" class="swatch' + (id === current ? " is-on" : "") +
        '" data-color="' + id + '" style="background:' + hex + '" aria-label="' + label +
        '" aria-pressed="' + (id === current ? "true" : "false") + '"></button>';
    }).join("");
    var placed = {};
    myStickers().forEach(function (row) { placed[row.dayId] = true; });
    el.stickerCol.innerHTML = catalogIds().filter(function (id) {
      return !placed[id];
    }).map(function (id) {
      return '<button type="button" class="sticker-btn" data-day="' + id + '">' + stickerWrap(id) + "</button>";
    }).join("");
  }

  function moveGhost(x, y) {
    el.ghost.style.transition = "none";
    el.ghost.style.left = x + "px";
    el.ghost.style.top = y + "px";
  }

  function beginDrag(dayId, placed, src, event) {
    if (!dayId || drag) return;
    drag = { dayId: dayId, placed: placed, src: src };
    if (src) src.style.opacity = "0.25";
    el.ghost.innerHTML = stickerWrap(dayId);
    el.ghost.hidden = false;
    moveGhost(event.clientX, event.clientY);
    if (window.PhoneShell) {
      window.PhoneShell.setDragging(true);
      if (placed) {
        window.PhoneShell.setStickers(myStickers().filter(function (row) {
          return row.dayId !== dayId;
        }));
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function endDrag(event) {
    if (!drag) return;
    var info = drag;
    drag = null;
    if (info.src) info.src.style.opacity = "";
    if (window.PhoneShell) window.PhoneShell.setDragging(false);
    var hit = playerId && window.PhoneShell && window.PhoneShell.hitTest(event.clientX, event.clientY);
    if (hit) {
      setLocalSticker({
        playerId: playerId,
        dayId: info.dayId,
        kind: hit.kind,
        x: hit.x,
        y: hit.y,
        z: hit.z,
        nx: hit.nx,
        ny: hit.ny,
        nz: hit.nz,
      });
      el.ghost.hidden = true;
      renderDecor();
      decorPost({
        action: "place",
        playerId: playerId,
        dayId: info.dayId,
        kind: hit.kind,
        x: hit.x,
        y: hit.y,
        z: hit.z,
        nx: hit.nx,
        ny: hit.ny,
        nz: hit.nz,
      });
      return;
    }
    if (info.placed && playerId) clearLocalSticker(info.dayId);
    renderDecor();
    var slot = el.stickerCol.querySelector('[data-day="' + info.dayId + '"]');
    var rect = slot ? slot.getBoundingClientRect() : null;
    if (!rect || !rect.width) {
      el.ghost.hidden = true;
    } else {
      el.ghost.style.transition = "left 0.34s ease, top 0.34s ease";
      el.ghost.style.left = (rect.left + rect.width / 2) + "px";
      el.ghost.style.top = (rect.top + rect.height / 2) + "px";
      setTimeout(function () { el.ghost.hidden = true; }, 360);
    }
    if (info.placed && playerId) {
      decorPost({ action: "unstick", playerId: playerId, dayId: info.dayId });
    }
  }

  function render() {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = t("title");
    var titleText = t("title");
    var titleLines = titleText.split(" ");
    var line1 = titleLines.length > 2 ? titleLines.slice(0, 2).join(" ") : titleText;
    var line2 = titleLines.length > 2 ? titleLines.slice(2).join(" ") : "";
    el.title.textContent = line1;
    el.title2.textContent = line2;
    el.titleEdge.textContent = line1;
    el.titleEdge2.textContent = line2;
    var y1 = line2 ? "32" : "48";
    el.title.setAttribute("y", y1);
    el.titleEdge.setAttribute("y", y1);
    el.langGroup.setAttribute("aria-label", t("langGroup"));
    el.langToggle.textContent = lang === "zh" ? "EN" : "中文";
    el.dayPrev.setAttribute("aria-label", t(picking ? "prevUser" : "prevDay"));
    el.dayNext.setAttribute("aria-label", t(picking ? "nextUser" : "nextDay"));
    el.replay.setAttribute("aria-label", t(picking ? "chooseUser" : "replay"));
    el.recap.setAttribute("aria-label", t("recap"));
    updateRecapEnabled();
    el.recapClose.textContent = t("recapClose");
    if (!el.recapLayer.hidden) {
      el.recapCaption.textContent = recapDayId ? recapCaptionText(recapDayId) : t("recapEmpty");
      el.recapCaption.classList.toggle("is-empty", !recapDayId);
    }
    el.who.textContent = t("who");
    el.switchName.textContent = t("switchName");
    var showHint = !scriptUrl();
    el.hint.hidden = !showHint;
    if (showHint) el.hint.textContent = t("hint");
    renderClock();
    renderFigures();
    renderOptions();
    renderChoices();
    renderPips();
    renderSignal();
    renderStatus();
    syncBrowse();
    if (el.decorate) el.decorate.setAttribute("aria-label", t("decorate"));
    renderDecor();
    el.homeStage.hidden = false;
    el.pickStage.hidden = true;
    el.options.hidden = false;
    el.choices.hidden = true;
  }

  function setLang(next) {
    lang = next;
    storageSet("monster.lang", next);
    render();
  }

  function setPlayer(id) {
    if (!playerById(id)) return;
    playerId = id;
    storageSet("monster.player", id);
    render();
  }

  el.langToggle.addEventListener("click", function () {
    setLang(lang === "en" ? "zh" : "en");
  });
  el.replay.addEventListener("click", function () {
    if (picking) confirmPick();
    else replayView();
  });
  el.dayPrev.addEventListener("click", function () {
    if (picking) stepPick(-1);
    else stepDay(-1);
  });
  el.dayNext.addEventListener("click", function () {
    if (picking) stepPick(1);
    else stepDay(1);
  });
  el.recap.addEventListener("click", function () { startRecap(); });
  el.signal.addEventListener("click", function () {
    if (synced && !sheetError && scriptUrl()) return;
    quietUntil = Date.now() + 5200;
    typeTarget = "";
    renderStatus();
    armStatusTimer();
    poll();
  });
  el.battery.addEventListener("click", function () {
    el.remain.classList.remove("is-pop");
    void el.remain.offsetWidth;
    el.remain.classList.add("is-pop");
  });
  el.remain.addEventListener("animationend", function () {
    el.remain.classList.remove("is-pop");
  });
  el.recapLayer.addEventListener("click", function () { stopRecap(); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !el.recapLayer.hidden) stopRecap();
  });
  el.decorate.addEventListener("click", function () {
    decorateOpen = !decorateOpen;
    el.decorate.setAttribute("aria-pressed", decorateOpen ? "true" : "false");
    el.colorCol.hidden = !decorateOpen;
    el.stickerCol.hidden = !decorateOpen;
    renderDecor();
  });
  el.colorCol.addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-color]");
    if (!btn || !playerId) return;
    var color = btn.getAttribute("data-color");
    if (!PHONE_COLORS[color]) return;
    setLocalColor(color);
    renderDecor();
    decorPost({ action: "color", playerId: playerId, color: color });
  });
  el.stickerCol.addEventListener("pointerdown", function (event) {
    var btn = event.target.closest(".sticker-btn");
    if (!btn) return;
    beginDrag(btn.getAttribute("data-day"), false, btn, event);
  });
  el.faceStickers.addEventListener("pointerdown", function (event) {
    var btn = event.target.closest(".stuck-face");
    if (!btn) return;
    beginDrag(btn.getAttribute("data-day"), true, btn, event);
  });
  document.addEventListener("pointerdown", function (event) {
    if (!decorateOpen || drag || !window.PhoneShell) return;
    if (event.target.closest && event.target.closest("#decorate, .deco-col, .stuck-face, button")) return;
    var dayId = window.PhoneShell.pickSticker(event.clientX, event.clientY);
    if (!dayId) return;
    beginDrag(dayId, true, null, event);
  }, true);
  document.addEventListener("pointermove", function (event) {
    if (!drag) return;
    moveGhost(event.clientX, event.clientY);
  });
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  window.addEventListener("phone-ready", function () { renderDecor(); });
  el.switchName.addEventListener("click", function () {
    picking = true;
    pickIndex = 0;
    CONFIG.players.forEach(function (p, i) {
      if (p.id === playerId) pickIndex = i;
    });
    render();
  });
  el.choices.addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-player]");
    if (!btn) return;
    setPlayer(btn.getAttribute("data-player"));
  });
  el.options.addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-option]");
    if (!btn || btn.disabled) return;
    onOption(btn.getAttribute("data-option"));
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") poll();
  });
  window.addEventListener("pageshow", function () { poll(); });
  window.addEventListener("focus", function () { poll(); });

  lang = detectLang();
  var storedPlayer = storageGet("monster.player");
  if (playerById(storedPlayer)) playerId = storedPlayer;
  else picking = true;
  if (!scriptUrl()) sheetError = true;

  showFallback();
  render();
  poll();
  setInterval(function () {
    if (document.visibilityState !== "visible") return;
    poll();
  }, 15000);
  setInterval(tick, 1000);
})();

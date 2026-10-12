(function () {
  var CONFIG = window.MONSTER_CONFIG;
  var COPY = {
    title: { en: "Auntie's Workout Tracker", zh: "阿姨的健身记录" },
    who: { en: "Who Are You?", zh: "你是哪一位？" },
    switchName: { en: "Switch Name", zh: "换一个人" },
    waiting: { en: "waiting...", zh: "等待" },
    you: { en: "You", zh: "你" },
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
    langGroup: { en: "Language", zh: "语言" },
    recap: { en: "Recap", zh: "回顾" },
    recapClose: { en: "Close", zh: "关闭" },
    recapEmpty: { en: "No monsters defeated this week.", zh: "这周没有击败怪物。" },
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
  var writeChain = Promise.resolve();
  var polling = false;
  var animGen = 0;
  var pendingAnims = 0;
  var animChain = Promise.resolve();
  var played = {};
  var visualPlayers = new Set();
  var visualOptions = new Map();
  var localAnimated = null;
  var optimistic = null;
  var monsterDay = "";
  var statusTimer = 0;
  var boundaryTimer = 0;
  var polledEnd = "";
  var recapGen = 0;
  var recapDayId = "";

  var el = {
    title: document.getElementById("title"),
    langGroup: document.getElementById("lang-group"),
    langEn: document.getElementById("lang-en"),
    langZh: document.getElementById("lang-zh"),
    pick: document.getElementById("screen-pick"),
    home: document.getElementById("screen-home"),
    who: document.getElementById("who"),
    choices: document.getElementById("who-choices"),
    name: document.getElementById("monster-name"),
    pips: document.getElementById("pips"),
    remain: document.getElementById("remain"),
    localEnd: document.getElementById("local-end"),
    bothEnd: document.getElementById("both-end"),
    people: document.getElementById("people"),
    hint: document.getElementById("hint"),
    options: document.getElementById("options"),
    switchName: document.getElementById("switch-name"),
    recap: document.getElementById("recap"),
    recapLayer: document.getElementById("recap-layer"),
    recapViewport: document.getElementById("recap-viewport"),
    recapClose: document.getElementById("recap-close"),
    recapStage: document.getElementById("recap-stage"),
    recapCaption: document.getElementById("recap-caption"),
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
    var seen = {};
    if (Array.isArray(raw.weekDefeated)) {
      raw.weekDefeated.forEach(function (id) {
        if (typeof id === "string" && id) weekDefeated.push(id);
      });
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
    drawMonster(next.dayId);
    settleAll();
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
      visualPlayers.add(c.playerId);
      visualOptions.set(c.playerId, c.option);
      settleAll();
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
    if (polling || writes > 0) return;
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
    if (left <= 0 && polledEnd !== state.endsAt && writes === 0) {
      polledEnd = state.endsAt;
      poll();
    }
  }

  function statusKey() {
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
    var waits = [slipUntil, savedUntil]
      .map(function (t) { return t - Date.now(); })
      .filter(function (ms) { return ms > 0; });
    if (!waits.length) return;
    var delay = Math.min.apply(null, waits) + 40;
    statusTimer = setTimeout(function () {
      renderStatus();
      armStatusTimer();
    }, delay);
  }

  function renderPips() {
    var n = visualPlayers.size;
    var html = "";
    for (var i = 0; i < 3; i++) {
      html += '<span class="pip' + (i < n ? " on" : "") + '"></span>';
    }
    el.pips.innerHTML = html;
  }

  function renderPeople() {
    var chosen = {};
    shownCheckins().forEach(function (c) { chosen[c.playerId] = c.option; });
    el.people.innerHTML = CONFIG.players.map(function (p) {
      var opt = chosen[p.id];
      var move = opt ? t(opt) : t("waiting");
      var you = p.id === playerId
        ? '<span class="you-badge">' + t("you") + "</span>"
        : "";
      return (
        '<li class="person' + (p.id === playerId ? " is-you" : "") + '">' +
        '<span class="who-name">' + playerName(p) + you + "</span>" +
        '<span class="move' + (opt ? " chosen" : "") + '">' + move + "</span>" +
        "</li>"
      );
    }).join("");
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
        (synced ? "" : " disabled") +
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

  function renderStatus() {
    el.name.textContent = t(statusKey());
  }

  function render() {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = t("title");
    el.title.textContent = t("title");
    el.langGroup.setAttribute("aria-label", t("langGroup"));
    el.langEn.setAttribute("aria-pressed", lang === "en" ? "true" : "false");
    el.langZh.setAttribute("aria-pressed", lang === "zh" ? "true" : "false");
    el.recap.textContent = t("recap");
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
    renderPeople();
    renderOptions();
    renderChoices();
    renderPips();
    renderStatus();
    var picking = !playerId;
    el.pick.hidden = !picking;
    el.home.hidden = picking;
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

  el.langEn.addEventListener("click", function () { setLang("en"); });
  el.langZh.addEventListener("click", function () { setLang("zh"); });
  el.recap.addEventListener("click", function () { startRecap(); });
  el.recapLayer.addEventListener("click", function () { stopRecap(); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !el.recapLayer.hidden) stopRecap();
  });
  el.switchName.addEventListener("click", function () {
    playerId = "";
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

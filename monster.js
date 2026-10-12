// The monster is drawn from day_id. Same id, same parts, on every phone.
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MonsterArt = api;
})(function () {
  var INK = "#3D2C29";
  var NAMES_EN = [
    "Momo", "Lulu", "Boba", "Kiki", "Nori", "Pepa", "Zuzu", "Mimi",
    "Taro", "Poko", "Fifi", "Dodo", "Koko", "Bibi", "Coco", "Pipi",
    "Roro", "Soso", "Wawa", "Nono", "Yoyo", "Gigi", "Hana", "Mochi",
  ];
  var NAMES_ZH = [
    "萌萌", "豆豆", "球球", "糯糯", "泡泡", "团团", "圆圆", "点点",
    "果果", "软软", "毛毛", "饼饼", "嘟嘟", "咕咕", "胖胖", "花花",
    "糖糖", "波波", "奶球", "小满", "丸子", "汤圆", "布丁", "麻薯",
  ];
  var BODIES = ["blob", "pear", "box", "bean"];
  var EYES = ["dot", "happy", "wide"];
  var PATTERNS = ["plain", "spots", "stripes", "belly"];

  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function traitsFor(dayId) {
    var rand = mulberry32(hashString(String(dayId)));
    var body = BODIES[Math.floor(rand() * BODIES.length)];
    var hue = Math.floor(rand() * 360);
    var eyes = EYES[Math.floor(rand() * EYES.length)];
    var earCount = Math.floor(rand() * 4);
    var pattern = PATTERNS[Math.floor(rand() * PATTERNS.length)];
    var nameIndex = Math.floor(rand() * NAMES_EN.length);
    var earKind = rand() < 0.5 ? "ear" : "horn";
    var spots = [];
    for (var i = 0; i < 5; i++) {
      spots.push({
        x: (rand() - 0.5) * 88,
        y: (rand() - 0.35) * 78,
        r: 7 + rand() * 8,
      });
    }
    return {
      body: body,
      hue: hue,
      eyes: eyes,
      earCount: earCount,
      earKind: earKind,
      pattern: pattern,
      spots: spots,
      nameEn: NAMES_EN[nameIndex],
      nameZh: NAMES_ZH[nameIndex],
    };
  }

  function colors(hue) {
    return {
      body: "hsl(" + hue + ", 70%, 64%)",
      deep: "hsl(" + hue + ", 55%, 46%)",
      belly: "hsl(" + hue + ", 78%, 86%)",
      ear: "hsl(" + hue + ", 62%, 52%)",
    };
  }

  function bodyGeom(type) {
    if (type === "blob") return '<ellipse cx="0" cy="4" rx="78" ry="70"/>';
    if (type === "box") return '<rect x="-66" y="-58" width="132" height="132" rx="36"/>';
    if (type === "pear") {
      return '<path d="M0-80C48-76 64-28 70 12C76 50 46 74 0 74C-46 74-76 50-70 12C-64-28-48-76 0-80Z"/>';
    }
    return '<path d="M-8-74C42-90 88-24 72 22C60 60 22 78-6 72C-48 64-82 28-74-10C-66-48-42-58-8-74Z"/>';
  }

  function earSpots(count) {
    if (count === 1) return [{ x: 0, y: -98, rot: 0 }];
    if (count === 2) {
      return [
        { x: -64, y: -72, rot: -22 },
        { x: 64, y: -72, rot: 22 },
      ];
    }
    if (count === 3) {
      return [
        { x: -72, y: -60, rot: -32 },
        { x: 0, y: -104, rot: 0 },
        { x: 72, y: -58, rot: 30 },
      ];
    }
    return [];
  }

  function earsMarkup(traits, palette) {
    return earSpots(traits.earCount)
      .map(function (spot) {
        var inner =
          traits.earKind === "horn"
            ? '<path d="M0-32 L16 12 Q0 2 -16 12 Z" fill="' +
              palette.ear +
              '" stroke="' +
              INK +
              '" stroke-width="5" stroke-linejoin="round"/>'
            : '<ellipse cx="0" cy="0" rx="18" ry="26" fill="' +
              palette.ear +
              '" stroke="' +
              INK +
              '" stroke-width="5"/>' +
              '<ellipse cx="0" cy="6" rx="8" ry="12" fill="' +
              palette.belly +
              '"/>';
        return (
          '<g transform="translate(' +
          spot.x +
          " " +
          spot.y +
          ") rotate(" +
          spot.rot +
          ')">' +
          inner +
          "</g>"
        );
      })
      .join("");
  }

  function faceMarkup(eyes) {
    var cheeks =
      '<ellipse cx="-44" cy="26" rx="12" ry="8" fill="#FF8A5B"/>' +
      '<ellipse cx="46" cy="28" rx="12" ry="8" fill="#FF8A5B"/>';
    var smile =
      '<path d="M-16 36 Q2 52 22 34" fill="none" stroke="' +
      INK +
      '" stroke-width="5" stroke-linecap="round"/>';
    var eye = "";
    if (eyes === "happy") {
      eye =
        '<path d="M-46 0 Q-28-20 -10 0" fill="none" stroke="' +
        INK +
        '" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M12 0 Q30-20 48 0" fill="none" stroke="' +
        INK +
        '" stroke-width="5" stroke-linecap="round"/>';
    } else if (eyes === "wide") {
      eye =
        '<ellipse cx="-28" cy="-4" rx="18" ry="16" fill="#fff" stroke="' +
        INK +
        '" stroke-width="4"/>' +
        '<ellipse cx="30" cy="-4" rx="18" ry="16" fill="#fff" stroke="' +
        INK +
        '" stroke-width="4"/>' +
        '<circle cx="-24" cy="-2" r="7" fill="' +
        INK +
        '"/>' +
        '<circle cx="34" cy="-2" r="7" fill="' +
        INK +
        '"/>' +
        '<circle cx="-21" cy="-5" r="2.4" fill="#fff"/>' +
        '<circle cx="37" cy="-5" r="2.4" fill="#fff"/>';
    } else {
      eye =
        '<circle cx="-28" cy="-6" r="15" fill="#fff" stroke="' +
        INK +
        '" stroke-width="4"/>' +
        '<circle cx="30" cy="-4" r="15" fill="#fff" stroke="' +
        INK +
        '" stroke-width="4"/>' +
        '<circle cx="-25" cy="-4" r="7" fill="' +
        INK +
        '"/>' +
        '<circle cx="33" cy="-2" r="7" fill="' +
        INK +
        '"/>' +
        '<circle cx="-22" cy="-7" r="2.5" fill="#fff"/>' +
        '<circle cx="36" cy="-5" r="2.5" fill="#fff"/>';
    }
    return '<g class="face">' + eye + cheeks + smile + "</g>";
  }

  function patternMarkup(traits, palette) {
    if (traits.pattern === "spots") {
      return traits.spots
        .map(function (s) {
          return (
            '<circle cx="' +
            s.x.toFixed(1) +
            '" cy="' +
            s.y.toFixed(1) +
            '" r="' +
            s.r.toFixed(1) +
            '" fill="' +
            palette.deep +
            '"/>'
          );
        })
        .join("");
    }
    if (traits.pattern === "stripes") {
      return (
        '<rect x="-100" y="-40" width="200" height="16" fill="' +
        palette.deep +
        '" opacity="0.55"/>' +
        '<rect x="-100" y="-8" width="200" height="16" fill="' +
        palette.deep +
        '" opacity="0.55"/>' +
        '<rect x="-100" y="24" width="200" height="16" fill="' +
        palette.deep +
        '" opacity="0.55"/>'
      );
    }
    if (traits.pattern === "belly") {
      return '<ellipse cx="0" cy="30" rx="40" ry="32" fill="' + palette.belly + '"/>';
    }
    return "";
  }

  function svgString(dayId, uid) {
    var traits = traitsFor(dayId);
    var palette = colors(traits.hue);
    var geom = bodyGeom(traits.body);
    var clip = uid + "-clip";
    var body =
      geom.replace("/>", ' fill="' + palette.body + '" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>');
    var puddleEyes =
      '<path d="M-36 50 Q-22 38 -8 50" fill="none" stroke="' +
      INK +
      '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M10 50 Q24 38 38 50" fill="none" stroke="' +
      INK +
      '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M-12 64 Q2 76 18 62" fill="none" stroke="' +
      INK +
      '" stroke-width="5" stroke-linecap="round"/>' +
      '<ellipse cx="-24" cy="60" rx="8" ry="5" fill="#FF8A5B"/>' +
      '<ellipse cx="26" cy="60" rx="8" ry="5" fill="#FF8A5B"/>';

    return (
      '<svg class="monster-svg" xmlns="http://www.w3.org/2000/svg" viewBox="-150 -158 300 328" role="img" aria-label="' +
      traits.nameEn +
      '">' +
      "<title>" +
      traits.nameEn +
      "</title>" +
      "<defs><clipPath id=\"" +
      clip +
      '">' +
      geom +
      "</clipPath></defs>" +
      '<ellipse class="shadow" cx="0" cy="86" rx="54" ry="11" fill="#3D2C29" opacity="0.16"/>' +
      '<g class="rig">' +
      '<g class="squash">' +
      '<g class="spin">' +
      earsMarkup(traits, palette) +
      body +
      '<g clip-path="url(#' +
      clip +
      ')">' +
      patternMarkup(traits, palette) +
      '<ellipse class="shimmer" cx="-24" cy="-24" rx="26" ry="14" fill="#fff" opacity="0" transform="rotate(-28 -24 -24)"/>' +
      "</g>" +
      faceMarkup(traits.eyes) +
      "</g></g></g>" +
      '<g class="fx fx-kick" opacity="0">' +
      '<path d="M-36 0C-38-22-6-28 16-16L40-6C52 0 50 18 34 20L-24 22C-44 20-46 8-36 0Z" fill="#FF8A5B" stroke="' +
      INK +
      '" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M-22 12H32" stroke="' +
      INK +
      '" stroke-width="4" stroke-linecap="round"/>' +
      "</g>" +
      '<g class="fx fx-punch" opacity="0">' +
      '<circle cx="-16" cy="-22" r="13" fill="#FFD3B6" stroke="' +
      INK +
      '" stroke-width="5"/>' +
      '<circle cx="2" cy="-28" r="14" fill="#FFD3B6" stroke="' +
      INK +
      '" stroke-width="5"/>' +
      '<circle cx="20" cy="-20" r="13" fill="#FFD3B6" stroke="' +
      INK +
      '" stroke-width="5"/>' +
      '<circle cx="0" cy="2" r="28" fill="#FFD3B6" stroke="' +
      INK +
      '" stroke-width="5"/>' +
      '<ellipse cx="30" cy="10" rx="12" ry="16" fill="#FFD3B6" stroke="' +
      INK +
      '" stroke-width="5"/>' +
      '<rect x="-14" y="22" width="28" height="16" rx="8" fill="#FFD3B6" stroke="' +
      INK +
      '" stroke-width="5"/>' +
      "</g>" +
      '<g class="fx fx-heat" opacity="0">' +
      '<rect x="-118" y="-22" width="58" height="40" rx="12" fill="' +
      INK +
      '"/>' +
      '<rect x="-68" y="-14" width="26" height="24" rx="7" fill="#FF8A5B" stroke="' +
      INK +
      '" stroke-width="4"/>' +
      '<path d="M-36-16 q16 16 0 32" fill="none" stroke="#FF8A5B" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M-18-22 q18 22 0 44" fill="none" stroke="#FFB088" stroke-width="5" stroke-linecap="round"/>' +
      "</g>" +
      '<g class="drips">' +
      '<ellipse class="drip" cx="-18" cy="48" rx="7" ry="9" fill="' +
      palette.body +
      '" stroke="' +
      INK +
      '" stroke-width="3" opacity="0"/>' +
      '<ellipse class="drip" cx="8" cy="48" rx="6" ry="8" fill="' +
      palette.body +
      '" stroke="' +
      INK +
      '" stroke-width="3" opacity="0"/>' +
      '<ellipse class="drip" cx="28" cy="48" rx="5" ry="7" fill="' +
      palette.deep +
      '" stroke="' +
      INK +
      '" stroke-width="3" opacity="0"/>' +
      "</g>" +
      '<g class="puddle" display="none">' +
      '<ellipse cx="0" cy="64" rx="96" ry="30" fill="' +
      palette.body +
      '" stroke="' +
      INK +
      '" stroke-width="5"/>' +
      '<ellipse cx="0" cy="70" rx="46" ry="14" fill="' +
      palette.belly +
      '"/>' +
      puddleEyes +
      "</g>" +
      "</svg>"
    );
  }

  var FEET = 74;

  function scaleFor(restCount) {
    var n = restCount || 0;
    return Math.max(0.72, 1 - n * 0.08);
  }

  function setPose(svg, pose) {
    var squash = svg.querySelector(".squash");
    var spin = svg.querySelector(".spin");
    var shadow = svg.querySelector(".shadow");
    if (!squash || !spin) return;
    var scaleY = pose.scaleY == null ? 1 : pose.scaleY;
    var x = pose.x || 0;
    var y = pose.y || 0;
    spin.setAttribute("transform", "rotate(" + (pose.rot || 0) + ")");
    squash.setAttribute(
      "transform",
      "translate(" + x + " " + (y + FEET) + ") scale(1 " + scaleY + ") translate(0 " + -FEET + ")"
    );
    if (shadow) {
      var spread = 54 + Math.max(0, 1 - scaleY) * 40 + Math.max(0, -y) * 0.08;
      shadow.setAttribute("rx", String(spread));
      var liftFade = Math.max(0.05, 0.16 + Math.min(0, y) / 500);
      shadow.setAttribute("opacity", String(liftFade));
    }
  }

  function settle(svg, opts) {
    opts = opts || {};
    var rig = svg.querySelector(".rig");
    var puddle = svg.querySelector(".puddle");
    svg.querySelectorAll(".fx").forEach(function (fx) {
      fx.setAttribute("opacity", "0");
    });
    svg.querySelectorAll(".drip").forEach(function (drip) {
      drip.setAttribute("opacity", "0");
    });
    var shimmer = svg.querySelector(".shimmer");
    if (shimmer) shimmer.setAttribute("opacity", "0");
    if (opts.defeated) {
      if (rig) rig.setAttribute("display", "none");
      if (puddle) {
        puddle.removeAttribute("display");
        puddle.setAttribute("opacity", "1");
        puddle.removeAttribute("transform");
      }
      var shadow = svg.querySelector(".shadow");
      if (shadow) shadow.setAttribute("opacity", "0");
      return;
    }
    if (rig) {
      rig.removeAttribute("display");
      rig.setAttribute("opacity", "1");
    }
    if (puddle) puddle.setAttribute("display", "none");
    setPose(svg, { scaleY: scaleFor(opts.restCount), x: 0, y: 0, rot: 0 });
  }

  function smooth(p) {
    return p * p * (3 - 2 * p);
  }

  function tween(ms, onFrame, alive) {
    return new Promise(function (resolve) {
      if (ms <= 0) {
        onFrame(1);
        resolve();
        return;
      }
      var start = performance.now();
      function frame(now) {
        if (alive && !alive()) {
          resolve();
          return;
        }
        var p = Math.min(1, (now - start) / ms);
        onFrame(p);
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function showFx(svg, kind) {
    svg.querySelectorAll(".fx").forEach(function (fx) {
      fx.setAttribute("opacity", "0");
    });
    var node = svg.querySelector(".fx-" + kind);
    if (node) node.setAttribute("opacity", "1");
    return node;
  }

  function play(svg, kind, opts) {
    opts = opts || {};
    var alive = opts.alive || function () { return true; };
    var reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}
    var duration = reduce ? 180 : 1000;
    var before = scaleFor(opts.restBefore || 0);
    var after = scaleFor(opts.restAfter == null ? opts.restBefore || 0 : opts.restAfter);
    var rig = svg.querySelector(".rig");
    var puddle = svg.querySelector(".puddle");
    if (rig) {
      rig.removeAttribute("display");
      rig.setAttribute("opacity", "1");
    }
    if (puddle) puddle.setAttribute("display", "none");

    var fx = showFx(svg, kind);
    var drips = Array.prototype.slice.call(svg.querySelectorAll(".drip"));
    var shimmer = svg.querySelector(".shimmer");

    return tween(duration, function (raw) {
      if (!alive()) return;
      var p = smooth(raw);
      if (kind === "kick") {
        var footX = -160 + 180 * p;
        var footY = 18 - Math.sin(p * Math.PI) * 42;
        if (fx) {
          fx.setAttribute(
            "transform",
            "translate(" + footX.toFixed(1) + " " + footY.toFixed(1) + ") rotate(" + (-35 + 55 * p).toFixed(1) + ")"
          );
          fx.setAttribute("opacity", String(Math.sin(raw * Math.PI)));
        }
        setPose(svg, { scaleY: before, rot: -360 * p, x: 0, y: 0 });
      } else if (kind === "punch") {
        var recoil = Math.sin(raw * Math.PI);
        var fistP = Math.min(1, raw / 0.62);
        var fistX = -180 + 150 * (1 - Math.pow(1 - fistP, 3));
        if (fx) {
          fx.setAttribute("transform", "translate(" + fistX.toFixed(1) + " -6) scale(" + (0.8 + 0.35 * Math.sin(fistP * Math.PI)) + ")");
          fx.setAttribute("opacity", String(Math.sin(Math.min(1, raw * 1.15) * Math.PI)));
        }
        setPose(svg, {
          scaleY: before,
          x: 42 * recoil,
          y: 0,
          rot: 10 * recoil,
        });
      } else if (kind === "slam") {
        var y;
        var scaleY;
        if (raw < 0.4) {
          var up = 1 - Math.pow(1 - raw / 0.4, 3);
          y = -86 * up;
          scaleY = before + 0.08 * up;
        } else if (raw < 0.68) {
          var down = (raw - 0.4) / 0.28;
          down = down * down;
          y = -86 + 98 * down;
          scaleY = before + 0.08 + (0.55 - (before + 0.08)) * down;
        } else {
          var back = (raw - 0.68) / 0.32;
          back = 1 - Math.pow(1 - back, 2);
          y = 12 * (1 - back);
          scaleY = 0.55 + (after - 0.55) * back;
        }
        setPose(svg, { scaleY: scaleY, x: 0, y: y, rot: 0 });
        if (fx) fx.setAttribute("opacity", "0");
      } else if (kind === "heat") {
        var wobble = Math.sin(raw * Math.PI * 6) * 4;
        var scaleYHeat = before + (after - before) * p;
        setPose(svg, { scaleY: scaleYHeat, x: wobble * 0.4, y: 0, rot: wobble });
        if (fx) fx.setAttribute("opacity", String(Math.sin(Math.min(1, raw * 1.05) * Math.PI)));
        if (shimmer) shimmer.setAttribute("opacity", String(0.15 + 0.45 * Math.abs(Math.sin(raw * Math.PI * 5))));
        drips.forEach(function (drip, index) {
          var u = Math.min(1, Math.max(0, (raw - index * 0.16) / 0.7));
          drip.setAttribute("cy", String(36 + u * 46));
          drip.setAttribute("opacity", String(Math.sin(u * Math.PI)));
        });
      }
    }, alive).then(function () {
      if (!alive()) return;
      svg.querySelectorAll(".fx").forEach(function (node) {
        node.setAttribute("opacity", "0");
      });
      drips.forEach(function (drip) {
        drip.setAttribute("opacity", "0");
      });
      if (shimmer) shimmer.setAttribute("opacity", "0");
      if (!opts.finishing) {
        setPose(svg, { scaleY: after, x: 0, y: 0, rot: 0 });
        return;
      }
      return melt(svg, { alive: alive, scaleY: after });
    });
  }

  function melt(svg, opts) {
    opts = opts || {};
    var alive = opts.alive || function () { return true; };
    var reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}
    var rig = svg.querySelector(".rig");
    var puddle = svg.querySelector(".puddle");
    var after = opts.scaleY == null ? 1 : opts.scaleY;
    return tween(reduce ? 120 : 380, function (raw) {
      if (!alive()) return;
      var p = smooth(raw);
      if (rig) rig.setAttribute("opacity", String(1 - p));
      if (puddle) {
        puddle.removeAttribute("display");
        puddle.setAttribute("opacity", String(p));
        var s = 0.45 + 0.55 * p;
        puddle.setAttribute("transform", "translate(0 64) scale(1 " + s + ") translate(0 -64)");
      }
      setPose(svg, { scaleY: after * (1 - p * 0.4), x: 0, y: 10 * p, rot: 0 });
    }, alive).then(function () {
      if (!alive()) return;
      if (rig) rig.setAttribute("display", "none");
      if (puddle) {
        puddle.removeAttribute("display");
        puddle.setAttribute("opacity", "1");
        puddle.removeAttribute("transform");
      }
      var shadow = svg.querySelector(".shadow");
      if (shadow) shadow.setAttribute("opacity", "0");
    });
  }

  return {
    traitsFor: traitsFor,
    svgString: svgString,
    play: play,
    melt: melt,
    settle: settle,
    namesEn: NAMES_EN,
    namesZh: NAMES_ZH,
  };
});

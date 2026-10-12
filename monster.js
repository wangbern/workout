// The monster is drawn from day_id. Same id, same pixels, on every phone.
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MonsterArt = api;
})(function () {
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
    rand(); // kept so ears and spots stay tied to the same day id
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
    };
  }

  var PX = 10;
  var FEET = 70;
  var OUTLINE = "#14180c";

  var MASKS = {
    blob: [
      [6, 9], [4, 11], [3, 12], [3, 12], [2, 13], [2, 13], [2, 13],
      [2, 13], [2, 13], [2, 13], [3, 12], [3, 12], [4, 11], [5, 10],
    ],
    pear: [
      [6, 9], [5, 10], [4, 11], [4, 11], [3, 12], [3, 12], [3, 12],
      [2, 13], [2, 13], [2, 13], [2, 13], [3, 12], [4, 11], [5, 10],
    ],
    box: [
      [4, 11], [3, 12], [2, 13], [2, 13], [2, 13], [2, 13], [2, 13],
      [2, 13], [2, 13], [2, 13], [2, 13], [3, 12], [4, 11],
    ],
    bean: [
      [5, 10], [4, 11], [3, 12], [3, 12], [2, 12], [2, 13], [2, 13],
      [3, 13], [3, 13], [4, 12], [4, 12], [5, 11], [5, 11], [6, 10],
    ],
  };

  function quantHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var hp = h / 60;
    var x = c * (1 - Math.abs((hp % 2) - 1));
    var r1 = 0;
    var g1 = 0;
    var b1 = 0;
    if (hp < 1) { r1 = c; g1 = x; }
    else if (hp < 2) { r1 = x; g1 = c; }
    else if (hp < 3) { g1 = c; b1 = x; }
    else if (hp < 4) { g1 = x; b1 = c; }
    else if (hp < 5) { r1 = x; b1 = c; }
    else { r1 = c; b1 = x; }
    var m = l - c / 2;
    function chan(v) {
      var n = Math.round((v + m) * 255);
      n = Math.max(0, Math.min(248, Math.round(n / 8) * 8));
      var hex = n.toString(16);
      return hex.length < 2 ? "0" + hex : hex;
    }
    return "#" + chan(r1) + chan(g1) + chan(b1);
  }

  function colors(hue) {
    var h = Math.round(hue / 15) * 15;
    return {
      body: quantHex(h, 78, 54),
      deep: quantHex(h, 72, 34),
      light: quantHex(h, 58, 76),
      belly: quantHex(h, 32, 84),
      ear: quantHex(h, 64, 42),
      earIn: quantHex((h + 24) % 360, 40, 80),
      cheek: "#e85868",
      white: "#f8f8f0",
      outline: OUTLINE,
    };
  }

  function cellKey(x, y) {
    return x + "," + y;
  }

  function buildSprite(traits) {
    var pal = colors(traits.hue);
    var mask = MASKS[traits.body] || MASKS.blob;
    var body = {};
    mask.forEach(function (span, y) {
      for (var x = span[0]; x <= span[1]; x++) body[cellKey(x, y)] = "body";
    });

    function spanAt(y) {
      var left = 99;
      var right = -1;
      for (var x = 0; x < 16; x++) {
        if (body[cellKey(x, y)] === "body") {
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
      if (right < 0) return null;
      return [left, right];
    }

    var top = spanAt(0);
    var band = null;
    var bandY = 0;
    var topBand = Math.max(0, Math.floor(mask.length * 0.22));
    for (var y = 0; y <= topBand; y++) {
      var sp = spanAt(y);
      if (!sp) continue;
      if (!band || sp[1] - sp[0] > band[1] - band[0]) {
        band = sp;
        bandY = y;
      }
    }

    var anchors = [];
    if ((traits.earCount === 1 || traits.earCount === 3) && top) {
      anchors.push([Math.round((top[0] + top[1]) / 2), 0]);
    }
    if (traits.earCount >= 2 && band) {
      anchors.push([band[0], bandY]);
      anchors.push([band[1], bandY]);
    }
    anchors.forEach(function (a) {
      var ax = a[0];
      var ay = a[1];
      if (traits.earKind === "horn") {
        body[cellKey(ax, ay - 4)] = "horn";
        body[cellKey(ax, ay - 3)] = "horn";
        body[cellKey(ax, ay - 2)] = "horn";
        body[cellKey(ax - 1, ay - 1)] = "horn";
        body[cellKey(ax, ay - 1)] = "horn";
        body[cellKey(ax + 1, ay - 1)] = "horn";
      } else {
        body[cellKey(ax, ay - 3)] = "ear";
        body[cellKey(ax - 1, ay - 2)] = "ear";
        body[cellKey(ax, ay - 2)] = "earIn";
        body[cellKey(ax + 1, ay - 2)] = "ear";
        body[cellKey(ax - 1, ay - 1)] = "ear";
        body[cellKey(ax, ay - 1)] = "earIn";
        body[cellKey(ax + 1, ay - 1)] = "ear";
      }
    });

    var roles = {};
    Object.keys(body).forEach(function (k) { roles[k] = body[k]; });
    Object.keys(body).forEach(function (k) {
      var parts = k.split(",");
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nk = cellKey(x + d[0], y + d[1]);
        if (!roles[nk]) roles[nk] = "outline";
      });
    });

    var bminX = 99;
    var bmaxX = -99;
    var bminY = 99;
    var bmaxY = -99;
    Object.keys(body).forEach(function (k) {
      if (body[k] !== "body") return;
      var parts = k.split(",");
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      if (x < bminX) bminX = x;
      if (x > bmaxX) bmaxX = x;
      if (y < bminY) bminY = y;
      if (y > bmaxY) bmaxY = y;
    });

    var faceY = Math.floor(mask.length * 0.36);
    while (faceY < mask.length - 5) {
      var faceSpan = spanAt(faceY);
      if (faceSpan && faceSpan[1] - faceSpan[0] >= 8) break;
      faceY += 1;
    }
    var faceSpanNow = spanAt(faceY) || [4, 11];
    var mid = Math.round((faceSpanNow[0] + faceSpanNow[1]) / 2);
    var leftEye = mid - 4;
    var rightEye = mid + 1;
    var face = {};

    function isBody(x, y) {
      return body[cellKey(x, y)] === "body";
    }

    var fill = {};
    Object.keys(roles).forEach(function (k) {
      var role = roles[k];
      var parts = k.split(",");
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      if (role === "outline") fill[k] = pal.outline;
      else if (role === "horn") fill[k] = pal.deep;
      else if (role === "ear") fill[k] = pal.ear;
      else if (role === "earIn") fill[k] = pal.earIn;
      else {
        var relX = (x - bminX) / Math.max(1, bmaxX - bminX);
        var relY = (y - bminY) / Math.max(1, bmaxY - bminY);
        var onLight = (roles[cellKey(x - 1, y)] === "outline" || roles[cellKey(x, y - 1)] === "outline") && relX < 0.5 && relY < 0.48;
        var onDark = (roles[cellKey(x + 1, y)] === "outline" || roles[cellKey(x, y + 1)] === "outline") && (relX > 0.52 || relY > 0.6);
        if (onDark || (relX > 0.7 && relY > 0.5)) fill[k] = pal.deep;
        else if (onLight) fill[k] = pal.light;
        else fill[k] = pal.body;
      }
    });

    if (traits.pattern === "belly") {
      var bcx = (bminX + bmaxX) / 2;
      var bcy = bminY + (bmaxY - bminY) * 0.64;
      var rx = Math.max(2, (bmaxX - bminX) * 0.26);
      var ry = Math.max(2, (bmaxY - bminY) * 0.22);
      Object.keys(body).forEach(function (k) {
        if (body[k] !== "body") return;
        var parts = k.split(",");
        var x = parseInt(parts[0], 10);
        var y = parseInt(parts[1], 10);
        var dx = (x - bcx) / rx;
        var dy = (y - bcy) / ry;
        if (dx * dx + dy * dy <= 1) fill[k] = dy < -0.35 ? pal.light : pal.belly;
      });
    } else if (traits.pattern === "stripes") {
      Object.keys(body).forEach(function (k) {
        if (body[k] !== "body" || fill[k] !== pal.body) return;
        var y = parseInt(k.split(",")[1], 10);
        if ((y - bminY) % 4 >= 2) fill[k] = pal.deep;
      });
    } else if (traits.pattern === "spots") {
      traits.spots.forEach(function (s) {
        var col = Math.round((s.x / 88 + 0.5) * (bmaxX - bminX - 3) + bminX + 1);
        var row = Math.round((s.y / 78 + 0.45) * (bmaxY - bminY - 3) + bminY + 1);
        for (var dy = 0; dy < 2; dy++) {
          for (var dx = 0; dx < 2; dx++) {
            var x = col + dx;
            var yy = row + dy;
            if (!isBody(x, yy)) continue;
            if (yy >= faceY && yy <= faceY + 5 && x >= leftEye - 1 && x <= rightEye + 3) continue;
            if (fill[cellKey(x, yy)] === pal.light) continue;
            fill[cellKey(x, yy)] = pal.deep;
          }
        }
      });
    }

    function paintEye(ox, oy, kind) {
      var rows = kind === "happy"
        ? ["#.#", ".#."]
        : kind === "dot"
          ? [".W.", "WPH", ".W."]
          : ["WWW", "WPH", "WWW"];
      rows.forEach(function (row, dy) {
        for (var dx = 0; dx < row.length; dx++) {
          var ch = row.charAt(dx);
          if (ch === ".") continue;
          var x = ox + dx;
          var yy = oy + dy;
          if (!isBody(x, yy)) continue;
          face[cellKey(x, yy)] = true;
          fill[cellKey(x, yy)] = ch === "W" || ch === "H" ? pal.white : pal.outline;
        }
      });
    }

    paintEye(leftEye, faceY, traits.eyes);
    paintEye(rightEye, faceY, traits.eyes);
    [[-1, 0], [1, 0], [0, 1]].forEach(function (p) {
      var x = mid + p[0];
      var yy = faceY + 4 + p[1];
      if (!isBody(x, yy) || face[cellKey(x, yy)]) return;
      face[cellKey(x, yy)] = true;
      fill[cellKey(x, yy)] = pal.outline;
    });
    [[leftEye - 1, faceY + 2], [rightEye + 3, faceY + 2]].forEach(function (p) {
      if (!isBody(p[0], p[1]) || face[cellKey(p[0], p[1])]) return;
      fill[cellKey(p[0], p[1])] = pal.cheek;
    });

    var shine = [];
    [[bminX + 2, bminY + 2], [bminX + 3, bminY + 2], [bminX + 2, bminY + 3]].forEach(function (p) {
      var k = cellKey(p[0], p[1]);
      if (body[k] !== "body" || face[k] || fill[k] === pal.deep) return;
      fill[k] = pal.light;
      shine.push(k);
    });

    return { fill: fill, shine: shine, pal: pal };
  }

  function spriteOrigin(fill) {
    var minX = 99;
    var maxX = -99;
    var maxY = -99;
    Object.keys(fill).forEach(function (k) {
      var parts = k.split(",");
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
    return {
      minX: minX,
      maxY: maxY,
      left: -((maxX - minX + 1) * PX) / 2,
    };
  }

  function cellRect(k, origin, color) {
    var parts = k.split(",");
    var x = parseInt(parts[0], 10);
    var y = parseInt(parts[1], 10);
    var px = origin.left + (x - origin.minX) * PX;
    var py = FEET - (origin.maxY - y + 1) * PX;
    return '<rect x="' + px + '" y="' + py + '" width="' + PX + '" height="' + PX + '" fill="' + color + '"/>';
  }

  function pxRect(x, y, fill) {
    return '<rect x="' + x + '" y="' + y + '" width="' + PX + '" height="' + PX + '" fill="' + fill + '"/>';
  }

  function spriteFromRows(rows, map, shiftX, shiftY) {
    var h = rows.length;
    var w = 0;
    rows.forEach(function (row) {
      if (row.length > w) w = row.length;
    });
    var ox = -Math.floor(w / 2) * PX + (shiftX || 0);
    var oy = -Math.floor(h / 2) * PX + (shiftY || 0);
    var out = [];
    rows.forEach(function (row, iy) {
      for (var ix = 0; ix < row.length; ix++) {
        var ch = row.charAt(ix);
        if (!map[ch]) continue;
        out.push(pxRect(ox + ix * PX, oy + iy * PX, map[ch]));
      }
    });
    return out.join("");
  }

  function ovalCells(cx, cy, rx, ry) {
    var pts = [];
    var x0 = Math.floor((cx - rx) / PX) - 1;
    var x1 = Math.ceil((cx + rx) / PX) + 1;
    var y0 = Math.floor((cy - ry) / PX) - 1;
    var y1 = Math.ceil((cy + ry) / PX) + 1;
    for (var yi = y0; yi <= y1; yi++) {
      for (var xi = x0; xi <= x1; xi++) {
        var px = xi * PX;
        var py = yi * PX;
        var dx = (px + PX / 2 - cx) / rx;
        var dy = (py + PX / 2 - cy) / ry;
        if (dx * dx + dy * dy <= 1) pts.push([px, py]);
      }
    }
    return pts;
  }

  function ovalMarkup(cx, cy, rx, ry, pal) {
    var inside = {};
    ovalCells(cx, cy, rx, ry).forEach(function (p) {
      inside[p[0] + "," + p[1]] = pal.body;
    });
    var edge = {};
    Object.keys(inside).forEach(function (k) {
      var parts = k.split(",");
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      [[PX, 0], [-PX, 0], [0, PX], [0, -PX]].forEach(function (d) {
        var nk = (x + d[0]) + "," + (y + d[1]);
        if (!inside[nk]) edge[nk] = pal.outline;
      });
    });
    [[-40, cy - 10], [-30, cy - 10], [20, cy - 10], [30, cy - 10], [-10, cy + 10], [0, cy + 10]].forEach(function (p) {
      var k = p[0] + "," + p[1];
      if (inside[k]) inside[k] = pal.outline;
    });
    [[-50, cy], [40, cy]].forEach(function (p) {
      var k = p[0] + "," + p[1];
      if (inside[k]) inside[k] = pal.cheek;
    });
    var rects = [];
    Object.keys(edge).forEach(function (k) {
      var parts = k.split(",");
      rects.push(pxRect(parseInt(parts[0], 10), parseInt(parts[1], 10), edge[k]));
    });
    Object.keys(inside).forEach(function (k) {
      var parts = k.split(",");
      rects.push(pxRect(parseInt(parts[0], 10), parseInt(parts[1], 10), inside[k]));
    });
    return rects.join("");
  }

  function svgString(dayId) {
    var traits = traitsFor(dayId);
    var sprite = buildSprite(traits);
    var origin = spriteOrigin(sprite.fill);
    var shine = {};
    sprite.shine.forEach(function (k) { shine[k] = true; });
    var bodyRects = [];
    var shineRects = [];
    Object.keys(sprite.fill).forEach(function (k) {
      bodyRects.push(cellRect(k, origin, sprite.fill[k]));
      if (shine[k]) shineRects.push(cellRect(k, origin, "#f8f8f0"));
    });
    var pal = sprite.pal;
    var ink = pal.outline;
    var boot = spriteFromRows([
      "  XXXX ",
      " XXOOX ",
      "XXOSSX ",
      "XXXXXXX",
      " XXXXX ",
      " XX  XX",
    ], { X: ink, O: "#f8c0a0", S: "#e08860" }, 0, 0);
    var fist = spriteFromRows([
      " XXXX  ",
      "XXOOXX ",
      "XOOSOX ",
      "XOOXOX ",
      "XOOSOX ",
      " XXXXX ",
    ], { X: ink, O: "#f8d0b8", S: "#e0a888" }, 0, 0);
    var flameMap = { X: ink, Y: "#f8e040", Z: "#f07820" };
    var flameRows = [" X ", "XYX", "XZX", " X "];
    var heat = spriteFromRows(flameRows, flameMap, -100, -8) + spriteFromRows(flameRows, flameMap, -60, 0);
    var shadow = ovalCells(0, 96, 50, 14).map(function (p) {
      return pxRect(p[0], p[1], "#1a220c");
    }).join("");
    var puddle = ovalMarkup(0, 60, 78, 26, pal);
    return (
      '<svg class="monster-svg" xmlns="http://www.w3.org/2000/svg" viewBox="-150 -158 300 328" shape-rendering="crispEdges" role="img" aria-label="Monster">' +
      '<g class="shadow" opacity="0.4">' +
      shadow +
      "</g>" +
      '<g class="rig"><g class="squash"><g class="spin">' +
      bodyRects.join("") +
      '<g class="shimmer" opacity="0">' +
      shineRects.join("") +
      "</g></g></g></g>" +
      '<g class="fx fx-kick" opacity="0">' +
      boot +
      "</g>" +
      '<g class="fx fx-punch" opacity="0">' +
      fist +
      "</g>" +
      '<g class="fx fx-heat" opacity="0">' +
      heat +
      "</g>" +
      '<g class="drips">' +
      '<rect class="drip" x="-20" y="24" width="' + PX + '" height="' + (PX * 2) + '" fill="' + pal.body + '" opacity="0"/>' +
      '<rect class="drip" x="10" y="24" width="' + PX + '" height="' + (PX * 2) + '" fill="' + pal.body + '" opacity="0"/>' +
      '<rect class="drip" x="30" y="24" width="' + PX + '" height="' + (PX * 2) + '" fill="' + pal.deep + '" opacity="0"/>' +
      "</g>" +
      '<g class="puddle" display="none">' +
      puddle +
      "</g>" +
      "</svg>"
    );
  }


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
      var sx = spread / 54;
      shadow.setAttribute(
        "transform",
        "translate(0 96) scale(" + sx.toFixed(3) + " 1) translate(0 -96)"
      );
      var liftFade = Math.max(0.06, 0.42 + Math.min(0, y) / 260);
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
          drip.setAttribute("y", String(24 + u * 50));
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
        puddle.setAttribute("transform", "translate(0 60) scale(1 " + s + ") translate(0 -60)");
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
  };
});

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
    var shadow = ovalCells(0, 96, 50, 14).map(function (p) {
      return pxRect(p[0], p[1], "#1a220c");
    }).join("");
    var puddle = ovalMarkup(0, 60, 78, 26, pal);
    return (
      '<svg class="monster-svg" xmlns="http://www.w3.org/2000/svg" viewBox="-150 -158 300 328" shape-rendering="crispEdges" role="img" aria-label="Monster" data-day="' +
      String(dayId).replace(/[^\w-]/g, "") + '">' +
      '<g class="shadow" opacity="0.4">' +
      shadow +
      "</g>" +
      '<g class="rig"><g class="squash"><g class="spin">' +
      bodyRects.join("") +
      '<g class="shimmer" opacity="0">' +
      shineRects.join("") +
      '</g><g class="fx fx-in"></g></g></g></g>' +
      '<g class="fx fx-out"></g>' +
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

  function stickerSvg(dayId) {
    var traits = traitsFor(dayId);
    var sprite = buildSprite(traits);
    var fill = {};
    Object.keys(sprite.fill).forEach(function (k) { fill[k] = sprite.fill[k]; });
    var border = {};
    Object.keys(fill).forEach(function (k) {
      if (fill[k] !== sprite.pal.outline) return;
      var parts = k.split(",");
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      var edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) {
        return !fill[cellKey(x + d[0], y + d[1])];
      });
      if (edge) border[k] = true;
    });
    Object.keys(border).forEach(function (k) { fill[k] = "#ffffff"; });
    var ring = {};
    Object.keys(fill).forEach(function (k) {
      var parts = k.split(",");
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nk = cellKey(x + d[0], y + d[1]);
        if (!fill[nk]) ring[nk] = "#ffffff";
      });
    });
    Object.keys(ring).forEach(function (k) { fill[k] = ring[k]; });
    var minX = 99;
    var maxX = -99;
    var minY = 99;
    var maxY = -99;
    Object.keys(fill).forEach(function (k) {
      var parts = k.split(",");
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    var rects = [];
    var glint = [];
    Object.keys(fill).forEach(function (k) {
      var parts = k.split(",");
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      var px = (x - minX) * PX;
      var py = (y - minY) * PX;
      rects.push('<rect x="' + px + '" y="' + py + '" width="' + PX + '" height="' + PX + '" fill="' + fill[k] + '"/>');
      if ((x + y) % 5 === 0 && fill[k] !== "#ffffff") {
        glint.push('<rect x="' + px + '" y="' + py + '" width="' + PX + '" height="' + PX + '" fill="#ffffff"/>');
      }
    });
    var w = (maxX - minX + 1) * PX;
    var h = (maxY - minY + 1) * PX;
    return (
      '<svg class="sticker-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h +
      '" width="' + w + '" height="' + h + '" shape-rendering="crispEdges" aria-hidden="true">' +
      rects.join("") +
      '<g opacity="0.42">' + glint.join("") + "</g>" +
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
    clearFx(svg);
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

  function clearFx(svg) {
    svg.querySelectorAll(".fx").forEach(function (fx) {
      fx.textContent = "";
    });
  }

  // Attack effects are drawn in the phone case color of whoever checked in.
  // Each row is light, mid, deep. Keep in step with SHELLS in phone.js.
  var TINTS = {
    teal: ["#3ecfc8", "#2aada6", "#1f8f8a"],
    pink: ["#f7c6d8", "#e8a9c2", "#d489a6"],
    hot: ["#ff4f93", "#e2367c", "#c2185b"],
    green: ["#b6e38a", "#8ec86a", "#6eaa4e"],
    purple: ["#d4c4f2", "#b89ae0", "#9a7ec8"],
    yellow: ["#ffe58a", "#f0cc62", "#d4b04a"],
    blue: ["#7ec4f2", "#5ea6d4", "#4f96c2"],
    orange: ["#ff9f0a", "#e07d12", "#c46a00"],
    grey: ["#d8d4ce", "#b7b4ae", "#8e8c88"],
  };
  var SPARK = "#f8f8f0";

  function tintFor(id) {
    var row = TINTS[id] || TINTS.blue;
    return { hi: row[0], mid: row[1], lo: row[2] };
  }

  function noise(x, y) {
    var n = Math.imul((x * 73856093) ^ (y * 19349663), 2654435761) >>> 0;
    return (n % 1000) / 1000;
  }

  // Effects are plotted in whole cells so they stay on the monster's pixel grid.
  function fxGrid() {
    var cells = {};
    var rank = {};
    return {
      put: function (x, y, color, level) {
        var k = Math.round(x) + "," + Math.round(y);
        level = level || 0;
        if (rank[k] != null && rank[k] > level) return;
        rank[k] = level;
        cells[k] = color;
      },
      markup: function () {
        return Object.keys(cells).map(function (k) {
          var parts = k.split(",");
          return pxRect(parseInt(parts[0], 10) * PX, parseInt(parts[1], 10) * PX, cells[k]);
        }).join("");
      },
    };
  }

  function star(g, x, y, size, tint) {
    g.put(x, y, SPARK, 9);
    for (var i = 1; i <= size; i++) {
      var color = i === size ? tint.hi : SPARK;
      g.put(x + i, y, color, 8);
      g.put(x - i, y, color, 8);
      g.put(x, y + i, color, 8);
      g.put(x, y - i, color, 8);
    }
  }

  var infoCache = {};

  // Body cells and the shine spot, in the same pixels svgString draws.
  function spriteInfo(dayId) {
    if (!dayId) return { cells: [], shine: null, bodyH: 150 };
    if (infoCache[dayId]) return infoCache[dayId];
    var traits = traitsFor(dayId);
    var sprite = buildSprite(traits);
    var origin = spriteOrigin(sprite.fill);
    function place(k) {
      var parts = k.split(",");
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      return {
        cx: x,
        cy: y,
        px: origin.left + (x - origin.minX) * PX,
        py: FEET - (origin.maxY - y + 1) * PX,
      };
    }
    var cells = [];
    Object.keys(sprite.fill).forEach(function (k) {
      if (sprite.fill[k] !== sprite.pal.outline) cells.push(place(k));
    });
    var shine = sprite.shine.length ? place(sprite.shine[0]) : null;
    if (!shine) {
      cells.forEach(function (c) {
        if (c.cy < 0) return;
        if (!shine || c.cy < shine.cy || (c.cy === shine.cy && c.cx < shine.cx)) shine = c;
      });
    }
    var mask = MASKS[traits.body] || MASKS.blob;
    var info = { cells: cells, shine: shine, bodyH: (mask.length + 2) * PX };
    infoCache[dayId] = info;
    return info;
  }

  // One crescent cut from a to b. The bright head sweeps first, then the tail eats it up.
  function slash(g, ax, ay, bx, by, u, bulge, tint) {
    if (u <= 0 || u >= 1) return;
    var head = 1 - Math.pow(1 - Math.min(1, u / 0.4), 3);
    var tail = u < 0.28 ? 0 : smooth((u - 0.28) / 0.72);
    var len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) || 1;
    var nx = -(by - ay) / len;
    var ny = (bx - ax) / len;
    for (var i = 0; i <= 56; i++) {
      var s = i / 56;
      if (s < tail || s > head) continue;
      var arc = Math.sin(s * Math.PI);
      var half = (0.3 + 1.5 * arc) * (1 - 0.6 * tail);
      var cx = ax + (bx - ax) * s + nx * bulge * arc;
      var cy = ay + (by - ay) * s + ny * bulge * arc;
      for (var w = -half; w <= half; w += 0.5) {
        var edge = Math.abs(w) / (half || 1);
        var color = edge < 0.34 ? SPARK : (w * bulge > 0 ? tint.hi : (edge > 0.8 ? tint.lo : tint.mid));
        g.put(cx + nx * w, cy + ny * w, color, edge < 0.34 ? 3 : 2 - edge);
      }
    }
    if (head < 1) {
      var tip = bulge * Math.sin(head * Math.PI);
      star(g, ax + (bx - ax) * head + nx * tip, ay + (by - ay) * head + ny * tip, 2, tint);
    }
  }

  var SLICE_SPARKS = [[-9, 5, 0.2], [8, -6, 0.26], [10, 6, 0.46], [-8, -6, 0.52], [0, -1, 0.58], [-11, 0, 0.64], [11, -1, 0.68]];

  function drawSlices(g, t, tint) {
    slash(g, -12, -11, 11, 9, (t - 0.04) / 0.5, 2.4, tint);
    slash(g, 12, -11, -11, 9, (t - 0.3) / 0.5, -2.4, tint);
    SLICE_SPARKS.forEach(function (s) {
      var u = (t - s[2]) / 0.22;
      if (u < 0 || u >= 1) return;
      star(g, s[0], s[1], u > 0.3 && u < 0.7 ? 2 : 1, tint);
    });
  }

  function drawBlast(g, t, tint) {
    if (t < 0.2) {
      // A shot streaks in from the left before it bursts.
      var v = t / 0.2;
      var hx = -16 + 15 * v * v;
      var trail = [SPARK, SPARK, tint.hi, tint.hi, tint.mid, tint.mid, tint.lo];
      trail.forEach(function (color, i) {
        g.put(hx - i, 0, color, 5);
        if (i < 3) {
          g.put(hx - i, -1, i ? tint.hi : SPARK, 4);
          g.put(hx - i, 1, i ? tint.hi : SPARK, 4);
        }
      });
      star(g, hx, 0, 1, tint);
      return;
    }
    var u = Math.min(1, (t - 0.2) / 0.7);
    if (u >= 1) return;
    var e = 1 - Math.pow(1 - u, 3);
    var R = 2 + 10 * e;
    var thick = 1.7 * (1 - u) + 0.45;
    var core = u < 0.45 ? 4.6 * (1 - u / 0.45) + (u < 0.12 ? 2 : 0) : 0;
    for (var y = -15; y <= 15; y++) {
      for (var x = -15; x <= 15; x++) {
        var d = Math.sqrt(x * x + y * y);
        if (d <= core) {
          g.put(x, y, d > core - 1.1 ? tint.hi : SPARK, 6);
          continue;
        }
        var off = Math.abs(d - R);
        if (off > thick) continue;
        if (u > 0.62 && ((x + y) & 1)) continue;
        if (u > 0.84 && (x & 1)) continue;
        var color = off < thick * 0.4 ? (u < 0.5 ? SPARK : tint.hi) : (d > R ? tint.lo : tint.mid);
        g.put(x, y, color, 3);
      }
    }
    if (u < 0.8) {
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4;
        var reach = (k % 2 ? 3 : 6) * (1 - u);
        for (var r = R * 0.55; r <= R + reach; r += 0.5) {
          g.put(Math.cos(a) * r, Math.sin(a) * r, r < R ? SPARK : tint.hi, 4);
        }
      }
    }
    for (var i = 0; i < 12; i++) {
      if (u > 0.7 + (i % 4) * 0.08) continue;
      var ang = i * 0.5236 + 0.3;
      var dist = 3 + (9 + (i * 7) % 5) * e;
      var sx = Math.cos(ang) * dist;
      var sy = Math.sin(ang) * dist + 4 * u * u;
      if (i % 4 === 0 && u < 0.55) star(g, sx, sy, 1, tint);
      else g.put(sx, sy, i % 3 === 0 ? SPARK : (i % 3 === 1 ? tint.hi : tint.mid), 5);
    }
  }

  var CRUSH = 0.42;

  // Where the block's underside is and how flat the monster is under it.
  function slamState(raw, before, after, bodyH) {
    var crushY = FEET - bodyH * CRUSH;
    var hover = Math.min(-100, FEET - bodyH * before - 30);
    var out = { yb: hover, scaleY: before, gone: 0, appear: Math.min(1, raw / 0.1) };
    if (raw < 0.12) return out;
    if (raw < 0.22) {
      out.yb = hover - 20 * smooth((raw - 0.12) / 0.1);
    } else if (raw < 0.38) {
      var q = (raw - 0.22) / 0.16;
      out.yb = hover - 20 + (crushY - hover + 20) * q * q;
      out.scaleY = Math.min(before, (FEET - out.yb) / bodyH);
    } else if (raw < 0.6) {
      out.yb = crushY;
      out.scaleY = CRUSH;
    } else {
      var r = (raw - 0.6) / 0.4;
      out.scaleY = after + (CRUSH - after) * Math.exp(-6 * r) * Math.cos(r * 10);
      out.yb = FEET - bodyH * out.scaleY - 30 * r;
      out.gone = Math.min(1, r / 0.6);
    }
    return out;
  }

  function drawBlock(g, t, st, tint) {
    var b = Math.round(st.yb / PX);
    var top = b - 8;
    if (st.gone < 1) {
      for (var y = top; y < b; y++) {
        for (var x = -7; x <= 7; x++) {
          var n = noise(x, y - b);
          if (n > st.appear || n < st.gone) continue;
          var rim = x === -7 || x === 7 || y === top || y === b - 1;
          var color = tint.mid;
          if (rim) color = OUTLINE;
          else if (y === top + 1 || x === -6) color = tint.hi;
          else if (y === b - 2 || x === 6) color = tint.lo;
          g.put(x, y, color, 4);
        }
      }
      if (st.appear >= 1 && st.gone < 0.4) star(g, 0, b - 4, 2, tint);
    }
    if (t >= 0.22 && t < 0.38) {
      [-5, 0, 5].forEach(function (x, i) {
        for (var k = 1; k <= 3 + (i % 2) * 2; k++) g.put(x, top - k, k < 3 ? tint.hi : tint.mid, 2);
      });
    }
    if (t >= 0.38 && t < 0.78) {
      var q = (t - 0.38) / 0.4;
      var e = 1 - Math.pow(1 - q, 2);
      [-1, 1].forEach(function (side) {
        if (q < 0.5) {
          for (var d = 0; d <= e * 9; d++) {
            if (d % 2 === 0) g.put(side * (9 + d), 6, d < 3 ? SPARK : tint.mid, 3);
          }
        }
        for (var i = 0; i < 5; i++) {
          if (q > 0.55 + i * 0.1) continue;
          var px = side * (8 + e * (3 + i * 1.6));
          var py = 5 - Math.sin(q * Math.PI) * (1 + (i % 3)) * 1.4;
          if (i % 2 && q < 0.5) star(g, px, py, 1, tint);
          else g.put(px, py, i % 2 ? tint.hi : SPARK, 5);
        }
      });
    }
  }

  // Lava wells up at the shine, then runs down the body and cools.
  function lavaMarkup(t, info, tint) {
    var shine = info.shine;
    if (!shine || t >= 1) return "";
    var front = Math.min(1, t / 0.7) * 19;
    var cool = t > 0.72 ? (t - 0.72) / 0.28 : 0;
    var flick = Math.floor(t * 30);
    var out = [];
    info.cells.forEach(function (c) {
      var dx = c.cx - shine.cx;
      var dy = c.cy - shine.cy;
      var run = 0.35 + 1.1 * noise(dx, 7);
      var arrive = Math.abs(dx) * 1.8 + (dy >= 0 ? dy * run : -dy * 2.6);
      var age = front - arrive;
      if (age < 0) return;
      if (cool && noise(c.cx, c.cy) < cool) return;
      var color;
      if (age < 0.9 && !cool) color = SPARK;
      else if (age < 2.6) color = tint.hi;
      else if (age < 5.5) color = (c.cx + c.cy + flick) % 3 === 0 ? tint.hi : tint.mid;
      else color = (c.cx * 3 + c.cy + flick) % 5 === 0 ? tint.mid : tint.lo;
      out.push(pxRect(c.px, c.py, color));
    });
    if (t < 0.24) {
      var size = t < 0.06 ? 1 : (t < 0.18 ? 2 + (flick % 2) : 1);
      out.push(pxRect(shine.px, shine.py, SPARK));
      for (var i = 1; i <= size; i++) {
        var glow = i === size ? tint.hi : SPARK;
        out.push(pxRect(shine.px + i * PX, shine.py, glow));
        out.push(pxRect(shine.px - i * PX, shine.py, glow));
        out.push(pxRect(shine.px, shine.py + i * PX, glow));
        out.push(pxRect(shine.px, shine.py - i * PX, glow));
      }
    }
    return out.join("");
  }

  function drawEmbers(g, t, tint) {
    for (var i = 0; i < 7; i++) {
      var u = (t - 0.16 - i * 0.08) / 0.36;
      if (u < 0 || u >= 1) continue;
      var x = ((i * 5) % 13) - 6 + Math.sin((u + i) * 5) * 0.8;
      var y = 2 - u * (9 + (i % 3) * 2);
      g.put(x, y, u < 0.4 ? SPARK : (u < 0.75 ? tint.hi : tint.mid), 3);
    }
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

    clearFx(svg);
    var fxOut = svg.querySelector(".fx-out");
    var fxIn = svg.querySelector(".fx-in");
    var tint = tintFor(opts.color);
    var info = spriteInfo(svg.getAttribute("data-day"));
    var drips = Array.prototype.slice.call(svg.querySelectorAll(".drip"));
    var dripFill = drips.map(function (drip) { return drip.getAttribute("fill"); });
    var shimmer = svg.querySelector(".shimmer");
    var lastStep = -1;

    return tween(duration, function (raw) {
      if (!alive()) return;
      var p = smooth(raw);
      // The effect redraws 30 times over the attack so it reads as pixel animation.
      var step = Math.floor(raw * 30);
      var g = step !== lastStep ? fxGrid() : null;
      lastStep = step;
      var t = step / 30;
      if (kind === "kick") {
        var cutA = raw < 0.16 ? 0 : Math.exp(-(raw - 0.16) * 9);
        var cutB = raw < 0.42 ? 0 : Math.exp(-(raw - 0.42) * 9);
        setPose(svg, {
          scaleY: before,
          rot: -14 * cutA + 14 * cutB,
          x: 12 * cutA - 12 * cutB,
          y: -8 * (cutA + cutB),
        });
        if (g) drawSlices(g, t, tint);
      } else if (kind === "punch") {
        var recoil = raw < 0.2 ? 0 : Math.sin(Math.PI * Math.sqrt((raw - 0.2) / 0.8));
        setPose(svg, {
          scaleY: before * (1 - 0.1 * recoil),
          x: 42 * recoil,
          y: 0,
          rot: 10 * recoil,
        });
        if (g) drawBlast(g, t, tint);
      } else if (kind === "slam") {
        setPose(svg, { scaleY: slamState(raw, before, after, info.bodyH).scaleY, x: 0, y: 0, rot: 0 });
        if (g) drawBlock(g, t, slamState(t, before, after, info.bodyH), tint);
      } else if (kind === "heat") {
        var wobble = Math.sin(raw * Math.PI * 6) * 4;
        var scaleYHeat = before + (after - before) * p;
        setPose(svg, { scaleY: scaleYHeat, x: wobble * 0.4, y: 0, rot: wobble });
        if (shimmer) {
          shimmer.setAttribute("opacity", raw < 0.24 ? String(0.4 + 0.6 * Math.abs(Math.sin(raw * Math.PI * 12))) : "0");
        }
        if (g) {
          drawEmbers(g, t, tint);
          if (fxIn) fxIn.innerHTML = lavaMarkup(t, info, tint);
        }
        drips.forEach(function (drip, index) {
          var u = Math.min(1, Math.max(0, (raw - 0.2 - index * 0.14) / 0.6));
          drip.setAttribute("fill", index === 1 ? tint.hi : tint.mid);
          drip.setAttribute("y", String(24 + Math.round(u * 5) * PX));
          drip.setAttribute("opacity", u > 0 && u < 1 ? "1" : "0");
        });
      }
      if (g && fxOut) fxOut.innerHTML = g.markup();
    }, alive).then(function () {
      if (!alive()) return;
      clearFx(svg);
      drips.forEach(function (drip, index) {
        drip.setAttribute("opacity", "0");
        drip.setAttribute("fill", dripFill[index]);
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
    stickerSvg: stickerSvg,
    play: play,
    melt: melt,
    settle: settle,
  };
});

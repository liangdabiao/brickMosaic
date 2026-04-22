// 说明书长图生成 - Canvas渲染

var _algo = require('./algorithm.js');

const SCALE = 4; // 1mm = 4px (手机屏幕适配)
const PAGE_W = 210 * SCALE;
const PAGE_H = 297 * SCALE;
const SECTION_SIZE = 16;

function mm(v) { return v * SCALE; }

function rgbHex(r, g, b) {
  return '#' + [r, g, b].map(function (x) {
    var s = Math.round(x).toString(16);
    return s.length == 1 ? '0' + s : s;
  }).join('');
}

function renderTitlePage(ctx, offsetY, finalMosaicIm, fullPartList, imageFilename) {
  var W = PAGE_W, H = PAGE_H;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, offsetY, W, H);

  if (!finalMosaicIm || !finalMosaicIm[0]) return;
  var realWidth = finalMosaicIm.length;
  var realHeight = finalMosaicIm[0].length;
  var width = Math.ceil(realWidth / SECTION_SIZE) * SECTION_SIZE;
  var height = Math.ceil(realHeight / SECTION_SIZE) * SECTION_SIZE;
  var numSectionsX = Math.ceil(width / SECTION_SIZE);
  var numSectionsY = Math.ceil(height / SECTION_SIZE);
  var numSections = numSectionsX * numSectionsY;

  // Mosaic preview (simplified - draw colored grid)
  var canvasW = Math.min(W * 0.6, (H - mm(100)) * width / height);
  var canvasH = Math.min(H - mm(100), W * 0.6 * height / width);
  var drawX = W * 0.25;
  var drawY = mm(50) + offsetY;
  var brickW = canvasW / realWidth;
  var brickH = canvasH / realHeight;

  for (var x = 0; x < realWidth; x++) {
    for (var y = 0; y < realHeight; y++) {
      var im = finalMosaicIm[x][y];
      if (im[4] == 3) continue; // skip ignored
      ctx.fillStyle = rgbHex(im[0], im[1], im[2]);
      ctx.fillRect(drawX + x * brickW, drawY + y * brickH, brickW + 0.5, brickH + 0.5);
    }
  }

  // Title
  ctx.fillStyle = '#000000';
  ctx.font = 'bold ' + mm(12) + 'px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Custom Brick Mosaic', mm(30), mm(25) + offsetY);

  ctx.font = mm(6) + 'px sans-serif';
  ctx.fillText('Source: ' + imageFilename, mm(30), mm(34) + offsetY);
  ctx.fillText('Resolution: ' + realWidth + ' x ' + realHeight + ' (' + numSectionsX + 'x' + numSectionsY + ')', mm(30), mm(40) + offsetY);

  // Section grid overlay
  ctx.strokeStyle = 'rgba(200,200,200,0.8)';
  ctx.lineWidth = mm(0.5);
  ctx.font = 'bold ' + mm(10) + 'px sans-serif';
  ctx.fillStyle = 'rgba(200,200,200,0.9)';
  for (var x = 0; x < numSectionsX; x++) {
    for (var y = 0; y < numSectionsY; y++) {
      var rx = drawX + x / numSectionsX * canvasW;
      var ry = drawY + y / numSectionsY * canvasH;
      var rw = canvasW / numSectionsX;
      var rh = canvasH / numSectionsY;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.fillText('' + (x + y * numSectionsX + 1), rx + rw * 0.3, ry + rh * 0.5);
    }
  }

  // Color legend
  var colorCounts = [];
  for (var x = 0; x < realWidth; x++) {
    for (var y = 0; y < realHeight; y++) {
      var ci = finalMosaicIm[x][y][3];
      colorCounts[ci] = (colorCounts[ci] || 0) + 1;
    }
  }
  var reassigned = [];
  var cnt = 0;
  for (var i = 0; i < colorCounts.length; i++) {
    if (colorCounts[i] !== undefined) { reassigned[cnt] = i; cnt++; }
  }

  var radius = W * 0.013;
  var fontSize = mm(4.5);
  if (reassigned.length < 23) { radius = W * 0.02; fontSize = mm(6); }

  ctx.fillStyle = 'rgb(40,40,40)';
  var legendX = W * 0.72;
  var legendY = mm(50) + offsetY;
  var legendH = reassigned.length * 2 * (radius + mm(2));
  ctx.fillRect(legendX, legendY, W * 0.24, legendH + mm(10));

  for (var i = 0; i < reassigned.length; i++) {
    var ci = reassigned[i];
    var r = fullPartList[ci] ? fullPartList[ci][0] : 0;
    var g = fullPartList[ci] ? fullPartList[ci][1] : 0;
    var b = fullPartList[ci] ? fullPartList[ci][2] : 0;
    var cx = legendX + radius * 1.5;
    var cy = legendY + mm(5) + i * 2 * (radius + mm(2)) + radius;

    ctx.fillStyle = rgbHex(r, g, b);
    if (fullPartList[ci] && fullPartList[ci][4] == 3024) {
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, radius - mm(0.2), 0, Math.PI * 2);
      ctx.fill();
    }

    if (fullPartList[ci] && (fullPartList[ci][4] == 6141 || fullPartList[ci][4] == 3024)) {
      var getContrastColor = _algo.getContrastColor;
      var cc = getContrastColor(r, g, b);
      ctx.strokeStyle = rgbHex(cc[0], cc[1], cc[2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, (radius * 0.7) - mm(0.2), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = (r + g + b > 380) ? '#000' : '#fff';
    ctx.font = 'bold ' + (fontSize * 0.8) + 'px sans-serif';
    ctx.textBaseline = 'middle';
    if (fullPartList[ci] && fullPartList[ci][4] == 3) {
      ctx.fillText('?', cx - fontSize * 0.3, cy + fontSize * 0.1);
    } else {
      var num = i + 1;
      ctx.fillText('' + num, cx - (num > 9 ? fontSize * 0.5 : fontSize * 0.3), cy + fontSize * 0.1);
    }

    ctx.fillStyle = '#fff';
    ctx.font = fontSize + 'px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(colorCounts[ci] + 'x', cx + 2.5 * radius, cy);
  }

  // Footer
  ctx.fillStyle = '#000';
  ctx.font = mm(4) + 'px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('github.com/liangdabiao', mm(30), H - mm(15) + offsetY);
  ctx.fillText('Page 1 / ' + (numSections + 1), W - mm(60), H - mm(15) + offsetY);
}

function renderSectionPage(ctx, offsetY, finalMosaicIm, fullPartList, sectionNumber) {
  var W = PAGE_W, H = PAGE_H;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, offsetY, W, H);

  if (!finalMosaicIm || !finalMosaicIm[0]) return;
  var width = finalMosaicIm.length;
  var height = finalMosaicIm[0].length;
  var numSectionsX = Math.ceil(width / SECTION_SIZE);
  var numSectionsY = Math.ceil(height / SECTION_SIZE);
  var xOffset = sectionNumber % numSectionsX * SECTION_SIZE;
  var yOffset = Math.floor(sectionNumber / numSectionsX) * SECTION_SIZE;

  // Reassign colors
  var colorCounts = [];
  for (var x = 0; x < width; x++) {
    for (var y = 0; y < height; y++) {
      var ci = finalMosaicIm[x][y][3];
      colorCounts[ci] = (colorCounts[ci] || 0) + 1;
    }
  }
  var reassigned = [];
  var cnt = 0;
  for (var i = 0; i < colorCounts.length; i++) {
    if (colorCounts[i] !== undefined) { reassigned[i] = cnt; cnt++; }
  }

  // Header
  ctx.fillStyle = '#000';
  ctx.font = 'bold ' + mm(12) + 'px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Section ' + (sectionNumber + 1), mm(30), mm(20) + offsetY);

  // Grid background
  var gridSize = Math.min(W * 0.85, H - mm(45));
  var startX = (W - gridSize) / 2;
  var startY = mm(35) + offsetY;
  var brickR = gridSize / SECTION_SIZE / 2;

  ctx.fillStyle = '#000';
  ctx.fillRect(startX - mm(2), startY - mm(2), gridSize + mm(4), gridSize + mm(4));

  var getContrastColor = _algo.getContrastColor;

  for (var x = 0; x < SECTION_SIZE; x++) {
    for (var y = 0; y < SECTION_SIZE; y++) {
      var gx = x + xOffset, gy = y + yOffset;
      if (gx < width && gy < height) {
        var im = finalMosaicIm[gx][gy];
        var r = im[0], g = im[1], b = im[2];
        var partIdx = im[3];
        var cx = startX + (x * 2 + 1) * brickR;
        var cy = startY + (y * 2 + 1) * brickR;

        ctx.fillStyle = rgbHex(r, g, b);
        if (fullPartList[partIdx] && fullPartList[partIdx][4] == 3024) {
          ctx.fillRect(cx - brickR + 1, cy - brickR + 1, brickR * 2 - 2, brickR * 2 - 2);
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, brickR - 1, 0, Math.PI * 2);
          ctx.fill();
        }

        if (fullPartList[partIdx] && (fullPartList[partIdx][4] == 6141 || fullPartList[partIdx][4] == 3024)) {
          var cc = getContrastColor(fullPartList[partIdx][0], fullPartList[partIdx][1], fullPartList[partIdx][2]);
          ctx.strokeStyle = rgbHex(cc[0], cc[1], cc[2]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, (brickR * 0.7) - 1, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.textBaseline = 'middle';
        if (fullPartList[partIdx] && fullPartList[partIdx][4] == 3) {
          ctx.fillStyle = (r + g + b > 380) ? '#000' : '#fff';
          ctx.font = 'bold ' + mm(5) + 'px sans-serif';
          ctx.fillText('?', cx - mm(1.5), cy + mm(1));
        } else {
          var colorNum = reassigned[partIdx] + 1;
          ctx.fillStyle = (r + g + b > 380) ? '#000' : '#fff';
          ctx.font = 'bold ' + mm(5) + 'px sans-serif';
          ctx.fillText('' + colorNum, cx - (colorNum > 9 ? mm(4) : mm(2)), cy + mm(1));
        }
      }
    }
  }

  // Footer
  ctx.fillStyle = '#999';
  ctx.font = mm(4) + 'px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('github.com/liangdabiao', mm(30), H - mm(12) + offsetY);
  ctx.fillText('Page ' + (sectionNumber + 2) + ' / ' + (numSectionsX * numSectionsY + 1), W - mm(60), H - mm(12) + offsetY);
}

module.exports = {
  renderTitlePage, renderSectionPage, SCALE, PAGE_W, PAGE_H, SECTION_SIZE
};

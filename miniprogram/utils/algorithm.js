// 核心马赛克生成算法 - 从网页版移植

var _legoSets = require('../data/lego-sets.js');

function rgb2hsv(r, g, b) {
  r = r / 255; g = g / 255; b = b / 255;
  let v = Math.max(r, g, b), n = v - Math.min(r, g, b);
  let h = n && (v == r ? (g - b) / n : v == g ? 2 + (b - r) / n : 4 + (r - g) / n);
  return [60 * (h < 0 ? h + 6 : h), v && n / v, v];
}

function hsv2rgb(h, s, v) {
  let f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

function adjustImageHSV(imgData, rawPixels, h, s, v, ignoreBlack) {
  for (var i = 0; i < imgData.length; i += 4) {
    if (ignoreBlack && rawPixels[i] == 0 && rawPixels[i + 1] == 0 && rawPixels[i + 2] == 0) {
    } else {
      var HSV = rgb2hsv(imgData[i], imgData[i + 1], imgData[i + 2]);
      var newH = (HSV[0] + Math.round(h)) % 360;
      var newS = Math.min(Math.max(HSV[1] + s, 0), 1);
      var newV = Math.min(Math.max(HSV[2] + v, 0), 1);
      var RGB = hsv2rgb(newH, newS, newV);
      imgData[i] = RGB[0]; imgData[i + 1] = RGB[1]; imgData[i + 2] = RGB[2];
    }
  }
  return imgData;
}

function adjustImageContrast(imgData, rawPixels, contrast, ignoreBlack) {
  contrast = (contrast / 100) + 1;
  var intercept = 128 * (1 - contrast);
  for (var i = 0; i < imgData.length; i += 4) {
    if (ignoreBlack && rawPixels[i] == 0 && rawPixels[i + 1] == 0 && rawPixels[i + 2] == 0) {
    } else {
      imgData[i] = imgData[i] * contrast + intercept;
      imgData[i + 1] = imgData[i + 1] * contrast + intercept;
      imgData[i + 2] = imgData[i + 2] * contrast + intercept;
    }
  }
  return imgData;
}

function constrain(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function adjustImageCurves(imgData, rawPixels, shadows, highlights, ignoreBlack) {
  var p1y = 64 + shadows * 0.64;
  var p2y = 192 + highlights * 0.64;
  p1y = constrain(p1y, 0, 255);
  p2y = constrain(p2y, 0, 255);
  var a = 0.5;
  var mt = new Array(16);
  for (var i = 0; i < 4; i++) mt[i] = Math.pow(i / 3, 3);
  for (var i = 4; i < 8; i++) mt[i] = (i - 4) / 3;
  for (var i = 8; i < 12; i++) mt[i] = Math.pow((i - 8) / 3, 2);
  for (var i = 12; i < 16; i++) mt[i] = Math.pow((i - 12) / 3, 3);
  var M = [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [mt[0], mt[1], mt[2], mt[3], mt[4], mt[5], mt[6], mt[7], mt[8], mt[9], mt[10], mt[11], mt[12], mt[13], mt[14], mt[15]],
  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]];
  var yv = [0, p1y, p2y, 255];
  var tmp = new Array(16);
  for (var j = 0; j < 4; j++) tmp[j] = yv[j];
  for (var i = 1; i < 4; i++) {
    for (var j = 0; j < 4; j++) tmp[i * 4 + j] = 0;
  }
  for (var j = 1; j < 4; j++) tmp[4 + j] = 1;
  for (var i = 2; i < 4; i++) {
    for (var j = 0; j < 4; j++) tmp[i * 4 + j] = 0;
  }
  tmp[8] = 1;
  var mt2 = new Array(16);
  for (var j = 0; j < 4; j++) mt2[j] = 0;
  for (var i = 1; i < 4; i++) {
    for (var j = 0; j < 4; j++) mt2[i * 4 + j] = 0;
  }
  for (var j = 0; j < 4; j++) mt2[4 + j] = yv[j];
  for (var i = 2; i < 4; i++) {
    for (var j = 0; j < 4; j++) mt2[i * 4 + j] = 0;
  }
  mt2[8] = 1;
  var mt3 = new Array(16);
  for (var j = 0; j < 4; j++) mt3[j] = 0;
  for (var i = 1; i < 4; i++) {
    for (var j = 0; j < 4; j++) mt3[i * 4 + j] = 0;
  }
  for (var j = 0; j < 4; j++) mt3[4 + j] = 0;
  for (var j = 0; j < 4; j++) mt3[8 + j] = yv[j];
  mt3[12] = 1;
  var c0 = tmp.map(function(v, i) { return a * mt[i] + (1 - a) * M[2][i]; });
  var c1 = tmp.map(function(v, i) { return a * mt[i] + (1 - a) * M[0][i]; });
  var c2 = tmp.map(function(v, i) { return a * mt2[i] + (1 - a) * M[1][i]; });
  var c3 = tmp.map(function(v, i) { return a * mt3[i] + (1 - a) * tmp[i]; });
  var lut = new Array(256);
  for (var i = 0; i < 256; i++) {
    var t = i / 255;
    var t2 = t * t; var t3 = t2 * t;
    lut[i] = Math.round(constrain(
      (c3[0] + c3[1] * t + c3[2] * t2 + c3[3] * t3) * (1 - a) * (1 - a) * (1 - a) +
      (c2[0] + c2[1] * t + c2[2] * t2 + c2[3] * t3) * 3 * a * (1 - a) * (1 - a) +
      (c1[0] + c1[1] * t + c1[2] * t2 + c1[3] * t3) * 3 * a * a * (1 - a) +
      (c0[0] + c0[1] * t + c0[2] * t2 + c0[3] * t3) * a * a * a,
      0, 255));
  }
  for (var i = 0; i < imgData.length; i += 4) {
    if (ignoreBlack && rawPixels[i] == 0 && rawPixels[i + 1] == 0 && rawPixels[i + 2] == 0) {
    } else {
      imgData[i] = lut[Math.round(imgData[i])];
      imgData[i + 1] = lut[Math.round(imgData[i + 1])];
      imgData[i + 2] = lut[Math.round(imgData[i + 2])];
    }
  }
  return imgData;
}

function getContrastColor(r, g, b) {
  var out = [0, 0, 0];
  if (r + g + b > 380) {
    out[0] = 255 - (255 - r) * 0.7;
    out[1] = 255 - (255 - g) * 0.7;
    out[2] = 255 - (255 - b) * 0.7;
  } else {
    out[0] = r * 0.7;
    out[1] = g * 0.7;
    out[2] = b * 0.7;
  }
  return out;
}

function createArray(length) {
  var arr = new Array(length || 0), i = length;
  if (arguments.length > 1) {
    var args = Array.prototype.slice.call(arguments, 1);
    while (i--) arr[length - 1 - i] = createArray.apply(this, args);
  }
  return arr;
}

function updatePartList(setCounts, ignoreBlack) {
  var totalCount = 0;
  var fullPartList = [];
  var setKeys = ['beatles', 'monroe', 'ironMan', 'sith', 'hogwarts', 'mickey', 'portrait', 'world', 'artProject', 'elvis', 'batman'];
  var { getPartListOfOneSet } = _legoSets;

  for (var i = 0; i < setKeys.length; i++) {
    var setKey = setKeys[i];
    var multiplier = Number(setCounts[setKey]);
    var partList = getPartListOfOneSet(setKey);
    for (var col = 0; col < partList.length; col++) {
      partList[col][3] = Math.floor(partList[col][3] * multiplier);
      totalCount += partList[col][3];
    }
    if (fullPartList.length == 0) {
      if (multiplier > 0) fullPartList = partList;
    } else {
      for (var col1 = 0; col1 < partList.length; col1++) {
        if (partList[col1][3] > 0) {
          var alreadyPresent = false;
          for (var col2 = 0; col2 < fullPartList.length; col2++) {
            if (fullPartList[col2][0] == partList[col1][0] && fullPartList[col2][1] == partList[col1][1] &&
              fullPartList[col2][2] == partList[col1][2] && fullPartList[col2][5] == partList[col1][5]) {
              alreadyPresent = true;
              fullPartList[col2][3] = fullPartList[col2][3] + partList[col1][3];
            }
          }
          if (!alreadyPresent) fullPartList.push(partList[col1]);
        }
      }
    }
  }

  if (ignoreBlack) {
    fullPartList.push([0, 0, 0, 1000000, 3, 0]);
  }
  return { totalCount: totalCount, fullPartList: fullPartList };
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function generateValidColoring(imageData, fullPartList, ignoreBlack, onProgress) {
  var width = imageData.width;
  var height = imageData.height;
  var pixels = imageData.data;

  // Get raw pixels for ignoreBlack check
  var rawPixels = pixels;

  var colorList = JSON.parse(JSON.stringify(fullPartList));
  var limitedParts = true;

  var distMat = createArray(width, height, colorList.length);
  var outIm = createArray(width, height, 5);
  var outCol = createArray(width, height);

  if (onProgress) onProgress(5, '计算颜色距离...');

  var allBlack = true;
  for (var x = 0; x < width; x++) {
    for (var y = 0; y < height; y++) {
      var index = (y * width + x) * 4;
      var red = pixels[index] + Math.random() * 3 - 1.5;
      var green = pixels[index + 1] + Math.random() * 3 - 1.5;
      var blue = pixels[index + 2] + Math.random() * 3 - 1.5;
      if (pixels[index] != 0 || pixels[index + 1] != 0 || pixels[index + 2] != 0) allBlack = false;
      if (ignoreBlack && rawPixels[index] == 0 && rawPixels[index + 1] == 0 && rawPixels[index + 2] == 0) {
        for (var col = 0; col < colorList.length - 1; col++) distMat[x][y][col] = 3 * 256 * 256;
        distMat[x][y][colorList.length - 1] = 0;
      } else {
        for (var col = 0; col < colorList.length; col++) {
          distMat[x][y][col] = Math.pow(red - colorList[col][0], 2) + Math.pow(green - colorList[col][1], 2) + Math.pow(blue - colorList[col][2], 2);
        }
        if (ignoreBlack) distMat[x][y][colorList.length - 1] = 3 * 256 * 256;
      }
    }
  }

  if (allBlack) return null;

  if (onProgress) onProgress(15, '初始分配...');

  var distMatOrig = JSON.parse(JSON.stringify(distMat));
  var pxCount = 0;
  var totalPixels = width * height;
  while (pxCount < totalPixels) {
    var bestDist = Infinity, bestX = -1, bestY = -1, bestCol = -1;
    for (var x = 0; x < width; x++) {
      for (var y = 0; y < height; y++) {
        if (outCol[x][y] === undefined) {
          for (var col = 0; col < colorList.length; col++) {
            if (distMat[x][y][col] < bestDist && ((colorList[col][3] > 0) || !limitedParts)) {
              bestDist = distMat[x][y][col]; bestX = x; bestY = y; bestCol = col;
            }
          }
        }
      }
    }

    outCol[bestX][bestY] = bestCol;
    for (var col = 0; col < colorList.length; col++) distMat[bestX][bestY][col] = Infinity;
    if (limitedParts) colorList[bestCol][3] = colorList[bestCol][3] - 1;
    pxCount++;

    if (pxCount % 200 == 0) {
      if (onProgress) onProgress(15 + 20 * pxCount / totalPixels, null);
      await sleep(0);
    }
  }

  if (limitedParts) {
    var keepRunning = true, count = 0;
    while (keepRunning && count < 100) {
      count++;
      if (onProgress) onProgress(35 + (Math.sqrt(count) / 10) * 65, '优化 - 第' + count + '轮');
      await sleep(0);
      keepRunning = false;
      for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
          var bestCols = [];
          for (var col = 0; col < colorList.length; col++) {
            if (distMatOrig[x][y][col] < distMatOrig[x][y][outCol[x][y]]) bestCols.push(col);
          }
          if (bestCols.length > 0) {
            var bestChoice = Infinity, bestSwapCol = -1, bestSwapX = -1, bestSwapY = -1;
            for (var ci = 0; ci < bestCols.length; ci++) {
              var loss = distMatOrig[x][y][outCol[x][y]] - distMatOrig[x][y][bestCols[ci]];
              for (var x2 = 0; x2 < width; x2++) {
                for (var y2 = 0; y2 < height; y2++) {
                  if (outCol[x2][y2] == bestCols[ci]) {
                    var gain = distMatOrig[x2][y2][outCol[x][y]] - distMatOrig[x2][y2][bestCols[ci]];
                    if (gain - loss < bestChoice) {
                      bestChoice = gain - loss; bestSwapCol = ci; bestSwapX = x2; bestSwapY = y2;
                    }
                  }
                }
              }
            }
            if (bestSwapCol >= 0) {
              var oldCol = outCol[x][y];
              outCol[x][y] = bestCols[bestSwapCol];
              outCol[bestSwapX][bestSwapY] = oldCol;
              colorList[bestCols[bestSwapCol]][3]--;
              colorList[oldCol][3]++;
              keepRunning = true;
            }
          }
        }
      }
    }
  }

  for (var x = 0; x < width; x++) {
    for (var y = 0; y < height; y++) {
      outIm[x][y][0] = colorList[outCol[x][y]][0];
      outIm[x][y][1] = colorList[outCol[x][y]][1];
      outIm[x][y][2] = colorList[outCol[x][y]][2];
      outIm[x][y][3] = outCol[x][y];
      outIm[x][y][4] = colorList[outCol[x][y]][4];
      outIm[x][y][5] = colorList[outCol[x][y]][5];
    }
  }

  return outIm;
}

module.exports = {
  rgb2hsv, hsv2rgb, adjustImageHSV, adjustImageContrast, adjustImageCurves,
  getContrastColor, createArray, updatePartList, sleep, generateValidColoring
};

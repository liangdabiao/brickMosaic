const app = getApp();
const { SETS } = require('../../data/lego-sets.js');
const algo = require('../../utils/algorithm.js');
const { renderTitlePage, renderSectionPage, PAGE_W, PAGE_H, SECTION_SIZE } = require('../../utils/instruction-gen.js');

Page({
  data: {
    hasImage: false,
    previewPath: '',
    cropMode: 'center',
    ignoreBlack: true,
    colorAdjust: { shadows: 0, highlights: 0, hue: 0, saturation: 0, value: 0, contrast: 0 },
    mosaicWidth: 48,
    mosaicHeight: 48,
    requiredParts: 2304,
    sets: SETS,
    setCounts: { beatles:0, monroe:0, ironMan:0, sith:0, hogwarts:0, mickey:0, portrait:0, world:0, artProject:0, elvis:0, batman:0 },
    availableParts: 0,
    partsWarning: false,
    canCalculate: false,
    canDownload: false,
    calculating: false,
    generating: false,
    calcProgress: 0,
    genProgress: 0,
    calcStatus: '',
    hasMosaic: false,
    canvasHeight: '',
    mosaicPreviewPath: ''
  },

  // Image source for processing (canvas or tempFilePath)
  _imageInfo: null,
  _finalMosaicIm: null,
  _fullPartList: [],
  _lastGeneratedPath: '',

  onLoad() {
    this.updateParts();
  },

  chooseImage() {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        var tempPath = res.tempFiles[0].tempFilePath;
        self.setData({
          hasImage: true,
          previewPath: tempPath,
          cropMode: 'center',
          colorAdjust: { shadows:0, highlights:0, hue:0, saturation:0, value:0, contrast:0 },
          hasMosaic: false,
          canDownload: false,
          canvasHeight: '',
          mosaicPreviewPath: ''
        });
        self._imageInfo = { type: 'path', path: tempPath };
        self.updateCalcButton();
      }
    });
  },

  setCropMode(e) {
    this.setData({ cropMode: e.currentTarget.dataset.mode, hasMosaic: false, canDownload: false });
  },

  openCrop() {
    var self = this;
    var ratio = this.data.mosaicWidth / this.data.mosaicHeight;
    wx.navigateTo({
      url: '/pages/crop/crop?imagePath=' + encodeURIComponent(this._imageInfo.path) + '&aspectRatio=' + ratio,
      events: {
        cropResult: function(data) {
          self.setData({
            cropMode: 'custom',
            previewPath: data.croppedPath,
            hasMosaic: false,
            canDownload: false
          });
          self._imageInfo = { type: 'path', path: data.croppedPath };
        }
      }
    });
  },

  toggleIgnoreBlack() {
    this.setData({ ignoreBlack: !this.data.ignoreBlack });
    this.updateParts();
  },

  onSliderChange(e) {
    var key = e.currentTarget.dataset.key;
    var val = Number(e.detail.value);
    var colorAdjust = this.data.colorAdjust;
    colorAdjust[key] = val;
    this.setData({ colorAdjust: colorAdjust, hasMosaic: false, canDownload: false });
  },

  resetColorAdjust() {
    this.setData({
      colorAdjust: { shadows:0, highlights:0, hue:0, saturation:0, value:0, contrast:0 },
      hasMosaic: false,
      canDownload: false
    });
  },

  changeSize(e) {
    var dim = e.currentTarget.dataset.dim;
    var delta = Number(e.currentTarget.dataset.delta);
    if (dim === 'width') {
      var val = Math.max(16, Math.min(200, this.data.mosaicWidth + delta));
      this.setData({ mosaicWidth: val });
    } else {
      var val = Math.max(16, Math.min(200, this.data.mosaicHeight + delta));
      this.setData({ mosaicHeight: val });
    }
    this.data.requiredParts = this.data.mosaicWidth * this.data.mosaicHeight;
    this.setData({ requiredParts: this.data.requiredParts, hasMosaic: false, canDownload: false });
    this.updateParts();
  },

  onSizeInput(e) {
    var dim = e.currentTarget.dataset.dim;
    var val = Math.max(16, Math.min(200, Number(e.detail.value) || 16));
    if (dim === 'width') this.setData({ mosaicWidth: val });
    else this.setData({ mosaicHeight: val });
    this.data.requiredParts = this.data.mosaicWidth * this.data.mosaicHeight;
    this.setData({ requiredParts: this.data.requiredParts, hasMosaic: false, canDownload: false });
    this.updateParts();
  },

  changeSetCount(e) {
    var key = e.currentTarget.dataset.key;
    var delta = Number(e.currentTarget.dataset.delta);
    var counts = this.data.setCounts;
    counts[key] = Math.max(0, Number((counts[key] + delta).toFixed(1)));
    this.setData({ setCounts: counts });
    this.updateParts();
  },

  onSetInput(e) {
    var key = e.currentTarget.dataset.key;
    var counts = this.data.setCounts;
    counts[key] = Math.max(0, Number(e.detail.value) || 0);
    this.setData({ setCounts: counts });
    this.updateParts();
  },

  updateParts() {
    var result = algo.updatePartList(this.data.setCounts, this.data.ignoreBlack);
    this.data.availableParts = result.totalCount;
    this.data._fullPartList = result.fullPartList;
    var warning = result.totalCount < this.data.requiredParts;
    this.setData({
      availableParts: result.totalCount,
      partsWarning: warning
    });
    this.updateCalcButton();
  },

  updateCalcButton() {
    var canCalc = this.data.hasImage && this.data.availableParts >= this.data.requiredParts && this.data.availableParts > 0;
    this.setData({ canCalculate: canCalc });
  },

  async startCalculate() {
    if (!this.data.canCalculate || this.data.calculating) return;
    this.setData({ calculating: true, calcProgress: 0, calcStatus: '准备中...', hasMosaic: false, canDownload: false });

    var self = this;
    console.log('[calc] start, imageInfo:', JSON.stringify(self._imageInfo));
    try {
      // Get processed image data
      var imageData = await this.getProcessedImageData();
      if (!imageData) {
        this.setData({ calculating: false, calcStatus: '图片处理失败' });
        return;
      }

      self.setData({ calcStatus: '生成马赛克...', calcProgress: 5 });
      await algo.sleep(50);

      var mosaicIm = await algo.generateValidColoring(imageData, this.data._fullPartList, this.data.ignoreBlack, function(pct, msg) {
        self.setData({ calcProgress: pct, calcStatus: msg || '' });
      });

      if (!mosaicIm) {
        this.setData({ calculating: false, calcStatus: '图片解码失败，请重新选择' });
        return;
      }

      this._finalMosaicIm = mosaicIm;
      this.setData({ calcProgress: 100, calcStatus: '渲染预览...' });
      await this.drawMosaic(mosaicIm);

      this.setData({
        calculating: false,
        calcStatus: '',
        hasMosaic: true,
        canDownload: true,
        calcProgress: 0
      });
    } catch (err) {
      console.error(err);
      this.setData({ calculating: false, calcStatus: '计算出错: ' + err.message });
    }
  },

  async getProcessedImageData() {
    var self = this;

    // Use page canvas to load image (much more reliable than offscreen canvas)
    var canvasNode = await new Promise(function(resolve, reject) {
      wx.createSelectorQuery()
        .select('#mosaicCanvas')
        .fields({ node: true, size: true })
        .exec(function(res) {
          if (res[0] && res[0].node) resolve(res[0].node);
          else reject(new Error('canvas not found'));
        });
    });
    var ctx = canvasNode.getContext('2d');

    // Get image info
    var info = await new Promise(function(resolve) {
      wx.getImageInfo({
        src: self._imageInfo.path,
        success: resolve,
        fail: function() { resolve(null); }
      });
    });
    if (!info) {
      console.error('[calc] getImageInfo failed for', self._imageInfo.path);
      return null;
    }

    // Load image on PAGE canvas (not offscreen - this is the key fix)
    var img = canvasNode.createImage();
    return new Promise(function(resolve) {
      img.onload = function() {
        console.log('[calc] image loaded, size:', info.width, 'x', info.height);

        var mw = self.data.mosaicWidth, mh = self.data.mosaicHeight;
        var tmpW = 200, tmpH = Math.round(200 * mh / mw);
        tmpH = Math.max(1, tmpH);

        // Set canvas to processing size (NO dpr - we need pixel-accurate getImageData)
        canvasNode.width = tmpW;
        canvasNode.height = tmpH;

        // Draw image with crop mode
        var srcX = 0, srcY = 0, srcW = info.width, srcH = info.height;
        if (self.data.cropMode === 'center') {
          if (info.width / info.height > mw / mh) {
            srcW = info.height * mw / mh;
            srcX = (info.width - srcW) / 2;
          } else {
            srcH = info.width * mh / mw;
            srcY = (info.height - srcH) / 2;
          }
        }
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, tmpW, tmpH);
        var pixels = ctx.getImageData(0, 0, tmpW, tmpH);
        var rawPixels = new Uint8ClampedArray(pixels.data);
        console.log('[calc] pixels read, size:', tmpW, 'x', tmpH);

        // Apply color adjustments
        var adj = self.data.colorAdjust;
        var data = pixels.data;
        if (adj.hue != 0 || adj.saturation != 0 || adj.value != 0) {
          algo.adjustImageHSV(data, rawPixels, adj.hue, adj.saturation / 100, adj.value / 100, self.data.ignoreBlack);
        }
        if (adj.contrast != 0) {
          algo.adjustImageContrast(data, rawPixels, adj.contrast, self.data.ignoreBlack);
        }
        if (adj.shadows != 0 || adj.highlights != 0) {
          algo.adjustImageCurves(data, rawPixels, adj.shadows, adj.highlights, self.data.ignoreBlack);
        }
        pixels.data.set(data);

        // Step 4: resize to actual mosaic dimensions for the algorithm
        // Use offscreen canvas at 1:1 pixel ratio (no dpr) for correct pixel reading
        var mosaicW = self.data.mosaicWidth;
        var mosaicH = self.data.mosaicHeight;

        var tempCanvas = wx.createOffscreenCanvas({ type: '2d', width: tmpW, height: tmpH });
        var tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(pixels, 0, 0);

        var mosaicCanvas = wx.createOffscreenCanvas({ type: '2d', width: mosaicW, height: mosaicH });
        var mosaicCtx = mosaicCanvas.getContext('2d');
        mosaicCtx.drawImage(tempCanvas, 0, 0, tmpW, tmpH, 0, 0, mosaicW, mosaicH);

        var mosaicPixels = mosaicCtx.getImageData(0, 0, mosaicW, mosaicH);
        console.log('[calc] mosaic pixels ready:', mosaicW, 'x', mosaicH);

        resolve(mosaicPixels);
      };

      img.onerror = function(err) {
        console.error('[calc] image load failed:', err);
        resolve(null);
      };

      img.src = self._imageInfo.path;
    });
  },

  async drawMosaic(im) {
    var self = this;
    var width = im.length, height = im[0].length;
    var renderW = 800, renderH = Math.round(800 * height / width);

    // Render on offscreen canvas to avoid all display sizing issues
    var offscreen = wx.createOffscreenCanvas({ type: '2d', width: renderW, height: renderH });
    var ctx = offscreen.getContext('2d');

    ctx.fillStyle = '#eee';
    ctx.fillRect(0, 0, renderW, renderH);

    var brickW = renderW / width, brickH = renderH / height;
    for (var x = 0; x < width; x++) {
      for (var y = 0; y < height; y++) {
        var m = im[x][y];
        if (m[4] == 3) continue;
        ctx.fillStyle = 'rgb(' + m[0] + ',' + m[1] + ',' + m[2] + ')';
        ctx.fillRect(x * brickW, y * brickH, brickW + 0.5, brickH + 0.5);
      }
    }

    // Export to temp image and display via <image> tag
    return new Promise(function(resolve) {
      wx.canvasToTempFilePath({
        canvas: offscreen,
        fileType: 'png',
        success: function(res) {
          self.setData({ mosaicPreviewPath: res.tempFilePath });
          console.log('[mosaic] preview image exported:', res.tempFilePath);
          resolve();
        },
        fail: function(err) {
          console.error('[mosaic] preview export failed:', err);
          resolve();
        }
      });
    });
  },

  async generateImage() {
    if (!this.data.canDownload || this.data.generating) return;
    var self = this;
    this.setData({ generating: true, genProgress: 0 });

    try {
      var mosaicIm = this._finalMosaicIm;
      if (!mosaicIm) return;

      var numSectionsX = Math.ceil(mosaicIm.length / SECTION_SIZE);
      var numSectionsY = Math.ceil(mosaicIm[0].length / SECTION_SIZE);
      var numSections = numSectionsX * numSectionsY;
      var totalPages = numSections + 1;

      // Use offscreen canvas
      var totalHeight = PAGE_H * totalPages;
      var offscreen = wx.createOffscreenCanvas({ type: '2d', width: PAGE_W, height: totalHeight });
      var ctx = offscreen.getContext('2d');

      renderTitlePage(ctx, 0, mosaicIm, this.data._fullPartList, 'mosaic');
      self.setData({ genProgress: Math.round(1 / totalPages * 100) });
      await algo.sleep(50);

      for (var i = 0; i < numSections; i++) {
        renderSectionPage(ctx, PAGE_H * (i + 1), mosaicIm, this.data._fullPartList, i);
        self.setData({ genProgress: Math.round((i + 2) / totalPages * 100) });
        await algo.sleep(30);
      }

      // Export
      wx.canvasToTempFilePath({
        canvas: offscreen,
        fileType: 'png',
        quality: 1,
        success(res) {
          self._lastGeneratedPath = res.tempFilePath;
          self.setData({ generating: false, genProgress: 0 });
          wx.previewImage({
            current: res.tempFilePath,
            urls: [res.tempFilePath],
            fail() {
              wx.showToast({ title: '长图已生成', icon: 'none' });
            }
          });
          // Save to gallery history
          self.saveHistory(res.tempFilePath);
        },
        fail(err) {
          console.error(err);
          self.setData({ generating: false, genProgress: 0 });
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      });
    } catch (err) {
      console.error(err);
      this.setData({ generating: false, genProgress: 0 });
      wx.showToast({ title: '生成出错', icon: 'none' });
    }
  },

  saveToAlbum() {
    if (!this._lastGeneratedPath) {
      wx.showToast({ title: '请先生成长图', icon: 'none' });
      return;
    }
    var self = this;
    wx.saveImageToPhotosAlbum({
      filePath: this._lastGeneratedPath,
      success() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
      fail(err) {
        if (err.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: '需要授权',
            content: '请允许访问相册以保存图片',
            success(res) {
              if (res.confirm) wx.openSetting();
            }
          });
        }
      }
    });
  },

  saveHistory(filePath) {
    var history = wx.getStorageSync('mosaic_history') || [];
    history.unshift({
      path: filePath,
      width: this.data.mosaicWidth,
      height: this.data.mosaicHeight,
      date: new Date().toLocaleString(),
      thumbnail: this.data.previewPath
    });
    if (history.length > 20) history = history.slice(0, 20);
    wx.setStorageSync('mosaic_history', history);
  }
});

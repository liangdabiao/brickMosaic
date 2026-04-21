Page({
  data: {},
  _imagePath: '',
  _aspectRatio: 1,
  _img: null,
  _imgW: 0,
  _imgH: 0,
  _canvasW: 0,
  _canvasH: 0,
  // Image transform (pan + zoom)
  _imgX: 0,
  _imgY: 0,
  _imgScale: 1,
  // Crop box
  _cropX: 0,
  _cropY: 0,
  _cropW: 0,
  _cropH: 0,
  // Touch state
  _touchType: 'none', // 'none', 'moveCrop', 'moveImage', 'pinch'
  _lastTouchX: 0,
  _lastTouchY: 0,
  _lastPinchDist: 0,
  _ctx: null,
  _canvas: null,
  _needsRedraw: false,

  onLoad(options) {
    this._imagePath = decodeURIComponent(options.imagePath);
    this._aspectRatio = Number(options.aspectRatio) || 1;
    var self = this;
    wx.getSystemInfo({
      success(res) {
        self._canvasW = res.windowWidth;
        self._canvasH = res.windowHeight - 120; // footer height
        self.initCanvas();
      }
    });
  },

  initCanvas() {
    var self = this;
    wx.createSelectorQuery()
      .select('#cropCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res[0] || !res[0].node) return;
        var canvas = res[0].node;
        var dpr = wx.getSystemInfoSync().pixelRatio || 2;
        canvas.width = self._canvasW * dpr;
        canvas.height = self._canvasH * dpr;
        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        self._canvas = canvas;
        self._ctx = ctx;

        // Load image
        var img = canvas.createImage();
        img.src = self._imagePath;
        img.onload = function() {
          self._img = img;
          self._imgW = img.width;
          self._imgH = img.height;
          self.initCropBox();
          self.redraw();
        };
      });
  },

  initCropBox() {
    // Calculate initial crop box centered, max size fitting screen
    var maxW = this._canvasW * 0.85;
    var maxH = this._canvasH * 0.85;
    var ratio = this._aspectRatio;

    if (maxW / maxH > ratio) {
      this._cropH = maxH;
      this._cropW = maxH * ratio;
    } else {
      this._cropW = maxW;
      this._cropH = maxW / ratio;
    }
    this._cropX = (this._canvasW - this._cropW) / 2;
    this._cropY = (this._canvasH - this._cropH) / 2;

    // Fit image to fill crop box
    var scaleX = this._cropW / this._imgW;
    var scaleY = this._cropH / this._imgH;
    this._imgScale = Math.max(scaleX, scaleY);
    this._imgX = this._cropX + (this._cropW - this._imgW * this._imgScale) / 2;
    this._imgY = this._cropY + (this._cropH - this._imgH * this._imgScale) / 2;
  },

  redraw() {
    if (!this._ctx || !this._img) return;
    var ctx = this._ctx;
    var W = this._canvasW, H = this._canvasH;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Draw image
    ctx.drawImage(this._img, this._imgX, this._imgY, this._imgW * this._imgScale, this._imgH * this._imgScale);

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);

    // Clear crop area (show image through)
    ctx.save();
    ctx.beginPath();
    ctx.rect(this._cropX, this._cropY, this._cropW, this._cropH);
    ctx.clip();
    ctx.drawImage(this._img, this._imgX, this._imgY, this._imgW * this._imgScale, this._imgH * this._imgScale);
    ctx.restore();

    // Grid lines (rule of thirds)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    for (var i = 1; i < 3; i++) {
      var gx = this._cropX + this._cropW * i / 3;
      var gy = this._cropY + this._cropH * i / 3;
      ctx.beginPath(); ctx.moveTo(gx, this._cropY); ctx.lineTo(gx, this._cropY + this._cropH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this._cropX, gy); ctx.lineTo(this._cropX + this._cropW, gy); ctx.stroke();
    }

    // Crop box border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(this._cropX, this._cropY, this._cropW, this._cropH);

    // Corner handles
    var handleLen = 20;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#007BFF';
    var corners = [
      [this._cropX, this._cropY],
      [this._cropX + this._cropW, this._cropY],
      [this._cropX, this._cropY + this._cropH],
      [this._cropX + this._cropW, this._cropY + this._cropH]
    ];
    for (var i = 0; i < corners.length; i++) {
      var cx = corners[i][0], cy = corners[i][1];
      var dx = (i % 2 == 0) ? 1 : -1;
      var dy = (i < 2) ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + handleLen * dx, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + handleLen * dy); ctx.stroke();
    }

    // Aspect ratio label
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    var labelW = 120, labelH = 32;
    var labelX = this._cropX + (this._cropW - labelW) / 2;
    var labelY = this._cropY + this._cropH - 40;
    ctx.fillRect(labelX, labelY, labelW, labelH);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var w = Math.round(this._aspectRatio * 100) / 100;
    ctx.fillText('比例 ' + w.toFixed(2), labelX + labelW / 2, labelY + labelH / 2);
    ctx.textAlign = 'start';
  },

  onTouchStart(e) {
    if (e.touches.length == 2) {
      this._touchType = 'pinch';
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      this._lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      return;
    }

    var tx = e.touches[0].clientX, ty = e.touches[0].clientY;
    // Check if touching inside crop box
    if (tx >= this._cropX && tx <= this._cropX + this._cropW &&
        ty >= this._cropY && ty <= this._cropY + this._cropH) {
      this._touchType = 'moveCrop';
    } else {
      this._touchType = 'moveImage';
    }
    this._lastTouchX = tx;
    this._lastTouchY = ty;
  },

  onTouchMove(e) {
    if (e.touches.length == 2 && this._touchType == 'pinch') {
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var scale = dist / this._lastPinchDist;
      this._lastPinchDist = dist;

      // Zoom image centered on crop box center
      var cx = this._cropX + this._cropW / 2;
      var cy = this._cropY + this._cropH / 2;
      var oldScale = this._imgScale;
      this._imgScale = Math.max(0.1, Math.min(this._imgScale * scale, 5));
      var ratio = this._imgScale / oldScale;
      this._imgX = cx - (cx - this._imgX) * ratio;
      this._imgY = cy - (cy - this._imgY) * ratio;
      this.redraw();
      return;
    }

    var tx = e.touches[0].clientX, ty = e.touches[0].clientY;
    var ddx = tx - this._lastTouchX, ddy = ty - this._lastTouchY;
    this._lastTouchX = tx;
    this._lastTouchY = ty;

    if (this._touchType == 'moveCrop') {
      this._cropX += ddx;
      this._cropY += ddy;
      // Clamp to canvas
      this._cropX = Math.max(0, Math.min(this._canvasW - this._cropW, this._cropX));
      this._cropY = Math.max(0, Math.min(this._canvasH - this._cropH, this._cropY));
    } else if (this._touchType == 'moveImage') {
      this._imgX += ddx;
      this._imgY += ddy;
    }
    this.redraw();
  },

  onTouchEnd() {
    this._touchType = 'none';
  },

  cancelCrop() {
    wx.navigateBack();
  },

  confirmCrop() {
    if (!this._canvas || !this._img) return;
    var self = this;

    // Calculate source coordinates from image
    var srcX = (this._cropX - this._imgX) / this._imgScale;
    var srcY = (this._cropY - this._imgY) / this._imgScale;
    var srcW = this._cropW / this._imgScale;
    var srcH = this._cropH / this._imgScale;

    // Clamp
    srcX = Math.max(0, srcX);
    srcY = Math.max(0, srcY);
    srcW = Math.min(this._imgW - srcX, srcW);
    srcH = Math.min(this._imgH - srcY, srcH);

    // Draw cropped area to temp canvas
    var offscreen = wx.createOffscreenCanvas({ type: '2d', width: Math.round(srcW), height: Math.round(srcH) });
    var ctx = offscreen.getContext('2d');
    ctx.drawImage(this._img, srcX, srcY, srcW, srcH, 0, 0, Math.round(srcW), Math.round(srcH));

    wx.canvasToTempFilePath({
      canvas: offscreen,
      fileType: 'jpg',
      quality: 0.9,
      success(res) {
        var eventChannel = self.getOpenerEventChannel();
        eventChannel.emit('cropResult', { croppedPath: res.tempFilePath });
        wx.navigateBack();
      },
      fail(err) {
        console.error(err);
        wx.showToast({ title: '裁剪失败', icon: 'none' });
      }
    });
  }
});

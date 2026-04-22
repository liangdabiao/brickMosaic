Page({
  data: {
    history: []
  },

  onShow() {
    var history = wx.getStorageSync('mosaic_history') || [];
    this.setData({ history: history });
  },

  previewImage(e) {
    var idx = e.currentTarget.dataset.index;
    var path = this.data.history[idx].path;
    wx.previewImage({
      current: path,
      urls: [path]
    });
  },

  saveImage(e) {
    var idx = e.currentTarget.dataset.index;
    var path = this.data.history[idx].path;
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
      fail(err) {
        if (err.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: '需要授权',
            content: '请允许访问相册以保存图片',
            success(res) { if (res.confirm) wx.openSetting(); }
          });
        }
      }
    });
  },

  deleteImage(e) {
    var idx = e.currentTarget.dataset.index;
    var self = this;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success(res) {
        if (res.confirm) {
          var history = self.data.history;
          history.splice(idx, 1);
          wx.setStorageSync('mosaic_history', history);
          self.setData({ history: history });
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  }
});

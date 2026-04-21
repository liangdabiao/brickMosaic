App({
  globalData: {
    originalImagePath: '',
    croppedImagePath: '',
    cropMode: 'center',
    ignoreBlack: true,
    colorAdjust: {
      shadows: 0,
      highlights: 0,
      hue: 0,
      saturation: 0,
      value: 0,
      contrast: 0
    },
    mosaicWidth: 48,
    mosaicHeight: 48,
    setCounts: {
      beatles: 0,
      monroe: 0,
      ironMan: 0,
      sith: 0,
      hogwarts: 0,
      mickey: 0,
      portrait: 0,
      world: 0,
      artProject: 0,
      elvis: 0,
      batman: 0
    },
    finalMosaicIm: null,
    fullPartList: [],
    imageFilename: 'mosaic',
    calculated: false
  }
});

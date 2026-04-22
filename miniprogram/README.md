# 积木拼豆像素画生成器 — 微信小程序

基于网页版 [custombrickmosaic.github.io](https://custombrickmosaic.github.io) 移植，功能完全一致的微信小程序版本。用户可以在手机上完成从图片上传到下载说明书的全部流程，所有计算均在客户端完成，图片不会上传到任何服务器。

---

## 项目结构

```
miniprogram/
├── app.js                    # 小程序入口，全局状态
├── app.json                  # 路由配置、tabBar、窗口样式
├── app.wxss                  # 全局样式（卡片、按钮、进度条等）
├── project.config.json       # 微信开发者工具配置
├── sitemap.json              # 小程序索引配置
│
├── pages/
│   ├── index/                # 首页（主流程）
│   │   ├── index.js          # 图片处理、马赛克计算、预览渲染、说明书生成
│   │   ├── index.wxml        # 5步操作界面
│   │   ├── index.wxss        # 页面样式
│   │   └── index.json
│   │
│   ├── crop/                 # 自定义裁剪页（手势交互）
│   │   ├── crop.js           # 单指拖拽、双指缩放、裁剪框控制
│   │   ├── crop.wxml
│   │   ├── crop.wxss
│   │   └── crop.json
│   │
│   ├── gallery/              # 说明书画廊（历史记录）
│   │   ├── gallery.js        # 本地存储读写、预览、保存到相册
│   │   ├── gallery.wxml
│   │   ├── gallery.wxss
│   │   └── gallery.json
│   │
│   └── about/                # 帮助/关于
│       ├── about.js
│       ├── about.wxml        # 使用说明、技巧、关于作者
│       ├── about.wxss
│       └── about.json
│
├── utils/
│   ├── algorithm.js          # 核心算法（从网页版移植）
│   └── instruction-gen.js    # 说明书长图渲染
│
└── data/
    └── lego-sets.js          # 11套乐高Art套装零件数据
```

---

## 功能说明

### 主流程（首页）

| 步骤 | 功能 | 说明 |
|------|------|------|
| 1 | 选择图片 | `wx.chooseMedia` 选择照片/拍照，支持裁切中心、缩放适应、自定义裁剪三种模式 |
| 2 | 颜色调整 | 6个滑块：暗部、亮部、色相、饱和度、明度、对比度，支持一键重置 |
| 3 | 设置尺寸 | 宽高 16~200，步进16，支持直接输入 |
| 4 | 选择套装 | 11种乐高Art套装，支持0.5步进的数量输入 |
| 5 | 计算生成 | 两阶段算法 + 进度条，生成后渲染预览 |
| 6 | 下载说明 | 生成长图PNG，支持预览和保存到相册 |

### 自定义裁剪页

- 单指拖拽移动裁剪框或图片
- 双指缩放图片（以裁剪框中心为锚点）
- 裁剪框锁定马赛克宽高比
- 三等分辅助线 + 四角拖拽手柄
- 裁剪结果通过 `EventChannel` 返回首页

### 说明书画廊

- `wx.setStorageSync` 存储生成历史（最多20条）
- 点击预览长图，长按保存到相册
- 需要申请 `scope.writePhotosAlbum` 权限

---

## 核心算法

### 马赛克生成（两阶段贪心+优化）

```
输入: 图片像素数据 (48×48), 可用零件列表 (颜色+数量)
输出: 马赛克矩阵 [x][y] = [R, G, B, colorIndex, partType, elementId]

阶段1 - 初始分配:
  对每个像素计算到所有可用颜色的欧氏距离（RGB空间）
  加入微小随机噪声打破平局
  贪心选择距离最小且零件仍有库存的颜色
  分配完毕后可用零件数减1

阶段2 - 交换优化 (最多100轮):
  对每个像素，寻找是否有比当前分配更好的颜色
  如果找到更优颜色，在全图寻找持有该颜色的像素进行交换
  只在交换能减少总色差时执行
  直到一轮内无任何改进时停止
```

### 颜色调整

- **HSV调整**: RGB→HSV→调整H/S/V→HSV→RGB
- **对比度**: 线性映射 `pixel * contrast + intercept`
- **曲线调整**: 三次样条插值（4个控制点），生成256级查找表
- **忽略黑色**: 检测原始纯黑像素（R=G=B=0），跳过颜色调整和马赛克分配

### 说明书长图生成

- 使用离屏Canvas（`wx.createOffscreenCanvas`）渲染
- 比例尺: 1mm = 4px（手机屏幕适配）
- 页面尺寸: 840×1188px（A4比例）
- 每个分区 16×16 像素
- 包含标题页（马赛克总览 + 颜色图例）和各分区页（圆形/方形颗粒 + 编号）
- `wx.canvasToTempFilePath` 导出PNG

---

## 开发踩坑记录

### 1. `require()` 必须在文件顶层

```javascript
// 正确 - 文件顶部
var _legoSets = require('../data/lego-sets.js');

// 错误 - 函数内部会报错
function foo() {
    var sets = require('../data/lego-sets.js'); // 运行时报错
}
```

微信小程序不支持函数内动态 `require()`，所有依赖必须在文件顶部声明。

### 2. Canvas 2D 中 `getImageData` 与 DPR 的陷阱

```javascript
// 错误 - 只读到左上角1/4
canvas.width = 200 * dpr;   // buffer = 400px
ctx.scale(dpr, dpr);         // context 缩放2x
ctx.drawImage(img, 0, 0, 200, 200);  // 填充整个400px buffer
var pixels = ctx.getImageData(0, 0, 200, 200);  // 只读200×200原始像素！

// getImageData 忽略 transform（scale/translate），直接按 buffer 像素读取
// 所以这里读到的是 400×400 buffer 的左上角 200×200 区域

// 正确 - buffer 尺寸与 getImageData 参数一致
canvas.width = 200;          // buffer = 200px
canvas.height = 200;
// 不使用 ctx.scale()
ctx.drawImage(img, 0, 0, 200, 200);
var pixels = ctx.getImageData(0, 0, 200, 200);  // 读到完整200×200
```

**核心规则**: `getImageData` 按照原始 buffer 像素坐标读取，不受 `ctx.scale()` 等 transform 影响。如果需要精确读取像素，不要使用 DPR 缩放。

### 3. 离屏Canvas的 `createImage()` 对临时文件路径不可靠

```javascript
// 不可靠 - 临时文件路径可能静默加载失败
var offscreen = wx.createOffscreenCanvas({ type: '2d', width: 200, height: 200 });
var img = offscreen.createImage();
img.src = 'http://tmp/xxx.png';  // wx.chooseMedia 返回的路径
img.onload = function() { /* 可能永远不会触发 */ };

// 可靠 - 使用页面Canvas的 createImage
var canvas = pageCanvasNode;  // 从 createSelectorQuery 获取
var img = canvas.createImage();
img.src = 'http://tmp/xxx.png';  // 正常加载
```

`wx.chooseMedia` 返回的临时文件路径（`http://tmp/...`）在离屏Canvas的 `createImage()` 中可能静默失败，但在页面Canvas的 `createImage()` 中可以正常加载。

### 4. Canvas 2D 缓冲区与CSS显示尺寸的关系

```javascript
// 微信小程序中 Canvas 2D 的行为:
// canvas.width/height = 绘图缓冲区尺寸（单位：CSS像素）
// CSS width/height = 元素显示尺寸
// 如果两者不一致，内容被裁剪而非缩放（与HTML5 Canvas不同！）

// 错误 - buffer比CSS大，只显示左上角
canvas.width = 600;
// CSS: width: 100% (= ~350px on phone)
// 结果: 只能看到 350×350 的左上角区域

// 解决方案: 使用离屏Canvas渲染 + wx.canvasToTempFilePath 导出
// 然后用 <image mode="aspectFit"> 显示
var offscreen = wx.createOffscreenCanvas({ type: '2d', width: 800, height: 800 });
// ... 绘制 ...
wx.canvasToTempFilePath({ canvas: offscreen, success(res) {
    // res.tempFilePath 可以用 <image> 组件正常显示
}});
```

**核心规则**: 微信小程序Canvas 2D的缓冲区大于CSS显示区域时，超出部分被裁剪（不像HTML5 Canvas会自动缩放）。建议用离屏Canvas渲染后导出为图片，用 `<image>` 组件显示。

### 5. `async/await` 与算法函数

```javascript
// 错误 - 使用了 await 但未声明 async
function generateValidColoring(imageData, fullPartList, ignoreBlack, onProgress) {
    // ...
    await sleep(0);  // 报错: Unexpected reserved word 'await'
}

// 正确
async function generateValidColoring(imageData, fullPartList, ignoreBlack, onProgress) {
    // ...
    await sleep(0);  // 让出执行权，更新UI
}
```

### 6. 大图内存管理

```javascript
// 图片选择时优先压缩版
wx.chooseMedia({
    sizeType: ['compressed'],  // 系统压缩版，通常 < 2MB
    // ...
});

// 算法只使用缩小后的像素
// 中间处理尺寸: 200×200（与网页版一致）
// 算法实际尺寸: mosaicW × mosaicH（如48×48）
// 避免直接处理原始图片（如 4000×3000）
```

### 7. 长图生成的Canvas高度限制

```javascript
// 48×48 马赛克 → 9个分区 → 长图高度 = 1188 × 10 = 11880px
// 离屏Canvas可以处理，但要注意内存

var totalHeight = PAGE_H * totalPages;
var offscreen = wx.createOffscreenCanvas({ type: '2d', width: PAGE_W, height: totalHeight });

// 如果内存不足，可以逐页绘制+导出（备用方案）
for (var i = 0; i < totalPages; i++) {
    var pageCanvas = wx.createOffscreenCanvas({ type: '2d', width: PAGE_W, height: PAGE_H });
    // 绘制单页...
    // 导出单页...
}
```

### 8. 页面间数据传递（裁剪结果）

```javascript
// 首页 → 裁剪页
wx.navigateTo({
    url: '/pages/crop/crop?imagePath=' + encodeURIComponent(path) + '&aspectRatio=' + ratio,
    events: {
        // 裁剪页通过 EventChannel 返回结果
        cropResult: function(data) {
            self.setData({ previewPath: data.croppedPath });
        }
    }
});

// 裁剪页 → 首页
var eventChannel = this.getOpenerEventChannel();
eventChannel.emit('cropResult', { croppedPath: tempFilePath });
wx.navigateBack();
```

---

## 网页版 vs 小程序版差异

| 维度 | 网页版 | 小程序版 |
|------|--------|---------|
| UI框架 | Bootstrap 5 (CDN) | 原生 WXML + WXSS |
| 布局 | 双栏（左控制+右预览） | 单栏纵向滚动 |
| 图片选择 | `<input type="file">` | `wx.chooseMedia()` |
| Canvas | HTML5 Canvas 2D | 小程序 Canvas 2D（API有差异） |
| 图片裁剪 | Cropper.js (CDN) | 自实现（手势交互） |
| PDF下载 | jsPDF | 不支持（改用长图PNG） |
| 长图导出 | `canvas.toDataURL()` | `wx.canvasToTempFilePath()` |
| 保存文件 | `<a>` 标签 download | `wx.saveImageToPhotosAlbum()` |
| 历史记录 | 无 | 本地存储（最多20条） |
| 说明书画廊 | 无 | 新增页面 |

---

## 支持的乐高Art套装

| 编号 | 名称 | 颗粒数 |
|------|------|--------|
| 31198 | 披头士 The Beatles |  |
| 31197 | 玛丽莲·梦露 Marilyn Monroe |  |
| 31199 | 钢铁侠 Iron Man |  |
| 31200 | 西斯 The Sith |  |
| 31201 | 霍格沃茨 Hogwarts |  |
| 31202 | 米老鼠 Mickey Mouse |  |
| 41958 | 自定义肖像 Personalized Portrait |  |
| 31203 | 世界地图 World Map |  |
| 21226 | 艺术创作 Art Project |  |
| 31204 | 猫王 Elvis Presley |  |
| 31205 | 蝙蝠侠 Batman |  |

每套包含约18种颜色的圆形/方形颗粒，用户可输入小数（如0.5套）精确匹配库存。

---

## 配置

- **AppID**: `wx0282e038d1fe261f`
- **最低基础库**: 2.25.3
- **开发工具**: 微信开发者工具
- **目标平台**: iOS + Android

### 权限

| 权限 | 用途 | 申请时机 |
|------|------|---------|
| `scope.writePhotosAlbum` | 保存长图到相册 | 用户点击保存时 |
| `scope.camera` | 拍照上传图片 | 用户选择拍照时 |

---

## 运行

1. 微信开发者工具导入 `miniprogram/` 目录
2. 使用测试号或已注册的AppID
3. 编译运行，可在模拟器或真机预览

无需安装任何依赖，无需构建步骤。

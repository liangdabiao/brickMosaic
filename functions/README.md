# my-mosaic-api

拼豆图纸生成器的独立 API 服务，基于 Cloudflare Pages Functions 部署。

## 功能

提供 AI 图像优化接口（火山引擎即梦 AI），将拼豆底稿图转换为优化后的像素画。

## 项目结构

```
my-api/
├── functions/
│   └── api/
│       └── ai-optimize.ts    # AI 图像优化接口
├── wrangler.toml             # Cloudflare Pages 配置
├── package.json              # 本地开发脚本
└── README.md
```

## 接口说明

### POST /api/ai-optimize

**请求体：**

```json
{
  "imageBase64": "data:image/png;base64,...",
  "prompt": "优化描述"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| imageBase64 | string | 是 | 图片的 base64 编码，支持带 `data:image/...;base64,` 前缀 |
| prompt | string | 是 | AI 优化提示词 |

**成功响应：**

```json
{
  "success": true,
  "imageUrl": "https://...或data:image/jpeg;base64,...",
  "taskId": "xxx"
}
```

**错误响应：**

```json
{
  "error": "错误描述",
  "message": "详细信息"
}
```

## 环境变量

在 Cloudflare Dashboard 的项目 Settings > Environment variables 中配置：

| 变量名 | 说明 |
|--------|------|
| `VOLC_ACCESS_KEY_ID` | 火山引擎 Access Key ID |
| `VOLC_SECRET_ACCESS_KEY` | 火山引擎 Secret Access Key |

## 本地开发

```bash
npm run dev
```

访问 `http://localhost:8788/api/ai-optimize`

本地开发时需要先创建 `.dev.vars` 文件写入环境变量：

```
VOLC_ACCESS_KEY_ID=your_key_id
VOLC_SECRET_ACCESS_KEY=your_secret_key
```

## 部署到 Cloudflare Pages

### 首次部署

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 创建新的 Pages 项目
2. 在项目的 Settings > Environment variables 中添加环境变量
3. 运行部署命令：

```bash
npm run deploy
```

### 后续更新

直接运行 `npm run deploy` 即可。

部署成功后，API 地址为：

```
https://<项目名>.pages.dev/api/ai-optimize
```

## 从其他网站调用

部署完成后，其他网站可通过标准 fetch 调用：

```javascript
const response = await fetch('https://my-mosaic-api.pages.dev/api/ai-optimize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageBase64: 'data:image/png;base64,...',
    prompt: '你的提示词'
  })
});

const result = await response.json();
console.log(result.imageUrl);
```

> **注意：** 如果需要跨域调用，需在 `functions/api/ai-optimize.ts` 的响应中添加 CORS 响应头。

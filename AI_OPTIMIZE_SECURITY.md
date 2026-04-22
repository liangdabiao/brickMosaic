# AI 优化 API 安全防护方案

当前 `/api/ai-optimize` 接口完全公开，任何人可直接调用。以下是 4 种防护方案的具体实现，建议组合使用。

---

## 方案一：Referer 校验（最简单，防随意调用）

在 `functions/api/ai-optimize.js` 的 `onRequestPost` 函数开头加几行校验。

**原理**：检查请求的 `Referer` 头是否为你的域名，拒绝非本站来源的请求。

**实现代码**（加在 `onRequestPost` 函数最前面）：

```javascript
export async function onRequestPost(context) {
    const { request, env } = context;

    // === Referer 校验 ===
    const referer = request.headers.get('Referer') || '';
    const allowedOrigins = [
        'https://lego.348349.xyz',
        'http://localhost:8788',   // 本地开发
        'http://127.0.0.1:8788',
    ];
    const isAllowed = allowedOrigins.some(origin => referer.startsWith(origin));
    if (!isAllowed && !referer.includes('localhost')) {
        return Response.json(
            { error: 'Access denied: invalid origin' },
            { status: 403 }
        );
    }
    // === Referer 校验结束 ===

    // ... 后续原有逻辑不变
```

**优点**：改动极小，3 行代码搞定
**缺点**：Referer 头可以被伪造，只能防普通用户随意调用，防不住脚本攻击

---

## 方案二：简单 Token 鉴权（防接口被发现后的滥用）

在前端请求中携带一个约定好的 Token，后端校验 Token 是否匹配。

**实现步骤**：

### 2.1 后端校验（`functions/api/ai-optimize.js`）

在 `onRequestPost` 函数开头加 Token 校验：

```javascript
export async function onRequestPost(context) {
    const { request, env } = context;

    // === Token 校验 ===
    const { imageBase64, prompt, token } = await request.json();

    const validToken = env.AI_API_TOKEN;  // 从环境变量读取，不要硬编码
    if (!token || token !== validToken) {
        return Response.json(
            { error: 'Unauthorized: invalid token' },
            { status: 401 }
        );
    }
    // === Token 校验结束 ===

    // 注意：这里把 json 解析提前了，后续代码不再需要重复 request.json()
    // 原来的 `const { imageBase64, prompt } = await request.json();` 删掉，因为上面已经解析了
```

**改动点**：原来的 `const { imageBase64, prompt } = await request.json();` 要删掉，因为已经在 Token 校验处解析过了。同时后面检查 `!imageBase64` 和 `!prompt` 的代码保持不变。

### 2.2 前端传 Token（`brickMosaic.js`）

在 `fetch` 请求中携带 Token：

```javascript
// AI 风格优化按钮的事件处理中
const response = await fetch('/api/ai-optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        imageBase64,
        prompt,
        token: 'your-secret-token-here'  // 改成一个你自己定义的随机字符串
    })
});
```

### 2.3 配置环境变量

在 Cloudflare 后台 **Pages → Settings → Environment variables** 添加：

| 变量名 | 值 |
|--------|-----|
| `AI_API_TOKEN` | 你自己生成的一个随机字符串，比如 `lego2026!xK9m#pQ3r` |

Token 生成方式（任选一种）：
```bash
# Linux/Mac
openssl rand -hex 16
# 输出示例：a3f7b2c9e1d48f6a0b5c7d2e8f1a3b4c

# 或直接自己想一个足够长的随机字符串（16位以上，含大小写字母、数字、特殊字符）
```

**优点**：简单有效，不知道 Token 的人无法调用
**缺点**：Token 写在前端 JS 里，查看源码就能看到（但配合方案一的 Referer 校验，门槛已足够高）

---

## 方案三：Cloudflare Rate Limiting（推荐，防高频攻击）

在 Cloudflare 后台配置，不改代码，限制每个 IP 的请求频率。

**配置步骤**：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入你的域名（不是 Pages 项目，是域名）
3. 左侧菜单 **Security → WAF → Rate limiting rules**
4. 点击 **Create rule**

**规则配置**：

| 字段 | 值 |
|------|-----|
| Rule name | `API Rate Limit` |
| When incoming requests match | **Custom filter expression**（见下方） |
| Then the action is | **Block** for **60 seconds** |
| Rate | **5 requests** per **1 minute** per **IP** |

**Custom filter expression**（点击 Edit expression）：

```
(http.request.uri.path contains "/api/") and (http.request.method eq "POST")
```

效果：每个 IP 每 60 秒最多 5 次 POST 请求到 `/api/` 路径，超过则被阻止 60 秒。

**如果用免费套餐没有 Rate Limiting**：

免费套餐没有 Rate Limiting 功能。替代方案：
- 升级 Pro 套餐（$20/月）
- 或用方案四的 Turnstile 替代
- 或在代码里自己实现简单的计数限流（见下方补充）

**代码层限流补充方案**（Cloudflare Workers KV 方式，免费但需绑定 KV）：

如果不想升级套餐，可以在 Function 代码里用 KV 做简单限流。这个需要额外配置 KV namespace，改动较大，建议优先用方案四 Turnstile（免费）。

---

## 方案四：Cloudflare Turnstile 人机验证（最靠谱，免费）

Cloudflare Turnstile 是免费的 CAPTCHA 替代方案，用户体验比传统验证码好（大多数情况自动通过，无需点击）。

### 4.1 获取 Turnstile Site Key

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单 **Turnstile**
3. 点击 **Add site**
4. 配置：

| 字段 | 值 |
|------|-----|
| Site name | `Lego Mosaic AI` |
| Domain | `lego.348349.xyz` |
| Widget Mode | **Managed**（推荐） |

5. 创建后得到两个 Key：
   - **Site Key**（前端用，公开的）：类似 `0x4AAAAAAAxxxxxxxx`
   - **Secret Key**（后端用，保密的）：类似 `0x4AAAAAAAyyyyyyyy`

### 4.2 配置环境变量

在 Cloudflare 后台 **Pages → Settings → Environment variables** 添加：

| 变量名 | 值 |
|--------|-----|
| `TURNSTILE_SECRET_KEY` | 上一步获得的 Secret Key |

### 4.3 前端加 Turnstile 组件（`index.html`）

在 AI 优化按钮区域添加 Turnstile 隐藏组件：

```html
<!-- 在 AI 优化按钮的 div 内部添加 -->
<div class="col-12 my-1">
    <button type="button" class="btn btn-outline-info btn-sm w-100" id="buttonAiOptimize">
        <span id="aiOptimizeIcon">🤖</span>
        <span id="aiOptimizeText">AI 风格优化</span>
    </button>
    <p class="text-muted mb-0 mt-1" style="font-size:0.75rem;" id="aiOptimizeStatus"></p>
    <!-- Turnstile 隐藏验证组件 -->
    <div class="cf-turnstile my-1" data-sitekey="你的SiteKey" data-callback="onTurnstileSuccess" data-theme="dark" data-size="compact"></div>
</div>
```

在 `</body>` 前加载 Turnstile JS：

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

### 4.4 前端 JS 获取 Token（`brickMosaic.js`）

在文件顶部加一个全局变量存储 Turnstile token：

```javascript
var turnstileToken = '';
```

添加 Turnstile 回调函数（放在 AI 优化事件绑定之前）：

```javascript
// Turnstile 验证成功回调
window.onTurnstileSuccess = function(token) {
    turnstileToken = token;
};
```

在 AI 优化的 fetch 请求中带上 token：

```javascript
const response = await fetch('/api/ai-optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, prompt, turnstileToken })
});
```

### 4.5 后端验证 Token（`functions/api/ai-optimize.js`）

在 `onRequestPost` 函数开头加 Turnstile 验证：

```javascript
export async function onRequestPost(context) {
    const { request, env } = context;
    const body = await request.json();
    const { imageBase64, prompt, turnstileToken } = body;

    // === Turnstile 验证 ===
    if (!turnstileToken) {
        return Response.json(
            { error: 'Missing Turnstile token' },
            { status: 400 }
        );
    }

    const verifyResponse = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: env.TURNSTILE_SECRET_KEY,
                response: turnstileToken,
            })
        }
    );
    const verifyResult = await verifyResponse.json();
    if (!verifyResult.success) {
        return Response.json(
            { error: 'Turnstile verification failed' },
            { status: 403 }
        );
    }
    // === Turnstile 验证结束 ===

    // 后续用 body.imageBase64 和 body.prompt
    if (!imageBase64) {
        // ...
```

**注意**：由于 `request.json()` 只能调用一次，方案四会把 json 解析提前。后续代码中所有 `imageBase64` 和 `prompt` 要改为从已解析的 `body` 对象读取，删掉原来的 `const { imageBase64, prompt } = await request.json();`。

---

## 推荐组合

| 方案 | 成本 | 改动量 | 防护级别 | 建议 |
|------|------|--------|----------|------|
| 1. Referer 校验 | 免费 | 3 行代码 | 低（防随意调用） | ✅ 必加 |
| 2. Token 鉴权 | 免费 | 5 行代码 | 中（需看源码才能绕过） | ✅ 必加 |
| 3. Rate Limiting | Pro $20/月 | 纯后台配置 | 高（防高频攻击） | ⚠️ 按需 |
| 4. Turnstile 验证 | 免费 | 前后端各加几行 | 高（机器人防护） | ✅ 推荐 |

**建议组合：方案 1 + 2 + 4**，全部免费，覆盖了来源校验、身份验证和人机识别，足以应对绝大多数滥用场景。

---

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `functions/api/ai-optimize.js` | 加 Referer 校验、Token 校验、Turnstile 验证 |
| `brickMosaic.js` | fetch 请求中加 token 和 turnstileToken 参数 |
| `index.html` | 加 Turnstile 组件和 JS 引用 |
| Cloudflare 后台 | 加环境变量 `AI_API_TOKEN`、`TURNSTILE_SECRET_KEY` |

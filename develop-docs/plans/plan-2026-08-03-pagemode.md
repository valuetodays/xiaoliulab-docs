# 实现 VitePress Page Mode（Video Mode）

## 当前状态

当前项目是 VitePress 网站。

目标：

为网站增加统一的 Page Mode 机制，并实现：

```
?mode=video
```

录屏展示模式。

该模式用于 Playwright 自动录制文章视频。

注意：

- 本任务只修改网站代码。
- 不修改 Playwright 录制脚本。
- 不实现 `?video=1`。
- 不通过 Playwright 删除页面元素。
- 网站自身应该原生支持 Video Mode。

---

# 第一阶段：先分析项目结构（不要修改代码）

执行前请先检查：

## 1. VitePress 结构

确认：

- `.vitepress/config.*`
- `.vitepress/theme/*`
- 自定义 Layout
- enhanceApp.ts / enhanceApp.js
- client entry
- CSS 文件入口

## 2. 当前页面组件

确认实际存在：

- Header
- Nav
- Sidebar
- Local TOC / On this page
- Footer
- BackToTop
- Edit Link
- 上一篇/下一篇导航
- 搜索
- 主题切换

不要根据 VitePress 默认 DOM 猜测。

必须基于当前项目真实结构实现。

## 3. 当前 H5 布局

确认：

- 移动端正文宽度
- sidebar 隐藏方式
- content 容器
- markdown body 容器

## 4. 当前工程能力

确认：

- 是否已有 URL 参数工具
- 是否已有 data-* 属性机制
- 当前测试方式
- 当前构建命令

分析完成后，先输出：

```
项目结构分析结果
准备修改文件列表
实现方案
风险点
```

等待确认后再修改。

---

# 第二阶段：新增统一 Page Mode

新增公共模块。

例如：

```
.vitepress/theme/utils/page-mode.ts
```

具体位置根据项目结构决定。

要求：

## 支持模式

当前：

```ts
default
video
```

未来可扩展。

---

## 统一定义模式字符串

例如：

```ts
export const PAGE_MODE = {
    DEFAULT: "default",
    VIDEO: "video"
} as const;
```

禁止业务代码出现：

```ts
"video"
```

作为判断条件。

---

## 提供统一 API

例如：

```ts
getPageMode()

isVideoMode()
```

要求：

- SSR 安全
- 不直接访问 window
- 未知 mode 回退 default

---

禁止：

```ts
new URLSearchParams(location.search)
```

散落在组件中。

禁止：

```ts
mode === "video"
```

业务判断。

业务代码必须：

```ts
if (isVideoMode()) {

}
```

---

# 第三阶段：初始化页面模式

页面加载尽早设置：

```html
<html data-page-mode="default">
```

或者：

```html
<html data-page-mode="video">
```

优先使用 VitePress 官方机制：

例如：

- enhanceApp
- layout
- client hook

根据项目实际结构选择。

目标：

避免：

```
页面先显示完整布局
↓
JS执行
↓
突然隐藏
```

导致录屏闪烁。

---

# 第四阶段：实现 Video Mode

访问：

```
?mode=video
```

进入视频模式。

实现原则：

## 使用 CSS 控制展示

优先：

```css
html[data-page-mode="video"]
```

不要：

```js
element.remove()
```

不要让 Playwright 负责修改 DOM。

---

# Video Mode 隐藏内容

根据实际组件隐藏：

## 页面框架

- Header
- Navigation
- Mobile Menu
- Sidebar
- Footer

## 阅读辅助

- TOC
- On this page
- Search
- Theme Switch
- Back To Top

## 文章附属

- Edit Link
- 上一篇/下一篇
- 分享按钮
- 版权声明

原则：

页面只保留：

- 标题
- 正文
- 图片
- 表格
- 代码
- 引用
- 数学公式

---

# 第五阶段：调整正文布局

Video Mode 下：

解决隐藏 sidebar 后的问题。

要求：

- 正文占满可用空间
- 清除 sidebar/grid/margin 占位
- 保持手机阅读体验
- 图片不溢出
- 表格正常
- 代码块正常
- 不改变 Markdown 内容

---

# 第六阶段：兼容要求

以下情况必须保持普通模式：

```
/article
```

以及：

```
/article?mode=unknown
```

要求：

- 页面完全保持现状
- SEO 不变
- canonical 不变
- sitemap 不变
- markdown 不变
- SSR 正常
- hydration 正常

不支持：

```
?video=1
```

---

# 第七阶段：验证

完成后执行：

## 普通模式

验证：

```
/article
```

确认：

- 所有导航正常
- 布局无变化

---

## Video Mode

验证：

```
/article?mode=video
```

确认：

- 非正文元素隐藏
- 正文布局正确
- 可以自动滚动
- 适合 Playwright 录制

---

## Unknown Mode

验证：

```
/article?mode=test
```

确认：

回退普通模式。

---

## 工程检查

执行：

- build
- type check
- test（如果存在）

检查：

- 浏览器控制台无错误
- SSR 无错误

---

# 最终输出

完成后请汇报：

1. 项目结构分析结果
2. 修改文件列表
3. Page Mode 实现位置
4. 初始化方式
5. 实际隐藏的组件
6. Video Mode CSS 调整
7. 验证结果
8. 遗留风险

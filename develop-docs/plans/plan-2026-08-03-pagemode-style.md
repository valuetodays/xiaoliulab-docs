# 继续实现 VitePress 的 Page Mode / Video Mode

前置要求保持不变：

* 先完成只读分析。
* 先输出项目结构分析结果、准备修改文件列表、实现方案和风险点。
* 未经确认不要修改代码。
* 本任务只修改网站，不修改 Playwright 录制脚本。
* 只支持 `?mode=video`，不支持 `?video=1`。

## 一、Video Mode 的样式位置

Video Mode 的 CSS 必须写入当前 VitePress 主题已有的全局样式体系中。

请先检查当前项目实际结构，例如：

* `.vitepress/theme/index.ts`
* `.vitepress/theme/index.js`
* `.vitepress/theme/style.css`
* `.vitepress/theme/custom.css`
* `.vitepress/theme/styles/*`

确认：

* 当前主题入口文件在哪里
* 当前全局 CSS 从哪里引入
* 是否已有按功能拆分的样式目录
* 当前 CSS 命名和组织方式

不要预设一定存在 `style.css`。

实现时应优先复用现有样式入口，不要无意义地新增第二套全局样式体系。

如果项目已经按功能拆分样式，可以新增类似文件：

`.vitepress/theme/styles/page-mode.css`

并从现有主题入口或全局 CSS 入口引入。

如果项目只有一个全局主题 CSS，则直接把 Video Mode 样式写入该文件的独立区块。

不要把这些样式写入：

* `.vitepress/config.*`
* 单篇 Markdown 文件
* Playwright 脚本
* 页面内联 `style`
* 与主题无关的业务目录

## 二、页面模式标记

在全局入口尽早设置：

普通模式：

```html
<html data-page-mode="default">
```

Video Mode：

```html
<html data-page-mode="video">
```

CSS 统一通过以下形式控制：

```css
html[data-page-mode='video'] {
}
```

不要依赖 Playwright 注入 CSS。

不要使用大量 JavaScript 删除 DOM。

## 三、隐藏项

请先检查当前项目和当前 VitePress 版本生成的真实 DOM，再确定最终选择器。

Video Mode 下需要隐藏的内容包括但不限于：

* 顶部导航
* 移动端导航
* 移动端 `Menu`
* 移动端 `On this page`
* 左侧 Sidebar
* 右侧 TOC
* 搜索入口
* 主题切换
* Footer
* Back To Top
* Edit Link
* 上一篇、下一篇
* 其它非正文辅助控件

对于 VitePress 默认主题，可能涉及类似选择器：

```css
.VPNav
.VPLocalNav
.VPSidebar
.VPDocAside
.VPDocFooter
```

这些仅作为分析参考。

不要直接照抄以上选择器，必须根据当前项目的真实 DOM、组件和 VitePress 版本确认。

尤其需要检查移动端截图中显示的：

```text
Menu
On this page
```

它们很可能来自同一个移动端本地导航容器。需要确认实际 DOM 后整体隐藏，避免分别猜测子元素。

## 四、布局占位必须同步清理

只执行 `display: none` 可能仍然留下 Sidebar、TOC 或顶部导航的布局占位。

Video Mode 下需要同步检查和调整：

* `.VPContent` 的顶部留白
* Sidebar 导致的左侧 `padding` 或 `margin`
* TOC 导致的右侧布局列
* `.VPDoc` 的 `grid` 或 `flex` 布局
* `.container`
* `.content`
* `.content-container`
* 其它当前主题实际使用的正文容器

目标：

* 隐藏 Sidebar 后，正文不保留左侧空白
* 隐藏 TOC 后，正文不保留右侧空白
* 隐藏顶部导航后，正文不保留多余顶部间距
* H5 下正文使用可用宽度
* 保留合理的左右阅读留白
* 不让正文紧贴屏幕边缘

不要盲目设置：

```css
max-width: none;
```

先检查现有正文宽度是否适合 H5 阅读。

可以放宽主题布局限制，但必须保留合理的内容宽度和 `padding`。

## 五、内容适配

Video Mode 下确认：

* 标题不溢出
* 图片最大宽度不超过正文
* 表格可以正常展示，必要时允许横向滚动
* 代码块不撑破页面
* 长链接和长英文文本可换行
* 引用、列表、公式保持现有语义和样式
* Markdown 内容不发生修改

## 六、Page Mode 模块约束

统一 Page Mode 模块集中定义：

* `default`
* `video`

提供：

```ts
getPageMode()
isVideoMode()
```

必须 SSR 安全。

未知模式回退到 `default`。

除 Page Mode 基础模块外，业务代码不得直接写：

```ts
mode === 'video'
```

不得重复解析：

```ts
new URLSearchParams(...)
```

不得使用：

```ts
location.search.includes(...)
```

CSS 中允许出现：

```css
html[data-page-mode='video']
```

## 七、路由变化

请检查 VitePress 的客户端导航行为。

如果用户通过站内路由切换页面，或者查询参数变化，需要保证：

```html
data-page-mode
```

能够同步更新。

根据当前 VitePress 版本和项目入口，选择正确的路由钩子或主题生命周期。

不要仅在应用首次启动时设置一次，除非分析能够证明当前使用场景不会发生客户端路由变化。

## 八、作用范围

Page Mode 机制全站统一。

当前 `video` 模式同样全站生效。任何路由访问：

```text
?mode=video
```

时，都统一减少导航、侧栏、目录、Footer 等非核心元素，只保留该页面原本展示的主要内容。

不要判断当前路由或页面类型，不要维护文章路径列表，也不要新增 `isArticlePage()` 一类的页面类型判断。

首页、分类页、索引页、搜索页和其它页面访问 `?mode=video` 时，也使用相同的精简展示规则。

## 九、分析阶段输出

现在先不要修改代码。

完成只读分析后，固定输出以下内容。

### 项目结构分析结果

包括：

* VitePress 配置位置
* 主题入口位置
* 全局 CSS 入口
* 是否存在自定义 Layout
* 是否存在 `enhanceApp`
* 当前 H5 布局结构
* Header、Sidebar、TOC、Footer 等真实组件或 DOM
* 当前 Page Mode 的全站作用方式
* 当前构建、测试和类型检查命令

### 准备修改文件列表

逐个说明：

* 文件路径
* 修改目的
* 新增还是修改

### 实现方案

明确说明：

* Page Mode 模块放在哪里
* `data-page-mode` 在哪里设置
* 如何处理客户端路由变化
* 如何保证 Video Mode 全站生效
* Video Mode CSS 写在哪里
* 实际准备隐藏哪些选择器
* 如何清理布局占位
* 如何避免首次加载闪烁

### 风险点

至少检查：

* VitePress 默认主题内部类名依赖
* 主题升级后的兼容性
* SSR 与 hydration
* 首屏闪烁
* 客户端路由切换
* 移动端和桌面端布局差异
* 未知路由或自定义页面的样式兼容性

输出方案后等待确认，不要开始修改。

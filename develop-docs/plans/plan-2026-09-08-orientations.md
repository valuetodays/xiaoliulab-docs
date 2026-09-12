# 内核思想系统方案

## 1. 目标

为文章增加一套独立于普通 `tags` 的“内核思想”。

普通标签回答：

> 这篇文章讲什么？

例如：

`Java`、`Spring Boot`、`API`、`Docker`、`ETF`

内核思想回答：

> 这篇文章体现了什么长期内核思想？

第一版固定 6 条：

| code             | 中文名称 | 颜色        | 说明                             |
| ---------------- | ---- | --------- | ------------------------------ |
| `boundary`       | 边界   | `#409EFF` | 遇到复杂系统，先想清楚谁和谁应该分开，以及各自负责什么。   |
| `preserve-truth` | 留真   | `#67C23A` | 保留当时真实发生的事实，不用后来形成的解释重写历史。     |
| `reproducible`   | 复现   | `#E6A23C` | 一次成功不是证据，能够重复验证，结论才更可靠。        |
| `explicit`       | 显式   | `#9B59B6` | 重要状态、规则和风险尽量明确表达，不依赖隐含默认和人的记忆。 |
| `restraint`      | 克制   | `#909399` | 没有充分理由时不强行动作，不为了使用资源而制造动作。     |
| `evolution`      | 演进   | `#00A6A6` | 接受当前结论并非最终答案，在保留历史的基础上持续修正和演进。 |

颜色第一版先作为默认值，以后随时可以只改配置。

---

## 2. 内核思想统一定义

新增：

```text
docs/.vitepress/data/orientations.ts
```

定义：

```ts
export interface OrientationDefinition {
  code: string
  name: string
  color: string
  description: string
}
```

内容类似：

```ts
export const orientations: OrientationDefinition[] = [
  {
    code: 'boundary',
    name: '边界',
    color: '#409EFF',
    description: '遇到复杂系统，先想清楚谁和谁应该分开，以及各自负责什么。'
  },
  {
    code: 'preserve-truth',
    name: '留真',
    color: '#67C23A',
    description: '保留当时真实发生的事实，不用后来形成的解释重写历史。'
  },
  {
    code: 'reproducible',
    name: '复现',
    color: '#E6A23C',
    description: '一次成功不是证据，能够重复验证，结论才更可靠。'
  },
  {
    code: 'explicit',
    name: '显式',
    color: '#9B59B6',
    description: '重要状态、规则和风险尽量明确表达，不依赖隐含默认和人的记忆。'
  },
  {
    code: 'restraint',
    name: '克制',
    color: '#909399',
    description: '没有充分理由时不强行动作，不为了使用资源而制造动作。'
  },
  {
    code: 'evolution',
    name: '演进',
    color: '#00A6A6',
    description: '接受当前结论并非最终答案，在保留历史的基础上持续修正和演进。'
  }
]
```

内核思想定义只维护这一份。

---

## 3. 文章 Frontmatter

文章只保存 `code`：

```yaml
---
title: Spring Boot 单体应用中的接口安全边界设计

tags:
  - Spring Boot
  - API
  - 安全

orientations:
  - boundary
  - explicit
---
```

不在文章里重复：

* 中文名称
* 颜色
* 说明

这样以后修改显示名称或颜色，不需要改所有文章。

---

## 4. 扩展文章元数据

继续使用现有：

```text
docs/.vitepress/markdown/article-metadata.ts
```

文章元数据增加：

```ts
orientations?: string[]
```

例如：

```ts
export interface ArticleMeta {
  title: string
  link: string
  tags?: string[]
  orientations?: string[]
}
```

构建阶段读取 frontmatter 后，得到：

```ts
{
  title: 'Spring Boot 单体应用中的接口安全边界设计',
  link: '/lab-tech-exploration/engineering-practice/...',
  orientations: ['boundary', 'explicit']
}
```

内核思想数据全部在 **VitePress 构建阶段完成处理**，不让浏览器运行时扫描 Markdown。

---

## 5. 内核思想聚合

基于 ArticleMeta 构造：

```ts
export interface OrientationGroup {
  orientation: OrientationDefinition
  articles: ArticleMeta[]
}
```

例如：

```ts
boundary -> [
  API 安全边界设计,
  UT / IT / SmokeIT 执行边界,
  可维护的上游渠道调用
]
```

同时可以直接得到：

```ts
articles.length
```

作为内核思想文章数量。

这里还应该做校验：

如果文章写了：

```yaml
orientations:
  - abc
```

但 `orientations.ts` 不存在 `abc`，构建时输出明确 warning，避免拼错以后悄悄生成一个无效标签。

---

## 6. OrientationTag 组件

新增：

```text
docs/.vitepress/theme/components/OrientationTag.vue
```

调用方式：

```vue
<OrientationTag code="boundary" />
```

显示效果类似 Element Plus：

> 边界

要求：

* 根据 `code` 自动读取中文名称
* 自动使用定义中的颜色
* 圆角
* 浅色背景
* 边框
* hover 效果
* 鼠标样式
* 支持暗色模式
* 点击跳转到内核思想页面

目标 URL：

```text
/orientations/boundary
```

这里**不需要引入 Element Plus**。

只模仿 `el-tag` 的视觉即可，避免为了一个 Tag 增加整个 UI 框架依赖。

---

## 7. 文章页面自动展示

扩展现有：

```text
docs/.vitepress/theme/components/ArticleMeta.vue
```

当文章：

```yaml
orientations:
  - boundary
  - reproducible
  - explicit
```

页面标题下方自动显示：

```text
内核思想  [边界] [复现] [显式]
```

其中三个都是 `OrientationTag`。

文章作者不需要手工写：

```vue
<OrientationTag />
```

也就是说：

> **frontmatter 负责声明，主题负责展示。**

没有 `orientations` 的旧文章不显示这一行，不影响现有页面。

---

# 8. 内核思想索引页

新增：

```text
docs/orientations/index.md
```

URL：

```text
/orientations/
```

页面建议显示成卡片：

```text
[边界]          8 篇文章

遇到复杂系统，先想清楚谁和谁应该分开，
以及各自负责什么。

查看相关文章 →
```

六条全部展示：

> 边界 · 留真 · 复现 · 显式 · 克制 · 演进

可以按固定配置顺序排列，而不是按文章数量或者字母排序。

---

# 9. 内核思想详情页

访问：

```text
/orientations/boundary
```

页面：

```text
# 边界

[边界]

遇到复杂系统，先想清楚谁和谁应该分开，
以及各自负责什么。

## 相关文章

- Spring Boot 单体应用中的接口安全边界设计
- 别把所有测试都叫 Test
- 如何编写可维护的上游渠道调用代码
```

其他内核思想：

```text
/orientations/preserve-truth
/orientations/reproducible
/orientations/explicit
/orientations/restraint
/orientations/evolution
```

---

# 10. 页面生成方式

我建议**不要手工维护 6 个 Markdown 详情页**。

因为内核思想已经全部定义在：

```text
orientations.ts
```

文章关系也已经在构建期聚合。

因此内核思想详情页应该由同一份数据生成。

这样以后新增：

```ts
{
  code: 'xxx',
  ...
}
```

不需要另外创建一堆重复页面。

最终数据流：

```text
orientations.ts
      │
      ├── 内核思想名称 / code / color / description
      │
文章 frontmatter
      │
      └── orientations: [boundary, explicit]
                ↓
      article-metadata.ts
                ↓
          构建期聚合
                ↓
        ┌───────┴────────┐
        ↓                ↓
文章页 OrientationTag    /orientations/
                         ↓
                 /orientations/{code}
```

---

# 11. 第一版文件变化

预计主要涉及：

```text
docs/
├── orientations/
│   └── index.md
│
└── .vitepress/
    ├── data/
    │   └── orientations.ts
    │
    ├── markdown/
    │   └── article-metadata.ts
    │
    └── theme/
        ├── components/
        │   ├── ArticleMeta.vue
        │   ├── OrientationTag.vue
        │   ├── OrientationIndex.vue
        │   └── OrientationDetail.vue
        │
        └── index.ts
```

具体是否需要 `OrientationDetail.vue`，实现时可以根据 VitePress 的动态页面方案再决定。

---

# 12. 第一版验收标准

完成以后应该满足：

```yaml
orientations:
  - boundary
  - reproducible
```

只需要在文章里增加这两行，就自动获得：

1. 文章标题附近出现 `el-tag` 风格的 **边界、复现**
2. 标签颜色来自统一内核思想定义
3. 标签可以点击
4. `/orientations/` 能看到全部 6 条内核思想
5. 每条内核思想显示说明和相关文章数量
6. 点击“边界”可以看到所有使用 `boundary` 的文章
7. 修改 `orientations.ts` 中的中文名、颜色或说明，所有页面自动同步
8. 无效 orientation code 在构建时能够被发现

# xiaoliulab-docs

site: https://docs.xiaoliulab.com

## 页面模式

可以通过页面 URL 的 `mode` 查询参数切换显示模式：

| 参数 | 说明 |
| --- | --- |
| 不传或 `mode=default` | 使用默认页面布局 |
| `mode=video` | 使用视频模式，隐藏导航、侧边栏、页脚和评论区 |

例如：

```text
http://localhost:28080/lab-tech-exploration/?mode=video
```

不支持的 `mode` 值会回退到默认模式。

# xiaoliulab-docs

这是小刘实验室的 VitePress 文档仓库。

## 通用规则

- 所有正式文章使用中文。
- 文章采用 Markdown 和 VitePress Frontmatter。
- 不夸大收益，不使用“稳赚”“必赚”等表达。
- 未经验证的结论必须明确标记为假设或待验证内容。
- 保持现有目录、路由和内部链接风格。
- 修改文章前，先阅读同目录相关文章。
- 编写或重写完整文章时，使用 `article-writing` Skill。


- 执行 `curl` 命令时要加参数 `--noproxy '*'`


## Git Commit and Push

- Use native git commands for commit and push operations.
- Do not use GitHub CLI or other wrappers for normal commit/push workflows unless explicitly requested.

### Commit Message Convention

Commit messages must start with one of the following prefixes:

- `feat`: add new features
- `fix`: fix bugs
- `opt`: optimize existing code or improve performance
- `refactor`: refactor code without changing behavior
- `docs`: update documentation

Commit messages must be written in English.

New commit types may be added in the future when needed.

## 文件名规范

以下规则适用于 `docs/` 下的内容文档和内容目录，不适用于 `.vitepress`、`public` 等站点配置或资源目录：

- 内容目录名：`^[a-z0-9_-]+$`
- Markdown 内容文件名：`^[a-z0-9_-]+\.md$`
- 路径中的 `/` 仅作为目录分隔符使用

## 更新日志

- 生成更新日志时，不要描述开发过程，要描述用户可感知的变化。
- 优先使用几个固定动词：
  - 新增
  - 上线
  - 完善
  - 优化
  - 修复

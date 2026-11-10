import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjector, definitionFile, validateProjects } from './lib/last-updated.mjs';

const OLD = '2026-01-01T00:00:00+08:00';
const NEW = '2026-02-01T00:00:00+08:00';
const NOW = Date.parse('2026-11-10T12:00:00+08:00');
const demo = 'https://cdn.jsdelivr.net/gh/valuetodays/supreme-octo-palm-tree/demo.zip';
const repository = fileURLToPath(new URL('../', import.meta.url));
let project;
before(async () => { project = await createProjector(repository.replaceAll(path.sep, '/')); });

function fixture() {
  const markdown = (title, body, extra = '') => '---\ntitle: ' + title + '\n' + extra + '---\n' + body;
  const metadata = 'articleMeta: false\nlastUpdated: ' + OLD + '\n';
  return new Map([
    ['docs/index.md', markdown('首页', '# 首页', 'layout: home\nlastUpdated: ' + OLD + '\n')],
    ['docs/core-principles/index.md', markdown('思想', '# 思想', metadata)],
    ['docs/demos/index.md', markdown('Demo', '# Demo', metadata)],
    ['docs/core-principles/[code].md', markdown('详情', '<CorePrincipleDetail />', 'articleMeta: false\n')],
    ['docs/article.md', markdown('文章甲', '# 记录\n记录内容', 'core-principles:\n  - a\n')],
    ['docs/program.md', markdown('程序', '说明\n[下载](' + demo + ')', 'articleMeta: false\n')],
    [definitionFile, "export const corePrinciples = [\n"
      + "{ code: 'a', name: '甲', color: '#aaa', description: '说明甲', lastUpdated: '" + OLD + "' },\n"
      + "{ code: 'b', name: '乙', color: '#bbb', description: '说明乙', lastUpdated: '" + OLD + "' }\n];"],
    ['docs/.vitepress/theme/components/CorePrincipleDetail.vue', '<template><h1>相关文章</h1></template>'],
    ['docs/.vitepress/theme/components/CorePrincipleIndex.vue', '<template><h1>思想</h1></template>'],
  ]);
}
const change = (files, file, from, to) => files.set(file, files.get(file).replace(from, to));
const check = (beforeFiles, afterFiles, options = {}) => validateProjects(project(beforeFiles), project(afterFiles), { now: NOW, ...options });

test('仅改正文且字数相同，不影响思想列表或首页统计', () => {
  const old = fixture(), next = fixture();
  change(next, 'docs/article.md', '记录内容', '修改内容');
  assert.deepEqual(check(old, next), []);
});

test('标题变化必须更新对应思想，更新时间后通过', () => {
  const old = fixture(), next = fixture();
  change(next, 'docs/article.md', '文章甲', '文章丙');
  assert.match(check(old, next).join('\n'), /\/core-principles\/a/);
  change(next, definitionFile, OLD, NEW);
  assert.deepEqual(check(old, next), []);
});

test('归属变化同时检查原思想、新思想及总览数量', () => {
  const old = fixture(), next = fixture();
  change(next, 'docs/article.md', '  - a', '  - b');
  const errors = check(old, next).join('\n');
  for (const url of ['/core-principles/a', '/core-principles/b', '/core-principles/ →']) assert.ok(errors.includes(url));
  next.set(definitionFile, next.get(definitionFile).replaceAll(OLD, NEW));
  change(next, 'docs/core-principles/index.md', OLD, NEW);
  assert.deepEqual(check(old, next), []);
});

test('删除文章会要求更新首页、思想总览和对应详情', () => {
  const old = fixture(), next = fixture();
  next.delete('docs/article.md');
  const errors = check(old, next).join('\n');
  assert.ok(errors.includes('/ → docs/index.md'));
  assert.ok(errors.includes('/core-principles/ →'));
  assert.ok(errors.includes('/core-principles/a'));
});

test('正文字数变化要求更新首页统计时间', () => {
  const old = fixture(), next = fixture();
  change(next, 'docs/article.md', '记录内容', '记录内容增加');
  assert.ok(check(old, next).some((error) => error.startsWith('/ →')));
  change(next, 'docs/index.md', OLD, NEW);
  assert.deepEqual(check(old, next), []);
});

for (const action of ['remove-link', 'rename-document', 'change-link']) {
  test('Demo 展示变化：' + action, () => {
    const old = fixture(), next = fixture();
    if (action === 'remove-link') change(next, 'docs/program.md', '[下载](' + demo + ')', '');
    if (action === 'change-link') change(next, 'docs/program.md', 'demo.zip', 'new.zip');
    if (action === 'rename-document') {
      next.set('docs/renamed.md', next.get('docs/program.md')); next.delete('docs/program.md');
    }
    assert.ok(check(old, next).some((error) => error.startsWith('/demos/')));
    change(next, 'docs/demos/index.md', OLD, NEW);
    assert.deepEqual(check(old, next), []);
  });
}

test('Demo 来源只改正文，不误报列表更新时间', () => {
  const old = fixture(), next = fixture();
  change(next, 'docs/program.md', '说明', '更完整的说明');
  assert.deepEqual(check(old, next), []);
});

test('共用详情模板变化检查全部详情，纯样式变化不要求刷新', () => {
  const old = fixture(), next = fixture();
  const component = 'docs/.vitepress/theme/components/CorePrincipleDetail.vue';
  change(next, component, '相关文章', '关联资料');
  const errors = check(old, next).join('\n');
  assert.ok(errors.includes('/core-principles/a') && errors.includes('/core-principles/b'));
  next.set(definitionFile, next.get(definitionFile).replaceAll(OLD, NEW));
  assert.deepEqual(check(old, next), []);
  const styled = fixture();
  styled.set(component, styled.get(component) + '<style>h1 { color: red; }</style>');
  assert.deepEqual(check(old, styled), []);
});

test('不可见注释及正文换行整理不要求刷新', () => {
  const old = fixture(), next = fixture();
  next.set('docs/core-principles/index.md', next.get('docs/core-principles/index.md') + '\n<!-- 维护说明 -->');
  change(next, 'docs/article.md', '记录内容', '记录\n内容');
  assert.deepEqual(check(old, next), []);
});

test('无关更新时间修改、时间倒退、未来日期、无效日期均被拒绝', () => {
  const old = fixture();
  for (const [value, message] of [
    [NEW, '展示内容未变化'], ['2025-01-01T00:00:00+08:00', '不能倒退'],
    ['2027-01-01T00:00:00+08:00', '未来时间'], ['2026-02-30T00:00:00+08:00', '无效'],
    ['2026-02-01T00:00:00', '时区'],
  ]) {
    const next = fixture();
    change(next, definitionFile, OLD, value);
    assert.ok(check(old, next).some((error) => error.includes(message)), value);
  }
});

test('Frontmatter 引号日期与普通文档显式日期被拒绝', () => {
  const old = fixture(), next = fixture();
  change(next, 'docs/index.md', OLD, "'" + OLD + "'");
  assert.ok(check(old, next).some((error) => error.includes('/ →')));
  const normal = fixture();
  change(normal, 'docs/article.md', 'title: 文章甲', 'title: 文章甲\nlastUpdated: ' + OLD);
  assert.ok(check(old, normal).some((error) => error.includes('普通文档应使用 Git 时间')));
});

test('首次补齐显式时间合法；范围校验允许中间修改后还原', () => {
  const old = fixture(), next = fixture();
  for (const file of ['docs/index.md', 'docs/demos/index.md', 'docs/core-principles/index.md']) {
    old.set(file, old.get(file).replace('lastUpdated: ' + OLD + '\n', ''));
  }
  old.set(definitionFile, old.get(definitionFile).replaceAll(", lastUpdated: '" + OLD + "'", ''));
  assert.deepEqual(check(old, next), []);
  const bumped = fixture(); change(bumped, definitionFile, OLD, NEW);
  assert.deepEqual(check(fixture(), bumped, { allowUnchangedTimestamp: true }), []);
});

test('思想说明变化检查该详情及总览，其他思想保持不变', () => {
  const old = fixture(), next = fixture();
  change(next, definitionFile, '说明甲', '新的说明甲');
  const errors = check(old, next);
  assert.equal(errors.length, 2);
  assert.ok(errors.some((error) => error.startsWith('/core-principles/a')));
  assert.ok(errors.some((error) => error.startsWith('/core-principles/ →')));
  change(next, definitionFile, OLD, NEW);
  change(next, 'docs/core-principles/index.md', OLD, NEW);
  assert.deepEqual(check(old, next), []);
});

test('新增思想需提供合法时间并维护总览；删除思想也检查总览', () => {
  const old = fixture(), next = fixture();
  change(next, definitionFile, '\n];', ",\n{ code: 'c', name: '丙', color: '#ccc', description: '说明丙', lastUpdated: '" + NEW + "' }\n];");
  assert.ok(check(old, next).some((error) => error.startsWith('/core-principles/ →')));
  change(next, 'docs/core-principles/index.md', OLD, NEW);
  assert.deepEqual(check(old, next), []);
  const removed = fixture();
  removed.set(definitionFile, removed.get(definitionFile).split('\n').filter((line) => !line.includes("code: 'a'")).join('\n'));
  assert.ok(check(old, removed).some((error) => error.startsWith('/core-principles/ →')));
});

test('允许修复旧版本的未来日期或无效日期', () => {
  for (const invalid of ['invalid', '2027-01-01T00:00:00+08:00']) {
    const old = fixture();
    change(old, definitionFile, OLD, invalid);
    assert.deepEqual(check(old, fixture()), []);
  }
});

test('Git 集成：hook 拦截遗漏，修正后放行，且只检查暂存区和指定版本', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'xiaoliulab-last-updated-test-'));
  const git = (args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const run = (args) => spawnSync(process.execPath, [path.join(repository, 'scripts/check-last-updated.mjs'), ...args], { cwd: directory, encoding: 'utf8' });
  try {
    git(['init', '-q']); git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@users.noreply.github.com']);
    for (const [file, source] of fixture()) {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      writeFileSync(path.join(directory, file), source);
    }
    git(['add', '.']); git(['commit', '-qm', 'docs: add fixture']);
    const base = git(['rev-parse', 'HEAD']);
    const article = path.join(directory, 'docs/article.md');
    writeFileSync(article, readFileSync(article, 'utf8').replace('文章甲', '文章丙'));
    git(['add', 'docs/article.md']);
    assert.equal(run(['--staged']).status, 1);
    const shellQuote = (value) => "'" + value.replaceAll('\\', '/').replaceAll("'", "'\\''") + "'";
    const hook = path.join(directory, '.git/hooks/pre-commit');
    writeFileSync(hook, '#!/bin/sh\nexec ' + shellQuote(process.execPath) + ' '
      + shellQuote(path.join(repository, 'scripts/check-last-updated.mjs')) + ' --staged\n');
    chmodSync(hook, 0o755);
    assert.throws(() => git(['hook', 'run', 'pre-commit']));
    const data = path.join(directory, definitionFile);
    writeFileSync(data, readFileSync(data, 'utf8').replace(OLD, NEW)); git(['add', definitionFile]);
    assert.equal(run(['--staged']).status, 0);
    assert.doesNotThrow(() => git(['hook', 'run', 'pre-commit']));
    // 工作区故意恢复旧值，暂存区保留正确新值。
    writeFileSync(data, readFileSync(data, 'utf8').replace(NEW, OLD));
    assert.equal(run(['--worktree']).status, 1); assert.equal(run(['--staged']).status, 0);
    git(['commit', '-qm', 'docs: update title and timestamp']);
    const head = git(['rev-parse', 'HEAD']);
    assert.equal(run(['--base', base, '--head', head, '--range']).status, 0);
    assert.equal(run(['--base', 'missing-ref', '--head', head]).status, 1);
    const pushHook = path.join(directory, '.git/hooks/pre-push');
    const pushTemplate = readFileSync(path.join(repository, '.githooks/pre-push'), 'utf8')
      .replace('node scripts/check-last-updated.mjs', shellQuote(process.execPath) + ' '
        + shellQuote(path.join(repository, 'scripts/check-last-updated.mjs')));
    writeFileSync(pushHook, pushTemplate.replaceAll('\r\n', '\n')); chmodSync(pushHook, 0o755);
    const push = (remote) => {
      const input = path.join(directory, '.git', 'last-updated-push-input');
      writeFileSync(input, 'refs/heads/dev ' + head + ' refs/heads/dev ' + remote + '\n');
      return spawnSync('git', ['hook', 'run', '--to-stdin=' + input, 'pre-push'], {
        cwd: directory, encoding: 'utf8',
      });
    };
    assert.equal(push(base).status, 0);
    assert.equal(push('missing-ref').status, 1);
  } finally {
    const safe = realpathSync(directory);
    if (path.dirname(safe) !== realpathSync(tmpdir())
      || !path.basename(safe).startsWith('xiaoliulab-last-updated-test-')) {
      throw new Error('拒绝清理非测试临时目录：' + safe);
    }
    rmSync(safe, { recursive: true, force: true });
  }
});

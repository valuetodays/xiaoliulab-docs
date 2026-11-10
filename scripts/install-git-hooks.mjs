import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const marker = '# xiaoliulab-docs lastUpdated hook';
const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const root = git(['rev-parse', '--show-toplevel']);
process.chdir(root);
let customPath = '';
try { customPath = git(['config', '--get', 'core.hooksPath']); } catch {}
if (customPath) throw new Error('已有 core.hooksPath，请先将本仓库 hook 合并到该位置：' + customPath);
const hookDirectory = path.resolve(root, git(['rev-parse', '--git-path', 'hooks']));
const hooks = ['pre-commit', 'pre-push'].map((name) => ({
  name, destination: path.join(hookDirectory, name),
  source: readFileSync(path.join(root, '.githooks', name), 'utf8').replaceAll('\r\n', '\n'),
}));
for (const hook of hooks) {
  if (existsSync(hook.destination) && !readFileSync(hook.destination, 'utf8').includes(marker)) {
    throw new Error('保留现有自定义 hook，未覆盖：' + hook.destination);
  }
}
mkdirSync(hookDirectory, { recursive: true });
for (const hook of hooks) {
  writeFileSync(hook.destination, hook.source);
  chmodSync(hook.destination, 0o755);
  console.log('已安装 ' + hook.name + ' → ' + hook.destination);
}

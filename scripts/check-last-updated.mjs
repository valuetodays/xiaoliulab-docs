import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createProjector, isSnapshotFile, validateProjects } from './lib/last-updated.mjs';

function git(args, options = {}) {
  return execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024, ...options });
}

function revisionFiles(revision) {
  if (revision === 'EMPTY') return new Map();
  const tree = git(['rev-parse', '--verify', '--end-of-options', revision + '^{tree}']).toString('utf8').trim();
  const output = git(['ls-tree', '-r', '-z', tree, '--', 'docs']).toString('utf8');
  return new Map(output.split('\0').filter(Boolean).flatMap((line) => {
    const [metadata, file] = line.split('\t');
    const [mode, type, hash] = metadata.split(' ');
    if (!isSnapshotFile(file)) return [];
    if (type !== 'blob' || mode === '120000') throw new Error('校验文件不支持符号链接：' + file);
    return [[file, hash]];
  }));
}

function stagedFiles() {
  const output = git(['ls-files', '--stage', '-z', '--', 'docs']).toString('utf8');
  return new Map(output.split('\0').filter(Boolean).flatMap((line) => {
    const [metadata, file] = line.split('\t');
    const [mode, hash, stage] = metadata.split(' ');
    if (!isSnapshotFile(file)) return [];
    if (stage !== '0') throw new Error('请先解决合并冲突：' + file);
    if (mode === '120000') throw new Error('校验文件不支持符号链接：' + file);
    return [[file, hash]];
  }));
}

function readBlobs(snapshots) {
  const hashes = [...new Set(snapshots.flatMap((files) => [...files.values()]))];
  if (!hashes.length) return new Map();
  const output = git(['cat-file', '--batch'], { input: hashes.join('\n') + '\n' });
  const result = new Map();
  let cursor = 0;
  for (const hash of hashes) {
    const end = output.indexOf(10, cursor);
    const [, type, sizeText] = output.subarray(cursor, end).toString().split(' ');
    if (type !== 'blob') throw new Error('无法读取 Git 对象：' + hash);
    const size = Number(sizeText);
    result.set(hash, output.subarray(end + 1, end + 1 + size).toString('utf8'));
    cursor = end + 1 + size + 1;
  }
  return result;
}

function worktreeFiles() {
  const files = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'docs'])
    .toString('utf8').split('\0').filter(isSnapshotFile);
  return new Map([...new Set(files)].sort().flatMap((file) => {
    try {
      if (lstatSync(file).isSymbolicLink()) throw new Error('校验文件不支持符号链接：' + file);
      return [[file, readFileSync(file, 'utf8')]];
    }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }));
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--staged' || arg === '--worktree' || arg === '--range') options[arg.slice(2)] = true;
    else if ((arg === '--base' || arg === '--head') && args[i + 1]) options[arg.slice(2)] = args[++i];
    else throw new Error('未知或不完整的参数：' + arg);
  }
  if (options.staged && (options.head || options.worktree)) throw new Error('--staged 不能与 --head/--worktree 同用');
  if (options.head && !options.base) throw new Error('--head 必须同时指定 --base');
  if (options.head && options.worktree) throw new Error('--head 不能与 --worktree 同用');
  if (options.range && !(options.base && options.head)) throw new Error('--range 必须指定 --base 和 --head');
  return options;
}

async function main() {
  const started = performance.now();
  const options = parseOptions(process.argv.slice(2));
  const root = git(['rev-parse', '--show-toplevel']).toString('utf8').trim();
  process.chdir(root);
  let base = options.base;
  if (!base) {
    try { base = git(['rev-parse', '--verify', '-q', 'HEAD'], { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim(); }
    catch (error) { if (error.status !== 1) throw error; base = 'EMPTY'; }
  }
  const oldFiles = revisionFiles(base);
  const nextFiles = options.head ? revisionFiles(options.head) : options.staged ? stagedFiles() : null;
  const blobs = readBlobs([oldFiles, ...(nextFiles ? [nextFiles] : [])]);
  const expand = (files) => new Map([...files].map(([file, hash]) => [file, blobs.get(hash)]));
  const previous = expand(oldFiles);
  const current = nextFiles ? expand(nextFiles) : worktreeFiles();
  if (previous.size === current.size && [...previous].every(([file, text]) => current.get(file) === text)) {
    console.log('lastUpdated 校验通过：本次没有相关内容变更。');
    return;
  }
  const project = await createProjector(root.replaceAll(path.sep, '/'));
  const errors = validateProjects(project(previous), project(current), {
    // 一次推送可能包含“修改后又还原”的多个有效提交；仅范围校验允许时间前进。
    allowUnchangedTimestamp: Boolean(options.range),
  });
  if (errors.length) {
    console.error('lastUpdated 校验失败：\n- ' + errors.join('\n- '));
    process.exitCode = 1;
    return;
  }
  console.log('lastUpdated 校验通过（' + ((performance.now() - started) / 1000).toFixed(2) + ' 秒）。');
}

main().catch((error) => {
  console.error('lastUpdated 校验无法完成：' + error.message);
  console.error('请确认依赖已安装、比较版本在本机可读；远程版本缺失时先执行 git fetch。');
  process.exitCode = 1;
});

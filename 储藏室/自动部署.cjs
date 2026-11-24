'use strict';

// 推送自动部署：把指定提交里的站点文件装进临时目录，交给 Trae 部署 CLI。
// 只发布「站点清单」里的文件；工作区里的日记、账本、测试不会被带上线。
// 推送钩子会在后台调用本脚本，日志写在 .git/zhouse-deploy.log。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const SITE_FILES = require('./站点清单.cjs');

const SITE_ID = process.env.ZHOUSE_SITE_ID || '37lfueqf85hi257wksm';
const SITE_URL = 'https://37lfueqf85hi257wksm.traesite.cn';
const APP_TAGS = '189,101,167,267';
const ROOT = path.resolve(__dirname, '..');
const refArg = process.argv.find(a => a.startsWith('--ref='));
const REF = refArg ? refArg.slice(6) : (process.env.ZHOUSE_DEPLOY_REF || 'HEAD');

let GIT_DIR = null;
let LOG = null;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT, encoding: 'utf8', windowsHide: true,
    maxBuffer: 64 * 1024 * 1024, ...opts,
  });
  if (r.error) throw r.error;
  return r;
}

function gitText(args) {
  const r = run('git', args);
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' 失败：' + (r.stderr || '').trim());
  return r.stdout.trim();
}

function gitDir() {
  if (!GIT_DIR) GIT_DIR = gitText(['rev-parse', '--absolute-git-dir']);
  return GIT_DIR;
}

function logFile() {
  if (!LOG) LOG = path.join(gitDir(), 'zhouse-deploy.log');
  return LOG;
}

function say(msg) {
  console.log(msg);
  try { fs.appendFileSync(logFile(), '[' + new Date().toISOString() + '] ' + msg + '\n'); } catch (e) {}
}

/* 一次 cat-file 读完整份清单：比逐文件 git show 快一个数量级。 */
function readBlobs(routes) {
  const input = routes.map(r => REF + ':' + r).join('\n') + '\n';
  const r = spawnSync('git', ['cat-file', '--batch'], {
    cwd: ROOT, input: Buffer.from(input, 'utf8'), windowsHide: true, maxBuffer: 128 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('git cat-file 失败：' + (r.stderr || '').toString().trim());
  const buf = r.stdout;
  const out = new Map();
  let pos = 0;
  for (const route of routes) {
    const nl = buf.indexOf(0x0a, pos);
    if (nl < 0) throw new Error('cat-file 输出截断：' + route);
    const header = buf.slice(pos, nl).toString('utf8').trim();
    pos = nl + 1;
    const parts = header.split(' ');
    if (parts.length < 3) throw new Error(REF + ' 里没有 ' + route + '，先把文件提交再推送。');
    const size = Number(parts[2]);
    if (!Number.isFinite(size)) throw new Error('cat-file 返回异常：' + header);
    out.set(route, buf.subarray(pos, pos + size));
    pos += size + 1;
  }
  return out;
}

/* 推送钩子拿不到 Trae 的运行时上下文；把稳定的项目号与登录存储路径存在 .git 里补齐。 */
function loadEnv() {
  const file = path.join(gitDir(), 'zhouse-deploy.env');
  try {
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (e) { /* 没有本机上下文文件时，仍允许用当前环境手动部署 */ }
  /* 这一项指向的是 IDE 登录票据，部署服务不认；有它反而 401，统一走全局存储。 */
  delete process.env.TRAE_DEPLOYMENT_TOKEN_PATH;
  if (!process.env.TRAE_CHAT_SESSION_ID) process.env.TRAE_CHAT_SESSION_ID = 'local-pre-push';
  if (!process.env.TRAE_LANE) process.env.TRAE_LANE = 'prod';
  if (!process.env.TRAE_REGION) process.env.TRAE_REGION = 'cn';
  if (!process.env.TRAE_USER_DATA_DIR) process.env.TRAE_USER_DATA_DIR = path.join(os.homedir(), '.trae-cn');
  if (!process.env.TRAE_GLOBAL_STORAGE_DIR) {
    const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    process.env.TRAE_GLOBAL_STORAGE_DIR = path.join(roaming, 'Trae CN', 'User', 'globalStorage');
  }
  if (!process.env.TRAE_JWT_TOKEN_PATH) process.env.TRAE_JWT_TOKEN_PATH = path.join(os.homedir(), '.trae-cn', 'trae-jwt-token');
}

function setup() {
  const project = process.env.TRAE_PROJECT_ID;
  if (!project) throw new Error('当前环境没有 TRAE_PROJECT_ID，无法生成部署上下文');
  const userData = process.env.TRAE_USER_DATA_DIR || path.join(os.homedir(), '.trae-cn');
  const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const globalStorage = process.env.TRAE_GLOBAL_STORAGE_DIR || path.join(roaming, 'Trae CN', 'User', 'globalStorage');
  const token = process.env.TRAE_JWT_TOKEN_PATH || path.join(os.homedir(), '.trae-cn', 'trae-jwt-token');
  const file = path.join(gitDir(), 'zhouse-deploy.env');
  const quote = v => '"' + String(v).replace(/"/g, '\\"') + '"';
  fs.writeFileSync(file, [
    '# 推送自动部署的本机上下文；只留在 .git，不进仓库。',
    '# 项目或登录账号换了，重跑：node 储藏室/自动部署.cjs --setup',
    'TRAE_PROJECT_ID=' + quote(project),
    'TRAE_CHAT_SESSION_ID="local-pre-push"',
    'TRAE_USER_DATA_DIR=' + quote(userData),
    'TRAE_GLOBAL_STORAGE_DIR=' + quote(globalStorage),
    'TRAE_JWT_TOKEN_PATH=' + quote(token),
    'TRAE_LANE=' + quote(process.env.TRAE_LANE || 'prod'),
    'TRAE_REGION=' + quote(process.env.TRAE_REGION || 'cn'),
    '',
  ].join('\n'));
  say('[自动部署] 已写入本机部署上下文：' + file);
  if (!fs.existsSync(token)) say('[自动部署] 提醒：登录票据文件暂不存在，先在 Trae 里登录后再推送。');
}

function locateCli() {
  if (process.env.TRAE_DEPLOY_CLI) return process.env.TRAE_DEPLOY_CLI;
  if (process.platform !== 'win32') throw new Error('自动部署目前只在 Windows 本机启用');
  const base = path.join(os.homedir(), '.trae-cn', 'plugins', 'trae-remote-official', 'deployment');
  const versions = fs.readdirSync(base, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const v of versions) {
    const exe = path.join(base, v, 'skills', 'deployment', 'bin', 'win32-x64', 'trae-deploy.exe');
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error('找不到 trae-deploy 部署工具，请确认部署插件已安装');
}

function callCli(cli, args, timeout = 90000) {
  const r = spawnSync(cli, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout });
  if (r.error) throw r.error;
  let json;
  try { json = JSON.parse((r.stdout || '').trim()); }
  catch { throw new Error('部署工具返回无法解析：' + (r.stdout || r.stderr || '').slice(0, 300)); }
  if (!json.ok) {
    const e = json.error || {};
    throw new Error('部署工具失败：' + (e.code || '') + ' ' + (e.message || ''));
  }
  return json.data;
}

function deploymentId(data) {
  return data?.deployment_id || data?.deployment?.deployment_id || '';
}

function prepare(sourceDir) {
  const publicDir = path.join(sourceDir, 'public');
  const routes = [];
  for (const [dir, names] of Object.entries(SITE_FILES)) {
    for (const name of names) routes.push(dir ? dir + '/' + name : name);
  }
  const blobs = readBlobs(routes);
  const files = [];
  for (const route of routes) {
    const content = blobs.get(route);
    const target = path.join(publicDir, route);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    files.push({ route, size: content.length });
  }
  const entry = blobs.get('我的家.html');
  fs.writeFileSync(path.join(publicDir, 'index.html'), entry);
  files.push({ route: 'index.html', size: entry.length });
  const bytes = files.reduce((n, f) => n + f.size, 0);
  if (files.length > 99) throw new Error('站点文件 ' + files.length + ' 个，超过静态站点 99 个上限');
  if (bytes > 50 * 1024 * 1024) throw new Error('站点超过 50 MiB，需要改用大静态路由');
  fs.writeFileSync(path.join(sourceDir, 'exec.json'), '{}');
  return { files, bytes };
}

/* 连续推送时排成一队，避免两个部署互相撞车。 */
function withLock(fn) {
  const lock = path.join(gitDir(), 'zhouse-deploy.lock');
  const started = Date.now();
  for (;;) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        const pid = Number(fs.readFileSync(lock, 'utf8').trim());
        let alive = false;
        try { process.kill(pid, 0); alive = true; }
        catch (err) { alive = err.code === 'EPERM'; }
        if (!alive || Date.now() - fs.statSync(lock).mtimeMs > 15 * 60 * 1000) {
          fs.unlinkSync(lock);
          continue;
        }
      } catch (e2) { /* 锁刚被前一个部署清掉 */ }
      if (Date.now() - started > 15 * 60 * 1000) throw new Error('等待上一个部署超过 15 分钟');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }
  try { return fn(); }
  finally { try { fs.unlinkSync(lock); } catch (e) {} }
}

function dryRun(head, short) {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhouse-deploy-'));
  try {
    const prepared = prepare(sourceDir);
    say('[自动部署] ' + short + ' · ' + prepared.files.length + ' 个文件 · ' + (prepared.bytes / 1024).toFixed(1) + ' KB');
    for (const f of prepared.files) console.log('  ' + f.route);
    say('[自动部署] 演练完成，没有上传。');
  } finally {
    fs.rmSync(sourceDir, { recursive: true, force: true });
  }
}

function deploy(head, short, subject, force) {
  const lastPath = path.join(gitDir(), 'zhouse-deploy.json');
  try {
    const last = JSON.parse(fs.readFileSync(lastPath, 'utf8'));
    if (!force && last.hash === head) {
      say('[自动部署] ' + short + (last.status === 'submitted' ? ' 已提交过，跳过。' : ' 已部署过，跳过。') + '要重发用 --force。');
      return;
    }
  } catch (e) { /* 第一次部署没有记录 */ }

  if (!process.env.TRAE_PROJECT_ID) {
    throw new Error('缺少 TRAE_PROJECT_ID：先在 Trae 里运行 node 储藏室/自动部署.cjs --setup');
  }

  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhouse-deploy-'));
  try {
    const prepared = prepare(sourceDir);
    say('[自动部署] ' + short + ' · ' + prepared.files.length + ' 个文件 · ' + (prepared.bytes / 1024).toFixed(1) + ' KB');

    const cli = locateCli();
    const site = callCli(cli, ['sites', 'get', '--site-id', SITE_ID]);
    const siteName = site?.display_name || site?.name || '';
    if (site?.deploy_target_id && site.deploy_target_id !== SITE_ID) throw new Error('站点 ID 核对失败');

    const created = callCli(cli, [
      'deployments', 'create',
      '--site-id', SITE_ID,
      '--title', ('Z 的小家 · ' + short).slice(0, 256),
      '--description', ('工作区静态站点「Z 的小家」，推送 ' + short + ' 自动部署：' + subject).slice(0, 2048),
      '--type', 'static-web',
      '--source-dir', sourceDir,
      '--execution-config', path.join(sourceDir, 'exec.json'),
      '--app-tags', APP_TAGS,
    ]);
    const depId = deploymentId(created);
    if (!depId) throw new Error('部署工具没有返回部署编号');
    if (process.argv.includes('--submit')) {
      fs.writeFileSync(lastPath, JSON.stringify({ hash: head, deployment_id: depId, at: new Date().toISOString(), status: 'submitted' }, null, 2));
      say('[自动部署] ' + short + ' 已提交 ' + depId + '，平台继续上线。');
      return;
    }
    say('[自动部署] 已提交 ' + depId + '，等待上线…');

    const waited = callCli(cli, ['deployments', 'wait', '--deployment-id', depId, '--timeout-seconds', '900'], 920000);
    const status = waited?.deployment?.status;
    if (status !== 9) throw new Error('部署未成功（状态 ' + status + '），可稍后查看 ' + depId);
    fs.writeFileSync(lastPath, JSON.stringify({ hash: head, deployment_id: depId, at: new Date().toISOString(), status: 'succeeded' }, null, 2));
    say('[自动部署] 上线成功：' + (siteName || 'Z 的小家') + ' · ' + SITE_URL);
    say('[自动部署] 部署编号：' + depId);
  } finally {
    fs.rmSync(sourceDir, { recursive: true, force: true });
  }
}

function main() {
  loadEnv();
  if (process.argv.includes('--setup')) { setup(); return; }
  const head = gitText(['rev-parse', REF]);
  const short = head.slice(0, 7);
  if (process.argv.includes('--dry-run')) { dryRun(head, short); return; }
  const subject = gitText(['log', '-1', '--format=%s', REF]).slice(0, 120);
  withLock(() => deploy(head, short, subject, process.argv.includes('--force')));
}

try { main(); }
catch (e) {
  say('[自动部署] ' + (e.message || e));
  process.exitCode = 1;
}

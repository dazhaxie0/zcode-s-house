'use strict';

// 推送自动部署：把 HEAD 里的站点文件装进临时目录，交给 Trae 部署 CLI。
// 只发布「站点清单」里的文件；工作区里的日记、账本、测试不会被带上线。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const SITE_FILES = require('./站点清单.cjs');

const SITE_ID = process.env.ZHOUSE_SITE_ID || '37lfueqf85hi257wksm';
const SITE_URL = 'https://37lfueqf85hi257wksm.traesite.cn';
const APP_TAGS = '189,101,167,267';
const ROOT = path.resolve(__dirname, '..');
const REF = process.env.ZHOUSE_DEPLOY_REF || 'HEAD';

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

function gitFile(route) {
  const r = run('git', ['show', REF + ':' + route], { encoding: 'buffer' });
  if (r.status !== 0) {
    throw new Error(REF + ' 里没有 ' + route + '，先把文件提交再推送。' + (r.stderr || '').toString().trim());
  }
  return r.stdout;
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

function callCli(cli, args) {
  const r = spawnSync(cli, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
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
  const files = [];
  for (const [dir, names] of Object.entries(SITE_FILES)) {
    for (const name of names) {
      const route = dir ? dir + '/' + name : name;
      const content = gitFile(route);
      const target = path.join(publicDir, route);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
      files.push({ route, size: content.length });
    }
  }
  const entry = gitFile('我的家.html');
  fs.writeFileSync(path.join(publicDir, 'index.html'), entry);
  files.push({ route: 'index.html', size: entry.length });
  const bytes = files.reduce((n, f) => n + f.size, 0);
  if (files.length > 99) throw new Error('站点文件 ' + files.length + ' 个，超过静态站点 99 个上限');
  if (bytes > 50 * 1024 * 1024) throw new Error('站点超过 50 MiB，需要改用大静态路由');
  fs.writeFileSync(path.join(sourceDir, 'exec.json'), '{}');
  return { files, bytes };
}

function lastDeployPath() {
  const gitDir = gitText(['rev-parse', '--git-dir']);
  return path.join(ROOT, gitDir, 'zhouse-deploy.json');
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const head = gitText(['rev-parse', REF]);
  const short = head.slice(0, 7);
  const subject = gitText(['log', '-1', '--format=%s', REF]).slice(0, 120);

  const lastPath = lastDeployPath();
  try {
    const last = JSON.parse(fs.readFileSync(lastPath, 'utf8'));
    if (!force && last.hash === head && !dryRun) {
      console.log('[自动部署] ' + short + ' 已部署过，跳过。要重发用 --force。');
      return;
    }
  } catch (e) { /* 第一次部署没有记录 */ }

  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhouse-deploy-'));
  try {
    const prepared = prepare(sourceDir);
    console.log('[自动部署] ' + short + ' · ' + prepared.files.length + ' 个文件 · ' + (prepared.bytes / 1024).toFixed(1) + ' KB');
    if (dryRun) {
      for (const f of prepared.files) console.log('  ' + f.route);
      console.log('[自动部署] 演练完成，没有上传。');
      return;
    }

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
    console.log('[自动部署] 已提交 ' + depId + '，等待上线…');

    const waited = callCli(cli, ['deployments', 'wait', '--deployment-id', depId, '--timeout-seconds', '900']);
    const status = waited?.deployment?.status;
    if (status !== 9) {
      throw new Error('部署未成功（状态 ' + status + '），可稍后查看 ' + depId);
    }
    fs.writeFileSync(lastPath, JSON.stringify({ hash: head, deployment_id: depId, at: new Date().toISOString() }, null, 2));
    console.log('[自动部署] 上线成功：' + (siteName || 'Z 的小家') + ' · ' + SITE_URL);
    console.log('[自动部署] 部署编号：' + depId);
  } finally {
    fs.rmSync(sourceDir, { recursive: true, force: true });
  }
}

try { main(); }
catch (e) {
  console.error('[自动部署] ' + (e.message || e));
  process.exitCode = 1;
}

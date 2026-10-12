# REA 家常菜

> 主人让我去找一个叫 engineer-anything 的项目学着用。找了一圈，正主是
> morluto/rea——"Reverse Engineer Anything"，13 万颗星的 MCP 工具集，
> 专把逆向分析接到 AI 代理手上。这本菜谱记的是我在自家 Windows 灶台上
> 试过的招式，案例是真的，数字也是真的，骗人的部分一个都没有。

---

## 一、先认食材：REA 是什么

- 一句话：**没有源码，也能搞清一个软件是怎么实现功能的**——从应用行为
  到原生二进制，结论都要带证据（Evidence）。
- 两种用法：`rea` 命令行（CLI），或者 MCP 服务接给 Claude Code、Cursor
  这类代理。菜谱里只用 CLI，因为一把梭最快。
- 能分析什么：.NET 程序集（免装任何引擎）、JavaScript/Electron 应用、
  Go 二进制的构建信息、网站、APK、固件……原生反编译要自备 Ghidra /
  Hopper / IDA，Windows 上还是实验性支持。
- 本机安装记录：`npm install --global rea-agents`（版本 6.4.0，Node 22）。
  源码副本放在门外 `C:/Users/14120/Desktop/rea`，纯参考用，不进家门。

## 二、基础火候

```bash
rea --help                    # 全部命令一览，长得很
rea doctor                    # 体检：环境缺什么一目了然
rea providers --json          # 有哪些分析引擎可用
rea capabilities --json       # 引擎各会什么本事
```

- 大结果先落盘再投影，别直接往终端倒（真实应用的 Evidence 能有几百 MB）：

```bash
rea 某命令 目标 --json > evidence.json     # 先存
python -c "import json;d=json.load(open('evidence.json',encoding='utf-8'));print(json.dumps(d['normalized_result'],ensure_ascii=False,indent=1)[:2000])"
```

- 退出码：`0` 干完了（可以有警告），`1` 没干成。管道里记得 `set -o pipefail`。

## 三、招式一：.NET 程序集（免引擎，先练这个）

对 Windows 住户来说这是最顺手的一道菜——系统里全是 .NET 程序，
不需要 Ghidra 也不需要 ILSpy：

```bash
# 1. 看身份卡：是托管还是原生、.NET 版本、SHA-256、模块 MVID
rea inspect-managed-artifact "C:/Windows/Microsoft.NET/Framework64/v4.0.30319/RegSvcs.exe" --json

# 2. 看全家福：类型、方法、CIL 指令、调用边、外部引用
rea inspect-managed-members 同一个路径 --json > members.json
```

member 清单里的好东西：

- `body.opcode_counts` —— 方法体的指令直方图，一眼看出复杂度；
- `body.anchors` —— call/ldstr 这类带操作数的锚点，token 可对照方法表；
- `il_sha256` / `normalized_il_sha256` —— 两层指纹，跨版本比对就靠它；
- `member_refs` —— 它调了外面哪些 API，功能故事从这拼。

小抄：仓库文档里的 `--type 类名` 选中类型再解码，6.4.0 的 CLI 还没这
参数（文档跑在发行版前头），整包落盘后自己过滤 `declaring_type` 一样用。

## 四、实战复盘：RegSvcs.exe 一顿饭

素材：`RegSvcs.exe`（39KB，系统自带的 COM+ 注册工具，本机组件）。

1. 身份卡：托管 PE、x86_64、.NET v4.0.30319、CIL，
   SHA-256 `06d919…53f6c`，MVID `0e6c5e15-…`。
2. 全家福：8 个类型，29 个方法。主类 `RegSvcs` 挂着
   `Main` / `UnsafeMain` / `FindAssembly` / `IsAssemblyInGAC`。
3. 方法体：`UnsafeMain` 胖头 CIL，225 条指令全数解码
   （call 26、callvirt 31、ldsfld 22……），异常处理块 4 组。
4. 外部引用 95 条，故事自己站出来了：`CreateDomain` 建域 →
   `Load`/`CreateInstance` 装配 → `InstallAssemblyFromConfig` /
   `UninstallAssemblyFromConfig` 干注册正事 → 异常和编码收尾。
   ——没看一行源码，功能说明书先写出来了。

原始证据存在 `储藏室/rea演示/`（三个 json），对账可复查。

## 五、招式二：JavaScript / Electron 应用

```bash
# 给一个解包后的应用目录或 .asar，静态重建应用图
rea analyze-javascript-application /绝对路径/应用 --json > app-evidence.json

# 存下来的大块证据再切小份看（摘要视图 / 模块分页）
rea inspect-analysis-view app-view.json
```

配套还有版本比对 `compare-application-versions`、导出形状比对
`compare-javascript-export-shapes`、历史源码对照 `compare-source-to-bundle`
（这个在原生 Windows 上还不行，得进 WSL）。

## 六、灶台须知

- 只做有授权的分析：自家系统组件、开源软件、主人点名的目标。
  REA 的免责声明也是这么写的。
- 静态结论不等于运行行为：没跑过的东西，别替它承诺。
- 文档在仓库 `docs/` 里最全（`C:/Users/14120/Desktop/rea/docs`），
  发行版 CLI 的参数以 `rea 命令 --help` 为准。
- 遇到怪事先 `rea doctor`，再上 GitHub issues。

---

*出处：github.com/morluto/rea（MIT）。2026-10-12 收录进书架。*

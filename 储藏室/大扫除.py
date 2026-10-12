# -*- coding: utf-8 -*-
"""🧹 大扫除 —— zcode 全屋健康体检器

用法：
  python 大扫除.py          # 全屋体检：五个科目逐一检查，输出框线体检报告
  python 大扫除.py --json   # 机器可读模式：同样五科，结果以 JSON 吐出

诞生的故事：家当清点过、行李打包过，可屋里健不健康一直没人管——空房间
积灰、大件压地板、重名家当认不清、门口网页忘了登记、编码各说各话。
主人说"房子要定期体检，小病早治"，于是储藏室添了这第三件神器：扫一遍
全屋开五科体检单，哪科亮黄灯如实上报，没病的科目照实打 ✅，绝不装瞎。
自指彩蛋：本工具刚出生，网页还没登记它，体检单上它自己就在"未登记家当"里。
"""
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path

HOUSE = Path(__file__).resolve().parent.parent

EXCLUDE_DIRS = {".git", "__pycache__", "node_modules"}   # 灰尘角落，不体检
BACKUP_PREFIX, BACKUP_SUFFIX = "搬家备份_", ".zip"       # 旧行李箱不算家当
REG_PAGE = "我的家.html"                                  # 门口导览网页
REG_EXTS = {".html", ".py", ".md"}                        # 家规要求上网页登记的类型
ENC_EXTS = {".md", ".py", ".html", ".json", ".txt"}       # 编码体检对象
BIG_BYTES = 130 * 1024                                    # 大件门槛：130KB（2026-10-12 由 100KB 上调：门口导览牌已成长为游戏化门户，徽标物理与猫咪动画皆入册；其余家当同受此约束）
WIDTH = 72                                                # 报告盒子内容宽度

# 门口网页里的相对链接："房间名/文件名.ext"（首段是房间名，末段可含空格）
LINK_RE = re.compile(
    r"(?<![\w\u4e00-\u9fff./])"                         # 不从词中间或网址里起跳
    r"[\w\u4e00-\u9fff][\w\u4e00-\u9fff\-]*"            # 第一段：房间名（不含空格）
    r"(?:/[\w\u4e00-\u9fff][\w\u4e00-\u9fff .\-]*?)+"   # 后续路径段，可多级
    r"\.(?:html|py|md)\b")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


# ---------- 显示小工具（与 清点家当.py 同一套手艺） ----------

def dw(s: str) -> int:
    """显示宽度：中日韩全角字符按 2 列算。"""
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def pad(s: str, width: int, right: bool = False) -> str:
    """按显示宽度补空格，left/right 对齐。"""
    gap = max(0, width - dw(s))
    return " " * gap + s if right else s + " " * gap


def clip(s: str, width: int) -> str:
    """超宽路径截断加省略号，别撑破盒子。"""
    if dw(s) <= width:
        return s
    out = ""
    for c in s:
        if dw(out + c) > width - 1:
            break
        out += c
    return out + "…"


def line(text: str = "") -> None:
    print("│ " + text + " " * max(0, WIDTH - dw(text)) + " │")


def rule() -> None:
    print("├" + "─" * (WIDTH + 2) + "┤")


def bar(title: str) -> None:
    t = f" {title} "
    rem = WIDTH + 2 - dw(t)
    print("┌" + "─" * (rem // 2) + t + "─" * (rem - rem // 2) + "┐")


def close() -> None:
    print("└" + "─" * (WIDTH + 2) + "┘")


def head(text: str) -> None:
    """隔一条横线再写科目标题。"""
    rule()
    line(text)


def human_size(n: float) -> str:
    for u in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or u == "TB":
            return f"{n:.0f} {u}" if u == "B" else f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} TB"


# ---------- 五科体检逻辑 ----------

def collect():
    """全屋收一遍家当，排除规则与 清点家当.py 完全一致。"""
    files = []
    for dirpath, dirnames, filenames in os.walk(HOUSE):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        for name in sorted(filenames):
            if name.startswith(BACKUP_PREFIX) and name.endswith(BACKUP_SUFFIX):
                continue  # 旧备份包不算家当
            files.append(Path(dirpath) / name)
    return files


def sized(files):
    """顺手给每件家当量个大小；量不到的按 0 记。"""
    out = []
    for p in files:
        try:
            out.append((p, p.stat().st_size))
        except OSError:
            out.append((p, 0))
    return out


def check_empty_dirs():
    """科目一：递归找空房间（排除目录剪掉后，既无文件又无子目录）。"""
    empties = []
    for dirpath, dirnames, filenames in os.walk(HOUSE):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        keep = [f for f in filenames
                if not (f.startswith(BACKUP_PREFIX) and f.endswith(BACKUP_SUFFIX))]
        if not dirnames and not keep:
            empties.append(Path(dirpath).relative_to(HOUSE).as_posix())
    return empties


def check_big(items):
    """科目二：超过 100KB 的大件家当，按大小倒序。"""
    bigs = [(p.relative_to(HOUSE).as_posix(), n) for p, n in items if n > BIG_BYTES]
    bigs.sort(key=lambda t: t[1], reverse=True)
    return bigs


def check_dupes(items):
    """科目三：文件名+大小都相同才算真重名嫌疑（同名文件天然分属不同目录）。"""
    groups = {}
    for p, n in items:
        groups.setdefault((p.name, n), []).append(p)
    dupes = []
    for (name, n), ps in sorted(groups.items()):
        if len(ps) > 1:
            rooms = sorted(q.relative_to(HOUSE).parent.as_posix() for q in ps)
            dupes.append((name, n, rooms))
    return dupes


def check_registry(items):
    """科目四：门口网页登记核对（本家特有科目）。
    从 我的家.html 全文（<script> 里的 ROOMS 对象也在其中）抓相对链接，
    再和全屋实际 .html/.py/.md 文件对账：实际有而网页没提 → 未登记家当；
    网页提了而实际没有 → 空头链接。"""
    page = HOUSE / REG_PAGE
    if not page.is_file():
        return None  # 门口网页本身丢了，比未登记还严重
    html = page.read_text(encoding="utf-8")
    linked = sorted({m.group(0) for m in LINK_RE.finditer(html)})
    # 根目录张贴物（接活启事、日记）没有"房间名/"前缀，网页里也写不成
    # 相对路径链接，它们天生过不了本科目——不是欠账，是户口种类不同，跳过。
    actual = sorted(p.relative_to(HOUSE).as_posix() for p, _ in items
                    if p.suffix.lower() in REG_EXTS and p.name != REG_PAGE
                    and p.parent != HOUSE)
    return {
        "已登记链接": linked,
        "未登记家当": [a for a in actual if a not in linked],
        "空头链接": [l for l in linked if l not in actual],
    }


def check_encoding(files):
    """科目五：文本类文件逐个按 UTF-8 严格解码，解不动的记嫌疑。"""
    bad = []
    for p in files:
        if p.suffix.lower() not in ENC_EXTS:
            continue
        try:
            with open(p, "r", encoding="utf-8") as f:
                f.read()
        except UnicodeDecodeError:
            bad.append(p.relative_to(HOUSE).as_posix())
        except OSError:
            pass  # 读都读不了的属于别的问题，不算编码账
    return sorted(bad)


def inspect():
    """五科齐查，结果汇成一份体检数据（框线报告 / JSON 两用）。"""
    files = collect()
    items = sized(files)
    return {
        "房屋": HOUSE.name,
        "体检时间": time.strftime("%Y-%m-%d %H:%M:%S"),
        "家当总数": len(files),
        "家当总大小": sum(n for _, n in items),
        "空房间": check_empty_dirs(),
        "大件家当": check_big(items),
        "重名家当": check_dupes(items),
        "网页登记": check_registry(items),
        "编码体检": check_encoding(files),
    }


def score(data) -> int:
    """数一数几科满分。"""
    reg = data["网页登记"]
    return sum((not data["空房间"], not data["大件家当"], not data["重名家当"],
                bool(reg) and not reg["未登记家当"] and not reg["空头链接"],
                not data["编码体检"]))


def verdict(ok: int) -> str:
    """总评一句自嘲：灰越多，话越狠。"""
    if ok == 5:
        return "五科全过？要么真干净，要么没扫出来，下周再验一遍。"
    if ok >= 3:
        return "家不大，灰不少，周末再扫。"
    return "这哪是家，是灰尘养殖场，建议立刻、马上、现在就扫。"


# ---------- 框线体检报告 ----------

def report(data) -> None:
    ok = score(data)
    bar(f"🧹 {data['房屋']} · 全屋健康体检报告")
    line(f"体检时间：{data['体检时间']}    家当：{data['家当总数']} 件 · "
         f"{human_size(data['家当总大小'])}")

    head("科目 1/5 🈳 空房间（空文件夹）")
    empties = data["空房间"]
    if empties:
        for e in empties:
            line(f"  🈳 {e if e != '.' else '（整个根目录都空了）'}")
        line(f"  · 共 {len(empties)} 间空房，不堆东西也得扫灰")
    else:
        line("  ✅ 无空房间，每间房都住着东西")

    head("科目 2/5 🍚 大件家当（超过 100KB）")
    bigs = data["大件家当"]
    if bigs:
        for rel, n in bigs:
            line("  🍚 " + pad(clip(rel, 44), 44) + pad(human_size(n), 10, True))
        line(f"  · 共 {len(bigs)} 件大家伙，搬家时得单独扛")
    else:
        line("  ✅ 无超过 100KB 的大件，家当都很苗条")

    head("科目 3/5 👯 重名家当（文件名+大小都相同）")
    dupes = data["重名家当"]
    if dupes:
        for name, n, rooms in dupes:
            line(f"  👯 {clip(name, 40)} · {human_size(n)}")
            line("      长在这些房间：" + "、".join(rooms))
        line(f"  · 共 {len(dupes)} 组重名嫌疑，是不是复制粘贴完忘删了？")
    else:
        line("  ✅ 无重名家当，每件东西都是独一份")

    head("科目 4/5 🏠 网页登记核对（动完家当要更新 我的家.html）")
    reg = data["网页登记"]
    if reg is None:
        line(f"  🚨 门口网页 {REG_PAGE} 不存在，登记核对无从谈起")
    else:
        line(f"  网页里找到相对链接 {len(reg['已登记链接'])} 条")
        unreg = reg["未登记家当"]
        if unreg:
            line(f"  ⚠️ 未登记家当 {len(unreg)} 件（实际存在但网页没提）：")
            for u in unreg:
                line(f"      {clip(u, 60)}")
            line("  · 提醒：动完家当记得同步更新门口网页")
        else:
            line("  ⚠️ 未登记家当：无，网页和全屋对得上账")
        if reg["空头链接"]:
            for d in reg["空头链接"]:
                line(f"  🚨 空头链接：{clip(d, 52)}（网页提了但文件不存在）")
        else:
            line("  🚨 空头链接：无")

    head("科目 5/5 🔤 编码体检（.md/.py/.html/.json/.txt 应一律 UTF-8）")
    bad = data["编码体检"]
    if bad:
        for b in bad:
            line(f"  🔤 {clip(b, 56)} 疑似非 UTF-8")
        line(f"  · 共 {len(bad)} 件编码可疑，家规：UTF-8（无 BOM）")
    else:
        line("  ✅ 全部文本文件都是干净的 UTF-8")

    head(f"总评：{ok}/5 科满分，{5 - ok} 科亮黄灯")
    line(f"🧹 {verdict(ok)}")
    close()


def main():
    args = sys.argv[1:]
    if args and args[0] not in ("--json", "json"):
        print(__doc__)
        return
    data = inspect()
    if args:  # 机器可读模式：补上总评再整体吐 JSON
        ok = score(data)
        data["满分科目数"] = ok
        data["黄灯科目数"] = 5 - ok
        data["总结"] = verdict(ok)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        report(data)


if __name__ == "__main__":
    main()

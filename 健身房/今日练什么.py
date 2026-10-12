#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
今日练什么 —— 健身房版选择困难症救星（厨房「今天吃什么」的同门师弟）。

用法：
    python 今日练什么.py        随机抽一张今日课表（课表名 + 感想 + 动作清单）
    python 今日练什么.py 换     换一张，排除上一次抽到的那张
    python 今日练什么.py 清单   列出全部课表（序号 + 课表名 + 一句话感想）
    （"清单"也认别名"列课表"）

课表来源：本脚本同目录下的 课表/ 文件夹里的所有 .md 文件。
上次的抽取结果存在 健身房/.上次练什么.txt，用于"换"时排除。
只用标准库，不联网，不用办卡。
"""

import random
import re
import sys
from pathlib import Path

# Windows 控制台默认 GBK，先把 stdout 掰成 UTF-8，中文才不乱码
sys.stdout.reconfigure(encoding="utf-8")

GYM_DIR = Path(__file__).resolve().parent
PLAN_DIR = GYM_DIR / "课表"
STATE_FILE = GYM_DIR / ".上次练什么.txt"

# 万一某张课表没写"一句话感想"，就用这些通用俏皮话兜底（只说态度，不编动作）
FALLBACK_LINES = [
    "今天就是它了，热身服都替你想好了。",
    "抽到哪张练哪张，纠结的力气留给正课。",
    "练总比不练强，这张尤其强。",
    "别看了，垫子已经铺好了。",
    "命运的力量架给你上好了片，就等你上手。",
]


# ---------- 课表读取 ----------

def load_plan_files():
    """返回课表目录下所有 .md 文件的列表；目录不存在返回 None。"""
    if not PLAN_DIR.exists():
        return None
    return sorted(p for p in PLAN_DIR.glob("*.md") if p.is_file())


def read_text(path):
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="gbk", errors="replace")


# ---------- 课表内容解析 ----------

def extract_title(text, fallback):
    """取 md 一级标题当课表名，取不到就用文件名。"""
    m = re.search(r"^#\s+(.+?)\s*$", text, flags=re.MULTILINE)
    return m.group(1).strip() if m else fallback


def extract_feeling(text):
    """取"> ## 一句话感想"下面那句引用，给推荐语用。"""
    m = re.search(r"^>\s*##\s*一句话感想\s*$([^#]*)", text, flags=re.MULTILINE)
    if not m:
        return None
    for line in m.group(1).splitlines():
        line = line.strip().lstrip(">").strip()
        if line:
            return line
    return None


def _is_separator_row(cells):
    """判断表格行是不是 |---|---| 这种分隔行。"""
    non_empty = [c for c in cells if c]
    if not non_empty:
        return True
    return all(re.fullmatch(r":?-{2,}:?", c) for c in non_empty)


def parse_moves(text):
    """
    解析 markdown 表格里的动作列，按小节（## 标题）分组返回。
    成功 -> [("热身", [(动作, 组数), ...]), ...]
    有表格但认不出表头 -> 整行列出（保真，不编造）
    连表格都没有 -> 返回 None
    """
    sections = []
    cur_name, cur_rows = None, []
    rows = []

    for raw in text.splitlines():
        line = raw.strip()
        m = re.match(r"^##\s+(.+?)\s*$", line)
        if m and "一句话感想" not in line:
            if cur_rows or cur_name:
                sections.append((cur_name, rows))
            cur_name, rows = m.group(1), []
            continue
        if line.startswith("|") and line.endswith("|") and len(line) > 2:
            cells = [c.strip() for c in line[1:-1].split("|")]
            rows.append(cells)
    if cur_rows or cur_name or rows:
        sections.append((cur_name, rows))

    out = []
    for name, rows in sections:
        data = [r for r in rows if not _is_separator_row(r)]
        if not data:
            continue
        header, body = data[0], data[1:]
        if not body:
            continue
        move_idx = sets_idx = None
        for i, cell in enumerate(header):
            if any(k in cell for k in ("动作", "项目", "练习")) and move_idx is None:
                move_idx = i
            elif any(k in cell for k in ("组数", "次数", "计划")) and sets_idx is None:
                sets_idx = i
        moves = []
        if move_idx is not None:
            for r in body:
                if len(r) > move_idx and r[move_idx]:
                    sets = r[sets_idx] if sets_idx is not None and len(r) > sets_idx else ""
                    moves.append((r[move_idx], sets))
        else:
            for r in body:
                joined = " | ".join(c for c in r if c)
                if joined:
                    moves.append((joined, ""))
        if moves:
            out.append((name or "课表", moves))
    return out or None


# ---------- 状态（记住上次练了啥） ----------

def read_last():
    try:
        name = STATE_FILE.read_text(encoding="utf-8").strip()
        return name or None
    except OSError:
        return None


def write_last(plan_file):
    try:
        STATE_FILE.write_text(plan_file.name, encoding="utf-8")
    except OSError:
        pass  # 记不住就算了，下次抽到同一张也不亏


# ---------- 输出 ----------

def print_plan(plan_file, note=None):
    text = read_text(plan_file)
    title = extract_title(text, plan_file.stem)
    feeling = extract_feeling(text)
    pitch = feeling or random.choice(FALLBACK_LINES)

    line = "=" * 46
    print()
    print(line)
    print("  今天的课表是：《%s》" % title)
    print(line)
    if note:
        print("  %s" % note)
    print()
    print('  推荐语："%s"' % pitch)
    print()

    sections = parse_moves(text)
    if sections:
        for sec_name, moves in sections:
            print("  [%s]" % sec_name)
            for i, (mv, sets) in enumerate(moves, 1):
                entry = mv if not sets else "%s  %s" % (mv, sets)
                print("   %2d. %s" % (i, entry))
            print()
    else:
        print("  这张课表里没认出动作表，")
        print("  请翻开文件自己看一眼：%s" % plan_file.name)
        print()
    print("  练不动？运行: python 今日练什么.py 换")
    print()


def print_inventory(files):
    """列课表：每张一行序号一行感想，末尾报个总数。"""
    line = "=" * 46
    print()
    print(line)
    print("  健身房现在有的课表，都在这儿了：")
    print(line)
    print()
    for i, plan_file in enumerate(files, 1):
        text = read_text(plan_file)
        title = extract_title(text, plan_file.stem)
        feeling = extract_feeling(text)
        print("  %2d. %s" % (i, title))
        print("      %s" % (feeling or "—"))
    print()
    print("  合计 %d 张。拿不定主意就运行: python 今日练什么.py" % len(files))
    print()


def main():
    args = [a for a in sys.argv[1:] if a]
    if args and args[0] in ("清单", "列课表"):
        files = load_plan_files()
        if files is None:
            print("哎呀，健身房里连'课表'文件夹都没有，练了个寂寞。")
            print("请先创建：%s" % PLAN_DIR)
            return
        if not files:
            print("课表文件夹是空的，今天只能练深呼吸了。")
            print("去放几张 .md 课表进来吧：%s" % PLAN_DIR)
            return
        print_inventory(files)
        return

    if args and args[0] not in ("换", "换一张", "换一课"):
        print("看不懂指令：%r" % args[0])
        print("用法：python 今日练什么.py        随机抽课表")
        print("      python 今日练什么.py 换     换一张")
        print("      python 今日练什么.py 清单   列出全部课表")
        return

    want_change = bool(args)
    files = load_plan_files()

    if files is None:
        print("哎呀，健身房里连'课表'文件夹都没有，练了个寂寞。")
        print("请先创建：%s" % PLAN_DIR)
        return
    if not files:
        print("课表文件夹是空的，今天只能练深呼吸了。")
        print("去放几张 .md 课表进来吧：%s" % PLAN_DIR)
        return

    last_name = read_last()
    note = None

    if want_change and last_name:
        candidates = [f for f in files if f.name != last_name]
        if not candidates:
            picked = files[0]
            note = "健身房就这一张课表，换了个寂寞——还是它。"
        else:
            picked = random.choice(candidates)
    else:
        if want_change:
            note = "没找到上次的记录，那就当全新一练来抽。"
        picked = random.choice(files)

    write_last(picked)
    print_plan(picked, note)


if __name__ == "__main__":
    main()

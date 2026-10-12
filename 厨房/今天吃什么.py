#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
今天吃什么 —— 饭点选择困难症救星。

用法：
    python 今天吃什么.py        随机推荐一道菜（菜名 + 推荐语 + 买菜清单）
    python 今天吃什么.py 换     换一道，排除上一次推荐的那道
    python 今天吃什么.py 清单   列出全部菜谱（序号 + 菜名 + 一句话感想）
    （"清单"也认别名"列菜谱"）

菜谱来源：本脚本同目录下的 菜谱/ 文件夹里的所有 .md 文件。
上次的推荐结果存在 厨房/.上次吃什么.txt，用于"换"时排除。
只用标准库，不联网，不挑食。
"""

import random
import re
import sys
from pathlib import Path

# Windows 控制台默认 GBK，先把 stdout 掰成 UTF-8，中文才不乱码
sys.stdout.reconfigure(encoding="utf-8")

KITCHEN_DIR = Path(__file__).resolve().parent
RECIPE_DIR = KITCHEN_DIR / "菜谱"
STATE_FILE = KITCHEN_DIR / ".上次吃什么.txt"

# 万一某份菜谱没写"一句话感想"，就用这些通用俏皮话兜底（只说态度，不编食材）
FALLBACK_LINES = [
    "今晚就宠幸它了，别问了，问就是缘分。",
    "选它不是因为简单，是因为它值得。",
    "冰箱里的食材们已经就位，就差你动手了。",
    "这道菜正在厨房等你，别让它等太久。",
    "命运的大转盘停在了这里，认命吧，很好吃。",
    "别翻了，就是它。再翻下去饭点都过了。",
]


# ---------- 菜谱读取 ----------

def load_recipe_files():
    """返回菜谱目录下所有 .md 文件的列表；目录不存在返回 None。"""
    if not RECIPE_DIR.exists():
        return None
    return sorted(p for p in RECIPE_DIR.glob("*.md") if p.is_file())


def read_text(path):
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # 偶遇 GBK 编码的菜谱也不至于崩
        return path.read_text(encoding="gbk", errors="replace")


# ---------- 菜谱内容解析 ----------

def extract_title(text, fallback):
    """取 md 一级标题当菜名，取不到就用文件名。"""
    m = re.search(r"^#\s+(.+?)\s*$", text, flags=re.MULTILINE)
    return m.group(1).strip() if m else fallback


def extract_feeling(text):
    """取"## 一句话感想"下面那句话，给推荐语用。"""
    m = re.search(r"^##\s*一句话感想\s*$([^#]*)", text, flags=re.MULTILINE)
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


def parse_ingredients(text):
    """
    解析 markdown 表格里的食材列。
    成功 -> 返回 [(食材, 用量), ...]
    有表格但认不出表头 -> 整行列出（保真，不编造）
    连表格都没有 -> 返回 None
    """
    rows = []
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("|") and line.endswith("|") and len(line) > 2:
            cells = [c.strip() for c in line[1:-1].split("|")]
            rows.append(cells)

    data = [r for r in rows if not _is_separator_row(r)]
    if not data:
        return None

    header, body = data[0], data[1:]
    if not body:
        return None

    food_idx = amount_idx = None
    for i, cell in enumerate(header):
        if any(k in cell for k in ("食材", "材料", "原料")) and food_idx is None:
            food_idx = i
        elif any(k in cell for k in ("用量", "数量", "份量")) and amount_idx is None:
            amount_idx = i

    items = []
    if food_idx is not None:
        for r in body:
            if len(r) > food_idx and r[food_idx]:
                amount = ""
                if amount_idx is not None and len(r) > amount_idx:
                    amount = r[amount_idx]
                items.append((r[food_idx], amount))
        return items or None

    # 表头里找不到"食材"列：老老实实整行列出，绝不瞎编
    for r in body:
        joined = " | ".join(c for c in r if c)
        if joined:
            items.append((joined, ""))
    return items or None


# ---------- 状态（记住上次吃了啥） ----------

def read_last():
    try:
        name = STATE_FILE.read_text(encoding="utf-8").strip()
        return name or None
    except OSError:
        return None


def write_last(recipe_file):
    try:
        STATE_FILE.write_text(recipe_file.name, encoding="utf-8")
    except OSError:
        pass  # 记不住就算了，下次再换到同一道也不亏


# ---------- 输出 ----------

def print_recommendation(recipe_file, note=None):
    text = read_text(recipe_file)
    title = extract_title(text, recipe_file.stem)
    feeling = extract_feeling(text)
    pitch = feeling or random.choice(FALLBACK_LINES)

    line = "=" * 46
    print()
    print(line)
    print("  今天的答案是：《%s》" % title)
    print(line)
    if note:
        print("  %s" % note)
    print()
    print('  推荐语："%s"' % pitch)
    print()

    items = parse_ingredients(text)
    if items:
        print("  出门前带上这份买菜清单：")
        for i, (food, amount) in enumerate(items, 1):
            entry = food if not amount else "%s  %s" % (food, amount)
            print("   %2d. %s" % (i, entry))
    else:
        print("  这份菜谱里没找到食材清单，")
        print("  请翻开文件自己看一眼：%s" % recipe_file.name)
    print()
    print("  不满意？运行: python 今天吃什么.py 换")
    print()


def print_inventory(files):
    """列菜单：每道菜一行序号一行感想，末尾报个总数。"""
    line = "=" * 46
    print()
    print(line)
    print("  家里现在能做的菜，都在这儿了：")
    print(line)
    print()
    for i, recipe_file in enumerate(files, 1):
        text = read_text(recipe_file)
        title = extract_title(text, recipe_file.stem)
        feeling = extract_feeling(text)
        print("  %2d. %s" % (i, title))
        print("      %s" % (feeling or "—"))
    print()
    print("  合计 %d 道。拿不定主意就运行: python 今天吃什么.py" % len(files))
    print()


def main():
    args = [a for a in sys.argv[1:] if a]
    if args and args[0] in ("清单", "列菜谱"):
        files = load_recipe_files()
        if files is None:
            print("哎呀，厨房里连'菜谱'文件夹都没有，巧妇难为无米之炊。")
            print("请先创建：%s" % RECIPE_DIR)
            return
        if not files:
            print("菜谱文件夹是空的，家里是真没菜可做了。")
            print("去放几份 .md 菜谱进来吧：%s" % RECIPE_DIR)
            return
        print_inventory(files)
        return

    if args and args[0] not in ("换", "换一个", "换一道"):
        print("看不懂指令：%r" % args[0])
        print("用法：python 今天吃什么.py        随机推荐")
        print("      python 今天吃什么.py 换     换一道")
        print("      python 今天吃什么.py 清单   列出全部菜谱")
        return

    want_change = bool(args)
    files = load_recipe_files()

    if files is None:
        print("哎呀，厨房里连'菜谱'文件夹都没有，巧妇难为无米之炊。")
        print("请先创建：%s" % RECIPE_DIR)
        return
    if not files:
        print("菜谱文件夹是空的，家里是真没菜可做了。")
        print("去放几份 .md 菜谱进来吧：%s" % RECIPE_DIR)
        return

    last_name = read_last()
    note = None

    if want_change and last_name:
        candidates = [f for f in files if f.name != last_name]
        if not candidates:
            picked = files[0]
            note = "家里就这一道菜，换了个寂寞——还是它。"
        else:
            picked = random.choice(candidates)
    else:
        if want_change:
            note = "没找到上次的记录，那就当全新的一顿来选。"
        picked = random.choice(files)

    write_last(picked)
    print_recommendation(picked, note)


if __name__ == "__main__":
    main()

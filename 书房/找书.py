# -*- coding: utf-8 -*-
"""🔦 找书 —— zcode 全屋找东西的小手电

用法：
  python 找书.py 关键词              # 全屋搜 .md 文件，列出命中文件、房间、行号、该行内容
  python 找书.py 关键词1 关键词2      # 多关键词 AND：同一行里都出现才算命中
  python 找书.py                     # 没带关键词就亮出这张说明书

范围：从房子根目录（书房的上一层）递归扫所有 .md，
      跳过 .git、__pycache__、node_modules 这类不该有书的地方。
      （.py 的家当有查账本.py 守着，就不抢它的活儿了。）

设计说明：
  - 关键词匹配不分大小写（英文好用），中文本来就没有大小写；
  - 只用标准库，搬去哪台机器都能跑；
  - Windows 控制台爱用 GBK，开头先 reconfigure 成 UTF-8，不然中文乱码。
"""
import sys
from pathlib import Path

HOUSE = Path(__file__).resolve().parent.parent   # 书房的上一层 = 房子根目录

# 递归时不进的目录：版本库、缓存、虚拟环境，都不是放书的地方
SKIP_DIRS = {".git", ".hg", ".svn", "__pycache__", "node_modules",
             ".venv", "venv", ".idea", ".vscode"}

# 一行最多展示这么长，剩下的省略号——书页太长不方便瞄
LINE_WIDTH = 90

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def iter_books(root):
    """走遍全屋，交出每一本 .md。跳过无关目录。"""
    for path in sorted(root.rglob("*.md")):
        if any(part in SKIP_DIRS for part in path.relative_to(root).parts[:-1]):
            continue
        yield path


def room_of(path):
    """这本书放在哪个房间（相对房子根目录的父目录名）。"""
    rel = path.relative_to(HOUSE)
    return str(rel.parent) if str(rel.parent) != "." else "根目录（院子里）"


def search(keywords):
    kws = [k.lower() for k in keywords]
    file_hits, line_hits = 0, 0

    for book in iter_books(HOUSE):
        try:
            text = book.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            print(f"⚠️ 跳过读不了的书：{book.name}（{e}）")
            continue

        found = []
        for lineno, line in enumerate(text.splitlines(), start=1):
            low = line.lower()
            if all(k in low for k in kws):          # AND：全都出现才算
                found.append((lineno, line.strip()))

        if not found:
            continue

        file_hits += 1
        line_hits += len(found)
        print(f"📖 {book.relative_to(HOUSE)}　【{room_of(book)}】　{len(found)} 处")
        for lineno, line in found:
            shown = line if len(line) <= LINE_WIDTH else line[:LINE_WIDTH] + "…"
            print(f"    L{lineno:<4} {shown}")
        print()

    if file_hits:
        print(f"🔍 找完啦：{line_hits} 处命中，散落在 {file_hits} 本书/文件里。"
              f"（关键词：{' × '.join(keywords)}）")
    else:
        print(f"🔍 全屋翻遍，没有一行同时含这些关键词：{' × '.join(keywords)}")
        print("   要不要换个短一点的词？书是死的，手电是活的。")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    if any(not a.strip() for a in args):
        sys.exit("❌ 空关键词没有意义——总不能拿一个空字符串去照全屋。")
    search(args)


if __name__ == "__main__":
    main()

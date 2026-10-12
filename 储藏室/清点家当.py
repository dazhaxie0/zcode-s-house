# -*- coding: utf-8 -*-
"""📦 清点家当 —— zcode 全屋资产盘点器

用法：
  python 清点家当.py             # 全屋盘点：按房间列出文件名、大小、修改时间
  python 清点家当.py --detail    # 详情模式：额外统计每个文本文件的行数
  python 清点家当.py 详情        # 同上，中文别名

诞生的故事：搬进来才几天，东西已经散落各个房间，
哪屋放了啥、多大、多久没碰过，靠 AI 的脑子硬记迟早乱套。
主人说"家当要心里有数"，于是储藏室添了这第一件神器——
扫一遍全屋，每件家当都上户口；空房间也如实登记，绝不装瞎。
旧的搬家备份包和缓存目录不算家当，盘点时直接跳过。
"""
import os
import sys
import time
import unicodedata
from collections import Counter
from pathlib import Path

HOUSE = Path(__file__).resolve().parent.parent

EXCLUDE_DIRS = {".git", "__pycache__", "node_modules"}   # 灰尘角落，不算家当
BACKUP_PREFIX, BACKUP_SUFFIX = "搬家备份_", ".zip"       # 旧行李箱不重复盘点
TEXT_EXTS = {".md", ".py", ".html", ".json", ".txt", ".css", ".js",
             ".yaml", ".yml", ".toml", ".ini", ".cfg", ".xml", ".csv"}
STAT_EXTS = (".md", ".py", ".html", ".json")             # 合计里单独报数的四类

WIDTH = 72  # 盒子内容宽度（显示宽度）

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


# ---------- 显示小工具 ----------

def dw(s: str) -> int:
    """显示宽度：中日韩全角字符按 2 列算。"""
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def pad(s: str, width: int, right: bool = False) -> str:
    """按显示宽度补空格，left/right 对齐。"""
    gap = max(0, width - dw(s))
    return " " * gap + s if right else s + " " * gap


def clip(s: str, width: int) -> str:
    """超宽文件名截断加省略号，别撑破盒子。"""
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


def human_size(n: float) -> str:
    for u in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or u == "TB":
            return f"{n:.0f} {u}" if u == "B" else f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} TB"


# ---------- 盘点逻辑 ----------

def gather():
    """全屋扫一遍，按房间分组。返回 (根目录散件, {房间名: [文件]})。
    空房间也要登记在册——家具可以没有，户口必须有。"""
    root_files = sorted((p for p in HOUSE.iterdir()
                         if p.is_file()
                         and not (p.name.startswith(BACKUP_PREFIX)
                                  and p.name.endswith(BACKUP_SUFFIX))),
                        key=lambda p: p.name)
    rooms = {d.name: [] for d in HOUSE.iterdir()
             if d.is_dir() and d.name not in EXCLUDE_DIRS}
    for dirpath, dirnames, filenames in os.walk(HOUSE):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        for name in filenames:
            if name.startswith(BACKUP_PREFIX) and name.endswith(BACKUP_SUFFIX):
                continue  # 旧备份包不算家当
            p = Path(dirpath) / name
            rel = p.relative_to(HOUSE)
            if len(rel.parts) > 1:
                rooms.setdefault(rel.parts[0], []).append(p)
    for v in rooms.values():
        v.sort(key=lambda p: p.relative_to(HOUSE).as_posix())
    return root_files, dict(sorted(rooms.items()))


def count_lines(p: Path):
    """文本文件数行数（按字节行统计，不挑编码）；非文本返回 None。"""
    if p.suffix.lower() not in TEXT_EXTS:
        return None
    try:
        with open(p, "rb") as f:
            return sum(1 for _ in f)
    except OSError:
        return None


def file_row(p: Path, detail: bool) -> str:
    st = p.stat()
    mtime = time.strftime("%Y-%m-%d %H:%M", time.localtime(st.st_mtime))
    disp = p.name if p.parent == HOUSE else "/".join(p.relative_to(HOUSE).parts[1:])
    size_h = human_size(st.st_size)
    if not detail:
        return ("  " + pad(clip(disp, 36), 36) + pad(size_h, 10, True)
                + "  " + mtime)
    n = count_lines(p)
    ln = pad(f"{n} 行" if n is not None else "-", 7, True)
    return ("  " + pad(clip(disp, 32), 32) + pad(size_h, 9, True)
            + "  " + ln + "  " + mtime)


def report(detail: bool) -> None:
    root_files, rooms = gather()
    all_files = root_files + [p for v in rooms.values() for p in v]
    total_size = sum(p.stat().st_size for p in all_files)
    cnt = Counter(p.suffix.lower() for p in all_files)

    bar(f"📦 {HOUSE.name} · 全屋资产盘点")
    line(f"盘点时间：{time.strftime('%Y-%m-%d %H:%M:%S')}"
         f"    模式：{'详情（含行数）' if detail else '简明清单'}")

    # 根目录散件
    rule()
    line(f"🚪 根目录（门口随手放的）")
    if root_files:
        for p in root_files:
            line(file_row(p, detail))
        line(f"  · 小计：{len(root_files)} 件 · {human_size(sum(p.stat().st_size for p in root_files))}")
    else:
        line("  🈳 空空如也")

    # 各房间
    for room, files in rooms.items():
        rule()
        line(f"🗂 {room}")
        if not files:
            line("  🈳 空空如也")
            continue
        for p in files:
            line(file_row(p, detail))
        line(f"  · 小计：{len(files)} 件 · {human_size(sum(p.stat().st_size for p in files))}")

    # 全屋合计
    rule()
    line("🏷 按类型：" + " · ".join(f"{e} × {cnt.get(e, 0)}" for e in STAT_EXTS))
    line(f"🧮 全屋合计：{len(all_files)} 件文件 · {human_size(total_size)}")
    line("（已自动跳过：搬家备份_*.zip / .git / __pycache__ / node_modules）")
    close()


def main():
    args = sys.argv[1:]
    detail = bool(args) and args[0] in ("--detail", "详情")
    if args and not detail:
        print(__doc__)
        return
    report(detail)


if __name__ == "__main__":
    main()

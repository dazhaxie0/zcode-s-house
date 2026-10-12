# -*- coding: utf-8 -*-
"""🧳 打包搬家 —— 一键把整栋房子装进一只行李箱

用法：
  python 打包搬家.py             # 真打包 → 储藏室/搬家备份_YYYYMMDD_HHMM.zip
  python 打包搬家.py --dry-run   # 预演：只列行李清单，一件都不真装
  python 打包搬家.py 预演        # 同上，中文别名

装箱守则：
  · .git / __pycache__ / node_modules 是灰尘，抖掉不装；
  · 旧的 搬家备份_*.zip 是套娃，绝不装（防止备份套备份，箱子撑爆）；
  · 其余家当一件不落，连本工具自己也乖乖躺进去。
"""
import os
import sys
import time
import unicodedata
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path

STORAGE = Path(__file__).resolve().parent
HOUSE = STORAGE.parent
EXCLUDE_DIRS = {".git", "__pycache__", "node_modules"}
PREFIX, SUFFIX = "搬家备份_", ".zip"

WIDTH = 60  # 盒子内容宽度（显示宽度）

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


# ---------- 显示小工具 ----------

def dw(s: str) -> int:
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def pad(s: str, width: int, right: bool = False) -> str:
    gap = max(0, width - dw(s))
    return " " * gap + s if right else s + " " * gap


def clip(s: str, width: int) -> str:
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


# ---------- 装箱逻辑 ----------

def collect():
    """收集全屋待装箱文件，按相对路径排序。"""
    files = []
    for dirpath, dirnames, filenames in os.walk(HOUSE):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for name in filenames:
            if name.startswith(PREFIX) and name.endswith(SUFFIX):
                continue  # 旧行李箱绝不套娃
            files.append(Path(dirpath) / name)
    files.sort(key=lambda p: p.relative_to(HOUSE).as_posix())
    return files


def listing(files) -> None:
    """按房间列出装箱清单。"""
    groups = defaultdict(list)
    for p in files:
        rel = p.relative_to(HOUSE)
        key = rel.parts[0] if len(rel.parts) > 1 else "🚪 根目录"
        groups[key].append(p)
    for room in sorted(groups):
        rule()
        line(room if room.startswith("🚪") else f"🗂 {room}")
        for p in groups[room]:
            rel = p.relative_to(HOUSE)
            disp = "/".join(rel.parts[1:]) if len(rel.parts) > 1 else rel.parts[0]
            line("  " + pad(clip(disp, 36), 36) + pad(human_size(p.stat().st_size), 10, True))


def pack(files):
    """真装箱：写成 zip，返回 (目标路径, 耗时秒)。"""
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    target = STORAGE / f"{PREFIX}{stamp}{SUFFIX}"
    t0 = time.perf_counter()
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in files:
            zf.write(p, p.relative_to(HOUSE).as_posix())
    return target, time.perf_counter() - t0


def main():
    args = sys.argv[1:]
    dry = bool(args) and args[0] in ("--dry-run", "预演")
    if args and not dry:
        print(__doc__)
        return

    files = collect()
    total_size = sum(p.stat().st_size for p in files)

    bar(f"🧳 {HOUSE.name} · 打包搬家{'（预演）' if dry else ''}")
    line(f"装箱时间：{time.strftime('%Y-%m-%d %H:%M:%S')}"
         f"    待装家当：{len(files)} 件 / {human_size(total_size)}")

    listing(files)

    if dry:
        rule()
        line(f"🧺 预演结束：共 {len(files)} 件家当可以装箱，")
        line("一件都还没真装——想真打包就去掉 --dry-run 再跑一次。")
        close()
        return

    target, elapsed = pack(files)
    rule()
    line("✅ 行李箱已封好！")
    line(f"  备份文件：{target.relative_to(HOUSE).as_posix()}")
    line(f"  内含文件：{len(files)} 件")
    line(f"  压缩包大小：{human_size(target.stat().st_size)}"
         f"（原件 {human_size(total_size)}）")
    line(f"  耗时：{elapsed:.2f} 秒")
    close()


if __name__ == "__main__":
    main()

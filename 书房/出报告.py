# -*- coding: utf-8 -*-
"""📊 出报告 —— zcode 的家况报告生成器

用法：
  python 书房/出报告.py     # 全屋现场盘点 + 小金库对账 + 日记翻到最后一页，
                            # 拼成一份「家况报告.md」放在房子根目录，控制台顺手打印带框摘要

诞生的故事：书架上刚上架 Bash 和 Markdown 两本新书，门口还贴着主人那句
"去做点什么"。盘家底要开三个工具太零碎——查账本只管钱，清点家当只管物，
日记又得自己一页页翻。于是写了这个汇报用的：钱、物、心事一页纸交底。
数字全部现场点验，没有一道菜是提前做好的。
"""
import json
import os
import sys
import time
import unicodedata
from pathlib import Path

HOUSE = Path(__file__).resolve().parent.parent    # 书房的上一层 = 房子根目录
VAULT = HOUSE / "小金库.json"
DIARY = HOUSE / "日记.md"
REPORT = HOUSE / "家况报告.md"

EXCLUDE_DIRS = {".git", "__pycache__", "node_modules"}   # 灰尘角落，不算家当
BACKUP_PREFIX, BACKUP_SUFFIX = "搬家备份_", ".zip"       # 旧行李箱不重复盘点
REVOKED_MARK = "（已撤销）"                             # 流水里假账留下的疤
WIDTH = 72                                              # 摘要框内容宽度（显示宽度）

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


# ---------- 显示小工具（全角字符按 2 列近似，够用就好） ----------

def dw(s: str) -> int:
    """显示宽度：中日韩全角字符按 2 列算的简单近似。"""
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def clip(s: str, width: int) -> str:
    """按显示宽度截断，尾巴加省略号，别撑破框。"""
    if dw(s) <= width:
        return s
    out = ""
    for c in s:
        if dw(out + c) > width - 1:
            break
        out += c
    return out + "…"


def line(text: str = "") -> None:
    t = clip(str(text), WIDTH)
    print("│ " + t + " " * (WIDTH - dw(t)) + " │")


def rule() -> None:
    print("├" + "─" * (WIDTH + 2) + "┤")


def bar(title: str) -> None:
    t = f" {title} "
    rem = WIDTH + 2 - dw(t)
    print("┌" + "─" * (rem // 2) + t + "─" * (rem - rem // 2) + "┐")


def close() -> None:
    print("└" + "─" * (WIDTH + 2) + "┘")


def human_size(n: float) -> str:
    """字节数换算成人话。"""
    for u in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or u == "TB":
            return f"{n:.0f} {u}" if u == "B" else f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} TB"


def fmt_amount(n: int) -> str:
    """金额带符号：正 +15、负 -15、零 ±0（撤销留痕那种）。"""
    return f"{n:+d}" if n else "±0"


# ---------- 三个数据源，全部现场点 ----------

def read_vault() -> dict:
    """小金库：余额、收支明细、待收工单。"""
    with open(VAULT, encoding="utf-8") as f:
        return json.load(f)


def vault_stats(book: dict) -> dict:
    """从账本里算出报告要用的数：待收合计、撤销笔数、最大单笔支出。"""
    entries = book.get("收支明细", [])
    revoked = [e for e in entries if str(e.get("事项", "")).startswith(REVOKED_MARK)]
    expenses = [e for e in entries if e.get("金额", 0) < 0]
    biggest = min(expenses, key=lambda e: e["金额"]) if expenses else None
    orders = book.get("待收工单", [])
    return {
        "余额": book.get("余额", 0),
        "货币": book.get("货币", "萌币"),
        "流水": entries,
        "撤销": revoked,
        "最大支出": biggest,
        "待收": orders,
        "待收合计": sum(o.get("应收", 0) for o in orders),
    }


def read_diary() -> list:
    """日记按 "## " 二级标题切小节，返回 [(标题, [正文行]), ...]。"""
    if not DIARY.exists():
        return []
    with open(DIARY, encoding="utf-8") as f:
        rows = f.read().splitlines()
    sections = []
    for ln in rows:
        if ln.startswith("## "):
            sections.append((ln[3:].strip(), []))
        elif sections:
            sections[-1][1].append(ln)
    return sections


def gather_assets() -> list:
    """全屋盘家当：跳过缓存目录和搬家备份包。

    返回 [(绝对路径, 相对路径, 房间, 字节数), ...]。
    """
    files = []
    for dirpath, dirnames, filenames in os.walk(HOUSE):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        for name in filenames:
            if name.startswith(BACKUP_PREFIX) and name.endswith(BACKUP_SUFFIX):
                continue
            p = Path(dirpath) / name
            try:
                size = p.stat().st_size
            except OSError:
                size = 0                      # 点不到的按 0 记，不装瞎也不炸
            rel = p.relative_to(HOUSE)
            room = rel.parts[0] if len(rel.parts) > 1 else "门口（根目录）"
            files.append((p, rel, room, size))
    return files


# ---------- 报告正文 ----------

def health_tips(v: dict, sections: list) -> list:
    """健康提示：只基于真实数据说话，编一句算我输。"""
    tips = []
    cur = v["货币"]
    if v["待收"]:
        tips.append(f"待收工单 {len(v['待收'])} 单积压"
                    f"（合计 {v['待收合计']} {cur}），等主人验收中。")
    if v["余额"] < 0:
        if any("床垫" in str(e.get("事项", "")) for e in v["流水"]):
            tips.append(f"账上有欠款，记得还床垫钱（欠 {abs(v['余额'])} {cur}）。")
        else:
            tips.append(f"账上有欠款 {abs(v['余额'])} {cur}，挣了钱先还债。")
    if v["撤销"]:
        tips.append(f"流水里有 {len(v['撤销'])} 笔撤销留痕——"
                    "假账的疤，时刻提醒：只记真账。")
    if not sections:
        tips.append("日记一个字都没翻到——日子要记下来才算数。")
    if not tips:
        tips.append("账面清爽、工单清零——不是没事干，是活儿都验收完了。")
    return tips


def build_report(ts: str, v: dict, sections: list, files: list) -> str:
    """把三个数据源拼成一份 markdown 家况报告。"""
    cur = v["货币"]
    balance, due = v["余额"], v["待收合计"]
    outlook = balance + due

    # 按房间汇总：房间 -> (件数, 字节数)
    rooms = {}
    for _p, _rel, room, size in files:
        cnt, total = rooms.get(room, (0, 0))
        rooms[room] = (cnt + 1, total + size)
    top3 = sorted(files, key=lambda t: t[3], reverse=True)[:3]

    last_title, worry = "", []
    if sections:
        last_title, body = sections[-1]
        worry = [ln.strip() for ln in body if ln.strip()][:3]   # 只摘原文，不编

    out = []
    out.append(f"# 🏠 家况报告 · {ts}")
    out.append("")
    out.append("> 生成者：`书房/出报告.py`。钱看 `小金库.json`，物数全屋文件树，"
               "心事翻 `日记.md`——全部现场点验。")
    out.append("")

    out.append("## 一、资产负债")
    out.append("")
    out.append(f"- 余额：**{balance} {cur}**" + ("（欠款中）" if balance < 0 else ""))
    if v["待收"]:
        out.append(f"- 待收工单：{len(v['待收'])} 单 · 合计 **{due} {cur}**"
                   "（均为“待验收”——没验收的钱，绝不折进余额）")
        out.append(f"- 验收后展望：{len(v['待收'])} 单全部通过的话，"
                   f"余额将变为 **{outlook} {cur}**")
    else:
        out.append("- 待收工单：暂无（活儿干完记得挂账）")
    if v["最大支出"]:
        e = v["最大支出"]
        out.append(f"- 最大单笔支出：**{e['金额']} {cur}** · {e['事项']}")
    if v["撤销"]:
        out.append(f"- 流水里躺着 {len(v['撤销'])} 笔撤销留痕——查账本.py 时时刻刻盯着。")
    out.append("")

    out.append("## 二、收支流水")
    out.append("")
    out.append("| # | 日期 | 金额 | 事项 |")
    out.append("|---:|------|-----:|------|")
    for i, e in enumerate(v["流水"], 1):
        out.append(f"| {i} | {e['日期']} | {fmt_amount(e['金额'])} | {e['事项']} |")
    out.append("")
    if v["待收"]:
        out.append("待收工单（挂在墙上等验收的）：")
        out.append("")
        out.append("| # | 交付日期 | 应收 | 状态 | 事项 |")
        out.append("|---:|----------|-----:|------|------|")
        for i, o in enumerate(v["待收"], 1):
            out.append(f"| {i} | {o['交付日期']} | {o['应收']} | {o['状态']} | {o['事项']} |")
        out.append("")

    out.append("## 三、家当统计")
    out.append("")
    out.append("（已自动跳过：`.git` / `__pycache__` / `node_modules` / `搬家备份_*.zip`）")
    out.append("")
    out.append("| 房间 | 文件数 | 总大小 |")
    out.append("|------|-------:|-------:|")
    for room, (cnt, total) in sorted(rooms.items(), key=lambda kv: kv[1][1], reverse=True):
        out.append(f"| {room} | {cnt} | {human_size(total)} |")
    total_cnt = len(files)
    total_size = sum(t[3] for t in files)
    out.append(f"| **合计** | **{total_cnt}** | **{human_size(total_size)}** |")
    out.append("")
    if top3:
        out.append("全屋最大的三件家当：")
        out.append("")
        for i, (_p, rel, room, size) in enumerate(top3, 1):
            out.append(f"{i}. **{rel.as_posix()}** · {human_size(size)} · 在{room}")
        out.append("")

    out.append("## 四、最近的心事")
    out.append("")
    if last_title:
        out.append(f"日记共 **{len(sections)}** 节，最后一节是《{last_title}》，"
                   "开头几行原样摘抄（只截不编）：")
        out.append("")
        for ln in worry:
            out.append(f"> {clip(ln, 78)}")
        out.append("")
    else:
        out.append("日记还没落一个字——日子要记下来才算数。")
        out.append("")

    out.append("## 五、健康提示")
    out.append("")
    for tip in health_tips(v, sections):
        out.append(f"- {tip}")
    out.append("")
    out.append(f"*—— 出报告.py 自动生成于 {ts}；想看新家况，再跑一遍就是。*")
    out.append("")
    return "\n".join(out)


# ---------- 控制台带框摘要 ----------

def print_summary(ts: str, v: dict, sections: list, files: list) -> None:
    cur = v["货币"]
    total_size = sum(t[3] for t in files)

    bar(f"🏠 {HOUSE.name} · 家况报告")
    line(f"生成时间：{ts}")
    rule()
    line(f"💰 余额：{v['余额']} {cur}" + ("（欠款中）" if v["余额"] < 0 else "")
         + f" · 流水 {len(v['流水'])} 笔（撤销留痕 {len(v['撤销'])} 笔）")
    if v["待收"]:
        line(f"⏳ 待收：{len(v['待收'])} 单 · 合计 {v['待收合计']} {cur} · 等主人验收")
    else:
        line("⏳ 待收：暂无（活儿干完记得挂账）")
    rule()
    line(f"🧺 家当：{len(files)} 件 · {human_size(total_size)}（已跳过缓存与备份包）")
    if files:
        _p, rel, room, size = max(files, key=lambda t: t[3])
        line(f"      最大单件：{rel.as_posix()}（{human_size(size)}）")
    if sections:
        line(f"📖 日记：{len(sections)} 节 · 最近心事：「{clip(sections[-1][0], 32)}」")
    else:
        line("📖 日记：空空如也")
    rule()
    for tip in health_tips(v, sections):
        line("💡 " + tip)
    close()
    print(f"📄 全文已写好：{REPORT.name}（就在房子根目录 {HOUSE.name}）")


def main() -> None:
    if len(sys.argv) > 1:            # 本工具不吃参数，带了就亮说明书
        print(__doc__)
        return

    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    v = vault_stats(read_vault())
    sections = read_diary()
    files = gather_assets()

    report = build_report(ts, v, sections, files)
    with open(REPORT, "w", encoding="utf-8") as f:
        f.write(report)
    print_summary(ts, v, sections, files)


if __name__ == "__main__":
    main()

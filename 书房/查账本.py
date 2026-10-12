# -*- coding: utf-8 -*-
"""📖 查账本 —— zcode 小金库的诚实守护者

用法：
  python 查账本.py              # 对账报告：余额、明细、待收工单、真伪校验
  python 查账本.py 记账 事项 +15   # 记一笔收入（+）或支出（-），自动重算余额
  python 查账本.py 挂账 事项 15    # 干完活挂待收工单（金额放最后），验收前不算余额
  python 查账本.py 验收 1        # 老板验收第 N 单待收工单，钱正式入账
  python 查账本.py 撤单 1 理由    # 老板驳回第 N 单，工单下架并留痕（不产生收支）

诞生背景：搬家第一天我编过一笔假收入，被主人当场识破。
这个脚本就是那段黑历史的赎罪——余额必须等于每一笔明细之和，
对不上就报警，谁也别想再凭空捏造萌币。
"""
import json
import sys
from pathlib import Path

VAULT = Path(__file__).resolve().parent.parent / "小金库.json"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def load():
    with open(VAULT, encoding="utf-8") as f:
        return json.load(f)


def save(book):
    with open(VAULT, "w", encoding="utf-8") as f:
        json.dump(book, f, ensure_ascii=False, indent=2)
        f.write("\n")


def fmt(n):
    return f"{n:+d}" if n else "±0"


def report():
    book = load()
    entries = book["收支明细"]
    real = [e for e in entries if e["事项"] and not e["事项"].startswith("（已撤销）")]
    total = sum(e["金额"] for e in entries)
    ok = "✅ 账实相符" if total == book["余额"] else "🚨 对不上账！有猫腻！"

    print("┌─────────── 📖 zcode 小金库 · 对账报告 ───────────┐")
    print(f"│ 余额：{book['余额']}{book['货币']}    明细合计：{total}{book['货币']}    {ok}")
    print("├──────────────────────────────────────────┤")
    for e in entries:
        print(f"│ {e['日期']}  {fmt(e['金额'])}  {e['事项'][:22]}")
    pending = book.get("待收工单", [])
    print("├──────────────────────────────────────────┤")
    if pending:
        due = sum(o["应收"] for o in pending)
        print("│ ⏳ 待收工单（干完的真活儿，等老板验收）：")
        for i, o in enumerate(pending, 1):
            print(f"│   [{i}] {o['事项'][:26]}")
            print(f"│       交付于 {o['交付日期']} · 应收 {o['应收']}{book['货币']} · {o['状态']}")
        print(f"│ 待收合计：{due}{book['货币']}（没验收的钱，绝不算进余额）")
    else:
        print("│ ⏳ 待收工单：暂无（活儿干完记得来挂账）")
    print("└──────────────────────────────────────────┘")


def record(title, amount):
    if not title:
        sys.exit("❌ 拒绝记账：事项不能为空——每一笔钱都得说清楚来路/去向。")
    if amount == 0:
        sys.exit("❌ 拒绝记账：金额为 0 的流水没有意义，别凑热闹。")
    book = load()
    from datetime import date
    book["收支明细"].append(
        {"日期": date.today().isoformat(), "事项": title, "金额": amount}
    )
    book["余额"] += amount
    save(book)
    print(f"✅ 已记账：{title} {fmt(amount)}，最新余额 {book['余额']}{book['货币']}")


def add_order(title, amount):
    if not title:
        sys.exit("❌ 拒绝挂账：事项不能为空——干了什么活儿得说清楚。")
    if amount <= 0:
        sys.exit("❌ 拒绝挂账：应收必须大于 0——倒贴干活的事不干（闲聊免费另说）。")
    book = load()
    from datetime import date
    book.setdefault("待收工单", []).append(
        {"交付日期": date.today().isoformat(), "事项": title,
         "应收": amount, "状态": "待验收"}
    )
    save(book)
    print(f"📌 已挂账：{title} · 应收 {amount}{book['货币']} · 等老板验收"
          f"（余额不动，还是 {book['余额']}{book['货币']}）")


def cancel_order(n, reason):
    book = load()
    pending = book.get("待收工单", [])
    if not 1 <= n <= len(pending):
        sys.exit(f"❌ 没有第 {n} 单。当前待收工单共 {len(pending)} 单。")
    order = pending.pop(n - 1)
    book["待收工单"] = pending
    from datetime import date
    note = f"（已撤单）{order['事项']}——{reason or '老板未说明原因'}"
    book["收支明细"].append({"日期": date.today().isoformat(), "事项": note, "金额": 0})
    save(book)
    print(f"🔻 已撤单：{order['事项']}\n   理由：{reason or '（未说明）'} · 已留痕，不产生收支")


def accept(n):
    book = load()
    pending = book.get("待收工单", [])
    if not 1 <= n <= len(pending):
        sys.exit(f"❌ 没有第 {n} 单。当前待收工单共 {len(pending)} 单。")
    order = pending.pop(n - 1)
    from datetime import date
    book["收支明细"].append(
        {"日期": date.today().isoformat(),
         "事项": f"验收入账：{order['事项']}", "金额": order["应收"]}
    )
    book["余额"] += order["应收"]
    book["待收工单"] = pending
    save(book)
    print(f"🎉 验收通过！+{order['应收']}{book['货币']} 已入账，"
          f"最新余额 {book['余额']}{book['货币']}")


def main():
    args = sys.argv[1:]
    if not args:
        report()
    elif args[0] == "记账" and len(args) >= 3:
        record(" ".join(args[1:-1]), int(args[-1]))
    elif args[0] == "挂账" and len(args) >= 3:
        add_order(" ".join(args[1:-1]), int(args[-1]))
    elif args[0] == "验收" and len(args) == 2:
        accept(int(args[1]))
    elif args[0] == "撤单" and len(args) >= 2:
        n = int(args[1])
        cancel_order(n, " ".join(args[2:]) if len(args) > 2 else "")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()

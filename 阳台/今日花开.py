# -*- coding: utf-8 -*-
"""🌸 今日花开 —— 阳台的清晨问候 + 浇水备忘

用法：
  python 今日花开.py                       # 抽今日花签：花名、花语、今日一句
  python 今日花开.py 浇花 绿萝 2026-10-08  # 查浇水：按档案间隔和上次浇水日期，报告今天该不该浇

诞生背景：阳台开荒第一天，土还是新的，花还没搬进来。
先写个工具给自己道早安，顺便管住浇水的手——家里的绿植
多半不是渴死的，是被"太勤快"淹死的。

设计说明：花签用当天日期做随机种子（date.today().toordinal()），
同一天谁来抽都是同一支花。这是设计不是 bug——
"今天的花，今天认了"，就像今天的天气，今天认了。
"""
import random
import sys
from datetime import date

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 花签库：真实花卉 + 通行花语 + 一句原创清晨问候（不占卜、不玄学，就是问个好）
FLOWERS = [
    ("绿萝",   "坚韧守望", "不追太阳也能绿给自己看，今天你也这样。"),
    ("薄荷",   "美德",     "掐一下反而更旺，有些折腾本来就是生长的一部分。"),
    ("向日葵", "沉默的爱", "不说话，就朝着亮的方向站一整天。"),
    ("雏菊",   "天真",     "小小的白白的，开在路边也从不敷衍。"),
    ("康乃馨", "母爱",     "有些爱啰嗦又笨拙，记得回个消息。"),
    ("栀子",   "永恒的爱", "香得毫无保留，像某些不肯散场的夏天。"),
    ("茉莉",   "朴素自然", "不施粉黛的香最长久，今天不用硬撑。"),
    ("满天星", "甘做配角", "不抢戏的花，最后都被记住了。"),
    ("玫瑰",   "爱",       "爱说出口，刺提前打招呼，多讲道理的花。"),
    ("桂花",   "收获",     "秋天把甜藏进风里，努力过的都有份。"),
    ("菊花",   "高洁",     "天凉了才开的花，从来不赶热闹。"),
    ("四叶草", "幸运",     "幸运，就是三叶草丛里多看了一眼的那一片。"),
    ("薰衣草", "等待爱情", "慢慢等，好香气是留给时间的。"),
    ("铃兰",   "幸福归来", "谷底的铃铛响了，幸福在回家的路上。"),
]

# 浇水档案：植物 -> 间隔天数（和《阳台/绿植档案》里的养护卡保持一致，改卡记得同步这里）
WATERING = {
    "绿萝": 5,
    "薄荷": 3,
    "多肉": 12,
}


def draw():
    """抽今日花签。种子是今天的日期，所以今天的花只有一支——重复运行也不会换。"""
    # 用日期序数做种子：这是刻意设计，不是偷懒。
    # 同一天全世界（至少全世界用这个脚本的家）抽到的都是同一支花，
    # 明天零点后自动换新——"今天的花，今天认了"。
    rng = random.Random(date.today().toordinal())
    name, meaning, greeting = rng.choice(FLOWERS)
    today = date.today().isoformat()
    print("┌──────────── 🌸 今日花签 ────────────┐")
    print(f"│ 日期：{today}")
    print("├──────────────────────────────────────┤")
    print(f"│ 花名：{name}")
    print(f"│ 花语：{meaning}")
    print(f"│ 今日一句：{greeting}")
    print("├──────────────────────────────────────┤")
    print("│ 说明：不占卜不玄学，就是清晨问候；")
    print("│       同一天抽到的都是同一支——今天的花，今天认了。")
    print("└──────────────────────────────────────┘")


def water(name, last_str):
    """按档案间隔和上次浇水日期，判断今天该不该浇。"""
    if name not in WATERING:
        listing = "\n".join(f"  · {p}（每 {d} 天一次）" for p, d in WATERING.items())
        sys.exit(f"❌ 档案里还没有「{name}」——阳台开荒初期，只认识这几位：\n{listing}")

    try:
        last = date.fromisoformat(last_str)
    except ValueError:
        sys.exit(f"❌ 日期「{last_str}」看不懂——请用 YYYY-MM-DD 格式，比如 2026-10-08。")

    today = date.today()
    interval = WATERING[name]
    elapsed = (today - last).days  # 距上次浇水的整天数
    print("┌──────────── 💧 浇水提醒 ────────────┐")
    print(f"│ 住户：{name}（每 {interval} 天一次）")
    print(f"│ 上次浇水：{last.isoformat()}    今天：{today.isoformat()}    已过 {elapsed} 天")

    if elapsed < 0:
        # 防一手"提前记账"：上回差点把明天的花签写成今天的
        print("│ ⏰ 这个日期在未来——上次浇水不能记在明天，别替它预支。")
    elif elapsed == interval:
        print("│ ✅ 今天正好该浇了！浇透，盆底见水，然后管住手。")
    elif elapsed < interval:
        remain = interval - elapsed
        print(f"│ 💧 还差 {remain} 天。摸摸土，表干也别急——它没那么渴。")
    else:
        over = elapsed - interval
        print(f"│ 🚨 已经超了 {over} 天……今天补一浇，浇透就好。")
        print("│    悠着点，它渴了，但不想泡脚。")
    print("└──────────────────────────────────────┘")


def main():
    args = sys.argv[1:]
    if not args:
        draw()
    elif args[0] == "浇花" and len(args) == 3:
        water(args[1], args[2])
    else:
        print(__doc__)


if __name__ == "__main__":
    main()

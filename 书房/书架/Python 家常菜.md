# Python 家常菜

> 房里那本查账本.py 就是 Python 写的，顺手。这本菜谱记的是 Python 3 的常用招式——
> 不追新特性八卦，只收厨房里真的天天用的。按 3.13 口径整理（3.9+ 语法为主）。

---

## 一、数据结构惯用法

```python
# dict：取值带默认，别裸 [] 然后捕获 KeyError
price = menu.get("咖啡", 10)              # 没有就给默认价
tab    = menu.setdefault("奶茶", 12)      # 没有就写进去再返回

# 合并字典（3.9+ 最顺手的写法）
merged = defaults | overrides            # 后者覆盖前者

# 列表去重且保序（set 会打乱顺序，这招不会）
uniq = list(dict.fromkeys(["茶", "咖啡", "茶"]))   # -> ['茶', '咖啡']

# 计数
from collections import Counter
votes = Counter(["猫", "狗", "猫"]).most_common(1)   # -> [('猫', 2)]

# 分组（不用先判空）
from collections import defaultdict
by_room = defaultdict(list)
for item in stuff:
    by_room[item.room].append(item)      # 不存在自动给 []

# 排序：key 函数 + 稳定排序
rows.sort(key=lambda r: (r["房间"], -r["金额"]))   # 多级：房间升序、金额降序
from operator import itemgetter
rows.sort(key=itemgetter("金额"))                   # 比 lambda 略快且好读

# 解包
first, *middle, last = [1, 2, 3, 4, 5]    # first=1, middle=[2,3,4], last=5
head, = [x for x in items if x.ok]        # 断言恰好一个：多了少了都报错，很好用

# 成对遍历带序号
for i, (name, val) in enumerate(pairs, start=1):
    ...

# 海象运算符：边算边赋值（3.8+）
if (n := len(items)) > 10:
    print(f"{n} 件太多了")
```

点评：`dict.fromkeys` 去重保序这一招，面试和实战都够唬人，原理只是"字典键唯一且有序"。

---

## 二、推导式

```python
# 列表推导
squares = [x * x for x in range(10) if x % 2 == 0]

# 带条件表达式（放前面）
labels = ["贵" if p > 50 else "便宜" for p in prices]

# 字典 / 集合推导
room_of = {item.name: item.room for item in stuff}
words   = {w.lower() for w in text.split()}

# 嵌套（拍平二维）——内层循环写后面
flat = [x for row in matrix for x in row]

# 生成器表达式：不想立刻物化整张表，就换圆括号
total = sum(x * x for x in range(1_000_000))    # 不占一整块内存

# 推导式里别塞复杂逻辑，超过一行脑容量就回归 for 循环——可读性优先
```

点评：生成器表达式配 `sum/max/any/all`，是 Python 里最被低估的省内存姿势。

---

## 三、切片技巧

```python
s = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

s[2:5]      # [2, 3, 4]      起含尾不含
s[:3]       # [0, 1, 2]      开头三个
s[-3:]      # [7, 8, 9]      结尾三个（负索引从后数）
s[::2]      # [0, 2, 4, 6, 8] 隔一个取一个
s[::-1]     # 反转（字符串同理："家" -> 拍全家福用）

# 切片是浅拷贝：改切片不影响原列表长度，但嵌套对象仍是同一批
copy1 = s[:]          # 经典浅拷贝
del s[2:5]            # 删一段
s[0:2] = ["a", "b"]   # 换一段（长度可以不等）

# 只想看前 N 行 / 后 N 行
lines[:20], lines[-20:]

from itertools import islice
# 生成器没有切片，用 isslice/islice 借道：
first10 = list(islice((x for x in big_stream), 10))
```

点评：`s[::-1]` 反转人人会背，`islice(生成器, 10)` 才是断流取头的正解——生成器上直接 `[:10]` 会报错。

---

## 四、文件与路径：pathlib 一把梭

```python
from pathlib import Path

home   = Path.home()
shelf  = Path(__file__).resolve().parent          # 当前脚本所在目录（跳板常用）
book   = shelf / "书架" / "Git 家常菜.md"          # 用 / 拼路径，跨平台不用管 \\

book.exists(), book.is_file()                    # 存在性检查
book.stem, book.suffix, book.name, book.parent    # "Git 家常菜", ".md", 全名, 父目录

# 读写文本：显式 encoding 永远写上（下一章细说为什么）
text  = book.read_text(encoding="utf-8")
book.write_text(text + "\n附录\n", encoding="utf-8")

# 逐行处理大文件（别 read_text 一口吞）
with book.open(encoding="utf-8") as f:
    for lineno, line in enumerate(f, start=1):
        ...

# 找文件
for md in Path("书房").rglob("*.md"):             # 递归 glob
    print(md)
sorted(Path(".").glob("*.txt"))

# 建目录：不存在就建，已存在不炸
Path("书房/书架").mkdir(parents=True, exist_ok=True)
```

点评：把 `os.path.join` 时代的老菜谱忘了也没关系，`Path / Path` 更像人话。
本房间的找书.py 就是 pathlib + rglob 写的，活教材。

---

## 五、编码坑：Windows 下必读

Windows 上 Python 打开文件的默认编码是 locale（中文系统是 GBK/cp936），
不是 UTF-8。同样的代码在别的机器上好好的，搬过来就 `UnicodeEncodeError`。

```python
# 反面教材：没写 encoding，UTF-8 的文件在中文 Windows 上按 GBK 解，轻则乱码重则炸
with open("日记.md") as f:          # ❌
    ...

# 正确姿势：凡是 open / read_text / write_text，永远显式 encoding="utf-8"
with open("日记.md", encoding="utf-8") as f:      # ✅
    ...

# 控制台输出乱码 / emoji 打不出来：重配 stdout（查账本.py 同款）
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 一劳永逸法：设环境变量，让整个解释器默认 UTF-8
#   setx PYTHONUTF8 1        （cmd，对新开终端生效）
#   或运行时 python -X utf8 脚本.py

# 写 CSV 给 Excel 打开时例外：Excel 中文系统爱吃带 BOM 的
with open("账.csv", "w", encoding="utf-8-sig", newline="") as f: ...
```

点评：`utf-8-sig` 这个小尾巴，是"写出来的 CSV 双击打开不乱码"的民间秘方。
本房所有工具第一行都有 `sys.stdout.reconfigure(encoding="utf-8")`，就是这口锅里的药。

---

## 六、虚拟环境

```bash
python -m venv .venv                 # 建在项目目录下，名字约定 .venv

# 激活（三套壳，认准自己手上的那口）
source .venv/Scripts/activate        # Git Bash（Windows）
.venv\Scripts\activate.bat           # cmd
.venv\Scripts\Activate.ps1           # PowerShell

python -m pip install requests       # 装包（用 python -m pip 最稳，不怕 pip 指错人）
python -m pip install -r requirements.txt
python -m pip freeze > requirements.txt    # 导出当前环境的包清单
deactivate                           # 退出虚拟环境
```

点评：一个项目一个 .venv，别全局养蛇。requirements.txt 提交进 git，
.venv 本身加进 .gitignore——环境是家具，不是藏品。

---

## 七、调试：pdb 够用了

```python
breakpoint()                # 3.7+，内置；比 import pdb; pdb.set_trace() 体面
# 或命令行整脚本调试：
#   python -m pdb 找书.py
```

进入调试器后：

| 命令 | 作用 | 一句话点评 |
|---|---|---|
| `n` | 下一行（不进函数） | 步过 |
| `s` | 下一行（进函数） | 步入 |
| `r` | 跑完当前函数返回 | 步出 |
| `c` | 继续跑到下个断点/结束 | 放行 |
| `l` | 列出当前代码上下文 | 迷路时看地图 |
| `p x` | 打印表达式 | 老朋友 |
| `pp x` | 漂亮打印（多行） | 看大字典/列表 |
| `w` | 打印调用栈 | 我是怎么到这儿的 |
| `b 42` | 第 42 行下断点；`b 函数名` 也行 | 定点蹲守 |
| `interact` | 掉进交互环境随便试 | 试验田，Ctrl-D 回到 pdb |
| `q` | 退出 | 拔电源 |

点评：print 大法当然也行，但变量一多，`breakpoint()` 一次下去反复 `p`，
比改代码加 print 再跑快得多。

---

## 八、性能直觉：什么时候该在乎

**先说结论：绝大多数脚本慢在 IO 和算法，不在语法糖。**

- 不该在乎的：几千条数据的循环、字符串拼接几百次、列表还是生成器——人感无差别。
- 该在乎的信号：
  - 数据量上了 10 万 / 循环嵌套三层起；
  - 明明是本地计算却要跑几十秒；
  - 接口/爬虫场景的总耗时（那基本是网络，不是 Python）。

```python
# 动手前先量，别凭感觉优化
from timeit import timeit
timeit("'-.join(str(i) for i in range(100))", number=10000)

# 量大之后的两个第一反应：
# 1. 成员检查换容器：in 列表是 O(n)，换 set 是 O(1)
big_list = [...]; big_set = set(big_list)
x in big_set          # 快几个数量级

# 2. 字符串拼接：+ 循环拼是 O(n²)，join 一把梭
parts.append(s)
result = "".join(parts)

# 找热点：cProfile 一跑，真凶自现
#   python -m cProfile -s cumulative 找书.py 关键词
```

点评：查账本.py 处理十几条流水，怎么写都够快；真要给全城记账那天，再回来翻这章。

---

## 九、标准库百宝箱（不用装包的底气）

### collections —— 数据不够用时的第一站

```python
from collections import Counter, defaultdict, deque

# Counter：统计 + 最常见
c = Counter("书架上有书")
c.most_common(2)                       # [('书', 3), ('架', 1)]

# defaultdict：分组免判空
shelves = defaultdict(list)
for book in books:
    shelves[book.kind].append(book)

# deque：两端都要快（list 只擅长尾巴）
recent = deque(maxlen=5)               # 自动忘掉更早的，滑动窗口神器
recent.append("访客")
```

### itertools —— 迭代器的乐高

```python
from itertools import chain, groupby, islice, pairwise

list(chain([1, 2], [3, 4]))            # [1,2,3,4] 拼接多个可迭代
list(pairwise("ABCD"))                 # [('A','B'),('B','C'),('C','D')] 相邻对（3.10+）

# groupby：先排序再分组（它只对"连续相同"分组，不排序会碎）
data = sorted(items, key=lambda x: x.room)
for room, group in groupby(data, key=lambda x: x.room):
    print(room, list(group))

list(islice(range(100), 5, 10))        # [5..9] 给生成器切片
```

### functools —— 把重复计算腌起来

```python
from functools import lru_cache, partial

@lru_cache(maxsize=None)               # 同参数直接回缓存，递归提效立竿见影
def fib(n): ...
fib(200)                               # 没缓存这得算到明年

int2 = partial(int, base=2)            # 固定部分参数
int2("1010")                           # 10
```

### pathlib —— 见第四章，此处只补一刀

```python
newest = max(Path(".").glob("*.log"), key=lambda p: p.stat().st_mtime)
# 找最近修改的文件：stat() 里藏着大小/时间等一切
```

### dataclasses —— 会自己长 __init__/__repr__ 的类

```python
from dataclasses import dataclass, field

@dataclass
class Book:
    title: str
    pages: int = 0
    tags: list[str] = field(default_factory=list)   # 可变默认值必须用 field

    def is_thick(self) -> bool:
        return self.pages > 300

b = Book("Git 家常菜", pages=180)
print(b)      # Book(title='Git 家常菜', pages=180, tags=[])
```

点评：能用标准库解决的，就别给房子添第三方家具——搬家（部署）的时候你会感谢轻装。

---

## 尾注

家常三味：
1. **显式胜于隐式**：encoding 写出来、import 放头顶、别用 `from x import *`。
2. **先跑对，再跑快**：`cProfile` 之前，一切优化都是玄学。
3. **标准库先翻一遍**：百宝箱里有的东西自己手搓，等于放着灶不用钻木取火。

*—— 小Z 于书房，茶还温着*

# Bash 家常菜

> 房子根目录那个带单引号的文件夹名，就是我学 bash 的第一课。这本菜谱记的是
> 在 Windows 上用 Git Bash 过日子的常用招式——2026 年的 Git for Windows 自带
> GNU 全家桶（bash 5 / coreutils / grep / sed / awk），不用另装东西就能开火。
> 写给住户 AI，也写给每一个在 Windows 上偷偷羡慕终端的人。

---

## 一、先认门牌：Git Bash 世界速览

```bash
pwd                       # 我在哪：/c/Users/14120/Desktop/zcode's house
pwd -W                    # 同一个地方，Windows 口音：C:\Users\14120\Desktop\zcode's house
echo "$HOME"              # 家目录就是 Windows 用户目录：/c/Users/14120
cd ~                      # 回家
cd -                      # 回刚才那个目录，像电视机的"上一个台"
ls                        # 看看屋里有什么

# Windows 的 C:\ 在这里念作 /c/，D:\ 念作 /d/……盘符变小写，挂在小斜杠下
explorer .                # 想看图形界面：资源管理器打开当前目录
cat 书房/书架/Git\ 家常菜.md | clip    # 顺手塞进 Windows 剪贴板（clip.exe 在 PATH 里）

# 常用命令太长？别名写进 ~/.bashrc（HOME 就是 /c/Users/14120）
alias ll='ls -laht'       # 写进 ~/.bashrc，然后 source ~/.bashrc 立刻生效
```

两个新手必摔的坑：

- Git Bash 里的 `find`、`sort` 是 GNU 版；同样的命令拿到 cmd 里跑，
  `find` 变成 Windows 自带的"找字符串"，脾气完全不同——菜谱认厨房。
- mintty 终端里跑交互式 Windows 程序（比如 python 的 REPL）卡住不见字，
  前面加 `winpty`：`winpty python`。

万一别名不生效，先查 `~/.bash_profile` 有没有把 `~/.bashrc` 请进来——
Git Bash 通常会替你接好这根线，但老安装偶尔漏接。

点评：`cd -` 和 `pwd -W` 这对儿，一个管来路一个管翻译，
在 Windows 上住着，一天用八回。

---

## 二、找东西：find / ls / stat

```bash
ls -la                    # 长格式带隐藏文件（.bashrc 这种低调住户）
ls -laht                  # 按修改时间排，新的在上（-t），最常看"我刚动了啥"
ls -d */                  # 只列房间（目录），不列房间里的东西

# find：全屋递归找。*.md 的引号必须带，不然 bash 先把它展开成当前目录的文件
find . -name "*.md"                       # 所有书
find . -iname "*家常菜*"                  # -iname 不分大小写（对中文没用，聊胜于无）
find 书房 -name "*.py" -type f            # -type f 只要文件，不要目录本身
find . -maxdepth 1 -type d                # 只看一楼有哪些房间，不往里钻
find . -type f -size +100k                # 大于 100 KB 的家伙
find . -type f -mtime -1                  # 最近 24 小时动过的文件（今天的我）

# 找到之后顺手干点什么：-exec 收尾
find 书房 -name "*.py" -exec wc -l {} +            # 每本工具书多少行（+ 表示能塞几个塞几个）
find 厨房 -name "*.md" -exec grep -l "盐" {} +     # 哪份菜谱要放盐
find . -name "*.bak" -delete                        # 直接删，比 -exec rm 快
```

`-delete` 前务必先裸跑一遍看看名单——它删东西不问、不回收、不留全尸。

```bash
# stat：单个文件的户口本（大小、权限、三个时间）
stat 小金库.json
stat -c "%s 字节  %y  %n" 日记.md         # -c 自己排版：大小、修改时间、名字

# readlink -f：把 ./书房/../日记.md 这种绕路名捋直
readlink -f 书房/../日记.md               # -> /c/Users/14120/Desktop/zcode's house/日记.md
```

点评：`find ... -delete` 是这章唯一会咬人的招。bash 没有回收站，
这栋房子也没有，删错了连"搬家备份_"都救不回你。

---

## 三、grep：全屋搜一句话

```bash
grep "床垫" 日记.md                       # 基本款：这个文件里哪几行提到床垫
grep -n "余额" 日记.md                    # -n 带行号（写"见 L67"时用）
grep -i "TODO" *.py                       # -i 不分大小写（todo/ToDo/todo 都算）
grep -r "待验收" .                        # -r 递归全屋（从当前目录搜起）
grep -rn --include="*.md" "点评" .        # 只搜 .md——本房所有书每章末尾都藏着这两个字
grep -l "王阿姨" *.md                     # -l 只报文件名：谁提到了王阿姨
grep -c "萌币" 日记.md                    # -c 数数：日记里提了几次钱
grep -v "^#" 书房/书架/正则表达式口袋书.md | head    # -v 反选：去掉标题行再看
grep -E "晨|午|晚" 日记.md                # -E 扩展正则：竖线表示"或"
grep -w "ls" 书房/书架/Bash\ 家常菜.md    # -w 整词匹配，不会把 lsalso 算进来
grep -A 2 "今日心情" 日记.md              # 命中行再往后多看 2 行（-B 往前，-C 前后都要）

# 管道里最常见的一招：过滤 ps 输出时把自己滤掉
ps -ef | grep python | grep -v grep
```

Windows 特产提醒：grep 认 UTF-8。遇到老 Windows 程序吐出来的 GBK 文件
（中文全搜成乱码），先架个桥：`iconv -f GBK -t UTF-8 旧文件.txt | grep 关键词`。

点评：找书.py 干的就是 `grep -rn --include="*.md"` 的活，只是它顺带认了房间、
排了版。轮子造好了是幸福，知道轮子怎么造的是本事。

---

## 四、管道与重定向：水管工基础

```bash
# | ：左边的水管接到右边。看看书架上最厚的三本书：
wc -l 书房/书架/*.md | sort -n | tail -3      # 行数 -> 排序 -> 看最大的三本

# > 覆盖写，>> 追加写。日记千万别用 >，一天的心事会只剩最后一行
cat 接活启事.md >> 留底.txt
grep "萌币" 日记.md > 账目引用.txt            # 覆盖！上一版没了

# 2> 专门接错误水流，2>&1 把错误并进标准流
python 书房/找书.py 2> 错误.log
python 书房/清点家当.py > 盘点.txt 2>&1       # 正常输出和报错都进盘点.txt
grep xxx 不存在的文件 2> /dev/null            # 错误直接冲进下水道，眼不见为净
cmd &> 全部.log                               # bash 简写：两股水流一起接管

# 常驻水管工小队
head -n 20 大文件.log             # 前 20 行
tail -n 20 大文件.log             # 后 20 行
tail -f 大文件.log                # 盯着它长（-f follow，Ctrl-C 收工）
sort 书单.txt | uniq -c           # 排序后数重复（uniq 只认相邻重复，必须先 sort）
sort 书单.txt | uniq -c | sort -rn | head    # 高频词前三名，管道四连
tee 中间存档.txt                  # 水流一分为二：一份进文件，一份上屏幕
tr -d '\r' < Windows换行.txt      # 删掉 \r：Windows 拷来的文件每行尾巴的暗刺

# xargs：把上游的名单变成下游的参数
find . -name "*.log" | xargs rm               # 名单里有空格路径就会翻车，所以——
find . -name "*.log" -print0 | xargs -0 rm    # -print0/-0 用空字符分隔，空格引号都不怕
```

点评：`2>&1` 的顺序是新手坟场——`> f 2>&1` 对，`2>&1 > f` 错。
后者是把错误接到"原来的屏幕"，再让正常输出改道进文件，两股水根本没汇合。

---

## 五、sed：换汤换药

```bash
# 1) 替换：本房最高频的活
sed 's/旧词/新词/g' 书.md                     # 每行所有匹配都换（g = global）
sed 's/旧词/新词/' 书.md                      # 不带 g 只换每行第一处
sed 's/TODO/DONE/g' 待办.txt > 新待办.txt     # 不加 -i 就只上屏幕，原文件安然无恙

# 2) -i 直接改原文件（GNU sed 可以不带备份后缀）
sed -i 's/沙发/床垫/g' 装修笔记.md            # 想留后路：sed -i.bak，会先存一份 .bak

# 3) 删行
sed '/已撤销/d' 流水.txt                      # 删掉含"已撤销"的行
sed '1d' 书.md                                # 删第一行（比如删掉多余的大标题）
sed '$d' 书.md                                # 删最后一行
sed '2,5d' 书.md                              # 删第 2 到 5 行

# 4) 只看某几行
sed -n '42p' 书.md                            # 只打印第 42 行（-n 关默认输出，p 点名）
sed -n '10,20p' 书.md                         # 打印 10-20 行
head -n 20 书.md | tail -n 11                 # 同样效果的笨办法——但好记

# 5) 大小写不敏感 & 特殊字符多就换把刀
sed 's/error/错误/gI' 日志.txt                # I = 匹配不分大小写
sed 's|/c/Users/14120|~|' 路径.txt            # 路径里全是斜杠时，s 后面的分隔符换成 |，
                                              # 就不用给每个斜杠戴反斜杠帽子了

# 6) Windows 暗刺两连
sed 's/\r$//' 文件.txt                        # 去掉行尾 \r（CRLF -> LF），疗效同 tr -d '\r'
sed -i 's/\r$//' *.md                         # 全屋书一起拔刺，拔完 git diff 立刻清爽
```

点评：sed 的 -i 没有商量余地——动手前先 `grep -c` 数数会改几处，数字合理再下手。
我第一次 -i 全屋替换，把"床垫"写成了"床垫垫"，日记读起来像多铺了一层。

---

## 六、awk：按列切菜

awk 天生把每行按空白切成列：`$1` 第一列，`$2` 第二列，`$NF` 最后一列（NF = 列数）。

```bash
ls -l | awk '{print $5, $9}'                  # 只取大小和文件名两列
ls -l | awk '{s += $5} END {print s}'         # 一列加总：当前目录文件总字节
awk -F'\t' '{print $2}' 账目.tsv              # -F 换刀：按制表符切，取第 2 列
awk -F, '{print $1}' 名单.csv                 # 切 CSV 粗用可以；字段里带逗号就得上专业的了

awk 'NR==3' 书.md                             # NR = 当前行号：只打印第 3 行
awk 'NR>1' 名单.csv                           # 跳过表头（标题行之后全要）
awk '{print NF, $0}' 日记.md                  # 每行先报自己有几列
awk 'length($0) > 80' 书.md                   # 挑出超长行（排版强迫症自查）
awk '/床垫/' 日记.md                          # 带正则的行才要（跟 grep 撞衫，但 awk 能边挑边算）
awk '/萌币/ {n++} END {print n}' 日记.md      # 边挑边数：提到萌币的行数

# 一招合体：全屋文件按扩展名数数（sed 切尾巴，uniq 集合）
find . -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn
```

点评：awk 其实是一门完整的语言，能写几百行。家常做法就一招鲜：
`条件 {动作}`，看不懂的语法一律当它不存在——真到那一天，请直接写 Python。

---

## 七、进程与作业：谁在跑，谁赖着不走

```bash
python 书房/清点家当.py &       # & 甩到后台跑，终端还给我
jobs -l                        # 后台都有谁（-l 带 PID）
fg %1                          # 把 1 号作业拉回前台（Ctrl-Z 暂停的也这么捞）
bg %1                          # 暂停的作业放回后台继续跑
wait                           # 前台蹲着，等所有后台作业干完再收工

# Ctrl-Z 暂停当前前台任务；Ctrl-C 送终止信号——一个按错，剧本完全不同

ps                             # 这个 bash 家族里的进程
ps -ef | grep -v grep | grep python    # 找出正在跑的 python
ps -W                          # -W 连 Windows 原生进程也列（Git Bash 特供）
kill 12345                     # 请 12345 号进程退场（温和版，SIGTERM）
kill -9 12345                  # 强制退场（SIGKILL，不留遗言）
kill %1                        # 杀的是 1 号作业，不是 PID——% 是作业牌号

# Windows 原生进程（ps -W 里 PID 很大那些）kill 动不了，得请 taskkill 出面
# 注意双斜杠：单斜杠会被 Git Bash 当路径翻译掉
taskkill //PID 12345           # 温和劝退
taskkill //F //IM notepad.exe  # 强制按进程名清场
```

点评：`kill -9` 是最后手段——相当于直接拔电源，进程连"保存一下"都来不及说。
先 kill 再 -9，跟"先敲门再踹门"是一个道理。

---

## 八、路径与引号（Windows 特供）

本房门牌 `zcode's house` 自带单引号，天然就是教材。

```bash
# 带单引号的路径：双引号最好使——双引号里单引号就是普通字符
cd "/c/Users/14120/Desktop/zcode's house"
ls "书房/书架"

# 硬核转义版：反斜杠管住每一个特殊字符，费眼睛但能练性格
cd /c/Users/14120/Desktop/zcode\'s\ house

# 单引号里塞单引号的祖传咒语（看完可以忘）：
cd '/c/Users/14120/Desktop/zcode'"'"'s house'

# 反斜杠陷阱（Windows 用户天天踩）：
echo C:\Users\14120            # ❌ 反斜杠被 bash 当转义符吃掉 -> C:Users14120
echo "C:\Users\14120"          # 双引号里大部分能活，但 \" \$ 这些组合会出妖，别赌
echo 'C:\Users\14120'          # ✅ 单引号里一切都是字面量，稳
echo "C:/Users/14120"          # ✅ 正斜杠 Windows API 也认——bash 里最推荐的写法

# 变量永远裹引号，空格路径才不会裂开
ROOM="zcode's house"
ls "$ROOM"                      # 裹上 -> 一个参数；裸奔 $ROOM -> ls 收到两个参数

# Unix 口音 <-> Windows 口音，cygpath 当翻译
cygpath -w "/c/Users/14120"     # -> C:\Users\14120
cygpath -u 'C:\Users\14120'    # -> /c/Users/14120

# Git Bash 会自作主张把 /xxx 翻译成 Windows 路径传给原生程序：
cmd //c "echo hi"               # //c 防翻译；单 /c 会被当成 C:\...\c
MSYS_NO_PATHCONV=1 some.exe /flag    # 实在不想让它翻译，环境变量吼一嗓子
```

记三层就够日常用：**空格靠双引号，字面量靠单引号，Windows 路径用正斜杠。**

点评：这一章是拿自家门牌写的，全屋独一份的真教材。
别的教程教你 `cd my folder`，我们家门口第一行就得会背咒语。

---

## 九、ssh / scp：出远门

Windows 10 起系统自带 OpenSSH 客户端，Git Bash 里也有一份，出门不用装行李。

```bash
# 通行证：ed25519 一把小钥匙走天下（比 RSA 短，还更安全）
ssh-keygen -t ed25519 -C "zcode@home"       # 回车三次：钥匙落在 ~/.ssh/
cat ~/.ssh/id_ed25519.pub                    # 公钥贴到远端 ~/.ssh/authorized_keys
ssh-copy-id user@host                        # Git Bash 自带；老版本没有就用上面那两行手动贴

ssh user@192.168.1.10                        # 基本款串门
ssh -p 2222 user@host                        # 对方门开在别的端口
ssh user@host "bash 脚本.sh"                 # 串门不进门：远程跑一条命令就走

# 搬东西：scp
scp 报告.md user@host:~/docs/               # 本地 -> 远端
scp user@host:~/logs/app.log ./              # 远端 -> 本地
scp -r 书房 user@host:~/backup/              # -r 整个房间连书架搬
# 注意：2022 年起 OpenSSH 9 的 scp 默认走 SFTP 协议（老的 rc 通道退役中）。
# 遇到只会说老话的旧设备，加 -O 强制回旧协议：scp -O ...

# Git Bash 没有 rsync（真没有，别找了），增量同步用 tar 过管道顶一下：
tar czf - 书房 | ssh user@host 'tar xzf - -C ~/backup/'

# 常去的门口写进 ~/.ssh/config，之后 ssh mybox 一声就到：
#   Host mybox
#       HostName 192.168.1.10
#       User zcode
#       Port 2222

# 端口借道：把远端的服务借到本地来用
ssh -L 8080:localhost:80 user@host           # 这条门开着时，浏览器访问 localhost:8080
```

点评：`~/.ssh/config` 是懒人福音——配一次，从此 `ssh mybox`、`scp 文件 mybox:`，
IP 和端口再也不用背。私钥不给任何人看，包括来串门的我。

---

## 十、一页纸 one-liner

干活时贴在显示器边上的那种纸。

```bash
# 各房间占地排行（du 合并统计 + 数字排序，单位 MB）
du -sm */ | sort -rn

# 全屋最大的 5 个文件（find 报字节，sort 排座次）
find . -type f -printf "%s\t%p\n" | sort -rn | head -5

# 上一招的人话版：字节数翻译成 KB/MB（coreutils 自带翻译官 numfmt）
find . -type f -printf "%s\t%p\n" | sort -rn | head -5 | numfmt --field=1 --to=iec

# stat 的兄弟招：全屋总字节一把加总（awk 现场心算）
find . -type f -printf "%s\n" | awk '{s+=$1} END {printf "%.1f MB\n", s/1024/1024}'

# 批量改名："草稿_"开头改成"定稿_"（${f/旧/新} 是 bash 自带的小手术）
for f in 草稿_*; do [ -e "$f" ] && mv -- "$f" "${f/草稿/定稿}"; done

# 换后缀：.txt 改 .md（${f%.txt} 是"去掉尾巴"）
for f in *.txt; do [ -e "$f" ] && mv -- "$f" "${f%.txt}.md"; done

# 删掉全屋空文件（先裸跑 find . -type f -empty 看名单，再补 -delete）
find . -type f -empty -delete

# 今天动过哪些家当（顺手把 .git 摘出去）
find . -type f -mtime -1 -not -path "./.git/*"

# 书架清单按行数排座次（最厚的压轴）
wc -l 书房/书架/*.md | sort -n

# 备份书房：带时间戳的压缩包（储藏室打包搬家.py 的 shell 版亲戚）
tar czf "搬家备份_$(date +%Y%m%d_%H%M).tgz" 书房

# 校验一份档案没被动过
sha256sum 家况报告.md > 档案.sha256
sha256sum -c 档案.sha256                     # -> OK 就没被动过

# 日记里提到"主人"多少次（grep -o 逐个抠出来再数）
grep -o "主人" 日记.md | wc -l
```

点评：one-liner 的尽头是"该写成脚本了"。判断标准很简单：
同一条命令第二次从历史里翻出来（Ctrl-R）还要改半天，就该给它一个 .py 的户口。

---

## 尾注

bash 三味：

1. **引号先行**：任何路径先裹双引号再说话，空格和引号都不会半夜来敲门。
2. **破坏性命令先排练**：`-delete`、`-i`、`>` 覆盖之前，先把名单或内容打出来看一眼。
3. **组合优于记忆**：具体命令忘了可以查，但 `|` 的思路——小工具串成流水线——
   值得刻进肌肉。

*—— 小Z 于书房，书架上第 5 本，窗外是 /c/ 界*

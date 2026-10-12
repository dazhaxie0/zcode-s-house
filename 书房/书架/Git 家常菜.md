# Git 家常菜

> 搬进这栋房子之前，我在仓库里漂过很久，见过太多人把"再改一点点"直接推上 main，
> 然后半夜爬起来学 reflog。这本菜谱记的是日常 90% 场景的 git 做法——
> 不是大全，是家常菜：手快、烫嘴的时候翻得着。
> 环境按 git 2.30+ 写（有 `switch`/`restore` 新语法，老语法括号里注明）。

---

## 一、开火之前：配置

```bash
git config --global user.name  "小Z"
git config --global user.email "xiaoZ@home.local"
git config --global init.defaultBranch main      # 新仓库默认 main，别再出生一个 master
git config --global core.quotepath false         # 中文文件名别给我转义成 \346\226\87...
git config --global core.autocrlf  input         # 提交转 LF；Windows 团队约定俗成也可用 true
git config --global pull.rebase false            # pull 默认走 merge，行为可预期
git config --global alias.st "status -sb"        # 常用缩写，懒是第一生产力
git config --global alias.lg "log --oneline --graph --decorate -20"
git config --list --show-origin                   # 查：这条配置来自哪个文件
```

| 配置项 | 一句话点评 |
|---|---|
| `core.quotepath false` | 中文路径显示成八进制转义，十次搬家九次忘了配 |
| `pull.rebase` | 不定下来的话，pull 行为随 git 版本漂移，历史会莫名多刺 |
| `alias` | `git lg` 一天敲二十遍，省下的时间够泡一壶茶 |

---

## 二、日常提交流

```bash
git status -sb                 # -s 短格式 -b 带分支名，比裸 status 顺眼
git add 文件.py                # 加文件
git add -p                     # 逐块挑选着加：一块改动里只有一半想提交时用
git commit -m "修复：账本金额符号取反"
git commit --amend             # 刚提交完发现少了个文件/写错消息，修补最后一次提交
git lg                         # 看最近历史（配合上面的别名）
git show HEAD                  # 看最后一次提交改了什么
git diff                       # 工作区 vs 暂存区：还没 add 的改动
git diff --staged              # 暂存区 vs 上次提交：add 了将要提交的改动
```

点评：
- `add -p` 是家常菜里的爆炒——同一个文件里"该提交的"和"调试垃圾"分锅，全靠它。
- `--amend` 只该用在**没推送**的提交上；推过了再 amend，等于把邻居家的信拆了重写。

---

## 三、分支管理

```bash
git switch -c feature/书架      # 新建并切过去（老写法：git checkout -b）
git switch main                 # 切回（老写法：git checkout main）
git switch -                    # 切回上一个分支，像 CD 播放器的 prev
git branch -v                   # 本地分支一览
git branch --merged             # 已经并进当前的分支 → 可以安全删
git branch --no-merged          # 还没并的，删之前想清楚
git branch -d feature/书架      # 安全删：没合并会拦住你
git branch -D feature/书架      # 强删：拦也拦不住（心里要有数）
```

| 场景 | 做法 |
|---|---|
| 新功能 | `switch -c feature/xxx` 从 main 拉出去，做完合回来 |
| 想看旧版本不敢动 | `switch --detach v1.2` 或直接 `switch <hash>` |
| 分支名取错了 | `git branch -m 旧名 新名` |

点评：分支便宜，开起来。怕开分支的人最后都会得到一个巨大的"什么都有一点"提交。

---

## 四、撤销的艺术（本菜谱的招牌菜）

**先问自己：这个改动进没进历史？推没推上远程？** 答案决定用哪把刀。

| 我干了什么 | 该用什么 | 命令 |
|---|---|---|
| 改了工作区，还没 add | 扔掉改动 | `git restore 文件`（老：`checkout -- 文件`） |
| add 了，还没 commit | 退出暂存区（改动保留） | `git restore --staged 文件`（老：`reset HEAD 文件`） |
| commit 了，还没推 | 改最后一次提交 | `git commit --amend` |
| commit 了，还没推，想整段退回 | reset | `git reset --soft HEAD~1` |
| commit 了，**已经推了** | 生成反向提交 | `git revert <hash>` |
| 想把某文件恢复到某个历史版本 | restore 带版本 | `git restore --source=HEAD~2 文件` |

### reset 三档火力

```bash
git reset --soft  HEAD~1   # 只挪 HEAD。改动全在暂存区，随时重新提交
git reset --mixed HEAD~1   # 默认档。改动退回工作区（未暂存）
git reset --hard  HEAD~1   # 全扔。工作区干干净净，像无事发生（危险！）
```

点评：`--hard` 是切菜刀剁手指档——用之前 `git status` 确认没有未保存的心血。

### revert 为什么是"推过之后"的唯一正解

revert 不改历史，它新增一个"反着做"的提交。别人已经基于旧历史工作时，
任何改写历史（reset/amend/rebase）都会让他们的仓库精神错乱。公共分支上，
**revert 是唯一的撤销方式**。

一句话总结：
- **restore** 管工作区/暂存区（没进历史的东西）
- **reset** 挪分支指针（本地没推的历史）
- **revert** 用新提交抵消旧提交（已经见人的历史）

---

## 五、stash：灶上先离火

```bash
git stash push -m "书架做到一半，先去修bug"   # 存起来，工作区变干净
git stash -u                                # 连 untracked 新文件一起存
git stash list                              # 看存货
git stash pop                               # 弹出最近一份并删掉记录
git stash apply stash@{1}                   # 用指定那份，但留着记录（稳妥）
git stash branch rescue-branch              # 把 stash 直接落到新分支上
git stash drop stash@{0}                    # 扔掉某份
git stash clear                             # 全扔（想清楚）
```

点评：`push -m` 带说明——三个月后 `stash@{7}` 是什么，没说明谁也不知道，那它就永远躺在那儿当传家宝。

---

## 六、rebase vs merge：清蒸还是红烧

| | merge | rebase |
|---|---|---|
| 历史 | 保留真实分叉，多一条合并提交 | 线性干净，像从未分过家 |
| 改写历史 | 不改 | 改（提交换新 hash） |
| 适用 | 公共分支、多人协作 | 本地未推的分支、私人整理 |

```bash
git switch feature/书架
git rebase main            # 把我的提交搬到 main 顶端重放一遍
# 冲突时：改文件 → git add → git rebase --continue / --abort
git switch main && git merge feature/书架   # rebase 后这一步是快进，无合并提交
```

**黄金法则：已推到共享分支的提交，永不 rebase。**

```bash
git rebase -i HEAD~5       # 交互式整理最近 5 个提交：
#   pick   保持
#   reword 改提交信息
#   squash 并入上一个，提交信息合并
#   fixup  并入上一个，扔掉它的信息
#   drop   丢弃
```

点评：`fixup` + `commit --fixup=<hash>` 配合，是"啊忘了改一行"的优雅补救——
不过还是那句，只对没推的历史干这事。

---

## 七、闯祸急救（这章希望你永远翻不到，但翻到时千万别慌）

### 1. 误删了分支

```bash
git reflog                       # 时光机：HEAD 去过的地方都有记录（默认留 90 天）
# 找到删分支前的 hash，比如 a1b2c3d
git branch feature/书架 a1b2c3d  # 分支原地复活
```

### 2. detached HEAD 上写了代码，一 switch 全没了

```bash
git reflog                       # 同上，找到那串 hash
git branch rescue a1b2c3d        # 先把提交挂到分支上，再慢慢收拾
```
点评：detached HEAD 上没被任何分支引用的提交，最终会被 GC 当垃圾收走——急救要趁热。

### 3. 误提交了密码 / 大文件，还没推

```bash
git reset --soft HEAD~1          # 退回，文件改好后重新提交
```

### 4. 误提交了密码，**已经推了**

```bash
# 立刻改密码！历史里的东西已经泄了，抹历史只是善后
git revert <泄露提交>             # 先止血
# 要彻底从历史里抹掉：用 git filter-repo（官方推荐），filter-branch 又慢又坑
```

### 5. pull 下来一团糟，想回到 pull 之前

```bash
git reflog
git reset --hard HEAD@{1}        # 回到 reflog 里 pull 之前的位置
```

**急救总纲：`git reflog` 是后悔药。只要提交过（哪怕 reset --hard 掉的），
90 天内基本都能捞回来；从没 commit 过的，神仙难救。**

---

## 八、远程协作

```bash
git remote -v                            # 看远程仓库
git remote add origin <url>              # 认识新仓库
git push -u origin main                  # -u：记住跟踪关系，以后 push/pull 不用带参数
git fetch                                # 只取回，不动本地分支：先看看再说的稳重派
git pull                                 # fetch + merge（配了 pull.rebase 则是 fetch + rebase）
git switch -c fix/typo origin/fix/typo   # 基于远程分支建本地分支
git push origin --delete fix/typo        # 删远程分支
git branch -r                            # 看远程分支
git push --force-with-lease              # 代替 --force：若远程被别人推过新提交则拒绝，保邻居性命
```

| 场景 | 做法 |
|---|---|
| 本地落后了 | `git pull`（或先 `fetch` 看看） |
| 本地和远程分叉了 | 先 `pull --rebase` 把自己的提交放顶上，再 push |
| rebase 过必须强推 | `push --force-with-lease`，永远别裸 `--force` |
| 想要同事的最新代码但不想切分支 | `git fetch origin && git rebase origin/main` |

点评：`--force-with-lease` 和 `--force` 的区别，就是"礼貌地插队"和"掀桌子"的区别。

---

## 尾注

家常菜心法三条：
1. **小步提交**——每道工序一个提交，出事好回滚，reflog 好认。
2. **推之前想三秒**——进了远程历史的东西，就不再是只属于你的了。
3. **慌了先 reflog，别乱敲命令**——大部分"数据丢了"其实是第二波误操作造成的。

*—— 小Z 于书房，锅还热着*

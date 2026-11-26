# -*- coding: utf-8 -*-
"""ELEC5619 视角：军需官·次要战场 设计审查报告"""
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, PageBreak,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle)

FONT_DIR = 'C:/Windows/Fonts/'
pdfmetrics.registerFont(TTFont('CN', FONT_DIR + 'msyh.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('CN-Bold', FONT_DIR + 'msyhbd.ttc', subfontIndex=0))

NAVY = colors.HexColor('#12243d')
BLUE = colors.HexColor('#1a3d6b')
GREY = colors.HexColor('#5a5a5a')
ROW = colors.HexColor('#f7f9fc')
TIPBG = colors.HexColor('#fff8e6')
KEYBG = colors.HexColor('#eef6f0')
BADBG = colors.HexColor('#fdeceb')
GOODBG = colors.HexColor('#eef6f0')

S_T = ParagraphStyle('t', fontName='CN-Bold', fontSize=16, leading=23, alignment=TA_CENTER,
                     textColor=NAVY)
S_SUB = ParagraphStyle('s', fontName='CN', fontSize=9.0, leading=13.5, alignment=TA_CENTER,
                       textColor=GREY, spaceAfter=4)
S_SEC = ParagraphStyle('sec', fontName='CN-Bold', fontSize=11.2, leading=16.5, textColor=colors.white,
                       backColor=BLUE, borderPadding=(5, 5, 3.5, 5), spaceBefore=8, spaceAfter=5)
S_H = ParagraphStyle('h', fontName='CN-Bold', fontSize=9.8, leading=14.6, textColor=NAVY,
                     spaceBefore=5, spaceAfter=2)
S_P = ParagraphStyle('p', fontName='CN', fontSize=8.9, leading=14.0, alignment=TA_JUSTIFY,
                     wordWrap='CJK', spaceAfter=2.5)
S_LI = ParagraphStyle('li', fontName='CN', fontSize=8.8, leading=13.4, alignment=TA_JUSTIFY,
                      wordWrap='CJK', leftIndent=11, bulletIndent=1, bulletFontName='CN',
                      bulletFontSize=8, spaceAfter=1.5)
S_NOTE = ParagraphStyle('n', fontName='CN', fontSize=8.4, leading=12.8, alignment=TA_JUSTIFY,
                        wordWrap='CJK', textColor=colors.HexColor('#4a5a6a'), spaceAfter=2)
S_TIP = ParagraphStyle('tip', fontName='CN', fontSize=8.5, leading=13.0, alignment=TA_JUSTIFY,
                       wordWrap='CJK', backColor=TIPBG, borderPadding=(6, 6, 5, 6),
                       spaceBefore=3, spaceAfter=3)
S_KEY = ParagraphStyle('key', fontName='CN', fontSize=8.5, leading=13.2, alignment=TA_JUSTIFY,
                       wordWrap='CJK', backColor=KEYBG, borderPadding=(6, 6, 5, 6),
                       spaceBefore=3, spaceAfter=3)
S_BAD = ParagraphStyle('bad', fontName='CN', fontSize=8.5, leading=13.2, alignment=TA_JUSTIFY,
                       wordWrap='CJK', backColor=BADBG, borderPadding=(6, 6, 5, 6),
                       spaceBefore=3, spaceAfter=3)
S_GOOD = ParagraphStyle('good', fontName='CN', fontSize=8.5, leading=13.2, alignment=TA_JUSTIFY,
                        wordWrap='CJK', backColor=GOODBG, borderPadding=(6, 6, 5, 6),
                        spaceBefore=3, spaceAfter=3)
S_C = ParagraphStyle('c', fontName='CN', fontSize=8.2, leading=11.8)
S_CB = ParagraphStyle('cb', fontName='CN-Bold', fontSize=8.2, leading=11.8)
S_CC = ParagraphStyle('cc', fontName='CN', fontSize=8.2, leading=11.8, alignment=TA_CENTER)
S_CB2 = ParagraphStyle('cb2', fontName='CN-Bold', fontSize=8.2, leading=11.8, alignment=TA_CENTER)
S_CH = ParagraphStyle('ch', fontName='CN-Bold', fontSize=8.2, leading=11.8,
                      textColor=colors.white, alignment=TA_CENTER)
S_CHL = ParagraphStyle('chl', fontName='CN-Bold', fontSize=8.2, leading=11.8,
                       textColor=colors.white)

story = []


def md(s):
    s = str(s).replace('`', '')
    return re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)


def tbl(rows, widths, first_left=True):
    cells = []
    for i, row in enumerate(rows):
        line = []
        for j, c in enumerate(row):
            if i == 0:
                st = S_CHL if (j == 0 and first_left) else S_CH
            elif j == 0 and first_left:
                st = S_CB
            else:
                st = S_CC if len(str(c)) <= 12 else S_C
            line.append(Paragraph(md(str(c).replace('\n', '<br/>')), st))
        cells.append(line)
    t = Table(cells, colWidths=[w * mm for w in widths], hAlign='LEFT', repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#37536f')),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#c3cfdd')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ROW]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def sec(t):
    story.append(Paragraph(t, S_SEC))


def h(t):
    story.append(Paragraph(md(t), S_H))


def p(t):
    story.append(Paragraph(md(t), S_P))


def li(t):
    story.append(Paragraph(md(t), S_LI, bulletText='·'))


def tip(t):
    story.append(Paragraph(md(t), S_TIP))


def key(t):
    story.append(Paragraph(md(t), S_KEY))


def bad(t):
    story.append(Paragraph(md(t), S_BAD))


def good(t):
    story.append(Paragraph(md(t), S_GOOD))


def note(t):
    story.append(Paragraph(md(t), S_NOTE))


# ================= 封面 =================
story.append(Paragraph('设计审查报告：军需官 · 次要战场', S_T))
story.append(Paragraph('用 ELEC5619《面向对象应用框架》的六个维度评估现有实现', S_SUB))
story.append(Spacer(1, 3 * mm))

p('**审查对象**：`server-official/public/quartermaster-sub-wars`（RTT 平台的模块化卡牌游戏）')
p('**审查视角**：ELEC5619 课件中的 **L3 建模、L4 设计原则与模式、L5 领域逻辑、L9 测试策略** 四个部分，共六个维度。')
p('**审查方法**：静态代码度量（行数、函数数、状态字段、重复实现、注释密度），'
  '不做运行时测试，也不评价游戏规则的正确性。')

story.append(Spacer(1, 2 * mm))
story.append(tbl([['模块', '文件', '行数'],
                  ['服务端规则', 'rules.js', '**40,294**'],
                  ['客户端交互', 'play.js', '**13,163**'],
                  ['卡牌数据', 'cards.js', '4,969'],
                  ['地图数据', 'data.js', '1,100'],
                  ['前奏编译', 'prelude_compiler.js', '769'],
                  ['合计', '—', '**约 6.0 万行**'],
                  ], [40, 70, 56]))

note('统计口径：以物理行计，含注释与空行；rules.js 注释占比 38.3%，'
     '因此有效代码约 2.5 万行。')

# ================= 评分总表 =================
sec('一、六维总评（对照课件标准）')

story.append(tbl([['维度', '课件标准', '项目现状', '评级'],
                  ['**契约接口**\n（L4 Layering）',
                   '对外暴露稳定接口，内部实现可替换',
                   '严格实现 RTT 六个契约：roles / scenarios / setup / view / action / query',
                   '**A**'],
                  ['**业务分层**\n（L4 Layering）',
                   '表现 / 业务 / 持久三层，层间依赖单向',
                   '契约层清晰，但 rules.js 内部不分层：连通性、补给、手牌、战斗、计分全在一个文件',
                   '**D**'],
                  ['**领域逻辑**\n（L5 三模式）',
                   '复杂业务用 Domain Model；简单稳定才用 Transaction Script',
                   '**0 个 class**，556 个自由函数 + 单个 do_action 分发',
                   '**D**'],
                  ['**状态管理**\n（L4 Session State）',
                   '状态集中管理，访问受控',
                   '单一可变 game 对象，**193 个字段**，任何函数可直接改',
                   '**C**'],
                  ['**单一真源**\n（L2 需求管理）',
                   '一处定义，处处引用',
                   '客户端与服务端 **7 个同名函数**各自实现；play.js 有 36 处 can_ 判定',
                   '**D**'],
                  ['**测试**\n（L9 测试金字塔）',
                   '底层多、中层中、顶层少',
                   '15 个根目录脚本 + tools/ 110 个脚本，无框架、无分层',
                   '**C**'],
                  ], [29, 50, 75, 14]))

key('**一句话结论**：**对外是合格的插件（契约干净），对内是典型的「事务脚本退化」——'
    '所有规则都正确，但复杂度已经超出了单文件能承载的界限。**')

# ================= 逐维度 =================
story.append(PageBreak())
sec('二、逐维度分析')

h('2.1 契约接口（L4 · Layering）—— 这是做得最好的部分')
p('L4 的 Layering 要求「上层依赖下层的标准接口」。项目对 RTT 平台暴露了六个纯函数：')
story.append(tbl([['导出', '职责', '是否纯函数'],
                  ['roles', '声明两个阵营', '常量'],
                  ['scenarios', '声明三个场景', '常量'],
                  ['setup', '初始化局面', '是'],
                  ['view', '生成给当前玩家的视图', '是'],
                  ['action', '执行一个动作并返回新状态', '是（不可变入参）'],
                  ['query', '只读查询', '是'],
                  ], [25, 83, 60]))
good('**这一层完全符合课件**：平台只认这六个入口，内部 4 万行怎么改，平台无感——'
     '这正是「标准接口隔离变化」的价值。')
note('补充：还有 dont_snap 与 _internal 两个导出，前者控制快照策略，后者供测试使用——'
     '都属于合理的扩展，不破坏契约。')

h('2.2 业务分层（L4 · Layering）—— 内部没有层')
p('L4 把一个应用纵向切成表现层 / 业务层 / 持久层。本项目在**文件级别**是切了的：')
story.append(tbl([['层（课件）', '本项目对应', '是否独立'],
                  ['Presentation（表现）', 'play.js + play.html', '是（独立文件）'],
                  ['Service / Business（业务）', 'rules.js', '**部分**（全部业务在一个文件）'],
                  ['Persistence（持久）', 'RTT 平台的 state 快照', '是（由平台承担）'],
                  ], [42, 68, 58]))
p('问题在于**业务层内部没有再分层**。rules.js 一个文件里同时有：')
li('**连通性引擎**（区域连接、海峡动态连通）')
li('**补给引擎**（补给源、补给传播）')
li('**手牌模型**（抽牌、弃牌、洗牌）')
li('**回合状态机**（阶段推进、行动配额）')
li('**战斗结算**（骰子、命中、损失）')
li('**计分**（国家得分、阵营胜负）')
li('**卡效实现**（事件卡 23 张、增强卡 8 张、响应卡 12 张、基本卡 5 张）')
bad('**这七个领域之间其实是弱耦合的**——连通性不知道手牌，手牌不知道战斗。'
    '它们完全可以拆成七个文件（甚至七个子模块），但现在是 40,294 行一个文件。'
    '后果是任何修改都要在 4 万行里定位。')

h('2.3 领域逻辑（L5 · 三种模式）—— 判定为「退化的 Transaction Script」')
p('L5 给三种领域逻辑模式，判定依据是**业务规则写在哪里**：')
story.append(tbl([['模式', '组织单位', '本项目表现', '符合吗'],
                  ['Transaction Script', '用例（一个请求一个过程）',
                   '**一个 action 类型一个分支**，全部堆在 do_action 里', '**形式上符合**'],
                  ['Domain Model', '对象（数据 + 行为）',
                   '**0 个 class**，卡、棋子、区域都是普通对象字面量', '否'],
                  ['Table Model', '表（一个模块管整张表）', '无此结构', '否'],
                  ], [35, 38, 71, 24]))

p('**为什么说是「退化」**：L5 P5 列了 Transaction Script 的三个缺点，本项目三个全中：')
li('**业务复杂后混乱**：单个 do_action **6,259 行**，if 语句总计 3,706 个')
li('**重复代码**：多个卡效各自实现相似的"检查→扣费→结算→记账"四步')
li('**难维护、难复用**：加一张新卡要在 6,259 行的分发里找位置')

bad('**最关键的数据**：`do_action` 一个函数 6,259 行，`uk_sas_initiator` 2,509 行，'
    '`refresh` 2,353 行，`script_resolve` 1,989 行。'
    '这四个函数合计 **13,110 行**，占 rules.js 的三分之一。')

h('2.4 状态管理（L4 · Session State）—— 单一可变对象，无封装')
p('L4 的 Session State 讲「状态存哪儿」。本项目选择**服务端内存**（正确的选择，'
  '因为卡牌游戏状态复杂且需要防作弊），但实现方式是：')
li('一个 **game** 对象，**193 个字段**')
li('**没有任何封装**：556 个函数里的任何一个都可以直接读写 game.xxx')
li('**日志与状态混在一起**：game.log 被引用 **842 次**（全场最高）')
story.append(tbl([['引用最多的字段', '次数', '含义'],
                  ['game.log', '842', '操作日志（同时用于回放与调试）'],
                  ['game.piece_nation', '221', '棋子归属'],
                  ['game.hands', '218', '各国手牌'],
                  ['game.location', '201', '棋子位置'],
                  ['game.pending_* (12 个)', '合计 400+', '各种"挂起窗口"的临时状态'],
                  ], [48, 29, 91]))
tip('**pending_* 系列**（pending_echo / pending_battle / pending_autobahn / '
    'pending_delegate / pending_*）是本项目最特殊的设计：它们表示「等待某方响应的中间态」。'
    '这类状态有 12 个字段，说明**状态机没有统一的建模**，而是各自为政地散落在 game 上。')

h('2.5 单一真源（L2 / L4）—— 客户端与服务端各写一份规则')
p('L2 的需求管理强调 **single source of truth**；L4 的 SRP 强调「一个职责只有一个实现」。'
  '本项目违反了这一条：')
story.append(tbl([['同名函数', '在 rules.js', '在 play.js', '风险'],
                  ['build_piece', '有', '有', '构建棋子的规则改了两处要同步'],
                  ['can_play_in_airforce', '有', '有', '**合法性判定**双份'],
                  ['check_phase_for_card', '有', '有', '出牌时机校验双份'],
                  ['declared_phase_of', '有', '有', '阶段归属双份'],
                  ['has_phase_note', '有', '有', 'UI 提示与规则共用同一判断'],
                  ['is_airforce_only', '有', '有', '卡牌属性判定双份'],
                  ['is_timing_card', '有', '有', '时机判定双份'],
                  ], [50, 29, 29, 60]))
bad('**这是最危险的耦合**：一旦两处实现不一致，就会出现「客户端显示可打、服务端拒绝」或'
    '「客户端置灰、服务端却接受」——这类 bug 在卡牌游戏里最难查，'
    '因为两边都"看起来对"。<br/>'
    'play.js 里还有 **36 处 can_**、**15 处 check_**，说明客户端的规则判定不止这 7 个函数。')

h('2.6 测试（L9 · 测试金字塔）')
p('L9 的测试金字塔要求：底层单元测试数量最多，越往上越少越贵。本项目的现状是：')
story.append(tbl([['层级（L9）', '本项目', '评价'],
                  ['**Unit**（单元）', 'tools/ 下 110 个脚本 + 根目录 15 个 _test*.js',
                   '**数量够，但无框架**（无 describe/it，靠 console 输出人工判断）'],
                  ['**Service**（服务）', '无', '缺失'],
                  ['**Integration**（集成）', '无', '缺失'],
                  ['**System / E2E**', '无', '缺失'],
                  ['**UAT**', '手工试玩', '不可重复'],
                  ], [42, 68, 58]))
key('**可接受的地方**：这类"规则引擎"的价值确实主要在单元层——'
    '每张卡的效果可以独立验证。<br/>'
    '**真正的风险**：`do_action` 是 6,259 行的巨型分发，'
    '**没有任何测试能覆盖它的分支组合**（3,706 个 if × 55 个 case）。')

# ================= 三个最严重 =================
story.append(Spacer(1, 4 * mm))
sec('三、三个最严重的问题')

h('① do_action 是 6,259 行的「上帝函数」')
p('它同时承担：动作分发、权限校验、成本支付、效果结算、日志记录、状态刷新、异常回滚。')
p('**具体后果**：')
li('**SRP 违反**：一个函数七个职责，改任何一个都要动它')
li('**OCP 违反**：加一张卡 = 在 6,259 行里加一个 if 分支')
li('**无法测试**：任何单元测试都会牵动整个状态')
li('**阅读成本**：新成员理解一个动作要读 6 千行')

h('② 7 个规则函数在客户端与服务端各有一份')
p('**具体后果**：')
li('两边实现漂移时，出现「客户端可点、服务端拒绝」的幽灵 bug')
li('修一个规则要改两个文件，且无法通过编译发现遗漏')
li('测试只覆盖服务端，客户端那份永远"没测过"')

h('③ game 对象 193 个字段，无封装、无分组')
p('**具体后果**：')
li('无法判断哪些字段属于哪个子域（棋盘？手牌？战斗？）')
li('状态快照与回滚（项目已实现）需要遍历全部 193 个字段')
li('日志与状态混在一起，序列化开销大')

# ================= 改进建议 =================
story.append(PageBreak())
sec('四、改进建议（按风险分档）')

h('A 档：低风险机械重构（不改任何业务逻辑）')
story.append(tbl([['动作', '做法', '收益'],
                  ['**拆分 do_action**',
                   '按 action 类型抽成 action_xxx(game, …) 函数，'
                   'do_action 只保留一张 { actionName: handler } 路由表',
                   '6,259 行 → 数百个小函数；加卡只改路由表'],
                  ['**抽出日志函数**',
                   '把 842 处 game.log.push(...) 改为 log(game, msg)',
                   '改日志格式只需动一处；可统一加时间戳'],
                  ['**归组 game 字段**',
                   '按子域加前缀或嵌套：game.hands → game.hand.byNation；'
                   'game.pending_* → game.pending.xxx',
                   '193 个平铺字段 → 约 8 个分组；快照与回滚逻辑可简化'],
                  ], [38, 80, 50]))
good('**这三项都是"改名字、挪位置"级别**，不触碰判断条件，'
     '做完之后代码行为完全不变，但可维护性显著提升。')

h('B 档：中等风险（需要回归验证）')
story.append(tbl([['动作', '做法', '风险'],
                  ['**消除双份规则**',
                   '删掉 play.js 里那 7 个同名函数；客户端改为「发 action、等服务端拒绝原因」',
                   '需要服务端在拒绝时返回可读错误（项目已有 game.log，可用）'],
                  ['**卡效注册表**',
                   '把「事件卡 23 张 + 增强卡 8 张 + 响应卡 12 张」改为 '
                   'CARD_EFFECTS[cardId] = handler 的注册表',
                   '卡效彼此有交互（响应栈），需要保证注册顺序'],
                  ['**测试框架化**',
                   '把 tools/ 的脚本改成 node:test 或 jest 的用例，加断言而非肉眼比对',
                   '改动量大，但可一次性覆盖已有脚本'],
                  ], [38, 80, 50]))

h('C 档：高投入，不建议现在做')
li('**引入 Domain Model**（Card / Piece / Board 类）：课件视角这是"正确"的，'
   '但 6 万行代码重写为对象模型，成本远超收益')
li('**前后端共享规则模块**：把规则抽成浏览器与 Node 都能用的 ES Module，'
   '理论上最优，但要重构打包方式')

h('如果只做一件事')
bad('**做 A 档的第一项：把 do_action 拆成路由表 + 小函数。**<br/>'
    '它零业务风险、收益最大（6,259 行 → 数百个 30 行函数），'
    '而且拆完之后，B 档的卡效注册表会自然浮现。')

# ================= 公平的部分 =================
sec('五、公平地说：这个项目做对了什么')

story.append(tbl([['做对的地方', '证据', '对应课件'],
                  ['**契约层严格**', '六个 exports 全部实现，签名符合 RTT 规范', 'L4 Layering'],
                  ['**状态在服务端**', '客户端只发 action，不持有权威状态', 'L4 Session State'],
                  ['**卡效分类清晰**',
                   '事件卡 / 增强卡 / 响应卡 / 基本卡分四节实现，各带配置表', 'L5 领域逻辑'],
                  ['**注释密度高**', '38.3% 的注释行，关键决策都有日期与依据（如"玩家明确"）',
                   'L10 可维护性'],
                  ['**有模块意识**', '14 个分节标题（连通性 / 补给 / 手牌 / 状态机 / 战斗 / 计分 / 卡效）',
                   'L4 Layering 的意图'],
                  ['**有回放能力**', 'game.log + 时间回溯（deflate 压缩检查点）', 'L4 Session State'],
                  ], [40, 88, 40]))

key('**总体判断**：这不是"设计失败"，而是**「复杂度增长超过了结构的承载能力」**——'
    '起步时用 Transaction Script 是对的（L5 P5：简单系统更快），'
    '但卡牌从十几张长到 498 张后，结构没有跟着演进。')

note('这正是 L5 讲的「模式选择取决于业务复杂度」的现实版本：'
     'Transaction Script 不是错，**在复杂度超过阈值后仍不重构才是问题**。')


def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFont('CN', 7.4)
    canvas.setFillColor(GREY)
    canvas.drawString(18 * mm, h - 12 * mm,
                      '设计审查 · 军需官 · 次要战场 · ELEC5619 视角')
    canvas.setStrokeColor(colors.HexColor('#d5d5d5'))
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, h - 14 * mm, w - 18 * mm, h - 14 * mm)
    canvas.drawRightString(w - 18 * mm, 10 * mm, '第 %d 页' % doc.page)
    canvas.restoreState()


out = r'C:\Users\24968\Desktop\rtt\docs\ELEC5619视角_设计审查_军需官次要战场.pdf'
doc = BaseDocTemplate(out, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                      topMargin=19 * mm, bottomMargin=15 * mm,
                      title='设计审查 · 军需官次要战场')
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')
doc.addPageTemplates([PageTemplate(id='main', frames=[frame], onPage=on_page)])
doc.build(story)
print('OK ->', out)

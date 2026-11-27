# -*- coding: utf-8 -*-
"""前奏架构设计：Episode 2 门前惊雷"""
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, PageBreak, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle, XPreformatted)

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
CODEBG = colors.HexColor('#f4f6f8')

S_T = ParagraphStyle('t', fontName='CN-Bold', fontSize=15.5, leading=22, alignment=TA_CENTER,
                     textColor=NAVY)
S_SUB = ParagraphStyle('s', fontName='CN', fontSize=9.0, leading=13.5, alignment=TA_CENTER,
                       textColor=GREY, spaceAfter=4)
S_SEC = ParagraphStyle('sec', fontName='CN-Bold', fontSize=11.0, leading=16.2, textColor=colors.white,
                       backColor=BLUE, borderPadding=(5, 5, 3.5, 5), spaceBefore=7, spaceAfter=4)
S_H = ParagraphStyle('h', fontName='CN-Bold', fontSize=9.6, leading=14.4, textColor=NAVY,
                     spaceBefore=4, spaceAfter=1.6)
S_P = ParagraphStyle('p', fontName='CN', fontSize=8.8, leading=13.8, alignment=TA_JUSTIFY,
                     wordWrap='CJK', spaceAfter=2.2)
S_LI = ParagraphStyle('li', fontName='CN', fontSize=8.7, leading=13.2, alignment=TA_JUSTIFY,
                      wordWrap='CJK', leftIndent=11, bulletIndent=1, bulletFontName='CN',
                      bulletFontSize=8, spaceAfter=1.2)
S_NOTE = ParagraphStyle('n', fontName='CN', fontSize=8.3, leading=12.6, alignment=TA_JUSTIFY,
                        wordWrap='CJK', textColor=colors.HexColor('#4a5a6a'), spaceAfter=1.6)
S_TIP = ParagraphStyle('tip', fontName='CN', fontSize=8.4, leading=12.8, alignment=TA_JUSTIFY,
                       wordWrap='CJK', backColor=TIPBG, borderPadding=(6, 6, 5, 6),
                       spaceBefore=2.5, spaceAfter=2.5)
S_KEY = ParagraphStyle('key', fontName='CN', fontSize=8.4, leading=13.0, alignment=TA_JUSTIFY,
                       wordWrap='CJK', backColor=KEYBG, borderPadding=(6, 6, 5, 6),
                       spaceBefore=2.5, spaceAfter=2.5)
S_BAD = ParagraphStyle('bad', fontName='CN', fontSize=8.4, leading=13.0, alignment=TA_JUSTIFY,
                       wordWrap='CJK', backColor=BADBG, borderPadding=(6, 6, 5, 6),
                       spaceBefore=2.5, spaceAfter=2.5)
S_CODE = ParagraphStyle('code', fontName='Courier', fontSize=7.0, leading=9.6,
                        backColor=CODEBG, borderPadding=(6, 6, 5, 6),
                        spaceBefore=2, spaceAfter=2)
S_CODE_CN = ParagraphStyle('codecn', fontName='CN', fontSize=7.2, leading=10.8,
                           backColor=CODEBG, borderPadding=(6, 6, 5, 6),
                           spaceBefore=2, spaceAfter=2)
S_C = ParagraphStyle('c', fontName='CN', fontSize=8.1, leading=11.6)
S_CB = ParagraphStyle('cb', fontName='CN-Bold', fontSize=8.1, leading=11.6)
S_CC = ParagraphStyle('cc', fontName='CN', fontSize=8.1, leading=11.6, alignment=TA_CENTER)
S_CH = ParagraphStyle('ch', fontName='CN-Bold', fontSize=8.1, leading=11.6,
                      textColor=colors.white, alignment=TA_CENTER)
S_CHL = ParagraphStyle('chl', fontName='CN-Bold', fontSize=8.1, leading=11.6,
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
        ('TOPPADDING', (0, 0), (-1, -1), 2.2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.2),
        ('LEFTPADDING', (0, 0), (-1, -1), 3.5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3.5),
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


def note(t):
    story.append(Paragraph(md(t), S_NOTE))


def code(lines):
    out = []
    for l in lines:
        body = l.lstrip(' ')
        pad = ' ' * ((len(l) - len(body)) * 2)
        s = pad + body
        out.append(s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))
    text = '\n'.join(out)
    st = S_CODE if text.isascii() else S_CODE_CN
    story.append(XPreformatted(text, st))


# ================= 封面 =================
story.append(Paragraph('前奏架构设计：Episode 2 门前惊雷', S_T))
story.append(Paragraph('从规则书到可落地的模块划分 · 含上次失败的 5 个坑', S_SUB))
story.append(Spacer(1, 2.5 * mm))

p('**规则来源**：`easy_rule/3.png`、`easy_rule/4.png`（Episode 2 门前惊雷 A/B 两节）。')
p('**当前代码状态**：`rules.js` 第 26 行写着「**前奏引擎已移除，重做后再接回**」，'
  '`scenarios` 只剩 `Standard`；残留 18 处前奏注释与一个 `prelude_specs.js`（4 张 DIY 试作牌）。')
p('**本方案目标**：给出从零实现前奏的模块划分、状态模型、动作契约、效果 DSL 与分步实施顺序，'
  '并显式规避上次失败的五个坑。')

story.append(Spacer(1, 2 * mm))
key('**一句话设计取向**：前奏必须做成**独立模块**（4 个文件 + 1 个聚合入口），'
    '`rules.js` 只保留 6 个薄接入点，外加 2 道「前奏期不触发」守卫——'
    '**绝不重演把前奏塞进 do_action 的老路**。')

# ================= 一、规则 =================
sec('一、规则提取（把规则书整理成可编码的形式）')

h('1.1 前奏与正式局的差异')

story.append(tbl([['项', '前奏期', '正式局'],
                  ['开局手牌', '正常抽正式手牌，**再摸 2 张前奏牌**', '只抽正式手牌'],
                  ['计分标记', '**<东欧><巴尔干><中国东北> 不加**', '照常加'],
                  ['牌堆构成', '**删除 4 张正式牌**（见 1.5）', '完整牌堆'],
                  ['**计分阶段**', '**没有**（前奏回合只有「行动 + 卡牌」两阶段）', '有（第 5 阶段）'],
                  ['**分数变化**', '**牌面效果可直接加分**（作者裁定：前奏算分）', '靠计分阶段累计'],
                  ['**补给计算**', '**不执行**（但建造、战斗仍参考补给规则）', '执行'],
                  ['牌的可触发性', '**正式牌不触发；军备卡可触发；国家技能可用**', '全部可触发'],
                  ], [30, 80, 56]))

h('1.2 前奏的启动时机（作者确认）')

p('前奏**不是开局就发牌**的。完整时序是：**开局抽 10 张正式手牌 → 各国依次弃 3 留 7 → '
  '全部弃完后，才发前奏手牌 → 前奏开始**。')

code([
    "setup()",
    "  ├─ 洗正式牌堆，各国抽 10 张        （OPENING_DRAW，rules.js 第 1410 行）",
    "  └─ prelude.init()                建结构 / 洗前奏牌堆 / tension=0，active=false",
    "        ↓",
    "start_opening_phase()               建 game.opening = { index: 0 }（第 26859 行）",
    "        ↓",
    "do_opening_discard() × 6            各国依次弃 3 留 7（第 26923 行）",
    "        ↓",
    "【全部弃完】  ← 只有走到这里才发前奏牌（第 26963 行）",
    "  ├─ prelude.start()               各国摸 2 张前奏手牌 / active=true / 进入 action 阶段",
    "  └─ game.opening = null",
])

key('**这条时序对架构的直接影响**：前奏的生命周期必须**分两个入口**——'
    '`init()` 在 setup 里只建结构（`enabled=true, active=false`），'
    '`start()` 在 `do_opening_discard` 的「全部弃完」处才发牌并置 `active`。<br/>'
    '如果像最初设计那样在 setup 里直接发前奏手牌，玩家会**在弃 3 阶段就看到不该有的牌**。')

note('代码依据：`OPENING_DRAW = 10`（第 1410 行，"抽 10 弃 3 留 7"）、'
     '`start_opening_phase`（第 26859 行）、`do_opening_discard`（第 26923 行）、'
     '第 26963–26964 行的"全部弃完 → game.opening = null"。')

h('1.3 前奏的回合结构（每国一轮）')

p('前奏按正常游戏顺序（德 → 英 → 日 → 苏 → 意 → 美）执行回合，每国在一轮里走两个阶段：')

story.append(tbl([['阶段', '可选动作', '是否必做'],
                  ['**行动阶段**',
                   '① 打出 1 张前奏手牌　② 打出前奏牌堆顶　'
                   '（二者**选其一**，不可跳过）<br/>'
                   '**另可反复执行**：弃 1 张前奏手牌 + 弃**牌堆顶**的牌 —— '
                   '**不占行动次数**，只为换掉不想要的牌堆顶',
                   '**不可跳过**'],
                  ['**卡牌阶段**',
                   '按顺序：① **弃置所有**前奏手牌　② **摸 2 张**前奏牌',
                   '**不可跳过**'],
                  ], [30, 106, 36]))

key('**「弃牌换牌」的正确理解（作者裁定）**：它**不是**「额外一次行动」，'
    '而是**一个不占行动次数的调整动作**——只要手上还有前奏手牌、牌堆还有牌，就可以反复执行，'
    '每次「弃 1 张手牌 + 弃掉牌堆顶」，让下面一张露出来。<br/>'
    '**行动阶段最终仍然只打出一次**（手牌或牌堆顶），这是「不可跳过」的含义。'
    '所以实现上**不需要 `extra_play` 计数器**，只需要一个「可反复执行的 swap 动作」+ 一个「真正打出」的动作。')

h('1.4 前奏的结束条件（经作者确认：只有两个）')

story.append(tbl([['条件', '判定时机', '规则书原文'],
                  ['**① 牌全部耗尽**', '一轮结束后',
                   '一轮结束后，所有玩家的手牌和牌堆中都没有牌'],
                  ['**② 紧张度达到 10**', '**当前前奏回合结束时**（不是立刻）',
                   '紧张度达到 10，当前前奏回合结束时'],
                  ], [40, 56, 76]))

note('**作者已裁定：结束条件只有这两个。** 规则书写的「三个时机」是笔误，'
     '实现时不要为第三条留空位，`checkEnd()` 只写两条判定即可。')

bad('**②的时机很容易做错**：紧张度到 10 时**不能立即结束**，'
    '必须等当前国家的回合走完（含卡牌阶段的弃牌与摸牌）。'
    '否则会出现「刚摸到的牌没机会用」的不公平。')

h('1.5 牌堆变动（B 节）')

story.append(tbl([['国家', '删除的卡牌'],
                  ['日本', '伪满洲国、卢沟桥事变'],
                  ['苏联', '苏德友好条约'],
                  ['意大利', '埃塞俄比亚战争后勤'],
                  ['美国', '花园口决堤'],
                  ], [30, 100]))
note('实现方式：setup 时按 scenario=Episode 2 从正式牌堆里剔除这 5 张（日本两项）。'
     '建议用**卡名到 id 的查表**而非硬编码 id，避免卡库重构后失效。')

h('1.6 前奏牌的效果结构（最关键的一条）')

p('规则书 A 节原话：')
story.append(tbl([['原文', '含义'],
                  ['结算前奏手牌时，打出后执行**第一段**【条件与其后的效果】；'
                   '之后若满足**第二段**【条件】，执行其后的效果。',
                   '每张前奏牌是**两段式**结构：段 1 必结算；段 2 视条件触发'],
                  ], [110, 62]))

key('**这条决定了效果 DSL 的形态**——不能用「一个函数搞定」，'
    '必须建模成 `{ seg1: {when, effects}, seg2: {when, effects} }` 的对象。'
    '这也是本次重做与"随手写 if"的分水岭。')

# ================= 二、上次失败的坑 =================
story.append(Spacer(1, 4 * mm))
sec('二、上次失败的五个坑（从残留注释还原）')

p('代码里仍有 18 处前奏注释，它们记录的全是**踩过的坑**。重做时这五条必须预先设计，'
  '而不是等出 bug 再补。')

story.append(tbl([['#', '坑', '注释原文（节选）', '架构上的对策'],
                  ['①', '**动作白名单顺序**',
                   '第 36803 行：「前奏动作在所有正式期守卫之前分发（双门禁之二）……'
                   '否则前奏动作会绕过『除四动作外一律不接』」',
                   '前奏 action 的拦截必须放在 do_action **最前面**，早于任何正式期守卫'],
                  ['②', '**视图可见性**',
                   '第 29669 行：「前奏视图：牌堆顶『始终对自己可见』（规则书 :128），但……」',
                   'view 里 `topCard` 只对**当前行动国**下发，其他国拿 null'],
                  ['③', '**状态必须落盘**',
                   '第 27455 行：「前奏统一实现层状态（随存档 JSON 落盘，**不靠惰性兜底**）」',
                   'setup 时一次性建好 `game.prelude` 全字段，运行时不再 `||=` 补'],
                  ['④', '**挂起不能被冻结**',
                   '第 37293 行：「必须回答的前奏触发代价挂起，不能被预算冻结挡住」',
                   '前奏的"必须回答"类挂起，优先级高于正式期的打牌预算冻结'],
                  ['⑤', '**前后端判定同源**',
                   '第 31009 行：「否则客户端看得见前奏按钮、点了却被拒（白名单死锁）」',
                   '按钮可用性**只由服务端 view.can 决定**，客户端不自行判断'],
                  ], [10, 30, 76, 56]))

key('**这五条的共同点**：都不是业务规则问题，而是**接入层的顺序与边界问题**。'
    '所以架构上必须把「前奏」做成一个**边界清晰的模块**，'
    '让它的动作、状态、视图各有一个唯一入口，而不是散落在 rules.js 里。')

# ================= 三、架构 =================
sec('三、架构总览')

h('3.1 模块划分（4 个文件，不碰 rules.js 的主体）')

code([
    "prelude/",
    "  index.js      聚合入口（rules.js 只 require 这一个）",
    "  state.js      状态：init / start / 结束判定 / 结束清理",
    "  cards.js      牌库：两段式效果 DSL 表（纯数据）",
    "  engine.js     引擎：阶段机 / 11 个动作 / 结算栈 / 挂起",
    "  view.js       视图：给客户端的前奏面板（按玩家裁剪）",
])

story.append(tbl([['文件', '职责', '不做什么'],
                  ['**prelude/state.js**',
                   '创建 `game.prelude`、读写字段、发牌、判断是否该结束、结束后清理',
                   '不碰任何卡牌效果'],
                  ['**prelude/cards.js**',
                   '定义每张前奏牌的 `seg1/seg2`（纯数据 + 条件函数）',
                   '不碰阶段推进'],
                  ['**prelude/engine.js**',
                   '推进阶段、校验动作合法性、结算栈与挂起、维护紧张度',
                   '不直接改正式期字段（分数、补给标记走注入的原子）'],
                  ['**prelude/view.js**',
                   '组装 `view.prelude`，按当前玩家裁剪牌堆顶与手牌',
                   '不做任何状态变更'],
                  ], [40, 76, 46]))

h('3.2 rules.js 只加 6 个接入点 + 2 道触发守卫')

story.append(tbl([['接入点', '位置', '代码形态'],
                  ['**setup**', '`setup()` 内、`start_opening_phase` **之前**',
                   '`prelude.init(...)`　只建结构 + 剔除 5 张正式牌，**不发牌**'],
                  ['**弃 3 完成**', '`do_opening_discard()` 的「全部弃完」处',
                   '`prelude.start(...)`　这里才发 2 张；并**跳过正式第一回合初始化**'],
                  ['**action**', '`do_action()` **最前面**',
                   '`if (isPreludeAction(action)) return prelude.handle(...)`'],
                  ['**动作白名单**（最易漏）', '`build_actions_inner()` **最前面**',
                   '`if (prelude.active) return { log:1, ... }`　'
                   '**少了它 = 客户端点了没反应**'],
                  ['**view**', '`view()` 的返回对象',
                   '`prelude: prelude.buildView(game, nation, { factionOf })`'],
                  ['**回合推进**', '前奏由自己接管（`nextNation` 在 engine 内）',
                   '正式期 `next_nation` 在前奏期走不到'],
                  ['**响应卡守卫**', '`request_responses()` **第一行**',
                   '`if (game.prelude && game.prelude.active) return null`　'
                   '**少了它 = 前奏可能卡死**'],
                  ['**军备卡守卫**', '`offer_armed_effects()` **第一行**',
                   '同上：前奏期不触发军备卡 / 增强卡'],
                  ], [26, 62, 74]))

key('**第 4 个是最容易漏、后果最严重的**：客户端 `send_action` 的 shim 会检查 '
    '`view.actions[verb]`，键不存在就**静默 return false** —— 按钮亮着、点了毫无反应、'
    '控制台也没有报错。实测踩过一次。')

h('3.3 状态模型：**字段名与正式期对齐**')

key('**前奏期的回合归属只看 `P.current_nation`**；`game.active` 只是给 UI/日志看的'
    '**镜像**，由 `nextNation` 同步，并在 `prelude.handle` 出口兜底纠正'
    '（仅当没有待决 delegate 时）。**任何前奏逻辑都不得用 `game.active` 判回合。**')

p('为什么加这条镜像：前奏牌的效果复用正式版原子（`recruit_piece` / `build_piece`），'
  '这些原子历史上可能通过 handoff 把 `game.active` 让给别国且不归还——'
  '表现为「某国打出牌后 active 变成 Axis 而当前国是英国」，'
  '于是后续 `end_seg1` / `advance_phase` 全被判「不是你的回合」，前奏卡死。'
  '2026-11-27 加了两道触发守卫从源头消除让权，镜像同步作为第二道防线保留。')

p('正式期的状态模型定义在 `create_empty_game_state()`（rules.js 第 27443 行）。'
  '前奏的字段**应当沿用同一套命名**——同一个概念用同一个词，只是挂在 `game.prelude` 下，'
  '既不会与正式期混淆（不会写错对象），又不用记两套名字。')

story.append(tbl([['初版命名', '正式期用', '改为', '理由'],
                  ['`deck: []`', '`decks: {}`', '**decks**', '每国独立一副牌堆（见下）'],
                  ['`phase`', '`turn_phase`', '**turn_phase**',
                   '正式期注释已说明：RTT 的 `state.phase` 是它自己的字段，必须区分'],
                  ['`extra_action: 0`', '`extra_play: null`', '**不需要**',
                   '「弃牌换牌」不占行动次数（作者裁定），无需计数器'],
                  ['`played_this_round`', '`play_done: {}`', '**play_done**',
                   '同为「本回合已做」标记'],
                  ['`stats.rounds`', '`turn`', '**turn**', '回合计数同名'],
                  ], [40, 40, 26, 60]))

code([
    "game.prelude = {",
    "  /* ---- 开关 ---- */",
    "  enabled: false,   /* setup 决定：本局是否开启前奏 */",
    "  active: false,    /* start 之后才为 true；enabled && !active = 正在弃 3 */",
    "  ended: false, end_reason: null,",
    "",
    "  /* ---- 行走状态：与正式期同名同结构 ---- */",
    "  turn: 100,               /* 从 100 起编号！避免与正式期 turn 撞车（见 3.3.1） */",
    "  turn_phase: 'action',    /* 'action' | 'card'，两态（正式期是 PH.*） */",
    "  current_nation: '德国',",
    "  nations_done: 0,         /* 0..6 */",
    "  play_done: {},           /* nation -> true：本回合是否已真正打出（手牌或牌堆顶） */",
    "",
    "  /* ---- 牌：结构与正式期同构（都是 nation -> [card_id]）---- */",
    "  decks: {},               /* 每国独立的前奏牌堆 */",
    "  hands: {},",
    "  discard: {},",
    "",
    "  /* ---- 前奏专属 ---- */",
    "  tension: 0,",
    "  stats: { played: 0, discarded: 0 },",
    "",
    "  /* ---- 分步结算（运行时，可能为 null）---- */",
    "  resolving: null,   /* { cardId, nation, stage: 'seg1'|'seg1_done'|'seg2'|'settled' } */",
    "  pending: null,     /* { kind:'discard_hand'|'discard_prelude'|'choice', n, ... } */",
    "}",
])

h('3.3.2 两个运行时结构（实施中新增）')

story.append(tbl([['字段', '用途', '生命周期'],
                  ['**`resolving`**',
                   '正在结算哪张牌、走到哪一步。`stage` 四态：'
                   '`seg1` → `seg1_done` → `seg2` → `settled`',
                   '打出牌时创建；玩家点「进入卡牌阶段」后清空'],
                  ['**`pending`**',
                   '等玩家操作：`discard_hand` 弃正式手牌、`discard_prelude` 弃前奏手牌、'
                   '`choice` 二选一',
                   '代价付完 / 选完即清空'],
                  ], [30, 88, 44]))

bad('**两者都可能打断结算**：`pending` 由 `payCost` / `applyEffect(choice)` 产生，'
    '`resolving` 则由 `resolveCard` 与 `finishResolve` 维护。<br/>'
    '判定优先级是 **`resolving.stage` > `pending` > 正常出牌**，白名单与 `can.*` 必须按此顺序。')

key('**为什么 `decks` 是每国独立一副**：规则书写「前奏牌堆顶的牌**始终对自己可见**」——'
    '如果六国共用一副，牌堆顶是公开信息，就不存在"对自己可见"这种说法。'
    '而每国独立一副，正好与正式期的 `decks[nation]` 结构完全一致。')

h('3.3.1 两个必须注意的语义差异')

story.append(tbl([['字段', '正式期的含义', '前奏期的含义', '风险'],
                  ['`play_done`',
                   '出牌阶段「三选一」做过一次',
                   '**本回合已真正打出**（手牌或牌堆顶）；'
                   '「弃牌换牌」不置此标记，因此同一回合可反复 swap',
                   '若把 swap 也计入 play_done，就会一次弃牌后无法再打'],
                  ['`national_skill_used`',
                   '`nation -> 用过的回合数`（用 `turn` 做版本号）',
                   '**如果前奏也允许用技能**，前奏的 `turn` 与正式期 `turn` 是两套编号',
                   '**编号会撞车**：前奏第 3 轮用过，正式第 3 回合会误判为已用'],
                  ], [36, 46, 46, 38]))

key('**已采纳方案 ①**：前奏的 `turn` 从 **100** 起编号（100、101、102…），'
    '与正式期的 `turn`（1、2、3…）**永不相撞**。<br/>'
    '因此 `national_skill_used`（`nation -> 用过的 turn`）**可以直接复用**，'
    '无需额外的清零钩子——回滚与存档天然安全。')

note('**牌堆方向统一**：前奏牌堆同样以**数组末尾为顶**（push/pop），与正式期一致，'
     '避免"移出的是底牌"这类对称性 bug。')

h('3.4 前奏内部的阶段机（五态，全部人工推进）')

p('**设计原则（作者 2026-11-27）**：任何「结算完 → 下一步」都不自动跳，'
  '必须玩家点按钮确认，避免结算过程一闪而过。')

code([
    "[action 阶段]  不可跳过",
    "    │  · 可反复：swap（弃 1 手牌 + 弃牌堆顶）—— 不占行动",
    "    │  · 终止： play_hand 或 play_top —— 真正打出，置 play_done",
    "    ↓",
    "[seg1]  第一段：代价 → 效果（内部可能挂起：支付 / 二选一）",
    "    ↓",
    "[seg1_done]  ★停  → 右侧「结束第一段」按钮",
    "    ↓ 点击（该牌有 seg2 才走这一环；无 seg2 直接跳到 settled）",
    "[seg2_ask]   询问「执行第二段 / 跳过」——付不起代价则该项置灰",
    "    ↓ 选择",
    "[seg2]  第二段：代价 → 效果",
    "    ↓",
    "[settled]  ★停  → 「进入卡牌阶段」按钮",
    "    ↓ 点击",
    "[card]  自动：弃置所有前奏手牌 + 摸 2 张",
    "    ↓",
    "下一个国家（手牌与牌堆皆空的跳过；绕完一圈无人可动 → 结束）",
    "    ↓",
    "[结束判定]  tension >= 10（在卡牌阶段之后）/ 牌耗尽 → ended",
])

key('**「停」的两处是本次实施新增的**：<br/>'
    '① `seg1_done` —— 第一段可能包含插入结算（如「打出 1 张前奏手牌」），'
    '玩家需要确认这一段真的走完了；<br/>'
    '② `settled` —— 整张牌结算完毕，进入卡牌阶段前再确认一次。')

h('3.5 动作契约（11 个，按结算阶段分四组）')

p('**出牌阶段（action）**')
story.append(tbl([['action', 'arg', '用途', '合法性条件'],
                  ['`prelude_play_hand`', '`{ card }`', '打出手牌', 'card 在**本国**前奏手牌里'],
                  ['`prelude_play_top`', '`{}`', '打出牌堆顶', '牌堆非空'],
                  ['**`prelude_swap`**', '`{ card }`',
                   '弃 1 张手牌 + 弃掉牌堆顶（**不占行动**，可反复）',
                   '手牌非空 **且** 牌堆非空 **且**（手牌>1 **或** 牌堆>1）'
                   '—— 防 0/0 死局'],
                  ], [40, 24, 60, 40]))

p('**结算中（由 `pending` 驱动）**')
story.append(tbl([['action', 'arg', '触发时机'],
                  ['`prelude_pay_cards`', '`{ cards: [id] }`',
                   '`pending.kind` 为 `discard_hand` / `discard_prelude`，需选恰好 n 张'],
                  ['`prelude_choose_option`', '`{ key }`',
                   '`pending.kind === "choice"`：牌面二选一，或第二段的执行/跳过'],
                  ], [40, 34, 90]))

p('**结算中：需要玩家做选择（由 `pending.kind` 驱动）**')
story.append(tbl([['action', 'arg', '触发时机'],
                  ['`prelude_nested_play`', '`{ card }`',
                   '`pending.kind === "nested_play"`：效果要求「再打 1 张前奏手牌」'],
                  ['`prelude_pick_space`', '`{ space }`',
                   '`pending.kind === "pick_space"`：牌面没写地区的征召/建设/部署'],
                  ['`prelude_search_pick`', '`{ card }`',
                   '`pending.kind === "search_deck"`：检视牌堆后挑 1 张'],
                  ['`prelude_place_card`', '`{ card }`',
                   '`pending.kind === "place_card"`：把正式手牌里的状态/响应卡放上桌面'],
                  ], [44, 26, 84]))

p('**分步推进（由 `resolving.stage` 驱动）**')
story.append(tbl([['action', 'arg', '触发时机'],
                  ['`prelude_end_seg1`', '`{}`', '`stage === "seg1_done"`：确认第一段走完'],
                  ['`prelude_advance_phase`', '`{}`', '`stage === "settled"`：确认进入卡牌阶段'],
                  ], [40, 20, 104]))

bad('**白名单必须跟着阶段切换**，否则会出现「按钮亮着但点了没反应」：<br/>'
    '`seg1_done` → 只给 `end_seg1`；`settled` → 只给 `advance_phase`；'
    '有 `pending` → 只给 `pay_cards` / `choose_option`；否则给三个出牌动作。')

bad('**三个易错点**：<br/>'
    '① 规则书写的是「弃 1 张前奏手牌和前奏**牌堆顶**的牌」——弃的是**牌堆顶**，不是弃牌堆顶，'
    '所以基础条件只看「手牌非空 + 牌堆非空」；<br/>'
    '② `view.can.swap` 必须如实反映条件，否则又会出现「看得见点不中」；<br/>'
    '③ 还有**第三个条件**：`手牌 > 1 或 牌堆 > 1`。swap 一次同时消耗 1 张手牌和 1 张牌堆顶，'
    '「手牌 1 + 牌堆 1」换完就是 0/0 —— 既不能出牌也不能打顶牌，行动阶段不可跳过，直接死局。'
    '所以 1/1 时必须禁止 swap。这一条是实测一个死局后补的，未写进规则书。')

# ================= 四、DSL =================
story.append(PageBreak())
sec('四、两段式效果 DSL')

h('4.1 一张前奏牌的完整形态（实施后的真实结构）')

code([
    "{",
    "  '18309': {",
    "    name: '波兰动员',",
    "    seg1: {",
    "      cost:   [{ op: 'tension', delta: 1 }],       /* [] = 代价 */",
    "      effect: [{ op: 'recruit', space: '东欧', type: 'army', n: 1 }]",
    "    }",
    "  },",
    "",
    "  '14900': {",
    "    name: '德奥合并',",
    "    seg1: {",
    "      cost:   [{ op: 'tension', delta: 1 }],",
    "      effect: [{ op: 'choice',",
    "                 label: '打出 1 张前奏手牌，或打出牌堆顶',",
    "                 options: [",
    "                   { key: 'hand', label: '打出前奏手牌',   when: { hand_nonempty: true } },",
    "                   { key: 'top',  label: '打出前奏牌堆顶', when: { deck_nonempty: true } }",
    "                 ] }]",
    "    },",
    "    seg2: {",
    "      cost:   [{ op: 'discard_hand', n: 1 }],      /* 硬代价，付不起整段跳过 */",
    "      effect: [{ op: 'search_deck', type: 'STRATEGY', to: 'hand' }]",
    "    }",
    "  }",
    "}",
])

story.append(tbl([['字段', '含义', '说明'],
                  ['`seg1`', '第一段', '打出后**必走**：先 cost 后 effect'],
                  ['`seg2`', '第二段', '第一段确认结束后**询问玩家**是否执行'],
                  ['`cost`', '代价', '**牌面方括号**里的内容，如 `[紧张度+1]`、`[弃置1张手牌]`'],
                  ['`effect`', '效果', '方括号之后的正效果（**单数**命名，与实现一致）'],
                  ['`when`', '条件', '可挂在 seg 上，也可挂在 choice 的每个选项上'],
                  ], [26, 30, 108]))

key('**关键：方括号是代价，不是效果。** 早期文档把 `[紧张度+1]` 写成 effect，'
    '实现时拆出了独立的 `cost` 层——两者的结算顺序、付不起时的处理完全不同。')

h('4.2 条件（when）—— 已实现的集合')

story.append(tbl([['条件', '含义', '典型用途'],
                  ['`always`', '恒真', 'seg1 通常省略该字段'],
                  ['`hand_nonempty`', '前奏手牌非空', '「打出手牌」选项的可用性'],
                  ['`deck_nonempty`', '前奏牌堆非空', '「打牌堆顶」选项的可用性'],
                  ['`discard_nonempty`', '前奏弃牌堆非空', '少数需要弃牌堆的牌'],
                  ['`tension_ge` / `tension_le`', '紧张度比较', '如 `tension_ge: 5`'],
                    ['`has_pieces` + `negated`', '地区有某国部队（14913 口径）；negated 取反',
                     '如 `{space_group:\"中国\", nation:\"日本\", types:[\"army\"]}`（18406）'],
                  ['`has_status_in_hand`', '正式手牌里有状态卡', '「打出 1 张状态卡」分支的可用性'],
                  ['`has_response_in_hand`', '正式手牌里有响应卡', '「打出 1 张响应卡」分支'],
                  ], [52, 44, 68]))

note('**条件在「打出那一刻」求值**：选项可用性按当时盘面算定，之后盘面变化不重算。'
     '这样客户端看到的置灰状态与点下去的结果始终一致。')

h('4.3 op 清单：代价 vs 效果')

p('**先分清两个表**：`cost` 里的 op 是「支付」，`effect` 里的 op 才是「效果」。'
  '同名 op（如 `tension`）在两边都可能出现，但语义不同。')

p('**cost（代价）—— 付不起时怎么办是关键**')
story.append(tbl([['op', '参数', '付不起时'],
                  ['`tension`', '`delta`', '**钳到 0**，照常结算（`0-1=0`）'],
                  ['`score`', '`n`', '**允许为负**，不钳位'],
                  ['`discard_hand`', '`n`、`filter`（可选卡型）',
                   '**整段跳过**：弹选牌框选【正式手牌】；`filter:"response"` 只弃响应卡（18404，同 15412）'],
                  ['`discard_prelude`', '`n`', '**整段跳过**：选【前奏手牌】'],
                  ], [36, 30, 94]))

p('**effect（效果）**')
story.append(tbl([['op', '参数', '说明', '状态'],
                  ['`tension`', '`delta`', '改紧张度（同样钳到 0）', '**已实现**'],
                  ['`score`', '`n`', '加阵营分（可为负）', '**已实现**'],
                  ['`recruit`', '`space, type, n`', '征召（复用正式版 `recruit_piece`）', '**已实现**'],
                  ['`build`', '`space, type, n`', '建设（复用 `build_piece`）', '**已实现**'],
                  ['`draw`', '`n, deck`',
                   '抽牌；`deck` = `formal`（默认）/ `prelude`（摸前奏牌）', '**已实现**'],
                  ['`choice`', '`label, options[]`', '二选一（每项带 when / effect）', '**已实现**'],
                  ['`play_prelude_hand`', '`n`', '打出前奏手牌（插入结算，走栈）', '**已实现**'],
                  ['`play_prelude_top`', '`n`', '打出前奏牌堆顶（插入结算）', '**已实现**'],
                  ['`marker`', '`space, delta`', '加减计分标记（复用 `add_marker`）', '**已实现**'],
                  ['`soviet_japan_pact`', '`owner, target, points`',
                   '苏日中立持续标记（18407/18006）；参考 maybe_end_neutral_by_attack 的 (victim,attacker) 判定',
                   '**已实现**'],
                   ['`army_bonus`', '`nation`',
                   '增加 1 支陆军后备（复用 add_army_bonus；17750/17537/17829 同款）', '**已实现**'],
                   ['`deploy_air`', '`n`、`terrain`（可选地形限定）',
                   '部署空军（`can_deploy_air` 独立通道）；`terrain:"land"` 时候选只留陆地（18403）',
                   '**已实现**'],
                  ['`add_card_to_deck`', '`card`（按卡名）, `dest`',
                   '把 1 张牌洗入正式牌堆（`card_inst` 生成实例）', '**已实现**'],
                  ['`search_deck`', '`type, n, topN, to, deck, fromNation, card`',
                   '检视牌堆选牌；`to` = hand / table_status / table_response / play；'
                   '`deck` = formal / prelude；`fromNation` 跨牌堆（18407）、'
                   '`card` 按面id找、`to:"play"` 取出后嵌套打出', '**已实现**'],
                  ['`place_status_from_hand`', '`n`', '把正式状态卡明置到桌面', '**已实现**'],
                  ['`place_response_from_hand`', '`n`', '把正式响应卡暗置到桌面（18404 首次使用）', '**已实现**'],
                  ['`eliminate`', '`space, type, onlyNation`（目标国限定）',
                   '消灭 1 支敌方部队（复用 `eliminate_candidates`）；'
                   '多支时挂起 `pick_piece` 由玩家点地图选', '**已实现**'],
                  ['`attrition_prelude`', '`n`',
                   '所有敌国各从前奏牌堆顶损耗 N 张（进前奏弃牌堆，不进手牌）', '**已实现**'],
                  ['`reorder_deck`', '`deck, n`',
                   '检视牌堆顶 N 张，任意排列置顶/置底；'
                   '复用正式局 `game.peek` + 排列框（15215 同款）', '**已实现**'],
                  ['`extra_action_phase`', '`n`',
                   '额外执行 N 个前奏行动阶段：**保留手牌、不摸牌、不换国**，'
                   '只把阶段拨回 action（18301）', '**已实现**'],
                  ['`supply_immune`', '`nations, type, space`',
                   '持久补给光环：指定国家/兵种/地区始终处于补给状态。'
                   '走正式局同一条 `status_aura.supply_immune`（与 15346 / 17838 同源）',
                   '**已实现**'],
                  ['`coal_ban`', '`target, untilTurn`',
                   '持久标记：第 N 回合内目标国**每次**发起战斗失 3 分。'
                   '强制效果，走 `game.ongoing` + `request_responses` 开头的 battle 钩子',
                   '**已实现**'],
                  ], [46, 46, 56, 22]))

key('全部 **22 个 op 均已实现**（`add_card_to_deck` / `attrition_prelude` / `build` / '
    '`choice` / `coal_ban` / `deploy_air` / `draw` / `eliminate` / `extra_action_phase` / '
    '`marker` / `place_response_from_hand` / `place_status_from_hand` / `play_prelude_hand` / '
    '`play_prelude_top` / `recruit` / `reorder_deck` / `score` / `search_deck` / '
    '`supply_immune` / `tension`）。')

key('**`discard` 只在代价里出现**，从未作为效果实现——牌面写「弃置 1 张手牌」'
    '一律是 `[` 开头的代价段落。')

h('4.3.1 op 的设计原则：原子性')

p('**op 只能描述「做什么操作」，不能描述「哪张牌的什么事」。**'
  '这条原则是实施中被打回重做后补上的，判据很简单：'
  '**如果新 op 的名字里出现了具体牌型或牌名，说明它应该是现有 op 加一个参数。**')

story.append(tbl([['', '写法', '问题 / 优点'],
                  ['❌ 反例', '`play_armament_anywhere`',
                   '一个 op 同时扫手牌和牌堆顶，还把「军备卡」写死在里面——'
                   '换张牌完全不复用，op 数量会随牌面线性膨胀'],
                  ['✅ 正例', '`play_prelude_hand { type, n }`<br/>'
                              '`play_prelude_top { type, n }`',
                   '`type` 只是过滤条件、`n` 决定数量；'
                   '「打出后怎么处理」由**牌的类型**分派'],
                  ], [22, 62, 74]))

p('**分派点**在 `nestPlayCard` / `nestPlayTop` 内部，不在 op 里：')

code([
    "// 所有「打出」都走这两个函数，进去后按类型分派：",
    "if (isPlaceOnPlayCard(cardId, deps)) {   // ARMAMENT",
    "  placeArmament(...)                     // -> 暗置到响应区",
    "  return 'skip'                          //   不占栈、不进前奏弃牌堆",
    "}",
    "P.discard[nation].push(cardId)           // 其他牌 -> 进弃牌堆",
    "pushFrame(...)                           //         -> 嵌套结算 seg1",
])

key('**这样 `play_prelude_hand` / `play_prelude_top` 能表达「打出任意类型的牌」**：'
    '以后「打出手牌里的 BASIC」「打出牌堆顶的状态卡」都直接可用，不必新增 op。'
    '军备卡不再是特例，它只是「打出即暗置」的牌型，与「打出即结算」的普通前奏牌并列。')

h('4.3.2 「持续」效果的两条实现路径')

p('牌面上带 **[持续]** 的效果打完就进了前奏弃牌堆，但效果要一直生效。'
  '这类效果只有两种形态，各自对应一条现成路径：')

h('① 持久光环（补给 / 相邻 / 免疫类）')

note('直接写正式局的 `status_aura` —— 与状态卡 15346 / 17838 走**同一条路**，不新造机制。')

li('例：18308 法国殖民地基地 `supply_immune`')
li('`status_aura.supply_immune[nation] + supply_immune_scope[nation] = {type, space}`')
li('读取方是现成的 `supply_aura_covers(game, nation, type, space)`，前奏侧只负责写')

h('② 强制事件效果（「XX 之后，某国失 N 分」类）')

note('**不能用状态卡 trigger，也不能用 RESPONSE_EFFECTS。**')

li('状态卡 `trigger` 的语义是「玩家可选发动 + 付代价」：'
   '`{ window, once_per_turn, cost, effect }`')
li('响应链同样全是选发 —— 实测 72 张 `RESPONSE_EFFECTS` 里 `optional === false` 的数量为 **0**')
li('而 18305「意大利发起战斗后，若为第1回合：其失去3分」没有任何"可以"、也没有代价，'
   '属于**强制结算**')
li('实现方式：`game.ongoing[flag]` 记标记 + 在 `request_responses` 的'
   '**最开头（前奏守卫之前）**挂 battle 钩子')
li('挂在最开头的两个理由：① rules 里 `battle` 有 **5 个派发出口**，逐处挂会漏，'
   '一处覆盖全部；② 必须在 `prelude.active` 守卫**之前**——持续效果不是响应卡，'
   '不该被"前奏不触发响应卡"这条规则挡掉')
li('用 `!pre` 排除拦截类（`RESPONSE_PRE_CANCEL`）那一次派发，避免重复扣分')

h('4.3.3 前奏牌堆的构建口径')

note('**普通牌全要 + 军备卡只要"已实现"的。** 这条不是随便定的，'
     '而是被 cards.js 的 `deck` 字段逼出来的。')

p('`cards.js` 是自动生成的，军备卡的 `deck` 字段**分批标记**：')

li('德国 / 意大利 / 日本的 32 张 -> `deck: "PRELUDE"`')
li('美国 / 苏联 / 英国的 26 张 -> `deck: "ARMAMENT"`（单独一个 deck）')
li('而代码里**没有任何地方读 `CARDS_BY_DECK.ARMAMENT`** —— '
   '这些卡既不进前奏牌堆、也不进正式牌堆')

p('所以构建规则是：')

code([
    'idList = CARDS_BY_DECK.PRELUDE                  // 普通牌 + 德/意/日军备卡',
    '       + CARDS_BY_DECK.ARMAMENT.filter(已实现)   // 英/苏/美军备卡，实现一张进一张',
])

li('"已实现" 判据由 rules 注入：`isCardImplemented(id)` = '
   '`RESPONSE_EFFECTS[id] && RESPONSE_EFFECT_IMPL[id]` 都有')
li('**好处**：以后做完一张英/苏/美军备卡，它自动进牌堆，不需要手改构建列表')
li('2026-11-28 实测：德国 25（16+9）/ 日本 22（9+13）/ 意大利 18（7+11）'
   '/ 英国 11 / 苏联 12 / 美国 11，合计 99 张')

key('⚠ 不要把这条改成 "按 type 全量筛"。那会把 17 张还没实现的美/苏军备卡'
    '也塞进牌堆 —— 打出来只会写一条「效果未实装」，纯噪音。')

h('4.4 结算器的写法（避免又写成巨型 switch）')

code([
    "const EFFECTS = {}   // op 名 -> 处理函数，注册式，不写 switch",
    "",
    "function reg(op, fn) { EFFECTS[op] = fn }",
    "",
    "reg('tension', function (game, eff) {",
    "  const P = game.prelude",
    "  P.tension = Math.max(0, P.tension + (eff.delta || 0))",
    "})",
    "",
    "reg('draw', function (game, eff) {",
    "  const P = game.prelude",
    "  for (let i = 0; i < (eff.n || 1); i++) {",
    "    const d = P.decks[P.current_nation]",
    "    if (!d.length) break",
    "    P.hands[P.current_nation].push(d.pop())",
    "  }",
    "})",
    "",
    "function resolveSeg(game, seg) {",
    "  if (!seg || !checkWhen(game, seg.when)) return",
    "  for (const eff of (seg.effects || [])) {",
    "    const fn = EFFECTS[eff.op]",
    "    if (!fn) { game.log.push('【前奏】未知效果 op=' + eff.op); continue }",
    "    fn(game, eff)",
    "  }",
    "}",
])

note('这段是本方案里唯一"像引擎"的代码，其余都是数据与薄封装。'
     '它的价值在于：**新增一张牌 = 加一个数据对象，不改任何一行引擎代码**——'
     '这正是 do_action 现在做不到的事。')

# ================= 五、视图 =================
sec('五、视图与可见性')

code([
    "view.prelude = {",
    "  active: true,",
    "  phase: 'action',",
    "  currentNation: '德国',",
    "  tension: 3,",
    "  myNation: '德国',",
    "  myHand: [90101, 90103],        // 只给自己的",
    "  topCard: 90105,                // 仅当 myNation === currentNation",
    "  deckCount: 12,",
    "  discardTop: 90102,",
    "  can: {",
    "    playHand: true,",
    "    playTop: true,",
    "    discardExtra: false          // 弃牌堆空时置 false",
    "  },",
    "  ended: false",
    "}",
])

story.append(tbl([['字段', '可见性规则', '依据'],
                  ['`myHand`', '只下发当前玩家的前奏手牌', '手牌保密'],
                  ['**`topCard`**', '**仅当 `myNation === currentNation` 时给 id，否则 null**',
                   '规则书：「前奏牌堆顶的牌**始终对自己可见**」'],
                  ['`deckCount` / `discardTop`', '公开', '牌堆与弃牌堆是公开信息'],
                  ['`can.*`', '**服务端计算**，客户端只读', '避免前后端判定分叉'],
                  ], [46, 74, 42]))

bad('**`topCard` 是最容易泄密的一处**：如果 view 无条件下发牌堆顶，'
    '对手也能看到——这既是规则违背，也是作弊入口。'
    '必须在 `prelude_view.js` 里按 `viewer` 与 `current_nation` 比较后裁剪。')

# ================= 六、实施顺序 =================
story.append(PageBreak())
sec('六、分步实施（5 步，含完成状态）')

story.append(tbl([['步', '做什么', '状态', '验收'],
                  ['**1**', '状态 + 双重入口：`scenarios` 加回；`setup` 建结构；'
                   '`do_opening_discard` 全部弃完后 `start()` 发牌',
                   '**✅ 已完成**', '弃 3 阶段看不到前奏手牌；弃完后各国 2 张'],
                  ['**2**', '牌库与可见性：99 张 PRELUDE 按国分堆；'
                   '牌堆顶**同阵营可见**（敌方 `？`）',
                   '**✅ 已完成**', '轴心视角能看到德/日/意的顶牌，同盟为 null'],
                  ['**3**', '行动阶段三动作 + 阶段推进 + **分步结算机**',
                   '**✅ 已完成**', '连续 swap 后仍能出牌；结算分步（结束第一段/进入卡牌）'],
                  ['**4**', '两段式效果 DSL',
                   '**🚧 进行中**<br/>骨架 + 6 op 完成',
                   '`tension/score/recruit/build/draw/choice` 可跑；代价与二选一挂起'],
                  ['**5**', '结束条件与清理：牌耗尽 / tension≥10；剔 5 张正式牌',
                   '**✅ 已完成**', '两种结束都能进正式局；51 步可跑完整局前奏'],
                  ], [10, 70, 30, 54]))

h('6.0 当前进度')

story.append(tbl([['模块', '文件', '行数（约）', '状态'],
                  ['生命周期', '`prelude/state.js`', '160', '✅'],
                  ['视图', '`prelude/view.js`', '150', '✅'],
                  ['引擎', '`prelude/engine.js`', '700', '✅'],
                  ['效果表', '`prelude/cards.js`', '50', '🚧 仅 2 张'],
                  ['接入', '`rules.js` 6 处', '—', '✅'],
                  ['UI', '`play.html/css/js`', '—', '✅ 7 处'],
                  ], [24, 62, 34, 44]))

key('**为什么要分 5 步而不是一次做完**：每一步都能用现有 `tools/` 脚本单独验证，'
    '出问题时只需回退一步。上次之所以推倒重来，很可能就是"一次写完再调"，'
    '结果接入层的 5 个坑同时爆发。')

h('6.1 每步的最小验证动作')

story.append(tbl([['步骤', '验证方式'],
                  ['1', '创建 Episode 2 对局 → **弃 3 阶段不应看到前奏手牌**；'
                   '6 国全部弃完后 `view.prelude.active` 才变 true、手牌 2 张'],
                  ['2', '对局开始后查各国 `hands` 长度是否为 2；用两个玩家视角分别取 view，对比 `topCard`'],
                  ['3', '连点三个动作类各一次，检查 log 是否出现「打出/弃换」记录与阶段切换'],
                  ['4', '构造一张 `[{op:tension,delta:1}]` 的测试牌，打完查 `tension` 是否 +1；'
                   '再构造 seg2 条件为真的牌，验证第二段是否执行'],
                  ['5', '分别制造"牌耗尽"与"tension=10"两种局面，确认都在**回合结束后**才结束'],
                  ], [12, 152]))

# ================= 七、待确认 =================
sec('七、作者确认的规则裁定')

p('以下九点由作者拍板，已并入前文各处；此处集中记录，便于实现时对照。'
  '标「修改」的条目是后期推翻早期口径，**以最新一条为准**。')

story.append(tbl([['#', '裁定', '对设计的影响'],
                  ['①', '**结束条件只有两个**（规则书「三个时机」为笔误）',
                   '只写两条判定，不留第三条空位'],
                  ['②', '**前奏算分**：牌面的「获得 N 分」生效',
                   '`score` op 升为 P0，作用于阵营总分'],
                  ['③', '**前奏没有计分阶段**：回合只有「行动 + 卡牌」',
                   '正式期 SCORE 阶段整段跳过'],
                  ['④', '**紧张度只用于触发结束**',
                   '不向其他模块暴露；仅结束判定读它'],
                  ['⑤', '**`tension` 钳到 0**：`0-1` 仍是 `0`，**照常结算**',
                   '紧张度代价不判「付不起」，直接 `Math.max(0, x)`'],
                  ['⑥', '**`score` 允许为负**（与 tension 不同，不钳位）',
                   '`add_*_score` 直接累加，负数照记'],
                  ['⑦', '**弃牌类代价付不起 → 整段跳过**（不支付、不结算该段）',
                   '`canRunSeg` 判断；seg2 询问里该项置灰'],
                  ['⑧', '**前奏不触发响应卡，也不触发军备卡**'
                        '（2026-11-27 修改，推翻此前「可以触发」的口径）',
                   '`request_responses` / `offer_armed_effects` 入口加前奏守卫；'
                   '正式版原子仍复用，但不会产生跨玩家交互'],
                  ['⑨', '**弃牌/抽牌默认指正式牌**，写「前奏」才指前奏',
                   '`discard_hand` 走正式手牌；`draw` 走 `draw_cards`'],
                  ], [10, 82, 70]))

key('**②与③要一起理解**：前奏「不算分」指的是**不跑计分阶段**（不按地块累计、不判胜负），'
    '而不是「分数冻结」——牌面直接给分是生效的，所以计分面板在前奏期**照常更新**。')

note('这九点已并入 1.1 / 1.4 / 3.3 / 4.3 各表；第七章只作集中记录。'
     '**第 ⑧ 条是最新修改**：早期曾按「前奏可以触发响应卡」实现，'
     '2026-11-27 推翻——原因是触发会让权、而前奏没有归还机制，会直接卡死。')

# ================= 八、与正式期的边界 =================
story.append(PageBreak())
sec('八、与正式期的边界（防止两套逻辑互相污染）')

p('**这张表就是「接入层契约」**：把前奏期间哪些正式模块该让路逐条写清，'
  '实现时逐个加早退——比事后排查「为什么前奏里触发了事件卡」容易得多。')

story.append(tbl([['前奏期间的行为', '正式期模块', '处理方式'],
                  ['**计分阶段**', '`PHASES.SCORE`', '**整段跳过**（前奏回合只有行动 + 卡牌）'],
                  ['**牌面给分**', '`score`（阵营总分）', '**照常生效**——前奏算分，只是不跑计分阶段'],
                  ['补给判定', '`supply` 相关', '**不跑补给结算**，但 `recruit/build/battle` 内部仍调用 `is_supplied()`'],
                  ['事件卡 / 响应卡触发', '`trigger_response` 等', '**正式牌不触发**（在 trigger 入口加 `prelude.active` 早退）'],
                  ['军备卡触发', '`armament`', '**允许**——需确认 armament 的入口不经过正式牌守卫'],
                  ['国家技能', '`national_skill`', '**允许**'],
                  ['回合推进', '`next_nation` / `next_phase`', '**前奏接管**（早退到 prelude.advance）'],
                  ], [46, 46, 70]))



# ================= 九、UI =================
story.append(Spacer(1, 4 * mm))
sec('九、UI 接入契约（复用正式局布局，不新开面板）')

p('**设计取向**：前奏**复用正式局的样式与容器**，不引入新的视觉体系；'
  '但交互点从最初设想的 3 处扩展到了 **7 处**——因为分步结算、代价支付、二选一'
  '都需要玩家显式操作。')

h('9.1 七处挂载点（全部已实现）')

story.append(tbl([['#', '区域', '容器 / 函数', '前奏增量'],
                  ['1', '**手牌区**', '`#hand_panel` 上方新增 `#prelude_hand_row`',
                   '左：**当前行动国**的 2 张手牌 + 金框顶牌（可点）；'
                   '右：同阵营其余 3 国手牌 + 顶牌（只读）'],
                  ['2', '**牌库区**', '`#deck_panel` 内新增 `#prelude_deck_toggle` + `#prelude_deck_list`',
                   '与「各国牌库」同款：六国 前奏库 / 弃 / 前奏手牌'],
                  ['3', '**计分区**', '`#score_panel` 的 `#score_total` 之后',
                   '`#prelude_tension`：紧张度 N /10 + 进度条（≥8 转红）'],
                  ['4', '**状态面板**', '`#phase_panel`（正式期 7 阶段）**整块替换**',
                   '两格阶段条（行动/卡牌）+ 「打出牌堆顶」「换牌模式」两个按钮'],
                  ['5', '**代价选牌框**', '`#prelude_peek_modal`（复用正式 `.modal` 样式）',
                   '卡网格多选，选满才可确认；付不起时整段跳过'],
                  ['6', '**二选一框**', '`#ask_box` + `render_ask_box`',
                   '按钮式选项，**不可用的置灰**（`disabled`）'],
                  ['7', '**分步结算框**', '`#prelude_resolve_box`（`#phase_panel` 内）',
                   '「结束第一段」/「进入卡牌阶段 ▶」——两态共用一个框'],
                  ], [8, 22, 60, 74]))

key('**硬约束 ①：`#hand_cards` 里绝不混入前奏牌**——前奏手牌必须是独立的'
    '`#prelude_hand_row`，否则玩家分不清哪张能打。<br/>'
    '**硬约束 ②：手牌区显示「当前行动国」而非「玩家代表国」**——前奏逐国行动，'
    '轮到队友国时玩家同样要能出牌（`can.*` 按**阵营**判定，不是按国家）。')

h('9.2 view.prelude → DOM 的映射')

story.append(tbl([['view 字段', '显示在', '形态'],
                  ['`tension` / `tensionMax`', '`#prelude_tension`', 'N /10 + 进度条'],
                  ['`myHand`', '`#prelude_hand_wrap`', '**当前行动国**的手牌（敌方回合时为 0）'],
                  ['`topCard`', '手牌区末尾', '金框卡；**非本方阵营时为 null**'],
                  ['`topCards`', '友军区 / 牌库浮层', '同阵营各国顶牌；敌方为 `？`'],
                  ['`allyHands`', '`#prelude_ally_hands_wrap`', '同阵营其余国的手牌（含顶牌）'],
                  ['`counts`', '`#prelude_deck_list`', '六国 前奏库 / 弃 / 前奏手牌'],
                  ['`can.*`', '手牌与按钮的 `disabled` / 置灰', '服务端算，客户端只读'],
                  ['**`pending`**', '`#prelude_peek_modal` 或 `#ask_box`', '代价选牌 / 二选一'],
                  ['**`resolving`**', '`#prelude_resolve_box`', '分步结算框（两态）'],
                  ], [40, 56, 78]))

bad('**客户端绝不能自己判断"能不能点"**：`can.*`、`pending.options[].enabled` 都由服务端算好，'
    '客户端只负责置灰。否则会出现「看着能点、点了被拒」的白名单死锁。')

h('9.3 实现方式：五个函数分工')

story.append(tbl([['函数', '职责', '依赖的 view 字段'],
                  ['`update_prelude_ui()`', '总入口：手牌区（主区 + 友军）、牌库浮层',
                   '`myHand / allyHands / counts`'],
                  ['`update_prelude_phase_panel()`', '状态面板：两格阶段条 + 两个按钮',
                   '`phase / can`'],
                  ['`update_prelude_cost_modal()`', '代价选牌框（卡网格多选）',
                   '`pending.kind = discard_*`'],
                  ['`update_prelude_choice_box()`', '二选一框（按钮，可置灰）',
                   '`pending.kind = choice`'],
                  ['`update_prelude_resolve_box()`', '分步结算框（两态）',
                   '`resolving.stage`'],
                  ], [58, 62, 54]))

code([
    "/* play.js：五个函数全部挂在 update_prelude_ui() 末尾，同一次刷新完成 */",
    "function update_prelude_ui() {",
    "  ...手牌 / 友军 / 牌库...",
    "  update_prelude_phase_panel()   // 状态面板",
    "  update_prelude_cost_modal()    // 代价选牌",
    "  update_prelude_choice_box()    // 二选一",
    "  update_prelude_resolve_box()   // 分步结算框",
    "}",
])

bad('**调用点必须在 `update_map()` 的最前面**，不能挂在 `update_phase_panel()` 里——'
    '后者排在 `update_side_info()` 之后，一旦前者抛错，前奏整块都渲染不出来（实测踩过）。')

note('`toggle(id, on)` 内部只是 `classList.toggle("hide", !on)`；'
     '`set_text` / `set_bar` 是 play.js 里已有的小工具（如 `set_text` 已被 `update_score_panel` 使用）。'
     '**不引入任何新框架、不新建渲染管线。**')

h('9.4 Standard 局的零影响')

li('`view.prelude` 不存在时，三块容器直接隐藏（`hide`），不读任何字段')
li('**计分区在前奏期照常刷新**（前奏算分），只是多出一行紧张度')
li('不新增定时器、不监听事件')
li('`play.html` 里三块默认带 `class="hide"`，由 `update_prelude_ui()` 打开')
li('**正式局的任何渲染路径不调用 `update_prelude_ui()` 以外的新代码**')

h('9.5 已实现的交互细节')

li('**hover 放大图**：与正式手牌同一个 `on_focus_card` / `on_blur_card`')
li('**换牌模式**：按钮切换 → 手牌加红框 + `crosshair` 光标 → 点一张即执行并自动退出')
li('**不可用的牌置灰**：`opacity .45 + grayscale`，依据服务端 `can.*`')
li('**牌堆顶金框**：仅本方阵营可见，敌方显示 `？`')
li('**紧张度 ≥8 转红**：`#prelude_tension.danger`')
li('**分步结算框两态共用**：`seg1_done` → 结束第一段；`settled` → 进入卡牌阶段')
li('**敌方回合隐藏主区手牌**：只留友军区（己方 3 国）')

sec('十、测试与回归')

note('这一章是 **2026-11-28 补的**，起因是一次自查：连续几轮汇报"全量 X 项全绿"，'
     '但把回归方式从"手写文件列表"改成"自动遍历"之后，发现 **12 个测试从未进过回归集合**。'
     '测试本身是好的，坏的是"全量"这个说法 —— 它的分母一直是错的。')

h('10.1 必须自动遍历，不要手写列表')

li('**手写列表必然会漏**：每新增一个 `_test_*.js` 就要记得改命令，忘一次就少测一个')
li('实测漏掉的 12 个：`_test_14907_auto` / `_test_uk_b1` / `_test_uk_18302` / '
   '`_test_uk_pick_piece` / `_test_uk_pick_nation` / `_test_armament_drop` / '
   '`_test_ask_enemy` / `_test_nested_skip` / `_test_prelude_only` / '
   '`_test_resolving_sync` / `_test_scoring_double` / `_test_trigger_armament_flag`')
li('其中 `_test_scoring_double` 覆盖的正是"计分阶段响应被问两次"那个真 bug —— '
   '它一直没跑，等于那个回归没有保护')

h('10.2 标准回归命令')

note('PowerShell（在 quartermaster-sub-wars/ 目录下）：')

code([
    'Get-ChildItem _test_*.js | Where-Object { $_.Name -ne "_test_util.js" } |',
    '  ForEach-Object { node $_.Name 2>&1 | Select-String "PASS / " | Select-Object -Last 1 }',
])

li('`_test_util.js` 是**工具不是测试**（导出 `settle` / `playAndSettle`），必须排除')
li('每个脚本取**最后一行** `结果：N PASS / M FAIL`，就是它的总结论')

h('10.3 输出口径：NO-OUT 不等于失败')

note('前奏相关测试统一以 `结果：N PASS / M FAIL` 收尾，可被正则直接抓取。')

li('**正式局老测试**（`_test_std_regression` / `_test_resp` / `_test_swap_edge` / '
   '`_test_15211` / `_test_17530` / `_test_score_neg` / `_test_view_resp`）'
   '输出格式各不相同，抓不到 `PASS / ` 会显示为 `NO-OUT`')
li('**NO-OUT 必须人工看一眼**，确认是"格式不同"还是"脚本崩了"')
li('实测这 7 个都正常：`_test_resp` 打印 `=== 总结论 === PASS（7/7）`，'
   '`_test_std_regression` 打印 `view.prelude = null（正确）` —— 只是不用统一格式')

h('10.4 当前基线（2026-11-28）')

li('脚本 **47 个**（含 1 个工具），前奏相关 **41 个**')
li('前奏累计断言 **511 项**，失败 **0**')
li('正式局老测试 7 个，人工核对全 PASS')

h('10.5 `_test_util.js` 的 `settle()` 必须跟随挂起类型扩展')

note('`settle(g, role)` 的作用是把一次出牌之后的**所有挂起**自动走完'
     '（二选一 / 嵌套打出 / 选地区 / 选部队 / 选国家 / 弃牌代价），'
     '让测试可以"打完一张牌直接断言终局"。')

li('**新增一种 `pending.kind` 就必须同步加进 `settle`**，否则测试会停在那里不动')
li('实测踩过：加了 `pick_piece` / `pick_nation` 后忘了改 `settle`，'
   '`_test_step5` 一路打到英国牌就卡住，报"前奏未结束"')
li('表现很好认：某个脚本突然从 N/0 变成 N/6、且日志里出现大量"不是你的回合"')

h('10.6 一个测试纪律')

note('**测试里的"未实装牌降级"样本要用虚构 id**（如 `TEST_UNKNOWN`），'
     '不要拿"暂时还没做"的真卡当样本。')

li('踩过：`_test_step4a` 的降级样本依次用过 14900 → 14902 → 14903 → 14906，'
   '每实装一张就得改一次，红了好几次')
li('用不存在的 id 之后，这个用例**永远不会因为"样本被做完"而变红**')





def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFont('CN', 7.4)
    canvas.setFillColor(GREY)
    canvas.drawString(18 * mm, h - 12 * mm, '前奏架构设计 · Episode 2 门前惊雷')
    canvas.setStrokeColor(colors.HexColor('#d5d5d5'))
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, h - 14 * mm, w - 18 * mm, h - 14 * mm)
    canvas.drawRightString(w - 18 * mm, 10 * mm, '第 %d 页' % doc.page)
    canvas.restoreState()


out = r'C:\Users\24968\Desktop\rtt\docs\前奏架构设计_门前惊雷.pdf'
doc = BaseDocTemplate(out, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                      topMargin=19 * mm, bottomMargin=15 * mm,
                      title='前奏架构设计 · Episode 2')
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')
doc.addPageTemplates([PageTemplate(id='main', frames=[frame], onPage=on_page)])
doc.build(story)
print('OK ->', out)

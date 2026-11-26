# -*- coding: utf-8 -*-
"""可执行方案：拆分 do_action（含依据、清单、骨架、验证）"""
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
story.append(Paragraph('可执行方案：拆分 do_action', S_T))
story.append(Paragraph('把 6,258 行的分发函数恢复为「一个用例一个过程」', S_SUB))
story.append(Spacer(1, 2.5 * mm))

p('**目标文件**：`rules.js`（40,294 行）· `do_action`（第 32,616–38,873 行）')
p('**改动性质**：**纯结构重构**——不修改任何业务判断、不改变任何返回值、不新增功能。')
p('**预期结果**：`do_action` 从 6,258 行降到约 20 行；新增一个 `action_handlers.js` 路由表；'
  '86 个分支各成一个 5–1,100 行的具名函数。')

story.append(Spacer(1, 2 * mm))
key('**为什么这件事值得做、且必须先做**：它是唯一一项「零业务风险 + 收益立竿见影」的改动。'
    '拆完之后，后续的卡效注册表、单测、双份规则合并才有落脚点。')

# ================= 一、依据 =================
sec('一、依据')

h('1.1 课件依据（三条，逐条对应）')

story.append(tbl([['课件出处', '原则', '本项目违反的证据'],
                  ['**L4 P24 · SOLID 的 S**', '**单一职责**：一个模块/函数只对一个变化原因负责',
                   'do_action 同时承担 7 件事：动作分发、权限校验、成本支付、效果结算、'
                   '日志记录、状态刷新、异常回滚'],
                  ['**L4 P24 · SOLID 的 O**', '**开闭原则**：对扩展开放、对修改关闭',
                   '新增一张卡 = 在 6,258 行里插入一个 if 分支；每加卡都修改核心文件'],
                  ['**L5 P4–P5 · Transaction Script**',
                   'Transaction Script 的**规范形态**是「一个用例一个过程」，'
                   '缺点是「复杂后混乱、重复代码、难维护」',
                   '本项目采用了 TS，但把**全部 86 个用例的过程塞进了同一个函数**——'
                   '这已不是规范的 TS，而是它的退化形态'],
                  ], [42, 58, 74]))

key('**关键澄清**：这份方案**不是**要把项目改造成 Domain Model（L5 的另一种模式）。'
    '那需要重写 6 万行、成本远超收益。<br/>'
    '本方案做的是「**把退化的 Transaction Script 恢复成规范的 Transaction Script**」——'
    '一个用例一个函数，正是 L5 P4 描述的原始形态。')

h('1.2 数据依据（实测）')

story.append(tbl([['指标', '数值', '说明'],
                  ['do_action 总行数', '**6,258**', '第 32,616–38,873 行'],
                  ['if (action === ...) 分支数', '**86**', '其中 3 处合并了 2 个 action'],
                  ['去重后的 action 名', '约 **89**', '含 3 处双 action 合并'],
                  ['分支覆盖的行数占比', '**99.8%**', '除函数头 9 行外全是分支'],
                  ['前 5 大分支合计', '**2,867 行（46%）**', 'play_card 一项就 1,100 行'],
                  ['前 10 大分支合计', '**3,719 行（59%）**', '见下表'],
                  ['4–50 行的小分支', '**约 60 个**', '可批量机械处理'],
                  ], [52, 42, 80]))

tip('**这组数据的含义**：工作量高度集中——**拆掉 10 个分支就解决 59% 的代码**，'
    '剩下 76 个分支虽多但都很小，可以最后批量收尾。这让重构可以**分批交付**，不必一次性完成。')

# ================= 二、目标结构 =================
story.append(PageBreak())
sec('二、目标结构')

h('2.1 改造前后对比')

story.append(tbl([['', '现在', '改造后'],
                  ['do_action', '**6,258 行**，86 个 if 分支串联', '**约 20 行**，只做查表与兜底'],
                  ['业务代码位置', '全部内联在 do_action 里', '按 action 拆成 86 个具名函数'],
                  ['新增一个动作', '在 6,258 行中间插入分支', '在路由表加一行 + 写一个新函数'],
                  ['单元测试', '无法单独测试任何分支', '每个 action_xxx 可独立调用'],
                  ], [30, 68, 76]))

h('2.2 路由表设计')

p('新建 `action_handlers.js`（与 rules.js 同目录），导出一个「动作名 → 处理函数」的映射：')

code([
    "'use strict'",
    "/* action_handlers.js —— do_action 的分发表。",
    " * 每个 action 一个具名函数，签名统一为 (game, side, current, arg)。",
    " * 约定：函数返回 game（或 undefined，由 do_action 兜底为 game）。",
    " */",
    "",
    "const H = {}",
    "",
    "function reg(name, fn) {",
    "  if (H[name]) throw new Error('duplicate action: ' + name)",
    "  H[name] = fn",
    "}",
    "",
    "/* ---- 第一批（Top 5）---- */",
    "reg('play_card', require('./actions/play_card.js'))",
    "reg('activate_status', require('./actions/activate_status.js'))",
    "reg('resolve_battle', require('./actions/resolve_battle.js'))",
    "reg('next_nation', require('./actions/next_nation.js'))",
    "reg('prelude_trigger_discard', require('./actions/prelude_trigger_discard.js'))",
    "",
    "/* ---- 第二批 ---- */",
    "reg('use_armed_offer', require('./actions/use_armed_offer.js'))",
    "/* ... 其余 5 个 ... */",
    "",
    "/* ---- 第三批：小分支，可写成内联函数 ---- */",
    "reg('log', function (game, side, current, arg) {",
    "  game.log.push(String(arg == null ? '' : arg))",
    "  return game",
    "})",
    "",
    "module.exports = H",
])

note('说明：`reg` 里的重复检测很关键——它能保证拆分过程中不会因为手误把两个分支映射到同一个名字，'
     '也不会漏掉某个 action（启动时即可发现）。')

h('2.3 新版 do_action（替换第 32,616–38,873 行）')

code([
    "function do_action(state, current, action, arg) {",
    "  const game = state",
    "  const side = current === ALLIES_ROLE ? ALLIES : AXIS",
    "",
    "  const handler = ACTION_HANDLERS[action]",
    "  if (!handler) {",
    "    game.log.push('【系统】未知动作：' + action)",
    "    return game",
    "  }",
    "  return handler(game, side, current, arg) || game",
    "}",
])

key('**两个细节决定成败**：<br/>'
    '①  `|| game` 兜底——原代码里每个分支都以 `return game` 结尾，'
    '抽成函数后若某分支忘了 return，兜底能保证行为不变；<br/>'
    '②  `current` 与 `side` **都要传**——原代码两者都在用'
    '（`const side = current === ALLIES_ROLE ? ALLIES : AXIS`，'
    '以及 `const mySide = side`，还有直接用 `current` 做日志与权限判断的地方）。')

# ================= 三、迁移示范 =================
sec('三、一个完整迁移示范')

p('以最小的分支 `log`（第 32,941–32,944 行，4 行）为例，演示「剪切 → 粘贴 → 改签名」三步：')

story.append(tbl([['步骤', '动作', '结果'],
                  ['① 剪切', '把 do_action 里 `if (action === \'log\') { ... }` 整块剪走',
                   'do_action 少 4 行'],
                  ['② 粘贴', '在新文件里定义为具名函数，首行改为 `function (game, side, current, arg) {`',
                   '函数体原样保留'],
                  ['③ 登记', '在 action_handlers.js 里 `reg(\'log\', …)`', '路由表多一行'],
                  ], [24, 96, 54]))

p('**改造前**（rules.js 第 32,941 行）：')
code([
    "\tif (action === 'log') {",
    "\t\tgame.log.push(String(arg == null ? '' : arg))",
    "\t\treturn game",
    "\t}",
])

p('**改造后**（action_handlers.js）：')
code([
    "reg('log', function (game, side, current, arg) {",
    "  game.log.push(String(arg == null ? '' : arg))",
    "  return game",
    "})",
])

bad('**唯一必须小心的三种分支**：<br/>'
    '① **合并分支**（如 `opening_discard || debug_place`）：必须拆成两个 reg，'
    '并把原来的 `||` 判断改到各自函数内或路由表里分别登记；<br/>'
    '② **直接委派型**（如 `return do_opening_discard(game, current, arg)`）：'
    '这类最简单，直接把 `do_xxx` 包一层即可；<br/>'
    '③ **使用了函数头局部变量的分支**（如 `mySide`、`side`）：'
    '确认这些变量已通过参数传入，否则会 `ReferenceError`。')

# ================= 四、三批清单 =================
story.append(PageBreak())
sec('四、迁移清单（三批，按收益排序）')

h('4.1 第一批：Top 5（2,867 行，占 46%）')

story.append(tbl([['#', 'action', '起始行', '行数', '备注'],
                  ['1', '**play_card**', '37,243', '**1,100**', '最大，建议再按卡的 4 种类型二次拆分'],
                  ['2', '**activate_status**', '35,648', '576', '状态卡激活，逻辑相对独立'],
                  ['3', '**resolve_battle**', '34,622', '450', '战斗结算'],
                  ['4', '**next_nation**', '33,231', '425', '回合推进'],
                  ['5', '**prelude_trigger_discard**', '32,625', '316', '前奏期'],
                  ['', '**合计**', '', '**2,867**', ''],
                  ], [12, 48, 24, 20, 70]))

tip('**play_card 的特别处理**：它 1,100 行且内部大概率还有"按卡类型/按卡 id"的二次分支，'
    '建议在第一批里**只把它整块搬出去**（成为 `actions/play_card.js`），'
    '内部的二次拆分放到第二批或独立一次提交——**一次只做一件事**，便于定位问题。')

h('4.2 第二批：第 6–10 名（952 行，占 15%）')

story.append(tbl([['#', 'action', '起始行', '行数'],
                  ['6', 'use_armed_offer', '36,540', '305'],
                  ['7', 'resolve_response_choice', '33,991', '205'],
                  ['8', 'trigger_response', '34,442', '180'],
                  ['9', 'skip_armed_offer', '36,845', '141'],
                  ['10', 'pass_response', '34,321', '121'],
                  ['', '**合计**', '', '**952**'],
                  ], [12, 54, 26, 24]))

p('这五个都属「响应/挂起窗口」族（pending_* 系列），'
  '拆的时候可以放在同一个 `actions/response/` 目录下，便于对照。')

h('4.3 第三批：其余 76 个分支（2,429 行）')

p('这些分支多在 4–50 行之间，且大多只有「取参数 → 校验 → 改状态 → 记日志 → return game」'
  '的固定结构，可以**批量机械处理**（一次提交处理 10–15 个）：')

story.append(tbl([['行数区间', '数量（约）', '处理方式'],
                  ['4–15 行', '约 20 个', '直接写成内联函数，不必单独建文件'],
                  ['16–40 行', '约 25 个', '写成内联函数或小文件'],
                  ['41–120 行', '约 11 个', '单独建文件'],
                  ], [36, 30, 108]))

# ================= 五、验证 =================
sec('五、验证与回退')

h('5.1 三层验证（每批都做）')

story.append(tbl([['层', '方法', '判定标准'],
                  ['**① 语法**', '`node --check rules.js action_handlers.js`', '无报错'],
                  ['**② 现有脚本**', '运行 `tools/` 与根目录下与该 action 相关的 `_test*.js`',
                   '输出与改造前完全一致'],
                  ['**③ 日志回放**', '**这是最有力的一层**：用同一串 action 序列驱动新旧两版，'
                   '逐条 diff `game.log`', 'log 数组逐元素相等'],
                  ], [22, 96, 56]))

key('**为什么日志回放最可靠**：这个项目已经把每一次状态变更都写进 `game.log`'
    '（全场引用 842 次），并且实现了时间回溯。'
    '这意味着**你手上已经有一个现成的「行为快照」工具**——'
    '同一份 action 序列跑两遍，log 应逐字符相同。')

h('5.2 回退策略')

li('**每批一个独立提交**，提交信息写明「refactor: 抽出 action_xxx，不改逻辑」')
li('**不设 feature 分支**——直接在主干小步提交，因为每批都可单独回退')
li('**保留旧函数体作为注释**只保留第一批（作为对照样本），之后不再保留（避免仓库膨胀）')

h('5.3 停止条件（什么时候该停）')

bad('如果拆到第三批时发现**某分支依赖 do_action 内部的局部变量**（`game`、`side`、`current` 之外的），'
    '说明该分支与分发逻辑耦合，此时**不要硬拆**——在注释里标注，保留在原处，'
    '等它有明确的独立测试后再处理。')

# ================= 六、收益 =================
sec('六、预期收益（可量化）')

story.append(tbl([['指标', '现在', '第一批后', '全部完成后'],
                  ['do_action 行数', '6,258', '约 3,400', '**约 20**'],
                  ['最大函数行数', '6,258（do_action）', '1,100（play_card）', '**1,100**'],
                  ['可单独测试的 action', '0', '5', '**约 89**'],
                  ['新增动作的改动点', '1 处（6,258 行内）', '2 处', '**2 处（但都不碰核心）**'],
                  ], [48, 44, 44, 38]))

note('注：「最大函数行数」在第一批后变成 play_card 的 1,100 行——'
     '这正是第二批起要处理的对象（它内部的按卡类型二次分发）。')

story.append(Spacer(1, 2 * mm))
key('**最终效果**：`do_action` 从「装着全部业务的仓库」变成「一张 20 行的分发表」，'
    '每个业务用例成为独立可读、可测、可独立修改的函数——'
    '这正是 L5 P4 里 Transaction Script 原本该有的样子。')


def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFont('CN', 7.4)
    canvas.setFillColor(GREY)
    canvas.drawString(18 * mm, h - 12 * mm, '迁移方案 · 拆分 do_action · 军需官次要战场')
    canvas.setStrokeColor(colors.HexColor('#d5d5d5'))
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, h - 14 * mm, w - 18 * mm, h - 14 * mm)
    canvas.drawRightString(w - 18 * mm, 10 * mm, '第 %d 页' % doc.page)
    canvas.restoreState()


out = r'C:\Users\24968\Desktop\rtt\docs\迁移方案_拆分do_action.pdf'
doc = BaseDocTemplate(out, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                      topMargin=19 * mm, bottomMargin=15 * mm,
                      title='迁移方案 · 拆分 do_action')
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')
doc.addPageTemplates([PageTemplate(id='main', frames=[frame], onPage=on_page)])
doc.build(story)
print('OK ->', out)

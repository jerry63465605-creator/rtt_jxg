"use strict"

/* globals data layout view player send_action send_query */

/*
 * 军需官 · 次要战场 —— 客户端
 *
 * 生命周期（由 /common/client.js 驱动）：
 *   window load  ->  build_map()      构建静态地图（只跑一次）
 *   state 消息   ->  on_update()      用 view 数据刷新（每次状态变化都调用）
 *
 * 注意：view 是 client.js 提供的全局变量，本文件不要重新声明。
 */

const MAP_W = 4835
const MAP_H = 1612

/* 阵营 -> 显示信息 */
const SIDE_INFO = {
	axis:   { role: "Axis",   label: "轴心国", cls: "axis" },
	allies: { role: "Allies", label: "同盟国", cls: "allies" },
}

const NATION_CLS = {
	"德国": "germany", "日本": "japan", "意大利": "italy",
	"英国": "uk", "法国": "france", "苏联": "ussr",
	"美国": "usa", "中国": "china",
}

const TYPE_LABEL = { army: "陆", navy: "海", air: "空", reserve: "预", base: "本" }

/* 客户端本地状态 */
const ui = {
	spaces: {},      // id -> element
	piece_el: {},    // piece id -> element
	marker_el: {},   // space id -> 计分标记胶囊 element
	placed: {},      // piece id -> space id（上次渲染的位置，用于增量更新）
	built: false,
	selected: null,  // 当前选中的格位 id
	debug_mode: null, // null | "place" | "remove"
}

/* ============================================================
 * 一、静态地图构建（只跑一次）
 * ============================================================ */

function build_map() {
	if (ui.built)
		return

	const wrap = document.getElementById("spaces")
	if (!wrap)
		return

	/* 按 id 顺序遍历 data.spaces（索引 0 是占位空对象） */
	for (let s = 1; s < data.spaces.length; s++) {
		const sp = data.spaces[s]
		if (!sp || !sp.name)
			continue

		const box = layout[sp.name]
		if (!box) {
			console.warn("layout 缺少格位: " + sp.name)
			continue
		}
		const [x, y, w, h] = box

		const elt = document.createElement("div")
		elt.space_id = s
		elt.className = "space " + sp.terrain + markup_classes(sp)
		elt.style.left = x + "px"
		elt.style.top = y + "px"
		elt.style.width = w + "px"
		elt.style.height = h + "px"

		const name = document.createElement("div")
		name.className = "space_name"
		name.textContent = sp.name
		elt.appendChild(name)

		elt.addEventListener("click", on_click_space)
		elt.addEventListener("mouseenter", on_focus_space)
		elt.addEventListener("mouseleave", on_blur_space)

		wrap.appendChild(elt)
		ui.spaces[s] = elt
	}

	ui.built = true

	/* 构建完立刻渲染一次（view 可能已经到了） */
	update_map()
}

/*
 * 地块 CSS class。
 *
 * 【补给点走动态层】2026-09-23：
 * 不再直接读 sp.supply（那是地图标定的静态值），
 * 而是读 view.supply_by_id —— 它反映卡牌改过的当前状态，
 * 且区分"仅对某个阵营有效"。
 *
 * 返回：
 *   ""                 不是补给点
 *   " supply"          两个阵营都视为补给点
 *   " supply half"     仅某一阵营视为补给点（半星，视觉上要能看出区别）
 */
function markup_classes(sp) {
	let c = ""
	if (sp.home_base) c += " home_base"
	if (sp.strait) c += " strait"
	const d = view && view.supply_by_id && view.supply_by_id[sp.id]
	if (d) {
		const both = d.axis && d.allies
		c += both ? " supply" : " supply half"
	}
	return c
}

/* ============================================================
 * 二、每帧刷新（on_update 由 client.js 调用）
 * ============================================================ */

function on_update() {
	update_map()
}

function update_map() {
	if (!view)
		return
	if (!ui.built)
		build_map()

	update_side_info()
	update_phase_panel()
	update_pieces()
	update_strait_line()
	update_supply_line()
	update_neutral_line()
	/* 补给点可被卡牌改变，class 要跟着刷新 */
	update_supply_classes()

	/*
	 * 顺序很重要：先渲染手牌，再渲染两个面板。
	 *
	 * update_hand_panel() 只负责重画手牌区 + 状态文字，它【不会】去更新
	 * #resource_box（那需要知道 pending_resource / air_move 的状态，
	 * 否则会互相递归）。而"点了手牌选代价"的反馈恰恰体现在面板上，
	 * 所以面板必须由这里统一刷新。
	 */
	update_hand_panel()
	update_response_panel()
	update_resource_box()
	update_peek_box()
	update_echo_discard_box()
	update_event_done_button()
	update_air_box()
	update_violations()

	/* 计分：分数面板 + 地图上的计分标记 */
	update_score_panel()
	update_markers()

	/*
	 * 手牌/目标可能因这次 view 更新而失效（如卡已被打出），
	 * 重新应用一次高亮，保证与实际可选项一致。
	 */
	if (pending_card)
		highlight_targets(pending_targets)
}

/* 安全取元素并写文本 */
function set_text(id, text) {
	const el = document.getElementById(id)
	if (el)
		el.textContent = text
}

function update_side_info() {
	const side = view.side
	const info = SIDE_INFO[side]
	if (!info)
		return

	/* 本方高亮（client.js 会给 body 加 role class，这里补充显示） */
	if (!document.body.classList.contains(info.cls))
		document.body.classList.add(info.cls)

	/*
	 * 【2026-09-26 修正】"行动方"要读 view.active，不能读 view.side。
	 * view.side 恒等于【本方】阵营，旧写法会让两边都显示自己是行动方，
	 * 挂起等待时完全看不出时点变化。
	 */
	const act = (view.active === "Allies") ? "allies"
		: (view.active === "Axis" ? "axis" : null)
	const actInfo = SIDE_INFO[act] || info
	set_text("turn_line",
		`第 ${view.turn} 回合 · 行动方：${actInfo.label}` +
		(act && act !== side ? "（本方：" + info.label + "）" : "") +
		(view.phase ? " · " + view.phase : ""))
	const sc = view.score || { axis: 0, allies: 0 }
	set_text("axis_stat", sc.axis + " 分")
	set_text("allies_stat", sc.allies + " 分")

	/* 是否是本人的回合（client.js 之后还会按 view.actions 再设一次） */
	const header = document.querySelector("header")
	if (header)
		header.classList.toggle("your_turn", is_my_turn())
}

/*
 * 回合状态机面板：显示当前行动国 + 7 阶段进度条
 * 进度条上每个阶段一个小格，当前阶段高亮，已过的打勾。
 */
function update_phase_panel() {
	const nation = view.current_nation || "?"
	const idx = (view.phase_index || 1) - 1     /* 0-based */

	set_text("phase_nation", nation)
	set_text("phase_name", view.turn_phase_zh || "—")
	set_text("phase_step", (idx + 1) + "/" + (view.phase_total || 7))
	/*
	 * 挂起等待时把"在等谁"写在阶段面板上：
	 * 决策方有各自的询问框，另一方（waiting_for）只能靠这行知道时点。
	 */
	const waitTxt = view.waiting_for ? view.waiting_for.text : ""
	set_text("phase_note", waitTxt
		? waitTxt + (view.phase_note ? " · " + view.phase_note : "")
		: (view.phase_note || ""))

	/* 阶段进度条 */
	const track = document.getElementById("phase_track")
	if (track && view.phases) {
		track.innerHTML = view.phases.map((p, i) => {
			const cls = i < idx ? "done" : (i === idx ? "cur" : "")
			const mark = i < idx ? "✓" : (i + 1)
			return '<span class="ph ' + cls + '" title="' + p.zh + '">' + mark + "</span>"
		}).join("")
	}

	/* 按钮只在轮到自己、且没有待决事项时可点 */
	const btn = document.getElementById("btn_next_phase")
	if (btn)
		btn.disabled = !can_act_in_turn()

	update_phase_buttons()
}

/*
 * 阶段相关的可选动作按钮（出牌三选一 / 资源再分配 / 收回询问开关）。
 */
function update_phase_buttons() {
	/* 见 can_act_in_turn：挂起等待期间不给回合内操作 */
	const mine = can_act_in_turn()

	const inPlay = mine && view.turn_phase === "play"
	const play = document.getElementById("play_choices")
	if (play)
		play.classList.toggle("hide", !inPlay)

	/* 空军阶段："弃 1 张手牌调度空军"的入口按钮 */
	const air = document.getElementById("btn_air_move")
	if (air) {
		const inAir = mine && view.turn_phase === "airforce" && !view.my_air_done
		air.classList.toggle("hide", !(mine && view.turn_phase === "airforce"))
		air.disabled = !inAir
		air.textContent = view.my_air_done
			? "空军阶段：本回合已行动"
			: "调度空军…（弃 1 张手牌）"
	}

	/*
	 * 资源再分配按钮：每回合只能一次。
	 * 手牌不足 3 张、或本回合已用过 -> 禁用（并说明原因）。
	 */
	const res = document.getElementById("btn_resource")
	if (res) {
		const inResource = mine && view.turn_phase === "resource"
		const canSwap = inResource && view.can_resource_swap
		res.classList.toggle("hide", !inResource)
		res.disabled = !canSwap
		res.textContent = view.my_swap_count
			? "资源再分配：本回合已用"
			: "资源再分配…（弃 3 张换 1 张基本卡）"
	}

	/*
	 * 先做状态清理，再更新 UI 文案 —— 顺序反了会让按钮显示上一次的
	 * 数量（曾经出现"已选 0 张"却写着"确认弃牌（1 张）"）。
	 */
	/* 阶段切换后清掉上一阶段的弃牌选择，避免误提交旧牌 */
	if (view.turn_phase !== "discard" && discard_pick.length)
		discard_pick = []

	/*
	 * 弃牌阶段的【确认弃牌】按钮：
	 * 只在弃牌阶段显示，选中 0 张时禁用。
	 */
	const confirmBtn = document.getElementById("btn_confirm_discard")
	if (confirmBtn) {
		const inDiscard = mine && view.turn_phase === "discard"
		confirmBtn.classList.toggle("hide", !inDiscard)
		confirmBtn.disabled = !discard_pick.length
		confirmBtn.textContent = discard_pick.length
			? "确认弃牌（" + discard_pick.length + " 张）"
			: "确认弃牌"
	}

	/* 资源弹框开着时，若已不可再换（阶段变了 / 已用过）则自动关闭 */
	if (pending_resource && !view.can_resource_swap) {
		pending_resource = null
		update_resource_box()
	}
	update_ask_box_from_view()

	const toggle = document.getElementById("btn_toggle_ask")
	if (toggle) {
		toggle.textContent = "询问收回部队：" + (view.ask_remove ? "开" : "关")
		toggle.disabled = !mine
	}

	/*
	 * 出牌阶段每回合只能三选一：已行动后两个选项都禁用，
	 * 手牌区也据此禁用点击（见 update_hand_panel）。
	 */
	const done = !!view.my_play_done
	for (const id of ["btn_discard_mode", "btn_minus_score"]) {
		const b = document.getElementById(id)
		if (b)
			b.disabled = !mine || done
	}

	/* 资源再分配面板 / 询问面板随状态重建 */
	update_resource_box()
	update_ask_box_from_view()
	/* 防守方：战斗挂起时弹出"是否用空军代受"的询问 */
	update_pending_battle_box()
	/* 响应卡挂起：持有方弹"发动 / 不发动"询问 */
	update_pending_trigger_box()
	/* 经济战挂起：受击方依次弹"损耗 / 移除海军"询问 */
	update_pending_econ_box()
	/* 桌面状态卡渲染（含可触发高亮） */
	update_table_status()
}

/* 出牌阶段②：进入"弃 1 张手牌"模式（再点手牌即弃置） */
let discard_mode = false

/*
 * 弃牌阶段：被"框住"选中的手牌（实体牌 id 列表）。
 * 点卡切换选中，最后点侧栏【确认弃牌】一次性提交。
 */
let discard_pick = []

/* 确认弃掉当前选中的所有手牌 */
function confirm_discard() {
	if (view.turn_phase !== "discard") {
		toast("只有弃牌阶段才能主动弃牌")
		return
	}
	if (!discard_pick.length) {
		toast("请先点手牌选择要弃置的牌")
		return
	}
	send_action("discard_in_discard_phase", { cards: discard_pick.slice() })
	toast("已弃置 " + discard_pick.length + " 张手牌")
	discard_pick = []
	update_hand_panel()
	update_phase_buttons()
}

function toggle_discard_mode() {
	discard_mode = !discard_mode
	toast(discard_mode ? "请点要弃置的手牌（Esc 取消）" : "已退出弃牌模式")
	update_hand_panel()
}

/* 出牌阶段③：减 1 分 */
function do_minus_score() {
	send_action("minus_score", {})
}

/* Esc / 右键时也退出弃牌模式 */
function cancel_discard_mode() {
	if (!discard_mode)
		return
	discard_mode = false
	update_hand_panel()
}

/*
 * 是否轮到本方（RTT 把 player 设成 role 名）。
 *
 * 【2026-09-26 修正】旧写法拿 view.side（= 本方阵营，恒等于自己的阵营）
 * 和自己的阵营比，结果【永远为 true】——于是就算挂在等对方表态，
 * 顶栏依旧显示本方回合、按钮也照常可点（点了才被服务端拒）。
 *
 * 正确口径是比 view.active（服务端的操作权归属）：
 * 战斗/响应挂起时服务端会把 active 临时让给"该表态的那一方"，
 * 所以这里会自动变成 false，界面即切到"等待对方行动"。
 */
function is_my_turn() {
	const a = view && view.active
	if (!a || !player)
		return false
	if (a === player)
		return true
	/* 兼容 "Both" / 数组（其它模块可能这么写） */
	return a === "Both" || (Array.isArray(a) && a.indexOf(player) >= 0)
}

/*
 * 本方当前能否执行"回合内操作"（推进阶段 / 出牌 / 弃牌 / 调度 / 减分…）。
 *
 * 挂起时即便操作权让给了本方，也【只能】回答那一个待决事项，
 * 不能顺手打牌或推进阶段 —— 否则等对方代受的英国界面上
 * 会冒出德国的"出牌阶段三选一"按钮。
 */
function can_act_in_turn() {
	return is_my_turn() && !view.pending_battle &&
		!view.pending_trigger && !view.pending_econ
}

/* 推进阶段 */
function do_next_phase() {
	send_action("next_phase", {})
}

/* ---------------- 手牌渲染 ---------------- */

/*
 * 手牌渲染（仿 PoG：卡用真实卡图，悬停放大到 #tooltip）
 *
 * 手牌上限 7（HAND_LIMIT）：
 *   · 上限内   -> 正常显示
 *   · 超过上限 -> 面板标题显示红色 "（超出 N 张，弃牌阶段将弃到 7）"
 */
const HAND_LIMIT = 7

function card_image_url(c) {
	return c && c.img ? ("cards/" + c.img) : null
}

/* 建一张卡元素（卡图优先，缺图则回落为文字卡） */
function build_card_elt(c) {
	const d = document.createElement("div")
	d.className = "card t-" + c.type
	d.card = c

	const url = card_image_url(c)
	if (url)
		d.style.backgroundImage = "url(" + JSON.stringify(url) + ")"

	/* 回落层：卡图加载失败或缺失时显示文字 */
	const fb = document.createElement("div")
	fb.className = "card_fallback"
	const nm = document.createElement("div")
	nm.className = "card_name"
	nm.textContent = c.name
	const ty = document.createElement("div")
	ty.className = "card_type"
	ty.textContent = (view.card_types && view.card_types[c.type]
		? view.card_types[c.type].zh : c.type)
	fb.append(nm, ty)
	d.appendChild(fb)

	/* 卡图存在时隐藏文字回落层（onerror 时再显示） */
	if (url) {
		fb.style.display = "none"
		const probe = new Image()
		probe.onerror = () => { fb.style.display = "" }
		probe.src = url
	}

	d.title = c.name + "\n" + (view.card_types && view.card_types[c.type]
		? view.card_types[c.type].zh : c.type) + "\n" + c.text

	/* 悬停：在 #tooltip 显示放大卡图（仿 PoG） */
	d.addEventListener("mouseenter", () => on_focus_card(c))
	d.addEventListener("mouseleave", on_blur_card)

	/*
	 * ---- 点击处理 ----
	 *
	 * 关键教训：卡片的点击行为【不能】在渲染时算好存进闭包。
	 *
	 * 之前把 `d.__act = () => {...}` 在 update_hand_panel() 里赋值，
	 * 结果踩了坑：资源再分配要先 `send_query('deck_basics')` 走一个
	 * 网络往返，返回前 on_update 又重绘了一次手牌区 —— 那时
	 * pending_resource 还是 null，于是 __act 被写成"请先点按钮"的提示，
	 * 之后即便面板打开了，卡片也不会再重绘，__act 就永远是那句废话，
	 * 表现为"资源再分配选不中手牌"。
	 *
	 * 现在改为：只在元素上标记【是哪张牌】（d.__card），
	 * 点击时再调用 on_click_hand_card() 现算当前该做什么。
	 */
	d.__card = c
	d.addEventListener("click", (ev) => {
		ev.stopPropagation()
		on_click_hand_card(c, d)
	})

	return d
}

/*
 * 桌面响应卡可视化（2026-09-25）
 *   遍历 view.table_responses（仅本方、已暴露卡面）画正面卡；
 *   再按 view.table_responses_opponent_count 画对应数量的背面卡（对方暗置）。
 *   与 build_card_elt 不同：这些卡【只展示】，不挂“打出”点击。
 */
function build_response_card_elt(c, faceUp) {
	const d = document.createElement("div")
	if (faceUp && c) {
		d.className = "card t-" + (c.type || "RESPONSE")
		const url = c.img ? ("cards/" + c.img) : null
		if (url)
			d.style.backgroundImage = "url(" + JSON.stringify(url) + ")"
		const fb = document.createElement("div")
		fb.className = "card_fallback"
		const nm = document.createElement("div")
		nm.className = "card_name"
		nm.textContent = c.name
		const ty = document.createElement("div")
		ty.className = "card_type"
		ty.textContent = (view.card_types && view.card_types[c.type]
			? view.card_types[c.type].zh : (c.type || "响应"))
		fb.append(nm, ty)
		d.appendChild(fb)
		if (url) {
			fb.style.display = "none"
			const probe = new Image()
			probe.onerror = () => { fb.style.display = "" }
			probe.src = url
		}
		d.title = c.name + "\n" + ty.textContent + "\n" + (c.text || "")
		d.addEventListener("mouseenter", () => on_focus_card(c))
		d.addEventListener("mouseleave", on_blur_card)
	} else {
		d.className = "card back"
		d.title = "对方响应卡（背面向上）"
	}
	return d
}

function update_response_panel() {
	const box = document.getElementById("response_cards")
	const note = document.getElementById("response_note")
	if (!box)
		return
	box.innerHTML = ""

	const own = (view.table_responses || [])
	const opp = (view.table_responses_opponent_count || 0)

	for (const c of own)
		box.appendChild(build_response_card_elt(c, true))
	for (let i = 0; i < opp; i++)
		box.appendChild(build_response_card_elt(null, false))

	if (note)
		note.textContent = "（本方 " + own.length + " · 对方 " + opp + "）"

	if (!own.length && opp === 0)
		box.innerHTML = '<div class="hand_empty">（桌面暂无响应卡）</div>'
}

/*
 * 手牌点击的唯一入口：按【点击那一刻】的状态决定行为。
 * 顺序即优先级（资源再分配的选代价 > 空军调度选代价 > 平时出牌）。
 */
/*
 * ============================================================
 * 打牌的阶段限制（与 rules.js 的 check_phase_for_card 保持一致）
 *
 *   ① 出牌阶段：打 1 张（增强卡除外，它不占名额）
 *   ② 其他阶段：只允许【卡面有特殊说明】的卡
 *   ③ 增强卡(EFFECT)：按时点打出（CARD_TRIGGERS），
 *      不是"任何阶段都能打"（2026-09-25 修正）
 * ============================================================
 */

/* 增强卡：type 判断（置灰逻辑里已不单独用它跳过，保留供 has_phase_note 等复用） */
function is_enhance_card(c) {
	return !!c && c.type === "EFFECT"
}

/*
 * 兼容保留：旧逻辑里"按时机打出"的三种卡。
 * 现在只有增强卡真正不受阶段限制，其余仍按卡面说明判定。
 */
function is_timing_card(c) {
	return !!c && (c.type === "RESPONSE" || c.type === "EFFECT" || c.type === "STATUS")
}

/* 《空军力量》：卡面说明限定其只能在空军阶段使用 */
function is_airforce_only(c) {
	return !!c && c.name === "空军力量"
}

/* 卡面文本里是否点了阶段名 */
const PHASE_NAME_RE = /(资源再分配|出牌阶段|空军阶段|补给阶段|计分阶段|弃牌阶段|摸牌阶段)/

/* 卡面是否针对某阶段作了特殊说明（不传 phaseZh 则只要提到阶段名即可） */
function has_phase_note(c, phaseZh) {
	if (!c || !c.text || !PHASE_NAME_RE.test(c.text))
		return false
	return phaseZh ? c.text.indexOf(phaseZh) >= 0 : true
}

/* 当前阶段的中文名（用于提示文案） */
const PHASE_ZH = {
	resource: "资源再分配阶段",
	play: "出牌阶段",
	airforce: "空军阶段",
	supply: "补给阶段",
	scoring: "计分阶段",
	discard: "弃牌阶段",
	draw: "摸牌阶段",
}

/*
 * 这张卡能否在【当前阶段】打出。返回 { ok, reason }
 * 口径与 rules.js 的 check_phase_for_card 一一对应。
 */
function check_phase_for_card(c) {
	const ph = view.turn_phase

	/*
	 * ① 有【时点声明】的卡（增强卡 ECHO）：按声明的时点判定。
	 *
	 * 【2026-09-25 变更】旧逻辑是"增强卡随时可打"，
	 * 但服务端已改为按时点打出（玩家明确"涉及阶段的时机都是自己回合"）。
	 * 若客户端仍放行，就会出现"点了却被服务端拒绝"。
	 *
	 * 所以这里【镜像服务端的 trigger_ready()】，
	 * 数据来源是服务端给的 view.card_triggers / view.current_faction
	 * —— 不自己维护一份，避免两边漂移（pitfalls R3）。
	 */
	/*
	 * 【2026-09-25 bug 修复】
	 * 手牌里的 c 是 inst_pub() 返回的实例对象：
	 *   c.id       = 实例 id（如 "15310#5"）
	 *   c.card_id  = 卡面 id（如 "15310"）
	 *
	 * CARD_TRIGGERS 表的键是【卡面 id】，不是实例 id，
	 * 所以必须用 c.card_id 查，不能直接用 c.id
	 * （否则 view.card_triggers["15310#5"] 永远 undefined，
	 *  所有增强卡都被判定为"无时点声明"→全部置灰/无反应）。
	 */
	const card_id = c.card_id || c.id
	/*
	 * 【2026-09-25 bug 修复】响应卡（RESPONSE）走特殊路径：
	 * 不查 trigger_ready（响应卡声明 kind='any' 是为了 fire_trigger 用，
	 * 不是用于主动打出判定）。
	 * 规则书：响应卡像普通牌一样在【出牌阶段】从手牌打出（占名额），
	 * 然后等时机触发——所以这里直接判出牌阶段，不走 tr.kind 分支。
	 */
	if (c.type === "RESPONSE") {
		if (ph !== "play")
			return { ok: false, reason: "响应卡只能在出牌阶段打出（之后任意时机触发）" }
		if (view.my_play_done)
			return { ok: false, reason: "本回合已打出过 1 张牌（名额已用）" }
		return { ok: true }
	}
	const tr = view.card_triggers && view.card_triggers[String(card_id)]
	if (tr) {
		if (tr.kind === "anytime")
			return { ok: true }
		if (tr.kind === "any")
			return { ok: false, reason: "响应卡由触发事件驱动，不能主动打出" }
		if (tr.kind === "self") {
			if (ph !== tr.phase)
				return {
					ok: false,
					reason: "只能在本方的" + (PHASE_ZH[tr.phase] || tr.phase) +
						"打出（当前是" + (PHASE_ZH[ph] || ph) + "）",
				}
			/* 必须是自己回合 */
			if (view.current_faction && view.my_faction &&
				view.current_faction !== view.my_faction)
				return { ok: false, reason: "只能在本方回合打出" }
			return { ok: true }
		}
	}

	/* 兜底：没有时点声明的增强卡仍随时可打（旧行为） */
	if (is_enhance_card(c))
		return { ok: true }

	const zh = PHASE_ZH[ph] || ph

	/* ② 出牌阶段：打 1 张（《空军力量》另有说明，不算在内） */
	if (ph === "play") {
		if (is_airforce_only(c))
			return { ok: false, reason: "《空军力量》的说明限定其只能在空军阶段打出" }
		if (view.my_play_done)
			return { ok: false, reason: "本回合出牌阶段已打出 1 张牌（每回合 1 张）" }
		return { ok: true }
	}

	/* ③ 空军阶段：空军力量（部署/夺取制空权）或 卡面写明"空军阶段" */
	if (ph === "airforce") {
		if (is_airforce_only(c)) {
			if (view.my_air_done)
				return { ok: false, reason: "本回合空军阶段已行动（二选一）" }
			return { ok: true }
		}
		if (has_phase_note(c, "空军阶段"))
			return { ok: true }
		return {
			ok: false,
			reason: "空军阶段只能打出《空军力量》、卡面说明允许在空军阶段打出的牌，或增强卡",
		}
	}

	/* ④ 其余阶段：只收"卡面有特殊说明"的卡 */
	if (has_phase_note(c))
		return { ok: true }
	return { ok: false, reason: "只有卡面有特殊说明的卡牌才能在" + zh + "打出" }
}

/*
 * 兼容旧接口：某张卡能否在空军阶段打出（布尔，供 basic_targets 等复用）。
 */
function can_play_in_airforce(c) {
	if (!c)
		return false
	if (is_airforce_only(c))
		return true
	return is_enhance_card(c) || has_phase_note(c, "空军阶段")
}

/*
 * EVENT / ECHO 卡的目标选择状态（2026-09-25）。
 *
 * pending_event_card   = 正在选目标的卡对象
 * pending_event_targets = event_targets 查询返回的目标信息
 * pending_event_choice = 已选的 choice 索引（二选一/四选一时）
 */
let pending_event_card = null
let pending_event_targets = null
let pending_event_choice = null
/*
 * 【2026-09-25 新增】多选地区（pick>1）的累积数组。
 * 单选时为 null/不使用；多选时玩家点地区累积到这里，
 * 达到 pick 数量后才 send_action({card, picks})。
 */
let pending_event_picks = null
/*
 * 【2026-09-25 新增】ECHO/EVENT 卡的"先选 N 张弃牌"流程。
 *
 * 当 query('event_targets') 返回的 tg.cost.discard > 0 时启用：
 *   pending_echo_discard = {
 *     card: 卡对象（pending_event_card）,
 *     need_targets: tg,           // 等会儿玩家选完弃牌后用来高亮地区
 *     drop: [],                   // 玩家选中的弃牌 id 数组
 *     limit: N,                   // 需要选几张
 *   }
 *
 * 玩家选满 N 张并确认后，pending_echo_discard 清空，
 * 进入 pending_event_targets + highlight_event_targets 流程。
 * 点地区提交时 send_action 带 cards: drop.slice()。
 */
let pending_echo_discard = null
/*
 * 已选好的弃牌（pending_echo_discard 清空后保留，供最终 send_action 用）
 */
let pending_echo_cards = null

/* 查询某张卡当前需要什么目标（走 send_query，结果在 on_reply 里处理） */
function query_event_targets(card_id) {
	/*
	 * send_query 是异步的，结果通过 on_reply('event_targets') 回调。
	 * 这里返回 null 表示"已发起查询，等回调"，
	 * 调用方（on_click_hand_card）据此不直接打出，而是等回调。
	 */
	console.log("[QUERY] query_event_targets called, card_id=", card_id)
	pending_event_card = inst_card_client(card_id)
	pending_event_targets = null
	pending_event_choice = null
	send_query("event_targets", { card: card_id })
	console.log("[QUERY] send_query returned")
	return null
}

/* 客户端取卡对象（从 view.hands 或 CARDS 里找） */
function inst_card_client(card_id) {
	/* view.hand_cards 可能已含卡对象 */
	const hc = (view.hand_cards || []).find(c => String(c.id) === String(card_id))
	if (hc) return hc
	/* 兜底：从 view.all_cards 里找（若有） */
	const ac = (view.all_cards || []).find(c => String(c.id) === String(card_id))
	return ac || { id: card_id, name: "?", type: "?" }
}

/* 高亮可选地区，等玩家点地图 */
function highlight_event_targets(tg) {
	/*
	 * 【格式对齐】highlight_targets 期望 spaces 是 [{ id, reason }]，
	 * 不能传裸 id 数组（否则 s.id 为 undefined，地区不会被高亮）。
	 */
	const cands = (tg.candidates || []).map(c => ({
		id: c.id,
		reason: c.name || "",
	}))
	const card = pending_event_card
	if (!cands.length) {
		toast("《" + (card ? card.name : "?") + "》当前没有合法目标")
		cancel_event_card()
		return
	}
	highlight_targets({ spaces: cands, pieces: [] })
	/*
	 * 【2026-09-25 多选】已选的地区再加 .sel 边框，
	 * 让玩家能看出哪几个已选过、还差几个。
	 */
	if (tg.pick > 1 && pending_event_picks && pending_event_picks.length) {
		for (const id of pending_event_picks) {
			const el = space_elt(id)
			if (el) el.classList.add("sel")
		}
	}
	toast("《" + card.name + "》：请点击一个高亮地区" +
		(tg.pick > 1 ? "（选 " + tg.pick + " 个）" : ""))
	/* 多选时显示 Done 按钮 */
	update_event_done_button()
}

/*
 * 【2026-09-25 多选 Done 按钮】参考 pog 的右上角 Done 按钮。
 *
 * 显示/隐藏规则：
 *   · 进入 pending_event_targets 且 pick > 1 时显示
 *   · 选满 pick 个 -> 按钮变亮可点
 *   · 未选满 -> 按钮置灰
 *   · 离开 pending_event_targets -> 隐藏
 *
 * 点击 Done -> send_action("play_card", {card, picks})，与之前自动提交同。
 */
function update_event_done_button() {
	const btn = document.getElementById("btn_event_done")
	if (!btn)
		return
	const active = pending_event_card && pending_event_targets &&
		(pending_event_targets.pick || 1) > 1
	if (!active) {
		btn.classList.add("hide")
		return
	}
	btn.classList.remove("hide")
	const pick = pending_event_targets.pick
	const count = (pending_event_picks || []).length
	btn.textContent = "Done (" + count + "/" + pick + ")"
	btn.disabled = (count !== pick)
}

/*
 * 玩家点 Done -> 真正提交 picks。
 * 也作为单选可选的"二次确认"入口（暂不启用，单选直接点地区就提交）。
 */
function confirm_event_done() {
	if (!pending_event_card || !pending_event_targets)
		return
	const pick = pending_event_targets.pick || 1
	/* 单选时 pending_event_picks 不存在 -> 不该走到这里 */
	if (pick <= 1) return
	if (!pending_event_picks || pending_event_picks.length !== pick) {
		toast("还需选 " + (pick - (pending_event_picks || []).length) + " 个地区")
		return
	}
	const arg = { card: pending_event_card.id, picks: pending_event_picks.slice() }
	/*
	 * 【2026-09-25 bug 修复】多选提交也按 pending step 发送 spaces 数组，
	 * 让多步卡（total>1）的服务端能正确拿到本步选的地区。
	 */
	if (pending_event_targets && pending_event_targets.step != null) {
		const sp = []
		sp[pending_event_targets.step] = pending_event_picks.slice()
		arg.spaces = sp
	}
	if (pending_event_choice != null)
		arg.choice = pending_event_choice
	if (pending_echo_cards && pending_echo_cards.length)
		arg.cards = pending_echo_cards.slice()
	send_action("play_card", arg)
	toast("打出《" + pending_event_card.name + "》到 " +
		pending_event_picks.map(p => ((view.spaces[p] || {}).name || "?")).join("、"))
	cancel_event_card()
}

/* 二选一/四选一：在侧栏显示选项按钮 */
function show_event_choice(tg) {
	const box = document.getElementById("mode_chooser")
	if (!box) return
	box.innerHTML = ""
	box.classList.remove("hide")

	const card = pending_event_card
	const opts = tg.options || []
	for (const opt of opts) {
		const b = document.createElement("button")
		b.className = "action"
		b.textContent = opt.label || ("选项 " + (opt.index + 1))
		b.onclick = () => {
			pending_event_choice = opt.index
			box.classList.add("hide")
			/* 选完 choice 后，可能还要选地区 -> 再查一次 */
			send_query("event_targets", { card: card.id, choice: opt.index })
			/* 这次查询的 result 会带 need='space' 或 need=null */
		}
		box.appendChild(b)
	}

	const cancel = document.createElement("button")
	cancel.className = "action"
	cancel.textContent = "取消"
	cancel.onclick = () => { box.classList.add("hide"); cancel_event_card() }
	box.appendChild(cancel)
}

/* 取消选目标 */
function cancel_event_card() {
	pending_event_card = null
	pending_event_targets = null
	pending_event_choice = null
	pending_event_picks = null
	pending_echo_discard = null
	pending_echo_cards = null
	clear_target_highlight()
	/* 隐藏 Done 按钮（参考 pog） */
	const btn = document.getElementById("btn_event_done")
	if (btn) btn.classList.add("hide")
}

function on_click_hand_card(c, d) {
	/*
	 * 有待决事项时手牌不可点：此时只能回答挂起的那一个问题
	 * （服务端也会拦下其它动作，这里提前挡掉，免得"点了没反应"）。
	 */
	if (view.pending_battle || view.pending_trigger || view.pending_econ) {
		toast("请先回答当前的待决事项（战斗代受 / 响应卡 / 经济战选择）")
		return
	}

	/* 状态卡弃牌代价选择：点手牌 = 选/取消一张弃牌 */
	if (status_discard_sel) {
		on_status_discard_pick(c.id)
		return
	}
	/* ① 资源再分配：选 / 取消 一张弃牌代价 */
	if (pending_resource) {
		const i = pending_resource.drop.indexOf(c.id)
		if (i >= 0)
			pending_resource.drop.splice(i, 1)
		else if (pending_resource.drop.length < 3)
			pending_resource.drop.push(c.id)
		else
			toast("代价只需 3 张，请先取消一张")
		update_resource_box()
		update_hand_panel()
		return
	}

	/*
	 * ①'. ECHO/EVENT 卡选弃牌代价（2026-09-25 新增）
	 *
	 * 流程与"资源再分配选 3 张"同构，但张数由卡牌配置（limit）。
	 * 不允许选自己（本卡）—— 本卡打出后会进弃牌堆，不算代价。
	 */
	if (pending_echo_discard) {
		if (c.id === pending_echo_discard.card.id) {
			toast("本卡不能作为自己的代价")
			return
		}
		const i = pending_echo_discard.drop.indexOf(c.id)
		if (i >= 0)
			pending_echo_discard.drop.splice(i, 1)
		else if (pending_echo_discard.drop.length < pending_echo_discard.limit)
			pending_echo_discard.drop.push(c.id)
		else
			toast("代价只需 " + pending_echo_discard.limit + " 张，请先取消一张")
		update_echo_discard_box()
		update_hand_panel()
		return
	}

	/* ② 空军调度：选 1 张手牌作为弃牌代价 */
	if (air_move) {
		air_move.card = (air_move.card === c.id) ? null : c.id
		update_air_box()
		update_hand_panel()
		return
	}

	/* ③ 资源阶段但还没打开面板 -> 提示先点按钮 */
	if (view.turn_phase === "resource") {
		toast("资源再分配：请先点【资源再分配…】按钮")
		return
	}

	/*
	 * ④ 出牌阶段②：弃牌模式（点了【弃 1 张手牌】按钮）——
	 * 这是"弃牌"动作，不是"打牌"，所以先于阶段限制判定。
	 */
	if (discard_mode && view.turn_phase === "play") {
		send_action("discard_one", { card: c.id })
		toast("弃置《" + c.name + "》")
		discard_mode = false
		return
	}

	/*
	 * ⑤ 弃牌阶段：点手牌 = 【框住选中】（可多选），
	 * 再用侧栏的【确认弃牌】按钮一次性提交。
	 */
	if (view.turn_phase === "discard") {
		const i = discard_pick.indexOf(c.id)
		if (i >= 0)
			discard_pick.splice(i, 1)
		else
			discard_pick.push(c.id)
		update_hand_panel()
		update_phase_buttons()
		toast(discard_pick.length
			? "已选中 " + discard_pick.length + " 张，点【确认弃牌】提交"
			: "已取消选择")
		return
	}

	/*
	 * ⑥ 阶段限制统一判定（与 rules.js 的 check_phase_for_card 一致）。
	 *
	 * 【2026-09-25 修正】旧注释写"增强卡不受阶段限制，永远放行"是过时的。
	 * 增强卡现在按【时点】打出（CARD_TRIGGERS），时机不对会被拒。
	 * check_phase_for_card 内部已镜像服务端的 trigger_ready()。
	 */
	const chk = check_phase_for_card(c)
	if (!chk.ok) {
		toast("无法打出《" + c.name + "》：" + chk.reason)
		return
	}

	/* ⑦ 基本卡：进入选目标流程 */
	if (c.type === "BASIC") {
		start_basic_card(c)
		return
	}

	/*
	 * ⑦' ECON 经济战卡（2026-09-26）
	 *
	 * · 15313 轰炸机军团：需要【打出方】先选目标国（德国/意大利）。
	 *   损耗张数 = 2 + 2×英国空军数，服务端算，客户端不重复推算
	 *   （view.pieces 是按代表国过滤的、键也不是 id，见 docs/pitfalls.md）。
	 * · 15314 马耳他潜艇群：无需参数，直接打出，服务端建立链式挂起，
	 *   由受击方（德国、意大利）依次在自己的界面答复。
	 */
	if (c.type === "ECON") {
		const faceId = String(c.card_id != null ? c.card_id : c.id)
		if (faceId === "15313" || String(c.id).indexOf("15313#") === 0) {
			render_ask_box(
				"《" + c.name + "》选择目标国",
				"让哪个国家损耗牌？损耗 = 该国抽牌堆顶的牌直接进入弃牌堆。" +
					"（张数 = 2 + 2×英国在版图上的空军数，由服务端计算）",
				["德国", "意大利"].map(n => ({
					label: n,
					cls: "primary",
					onClick: () => {
						render_ask_box(null)
						ask_state = null
						send_action("play_card", { card: c.id, target: n })
						toast("《" + c.name + "》—— 目标：" + n)
					},
				})))
			return
		}
		/* 其它经济战卡（15314 等）：直接打出 */
		send_action("play_card", { card: c.id })
		toast("打出《" + c.name + "》")
		return
	}

	/*
	 * ⑧ EVENT / ECHO 卡：先查可选目标，等 on_reply 回调后高亮地区。
	 *
	 * 【2026-09-25 修正】之前简化成"直接 send_action 不查目标"，
	 * 但服务端返回 pending 状态后，客户端拿不到 candidates —— 也就是
	 * 既不显示选区高亮，也不弹任何 UI，看起来就是"点了没反应"。
	 *
	 * ECHO 卡与 EVENT 卡走同一个流程：
	 *   1) send_query('event_targets', {card}) 让服务端跑 resolve_event_card
	 *      （只查询，不真正执行），返回 candidates + need
	 *   2) on_reply('event_targets') 设 pending_event_targets
	 *   3) update_event_targets() 高亮可选地区
	 *   4) 玩家点地区 -> send_action("play_card", {card, space})
	 *
	 * 服务端 query('event_targets') 已用 card_effect_of（不区分 EVENT/ECHO），
	 * 因此 ECHO 卡走这条路天然可用。
	 */
	query_event_targets(c.id)
	console.log("[ECHO] clicked", c.id, c.name, "phase=", view.turn_phase,
		"trig=", view.card_triggers && view.card_triggers[String(c.card_id || c.id)])
	toast("《" + c.name + "》：选择目标地区")
	}

/* 悬停放大（PoG 的 on_focus_card_tip 同构） */
function on_focus_card(c) {
	const tip = document.getElementById("tooltip")
	if (!tip)
		return
	tip.innerHTML = ""
	tip.className = ""
	const big = build_card_elt(c)
	big.style.pointerEvents = "none"
	tip.appendChild(big)
	tip.hidden = false
}

function on_blur_card() {
	const tip = document.getElementById("tooltip")
	if (tip)
		tip.hidden = true
}

function update_hand_panel() {
	const n = view.my_nation

	/*
	 * 阶段标志统一在函数【开头】声明。
	 * 踩过的坑：这几个 const 原本散落在下面，而上面的状态文字分支
	 * 先用到了 isDiscardPhase，触发 TDZ 报错
	 * "Cannot access 'isDiscardPhase' before initialization"。
	 */
	const isResource = view.turn_phase === "resource"
	const isPlay = view.turn_phase === "play"
	const isAir = view.turn_phase === "airforce"
	const isDiscardPhase = view.turn_phase === "discard"

	set_text("hand_nation", n ? n + " 的手牌" : "（非本方回合，手牌不可见）")
	set_text("hand_ap", n
		? (view.turn_phase === "play"
			? (view.my_play_done ? "出牌阶段：已行动" : "出牌阶段：打出 / 弃置 / 减 1 分")
			: (view.turn_phase === "airforce"
				? (view.my_air_done
					? "空军阶段：已行动"
					: "空军阶段：打出《空军力量》 / 弃 1 张牌调度（二选一）")
				: (view.turn_phase === "resource"
					? (view.my_swap_count
						? "资源再分配：本回合已用完"
						: (pending_resource
							? "资源再分配：已选 " + pending_resource.drop.length + "/3 张代价"
							: "资源再分配：可弃 3 张换 1 张基本卡（每回合一次）"))
					: (isDiscardPhase
						? ("弃牌阶段：点手牌框住选择，再点【确认弃牌】" +
							"（已选 " + discard_pick.length + " 张，本阶段已弃 " +
							view.my_discard_count + " 张）")
						: (discard_mode ? "弃牌模式" : "")))))
		: "")

	/* 牌堆/弃牌统计（侧栏，全场可见） */
	const cntEl = document.getElementById("hand_counts")
	if (cntEl) {
		const d = view.deck_counts || {}
		const c = view.discard_counts || {}
		cntEl.textContent = n
			? "牌堆 " + (d[n] || 0) + " · 弃牌 " + (c[n] || 0)
			: ""
	}

	const box = document.getElementById("hand_cards")
	const note = document.getElementById("hand_limit_note")
	if (!box)
		return
	box.innerHTML = ""

	/* 非本方回合：只显示对手手牌张数（牌背） */
	if (!n) {
		const hands = view.hands || {}
		let any = false
		for (const k of Object.keys(hands)) {
			if (!hands[k].count)
				continue
			any = true
			const d = document.createElement("div")
			d.className = "hand_back"
			d.textContent = k + " ×" + hands[k].count
			box.appendChild(d)
		}
		if (!any)
			box.innerHTML = '<div class="hand_empty">（对手无手牌）</div>'
		if (note)
			note.textContent = ""
		return
	}

	const cards = (view.hands[n] && view.hands[n].cards) || []
	const handLen = (view.hands[n] && view.hands[n].count) || 0
	/*
	 * 本阶段配额是否已用完 —— 【按阶段】判断，不能跨阶段误伤。
	 * （曾经写成 playDone || (airforce && my_air_done)，导致出牌阶段
	 *   用掉配额后，空军阶段打《空军力量》也被置灰。）
	 */
	const quotaUsed =
		(isPlay && view.my_play_done) || (isAir && view.my_air_done)

	/* 手牌上限提示 */
	if (note) {
		if (handLen > HAND_LIMIT) {
			note.textContent = "（" + handLen + "/" + HAND_LIMIT +
				" 超出 " + (handLen - HAND_LIMIT) + " 张，弃牌阶段将弃到 " + HAND_LIMIT + "）"
			note.className = "over"
		} else {
			note.textContent = "（" + handLen + "/" + HAND_LIMIT + "）"
			note.className = ""
		}
	}

	/*
	 * 这里【只负责外观】，点击行为一律由 on_click_hand_card() 在点击时
	 * 现算（原因见 build_card_elt 的注释：渲染时机与异步 query 会错开）。
	 */
	for (const c of cards) {
		const d = build_card_elt(c)

		/*
		 * 选中的牌高亮（共用 .sel 边框）：
		 *   · 资源再分配的代价
		 *   · 空军调度的弃牌代价
		 *   · 弃牌阶段被框住的牌
		 */
		const isCostSelected =
			(pending_resource && pending_resource.drop.indexOf(c.id) >= 0) ||
			(air_move && air_move.card === c.id) ||
			(isDiscardPhase && discard_pick.indexOf(c.id) >= 0) ||
			(pending_echo_discard && pending_echo_discard.drop.indexOf(c.id) >= 0) ||
			(status_discard_sel && status_discard_sel.picked.indexOf(c.id) >= 0)
		d.classList.toggle("sel", !!isCostSelected)

		/*
		 * 置灰条件：直接用与点击判定同一套逻辑（check_phase_for_card），
		 * 保证"看起来能点"和"点了能成功"永远一致。
		 *   · 弃牌阶段：任何手牌都能弃 -> 不置灰
		 *   · 其他阶段：不可打出的牌置灰
		 *
		 * 【2026-09-25 修正】旧逻辑加了 `!is_enhance_card(c) &&` 前缀，
		 * 意思是"增强卡永远不灰"——这是过时语义（增强卡现在按时点打出）。
		 * 去掉这个前缀后，增强卡在错阶段也会置灰（与 check_phase_for_card 一致）。
		 */
		if (view.turn_phase !== "discard" &&
			!check_phase_for_card(c).ok)
			d.classList.add("disabled")

		if (isDiscardPhase) {
			/* 弃牌阶段：被框住的牌标序号，方便核对 */
			if (isCostSelected) {
				const b = document.createElement("span")
				b.className = "badge"
				b.textContent = "弃 " + (discard_pick.indexOf(c.id) + 1)
				d.appendChild(b)
			}
		} else if (discard_mode) {
			const b = document.createElement("span")
			b.className = "badge"
			b.textContent = "弃"
			d.appendChild(b)
		} else if (status_discard_sel && status_discard_sel.picked.indexOf(c.id) >= 0) {
			const b = document.createElement("span")
			b.className = "badge"
			b.textContent = "弃置 " + (status_discard_sel.picked.indexOf(c.id) + 1)
			d.appendChild(b)
		} else if (c.type === "BASIC" && !isResource && !quotaUsed &&
			!pending_resource && !air_move) {
			/*
			 * 可打出的基本卡标"选目标"。
			 * 空军阶段只有《空军力量》能打，其余基本卡（建设/战斗）
			 * 标"需出牌阶段"，避免玩家误以为此刻可用。
			 */
			const b = document.createElement("span")
			b.className = "badge"
			if (isAir && c.name !== "空军力量")
				b.textContent = "需出牌阶段"
			else if (!isAir && is_airforce_only(c))
				b.textContent = "需空军阶段"
			else
				b.textContent = "选目标"
			d.appendChild(b)
		} else if (isAir && is_timing_card(c)) {
			/* 时机卡在空军阶段仍可打出，给个提示 */
			const b = document.createElement("span")
			b.className = "badge"
			b.textContent = "时机"
			d.appendChild(b)
		}

		/* 正在等待选目标的卡加高亮描边 */
		if (pending_card && pending_card.id === c.id)
			d.classList.add("pending_card")

		box.appendChild(d)
	}

	if (!cards.length)
		box.innerHTML = '<div class="hand_empty">（无手牌）</div>'
}

/* ============================================================
 * 资源再分配（easy_rule 二.1）
 *
 * 弃 3 张手牌 -> 从牌堆挑 1 张基本卡置入手牌 -> 洗混牌堆。
 * 交互：点【资源再分配】按钮 -> 查牌堆基本卡 -> 先选要的基本卡，
 *       再点手牌选 3 张代价 -> 点【确认】提交。
 * ============================================================ */

let pending_resource = null    /* { basics:[...], take: id|null, drop: [ids] } */

/* ============================================================
 * 空军阶段②：弃 1 张手牌，调度 1 支空军
 *
 * 流程：点【调度空军…】-> 查 air_options 拿到本国空军与合法目标
 *       -> 选 1 张要弃的手牌（面板里点）-> 选空军 -> 选目标地区
 *       -> send_action('air_support', {air, target, card})
 * ============================================================ */

let air_move = null   /* { airs:[], targets:[], air:null, card:null } */

function start_air_move() {
	if (air_move) {
		cancel_air_move()
		return
	}
	air_move = { airs: [], targets: [], air: null, card: null }
	send_query("air_options", null)
}

function cancel_air_move() {
	air_move = null
	update_air_box()
	update_hand_panel()
}

/*
 * 空军调度提示：用 #ask_box（不再与资源弹框抢容器）。
 * 调度仍走地图：先点 1 支空军算子，再点目标地区。
 */
function update_air_box() {
	if (!air_move) {
		if (ask_state && ask_state.kind === "airmove") {
			ask_state = null
			render_ask_box(null)
		}
		return
	}
	ask_state = { kind: "airmove" }
	render_ask_box(
		"调度空军（弃 1 张手牌）",
		"① 点下方手牌选代价：" + (air_move.card ? "已选" : "未选") +
		"　② 点地图上的本国空军：" + (air_move.air || "未选") +
		"　③ 点目标地区：" + (air_move.target
			? ((view.spaces[air_move.target] || {}).name || "?") : "未选") +
		"　（可选空军 " + air_move.airs.length + " 支）",
		[{ label: "取消调度", onClick: cancel_air_move }]
	)
}

function start_resource_swap() {
	/* 已经打开就重查一次（牌堆可能变了，可选基本卡要刷新） */
	if (pending_resource) {
		pending_resource.drop = []
		pending_resource.take = null
	}
	/*
	 * 打开弹框（先显示"加载中"），再查牌堆里实际可挑的基本卡。
	 * query 的回复由 on_reply('deck_basics') 填进 pending_resource.basics。
	 */
	pending_resource = pending_resource || { basics: [], take: null, drop: [] }
	update_resource_box()
	send_query("deck_basics", null)
}

function cancel_resource_swap() {
	if (!pending_resource)
		return
	pending_resource = null
	update_resource_box()
	update_hand_panel()
}

function submit_resource_swap() {
	if (!pending_resource)
		return
	if (!pending_resource.take) { toast("请先选 1 张要的基本卡"); return }
	if (pending_resource.drop.length !== 3) {
		toast("还需要选 " + (3 - pending_resource.drop.length) + " 张手牌作为代价")
		return
	}
	send_action("resource_swap", {
		take: pending_resource.take,
		discard: pending_resource.drop.slice(),
	})
	/*
	 * 每回合只能一次：提交后收起弹框。
	 * 服务端换取后会自动洗混牌堆，下次打开弹框时 deck_basics
	 * 返回的就是洗牌后的新结果。
	 */
	pending_resource = null
	update_resource_box()
	update_hand_panel()
	toast("已换取 1 张基本卡，牌堆已洗混（本回合资源再分配已用完）")
}

/*
 * 渲染资源再分配弹框：两块卡牌网格
 *   ① 牌堆中实际可选的基本卡（来自 query('deck_basics')）
 *   ② 手牌中选 3 张作为代价
 */
function update_resource_box() {
	const modal = document.getElementById("resource_modal")
	if (!modal)
		return

	if (!pending_resource) {
		modal.classList.add("hide")
		return
	}
	modal.classList.remove("hide")

	/* ---- ① 牌堆中的基本卡 ---- */
	const basicsBox = document.getElementById("res_basics")
	basicsBox.innerHTML = ""
	if (!pending_resource.basics.length) {
		const p = document.createElement("div")
		p.className = "empty-note"
		p.textContent = "牌堆中没有基本卡可挑（或尚未加载完成…）"
		basicsBox.appendChild(p)
	}
	for (const c of pending_resource.basics) {
		const d = card_elt(c, () => {
			pending_resource.take = (pending_resource.take === c.id) ? null : c.id
			update_resource_box()
		})
		d.classList.toggle("sel", pending_resource.take === c.id)
		basicsBox.appendChild(d)
	}

	/* ---- ② 手牌代价（选 3 张） ---- */
	const costBox = document.getElementById("res_cost")
	costBox.innerHTML = ""
	const hand = (view.hands[view.my_nation] && view.hands[view.my_nation].cards) || []
	for (const c of hand) {
		const picked = pending_resource.drop.indexOf(c.id) >= 0
		const d = card_elt(c, () => {
			const i = pending_resource.drop.indexOf(c.id)
			if (i >= 0)
				pending_resource.drop.splice(i, 1)
			else if (pending_resource.drop.length < 3)
				pending_resource.drop.push(c.id)
			else
				toast("代价只需 3 张，请先取消一张")
			update_resource_box()
		})
		if (picked) {
			d.classList.add("sel")
			const b = document.createElement("span")
			b.className = "badge"
			b.textContent = "代价 " + (pending_resource.drop.indexOf(c.id) + 1)
			d.appendChild(b)
		}
		costBox.appendChild(d)
	}
	if (!hand.length) {
		const p = document.createElement("div")
		p.className = "empty-note"
		p.textContent = "手牌为空，无法支付代价"
		costBox.appendChild(p)
	}

	/* ---- 提示与按钮状态 ---- */
	const note = document.getElementById("res_pick_note")
	if (note)
		note.textContent = "（牌堆中 " + pending_resource.basics.length + " 张可选）"
	const costNote = document.getElementById("res_cost_note")
	if (costNote)
		costNote.textContent = pending_resource.drop.length + "/3"
	const ok = document.getElementById("res_confirm")
	if (ok)
		ok.disabled = !(pending_resource.take && pending_resource.drop.length === 3)
}

/* ============================================================
 * 【双十字系统】观看对手手牌并重排到其牌堆顶（2026-09-25 补 UI）
 *
 * 交互格式与"资源再分配"一致：modal + card-grid + 序号 badge + 确认按钮。
 *
 * 流程：
 *   ① 玩家在自己【摸牌阶段】打出《双十字系统》
 *   ② 服务端随机挑 2 张德国手牌，写入 game.peek，view.peek 非空
 *   ③ 客户端弹出本弹框，展示这 2 张牌
 *   ④ 玩家【依次点击】决定顺序 -> 先点的在最上面（牌堆顶）
 *   ⑤ 点【确认顺序】-> 提交 play_card { card, order }
 *   ⑥ 服务端按 order 压到德国牌堆顶，清除 game.peek，弹框自动关闭
 *
 * 卡在 pending 期间【不弃牌不结算】，所以取消是安全的（卡还在手里）。
 * ============================================================ */

/* 玩家点击累积的顺序（存卡 id，先点的在前） */
let peek_order = []
/*
 * 【2026-09-25 新增】本地 peek 状态（query 路径用，不依赖 view.peek）。
 *   pending_peek_for_card —— 当前 pending 的卡对象，submit_peek 用它的 id
 *   peek_cards            —— query 返回的对手手牌 id 数组
 *   peek_target           —— 对手国家名（如"德国"）
 */
let pending_peek_for_card = null
let peek_cards = null
let peek_target = null

/* ============================================================
 * ECHO/EVENT 卡的"选 N 张弃牌代价"弹框（2026-09-25）
 *
 * 流程：
 *   ① 玩家点击 ECHO 卡 -> query('event_targets') 返回带 cost.discard
 *   ② on_reply 检测到 cost.discard > 0 -> 弹本框
 *   ③ 玩家点手牌切换选中（on_click_hand_card ①'. 分支）
 *   ④ 选满 N 张 -> 点【确认弃牌】-> 关本框，进入 highlight_event_targets
 *   ⑤ 玩家点地区 -> send_action("play_card", {card, space, cards})
 * ============================================================ */

/* 渲染/隐藏弹框。由 update_map() 统一调用（与 update_resource_box 一样） */
function update_echo_discard_box() {
	const modal = document.getElementById("echo_discard_modal")
	if (!modal)
		return

	if (!pending_echo_discard) {
		modal.classList.add("hide")
		return
	}
	modal.classList.remove("hide")

	/* 标题 */
	const title = document.getElementById("echo_discard_title")
	if (title)
		title.textContent = "《" + pending_echo_discard.card.name +
			"》：选 " + pending_echo_discard.limit + " 张手牌作为代价"

	/* 手牌区 */
	const grid = document.getElementById("echo_discard_grid")
	if (!grid)
		return
	grid.innerHTML = ""
	const hand = (view.hands[view.my_nation] && view.hands[view.my_nation].cards) || []
	for (const c of hand) {
		/* 本卡不可选（不能弃自己当代价） */
		const isSelf = (c.id === pending_echo_discard.card.id)
		const picked = pending_echo_discard.drop.indexOf(c.id) >= 0
		const d = card_elt(c, () => {
			if (isSelf) {
				toast("本卡不能作为自己的代价")
				return
			}
			const i = pending_echo_discard.drop.indexOf(c.id)
			if (i >= 0)
				pending_echo_discard.drop.splice(i, 1)
			else if (pending_echo_discard.drop.length < pending_echo_discard.limit)
				pending_echo_discard.drop.push(c.id)
			else
				toast("代价只需 " + pending_echo_discard.limit + " 张，请先取消一张")
			update_echo_discard_box()
			update_hand_panel()
		})
		if (isSelf) {
			d.classList.add("disabled")
		} else if (picked) {
			d.classList.add("sel")
			const b = document.createElement("span")
			b.className = "badge"
			b.textContent = "代价 " + (pending_echo_discard.drop.indexOf(c.id) + 1)
			d.appendChild(b)
		}
		grid.appendChild(d)
	}
	if (!hand.length) {
		const p = document.createElement("div")
		p.className = "empty-note"
		p.textContent = "手牌为空，无法支付代价"
		grid.appendChild(p)
	}

	/* 计数与按钮状态 */
	const note = document.getElementById("echo_discard_note")
	if (note)
		note.textContent = pending_echo_discard.drop.length + "/" + pending_echo_discard.limit
	const ok = document.getElementById("echo_discard_confirm")
	if (ok)
		ok.disabled = (pending_echo_discard.drop.length !== pending_echo_discard.limit)
}

/* 取消：清空所有 pending 状态（包括卡片本身） */
function cancel_echo_discard() {
	cancel_event_card()
	update_echo_discard_box()
	update_hand_panel()
}

/*
 * 确认弃牌：本弹框关闭，进入高亮地区流程。
 * 所选弃牌 ids 暂存到 pending_echo_cards，供最终 send_action 用。
 */
function confirm_echo_discard() {
	if (!pending_echo_discard)
		return
	if (pending_echo_discard.drop.length !== pending_echo_discard.limit) {
		toast("还需选 " + (pending_echo_discard.limit - pending_echo_discard.drop.length) + " 张")
		return
	}
	/* 暂存弃牌 */
	pending_echo_cards = pending_echo_discard.drop.slice()
	/* 进入高亮地区流程 */
	pending_event_targets = pending_echo_discard.need_targets
	/* 卡对象回到 pending_event_card（on_reply 流程已设过，但保险起见） */
	if (!pending_event_card)
		pending_event_card = pending_echo_discard.card
	highlight_event_targets(pending_echo_discard.need_targets)
	/* 清空本弹框状态 */
	pending_echo_discard = null
	update_echo_discard_box()
	update_hand_panel()
	toast("已选弃牌，请点击地图上的目标地区")
}

/* 渲染/隐藏弹框。由 update_map() 统一调用（与 update_resource_box 一样） */
function update_peek_box() {
	const modal = document.getElementById("peek_modal")
	if (!modal)
		return

	/*
	 * 【2026-09-25 bug 修复】支持两种来源的 peek 数据：
	 *   (A) view.peek  —— 旧路径（直接打 15305 不走 query），
	 *       由服务端 resolve_event_card 内部 set game.peek，
	 *       view 反映状态后弹框。
	 *   (B) pending_peek_for_card —— 新路径（走 query('event_targets')），
	 *       query 是只读 RPC 不能写 state，所以 view.peek 不会更新。
	 *       客户端自己用 peek_cards + peek_target 渲染。
	 *
	 * 当前 (A) 路径已废弃（query 路径会先于 send_action 调用，
	 * game.peek 由 query 触发写入但 view 不广播）；
	 * 只保留 (B) 路径。
	 */
	let pk = null
	if (pending_peek_for_card && peek_cards && peek_cards.length) {
		/* (B) 本地路径：peek_cards 已是卡对象数组（服务端 query 出口转好的） */
		pk = {
			cards: peek_cards,
			nation: peek_target || "?",
		}
	} else if (view.peek && view.peek.cards && view.peek.cards.length) {
		/* (A) 旧路径：保留兼容（万一有其他卡触发 view.peek） */
		pk = view.peek
	} else {
		modal.classList.add("hide")
		return
	}

	modal.classList.remove("hide")

	/* 对手换了 / 换了一批牌 -> 本地顺序要重置 */
	if (peek_order.length > pk.cards.length)
		peek_order = []

	const ids = pk.cards.map(c => c.id)
	peek_order = peek_order.filter(id => ids.indexOf(id) >= 0)

	/* ---- ① 被观看的手牌 ---- */
	const box = document.getElementById("peek_cards")
	box.innerHTML = ""
	for (const c of pk.cards) {
		const idx = peek_order.indexOf(c.id)
		const d = card_elt(c, () => toggle_peek_order(c.id))
		if (idx >= 0) {
			d.classList.add("sel")
			const b = document.createElement("span")
			b.className = "badge"
			/* 先点的 -> 牌堆顶，显示为"顶1" */
			b.textContent = "顶" + (idx + 1)
			d.appendChild(b)
		}
		box.appendChild(d)
	}

	/* ---- ② 提示与按钮状态 ---- */
	const targetNote = document.getElementById("peek_target_note")
	if (targetNote)
		targetNote.textContent = "（" + pk.nation + " 的 " + pk.cards.length + " 张手牌）"

	const orderNote = document.getElementById("peek_order_note")
	if (orderNote)
		orderNote.textContent = peek_order.length + "/" + pk.cards.length

	const desc = document.getElementById("peek_order_desc")
	if (desc) {
		if (!peek_order.length) {
			desc.textContent = "依次点击卡牌决定顺序：先点的排在最上面（牌堆顶）。"
		} else {
			const names = peek_order.map(id => {
				const c = pk.cards.find(x => x.id === id)
				return c ? c.name : id
			})
			desc.textContent = "牌堆顶顺序（上→下）：" + names.join(" → ")
		}
	}

	const okBtn = document.getElementById("peek_confirm")
	if (okBtn)
		okBtn.disabled = (peek_order.length !== pk.cards.length)
}

/* 点一张牌：已排则取消，未排则追加到末尾 */
function toggle_peek_order(id) {
	const i = peek_order.indexOf(id)
	if (i >= 0)
		peek_order.splice(i, 1)
	else
		peek_order.push(id)
	update_peek_box()
}

/* 重排：清空已选顺序 */
function reset_peek_order() {
	peek_order = []
	update_peek_box()
}

/* 提交：把 order 交给服务端 */
function submit_peek() {
	/*
	 * 兼容两种路径：本地 peek_cards 模式 + view.peek 旧模式。
	 * cards.length 都用于校验 peek_order 是否排满。
	 */
	const localMode = !!(pending_peek_for_card && peek_cards && peek_cards.length)
	let cardCount = 0
	let nation = "?"
	let cardId = null
	if (localMode) {
		cardCount = peek_cards.length
		nation = peek_target || "?"
		cardId = pending_peek_for_card.id
	} else if (view.peek) {
		cardCount = (view.peek.cards || []).length
		nation = view.peek.nation
		cardId = view.peek.card
	} else {
		toast("当前没有等待排序的手牌")
		return
	}
	if (peek_order.length !== cardCount) {
		toast("还需要排 " + (cardCount - peek_order.length) + " 张")
		return
	}
	send_action("play_card", {
		card: cardId,
		order: peek_order.slice(),
		/*
		 * 【2026-09-25 bug 修复】把 query 阶段挑出的 cards 一起提交，
		 * 服务端据此校验 order 一致性（避免服务端重新挑导致不一致）。
		 * peek_cards 是卡对象数组，提取 id 字段。
		 */
		peek_cards: localMode
			? peek_cards.map(c => c.id)
			: (view.peek ? (view.peek.cards || []).map(c => c.id) : []),
	})
	peek_order = []
	peek_cards = null
	peek_target = null
	pending_peek_for_card = null
	pending_event_card = null
	toast("已按指定顺序置于 " + nation + " 牌堆顶")
}

/* 取消：本地模式直接清状态；旧模式通知服务端 clear_peek */
function cancel_peek() {
	if (pending_peek_for_card || peek_cards) {
		/* 本地模式：清状态即可，没向服务端写过任何东西 */
		peek_order = []
		peek_cards = null
		peek_target = null
		pending_peek_for_card = null
		pending_event_card = null
		return
	}
	if (!view.peek)
		return
	send_action("clear_peek", {})
	peek_order = []
}

/*
 * 弹框里用的卡牌元素（复用 build_card_elt 的卡图渲染，
 * 但点击行为由调用方通过 onClick 直接给定 —— 弹框是模态的，
 * 不存在"渲染与状态错开"的问题）。
 */
function card_elt(c, onClick) {
	const d = document.createElement("div")
	d.className = "card " + (c.type ? "t-" + c.type : "")
	d.title = c.name + (c.text ? "\n" + c.text : "")

	const url = card_image_url(c)
	if (url) {
		const img = document.createElement("img")
		img.src = url
		img.alt = c.name
		d.appendChild(img)
	} else {
		const n = document.createElement("div")
		n.className = "card-name"
		n.textContent = c.name
		d.appendChild(n)
	}

	d.addEventListener("click", ev => {
		ev.stopPropagation()
		onClick()
	})
	d.addEventListener("mouseenter", () => on_focus_card(c))
	d.addEventListener("mouseleave", on_blur_card)
	return d
}

/* ============================================================
 * 通用询问面板 #ask_box
 *
 * 用于：友方回合开始是否收回部队（默认跳过）、
 *       防守方是否用空军代受 / 发起方是否抵消。
 * ============================================================ */

let ask_state = null   /* { kind, ctx } */

function render_ask_box(title, text, options) {
	const box = document.getElementById("ask_box")
	if (!box)
		return
	box.innerHTML = ""
	if (!options || !options.length) {
		box.classList.add("hide")
		return
	}
	box.classList.remove("hide")

	const h = document.createElement("div")
	h.className = "ask_head"
	h.textContent = title
	box.appendChild(h)

	if (text) {
		const t = document.createElement("div")
		t.className = "ask_text"
		t.textContent = text
		box.appendChild(t)
	}

	for (const o of options) {
		const b = document.createElement("button")
		b.className = "action" + (o.cls ? " " + o.cls : "")
		b.textContent = o.label
		b.onclick = o.onClick
		box.appendChild(b)
	}
}

/* view.pending_ask：友方出牌回合开始，询问是否收回该国部队 */
function update_ask_box_from_view() {
	const ask = view && view.pending_ask
	if (!ask || !ask.pieces || !ask.pieces.length) {
		if (ask_state && ask_state.kind === "remove")
			ask_state = null
		return
	}
	ask_state = { kind: "remove" }
	render_ask_box(
		"【" + ask.nation + "】是否收回部队？",
		"点击要收回的部队（本国回合内任意时刻也可点算子旁边的按钮收回）",
		ask.pieces.map(p => ({
			label: (TYPE_LABEL[p.type] || p.type) + " @ " + p.loc_name,
			onClick: () => send_action("remove_piece", { piece: p.id }),
		})).concat([{ label: "跳过", cls: "primary", onClick: () => send_action("clear_ask", {}) }])
	)
}

/* 开关：友方出牌回合开始时是否询问（默认关闭 = 跳过） */
function toggle_ask_remove() {
	send_action("toggle_ask_remove", { value: !view.ask_remove })
	toast(view.ask_remove ? "已关闭询问（默认跳过）" : "已开启询问")
}

/* ============================================================
 * 基本卡的"选目标"流程
 *
 * 点卡 -> 查询合法目标（basic_targets）-> 高亮地图地区 ->
 * 点地区 -> send_action('play_card', {card, space, piece, mode})
 * Esc / 右键 / 再点同卡 -> 取消
 * ============================================================ */

let pending_card = null      /* 正在等待选目标的卡 */
let pending_mode = null      /* 《空军力量》的 mode */
let pending_targets = null   /* { spaces: [...], pieces: [...] } */

function start_basic_card(c) {
	/* 再点同一张 -> 取消 */
	if (pending_card && pending_card.id === c.id) { cancel_basic_card(); return }

	/*
	 * 《空军力量》有三选一，先让玩家选模式。
	 * 这里用简单的方式：依次询问。为了不做复杂弹窗，
	 * 用 confirm 风格的自定义选择（用 toast + 三次点击循环太绕），
	 * 改为在卡牌上循环：第一次点击弹出模式选择按钮。
	 */
	if (c.name === "空军力量") {
		pending_card = c
		show_mode_chooser(c)
		return
	}

	pending_card = c
	pending_mode = null
	/*
	 * 注意：client.js 的签名是 send_query(q, param)，
	 * 结果通过全局 on_reply(q, result) 回调返回 —— 不是 (q, cb)。
	 */
	send_query("basic_targets", c.name)
	/* 进入选地块/选目标后刷新桌面状态卡（15341/15342 在打建设卡时可放弃建设） */
	update_table_status()
}

/* 《空军力量》的模式选择：在侧栏显示三个按钮 */
function show_mode_chooser(c) {
	const box = document.getElementById("mode_chooser")
	if (!box)
		return
	box.innerHTML = ""
	box.classList.remove("hide")

	/*
	 * 空军阶段只能"部署"或"夺取制空权"（2026-09-22 玩家明确）；
	 * "调度空军"在空军阶段走侧栏的【调度空军…】按钮（代价是弃 1 张手牌），
	 * 因此这里在空军阶段不列出 move，避免两条路径重复。
	 */
	const modes = (view.turn_phase === "airforce")
		? [
			["deploy", "部署空军（须与本国补给中的陆/海军同格）"],
			["seize", "夺取制空权（移除敌方空军）"],
		]
		: [
			["deploy", "部署空军（须与本国补给中的陆/海军同格）"],
			["seize", "夺取制空权（移除敌方空军）"],
			["move", "调度空军（移到本国陆/海军处）"],
		]
	for (const [m, label] of modes) {
		const b = document.createElement("button")
		b.className = "action"
		b.textContent = label
		b.onclick = () => {
			pending_mode = m
			box.classList.add("hide")
			send_query("basic_targets", { card_name: "空军力量", mode: m })
		}
		box.appendChild(b)
	}

	const cancel = document.createElement("button")
	cancel.className = "action"
	cancel.textContent = "取消"
	cancel.onclick = () => { box.classList.add("hide"); cancel_basic_card() }
	box.appendChild(cancel)
}

/* 在地图上高亮可选地区 */
function highlight_targets(t) {
	clear_target_highlight()
	if (!t || !t.spaces)
		return
	for (const s of t.spaces) {
		const el = space_elt(s.id)
		if (el) {
			el.classList.add("target")
			el.title = s.reason || ""
		}
	}
	/* 可选敌方部队也高亮 */
	for (const p of (t.pieces || [])) {
		const el = piece_elt(p.id)
		if (el)
			el.classList.add("target")
	}
}

function clear_target_highlight() {
	const list = document.querySelectorAll(".target")
	for (let i = 0; i < list.length; i++)
		list[i].classList.remove("target")
}

function cancel_basic_card() {
	pending_card = null
	pending_mode = null
	pending_targets = null
	battle_flow = null
	clear_piece_highlight("initiator")
	clear_target_highlight()
	if (ask_state && ask_state.kind !== "remove")
		render_ask_box(null)
	const box = document.getElementById("mode_chooser")
	if (box)
		box.classList.add("hide")
	/* 退出选地块/地图选择后刷新桌面状态卡（15341/15342 提示复位） */
	update_table_status()
}

/* 地图上点击地区时（link / 放置 之外的默认模式）被调用 */
function on_space_click_for_card(space_id) {
	if (!pending_card)
		return false
	if (!pending_targets)
		return false

	const allowed = pending_targets.spaces.some(s => s.id === space_id)
	if (!allowed) {
		toast("该地区不是《" + pending_card.name + "》的合法目标")
		return true
	}

	/*
	 * 提示文案：空地（无守军）时明确提示"空打"，
	 * 避免玩家以为没生效（卡牌照常打出、该回合出牌阶段即已行动）。
	 */
	const hit = pending_targets.spaces.find(s => s.id === space_id)
	const isEmpty = !!hit && /空地/.test(hit.reason || "")

	/* 战斗卡，或《空军力量》的"夺取制空权"模式：走两步询问（选目标→选发起单位） */
	if (is_battle_card(pending_card) || pending_mode === 'seize') {
		play_battle_card(space_id, null, isEmpty)
		return true
	}

	const arg = { card: pending_card.id, space: space_id }
	if (pending_mode)
		arg.mode = pending_mode
	send_action("play_card", arg)
	toast("已打出《" + pending_card.name + "》到 " + (view.spaces[space_id] || {}).name +
		(isEmpty ? "（空打：无守军）" : ""))
	cancel_basic_card()
	return true
}

function is_battle_card(c) {
	return c && (c.name === "发起陆战" || c.name === "发起海战")
}

/*
 * ============================================================
 * 战斗卡的地图交互流程（2026-09-22 玩家明确）
 *
 *   ① 在地图上点【发起单位】（本国、补给中、与目标相邻的陆/海军）
 *      —— 空军不能发起，因此只高亮陆/海军
 *   ② 再点【目标地区】或目标地区的【敌方部队】（空军不可选）
 *   ③ 若受创目标所在地区有同国空军 -> 【由防守方决定】是否用空军代受：
 *        · 代受   -> 空军被移除，原目标部队保住
 *        · 不代受 -> 原目标被移除，该空军必须撤往相邻合法位置，
 *                    无位置则被移除
 *
 * 交互状态机（battle_pick）：
 *   { step: 'from', space, kind }      等待点发起单位
 *   { step: 'target', space, kind, from } 等待点目标地区/敌军
 * ============================================================
 */

let battle_flow = null   /* { step, space, kind, from, isEmpty, victim, airs, retreats } */

/*
 * 点战斗卡后：先把可选目标高亮出来（地区 + 敌军），
 * 同时把"可发起单位"也高亮，等待玩家先点发起单位。
 */
function play_battle_card(space_id, piece_id, isEmpty) {
	battle_flow = {
		step: "from",          /* 第一步：在地图上选发起单位 */
		space: space_id,
		from: null,
		isEmpty: isEmpty,
		/* 记下玩家已经点过的那支部队，选完发起单位后自动作为目标 */
		preVictim: piece_id || null,
		victim: null,
	}
	ask_initiator_on_map(space_id)
}

/*
 * ① 进入"在地图上选发起单位"的状态。
 * 由服务端 battle_initiators 返回候选（只有陆/海军），
 * 客户端把它们高亮，玩家点地图上的算子即选中。
 */
function ask_initiator_on_map(space_id) {
	if (pending_mode === 'seize')
		send_query("air_initiators", { space: space_id })
	else
		send_query("battle_initiators", { space: space_id })
}

function show_initiator_choices(list) {
	const nm = (view.spaces[battle_flow.space] || {}).name || "?"
	battle_flow.initiators = list

	if (!list.length) {
		/* 理论上服务端已挡掉，这里兜底 */
		render_ask_box(null)
		toast(pending_mode === 'seize'
			? "没有可发起空战的本国补给飞机（须与目标相邻且处于补给状态）"
			: "没有可发起战斗的本国陆军或海军（空军不能发起战斗）")
		cancel_basic_card()
		return
	}

	/* 高亮可发起的本国算子，提示玩家点地图 */
	highlight_targets(pending_targets)
	highlight_pieces(list.map(u => u.id), "initiator")

	const isSeize = (pending_mode === 'seize')
	ask_state = { kind: "battle_from" }
	render_ask_box(
		"选择发起单位",
		"请在地图上点击一支【处于补给状态、与目标相邻的本国" +
			(isSeize ? "空军" : "陆军/海军") + "】来发起对 " + nm + " 的攻击" +
			(isSeize ? "" : "（空军不能发起战斗）"),
		[{ label: "取消", onClick: () => (battle_flow && battle_flow.origin === 'status'
			? cancel_status_act() : cancel_basic_card()) }]
	)
}

/* 玩家在地图上点了某个算子 */
function on_pick_initiator(piece_id) {
	const isSeize = (pending_mode === 'seize')
	if (!battle_flow || !battle_flow.initiators)
		return false
	const u = battle_flow.initiators.find(x => x.id === piece_id)
	if (!u) {
		toast(pending_mode === 'seize'
			? "不能用它发起空战（须是本国、补给中、与目标相邻的飞机）"
			: "不能用它发起战斗（须是本国、补给中、与目标相邻的陆军/海军）")
		return true
	}
	battle_flow.from = piece_id

	/*
	 * 玩家可能是先点了敌方算子才进到这里（点算子时会带着 target 进来），
	 * 这时把这支部队直接当作目标，省掉再点一次。
	 */
	if (battle_flow.preVictim) {
		const pv = battle_flow.preVictim
		const cand = ((pending_targets && pending_targets.pieces) || [])
			.find(p => p.id === pv)
		battle_flow.preVictim = null
		if (cand) {
			battle_flow.victim = cand.id
			battle_flow.space = cand.space
			battle_flow.isEmpty = false
			clear_piece_highlight("initiator")
			ask_defense()
			return true
		}
	}

	battle_flow.step = "target"
	clear_piece_highlight("initiator")
	ask_state = { kind: "battle_target" }
	const seizeBox2 = isSeize
		? "现在请在地图上点击【敌方空军】来夺取制空权（或点击目标地区本身）"
		: "现在请在地图上点击【目标地区】或该地区的【敌方部队】" +
			"（空军不能作为攻击目标；若该地区没有敌军，则只能点地块本身）"
	render_ask_box(
		"已选发起单位：" + u.name + " @" + u.space_name,
		seizeBox2,
		[
			{ label: "重选发起单位", onClick: () => ask_initiator_on_map(battle_flow.space) },
			{ label: "取消", onClick: () => cancel_basic_card() },
		]
	)
	return true
}

/* ② 玩家点了目标地区或敌方算子 */
function on_pick_battle_target(space_id, piece_id) {
	const bf = battle_flow
	if (!bf || bf.step !== "target")
		return false

	const cand = ((pending_targets && pending_targets.pieces) || [])
		.filter(p => p.space === space_id)

	if (piece_id) {
		const v = cand.find(p => p.id === piece_id)
		if (!v) {
			toast(pending_mode === 'seize'
				? "该算子不是可夺取的敌方空军"
				: "该算子不能作为攻击目标（空军不可攻击）")
			return true
		}
		bf.victim = piece_id
		bf.isEmpty = false
	} else {
		/* 点了地块本身：只有该地区没有可攻击敌军时才允许 */
		if (cand.length) {
			toast(pending_mode === 'seize'
				? "该地区有敌方空军，必须点击要夺取的敌方飞机"
				: "该地区有敌军，必须点击要攻击的敌方部队（空军不可攻击）")
			return true
		}
		bf.victim = null
		bf.isEmpty = true
	}
	bf.space = space_id

	if (bf.isEmpty) {
		finish_battle_card()
		return true
	}
	ask_defense()
	return true
}

/*
 * ③ 受创目标确定后提交战斗。
 *
 * 【重要】(2026-09-22)：这里【不再】由发起方询问"是否用空军代受"。
 * 那是防守方的决定，服务端会把战斗挂起（game.pending_battle），
 * 由【防守方】的界面收到 view.pending_battle 后自行决定。
 * 这样就彻底避免了一个浏览器席位替对方做决定。
 */
function ask_defense() {
	const bf = battle_flow
	const cand = ((pending_targets && pending_targets.pieces) || [])
		.filter(p => p.space === bf.space)
	const victim = (bf.victim ? cand.find(p => p.id === bf.victim) : null) || cand[0]
	if (victim)
		bf.victim = victim.id

	/* 直接提交；若该地区有可代受的空军，服务端会挂起等防守方 */
	finish_battle_card()
}

/*
 * 防守方的询问面板（由 view.pending_battle 驱动，只有防守方拿得到）。
 * 面板上的选择通过 resolve_battle 提交。
 */
function update_pending_battle_box() {
	const pb = view.pending_battle

	if (!pb) {
		if (ask_state && (ask_state.kind === "defend" || ask_state.kind === "retreat" ||
			ask_state.kind === "counter")) {
			ask_state = null
			render_ask_box(null)
		}
		return
	}

	if (ask_state && ask_state.kind === "retreat" && ask_state.space === pb.space)
		return   /* 已在撤离选择中，不要被覆盖 */

	/*
	 * ---------- 阶段二：发起方决定是否抵消（2026-09-23）----------
	 *
	 * 同一个面板函数要服务两个阶段，因为等待方不同：
	 *   stage='defend'  -> 防守方：要不要用空军代受
	 *   stage='counter' -> 发起方：要不要用相邻空军抵消这次代受
	 *
	 * 服务端已按 stage 把 pending_battle 只发给该表态的那一方，
	 * 所以这里拿到 pb 就说明"轮到我决定了"。
	 */
	if (pb.stage === "counter") {
		ask_state = { kind: "counter", space: pb.space }
		const cands = pb.counter_airs || []
		const byId = view.pieces_by_id || {}
		const desc = cands.map(c => {
			const info = byId[c.id]
			return info ? (info.type_zh + "@" + info.space_name)
				: ("空军 " + c.id)
		}).join("、")

		render_ask_box(
			"【" + pb.attacker + "】是否用空军抵消这次代受？",
			"受攻击地区：" + ((view.spaces[pb.space] || {}).name || "?") +
				"　对方已用 1 支空军代受（原部队暂时保住）" +
				"（可抵消的空军 " + cands.length + " 支：" + (desc || "无") + "）",
			cands.map((c, i) => ({
				label: "用第 " + (i + 1) + " 支空军抵消" +
					"（双方各损失 1 支空军，原目标照常被移除）",
				onClick: () => send_action("resolve_battle", { counter_air: c.id }),
			})).concat([{
				label: "不抵消（代受成立，原部队保住）",
				cls: "primary",
				onClick: () => send_action("resolve_battle", { declined: true }),
			}])
		)
		return
	}

	ask_state = { kind: "defend", space: pb.space }

	/*
	 * 【不要】用 view.pieces 过滤 pb.airs（2026-09-22 踩坑）。
	 *
	 * pb.airs 是服务端算好的、可代受的空军实例 id 列表，
	 * 直接可用。曾经写成：
	 *     pb.airs.filter(p => view.pieces && view.pieces[p] != null)
	 * 结果面板上一个按钮都没有（防守方"无法选择代受"）。
	 * 原因有二：
	 *   a) view.pieces 是按【本方代表国】过滤过的部队列表，
	 *      而防守方此刻关心的可能不是本国（例如法国部队由英国代表）；
	 *   b) view.pieces 的键是部队行/算子对象，不是 id 索引，
	 *      view.pieces[p] 取不到东西。
	 * 总之：服务端已经把该给的都给了，客户端别再二次筛选。
	 */
	const airs = pb.airs || []

	/* 把可代受的空军名号写清楚，方便玩家核对是不是自己想用的那支 */
	const byId = view.pieces_by_id || {}
	const airDesc = airs.map(a => {
		const info = byId[a]
		return info
			? (info.type_zh + "@" + info.space_name)
			: ("空军 " + a)
	}).join("、")

	render_ask_box(
		"【" + pb.defender_nation + "】是否用空军代受？",
		"受攻击地区：" + ((view.spaces[pb.space] || {}).name || "?") +
			"　受创部队：" + (pb.victim_type === "air" ? "空军" : "部队") +
			"（可代受的空军 " + airs.length + " 支：" + (airDesc || "无") + "）",
		airs.map((a, i) => ({
			label: "用第 " + (i + 1) + " 支空军代受（空军被移除，部队保住）",
			onClick: () => send_action("resolve_battle", { use_air: a }),
		})).concat([{
			label: "不代受（部队被移除，空军撤离）",
			cls: "primary",
			onClick: () => {
				const list = pb.retreats || []
				ask_state = { kind: "retreat", space: pb.space }
				const opts = list.map(r => ({
					label: "撤往 " + r.name,
					onClick: () => send_action("resolve_battle",
						{ declined: true, retreat: r.id }),
				}))
				opts.push({
					label: list.length ? "不移走（空军直接移除）" : "无处可撤（空军直接移除）",
					cls: "primary",
					onClick: () => send_action("resolve_battle", { declined: true }),
				})
				render_ask_box("空军撤往哪里？",
					list.length
						? "不代受时，同地区的本国空军必须撤往相邻的合法位置"
						: "没有相邻的合法位置，这些空军将被移除",
					opts)
			},
		}])
	)
}

/*
 * 【2026-09-26】经济战卡挂起：受击方【依次】决定自己的方案。
 *
 * 15314 马耳他潜艇群 —— 德国、意大利各自选择：
 *   损耗 3 张牌  /  移除地中海的 1 支本国海军（无海军时该选项禁用）
 *
 * 只有 view.pending_econ 非 null 的一方（= 当前待答复国所属阵营）会进这里。
 * 每答复一个国家立即结算，服务端会把 step 推进到下一个国家。
 */
let econ_pick_navy = null   /* 选 remove 时指定的海军算子 */

function update_pending_econ_box() {
	const pe = view.pending_econ
	if (!pe) {
		if (ask_state && ask_state.kind === 'econ') {
			ask_state = null
			render_ask_box(null, null, null)
		}
		econ_pick_navy = null
		clear_piece_highlight('econ')
		return
	}

	/*
	 * 只有 step 变化时才重置"已选海军"：
	 * 同一个国家重复渲染（例如亮点更新）不该把玩家的选择清掉。
	 */
	if (!ask_state || ask_state.kind !== 'econ' ||
		ask_state.step !== pe.step || ask_state.nation !== pe.nation) {
		econ_pick_navy = null
		clear_piece_highlight('econ')
	}

	const optAttrite = pe.options.find(o => o.id === 'attrite')
	const optRemove = pe.options.find(o => o.id === 'remove')
	const done = pe.resolved.length
		? '（已答复：' + pe.resolved.map(x => x.nation).join('、') + '）'
		: ''

	const text = '《' + pe.card_name + '》[' + pe.tag + '] —— 轮到【' +
		pe.nation + '】选择' + done

	ask_state = { kind: 'econ', step: pe.step, nation: pe.nation, pe: pe }

	const buttons = []
	if (optAttrite)
		buttons.push({
			label: optAttrite.label, cls: 'primary',
			onClick: () => send_action('resolve_econ', { choice: 'attrite' }),
		})
	if (optRemove) {
		buttons.push({
			label: optRemove.label,
			cls: optRemove.enabled ? '' : 'disabled',
			/* 禁用时不回调：服务端也会拒绝，这里提前挡掉 */
			onClick: optRemove.enabled
				? () => econ_choose_remove(pe, optRemove)
				: null,
		})
	}
	render_ask_box('经济战等待选择', text, buttons)

	/* 选了 remove 但还没指定海军 -> 高亮可选海军，让玩家在地图上点 */
	if (econ_pick_navy === 'selecting') {
		const navies = (optRemove && optRemove.navies) || []
		if (navies.length)
			highlight_pieces(navies, 'econ')
	}
}

/*
 * 点了"移除海军"后的两步：
 *   ① 先把状态切成 selecting，高亮地图上可选的本国海军，提示去点地图
 *   ② 玩家点了某个算子 -> econ_pick_navy = piece_id -> 按钮变成"确认移除"
 */
function econ_choose_remove(pe, optRemove) {
	const navies = optRemove.navies || []
	if (!navies.length) {
		toast('该国在地中海没有可移除的海军')
		return
	}
	econ_pick_navy = 'selecting'
	update_pending_econ_box()
	toast('请在地图上点击要移除的 1 支海军（该地区同国空军会一起移除）')
}

/*
 * 地图上点击算子时调用（见 on_click_piece）：经济战选海军。
 * 返回 true 表示"这次点击已被经济战流程消费掉"。
 *
 * 【别再二次筛选】服务业已经把可移除的海军 id 放进 pe.options[remove].navies，
 * 客户端直接用即可。view.pieces 是按本方代表国过滤的部队列表、且键不是 id
 * （2026-09-23 踩过同样的坑，见 docs/pitfalls.md），不要拿它去校验。
 */
function econ_on_pick_piece(piece_id) {
	const pe = view.pending_econ
	if (!pe || econ_pick_navy !== 'selecting') return false
	const optRemove = pe.options.find(o => o.id === 'remove')
	if (!optRemove) return false
	const navies = optRemove.navies || []
	const hit = navies.some(x => String(x) === String(piece_id))
	if (!hit) {
		toast('请选择该国位于' + (pe.space_name || '地中海') + '的海军')
		return true
	}
	econ_pick_navy = piece_id
	clear_piece_highlight('econ')
	highlight_pieces([piece_id], 'econ')
	render_ask_box('经济战等待选择',
		'确认移除位于【' + (pe.space_name || '地中海') + '】的那支' +
			pe.nation + '海军？（同地区' + pe.nation + '空军会一起移除）', [
			{
				label: '确认移除', cls: 'primary',
				onClick: () => send_action('resolve_econ',
					{ choice: 'remove', piece: piece_id }),
			},
			{
				label: '重新选择', cls: '',
				onClick: () => { econ_pick_navy = 'selecting'; update_pending_econ_box() },
			},
		])
	return true
}

/*
 * 【2026-09-26】桌面状态卡渲染。
 *
 * 服务端通过 view.table_status 暴露本方桌面上的状态卡 + 每张是否可触发。
 * 这里在桌面状态区（#table_status 或动态创建的容器）里渲染：
 *   · 每张状态卡一卡片（卡名 + 描述）
 *   · ready=true 时高亮可点击
 *   · 已用 once_per_turn 时打"本回合已用过"标记
 */
function update_table_status() {
	const list = (view.table_status || []).slice()
	const host = document.getElementById('table_status') ||
		ensure_table_status_host()
	if (!list.length) {
		host.style.display = 'none'
		host.innerHTML = ''
		return
	}
	host.style.display = ''
	host.innerHTML = '<div class="ts-title">桌面状态卡</div>' +
		list.map(c => {
			const ui = STATUS_UI[c.card] || {}
			const cls = ['ts-card']
			let readyHint = ''
			let note = ''
			if (ui.build) {
				/* S4：仅当正在打《建设陆军》卡（进入选地块）时才高亮可放弃建设；
				 * 否则灰显，避免"错误时点显示可打出"。 */
				const building = !!(pending_card && pending_card.name === '建设陆军')
				if (building && c.ready) {
					cls.push('ready', 'build-ready')
					readyHint = '<div class="ts-ready">可放弃建设 → 征召 ' +
						esc(ui.recruit || '') + '</div>'
				} else {
					cls.push('ts-disabled')
					note = '<div class="ts-note">打出《建设陆军》后可放弃建设</div>'
				}
			} else if (ui.auto) {
				/* 自动卡（15340 国家资源动员法）：计分阶段自动结算，不可主动触发 */
				cls.push('ts-auto')
				note = '<div class="ts-note">自动结算（计分阶段）：' + esc(c.desc || '') + '</div>'
			} else if (c.ongoing && !c.trigger) {
				/* 持续效果（光环/地图改动）卡：不在桌面状态区标为可触发，仅显示说明 */
				cls.push('ts-ongoing')
				note = '<div class="ts-note">持续效果：' + esc(c.desc || '') + '</div>'
			} else if (c.ready) {
				cls.push('ready')
				readyHint = '<div class="ts-ready">可触发</div>'
			} else {
				/* 不可触发（被 15343 压制 / 已用过 / 时机不对）：灰显并说明原因 */
				cls.push('ts-disabled')
				note = '<div class="ts-note">' + esc(c.ready_reason || '此时机不能发动') + '</div>'
			}
			if (c.once_per_turn && c.used_this_turn)
				cls.push('used')
			return '<div class="' + cls.join(' ') + '" data-card="' +
				escape_attr(c.card) + '">' +
				'<div class="ts-name">' + esc(c.name) + '</div>' +
				'<div class="ts-desc">' + esc(c.desc || '') + '</div>' +
				readyHint + note +
				(c.once_per_turn && c.used_this_turn
					? '<div class="ts-used">本回合已用</div>' : '') +
				'</div>'
		}).join('')
	/* 所有状态卡都绑定点击：可触发的触发效果，自动/持续/不可触发的点击给原因提示 */
	Array.from(host.querySelectorAll('.ts-card')).forEach(el => {
		const cardId = el.getAttribute('data-card')
		if (el.__bound !== cardId) {
			el.__bound = cardId
			el.onclick = () => on_click_table_status(cardId)
		}
	})
}

/* 找不到 #table_status 容器就动态创建一个，插到手牌区上方 */
function ensure_table_status_host() {
	let h = document.getElementById('table_status')
	if (h) return h
	h = document.createElement('div')
	h.id = 'table_status'
	h.className = 'panel-list table-status'
	const hand = document.getElementById('hand_cards')
	const parent = hand ? hand.parentElement : document.querySelector('.main')
	if (parent && hand) parent.insertBefore(h, hand)
	else if (parent) parent.appendChild(h)
	else document.body.appendChild(h)
	return h
}

/*
 * 点击桌面状态卡 -> 触发它。
 *
 * 客户端需要知道每张触发卡需要哪些交互（弃牌 / 选发起单位 / 选目标地区）。
 * 这里用一份精简的 UI 配置镜像服务端 STATUS_EFFECTS 的 trigger 部分，
 * 因为 view.table_status 只给"是否就绪"，不给代价细节。
 *
 *   discard : 需要的弃牌张数（从手牌选）
 *   battle  : 'land' | 'sea' —— 需走两步地图流程（选地区 + 选发起单位 + 选目标）
 *   spaces  : 限定可攻击的地区名（如 15338 只能打西欧/意大利）
 *   attacker: 发起国（状态卡战斗一律由法国发起）
 *   fixed   : 战斗地区由触发窗口给定（15346），无需玩家选地区
 *   build   : 建设陆军窗口（S4），点击即放弃建设改为征召（由服务端校验上下文）
 */
const STATUS_UI = {
	/* 15338 / 15339：trigger 无 nation 字段，
	 * 发起方 = 状态卡所在桌面的 owner 国（英国玩家位 = 英国）。
	 * 与设计 §0 S3 一致：由英国陆/海军发起（相邻 + 补给中）。
	 * attacker_owner:true 表示取该卡桌面的 owner 国，而非固定法国。 */
	'15338': { discard: 2, battle: 'land', spaces: ['西欧', '意大利'], attacker_owner: true },
	'15339': { discard: 2, battle: 'sea', attacker_owner: true },
	/* 15346：tr.nation='法国'，固定由法国发起 */
	'15346': { battle: 'land', attacker: '法国', fixed: true },
	'15345': {},
	'15347': {},
	'15348': { count_by: { spaces: ['加拿大', '印度', '南非'], nation: '英国', type: 'army' } },
	/* 15340 国家资源动员法：自动卡（计分阶段自动结算），不可主动触发 */
	'15340': { auto: true },
	/* 15341/15342：打《建设陆军》卡进入选地块时可放弃建设，改在指定地区征召 */
	'15341': { build: true, recruit: '澳大利亚' },
	'15342': { build: true, recruit: '印度' },
}

/* 状态卡激活的临时状态 */
let status_discard_sel = null  /* { cardId, ui, need, picked:[] } */
let status_act_card = null
let status_act_discard = null
let status_act_ui = null
let status_act_owner = null   /* 桌面 owner 国（15338/15339 作为战斗发起方） */
let status_act_phase = null    /* 'space' | 'battle' */

function status_name(id) {
	const e = (view.table_status || []).find(x => x.card === id)
	return e ? e.name : ('状态卡' + id)
}

function space_id_of_name(nm) {
	for (const k in (view.spaces || {}))
		if ((view.spaces[k].name || '') === nm) return k
	return null
}

function status_ready_space(id) {
	const e = (view.table_status || []).find(x => x.card === id)
	if (e && e.ready_space != null) return e.ready_space
	if (view.last_battle && view.last_battle.space != null) return view.last_battle.space
	return null
}

function on_click_table_status(cardId) {
	const c = (view.table_status || []).find(x => x.card === cardId)
	if (!c) return
	const ui = STATUS_UI[cardId] || {}
	/* 自动结算卡（15340）：不可主动触发，点击提示 */
	if (ui.auto) {
		toast('《' + c.name + '》是自动结算卡，计分阶段自动生效，无需点击')
		return
	}
	/* 持续效果（光环/地图改动）卡：无需点击 */
	if (c.ongoing && !c.trigger) {
		toast('《' + c.name + '》是持续效果卡，无需点击')
		return
	}
	if (!c.ready) {
		toast('《' + c.name + '》此时机尚不能触发：' + (c.ready_reason || ''))
		return
	}
	if (c.once_per_turn && c.used_this_turn) {
		toast('《' + c.name + '》本回合已触发过')
		return
	}
	/* S4：建设陆军窗口下点击 -> 放弃正在进行的建设，改为征召。
	 * 设计 §3.3：打《建设陆军》卡进入选地块时，可改点状态卡放弃建设。
	 * 因此必须正在打《建设陆军》（pending_card 即该卡）才能触发；
	 * 确认时取消原建设选择（cancel_basic_card，并不真正建设），
	 * 服务端 cost.forgo_build_army 仅记录、effect 在指定地区 recruit。 */
	if (ui.build) {
		const building = !!(pending_card && pending_card.name === '建设陆军')
		if (!building) {
			toast('请先打出一张《建设陆军》卡并进入选地块，再点击此状态卡放弃建设')
			return
		}
		const where = ui.recruit || '指定地区'
		render_ask_box(
			'放弃建设陆军',
			'正在建设《' + pending_card.name + '》，放弃该建设，改为在' +
				where + '征召 1 支陆军？',
			[
				{ label: '放弃建设并征召', cls: 'primary', onClick: () => {
					const cid = cardId
					cancel_basic_card()      /* 放弃原建设选择（不真正建设） */
					render_ask_box(null)
					send_action('activate_status', { card: cid })
					toast('发动《' + status_name(cid) + '》')
				} },
				{ label: '取消', onClick: () => cancel_status_act() },
			])
		return
	}
	/* 需弃牌代价：先进入手牌弃置选择 */
	if (ui.discard) {
		start_status_discard(cardId, ui, ui.discard)
		return
	}
	/* 需选战斗目标：进入地图两步流程 */
	if (ui.battle) {
		start_status_battle(cardId, ui, null)
		return
	}
	/* 其余（15345/15347/15348 等）：弹代价确认框后提交。
	 * 15348 额外显示可执行次数（B2：N = 指定地区英国陆军数）。 */
	const extra = status_confirm_extra(ui)
	render_ask_box(
		'发动状态卡',
		'确认发动《' + c.name + '》？' + (extra ? '\n' + extra : ''),
		[
			{ label: '确认发动', cls: 'primary', onClick: () => {
				send_action('activate_status', { card: cardId })
				toast('发动《' + c.name + '》')
				render_ask_box(null)
			} },
			{ label: '取消', onClick: () => cancel_status_act() },
		])
}

/* 15348 等带 count_by 的卡：计算并显示可执行次数 */
function status_confirm_extra(ui) {
	if (!ui || !ui.count_by) return ''
	const sps = (ui.count_by.spaces || []).map(space_id_of_name).filter(x => x != null)
	const n = (view.pieces || []).filter(p =>
		p.nation === ui.count_by.nation &&
		(p.type || 'army') === (ui.count_by.type || 'army') &&
		sps.indexOf(p.loc) >= 0).length
	return '最多可执行 ' + n + ' 次（每次失去 1 分摸 1 张牌），本点击将执行 1 次'
}

/* ---------- 弃牌代价选择 ---------- */
function start_status_discard(cardId, ui, need) {
	status_discard_sel = { cardId: cardId, ui: ui, need: need, picked: [] }
	render_status_discard_box()
	update_hand_panel()
	toast('请选择 ' + need + ' 张手牌作为《' + status_name(cardId) + '》的代价')
}

function render_status_discard_box() {
	const s = status_discard_sel
	if (!s) { render_ask_box(null); return }
	const left = s.need - s.picked.length
	const btns = []
	if (left <= 0)
		btns.push({
			label: '确认弃置（' + s.need + ' 张）', cls: 'primary',
			onClick: () => finish_status_discard(),
		})
	btns.push({ label: '取消', onClick: () => cancel_status_act() })
	render_ask_box(
		'触发状态卡：弃置手牌',
		'《' + status_name(s.cardId) + '》需弃置 ' + s.need +
			' 张手牌，请点击下方手牌选择（还需 ' + Math.max(0, left) + ' 张）',
		btns)
}

function on_status_discard_pick(cardId) {
	const s = status_discard_sel
	if (!s) return false
	const i = s.picked.indexOf(cardId)
	if (i >= 0)
		s.picked.splice(i, 1)
	else if (s.picked.length < s.need)
		s.picked.push(cardId)
	else {
		toast('已选满 ' + s.need + ' 张')
		return true
	}
	update_hand_panel()
	render_status_discard_box()
	return true
}

function finish_status_discard() {
	const s = status_discard_sel
	status_discard_sel = null
	if (!s) return
	const ui = s.ui
	const picked = s.picked.slice()
	update_hand_panel()
	render_ask_box(null)
	if (ui.battle)
		start_status_battle(s.cardId, ui, picked)
	else
		send_action('activate_status', { card: s.cardId, discard: picked })
}

/* ---------- 战斗目标选择（复用 battle_flow） ---------- */
function start_status_battle(cardId, ui, discard) {
	status_act_card = cardId
	status_act_discard = discard || null
	status_act_ui = ui
	/* 桌面 owner 国：15338/15339 由它作为战斗发起方（英国），
	 * 15346 由 tr.nation='法国' 固定发起。 */
	status_act_owner = ((view.table_status || [])
		.find(t => t.card === cardId) || {}).nation || ''
	const name = status_name(cardId)
	if (ui.fixed) {
		const sp = status_ready_space(cardId)
		if (sp == null) {
			toast('未找到战斗地区（需本回合本方已发起战斗）')
			cancel_status_act()
			return
		}
		status_start_battle_space(sp)
		return
	}
	status_act_phase = 'space'
	const spaces = (ui.spaces || []).map(space_id_of_name).filter(x => x != null)
	if (spaces.length)
		highlight_targets({
			spaces: spaces.map(id => ({ id: id, reason: '可发起战斗的地区' })),
			pieces: [],
		})
	render_ask_box(
		'选择战斗地区',
		'请点击地图上的目标地区发起《' + name + '》的战斗' +
			(spaces.length ? '（仅 ' +
				spaces.map(id => (view.spaces[id] || {}).name || id).join('、') + '）' : ''),
		[{ label: '取消', onClick: () => cancel_status_act() }])
	toast('点击地图上的目标地区以发起《' + name + '》的战斗')
}

function status_start_battle_space(space_id) {
	status_act_phase = 'battle'
	render_ask_box(null)
	clear_target_highlight()
	battle_flow = {
		step: 'from', space: space_id, from: null, isEmpty: false,
		preVictim: null, victim: null, origin: 'status',
	}
	/* 目标地区的敌方算子（供点击选择攻击目标）。
	 * 与 basic_targets 一样填进 pending_targets.pieces，
	 * on_pick_battle_target 据此判定玩家点的是不是合法目标。
	 *
	 * 发起方（attacker）：
	 *   · ui.attacker 固定值（15346 = 法国）
	 *   · 否则若 attacker_owner，取桌面 owner 国（15338/15339 = 英国）
	 *   · 兜底法国 */
	const attacker = (status_act_ui && status_act_ui.attacker) ||
		((status_act_ui && status_act_ui.attacker_owner) ? status_act_owner : '法国')
	const enemyPieces = (view.pieces || []).filter(p =>
		p.loc === space_id && p.nation !== attacker)
	pending_targets = {
		spaces: [{ id: space_id }],
		pieces: enemyPieces.map(p => ({
			id: p.id,
			space: p.loc,
			space_name: (view.spaces[p.loc] || {}).name || p.loc,
			name: ((view.pieces_by_id || {})[p.id] || {}).type_zh || p.type,
		})),
	}
	send_query('battle_initiators', { space: space_id, nation: attacker })
}

function cancel_status_act() {
	status_discard_sel = null
	status_act_card = null
	status_act_discard = null
	status_act_ui = null
	status_act_owner = null
	status_act_phase = null
	battle_flow = null
	clear_piece_highlight('initiator')
	clear_target_highlight()
	render_ask_box(null)
	update_hand_panel()
}

/*
 * 响应卡挂起：持有方在询问框里决定"发动 / 不发动"。
 * 只有 view.pending_trigger 非 null 的一方会看到（服务端已按阵营过滤）。
 */
function update_pending_trigger_box() {
	const pt = view.pending_trigger
	if (!pt) {
		if (ask_state && ask_state.kind === 'response') {
			ask_state = null
			render_ask_box(null, null, null)
		}
		return
	}
	const names = pt.candidates.map(c => '《' + c.name + '》').join('、')
	const where = pt.space ? ('（于 ' + (data.name_of(pt.space) || pt.space) + '）') : ''
	const kind = pt.pre ? '——可令对方该行动无效' : ''
	const title = '响应卡等待决定'
	const text = '是否发动 ' + names + '？' + where + kind
	ask_state = { kind: 'response', pt: pt }
	render_ask_box(title, text, [
		{ label: '发动响应', cls: 'primary', onClick: () => send_action('trigger_response', {}) },
		{ label: '不发动', cls: '', onClick: () => send_action('pass_response', {}) },
	])
}

/*
 * 提交战斗卡。
 *
 * 注意：这里【不再】需要 defendAir / retreatTo ——
 * "是否用空军代受"由防守方通过 resolve_battle 单独提交，
 * 服务端会把战斗挂起并只把询问发给防守方。
 */
function finish_battle_card() {
	const bf = battle_flow

	/*
	 * 状态卡战斗（15338/15339/15346）走 activate_status，
	 * 而非 play_card。所有参数（space / from / victim / discard）一致，
	 * 只是 action 名与 card 指向状态卡本身。
	 */
	if (bf && bf.origin === 'status') {
		const base = { card: status_act_card, space: bf.space }
		if (bf.from) base.from = bf.from
		if (bf.victim) base.victim = bf.victim
		if (status_act_discard && status_act_discard.length)
			base.discard = status_act_discard.slice()
		render_ask_box(null)
		ask_state = null
		battle_flow = null
		clear_piece_highlight("initiator")
		clear_target_highlight()
		const nm = status_name(status_act_card)
		status_act_card = null
		status_act_discard = null
		status_act_ui = null
		status_act_phase = null
		send_action("activate_status", base)
		toast("已触发《" + nm + "》于 " +
			((view.spaces[base.space] || {}).name || "?"))
		return
	}

	const base = { card: pending_card.id, space: bf.space }
	if (pending_mode)
		base.mode = pending_mode
	if (bf.from)
		base.from = bf.from
	if (bf.victim)
		base.piece = bf.victim

	render_ask_box(null)
	ask_state = null
	battle_flow = null
	clear_piece_highlight("initiator")
	send_action("play_card", base)
	toast("已打出《" + pending_card.name + "》到 " +
		((view.spaces[base.space] || {}).name || "?") +
		(bf.isEmpty ? "（空打：该地区无可攻击敌军）" : ""))
	cancel_basic_card()
}

/*
 * 算子高亮（用于"在地图上选发起单位"）：
 * 给指定算子加上 .pickable 类，让玩家一眼看出哪些能点。
 */
const piece_highlight = {}   /* kind -> [piece_id] */

function highlight_pieces(ids, kind) {
	clear_piece_highlight(kind)
	piece_highlight[kind] = (ids || []).slice()
	for (const id of piece_highlight[kind]) {
		const el = piece_elt(id)   /* ui.piece_el 注册表，比 DOM 查询更可靠 */
		if (el) el.classList.add("pickable")
	}
}

function clear_piece_highlight(kind) {
	for (const id of (piece_highlight[kind] || [])) {
		const el = piece_elt(id)
		if (el) el.classList.remove("pickable")
	}
	piece_highlight[kind] = []
}

function update_strait_line() {
	const el = document.getElementById("strait_line")
	if (!el)
		return
	if (!view.straits || !view.strait_control) {
		el.textContent = ""
		return
	}
	const parts = []
	for (const s of view.straits) {
		const c = view.strait_control[s.name]
		const cls = c === "axis" ? "st-axis" : "st-allies"
		const label = c === "axis" ? "轴" : "同"
		parts.push(s.name + '<span class="' + cls + '">' + label + "</span>")
	}
	el.innerHTML = "海峡：" + parts.join(" ")
}

/* ============================================================
 * 分数面板（2026-09-22）
 *
 * 显示两块内容：
 *   ① 阵营总分（轴心 / 同盟）+ 分差
 *   ② 【本方代表国】当前可得分数的明细（按地块），
 *      标注是"独自占领"还是"共同占领"，以及同格的友军
 * ============================================================ */
function update_score_panel() {
	const sc = view.score || {}
	const a = Number(sc.axis || 0)
	const b = Number(sc.allies || 0)

	set_text("score_axis", fmt_score(a))
	set_text("score_allies", fmt_score(b))
	set_text("score_gap", a === b ? "平分" : (a > b ? "轴心领先 " : "同盟领先 ") +
		fmt_score(Math.abs(a - b)))

	/* 胜负横幅 */
	const winEl = document.getElementById("score_winner")
	if (winEl) {
		winEl.classList.toggle("hide", !view.winner)
		if (view.winner)
			winEl.textContent = (view.winner === "axis" ? "轴心胜利" : "同盟胜利") +
				(view.win_reason ? "：" + view.win_reason : "")
	}

	/* 明细 */
	const headEl = document.getElementById("score_detail_head")
	const detEl = document.getElementById("score_detail")
	if (!detEl)
		return
	detEl.innerHTML = ""

	const bd = view.my_score_detail
	if (headEl) {
		headEl.classList.toggle("hide", !bd)
		if (bd) {
			/* 代表团一并显示，例如"英国（含法国）" */
			const bloc = (bd.bloc || []).slice()
			const extra = bloc.length > 1 ? "（含 " + bloc.slice(1).join("/") + "）" : ""
			set_text("score_my_nation", (bd.counted_as || view.my_nation || "—") + extra)
		}
	}
	if (!bd || !bd.total) {
		const d = document.createElement("div")
		d.className = "none"
		d.textContent = "（当前还未占领任何有计分标记的地区）"
		detEl.appendChild(d)
		return
	}

	for (const it of bd.items) {
		const row = document.createElement("div")
		row.className = "row" + (it.shared ? " shared" : "")

		const nm = document.createElement("span")
		nm.className = "nm"
		nm.textContent = it.name + (it.shared ? "（共同占领）" : "")
		row.appendChild(nm)

		const who = document.createElement("span")
		who.className = "who"
		who.textContent = it.shared && it.friendly && it.friendly.length
			? "友军 " + it.friendly.join("、")
			: ""
		row.appendChild(who)

		const pt = document.createElement("span")
		pt.className = "pt"
		pt.textContent = "+" + fmt_score(it.gained)
		row.appendChild(pt)

		detEl.appendChild(row)
	}

	const tot = document.createElement("div")
	tot.className = "total"
	tot.innerHTML = "<span>本次可得</span><span>+" + fmt_score(bd.total) + "</span>"
	detEl.appendChild(tot)
}

/* 分数显示：整数不带小数点，半整数（终局 +0.5）保留一位 */
function fmt_score(v) {
	return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/* ============================================================
 * 地图上的计分标记
 *
 * 每个有标记的地块右上角画一个胶囊：★N
 *   · N = 该地块的标记总分
 *   · 若标记有归属（只对某国生效），胶囊变绿色并标出国名
 * ============================================================ */
function update_markers() {
	const wrap = document.getElementById("pieces")
	const markers = view.markers || {}
	if (!wrap)
		return

	const seen = {}

	for (const key of Object.keys(markers)) {
		const space_id = Number(key)
		const list = markers[key] || []
		if (!list.length)
			continue

		const total = list.reduce((s, mk) => s + (mk.value || 1), 0)
		/* 归属：全部或部分标记指定了国家时显示 */
		const owners = []
		for (const mk of list) {
			if (mk.owner && owners.indexOf(mk.owner) < 0) owners.push(mk.owner)
		}

		seen[space_id] = true
		let elt = ui.marker_el[space_id]
		if (!elt) {
			elt = document.createElement("div")
			elt.className = "marker-badge"
			const star = document.createElement("span")
			star.className = "star"
			star.textContent = "★"
			elt.appendChild(star)
			const num = document.createElement("span")
			num.className = "num"
			elt.appendChild(num)
			const who = document.createElement("span")
			who.className = "who"
			elt.appendChild(who)
			wrap.appendChild(elt)
			ui.marker_el[space_id] = elt
		}

		/*
		 * 位置：地块右上角。
		 * data.spaces 只有 x/y（左上角），宽高在 layout 里，
		 * 所以用固定偏移把胶囊摆在格子右上外侧，避免压住地区名。
		 */
		const sp = data.spaces[space_id]
		if (sp) {
			elt.style.left = (sp.x + 6) + "px"
			elt.style.top = (sp.y - 16) + "px"
		}

		elt.querySelector(".num").textContent = total
		elt.querySelector(".who").textContent = owners.length ? owners.join("/") : ""
		elt.classList.toggle("owned", owners.length > 0)
		elt.title = data.name_of(space_id) + "：" + total + " 个计分标记" +
			(owners.length ? "（仅 " + owners.join("/") + " 可计分）" : "")
	}

	/* 清掉已无标记的 */
	for (const key of Object.keys(ui.marker_el)) {
		const id = Number(key)
		if (!seen[id]) {
			ui.marker_el[key].remove()
			delete ui.marker_el[key]
		}
	}
}

/*
 * 补给状态行：显示当前行动国 + 各国断补数
 * 断补的部队会在其算子上叠红圈（见 play.css 的 .unit.out_of_supply）
 */
function update_supply_line() {
	const el = document.getElementById("supply_line")
	if (!el)
		return

	const by = (view.supply && view.supply.by_nation) || {}
	const parts = []
	for (const n of (view.order_of_nations || [])) {
		const d = by[n]
		if (!d)
			continue
		const bad = d.total - d.ok
		const cur = (n === view.current_nation) ? " cur" : ""
		parts.push(
			'<span class="sn' + cur + '">' + n +
			'<b>' + d.ok + "/" + d.total + "</b>" +
			(bad > 0 ? '<i class="bad">−' + bad + "</i>" : "") +
			"</span>"
		)
	}
	el.innerHTML = parts.length
		? "补给：" + parts.join(" ")
		: "补给：场上无部队"
	if (view.current_nation)
		el.insertAdjacentHTML("beforeend",
			' <span class="cur_nation">行动国：' + view.current_nation + "</span>")
}

/*
 * 同步地块的"补给点"CSS class。
 *
 * 为什么需要：markup_classes() 只在 build_map() 时跑一次，
 * 而补给点现在【可被卡牌改变】，之后必须刷新，
 * 否则地图上的★会和实际状态对不上（"改了但没画出来"）。
 *
 * 见 docs/pitfalls.md 通用教训 1：渲染时机 ≠ 状态时机。
 */
function update_supply_classes() {
	const byId = (view && view.supply_by_id) || {}
	for (const s of Object.keys(ui.spaces)) {
		const elt = ui.spaces[s]
		const d = byId[s]
		elt.classList.toggle("supply", !!d)
		/* 仅对单一阵营有效的补给点用 half 标记，视觉上区分 */
		elt.classList.toggle("half", !!(d && d.axis !== d.allies))
	}
}

/*
 * 参战状态行（苏联 / 美国的中立规则）
 *
 * 显示形如：
 *   参战：苏联<b class="neutral">中立</b> 美国<b class="joined">已参战</b>
 *
 * 点击某个国家名可以展开它的条件进度（还差什么才能参战），
 * 数据全部来自 view.neutral_detail（服务端算好的，客户端不再推导）。
 */
function update_neutral_line() {
	const el = document.getElementById("neutral_line")
	if (!el)
		return

	const neutral = view.neutral || {}
	const detail = view.neutral_detail || {}
	const names = Object.keys(neutral)
	if (!names.length) {
		el.innerHTML = ""
		return
	}

	const parts = []
	for (const n of names) {
		const isNeutral = neutral[n]
		const cls = isNeutral ? "neutral" : "joined"
		const label = isNeutral ? "中立" : "已参战"
		let tip = n + "：" + label
		const d = detail[n]
		if (d && d.reason)
			tip += "\n参战原因：" + d.reason
		parts.push(
			'<span class="nt ' + cls + '" title="' + esc_attr(tip) + '">' +
			n + "<b>" + label + "</b></span>"
		)
	}
	el.innerHTML = "参战：" + parts.join(" ")

	/* 有中立国时，把它的条件进度也列出来（一行一条） */
	const lines = []
	for (const n of names) {
		const d = detail[n]
		if (!d || !d.neutral) continue
		for (const c of (d.conditions || [])) {
			lines.push(
				'<span class="cond' + (c.done ? " done" : "") + '">' +
				(c.done ? "✓ " : "○ ") + esc(d.zh || "") + "</span>"
			)
		}
	}
	if (lines.length)
		el.insertAdjacentHTML("beforeend",
			'<div class="cond_list">' + lines.join("") + "</div>")
}

/* HTML 文本转义（条件文案里有 <> 等字符） */
function esc(s) {
	return String(s == null ? "" : s)
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/* 供 title 属性用：转义引号与换行 */
function esc_attr(s) {
	return esc(s).replace(/"/g, "&quot;").replace(/\n/g, "&#10;")
}

function update_violations() {
	/* 留空，后续规则检查接入 */
	set_text("violations", "")
}

/* ---- 算子渲染 ---- */

function update_pieces() {
	if (!view.pieces)
		return
	const wrap = document.getElementById("pieces")
	if (!wrap)
		return

	const seen = {}

	/* 同一格位多个算子需要错开摆放，先按格位分组 */
	const by_space = {}
	for (const p of view.pieces) {
		if (p.loc == null)
			continue
		;(by_space[p.loc] = by_space[p.loc] || []).push(p)
	}

	for (const space_id of Object.keys(by_space)) {
		const list = by_space[space_id]
		list.sort(compare_pieces)

		/*
		 * 分行：单位（陆军/海军）在下，空军在上。
		 * 只有一行时让它在格位正中，两行时才上下分开。
		 */
		const units = list.filter(p => p.type !== "air")
		const airs = list.filter(p => p.type === "air")
		const two_rows = units.length > 0 && airs.length > 0

		const place_row = (arr, dy) => {
			arr.forEach((p, i) => {
				seen[p.id] = true
				let elt = ui.piece_el[p.id]
				if (!elt) {
					elt = build_piece(p)
					ui.piece_el[p.id] = elt
					wrap.appendChild(elt)
				}
				const dx = (i - (arr.length - 1) / 2) * PIECE_GAP
				position_piece(elt, Number(space_id), dx, dy)
				update_piece_face(elt, p)
			})
		}

		place_row(units, two_rows ? UNIT_ROW_DY : 0)
		place_row(airs, two_rows ? AIR_ROW_DY : 0)
	}

	/* 移除已不在场上的算子 */
	for (const id of Object.keys(ui.piece_el)) {
		if (!seen[id]) {
			ui.piece_el[id].remove()
			delete ui.piece_el[id]
		}
	}
}

function build_piece(p) {
	const elt = document.createElement("div")
	elt.piece_id = p.id
	elt.className = "unit"

	const label = document.createElement("div")
	label.className = "unit_label"
	elt.appendChild(label)

	elt.addEventListener("click", on_click_piece)
	elt.addEventListener("mouseenter", on_focus_piece)
	elt.addEventListener("mouseleave", on_blur_piece)

	return elt
}

function update_piece_face(elt, p) {
	const nation = p.nation || "?"
	elt.className = "unit " + (p.type || "army") +
		" " + (NATION_CLS[nation] || "") +
		(p.in_supply ? " in_supply" : " out_of_supply")
	elt.title = nation + " " + (TYPE_LABEL[p.type] || p.type) +
		(p.in_supply ? "（补给正常）" : "（断补，补给阶段将被移除）")
	const label = elt.querySelector(".unit_label")
	if (label)
		label.textContent = TYPE_LABEL[p.type] || "?"
}

/*
 * 同格位多算子的排版参数。
 *
 * 按共存规则（每国 1 个单位 + 1 个飞机）分行摆放：
 *   · 单位行（陆军/海军）在格位中心偏下
 *   · 空军行在上方，视觉上"在空中"
 * 算子直径 46px，行内间距取 52px 以留出缝隙、避免相互遮挡。
 */
const PIECE_GAP = 52
const UNIT_ROW_DY = 12
const AIR_ROW_DY = -40

/*
 * 稳定排序：国家 -> 类型（单位在前、空军在后）-> id。
 * 按国家而非 id 排序，是为了让同一格位的算子左右顺序稳定，
 * 增删其它算子时不会让已有的算子左右跳动。
 */
function compare_pieces(a, b) {
	const na = a.nation || "", nb = b.nation || ""
	if (na !== nb)
		return na.localeCompare(nb, "zh")
	const ta = (a.type === "air") ? 1 : 0
	const tb = (b.type === "air") ? 1 : 0
	if (ta !== tb)
		return ta - tb
	return String(a.id).localeCompare(String(b.id))
}

function position_piece(elt, space_id, dx, dy) {
	const sp = data.spaces[space_id]
	if (!sp)
		return
	elt.style.left = (sp.x + dx) + "px"
	elt.style.top = (sp.y + dy) + "px"
}

/*
 * client.js 的查询回调（send_query 的结果通过它返回）。
 * 目前只处理基本卡的合法目标。
 */
/* 实际的 on_reply 定义在文件末尾（合并了所有查询分支） */


/* ============================================================
 * 交互：Esc / 右键取消基本卡的选目标
 * ============================================================ */

document.addEventListener("keydown", (e) => {
	if (e.key !== "Escape")
		return
	if (pending_event_card) {
		cancel_event_card()
		return
	}
	if (pending_card) {
		cancel_basic_card()
		toast("已取消选择")
	}
	cancel_discard_mode()
	cancel_resource_swap()
	cancel_air_move()
	/* 弃牌阶段：Esc 清空已框住的选择 */
	if (discard_pick.length) {
		discard_pick = []
		update_hand_panel()
		update_phase_buttons()
	}
})

/* 点弹框外的遮罩关闭（点击内容区不关） */
document.addEventListener("click", (e) => {
	const modal = document.getElementById("resource_modal")
	if (modal && !modal.classList.contains("hide") && e.target === modal)
		cancel_resource_swap()
})

document.addEventListener("contextmenu", (e) => {
	if (pending_card) {
		e.preventDefault()
		cancel_basic_card()
		toast("已取消选择")
	}
})

/* ============================================================
 * 三、交互
 * ============================================================ */

/* 取格位 / 算子的 DOM 元素（供高亮使用） */
function space_elt(id) { return ui.spaces[id] || null }
function piece_elt(id) { return ui.piece_el[id] || null }

function on_click_space(evt) {
	const s = evt.currentTarget.space_id

	/* 空军调度：点地区选目标 */
	if (air_move) {
		if (!air_move.air) {
			toast("请先点 1 支本国空军算子")
			return
		}
		const okT = air_move.targets.some(t => t.id === s)
		if (!okT) {
			toast("该地区没有处于补给状态的本国陆军或海军")
			return
		}
		air_move.target = s
		if (!air_move.card) {
			update_air_box()
			toast("还差一步：请在下方手牌中点 1 张作为弃牌代价")
			return
		}
		send_action("air_support", { air: air_move.air, target: s, card: air_move.card })
		toast("调度空军到 " + ((view.spaces[s] || {}).name || "?") + "（弃 1 张手牌）")
		cancel_air_move()
		return
	}

	/*
	 * 状态卡战斗：选目标地区（15338/15339）。
	 * 仅当 status_act_phase==='space' 时生效，此时 battle_flow 尚未建立。
	 */
	if (status_act_phase === 'space') {
		const allow = (status_act_ui && status_act_ui.spaces)
			? status_act_ui.spaces.map(space_id_of_name).filter(x => x != null)
			: null
		if (allow && allow.indexOf(s) < 0) {
			toast('该地区不在《' + status_name(status_act_card) + '》可攻击范围内')
			return
		}
		status_start_battle_space(s)
		return
	}

	/*
	 * 战斗卡：点地区 = 选目标地区（须先在地图上选好发起单位）。
	 * 若该地区有可攻击敌军，则要求点具体算子（空军不可攻击）。
	 */
	if (battle_flow) {
		if (!battle_flow.from) {
			toast("请先在地图上点击一支本国陆军/海军作为发起单位（空军不能发起战斗）")
			return
		}
		if (battle_flow.step === "target") {
			on_pick_battle_target(s, null)
			return
		}
	}

	/* 基本卡选目标优先于其他一切 */
	if (pending_card && on_space_click_for_card(s))
		return

	/*
	 * EVENT / ECHO 卡选目标（2026-09-25）：
	 * 玩家点了一个高亮地区 -> 累积选择。
	 *
	 * 【2026-09-25 修正多选】之前注释写"多选暂不实现"，pick>1 时
	 * 玩家点第一个地区就立刻 send_action 单个 space，导致
	 * 15326 自由法国同盟（pick:2）只能选 1 个、服务端也只建 1 支陆军。
	 * 现在：累积到 pick 数量后才提交 picks 数组。
	 */
	if (pending_event_card && pending_event_targets) {
		const cands = (pending_event_targets.candidates || []).map(c => c.id)
		if (cands.indexOf(s) < 0) {
			toast("该地区不是《" + pending_event_card.name + "》的合法目标")
			return
		}
		const pick = pending_event_targets.pick || 1
		/*
		 * 单选：直接提交 space（保留旧格式，与服务端 resolve_event_card
		 * 的 pick_space_for 兼容）。
		 */
		if (pick <= 1) {
			const arg = { card: pending_event_card.id, space: s }
			/*
			 * 【2026-09-25 bug 修复】多步卡（如 15324 荷属东印度：第 0 步海军在南海、
			 * 第 1 步才需玩家选印度尼西亚/新几内亚）服务端 pick_space_for 对
			 * total>1 只读 arg.spaces[i]，而旧代码只发单个 space，
			 * 导致服务端读不到值、反复回 need:'space'（高亮能显示、点了没反应）。
			 * 这里把选的地区放到 pending step 对应的下标，传 spaces 数组，
			 * 同时保留 space 以兼容单步卡（total===1）的旧路径。
			 * ⚠ 改这里前先读 rules.js pick_space_for 注释与 docs/pitfalls.md R15，
			 *   不要把服务端 pick_space_for 改成读 arg.space（会污染 step0 位置）。
			 */
			if (pending_event_targets && pending_event_targets.step != null) {
				const sp = []
				sp[pending_event_targets.step] = s
				arg.spaces = sp
			}
			if (pending_event_choice != null)
				arg.choice = pending_event_choice
			/*
			 * 若卡片有 cost.discard 且玩家已选弃牌，
			 * 一并提交 cards: [id, ...]，让服务端按玩家的选择弃牌
			 * （resolve_event_card 的 ② 代价分支已支持 arg.cards）。
			 */
			if (pending_echo_cards && pending_echo_cards.length)
				arg.cards = pending_echo_cards.slice()
			send_action("play_card", arg)
			toast("打出《" + pending_event_card.name + "》到 " +
				((view.spaces[s] || {}).name || "?"))
			cancel_event_card()
			return
		}
		/*
		 * 多选：累积到 picks 数组，达到 pick 数量后显示"Done"按钮，
		 * 玩家点 Done 才真正提交（参考 pog 的右上角 Done 按钮）。
		 * 同一地区点两次 = 取消选中；超选会被拒。
		 */
		if (!pending_event_picks)
			pending_event_picks = []
		const i = pending_event_picks.indexOf(s)
		if (i >= 0) {
			pending_event_picks.splice(i, 1)
			toast("已取消 " + ((view.spaces[s] || {}).name || "?") +
				"（已选 " + pending_event_picks.length + "/" + pick + "）")
		} else if (pending_event_picks.length >= pick) {
			toast("已选满 " + pick + " 个，请先取消一个或点【Done】确认")
			return
		} else {
			pending_event_picks.push(s)
			toast("已选 " + ((view.spaces[s] || {}).name || "?") +
				"（" + pending_event_picks.length + "/" + pick + "）" +
				(pending_event_picks.length === pick ? "，点【Done】确认" : ""))
		}
		/* 重新高亮，把已选的标 .sel */
		highlight_event_targets(pending_event_targets)
		/* 更新 Done 按钮状态 */
		update_event_done_button()
		return
	}

	/* 调试模式优先 */
	if (ui.debug_mode === "place") {
		debug_do_place(s)
		return
	}
	if (ui.debug_mode === "remove") {
		set_debug_hint("请点击地图上的部队")
		return
	}

	select_space(s)
}

function select_space(s) {
	/* 取消上次选中 */
	if (ui.selected && ui.spaces[ui.selected])
		ui.spaces[ui.selected].classList.remove("selected")
	document.querySelectorAll(".space.connected_to_selected")
		.forEach(e => e.classList.remove("connected_to_selected"))

	if (ui.selected === s) {
		ui.selected = null
		return
	}
	ui.selected = s
	const elt = ui.spaces[s]
	if (elt)
		elt.classList.add("selected")

	/* 显示本方视角下与该格位相邻的格位（直观验证连通性） */
	const nbrs = (view.adjacency && view.adjacency[s]) || []
	for (const n of nbrs) {
		const e = ui.spaces[n]
		if (e)
			e.classList.add("connected_to_selected")
	}

	const sp = data.spaces[s]
	const names = nbrs.map(n => data.name_of(n)).join("、")
	toast(`${sp.name}：相邻 ${nbrs.length} 处 — ${names}`)
}

function on_click_piece(evt) {
	evt.stopPropagation()
	const id = evt.currentTarget.piece_id

	/*
	 * 【2026-09-26】经济战选海军优先：
	 * 面板已点过"移除海军"时，这一下点击算是在挑要移除的那支。
	 */
	if (econ_on_pick_piece(id)) {
		update_hand_panel()
		return
	}

	/*
	 * 空军调度模式：点本国空军算子 = 选中它
	 */
	if (air_move) {
		if (air_move.airs.indexOf(id) >= 0) {
			air_move.air = id
			update_air_box()
			toast("选中空军 " + id + "，再点目标地区（须有本国补给中的陆/海军）")
		} else {
			toast("这不是可调度的本国空军")
		}
		update_hand_panel()
		return
	}

	/*
	 * 战斗卡：先在地图上点【发起单位】，再点目标。
	 */
	if (battle_flow) {
		const isSeize = (pending_mode === 'seize')
		/* 还在选发起单位 */
		if (battle_flow.step === "from" || !battle_flow.from) {
			if (on_pick_initiator(id))
				return
		}
		/* 已选好发起单位 -> 这个算子作为攻击目标 */
		if (battle_flow.step === "target") {
			const cand = ((pending_targets && pending_targets.pieces) || [])
				.find(p => p.id === id)
			if (cand) {
				on_pick_battle_target(cand.space, id)
				return
			}
			/* 空战（seize）：点本国飞机 = 重选发起单位，而非"空军不可攻击" */
			if (isSeize && battle_flow.initiators.some(x => x.id === id)) {
				if (on_pick_initiator(id))
					return
			}
			toast(isSeize
				? "请选择要夺取的敌方空军（或该地区本身）"
				: "该算子不能作为攻击目标（空军不可攻击，也须先选发起单位）")
			return
		}
	}

	/* 基本卡等待选目标时：点敌方算子 = 指定战斗目标 */
	if (pending_card && pending_targets) {
		const sp = (pending_targets.pieces || []).find(p => p.id === id)
		if (sp) {
			if (is_battle_card(pending_card) || pending_mode === 'seize') {
				/* 战斗卡 / 夺取制空权：走地图两步流程（先选目标/敌机，再选发起单位） */
				play_battle_card(sp.space, id, false)
				return
			}
			const arg = { card: pending_card.id, space: sp.space }
			if (pending_mode)
				arg.mode = pending_mode
			/* 《空军力量》等：指定使用哪支己方算子 */
			arg.piece = id
			send_action("play_card", arg)
			toast("《" + pending_card.name + "》目标：" + sp.name + "（" + sp.space_name + "）")
			cancel_basic_card()
			return
		}
		toast("该算子不是合法目标")
		return
	}

	if (ui.debug_mode === "remove") {
		send_action("debug_remove", { piece: id })
		set_debug_hint("已移除 " + id)
		return
	}

	/* 非调试模式：仅提示位置 */
	const p = (view.pieces || []).find(x => x.id === id)
	if (p) {
		const sp = data.spaces[p.loc]
		toast(`${p.nation} ${TYPE_LABEL[p.type] || p.type} @ ${sp ? sp.name : "?"}`)
	}
}

function on_focus_space(evt) {
	const s = evt.currentTarget.space_id
	const sp = data.spaces[s]
	if (!sp)
		return
	let text = sp.name
	const attrs = []
	if (sp.terrain === "land") attrs.push("陆地")
	if (sp.terrain === "sea") attrs.push("海域")
	/* 补给点走动态层（可能被卡牌改过 / 仅对某阵营有效） */
	const sd = view && view.supply_by_id && view.supply_by_id[sp.id]
	if (sd) {
		if (sd.axis && sd.allies) attrs.push("★补给点")
		else if (sd.allies) attrs.push("★补给点（仅同盟）")
		else if (sd.axis) attrs.push("★补给点（仅轴心）")
	}
	if (sp.home_base) attrs.push("⌂大本营")
	if (sp.strait) attrs.push("🚧海峡")
	text += "（" + attrs.join(" / ") + "）"
	show_status(text)
}

function on_blur_space() { show_status("") }

function on_focus_piece(evt) {
	const p = (view.pieces || []).find(x => x.id === evt.currentTarget.piece_id)
	if (p)
		show_status(`${p.nation} ${TYPE_LABEL[p.type] || p.type}`)
}

function on_blur_piece() { show_status("") }

function show_status(text) {
	const el = document.getElementById("status")
	if (el)
		el.textContent = text
}

/* 轻量提示（复用 status 栏，避免依赖对话框 API） */
let toast_timer = null
function toast(text) {
	show_status(text)
	clearTimeout(toast_timer)
	toast_timer = setTimeout(() => show_status(""), 3000)
}

/* ============================================================
 * 四、侧栏查询
 * ============================================================ */

function show_straits() {
	const lines = []
	for (const s of view.straits) {
		const c = view.strait_control[s.name]
		lines.push(`${s.name}（${s.a} ↔ ${s.b}）：${c === "axis" ? "轴心国" : "同盟国"}控制`)
	}
	toast(lines.join("　"))
}

/*
 * 查询回复的统一入口（client.js 的 send_query 结果都走这里）。
 *
 * 注意：本文件里【只能有一个】on_reply 定义 ——
 * 函数声明重复定义时后者静默覆盖前者，曾导致 basic_targets 分支永远不执行。
 */
function on_reply(q, params) {
	console.log("[REPLY] on_reply called, q=", q, "params=", params ? JSON.stringify(params).slice(0, 200) : null)
	if (q === "straits") {
		const txt = (params || []).map(s =>
			`${s.name}: ${s.a} ↔ ${s.b} → ${s.controller === "axis" ? "轴心" : "同盟"}控制`
		).join("　")
		toast(txt)
		return
	}

	if (q === "adjacency") {
		const n = params && ui.selected ? params[data.name_of(ui.selected)] : null
		if (n)
			toast("本方视角相邻：" + n.join("、"))
		else
			toast("请先点选一个格位")
		return
	}

	/* 基本卡的可选目标 */
	if (q === "basic_targets") {
		if (!pending_card)
			return
		pending_targets = params || { spaces: [], pieces: [] }

		/*
		 * 没有合法目标 -> 直接取消选卡并明确提示。
		 * 否则会停在"已进入选目标模式但一个地区都点不了"的状态，
		 * 玩家只能按 Esc 退出，看起来像卡住了（空军力量最容易触发）。
		 */
		const n = (pending_targets.spaces || []).length
		const np = (pending_targets.pieces || []).length
		if (n === 0 && np === 0) {
			const nm = pending_card.name
			cancel_basic_card()
			toast("《" + nm + "》当前没有合法目标，无法打出" +
				(pending_mode ? "（模式：" + pending_mode + "）" : ""))
			return
		}

		highlight_targets(pending_targets)
		toast("《" + pending_card.name + "》：可选 " + n + " 个地区" +
			(np ? "，" + np + " 支部队" : "") + "（右键 / Esc 取消）")
		return
	}

	/* 空军阶段②：本国空军 + 合法调度目标（本国补给中的陆/海军所在地） */
	if (q === "air_options") {
		if (!air_move)
			return
		air_move.airs = (params && params.airs) || []
		air_move.targets = (params && params.targets) || []
		update_air_box()
		toast("调度空军：先点 1 张手牌作为代价，再点空军算子与目标地区")
		return
	}

	/* 资源再分配：牌堆中实际可挑选的基本卡（服务端已按洗牌后的牌堆返回） */
	if (q === "deck_basics") {
		if (!pending_resource)
			return
		pending_resource.basics = params || []
		/* 如果之前选中的那张已经不在牌堆里（被洗到别处等），清掉选择 */
		if (pending_resource.take &&
			!pending_resource.basics.some(c => c.id === pending_resource.take))
			pending_resource.take = null
		update_resource_box()
		return
	}

	/* 战斗第一步：可选的本国发起单位（陆/海军，空军不在其中） */
	if (q === "battle_initiators") {
		if (!battle_flow)
			return
		show_initiator_choices(params || [])
		return
	}

	/* 夺取制空权第一步：可选的本国发起飞机（seize 模式，空军版 battle_initiators） */
	if (q === "air_initiators") {
		if (!battle_flow)
			return
		show_initiator_choices(params || [])
		return
	}

	/*
	 * ---------- EVENT / ECHO 卡的目标查询（2026-09-25）----------
	 *
	 * 客户端打出事件/增强卡前，先查 event_targets 看需要什么：
	 *   need=null     -> 直接打出
	 *   need='choice' -> 弹选择按钮
	 *   need='space'  -> 高亮地图地区让玩家点
	 */
	if (q === "event_targets") {
		if (!pending_event_card)
			return
		const tg = params
		if (!tg) {
			/* 无配置 -> 直接打出 */
			send_action("play_card", { card: pending_event_card.id })
			pending_event_card = null
			return
		}
		if (tg.need === null) {
			send_action("play_card", { card: pending_event_card.id })
			toast("打出《" + pending_event_card.name + "》")
			pending_event_card = null
			return
		}
		/*
		 * 【2026-09-25 新增】peek_reorder 类型：需要玩家选排序顺序。
		 *
		 * 【2026-09-25 bug 修复】query 是只读 RPC，服务端写 game.peek
		 * 后 view 不会广播——所以客户端不能依赖 view.peek 弹框。
		 *
		 * 正确做法：query 返回的 tg.cards 就是挑出的对手手牌 id，
		 * 客户端【自己】弹排序 UI，记录 pending_peek_for_card + peek_order。
		 * 玩家点【确认顺序】后 submit_peek 用 peek_order 构造 send_action。
		 */
		if (tg.need === "peek_reorder") {
			pending_peek_for_card = pending_event_card
			/*
			 * 【2026-09-25 bug 修复】tg.cards 是卡对象数组（含 id/name/type），
			 * 不是裸 id——服务端 query 出口已转好。
			 * peek_cards 直接存卡对象数组，update_peek_box 直接渲染。
			 */
			peek_cards = tg.cards.slice()
			peek_target = tg.target
			peek_order = []
			update_peek_box()
			toast("《" + pending_event_card.name + "》：观看 " + tg.target +
				" 手牌，按指定顺序置于其牌堆顶")
			return
		}
		if (tg.need === "choice") {
			show_event_choice(tg)
			return
		}
		if (tg.need === "space") {
			/*
			 * 【2026-09-25 新增】若卡片要求弃 N 张手牌作为代价，
			 * 先弹"选 N 张弃牌"框，玩家确认后再高亮地区选空间。
			 * 否则直接高亮地区（无代价的 ECHO/EVENT 卡）。
			 */
			if (tg.cost && tg.cost.discard > 0) {
				pending_echo_discard = {
					card: pending_event_card,
					need_targets: tg,
					drop: [],
					limit: tg.cost.discard,
				}
				update_echo_discard_box()
				return
			}
			pending_event_targets = tg
			highlight_event_targets(tg)
			return
		}
		/* 兜底 */
		send_action("play_card", { card: pending_event_card.id })
		pending_event_card = null
		return
	}
}

/* ============================================================
 * 五、调试面板（验证连通性用）
 * ============================================================ */

let debug_seq = 0

function toggle_debug() {
	const el = document.getElementById("debug_panel")
	if (!el)
		return
	el.classList.toggle("hide")
	document.body.classList.toggle("debug", !el.classList.contains("hide"))
	if (el.classList.contains("hide")) {
		ui.debug_mode = null
		document.querySelectorAll("#debug_panel button").forEach(b => b.classList.remove("on"))
	}
}

function debug_place_mode() {
	ui.debug_mode = ui.debug_mode === "place" ? null : "place"
	document.getElementById("dbg_place_btn").classList.toggle("on", ui.debug_mode === "place")
	document.getElementById("dbg_remove_btn").classList.remove("on")
	set_debug_hint(ui.debug_mode === "place" ? "请点击地图上的格位放置部队" : "")
}

function debug_remove_mode() {
	ui.debug_mode = ui.debug_mode === "remove" ? null : "remove"
	document.getElementById("dbg_remove_btn").classList.toggle("on", ui.debug_mode === "remove")
	document.getElementById("dbg_place_btn").classList.remove("on")
	set_debug_hint(ui.debug_mode === "remove" ? "请点击地图上的部队移除" : "")
}

function debug_do_place(space_id) {
	const nation = document.getElementById("dbg_nation").value
	const type = document.getElementById("dbg_type").value
	const sp = data.spaces[space_id]
	if (!sp)
		return

	/* 校验：陆军只能放陆地，海军只能放海域 */
	if (type === "army" && sp.terrain !== "land") {
		set_debug_hint("陆军只能放在陆地")
		return
	}
	if (type === "navy" && sp.terrain !== "sea") {
		set_debug_hint("海军只能放在海域")
		return
	}

	const piece = `dbg_${++debug_seq}`
	send_action("debug_place", { piece: piece, nation: nation, type: type, space: space_id })
	set_debug_hint(`${nation}${TYPE_LABEL[type]} → ${sp.name}`)
}

function debug_clear() {
	send_action("debug_clear", {})
	set_debug_hint("已清空全部部队")
}

/* 结算当前行动国的断补部队 */
function debug_resolve_supply() {
	const n = view.current_nation
	if (!n) {
		set_debug_hint("未指定行动国")
		return
	}
	const before = (view.supply && view.supply.by_nation[n]) || { total: 0, ok: 0 }
	const bad = before.total - before.ok
	send_action("resolve_supply", { nation: n })
	set_debug_hint(`结算【${n}】补给：断补 ${bad} 个将被移除`)
}

/* 轮转到下一个行动国（德→英→日→苏→意→美） */
function debug_next_nation() {
	send_action("next_nation", {})
	const list = view.order_of_nations || []
	const i = list.indexOf(view.current_nation)
	set_debug_hint("行动国 → " + (list[(i + 1) % list.length] || "?"))
}

function set_debug_hint(text) {
	const el = document.getElementById("dbg_hint")
	if (el)
		el.textContent = text
}

/* ============================================================
 * 六、启动
 * ============================================================ */

/* 地图构建不依赖 view，可以立刻做（client.js 会在拿到 state 后调 on_update） */
if (document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", build_map)
else
	build_map()

"use strict"

/* global game, players */

async function post(url, next) {
	window.error.textContent = ""
	let res = await fetch(url, { method: "POST" })
	if (!res.ok) {
		window.error.textContent = res.status + " " + res.statusText
		return
	}
	let text = await res.text()
	if (text !== "SUCCESS") {
		window.error.textContent = text
		return
	}
	if (next)
		window.location.replace(next)
	else
		window.location.reload()
}

function game_delete() {
	let warning = "Are you sure you want to DELETE this game?"
	if (window.confirm(warning))
		post("/api/delete/" + game.game_id, "/games/active")
}

function game_rewind() {
	let warning = "Are you sure you want to REWIND this game to the last move?\n\nMake sure you have the consent of all the players."
	if (window.confirm(warning))
		post("/api/rewind/" + game.game_id)
}

function game_start() {
	post(`/api/start/${game.game_id}`)
}

function role_join(role) {
	post(`/api/join/${game.game_id}/${encodeURIComponent(role)}`)
}

function role_accept(role) {
	post(`/api/accept/${game.game_id}/${encodeURIComponent(role)}`)
}

function role_decline(role) {
	post(`/api/part/${game.game_id}/${encodeURIComponent(role)}`)
}

function role_part(role) {
	let warning = "Are you sure you want to LEAVE this game?"
	if (game.status === 0 || window.confirm(warning))
		post(`/api/part/${game.game_id}/${encodeURIComponent(role)}`)
}

function role_kick(role) {
	let player = players.find(p => p.role === role)
	let warning = `Are you sure you want to KICK player ${player.name} (${role}) from this game?`
	if (game.status === 0 || window.confirm(warning))
		post(`/api/part/${game.game_id}/${encodeURIComponent(role)}`)
}

var invite_role = null

function role_invite(role) {
	invite_role = role
	document.getElementById("invite").showModal()
}

function hide_invite() {
	document.getElementById("invite").close()
}

function send_invite() {
	let invite_user = document.getElementById("invite_user").value
	if (invite_user) {
		document.getElementById("invite").close()
		post(`/api/invite/${game.game_id}/${encodeURIComponent(invite_role)}/${encodeURIComponent(invite_user)}`)
	}
}

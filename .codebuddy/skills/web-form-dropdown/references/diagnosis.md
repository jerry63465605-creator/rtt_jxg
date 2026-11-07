# Diagnosis: which root cause are you hitting?

Run these probes before changing any code. Each maps to one of the five failure modes.

## Probe 1 — Are control count and input count aligned?

```js
// list every input with its owning .el-select index (or null)
(function(){
var all=[...document.querySelectorAll('input,select,textarea')];
return JSON.stringify(all.map(function(e,i){
  var w=e.closest('.el-select');
  var selIdx=-1;
  if(w){ var sels=[...document.querySelectorAll('.el-select')]; selIdx=sels.indexOf(w); }
  return {gi:i, sel:w?selIdx:null, ph:(e.placeholder||'').slice(0,20), val:(e.value||'').slice(0,16)};
}));})()
```

**If `sel` is not simply `gi - k` for a constant k → you must locate by placeholder.**
In one observed 智联 form: 12 inputs, but only 5 `.el-select`; the offset varied (3 here)
and changed as fields were added. Index-based locating is therefore unsafe.

## Probe 2 — Stale poppers

```js
(function(){
var ds=[...document.querySelectorAll('.el-select-dropdown, .ant-cascader-menus')];
return JSON.stringify(ds.map(function(d,i){
  var s=getComputedStyle(d);
  return {i:i, display:s.display, vis:d.offsetParent!==null,
          n:d.querySelectorAll('li').length,
          first:(d.querySelector('li')?(d.querySelector('li').innerText||'').trim().slice(0,12):'')};
}));})()
```

Multiple entries with `vis:true` means several panels are stacked. The "last visible"
heuristic may pick the wrong one — **clean first, then open exactly one**.
Observed: after switching fields, up to 5 leftover panels accumulated; clearing them
made the correct panel appear.

## Probe 3 — Did the click actually register?

After a native click, immediately read the panel:

```js
(function(){
var cs=[...document.querySelectorAll('.el-select-dropdown')].filter(function(d){
  return getComputedStyle(d).display!=='none' && d.offsetParent!==null;});
return cs.length ? 'open:'+cs.length : 'closed';
})()
```

`closed` right after a click ⇒ the click didn't reach the control (wrong element, or
needs native pointer events). Use the CLI native click, not `el.click()`.

**Symptom that confirms this mode:** the value stays `(空)` even though the option click
returned a success string — the click went to a detached/hidden node.

## Probe 4 — Cascading dependency

```js
// open the child field and list options
// empty list == parent not filled yet
```

An empty option list is almost never a broken picker. In Element-UI forms the option
list is fetched after the parent changes. Observed chain:
`教育类型 → 学历 → 学位`. Filling 学历 first made 学位 return its 7 options
(博士/MBA/硕士/双学士/学士/其他/无).

**Fix:** fill in dependency order; if a list is empty, go fill the parent, then retry.

## Probe 5 — Date picker won't commit

Check the input after picking:

```js
(function(){
var a=[...document.querySelectorAll('input')];
return JSON.stringify(a.filter(function(e){return /请选择.*时间/.test(e.placeholder||'');})
  .map(function(e){return (e.placeholder||'').slice(0,16)+' = '+(e.value||'(空)');}));
})()
```

Observed failures:
- A **stale date** (e.g. `2023-02-01`) appearing after "picking 2024-09" ⇒ the year click
  hit the previously highlighted year; the year table is **paginated** and must be walked.
- Panel **auto-closes after the month cell** for year-month fields ⇒ day click reports
  `no panel`, which is fine; then read back.

## Decision table

| Symptom | Root cause | Action |
|---|---|---|
| Wrong field gets the value | index mapping | locate by placeholder |
| Value stays empty after "OK" | stale popper / JS click | clean, then native click |
| Empty option list | cascade dependency | fill parent first |
| Date shows old value | paginated year table | paginate until year present, redo |
| Works 1st time, fails 2nd | residue accumulates | always run `close_all_dropdowns()` per field |

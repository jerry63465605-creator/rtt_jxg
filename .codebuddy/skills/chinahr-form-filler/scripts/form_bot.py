# -*- coding: utf-8 -*-
"""Automate chinahr application form via agent-browser CLI.

Import this module from temp runner scripts, or use the CLI shim:

    python form_bot.py --session-name chr eval "JS..."

Environment overrides:
    CHINAHR_AB    full path to agent-browser executable
                  (default: the installed exe under AppData/Roaming/npm)
    CHINAHR_SESSION  session name (default: chr)

Public helpers
--------------
run(args)                run agent-browser with this session
eval_js(js)              evaluate JS in page, return stdout (JSON-unwrapped if quoted)
js_str(text)             build ASCII single-quoted JS string literal (\\uXXXX escapes)
fill(idx, text)          set Nth input/select/textarea + fire input/change
click_input(idx)         click Nth input/select/textarea
click_selector(sel)      click first element matching CSS selector
pick_casc(idx, texts)    open cascader at Nth input, click items level by level
pick_casc_at(ci, texts)  open Nth .ant-cascader-input, click within its own container
pick_menu_in(ci, target) click exact-text item in last menu of Nth cascader container
pick_text_global(target) search ALL cascader containers (visible first) for exact-text item
pick_after_click(i, ts)  click Nth input to open its cascader, then pick_text_global each
pick_date(idx,y,m,d)     open calendar at Nth input, choose y-m-d (retries day cell)
radio(idx)               click Nth radio
close_menu()             press Escape to close open dropdowns
last_menu_items()        texts of items in last menu of last visible cascader
screenshot(path)         save full screenshot
save_section()           click last visible 保存 button; print result
read_errors()            list visible validation error texts
inputs_json()            dump all input/select/textarea descriptors
"""

import json
import os
import shutil
import subprocess
import time

# ---------------------------------------------------------------------------
# process helpers
# ---------------------------------------------------------------------------

SESSION = ["--session-name", os.environ.get("CHINAHR_SESSION", "chr")]

AB = os.environ.get("CHINAHR_AB") or (
    r"C:\Users\24968\AppData\Roaming\npm\node_modules\agent-browser"
    r"\bin\agent-browser-win32-x64.exe"
)
if not os.path.exists(AB):
    AB = shutil.which("agent-browser") or "agent-browser"


def run(args, timeout=30):
    cmd = [AB] + SESSION + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True,
                       encoding="utf-8", timeout=timeout)
    out = (r.stdout or "").strip()
    err = (r.stderr or "").strip()
    return out, err


def eval_js(js, timeout=30):
    out, err = run(["eval", js], timeout=timeout)
    if err.startswith("✗") or err.startswith("Error"):
        raise RuntimeError(err or out)
    if out.startswith('"') and out.endswith('"'):
        try:
            out = json.loads(out)
        except Exception:
            pass
    return out


def screenshot(path):
    return run(["screenshot", path])


# ---------------------------------------------------------------------------
# text / setter helpers (encoding-safe)
# ---------------------------------------------------------------------------


def js_str(text):
    """Escape text into a single-quoted JS string literal (ASCII only)."""
    out = []
    for ch in text:
        o = ord(ch)
        if ch == "\\":
            out.append("\\\\")
        elif ch == "'":
            out.append("\\'")
        elif ch == "\n":
            out.append("\\n")
        elif ch == "\r":
            out.append("\\r")
        elif 32 <= o < 127:
            out.append(ch)
        else:
            out.append("\\u%04X" % o)
    return "'" + "".join(out) + "'"


def menu_pred(text):
    """JS predicate matching li innerText exactly via char codes (encoding-safe)."""
    pred = ("function(li){var t=li.innerText.trim(); if(t.length!==%d) return false;"
            % len(text))
    for i, c in enumerate(text):
        pred += " if(t.charCodeAt(%d)!==%d) return false;" % (i, ord(c))
    pred += " return true;}"
    return pred


SETTER = """(function(){
function set(el,v){var d=Object.getOwnPropertyDescriptor(el.__proto__,'value');
if(d&&d.set){d.set.call(el,v)}else{el.value=v;}
el.dispatchEvent(new Event('input',{bubbles:true}));
el.dispatchEvent(new Event('change',{bubbles:true}));}
var all=document.querySelectorAll('input,select,textarea');
set(all[%d], %s);
return all[%d].value;})()"""


def fill(idx, text):
    js = SETTER % (idx, js_str(text), idx)
    return eval_js(js)


def click_input(idx):
    return eval_js(
        "(function(){var all=document.querySelectorAll('input,select,textarea');"
        "all[%d].click(); return 'clicked';})()" % idx
    )


def click_selector(sel):
    return eval_js(
        "(function(){var e=document.querySelector(%s); if(!e) return 'nf'; e.click(); return 'ok';})()"
        % json.dumps(sel, ensure_ascii=True)
    )


def radio(idx):
    return eval_js(
        "(function(){var rs=document.querySelectorAll('input[type=radio]'); rs[%d].click();"
        "return rs[%d].checked;})()" % (idx, idx)
    )


def close_menu():
    run(["press", "Escape"])
    time.sleep(0.2)


def close_all(n=3):
    for _ in range(n):
        run(["press", "Escape"])
        time.sleep(0.2)


# ---------------------------------------------------------------------------
# cascader helpers
# ---------------------------------------------------------------------------


def last_menu_items():
    js = """(function(){var cs=[...document.querySelectorAll('.ant-cascader-menus')]
.filter(function(c){return c.offsetParent!==null;});
if(!cs.length) return JSON.stringify([]);
var m=cs[cs.length-1].querySelectorAll('.ant-cascader-menu');
var last=m[m.length-1]; if(!last) return JSON.stringify([]);
return JSON.stringify([...last.querySelectorAll('li')]
.map(function(li){return li.innerText.trim();}));})()"""
    out = eval_js(js)
    try:
        return json.loads(out)
    except Exception:
        return []


def pick_menu(pred_or_index):
    """Click exact-text item (or Nth item) in last menu of last visible container."""
    js = """(function(){var cs=[...document.querySelectorAll('.ant-cascader-menus')]
.filter(function(c){return c.offsetParent!==null;});
if(!cs.length) return 'no menu container';
var m=cs[cs.length-1].querySelectorAll('.ant-cascader-menu');
var last=m[m.length-1]; if(!last) return 'no menu';
var lis=[...last.querySelectorAll('li')];
var p=%s; var idx=-1;
if(typeof p==='number'){idx=p;}else{idx=lis.findIndex(p);}
if(idx<0||idx>=lis.length) return 'notfound:'+lis.length;
lis[idx].click(); return 'picked:'+lis[idx].innerText.trim();})()""" % (
        pred_or_index if isinstance(pred_or_index, int) else menu_pred(pred_or_index))
    return eval_js(js)


def pick_menu_in(container_idx, target):
    """Click item in Nth cascader's menu container (last level)."""
    js = """(function(){
var c=document.querySelectorAll('.ant-cascader-menus')[%d];
if(!c) return 'no container:'+document.querySelectorAll('.ant-cascader-menus').length;
var ms=c.querySelectorAll('.ant-cascader-menu');
var last=ms[ms.length-1]; if(!last) return 'no menu';
var lis=[...last.querySelectorAll('li')];
var p=%s; var idx=lis.findIndex(p);
if(idx<0) return 'notfound:'+lis.map(function(li){return li.innerText.trim();}).join(',');
lis[idx].click(); return 'picked:'+lis[idx].innerText.trim();})()""" % (
        container_idx,
        ("function(li){return true;}" if isinstance(target, int) else menu_pred(target)))
    return eval_js(js)


def pick_casc_at(casc_input_idx, texts):
    """Open Nth cascader input and pick items level by level in its own container."""
    js = ("(function(){var cs=document.querySelectorAll('input.ant-cascader-input');"
          " if(!cs[%d]) return 'nf casc'; cs[%d].click(); return 'opened:'+cs.length;})()"
          % (casc_input_idx, casc_input_idx))
    print(" ", eval_js(js))
    time.sleep(0.5)
    for t in texts:
        print(" ", pick_menu_in(casc_input_idx, t))
        time.sleep(0.5)


def pick_text_global(target):
    """Search ALL cascader menu containers for an li matching target; click it.
    Prefers visible containers. target: str (exact) or int (index)."""
    if isinstance(target, int):
        pred = "function(li){return true;}"
        find_by_idx = "true"
    else:
        pred = menu_pred(target)
        find_by_idx = "false"
    js = """(function(){
var conts=[...document.querySelectorAll('.ant-cascader-menus')];
var hits=[];
conts.forEach(function(c,ci){
  var ms=c.querySelectorAll('.ant-cascader-menu');
  var last=ms[ms.length-1]; if(!last) return;
  var lis=[...last.querySelectorAll('li')];
  var idx=%s;
  if(idx>=0) hits.push({ci:ci, vis:c.offsetParent!==null, li:lis[idx], n:lis.length});
});
if(!hits.length) return 'notfound anywhere';
hits.sort(function(a,b){return (b.vis?1:0)-(a.vis?1:0);});
hits[0].li.click();
return 'picked in c'+hits[0].ci+' (vis='+hits[0].vis+'): '+hits[0].li.innerText.trim();})()""" % (
        (str(target) if find_by_idx == "true"
         else "lis.findIndex(%s)" % pred))
    return eval_js(js)


def pick_after_click(input_idx, targets, label=""):
    """Click an input to open its cascader, then pick items globally."""
    click_input(input_idx)
    time.sleep(0.6)
    for t in targets:
        print("  [%s]" % label, pick_text_global(t))
        time.sleep(0.6)


def pick_casc(idx, texts):
    """Open cascader at input idx and click items by exact text, level by level."""
    click_input(idx)
    time.sleep(0.4)
    for t in texts:
        print("  pick:", pick_menu(t))
        time.sleep(0.4)


# ---------------------------------------------------------------------------
# calendar date helper
# ---------------------------------------------------------------------------

MONTH_CELLS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月",
               "八月", "九月", "十月", "十一月", "十二月"]


def pick_date(idx, y, m, d):
    """Open calendar at Nth input; pick year/month/day. Retries day cell."""
    click_input(idx)
    time.sleep(0.5)
    click_selector(".ant-calendar-year-select")
    time.sleep(0.4)
    pred = "function(e){var t=e.innerText.trim(); return t==='%d';}" % y
    js = ("(function(){var cells=[...document.querySelectorAll('[class*=year-panel] td, "
          "[class*=year-panel] li')]; var c=cells.find(%s); if(!c) return 'nf year';"
          " c.click(); return 'y';})()" % pred)
    print(" ", eval_js(js))
    time.sleep(0.4)
    click_selector(".ant-calendar-month-select")
    time.sleep(0.4)
    mn = MONTH_CELLS[m - 1]
    js = ("(function(){var mp=document.querySelector('.ant-calendar-month-panel, [class*=month-panel]');"
          " if(!mp) return 'no mp'; var cells=[...mp.querySelectorAll('td, li')];"
          " var c=cells.find(function(e){var t=e.innerText.trim(); if(t.length!==%d) return false;"
          % len(mn))
    for i, ch in enumerate(mn):
        js += " if(t.charCodeAt(%d)!==%d) return false;" % (i, ord(ch))
    js += (" return true;}); if(!c) return 'nf month'; c.click(); return 'm';})()")
    print(" ", eval_js(js))
    time.sleep(0.4)
    js = """(function(){
var all=document.querySelectorAll('input,select,textarea');
for(var k=0;k<4;k++){
  var c=document.querySelector('.ant-calendar');
  if(c){
    var tds=[...c.querySelectorAll('.ant-calendar-tbody td')]
      .filter(function(td){var t=td.innerText.trim(); return t==='%d' && !/last-month|next-month/.test(td.className);});
    if(tds.length){tds[0].click(); return 'd='+all[%d].value;}
  }
  var s=Date.now(); while(Date.now()-s<400){}
}
return 'nf day';})()""" % (d, idx)
    print(" ", eval_js(js))
    time.sleep(0.3)


# ---------------------------------------------------------------------------
# page structure / buttons
# ---------------------------------------------------------------------------


def inputs_json():
    js = """(function(){var a=document.querySelectorAll('input,select,textarea');
return JSON.stringify([...a].map(function(el,i){return {i:i,tag:el.tagName,
ph:(el.placeholder||'').slice(0,10),ro:el.readOnly,cls:(el.className||'').toString().slice(0,25)};}));})()"""
    out = eval_js(js)
    try:
        return json.loads(out)
    except Exception:
        return []


def save_section():
    """Click last visible 保存 button."""
    js = ("(function(){var bs=[...document.querySelectorAll('button')].filter(function(b){"
          "return b.offsetParent!==null && b.innerText.trim().charCodeAt(0)===0x4FDD;});"
          "if(!bs.length) return 'no save btn'; bs[bs.length-1].click(); return 'save clicked:'+bs.length;})()")
    out = eval_js(js)
    print(out)
    time.sleep(1.0)
    return out


def read_errors():
    js = ("(function(){var es=[...document.querySelectorAll('[class*=error], [class*=Error],"
          " .ant-form-explain')].filter(function(e){return e.offsetParent!==null;});"
          "return JSON.stringify(es.map(function(e){return e.innerText.trim().slice(0,60);}));})()")
    out = eval_js(js)
    print(out)
    try:
        return json.loads(out)
    except Exception:
        return []


def click_paragraph(text):
    """Click a visible <p>/<div>/<span> whose text equals text exactly."""
    js = "(function(){var els=[...document.querySelectorAll('p,div,span')];" \
         "var els2=els.filter(function(e){var s=(e.innerText||'').replace(/\\s/g,'');" \
         "if(s.length!==%d) return false;" % len(text)
    for i, c in enumerate(text):
        js += "if(s.charCodeAt(%d)!==%d) return false;" % (i, ord(c))
    js += ("return e.offsetParent!==null && e.children.length<=2;});"
           "if(!els2.length) return 'nf';"
           "var e=els2[els2.length-1]; e.click(); return 'clicked:'+e.tagName;})()")
    return eval_js(js)


def click_add_em(index=0):
    """Click Nth visible <em>添加</em> button."""
    js = ("(function(){var els=[...document.querySelectorAll('em')].filter(function(e){"
          "var s=(e.innerText||'').trim(); return s.length===2 && s.charCodeAt(0)===0x6DFB "
          "&& s.charCodeAt(1)===0x52A0 && e.offsetParent!==null;});"
          "var k=%d; if(els.length<=k) return 'nf:'+els.length; els[k].click(); "
          "return 'clicked:'+k+'/'+els.length;})()" % index)
    out = eval_js(js)
    time.sleep(0.7)
    return out


def inputs_count():
    return int(eval_js(
        "(function(){return document.querySelectorAll('input,select,textarea').length;})()"))


if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    if args:
        # CLI shim: `python form_bot.py eval "JS"` etc.
        out, err = run(args)
        print(out)
        if err:
            print("STDERR:", err, file=sys.stderr)

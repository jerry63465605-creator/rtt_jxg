# -*- coding: utf-8 -*-
"""
Verified dropdown-filling workflow for Element-UI / Ant-Design Chinese resume forms.

THE FIXED FLOW (per dropdown):
    1. close_all_dropdowns()          # body click + Escape x2
    2. tag_by_placeholder(ph)         # locate the ONE target control
    3. native click [data-dd="1"]     # real pointer events
    4. visible_opts()                 # read option texts
    5. pick_exact(text)               # exact-text click
    6. read_value(ph)                 # read back
    7. retry whole loop if mismatch

Why each rule exists is documented in SKILL.md. Do not skip step 1 or 6.

Usage:
    from dropdown import set_select
    set_select("请选择您的学历", "硕士研究生", "学历")

The module needs an `ev(js)` / `raw(args)` pair that talks to agent-browser.
By default it imports them from the local `_auto.py` shim (see AUTO_SHIM below);
override by calling `configure(ev=..., raw=...)` before use.
"""

import json
import time

_ev = None
_raw = None


def configure(ev, raw):
    """Inject the agent-browser eval/run functions."""
    global _ev, _raw
    _ev, _raw = ev, raw


def _require():
    if _ev is None or _raw is None:
        raise RuntimeError("call configure(ev, raw) first, or provide an _auto shim")


def ev(js):
    _require()
    return _ev(js)


def raw(args):
    _require()
    return _raw(args)


# --------------------------------------------------------------------------
# primitives
# --------------------------------------------------------------------------

def close_all_dropdowns():
    """Dismiss every open popper.

    Element-UI keeps poppers mounted; a leftover panel is the main cause of
    'the wrong dropdown opened'. body click + Escape is the reliable combo.
    """
    ev("(function(){document.body.click(); return 'x';})()")
    time.sleep(0.2)
    for _ in range(2):
        raw(["press", "Escape"])
        time.sleep(0.15)


def tag_by_placeholder(ph_part):
    """Mark the visible control whose placeholder contains ph_part.

    NEVER locate a dropdown by global input index: .el-select count and
    input count differ, so 'the Nth input' is frequently the wrong widget.
    The placeholder is the only stable identity.
    """
    js = """(function(ph){
    document.querySelectorAll('[data-dd]').forEach(function(e){ e.removeAttribute('data-dd'); });
    var a=[...document.querySelectorAll('input,select,textarea')];
    for(var i=0;i<a.length;i++){
      var p=(a[i].placeholder||'');
      if(p.indexOf(ph)>=0 && a[i].offsetParent!==null){
        a[i].setAttribute('data-dd','1');
        a[i].scrollIntoView({block:'center'});
        return 'tagged:'+i+':'+p;
      }
    }
    return 'NF placeholder='+ph;
    })( %s )""" % json.dumps(ph_part)
    return ev(js)


def visible_opts():
    """Option texts of the last VISIBLE dropdown panel."""
    js = """(function(){
    var cs=[...document.querySelectorAll('.el-select-dropdown, .ant-select-dropdown')].filter(function(d){
      var s=getComputedStyle(d); return s.display!=='none' && d.offsetParent!==null;});
    if(!cs.length) return '[]';
    var c=cs[cs.length-1];
    return JSON.stringify([...c.querySelectorAll('li')].map(function(x){return (x.innerText||'').trim();}));
    })()"""
    try:
        return json.loads(ev(js))
    except Exception:
        return []


def pick_exact(text):
    """Exact-text click in the last visible panel (char-code match, encoding-safe)."""
    js = """(function(codes){
    var want=String.fromCharCode.apply(null,codes);
    var cs=[...document.querySelectorAll('.el-select-dropdown, .ant-select-dropdown')].filter(function(d){
      var s=getComputedStyle(d); return s.display!=='none' && d.offsetParent!==null;});
    if(!cs.length) return 'NO_DROP';
    var lis=[...cs[cs.length-1].querySelectorAll('li')];
    for(var k=0;k<lis.length;k++){
      var t=(lis[k].innerText||'').trim();
      if(t===want){ lis[k].click(); return 'OK '+t; }
    }
    return 'NF :: '+lis.slice(0,20).map(function(x){return (x.innerText||'').trim();}).join('/');
    })( %s )""" % json.dumps([ord(c) for c in text])
    return ev(js)


def read_value(ph_part):
    """Read back the control's committed value (verification is mandatory)."""
    js = """(function(ph){
    var a=[...document.querySelectorAll('input,select,textarea')];
    for(var i=0;i<a.length;i++){
      if((a[i].placeholder||'').indexOf(ph)>=0 && a[i].offsetParent!==null) return (a[i].value||'(空)');
    }
    return 'NF';})( %s )""" % json.dumps(ph_part)
    return ev(js)


# --------------------------------------------------------------------------
# main entry
# --------------------------------------------------------------------------

def set_select(ph_part, text, name="", tries=3, verbose=True):
    """Complete verified flow for one dropdown. Returns the committed value or None."""
    for t in range(tries):
        close_all_dropdowns()

        tagr = tag_by_placeholder(ph_part)
        if tagr.startswith("NF"):
            if verbose:
                print("  [%s] %s" % (name or ph_part, tagr))
            return None

        raw(["click", "[data-dd='1']"])
        time.sleep(1.3)

        opts = visible_opts()
        if verbose:
            print("  [%s] 选项(%d): %s" % (name or ph_part, len(opts), " | ".join(opts[:12])))

        if not opts:
            # empty list == dependency not satisfied (fill the parent field first)
            if verbose:
                print("  [%s] 选项为空 → 检查级联依赖（父字段是否已填）" % (name or ph_part))
            time.sleep(0.6)
            continue

        r = pick_exact(text)
        time.sleep(0.9)

        val = read_value(ph_part)
        if val == text:
            if verbose:
                print("  [%s] OK %s" % (name or ph_part, val))
            return val

        if verbose:
            print("  [%s] try%d 未生效: pick=%s val=%s" % (name or ph_part, t, r, val))

    if verbose:
        print("  [%s] FAILED (last val=%s)" % (name or ph_part, read_value(ph_part)))
    return None


def set_selects(pairs, verbose=True):
    """Fill several dropdowns IN ORDER (respect cascading dependencies).

    pairs: [(placeholder_part, target_text, display_name), ...]
    """
    results = {}
    for ph, text, name in pairs:
        results[name] = set_select(ph, text, name, verbose=verbose)
    return results


def verify(pairs):
    """Print current values for a list of (placeholder_part, display_name)."""
    for ph, name in pairs:
        print("  %s = %s" % (name, read_value(ph)))


# --------------------------------------------------------------------------
# AUTO_SHIM: optional convenience loader
# --------------------------------------------------------------------------

def auto_configure(session_name, ab_exe=None):
    """Wire up the common agent-browser subprocess transport.

    ab_exe defaults to the installed native executable.
    """
    import subprocess

    AB = ab_exe or (
        r"C:\Users\24968\AppData\Roaming\npm\node_modules\agent-browser"
        r"\bin\agent-browser-win32-x64.exe"
    )
    S = ["--session-name", session_name]

    def _ev(js, timeout=40):
        r = subprocess.run([AB] + S + ["eval", js], capture_output=True,
                           text=True, encoding="utf-8", timeout=timeout)
        out = (r.stdout or "").strip()
        if out.startswith('"') and out.endswith('"'):
            try:
                out = json.loads(out)
            except Exception:
                pass
        return out

    def _raw(args, timeout=90):
        r = subprocess.run([AB] + S + list(args), capture_output=True,
                           text=True, encoding="utf-8", timeout=timeout)
        return ((r.stdout or "").strip(), (r.stderr or "").strip())

    configure(_ev, _raw)
    return _ev, _raw


if __name__ == "__main__":
    import sys
    if len(sys.argv) >= 3:
        auto_configure(sys.argv[1])
        print(set_select(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else ""))

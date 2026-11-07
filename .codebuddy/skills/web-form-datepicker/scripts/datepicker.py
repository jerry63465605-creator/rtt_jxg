#!/usr/bin/env python3
"""
datepicker.py — verified date-picker driver for Element-UI / Ant Design
web forms, driven through the `agent-browser` CLI.

WHY THIS EXISTS
---------------
Naive automation of these pickers fails in three distinct ways, all
diagnosed in practice (2026-10-13, 智联招聘 / Moka credit-guarantee form):

1. JS-synthesised clicks do NOT work on the year/month/day cells.
   `el.dispatchEvent(new MouseEvent('click'))` opens the panel fine when
   fired on the *input*, but the cells ignore it completely -> the panel
   never changes view and the field stays empty. The user sees
   "点了没反应 / 卡住了". Cells REQUIRE a real CDP pointer event.

2. Chinese selectors are destroyed by the Windows PowerShell (GBK) layer.
   Passing `input[placeholder='请选择您的入学时间']` on the command line
   mangles the CJK into mojibake -> "Element not found".
   => Use ASCII-only CSS class selectors + numeric indices.

3. Every open creates a NEW panel; closed panels stay in the DOM with
   offsetParent === null. So a NodeList like `.el-year-table td` contains
   2 panels x 12 cells = 24 nodes, and the visible one is the LATTER half.
   Clicking a "logical" index (e.g. year 2026 -> 6) hits the dead panel,
   silently no-ops, and the outside-click closes the whole picker.
   => Always probe the visible panel's GLOBAL index (filter by
      offsetParent !== null) before every click.

THE CONTRACT
------------
This module shells out to `agent-browser` with `--session-name <sess>`.
It never uses eval-based clicking for cells. All cell clicks go through
`find nth <globalIdx> <selector> click` (a real CDP click).

Usage (as a library):
    dp = DatePicker(session="default")
    dp.open(".apply-form-date input", nth=0)      # click the field
    dp.set_date(2024, 9, 1)                        # drive year->month->day
    assert dp.read("请选择您的入学时间") == "2024-09-01"

Usage (as a CLI, for manual poking):
    python datepicker.py probe <session>
    python datepicker.py set <session> <fieldSel> <nth> <YYYY-MM-DD>
"""

import json
import subprocess
import sys
import time

AB = ["npx", "--yes", "agent-browser"]

# ---------------------------------------------------------------- low level


def _run(args, stdin_text=None):
    """Run an agent-browser command, return (rc, stdout, stderr)."""
    p = subprocess.run(
        AB + args,
        input=stdin_text,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return p.returncode, p.stdout or "", p.stderr or ""


class DatePicker:
    def __init__(self, session="default", wait=0.45):
        self.session = session
        self.wait = wait

    # -- eval helper -------------------------------------------------------
    def ev(self, js):
        """Evaluate JS via --stdin (safe for CJK; never via argv)."""
        rc, out, err = _run(
            ["--session-name", self.session, "eval", "--stdin"], stdin_text=js
        )
        if "Evaluation error" in err or "Evaluation error" in out:
            raise RuntimeError("eval failed: %s\n%s" % (js[:200], (err or out)[:400]))
        s = out.strip()
        # agent-browser wraps the result in a JSON string; unwrap once.
        try:
            return json.loads(s)
        except Exception:
            return s

    def click(self, selector, nth=None):
        """REAL CDP click. `nth` uses find nth (0-based) on a NodeList."""
        if nth is None:
            args = ["--session-name", self.session, "click", selector]
        else:
            args = [
                "--session-name", self.session,
                "find", "nth", str(nth), selector, "click",
            ]
        rc, out, err = _run(args)
        if "Element not found" in (out + err):
            raise RuntimeError("click target not found: %s [%s]" % (selector, nth))
        time.sleep(self.wait)
        return out

    # -- panel introspection ----------------------------------------------

    #: class-name fragments of every picker panel flavour we have seen
    PANEL_SEL = (
        ".el-picker-panel.el-date-picker, "
        ".ant-calendar-picker-container, "
        "[class*='apply-form-date'] .el-picker-panel"
    )

    def visible_panel(self):
        """Return {left,top,text} of the single visible panel, or None."""
        js = r"""
        (function(){
          var ps = document.querySelectorAll('.el-picker-panel.el-date-picker');
          for (var i=0;i<ps.length;i++){
            if (ps[i].offsetParent!==null){
              var r = ps[i].getBoundingClientRect();
              return JSON.stringify({left:Math.round(r.left),top:Math.round(r.top),
                text:(ps[i].innerText||'').slice(0,80).replace(/\n/g,'|')});
            }
          }
          return 'NONE';
        })()
        """
        v = self.ev(js)
        if v in ("NONE", "", None) or (isinstance(v, str) and v.startswith("NONE")):
            return None
        return json.loads(v) if isinstance(v, str) else v

    def _globals(self, sel, want=None):
        """
        List the visible cells of `sel`, with their GLOBAL index in the
        NodeList (the index you must hand to `find nth`). Optionally filter
        to a set of cell texts.
        Returns [(globalIdx, text, extraCls), ...]
        """
        js = r"""
        (function(sel,want){
          var all = document.querySelectorAll(sel);
          var out = [];
          for (var i=0;i<all.length;i++){
            var el = all[i];
            if (el.offsetParent===null) continue;
            var t = (el.textContent||'').trim();
            if (!t) continue;
            if (want && want.length && want.indexOf(t)<0) continue;
            out.push({i:i,t:t,c:String(el.className).slice(0,40)});
          }
          return JSON.stringify(out);
        })(%s, %s)
        """ % (json.dumps(sel), json.dumps(want or []))
        return json.loads(self.ev(js) or "[]")

    def _header_labels(self):
        """Visible header labels (year / month). Returns [(idx,text)]."""
        js = r"""
        (function(){
          var a = document.querySelectorAll('.el-date-picker__header-label');
          var o = [];
          for (var i=0;i<a.length;i++){
            if (a[i].offsetParent!==null) o.push({i:i,t:a[i].textContent.trim()});
          }
          return JSON.stringify(o);
        })()
        """
        return json.loads(self.ev(js) or "[]")

    # -- the workflow ------------------------------------------------------

    def open(self, field_sel, nth=None):
        """Click a date field to open its panel. Returns True if it opened."""
        self.click(field_sel, nth)
        time.sleep(self.wait)
        return self.visible_panel() is not None

    def click_year(self, year):
        """From the DAY view, switch to year view and pick `year`."""
        # 1. header must currently show the year view entry point
        labs = self._header_labels()
        ylab = next((l for l in labs if "年" in l["t"]), None)
        if ylab is None:
            raise RuntimeError("no 年 header label — panel not on day view?")
        # if the header already says the right year, still need month step
        if ylab["t"].replace(" ", "").rstrip("年") != str(year):
            self.click(".el-date-picker__header-label", ylab["i"])
            time.sleep(self.wait)
            cells = self._globals(
                ".el-picker-panel.el-date-picker .el-year-table td", [str(year)]
            )
            if not cells:
                raise RuntimeError("year %s not in year table" % year)
            self.click(
                ".el-picker-panel.el-date-picker .el-year-table td", cells[0]["i"]
            )
            time.sleep(self.wait)
        return True

    def click_month(self, month):
        """From the MONTH view, pick `month` (1-12)."""
        CN = ["一月", "二月", "三月", "四月", "五月", "六月",
              "七月", "八月", "九月", "十月", "十一月", "十二月"]
        names = [CN[month - 1]]
        # make sure we are in the month view
        cells = self._globals(
            ".el-picker-panel.el-date-picker .el-month-table td", names
        )
        if not cells:
            labs = self._header_labels()
            mlab = next((l for l in labs if "月" in l["t"]), None)
            if mlab is not None:
                self.click(".el-date-picker__header-label", mlab["i"])
                time.sleep(self.wait)
                cells = self._globals(
                    ".el-picker-panel.el-date-picker .el-month-table td", names
                )
        if not cells:
            raise RuntimeError("month %s not selectable" % month)
        self.click(".el-picker-panel.el-date-picker .el-month-table td", cells[0]["i"])
        time.sleep(self.wait)
        return True

    def click_day(self, day):
        """From the DAY view, pick `day` of the CURRENTLY shown month."""
        cells = self._globals(
            ".el-picker-panel.el-date-picker .el-date-table td", [str(day)]
        )
        # a day number can appear as prev-month / current / next-month; we
        # want the one whose class is a bare 'available' (current month).
        cur = [c for c in cells if "prev-month" not in c["c"] and "next-month" not in c["c"]]
        if not cur:
            cur = cells
        if not cur:
            raise RuntimeError("day %s not in current month view" % day)
        self.click(".el-picker-panel.el-date-picker .el-date-table td", cur[0]["i"])
        time.sleep(self.wait)
        return True

    def set_date(self, y, m, d):
        """Full year -> month -> day drive. Assumes a panel is already open."""
        self.click_year(y)
        self.click_month(m)
        self.click_day(d)
        return self.read_visible_field()

    # -- verification ------------------------------------------------------

    def read(self, placeholder_part):
        """Read a field's value by (partial) placeholder. '' means empty."""
        js = r"""
        (function(p){
          var a = document.querySelectorAll('input,textarea');
          for (var i=0;i<a.length;i++){
            if ((a[i].placeholder||'').indexOf(p)>=0 && a[i].offsetParent!==null)
              return a[i].value || '';
          }
          return 'NF';
        })(%s)
        """ % json.dumps(placeholder_part)
        return self.ev(js)

    def read_all_date_fields(self):
        """Return [{'ph':..,'v':..}...] for every visible date-looking input."""
        js = r"""
        (function(){
          var o=[];
          document.querySelectorAll('input').forEach(function(i){
            var ph=i.placeholder||'';
            if (/时间|日期|date/i.test(ph) && i.offsetParent!==null)
              o.push({ph:ph,v:i.value||''});
          });
          return JSON.stringify(o);
        })()
        """
        return json.loads(self.ev(js) or "[]")

    def read_visible_field(self):
        """Best-effort: return values of all visible date fields."""
        return self.read_all_date_fields()


# --------------------------------------------------------------------- cli


def _cli():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    cmd, sess = sys.argv[1], sys.argv[2]
    dp = DatePicker(session=sess)
    if cmd == "probe":
        print("panel:", dp.visible_panel())
        print("fields:", json.dumps(dp.read_all_date_fields(), ensure_ascii=False))
    elif cmd == "set":
        field_sel, nth, ymd = sys.argv[3], int(sys.argv[4]), sys.argv[5]
        y, m, d = (int(x) for x in ymd.split("-"))
        if not dp.open(field_sel, nth):
            print("FAILED to open panel")
            return 2
        print("after set:", dp.set_date(y, m, d))
    else:
        print("unknown cmd", cmd)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(_cli())

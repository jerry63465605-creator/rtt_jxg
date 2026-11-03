"""对比：当前 rules.js vs HEAD 版本 的 test_basic_cards 失败项，判断是否为既有失败。
安全：先把当前 rules.js 二进制备份到 rules.js.mine，测完无条件还原。
"""
import subprocess, io, os, shutil, sys

ROOT = r'C:\Users\24968\Desktop\rtt'
REL = 'server-official/public/quartermaster-sub-wars/rules.js'
P = os.path.join(ROOT, REL)
BAK = P + '.mine'
MARK = chr(0x2717)


def run_test():
    r = subprocess.run(['node', 'tools/test_basic_cards.js'], cwd=ROOT,
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    out = (r.stdout or '') + (r.stderr or '')
    return [l.strip() for l in out.split('\n') if MARK in l]


# 1) 备份当前
shutil.copyfile(P, BAK)
print('已备份当前 rules.js ->', BAK)
cur = run_test()
print('\n=== 当前版本 失败 %d 项 ===' % len(cur))
for l in cur:
    print('  ' + l.replace(MARK, 'X'))

try:
    # 2) 写入 HEAD 版本（原始字节，避免编码被改）
    r = subprocess.run(['git', 'show', 'HEAD:' + REL], cwd=ROOT, capture_output=True)
    if r.returncode != 0 or not r.stdout:
        print('!! git show 失败:', r.stderr.decode('utf-8', 'replace')[:200])
    else:
        io.open(P, 'wb').write(r.stdout)
        base = run_test()
        print('\n=== HEAD 基线 失败 %d 项 ===' % len(base))
        for l in base:
            print('  ' + l.replace(MARK, 'X'))
        print('\n=== 结论 ===')
        if len(base) == len(cur) and set(base) == set(cur):
            print('两套失败项完全一致 => 这 %d 项是【改动前既有】失败，与本次无关' % len(base))
        else:
            print('不一致！仅在当前出现的：')
            for l in cur:
                if l not in base:
                    print('   + ' + l.replace(MARK, 'X'))
            print('仅在 HEAD 出现的：')
            for l in base:
                if l not in cur:
                    print('   - ' + l.replace(MARK, 'X'))
finally:
    # 3) 无条件还原
    shutil.copyfile(BAK, P)
    os.remove(BAK)
    print('\n已还原当前 rules.js，删除备份')

$ErrorActionPreference='Stop'
# 1) 杀旧服务器
$p=(Get-NetTCPConnection -LocalPort 8091 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if($p){taskkill /PID $p /F | Out-Null; Write-Output ('killed old pid ' + $p)}

# 2) 打补丁 + 立即确认 DB
Set-Location c:\Users\24968\Desktop\rtt
node tools/_patch_game19.js
Write-Output '--- DB 确认(重启前) ---'
node tools/_read_g19.js

# 3) 启动新服务器
Set-Location c:\Users\24968\Desktop\rtt\server-official
$env:RTT_PORT='8091'
Start-Process -FilePath node -ArgumentList server.js -WindowStyle Hidden -RedirectStandardOutput tools/_rtt_server.out -RedirectStandardError tools/_rtt_server.err
Start-Sleep -Seconds 5
$np=(Get-NetTCPConnection -LocalPort 8091 -State Listen -ErrorAction SilentlyContinue).OwningProcess
Write-Output ('new pid ' + $np)

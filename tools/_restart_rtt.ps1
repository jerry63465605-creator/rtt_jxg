$ErrorActionPreference='Stop'
$p=(Get-NetTCPConnection -LocalPort 8091 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if($p){taskkill /PID $p /F | Out-Null; Write-Output ('killed old pid ' + $p)} else {Write-Output 'no 8091 listener'}
Set-Location c:\Users\24968\Desktop\rtt\server-official
$env:RTT_PORT='8091'
Start-Process -FilePath node -ArgumentList server.js -WindowStyle Hidden -RedirectStandardOutput tools/_rtt_server.out -RedirectStandardError tools/_rtt_server.err
Start-Sleep -Seconds 5
$np=(Get-NetTCPConnection -LocalPort 8091 -State Listen -ErrorAction SilentlyContinue).OwningProcess
Write-Output ('new pid ' + $np)

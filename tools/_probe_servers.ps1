$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'"
Write-Output "=== node processes ==="
foreach ($p in $procs) {
    $cmd = $p.CommandLine
    if ($cmd -match 'server\.js') {
        Write-Output ($p.ProcessId.ToString() + ' | ' + $cmd)
    }
}
Write-Output "=== listening ports (rtt candidates) ==="
$listeners = Get-NetTCPConnection -State Listen
foreach ($l in $listeners) {
    if ($l.LocalPort -in @(8080,8081,8090,8091,8092,3000,5000)) {
        $owner = (Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue).Name
        Write-Output ($l.LocalPort.ToString() + ' <- pid ' + $l.OwningProcess.ToString() + ' (' + $owner + ')')
    }
}

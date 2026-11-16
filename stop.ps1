# ============================================================================
# VektorMesh PowerShell Stopper
# Terminates processes bound to VektorMesh ports: 3000, 4000, 8000, 8080, 9090, 50052
# ============================================================================
$ports = @(3000, 4000, 8000, 8080, 9090, 50052)
$stoppedPids = @()

Write-Host "Stopping VektorMesh services on ports: $($ports -join ', ')..." -ForegroundColor Yellow

foreach ($port in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($conn in $conns) {
                $pId = $conn.OwningProcess
                if ($pId -and ($stoppedPids -notcontains $pId)) {
                    $proc = Get-Process -Id $pId -ErrorAction SilentlyContinue
                    if ($proc) {
                        Write-Host "  Stopping process: $($proc.ProcessName) (PID: $pId, Port: $port)" -ForegroundColor Red
                        Stop-Process -Id $pId -Force -ErrorAction SilentlyContinue
                        $stoppedPids += $pId
                    }
                }
            }
        }
    } catch {
        # continue
    }
}

if ($stoppedPids.Count -eq 0) {
    Write-Host "No active VektorMesh service processes found." -ForegroundColor Green
} else {
    Write-Host "Successfully stopped $($stoppedPids.Count) service process(es)." -ForegroundColor Green
}

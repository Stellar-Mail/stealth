$branch='fix/device-management-ci-v2'
$repo='Stellar-Mail/stealth'
$timeout=600
$start=Get-Date
Write-Output "Polling for branch $branch up to $timeout seconds"
while (((Get-Date) - $start).TotalSeconds -lt $timeout) {
  $o = gh run list --repo $repo --branch $branch --limit 1 2>$null
  if ($o) {
    $line = ($o -split "`n")[0]
    $cols = $line -split '\\s+'
    $id = $cols[0]
    $status = $cols[4]
    $conclusion = if ($cols.Length -gt 5) { $cols[5] } else { '' }
    Write-Output "Latest run: id=$id status=$status conclusion=$conclusion"
    if ($status -eq 'completed') {
      Write-Output "Run completed — details:"
      gh run view $id --repo $repo
      exit 0
    }
  }
  Start-Sleep -Seconds 10
}
Write-Output "Timeout waiting for run to complete"
exit 2
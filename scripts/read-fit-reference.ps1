# Read-only extraction of NACHI's published numeric reference (no files written).
param([string]$Page = 'https://nachi-tool.jp/bearing/appe_table2.html')
$html = (Invoke-WebRequest -Uri $Page).Content
$records = [ordered]@{}
$codes = @()
foreach ($row in [regex]::Matches($html, '(?s)<tr\b.*?</tr>')) {
  $cells = @([regex]::Matches($row.Value, '(?s)<t[dh]\b[^>]*>(.*?)</t[dh]>') | ForEach-Object {
    [System.Net.WebUtility]::HtmlDecode(($_.Groups[1].Value -replace '(?s)<[^>]*>', ' ')).Trim()
  })
  if ($cells.Count -gt 1 -and $cells[0] -match 'Dimension') {
    $codes = @($cells | Select-Object -Skip 1)
    foreach ($code in $codes) { if ($code -cmatch '^(d6|e6|e13|f5|f6|g5|g6|h[4-9]|h10|h11|h13|js[4-7]|j[5-7]|k[5-7]|m[5-7]|n[5-7]|p[5-7]|F[6-8]|G[67]|H[6-9]|H10|H11|H13|Js[67])$' -and !$records.Contains($code)) { $records[$code] = [System.Collections.Generic.List[object]]::new() } }
    continue
  }
  if (!$codes.Count -or $cells.Count -ne (2 + 2 * $codes.Count) -or $cells[0] -notmatch '^\d') { continue }
  $from = @([regex]::Matches($cells[0], '\d+(?:\.\d+)?') | ForEach-Object { [double]$_.Value })
  $to = @([regex]::Matches($cells[1], '\d+(?:\.\d+)?') | ForEach-Object { [double]$_.Value })
  if ($from.Count -ne $to.Count) { throw 'Diameter row mismatch' }
  for ($i=0; $i -lt $codes.Count; $i++) {
    if (!$records.Contains($codes[$i])) { continue }
    $upper = @([regex]::Matches($cells[2+2*$i], '[+-]?\d+(?:\.\d+)?') | ForEach-Object { [double]$_.Value })
    $lower = @([regex]::Matches($cells[3+2*$i], '[+-]?\d+(?:\.\d+)?') | ForEach-Object { [double]$_.Value })
    if (!$upper.Count -or !$lower.Count) { continue }
    if (($upper.Count -ne 1 -and $upper.Count -ne $from.Count) -or ($lower.Count -ne 1 -and $lower.Count -ne $from.Count)) { throw "Value count mismatch: $($codes[$i])" }
    for ($j=0; $j -lt $from.Count; $j++) {
      $u = $upper[$(if($upper.Count -eq 1){0}else{$j})]
      $l = $lower[$(if($lower.Count -eq 1){0}else{$j})]
      if ($u -lt $l) { throw "Invalid interval $($codes[$i]) at $($from[$j])" }
      $records[$codes[$i]].Add(@($from[$j], $to[$j], $l, $u))
    }
  }
}
$records | ConvertTo-Json -Depth 6 -Compress

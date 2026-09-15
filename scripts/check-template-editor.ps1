$ErrorActionPreference='Stop'
$source=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../src-tauri/src/excel-template-editor.ps1') -Raw -Encoding UTF8
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors | Out-String)}
$helper=[regex]::Match($source,"(?s)Add-Type -TypeDefinition @'(.*?)'@").Groups[1].Value
Add-Type -TypeDefinition $helper
$assignment=$ast.Find({param($node) $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq '$worker'},$true)
$workerText=$assignment.Right.Extent.Text.Trim()
$workerText=$workerText.Substring(1,$workerText.Length-2).Replace('$excel.Visible=$true','$excel.Visible=$false')
$workerText=$workerText.Replace('$_.Exception.Message', '($_.Exception.Message + " | " + $_.InvocationInfo.PositionMessage + " | " + $_.ScriptStackTrace)')
$testDir=Join-Path ([IO.Path]::GetTempPath()) ('ASMach-editor-test-'+[guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $testDir
$excel=$null;$runner=$null;$space=$null
function Expect($condition,$message){if(!$condition){throw $message}}
function Result($allowError=$false) {
 $deadline=[DateTime]::UtcNow.AddSeconds(30)
 while($results.Count -eq 0){if([DateTime]::UtcNow -gt $deadline){throw 'Excel worker timeout'};Start-Sleep -Milliseconds 100}
 $result=$results.Dequeue()
 if(!$allowError -and $result.kind -in @('fatal','error')){throw $result.message}
 return $result
}
try{
 $excel=New-Object -ComObject Excel.Application;$excel.Visible=$false;$excel.DisplayAlerts=$false
 $book=$excel.Workbooks.Add();$sheet=$book.Worksheets.Item(1)
 $sheet.Range('A1').Value2='Original';$sheet.PageSetup.PrintArea='$A$1:$D$12'
 $path=Join-Path $testDir 'original.xltx';$book.SaveAs($path,54)
 $null=[ASMachOpenWorkbook]::Repeat($book,'columns');$null=[ASMachOpenWorkbook]::Decimal($book,'comma');$book.Save()
 # Keep the original open: the worker must attach, not create a read-only copy.
 $book.Activate();$sheet.Range('A3:B6').Select()
 $commands=[Collections.Queue]::Synchronized((New-Object Collections.Queue))
 $results=[Collections.Queue]::Synchronized((New-Object Collections.Queue))
 $space=[RunspaceFactory]::CreateRunspace();$space.ApartmentState='STA';$space.ThreadOptions='ReuseThread';$space.Open()
 $runner=[PowerShell]::Create();$runner.Runspace=$space
 $null=$runner.AddScript($workerText).AddArgument($path).AddArgument($commands).AddArgument($results)
 $handle=$runner.BeginInvoke();$ready=Result
 Expect ($ready.kind -eq 'ready') 'Failed to reuse original'
 Expect ($ready.direction -eq 'columns') 'Existing repeat direction was not read'
 Expect ($ready.decimal -eq 'comma') 'Existing decimal preference was not read'
 Expect ($book.Saved) 'Opening editor modified the workbook'
 Expect ($excel.Workbooks.Count -eq 1) 'Duplicate workbook opened'
 $commands.Enqueue(@{kind='listArea'});$r=Result
 Expect ($r.kind -eq 'done') 'List area failed'
 $sheet.Range('D11:D13').Select();$commands.Enqueue(@{kind='listArea'})
 $invalid=Result $true;Expect ($invalid.kind -eq 'error') 'Invalid area accepted'
 $sheet.Range('A3').Select();$commands.Enqueue(@{kind='insert';token='{{record.requirement}}';overwrite=$true});$null=Result
 $other=$excel.Workbooks.Add();$other.Worksheets.Item(1).Range('A1').Value2='Keep this workbook open'
 $commands.Enqueue(@{kind='saveClose';direction='rows';decimal='dot'});$r=Result
 Expect ($r.kind -eq 'closed') 'Save and close failed'
 Expect ($excel.Workbooks.Count -eq 1) 'Only the selected workbook should close'
 Expect ($other.Worksheets.Item(1).Range('A1').Value2 -eq 'Keep this workbook open') 'Unrelated workbook changed'
 $runner.EndInvoke($handle);$runner.Dispose();$space.Dispose();$runner=$null;$space=$null
 # Reopen from disk, not through the template-instantiation default.
 $check=$excel.Workbooks.Open($path,0,$false,5,'','',$true,2,'',$true)
 Expect ($check.FullName -eq $path) 'XLTX path changed'
 Expect ([ASMachOpenWorkbook]::ReadRepeat($check) -eq 'rows') 'Repeat direction was not saved'
 Expect ([ASMachOpenWorkbook]::ReadDecimal($check) -eq 'dot') 'Decimal preference was not saved'
 Expect ($check.Worksheets.Item(1).Range('A3').Value2 -eq '{{record.requirement}}') 'Original was not saved'
 Expect ($check.Names.Count -ge 2) 'List metadata missing'
 $check.Close($false)
 # Fresh-open path and Save As must preserve the original and close the target.
 $null=$runner # new worker below
 $space=[RunspaceFactory]::CreateRunspace();$space.ApartmentState='STA';$space.ThreadOptions='ReuseThread';$space.Open()
 $runner=[PowerShell]::Create();$runner.Runspace=$space
 $null=$runner.AddScript($workerText).AddArgument($path).AddArgument($commands).AddArgument($results)
 $handle=$runner.BeginInvoke();$null=Result
 $target=Join-Path $testDir 'copy.xlsx'
 $commands.Enqueue(@{kind='saveAs';direction='rows';path=$target});$r=Result
 Expect ($r.path -eq $target) 'Save As did not use selected target'
 $commands.Enqueue(@{kind='saveClose';direction='rows'});$r=Result
 Expect ($r.kind -eq 'closed') 'Fresh workbook did not close'
 $runner.EndInvoke($handle)
 Expect (Test-Path -LiteralPath $path) 'Original removed'
 Expect (Test-Path -LiteralPath $target) 'Save As missing'
 Write-Output "PASS: reuse original, list area, invalid bounds, same-file save/close, editable XLTX open, Save As. Fixtures: $testDir"
}finally{
 if($commands){$commands.Enqueue(@{kind='close'})}
 if($runner -and $handle.IsCompleted){$runner.Dispose();if($space){$space.Dispose()}}
 if($excel){foreach($b in @($excel.Workbooks)){$b.Close($false)};$excel.Quit();[Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null}
}

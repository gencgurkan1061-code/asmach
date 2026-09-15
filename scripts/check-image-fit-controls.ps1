$ErrorActionPreference='Stop'
$source=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../src-tauri/src/excel-template-editor.ps1') -Raw -Encoding UTF8
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
$body=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Update-Token'},$true).Body.GetScriptBlock()
$list=[pscustomobject]@{SelectedItem=[pscustomobject]@{Key='record.balloonImage'}}
$token=[pscustomobject]@{Text=''};$imageFit=[pscustomobject]@{SelectedIndex=0;Enabled=$false};$fitHint=[pscustomobject]@{Text=''}
foreach($field in @('record.balloonImage','record.classificationImage','record.requirement')){
 $list.SelectedItem.Key=$field
 for($i=0;$i -lt 3;$i++){$imageFit.SelectedIndex=$i;. $body;$expected='{{'+$field+'|fit='+@('cell','height','width')[$i]+'}}';if($token.Text -ne $expected -or !$imageFit.Enabled){throw 'Wrong visual token'}}
}
$list.SelectedItem.Key='record.nominalValue';. $body
if($token.Text -ne '{{record.nominalValue}}' -or $imageFit.Enabled){throw 'Scalar fields must not have fit options'}
Write-Output 'PASS native fit controls: three visual fields, three modes, disabled for scalar fields; PowerShell syntax valid'

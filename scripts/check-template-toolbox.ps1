$ErrorActionPreference='Stop'
$source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../src-tauri/src/excel-template-editor.ps1'))
$a=$source.IndexOf('$worker={');$b=$source.IndexOf('$runspace=',$a)
$mock=@'
$worker={param($path,$commands,$results)
 $results.Enqueue(@{kind='ready';direction='rows';decimal='auto';overflow='expandRows';paper='a4';landscape=$true;message='TEST Hazır'})
 while($true){if(!$commands.Count){Start-Sleep -Milliseconds 50;continue};$r=$commands.Dequeue();if($r.kind -eq 'close'){break};$results.Enqueue(@{kind='done';message='TEST İşlem tamamlandı'})}
}
'@
$source=$source.Substring(0,$a)+$mock+"`n"+$source.Substring($b)
$test=@'
$form.ShowInTaskbar=$false
$testTimer=New-Object Windows.Forms.Timer;$testTimer.Interval=600
$testTimer.Add_Tick({
 $testTimer.Stop()
 try{
  if(!$script:ready){throw 'Mock worker did not initialize'}
  if($category.Items.Count -lt 5){throw 'Categories were flattened'}
  if($list.Items.Count -ne $fields.Count){throw 'Not all fields listed'}
  if($token.Text -notmatch '^\{\{[a-zA-Z0-9_.]+\}\}$'){throw 'Field token contains a label or invalid key'}
  $category.SelectedItem='FAI / Kimlik ve onay';Refresh-Fields
  if($list.Items.Count -lt 15){throw 'FAI category missing'}
  $search.Text='fairIdentifier';Refresh-Fields
  if($list.Items.Count -ne 1 -or $token.Text -ne '{{project.fai.fairIdentifier}}'){throw 'Search failed'}
  $search.Text='';Refresh-Fields
  if($overflow.SelectedIndex -ne 0){throw 'Recommended row expansion mode is not selected'}
  if($printRange.Text -notmatch 'Yazdırma alanı' -or $headerRange.Text -notmatch 'başlık' -or $listRange.Text -notmatch 'Karakteristik' -or $finalRange.Text -notmatch 'Sonuç'){throw 'Page region controls are missing'}
  if($resultHeaderRange.Text -notmatch 'Parça numarası' -or $resultInputRange.Text -notmatch 'Sonuç giriş' -or $resultSummaryRange.Text -notmatch 'Parça sonuç'){throw 'Sample result region controls are missing'}
  $pageTabs.SelectedTab=$sampleTab
  $bmp=New-Object Drawing.Bitmap($form.Width,$form.Height)
  $form.DrawToBitmap($bmp,(New-Object Drawing.Rectangle(0,0,$form.Width,$form.Height)))
  $bmp.Save($env:ASMACH_TOOLBOX_TEST_IMAGE,[Drawing.Imaging.ImageFormat]::Png);$bmp.Dispose()
  Write-Output ('PASS toolbox category/search/STA worker: '+$fields.Count+' fields')
 }catch{$script:toolboxTestError=$_.Exception.Message}
 $script:allowClose=$true;$form.Close()
})
$testTimer.Start()
try{[Windows.Forms.Application]::Run($form)}
'@
$source=$source.Replace('try{[Windows.Forms.Application]::Run($form)}',$test)
Invoke-Expression $source
if($script:toolboxTestError){throw $script:toolboxTestError}

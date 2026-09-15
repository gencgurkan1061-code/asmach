$ErrorActionPreference='Stop';$excel=$null;$book=$null
try{
 $excel=New-Object -ComObject Excel.Application;$excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.AutomationSecurity=3;$excel.AskToUpdateLinks=$false
 foreach($separator in @('auto','dot','comma')){
  $path=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot ('../outputs/decimal-tests/'+$separator+'.xlsx')))
  $book=$excel.Workbooks.Open($path,0,$true);$excel.CalculateFull();$sheet=$book.Worksheets.Item(1)
  if($sheet.Range('A1').Value2 -isnot [double]){throw 'Nominal is not numeric'}
  if([Math]::Abs($sheet.Range('A3').Value2-10.2) -gt .000001){throw 'SUM failed'}
  if($sheet.Range('B3').Value2 -ne 5){throw 'COUNT failed'}
  if($sheet.Range('C3').Value2 -ne $true){throw 'ISNUMBER failed'}
  if([Math]::Abs($sheet.Range('D3').Value2-9.9) -gt .000001){throw 'Arithmetic failed'}
  if($sheet.Range('F1').Value2 -isnot [string] -or $sheet.Range('F1').Value2 -ne '1.1'){throw 'Balloon ID was converted'}
  $book.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($book);$book=$null
 }
 Write-Output 'PASS actual Excel SUM, COUNT, ISNUMBER and arithmetic in auto/dot/comma modes; original balloon label preserved'
}finally{if($book){$book.Close($false)};if($excel){$excel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)}}

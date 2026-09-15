$ErrorActionPreference='Stop'
$qaRoot=(Resolve-Path 'outputs/role-reports-qa').Path
$excelQa=New-Object -ComObject Excel.Application
$excelQa.Visible=$false
$excelQa.DisplayAlerts=$false
$excelQa.AutomationSecurity=3
try {
  foreach($name in @('control','characteristics','intermediate','as9102c','form3','inspection','gdt','fai-template')) {
    $file=Join-Path $qaRoot ($name+'.xlsx')
    if(!(Test-Path -LiteralPath $file)){continue}
    $book=$excelQa.Workbooks.Open($file,0,$true)
    try {
      $excelQa.CalculateFullRebuild()
      foreach($sheetQa in $book.Worksheets) {
        foreach($cellQa in $sheetQa.UsedRange.Cells) {
          if($cellQa.Text -match '^#(REF!|DIV/0!|VALUE!|NAME\?|N/A|NUM!|NULL!)$'){throw "$name / $($sheetQa.Name) / $($cellQa.Address()): $($cellQa.Text)"}
        }
      }
      if($name -in @('control','characteristics','intermediate')) {
        $planQa=$book.Worksheets.Item('Plan')
        $planQa.Range('B3').Value2=200.0
        $excelQa.CalculateFullRebuild()
        if($planQa.Range('G12').Value2 -ne 32){throw "Recalculation failed: $name expected G2 / G / 32 for lot 200"}
        $planQa.Range('B3').Value2=400.0
        $excelQa.CalculateFullRebuild()
        if($planQa.Range('G12').Value2 -ne 50){throw "Recalculation failed: $name expected H / 50"}
      }
      $book.ExportAsFixedFormat(0,(Join-Path $qaRoot ($name+'-excel-print.pdf')))
      Write-Output "$name : Excel opened, formula scan and print export passed."
    } finally {$book.Close($false);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($book)}
  }
} finally {$excelQa.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelQa)}

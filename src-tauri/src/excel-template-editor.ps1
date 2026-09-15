$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$path=$env:ASMACH_EXCEL_TEMPLATE
if(!$path){
 $picker=New-Object Windows.Forms.OpenFileDialog
 $picker.Title='Düzenlenecek şablonu aç';$picker.Filter='Excel şablonu / çalışma kitabı|*.xltx;*.xlsx'
 if($picker.ShowDialog() -ne 'OK'){$picker.Dispose();return}
 $path=$picker.FileName;$picker.Dispose()
}
$path=[IO.Path]::GetFullPath($path)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
public static class ASMachOpenWorkbook {
 public static string ReadRepeat(object book) {return Repeat(book,null);}
 public static string Repeat(object book, string value) {return Property(book,"ASMachRepeatDirection",value,"rows");}
 public static string ReadDecimal(object book) {return Property(book,"ASMachDecimalSeparator",null,"auto");}
 public static string Decimal(object book,string value) {return Property(book,"ASMachDecimalSeparator",value,"auto");}
 public static string ReadOverflow(object book) {return Property(book,"ASMachOverflowMode",null,"sheets");}
 public static string Overflow(object book,string value) {return Property(book,"ASMachOverflowMode",value,"sheets");}
 public static string ReadSampleLayout(object book) {return Property(book,"ASMachSampleLayout",null,"right");}
 public static string SampleLayout(object book,string value) {return Property(book,"ASMachSampleLayout",value,"right");}
 public static string Property(object book, string name, string value, string fallback) {
  var get=System.Reflection.BindingFlags.GetProperty;var set=System.Reflection.BindingFlags.SetProperty;
  object props=book.GetType().InvokeMember("CustomDocumentProperties",get,null,book,null), property=null;
  try {
   try {property=props.GetType().InvokeMember("Item",get,null,props,new object[]{name});}catch{}
   if(value==null)return property==null?fallback:Convert.ToString(property.GetType().InvokeMember("Value",get,null,property,null));
   if(property!=null)property.GetType().InvokeMember("Value",set,null,property,new object[]{value});
   else property=props.GetType().InvokeMember("Add",System.Reflection.BindingFlags.InvokeMethod,null,props,new object[]{name,false,4,value});
   return value;
  }finally{if(property!=null)Marshal.ReleaseComObject(property);if(props!=null)Marshal.ReleaseComObject(props);}
 }
 [DllImport("ole32.dll")] static extern int GetRunningObjectTable(int reserved, out IRunningObjectTable table);
 [DllImport("ole32.dll")] static extern int CreateBindCtx(int reserved, out IBindCtx context);
 public static object Find(string path) {
  IRunningObjectTable table=null; IBindCtx context=null; IEnumMoniker entries=null;
  try {
   GetRunningObjectTable(0,out table); CreateBindCtx(0,out context); table.EnumRunning(out entries);
   var item=new IMoniker[1];
   while(entries.Next(1,item,IntPtr.Zero)==0) {
    try { string name; item[0].GetDisplayName(context,null,out name);
     if(String.Equals(name,path,StringComparison.OrdinalIgnoreCase)) {object value;table.GetObject(item[0],out value);return value;}
    } catch {} finally {Marshal.ReleaseComObject(item[0]);}
   }
   return null;
  } finally {if(entries!=null)Marshal.ReleaseComObject(entries);if(context!=null)Marshal.ReleaseComObject(context);if(table!=null)Marshal.ReleaseComObject(table);}
 }
}
'@
# A named property preserves nested arrays on Windows PowerShell 5.1 as well as 7.
# Wrapping pipeline output in @() on 5.1 adds an extra array level.
$fieldDocument=ConvertFrom-Json -InputObject ('{"fields":'+$env:ASMACH_EXCEL_FIELDS+'}')
$fields=$fieldDocument.fields
if(!$fields -or @($fields).Count -eq 0){throw 'Şablon alanları alınamadı.'}
foreach($field in $fields){if($field.Count -ne 2 -or $field[0] -isnot [string] -or $field[1] -isnot [string]){throw 'Şablon alan listesi geçersiz.'}}
$commands=[Collections.Queue]::Synchronized((New-Object Collections.Queue))
$results=[Collections.Queue]::Synchronized((New-Object Collections.Queue))
# All Excel COM calls belong to one background STA. The UI never calls Excel.
$worker={
 param($path,$commands,$results)
 $ErrorActionPreference='Stop';$excel=$null;$book=$null;$ownsExcel=$false;$openedHere=$false
 try{
  $book=[ASMachOpenWorkbook]::Find($path)
  if(!$book){
   try{
    $active=[Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
    foreach($candidate in $active.Workbooks){if($candidate.FullName -eq $path){$book=$candidate;break}}
   }catch{}
  }
  if($book){$excel=$book.Application}else{
   # Detect locks before opening: never create a second read-only workbook.
   try{$probe=[IO.File]::Open($path,'Open','ReadWrite','None');$probe.Dispose()}catch{throw 'Şablon başka bir oturumda açık veya yazmaya karşı korumalı. Açık dosyayı kaydedip kapatın ve yeniden deneyin; salt okunur kopya açılmadı.'}
   $excel=New-Object -ComObject Excel.Application;$ownsExcel=$true
   $excel.AutomationSecurity=3;$excel.AskToUpdateLinks=$false
   # Editable=true (argument 10) opens the XLTX itself, not a new workbook from it.
   $book=$excel.Workbooks.Open($path,0,$false,5,'','',$true,2,'',$true)
   $openedHere=$true
  }
  if($book.ReadOnly){if($openedHere){$book.Close($false)};throw 'Mevcut şablon salt okunur. Yazılabilir asıl dosyayı açın; bu dosyaya kayıt yapılamaz.'}
  if([IO.Path]::GetFullPath($book.FullName) -ne $path){if($openedHere){$book.Close($false)};throw 'Excel asıl şablon yerine başka bir dosya açtı. İşlem güvenli biçimde durduruldu.'}
  $excel.Visible=$true;$excel.UserControl=$true
  $book.Activate()
  $direction='rows'
  try{if([ASMachOpenWorkbook]::ReadRepeat($book) -eq 'columns'){$direction='columns'}}catch{}
  $decimal='auto';try{$decimal=[ASMachOpenWorkbook]::ReadDecimal($book)}catch{}
  $overflow='sheets';try{$overflow=[ASMachOpenWorkbook]::ReadOverflow($book)}catch{}
  $sampleLayout='right';try{$sampleLayout=[ASMachOpenWorkbook]::ReadSampleLayout($book)}catch{}
  $activeSheet=$book.ActiveSheet;$paper='a4';try{if($activeSheet.PageSetup.PaperSize -eq 8){$paper='a3'}elseif($activeSheet.PageSetup.PaperSize -eq 1){$paper='letter'}}catch{};$landscape=$false;try{$landscape=$activeSheet.PageSetup.Orientation -eq 2}catch{}
  $results.Enqueue(@{kind='ready';direction=$direction;decimal=$decimal;overflow=$overflow;sampleLayout=$sampleLayout;paper=$paper;landscape=$landscape;message='Hazır. Excel hücresini seçin; alanı ekleyin. Kaydetmeden dosya değişmez.'})
  while($true){
   if($commands.Count -eq 0){Start-Sleep -Milliseconds 80;continue}
   $request=$commands.Dequeue()
   if($request.kind -eq 'close'){break}
   $region=$null;$address=$null
   try{
    if($request.kind -eq 'insert'){
     if($excel.ActiveWorkbook.FullName -ne $book.FullName){throw 'Doğru XLTX dosyasını Excel üzerinde etkinleştirin.'}
     $cell=$excel.ActiveCell
     if($null -eq $cell){throw 'Önce Excel üzerinde bir hücre seçin.'}
     if($cell.MergeCells){$cell=$cell.MergeArea.Cells.Item(1,1)}
     if($cell.Worksheet.ProtectContents){throw 'Sayfa korumalı. Excel üzerinden korumayı kaldırın.'}
     if([string]$cell.Formula -ne '' -and !$request.overwrite){throw 'Hücre dolu. Boş hücre seçin veya Dolu hücreyi değiştir seçeneğini işaretleyin.'}
     $cell.Value2=$request.token
     $message=$cell.Worksheet.Name+'!'+$cell.Address()+' : '+$request.token+' (kaydedilmedi)'
     [Runtime.InteropServices.Marshal]::ReleaseComObject($cell) | Out-Null
    }elseif($request.kind -eq 'listArea'){
     if($excel.ActiveWorkbook.FullName -ne $book.FullName){throw 'Düzenlenen şablonu Excel üzerinde etkinleştirin.'}
     $selection=$excel.Selection
     if($selection.Areas.Count -ne 1 -or $selection.Rows.Count -gt 1000 -or $selection.Columns.Count -gt 100){throw 'Tek parça bir liste alanı seçin (en fazla 1000 satır / 100 sütun).'}
     $sheet=$selection.Worksheet
     if(!$sheet.PageSetup.PrintArea){throw 'Önce Excel Sayfa Düzeni bölümünden yazdırma alanını belirleyin; başlık, liste ve alt bölüm dahil olsun.'}
     $print=$sheet.Range($sheet.PageSetup.PrintArea)
     if($print.Areas.Count -ne 1){throw 'Tek bir yazdırma alanı kullanın.'}
     if($selection.Row -lt $print.Row -or $selection.Column -lt $print.Column -or ($selection.Row+$selection.Rows.Count) -gt ($print.Row+$print.Rows.Count) -or ($selection.Column+$selection.Columns.Count) -gt ($print.Column+$print.Columns.Count)){throw 'Liste alanı yazdırma alanının içinde olmalı.'}
     $name="'"+$sheet.Name.Replace("'","''")+"'!ASMach_List"
     $ref="='"+$sheet.Name.Replace("'","''")+"'!"+$selection.Address()
     $null=$book.Names.Add($name,$ref)
     $excel.ActiveWindow.View=2
     $message='Liste alanı: '+$sheet.Name+'!'+$selection.Address()+'. Alan kodlarını ilk satıra koyun. Başlık/alt bölüm korunur; taşan kayıtlar devam sayfalarına alınır. Kaydet ile uygulayın.'
     $region='list';$address=$selection.Address()
    }elseif($request.kind -eq 'pageRange'){
     if($excel.ActiveWorkbook.FullName -ne $book.FullName){throw 'Düzenlenen şablonu Excel üzerinde etkinleştirin.'}
     $selection=$excel.Selection
     if($selection.Areas.Count -ne 1){throw 'Tek parça bir hücre alanı seçin.'}
     $sheet=$selection.Worksheet;$address=$selection.Address();$region=$request.region
     if($region -eq 'print'){$sheet.PageSetup.PrintArea=$address;$message='Yazdırma alanı: '+$sheet.Name+'!'+$address}
     elseif($region -eq 'header'){
      $first=$selection.Row;$last=$selection.Row+$selection.Rows.Count-1;$sheet.PageSetup.PrintTitleRows='$'+$first+':$'+$last
      $name="'"+$sheet.Name.Replace("'","''")+"'!ASMach_Header";$ref="='"+$sheet.Name.Replace("'","''")+"'!"+$selection.Address();$null=$book.Names.Add($name,$ref)
      $message='Her basılı sayfada tekrarlanacak başlık satırları: '+$first+':'+$last
     }elseif($region -eq 'final'){
      $name="'"+$sheet.Name.Replace("'","''")+"'!ASMach_FinalFooter";$ref="='"+$sheet.Name.Replace("'","''")+"'!"+$selection.Address();$null=$book.Names.Add($name,$ref)
      $message='Yalnız son sayfada kalacak sonuç / onay alanı: '+$sheet.Name+'!'+$address
     }elseif($region -in @('resultHeader','resultInput','resultSummary','evaluation','repeatColumns')){
      $definition=@{resultHeader='ASMach_ResultHeader';resultInput='ASMach_ResultInput';resultSummary='ASMach_ResultSummary';evaluation='ASMach_Evaluation';repeatColumns='ASMach_RepeatColumns'}[$region]
      $label=@{resultHeader='Parça numarası satırı';resultInput='Sonuç giriş alanı';resultSummary='Parça sonuç satırı';evaluation='Değerlendirme alanı';repeatColumns='Tekrarlanacak sol kolonlar'}[$region]
      $name="'"+$sheet.Name.Replace("'","''")+"'!"+$definition;$ref="='"+$sheet.Name.Replace("'","''")+"'!"+$selection.Address();$null=$book.Names.Add($name,$ref)
      $message=$label+': '+$sheet.Name+'!'+$address+'. Kaydet ile şablona yazın.'
     }else{throw 'Bilinmeyen sayfa bölgesi.'}
     [Runtime.InteropServices.Marshal]::ReleaseComObject($selection) | Out-Null
    }elseif($request.kind -eq 'pageApply'){
     $sheet=$book.ActiveSheet;$sheet.PageSetup.PaperSize=@{a4=9;a3=8;letter=1}[$request.paper];$sheet.PageSetup.Orientation=if($request.landscape){2}else{1};$sheet.PageSetup.Zoom=$false;$sheet.PageSetup.FitToPagesWide=1;$sheet.PageSetup.FitToPagesTall=$false;$sheet.PageSetup.CenterFooter=if($request.pageNumbers){'Sayfa &P / &N'}else{''}
     $null=[ASMachOpenWorkbook]::Overflow($book,$request.overflow);$null=[ASMachOpenWorkbook]::SampleLayout($book,$request.sampleLayout);$message='Sayfa düzeni uygulandı. Kaydet ile şablona yazın.'
    }elseif($request.kind -in @('save','saveClose','saveAs')){
     $null=[ASMachOpenWorkbook]::Repeat($book,$request.direction)
     if($request.decimal -in @('auto','dot','comma')){$null=[ASMachOpenWorkbook]::Decimal($book,$request.decimal)}
     $null=[ASMachOpenWorkbook]::Overflow($book,$request.overflow)
     $null=[ASMachOpenWorkbook]::SampleLayout($book,$request.sampleLayout)
     $sheet=$book.ActiveSheet;$sheet.PageSetup.PaperSize=@{a4=9;a3=8;letter=1}[$request.paper];$sheet.PageSetup.Orientation=if($request.landscape){2}else{1};$sheet.PageSetup.Zoom=$false;$sheet.PageSetup.FitToPagesWide=1;$sheet.PageSetup.FitToPagesTall=$false;$sheet.PageSetup.CenterFooter=if($request.pageNumbers){'Sayfa &P / &N'}else{''}
     if($request.kind -eq 'saveAs'){
      $format=if([IO.Path]::GetExtension($request.path) -eq '.xltx'){54}else{51}
      $book.SaveAs($request.path,$format);$path=$book.FullName
     }else{$book.Save()}
     if(!$book.Saved){throw 'Kayıt tamamlanmadı; dosya açık bırakıldı.'}
     $message='Kaydedildi: '+$book.FullName
     if($request.kind -eq 'saveClose'){
      $book.Close($false)
      if($ownsExcel -and $excel.Workbooks.Count -eq 0){$excel.Quit()}
      $results.Enqueue(@{kind='closed';message=$message});break
     }
    }
    $results.Enqueue(@{kind='done';message=$message;path=$path;rows=($request.kind -eq 'listArea');region=$region;address=$address})
   }catch{
    $results.Enqueue(@{kind='error';message='İşlem tamamlanamadı: '+$_.Exception.Message})
   }
  }
 }catch{if($ownsExcel -and $excel -and $excel.Workbooks.Count -eq 0){$excel.Quit()};$results.Enqueue(@{kind='fatal';message=$_.Exception.Message})}
 finally{
  # Leave the user's workbook open, including unsaved work. Never call Quit or Close here.
  if($null -ne $book){[Runtime.InteropServices.Marshal]::ReleaseComObject($book) | Out-Null}
  if($null -ne $excel){[Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null}
 }
}
$runspace=[RunspaceFactory]::CreateRunspace();$runspace.ApartmentState='STA';$runspace.ThreadOptions='ReuseThread';$runspace.Open()
$runner=[PowerShell]::Create();$runner.Runspace=$runspace
$null=$runner.AddScript($worker.ToString()).AddArgument($path).AddArgument($commands).AddArgument($results)
$handle=$runner.BeginInvoke()

$form=New-Object Windows.Forms.Form
$form.Text='ASMach Inspection · Şablon düzenleyici'
$form.Size=New-Object Drawing.Size(900,678);$form.MinimumSize=New-Object Drawing.Size(820,628)
$form.StartPosition='CenterScreen';$form.TopMost=$true;$form.KeyPreview=$true
$form.Font=New-Object Drawing.Font('Segoe UI',9)
$layout=New-Object Windows.Forms.TableLayoutPanel
$layout.Dock='Fill';$layout.Padding=New-Object Windows.Forms.Padding(8);$layout.ColumnCount=2;$layout.RowCount=10
$layout.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Percent',62))) | Out-Null
$layout.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Percent',38))) | Out-Null
foreach($height in @(24,34,28,28,0,28,166,28,48,64)){
 $style=New-Object Windows.Forms.RowStyle
 if($height -eq 0){$style.SizeType='Percent';$style.Height=100}else{$style.SizeType='Absolute';$style.Height=$height}
 $null=$layout.RowStyles.Add($style)
}
$form.Controls.Add($layout)
function Add-Control($control,$row){$control.Dock='Fill';$layout.Controls.Add($control,0,$row)}
$title=New-Object Windows.Forms.Label;$title.Text=[IO.Path]::GetFileName($path);$title.AutoEllipsis=$true;Add-Control $title 0
$hint=New-Object Windows.Forms.Label;$hint.Text='Kategoriden alanı seçin veya arayın. Excel hücresini seçip Ekle deyin.';Add-Control $hint 1
$category=New-Object Windows.Forms.ComboBox;$category.DropDownStyle='DropDownList';$null=$category.Items.Add('Tüm kategoriler')
foreach($group in @($fields | ForEach-Object {([string]$_[1] -split ' · ',2)[0]} | Select-Object -Unique)){$null=$category.Items.Add($group)}
Add-Control $category 2
$search=New-Object Windows.Forms.TextBox
$search.AccessibleName='Alan adı veya kodunda ara';Add-Control $search 3
$list=New-Object Windows.Forms.ListBox;$list.DisplayMember='Label';$list.IntegralHeight=$false;Add-Control $list 4
$token=New-Object Windows.Forms.TextBox;$token.ReadOnly=$true;$token.AccessibleName='Seçilen alan kodu';Add-Control $token 5
$direction=New-Object Windows.Forms.ComboBox;$direction.DropDownStyle='DropDownList'
$null=$direction.Items.Add('Kayıtları satırlar boyunca çoğalt');$null=$direction.Items.Add('Kayıtları sütunlar boyunca çoğalt');$direction.SelectedIndex=0
$insertOptions=New-Object Windows.Forms.FlowLayoutPanel;$insertOptions.FlowDirection='TopDown';$insertOptions.WrapContents=$false;Add-Control $insertOptions 6
$direction.Width=505;$insertOptions.Controls.Add($direction)
$fitLine=New-Object Windows.Forms.FlowLayoutPanel;$fitLine.Width=505;$fitLine.Height=28;$insertOptions.Controls.Add($fitLine)
$fitLabel=New-Object Windows.Forms.Label;$fitLabel.Text='Görsel boyutu';$fitLabel.Width=110;$fitLabel.Padding=New-Object Windows.Forms.Padding(0,5,0,0);$fitLine.Controls.Add($fitLabel)
$imageFit=New-Object Windows.Forms.ComboBox;$imageFit.DropDownStyle='DropDownList';$imageFit.Width=365
foreach($label in @('Hücreye sığdır','Satır yüksekliğine sığdır','Sütun genişliğine sığdır')){$null=$imageFit.Items.Add($label)}
$imageFit.SelectedIndex=0;$fitLine.Controls.Add($imageFit)
$fitHint=New-Object Windows.Forms.Label;$fitHint.Width=505;$fitHint.Height=24;$fitHint.Text='En-boy oranı korunur. Ayar, eklenen görsel alanına kaydedilir.';$insertOptions.Controls.Add($fitHint)
$decimalLine=New-Object Windows.Forms.FlowLayoutPanel;$decimalLine.Width=505;$decimalLine.Height=28;$insertOptions.Controls.Add($decimalLine)
$decimalLabel=New-Object Windows.Forms.Label;$decimalLabel.Text='Ondalık ayıracı';$decimalLabel.Width=110;$decimalLabel.Padding=New-Object Windows.Forms.Padding(0,5,0,0);$decimalLine.Controls.Add($decimalLabel)
$decimalSeparator=New-Object Windows.Forms.ComboBox;$decimalSeparator.DropDownStyle='DropDownList';$decimalSeparator.Width=365
foreach($label in @('Otomatik · nokta / virgül','Nokta (.) · 10.1','Virgül (,) · 10,1')){$null=$decimalSeparator.Items.Add($label)}
$decimalSeparator.SelectedIndex=0;$decimalLine.Controls.Add($decimalSeparator)
$decimalHint=New-Object Windows.Forms.Label;$decimalHint.Width=505;$decimalHint.Height=30;$decimalHint.Text='Şablonun tamamına uygulanır. Değerler sayı olarak yazılır; görüntü ayıracı Excel ayarına bağlıdır.';$insertOptions.Controls.Add($decimalHint)
$options=New-Object Windows.Forms.FlowLayoutPanel;Add-Control $options 7
$overwrite=New-Object Windows.Forms.CheckBox;$overwrite.Text='Dolu hücreyi değiştir';$overwrite.Width=190;$options.Controls.Add($overwrite)
$onTop=New-Object Windows.Forms.CheckBox;$onTop.Text='Üstte tut';$onTop.Checked=$true;$options.Controls.Add($onTop)
$onTop.Add_CheckedChanged({$form.TopMost=$onTop.Checked})
$status=New-Object Windows.Forms.Label;$status.Text='Excel arka planda açılıyor… Alanları arayabilirsiniz.';Add-Control $status 8
$buttons=New-Object Windows.Forms.FlowLayoutPanel;Add-Control $buttons 9
function Button($text,$width){$b=New-Object Windows.Forms.Button;$b.Text=$text;$b.Width=$width;$b.Height=26;$buttons.Controls.Add($b);return $b}
$insert=Button 'Ekle' 50;$save=Button 'Kaydet' 65;$saveAs=Button 'Farklı kaydet' 95;$saveClose=Button 'Kaydet ve kapat' 120;$copy=Button 'Kodu kopyala' 98;$close=Button 'Kapat' 58
$listArea=New-Object Windows.Forms.Button
$saveAs.Enabled=$false;$saveClose.Enabled=$false
$listArea.Enabled=$false
$pageBox=New-Object Windows.Forms.GroupBox;$pageBox.Text='Şablon düzeni';$pageBox.Dock='Fill';$pageBox.Padding=New-Object Windows.Forms.Padding(8)
$layout.Controls.Add($pageBox,1,0);$layout.SetRowSpan($pageBox,10)
$pageTabs=New-Object Windows.Forms.TabControl;$pageTabs.Dock='Fill';$pageBox.Controls.Add($pageTabs)
$pageTab=New-Object Windows.Forms.TabPage;$pageTab.Text='Sayfa düzeni';$sampleTab=New-Object Windows.Forms.TabPage;$sampleTab.Text='Parça sonuçları';$pageTabs.TabPages.Add($pageTab);$pageTabs.TabPages.Add($sampleTab)
$pageFlow=New-Object Windows.Forms.FlowLayoutPanel;$pageFlow.Dock='Fill';$pageFlow.FlowDirection='TopDown';$pageFlow.WrapContents=$false;$pageFlow.AutoScroll=$true;$pageTab.Controls.Add($pageFlow)
$sampleFlow=New-Object Windows.Forms.FlowLayoutPanel;$sampleFlow.Dock='Fill';$sampleFlow.FlowDirection='TopDown';$sampleFlow.WrapContents=$false;$sampleFlow.AutoScroll=$true;$sampleTab.Controls.Add($sampleFlow)
function Page-Label($text,$container=$pageFlow){$label=New-Object Windows.Forms.Label;$label.Text=$text;$label.Width=260;$label.Height=20;$container.Controls.Add($label);return $label}
function Page-Button($text,$region,$container=$pageFlow){$button=New-Object Windows.Forms.Button;$button.Text=$text;$button.Width=260;$button.Height=29;$button.Tag=$region;$button.Add_Click({$script:rangeKind=[string]$this.Tag;if($script:rangeKind -eq 'list'){Send-Command 'listArea'}else{Send-Command 'pageRange'}});$container.Controls.Add($button);return $button}
$pageIntro=Page-Label 'Excel üzerinde alanı seçin, ardından ilgili düğmeye basın.';$pageIntro.Height=36
$printRange=Page-Button '1 · Yazdırma alanını seç' 'print';$printValue=Page-Label 'Yazdırma alanı: seçilmedi'
$headerRange=Page-Button '2 · Tekrarlanan başlık satırları' 'header';$headerValue=Page-Label 'Başlık: seçilmedi'
$listRange=Page-Button '3 · Karakteristik tablo alanı' 'list';$listValue=Page-Label 'Liste: seçilmedi'
$finalRange=Page-Button '4 · Sonuç ve onay alanı' 'final';$finalValue=Page-Label 'Final özet: seçilmedi'
$paperLabel=Page-Label 'Kâğıt boyutu'
$paper=New-Object Windows.Forms.ComboBox;$paper.DropDownStyle='DropDownList';$paper.Width=270;foreach($item in @('A4','A3','Letter')){$null=$paper.Items.Add($item)};$paper.SelectedIndex=0;$pageFlow.Controls.Add($paper)
$orientationLabel=Page-Label 'Yön'
$orientation=New-Object Windows.Forms.ComboBox;$orientation.DropDownStyle='DropDownList';$orientation.Width=270;$null=$orientation.Items.Add('Yatay');$null=$orientation.Items.Add('Dikey');$orientation.SelectedIndex=0;$pageFlow.Controls.Add($orientation)
$overflowLabel=Page-Label 'Tablo alanı dolduğunda'
$overflow=New-Object Windows.Forms.ComboBox;$overflow.DropDownStyle='DropDownList';$overflow.Width=270;$null=$overflow.Items.Add('Aynı sayfaya satır ekle (önerilen)');$null=$overflow.Items.Add('Yeni Excel sayfaları oluştur');$overflow.SelectedIndex=0;$pageFlow.Controls.Add($overflow)
$pageNumbers=New-Object Windows.Forms.CheckBox;$pageNumbers.Text='Sayfa numarasını altlıkta göster';$pageNumbers.Checked=$true;$pageNumbers.Width=270;$pageFlow.Controls.Add($pageNumbers)
$pageHint=Page-Label 'Genişlik tek sayfaya sığdırılır. Final özet yalnız listenin sonunda kalır.';$pageHint.Height=42
$pageApply=New-Object Windows.Forms.Button;$pageApply.Text='Sayfa düzenini uygula';$pageApply.Width=270;$pageApply.Height=32;$pageApply.Add_Click({Send-Command 'pageApply'});$pageFlow.Controls.Add($pageApply)
$sampleTitle=Page-Label 'Parça adedine göre sayfalar' $sampleFlow;$sampleTitle.Font=New-Object Drawing.Font('Segoe UI',9,[Drawing.FontStyle]::Bold);$sampleTitle.Height=28
$sampleIntro=Page-Label 'Bir sayfadaki parça kolonlarını Excel üzerinde işaretleyin. Çıktı ekranı seçilen kolon adedini sayfa kapasitesi olarak kullanır.' $sampleFlow;$sampleIntro.Height=60
$resultHeaderRange=Page-Button '1 · Parça numarası satırı' 'resultHeader' $sampleFlow;$resultHeaderValue=Page-Label 'Parça numaraları: seçilmedi' $sampleFlow
$resultInputRange=Page-Button '2 · Sonuç giriş alanı' 'resultInput' $sampleFlow;$resultInputValue=Page-Label 'Sonuç hücreleri: seçilmedi' $sampleFlow
$resultSummaryRange=Page-Button '3 · Parça sonuç satırı' 'resultSummary' $sampleFlow;$resultSummaryValue=Page-Label 'Parça sonuçları: seçilmedi' $sampleFlow
$evaluationRange=Page-Button '4 · Değerlendirme alanı' 'evaluation' $sampleFlow;$evaluationValue=Page-Label 'Değerlendirme: otomatik belirlenir' $sampleFlow
$repeatColumnsRange=Page-Button '5 · Tekrarlanacak sol kolonlar' 'repeatColumns' $sampleFlow;$repeatColumnsValue=Page-Label 'Sol kolonlar: otomatik belirlenir' $sampleFlow
$sampleLayoutLabel=Page-Label 'Parça sonuçlarını çoğaltır' $sampleFlow
$sampleLayout=New-Object Windows.Forms.ComboBox;$sampleLayout.DropDownStyle='DropDownList';$sampleLayout.Width=270;$null=$sampleLayout.Items.Add('Aynı sayfada sağa (önerilen)');$null=$sampleLayout.Items.Add('Yeni çalışma sayfaları');$sampleLayout.SelectedIndex=0;$sampleFlow.Controls.Add($sampleLayout)
$sampleHint=Page-Label 'Üç sonuç alanı aynı kolonlardan başlamalıdır. Sağa çoğaltmada değerlendirme de kopyalanır; genel sonuç ve onay alanı tek kalır ve bütün blokları toplar.' $sampleFlow;$sampleHint.Height=82
$pageActions=@($printRange,$headerRange,$listRange,$finalRange,$pageApply,$resultHeaderRange,$resultInputRange,$resultSummaryRange,$evaluationRange,$repeatColumnsRange,$sampleLayout);foreach($action in $pageActions){$action.Enabled=$false}
$script:busy=$true;$script:ready=$false;$script:started=[DateTime]::UtcNow
function Refresh-Fields{
 $selected=$token.Text;$query=$search.Text.Trim().ToLowerInvariant();$group=[string]$category.SelectedItem
 $list.BeginUpdate()
 try{$list.Items.Clear();foreach($field in $fields){
  $label=[string]$field[1];$key=[string]$field[0]
  if(($group -eq 'Tüm kategoriler' -or $label.StartsWith($group+' · ')) -and (!$query -or ($label+' '+$key).ToLowerInvariant().Contains($query))){
   $null=$list.Items.Add([pscustomobject]@{Label=$label;Key=$key})
  }
 };if($list.Items.Count -gt 0){$list.SelectedIndex=0}}finally{$list.EndUpdate()}
}
$filter=New-Object Windows.Forms.Timer;$filter.Interval=180
$filter.Add_Tick({$filter.Stop();Refresh-Fields})
$search.Add_TextChanged({$filter.Stop();$filter.Start()})
$category.Add_SelectedIndexChanged({Refresh-Fields})
function Update-Token{
 $visual=$list.SelectedItem -and $list.SelectedItem.Key -in @('record.balloonImage','record.classificationImage','record.requirement')
 $imageFit.Enabled=[bool]$visual
 if($list.SelectedItem){$suffix=if($visual){'|fit='+@('cell','height','width')[$imageFit.SelectedIndex]}else{''};$token.Text='{{'+$list.SelectedItem.Key+$suffix+'}}'}else{$token.Text=''}
 $fitHint.Text=if(!$visual){'Boyut seçimi: balon, sınıf ve GD&T gereklilik görselleri.'}elseif($imageFit.SelectedIndex -eq 0){'En-boy oranı korunur; görsel hücrenin sınırlarını aşmaz.'}else{'En-boy oranı korunur; diğer yönde taşabilir. Hücre ölçüleri değişmez.'}
}
$list.Add_SelectedIndexChanged({Update-Token});$imageFit.Add_SelectedIndexChanged({Update-Token})
$category.SelectedIndex=0
function Send-Command($kind,$targetPath=''){
 if($script:busy -or !$script:ready){return}
 if($kind -eq 'insert' -and !$list.SelectedItem){$status.Text='Bir alan seçin.';return}
 if($kind -eq 'listArea'){$direction.SelectedIndex=0}
 $script:busy=$true;$script:started=[DateTime]::UtcNow;$insert.Enabled=$false;$save.Enabled=$false;$listArea.Enabled=$false;$saveAs.Enabled=$false;$saveClose.Enabled=$false;$status.Text='Excel işlemi yürütülüyor…'
 foreach($action in $pageActions){$action.Enabled=$false}
 $commands.Enqueue(@{kind=$kind;path=$targetPath;token=$token.Text;overwrite=$overwrite.Checked;decimal=@('auto','dot','comma')[$decimalSeparator.SelectedIndex];direction=$(if($direction.SelectedIndex -eq 1){'columns'}else{'rows'});region=$script:rangeKind;paper=@('a4','a3','letter')[$paper.SelectedIndex];landscape=($orientation.SelectedIndex -eq 0);overflow=$(if($overflow.SelectedIndex -eq 0){'expandRows'}else{'sheets'});sampleLayout=$(if($sampleLayout.SelectedIndex -eq 1){'sheets'}else{'right'});pageNumbers=$pageNumbers.Checked})
}
$insert.Enabled=$false;$save.Enabled=$false
$insert.Add_Click({Send-Command 'insert'});$save.Add_Click({Send-Command 'save'})
$saveClose.Add_Click({Send-Command 'saveClose'})
$saveAs.Add_Click({
 $picker=New-Object Windows.Forms.SaveFileDialog;$picker.Title='Şablonu farklı kaydet';$picker.Filter='Excel şablonu|*.xltx|Excel çalışma kitabı|*.xlsx';$picker.FileName=$title.Text;$picker.OverwritePrompt=$true
 if($picker.ShowDialog() -eq 'OK'){Send-Command 'saveAs' $picker.FileName};$picker.Dispose()
})
$copy.Add_Click({if($token.Text){[Windows.Forms.Clipboard]::SetText($token.Text);$status.Text='Alan kodu kopyalandı. Excel hücresine yapıştırabilirsiniz.'}})
$close.Add_Click({$form.Close()})
$script:allowClose=$false
$form.Add_FormClosing({
 if($script:allowClose -or !$script:ready){return}
 $_.Cancel=$true
 if($script:busy){$status.Text='Devam eden işlemin tamamlanmasını bekleyin.';return}
 $answer=[Windows.Forms.MessageBox]::Show('Şablon kaydedilip kapatılsın mı? Hayır: yalnızca düzenleyici kapanır, Excel dosyası açık kalır.','Şablonu kapat','YesNoCancel','Question')
 if($answer -eq 'Yes'){Send-Command 'saveClose'}elseif($answer -eq 'No'){$script:allowClose=$true;$_.Cancel=$false}
})
$form.Add_KeyDown({
 if($_.Control -and $_.KeyCode -eq 'F'){$search.Focus();$_.SuppressKeyPress=$true}
 elseif($_.Control -and $_.KeyCode -eq 'S'){Send-Command 'save';$_.SuppressKeyPress=$true}
 elseif($_.KeyCode -eq 'Enter'){Send-Command 'insert';$_.SuppressKeyPress=$true}
 elseif($_.KeyCode -eq 'Escape'){$form.Close();$_.SuppressKeyPress=$true}
})
$poll=New-Object Windows.Forms.Timer;$poll.Interval=150
$poll.Add_Tick({
 while($results.Count -gt 0){
  $result=$results.Dequeue();$script:busy=$false;$status.Text=$result.message
  if($result.kind -eq 'closed'){$script:allowClose=$true;$script:ready=$false;$form.Close();return}
  if($result.path){$title.Text=[IO.Path]::GetFileName($result.path)}
  if($result.rows){$direction.SelectedIndex=0}
   if($result.region -eq 'print'){$printValue.Text='Yazdırma alanı: '+$result.address}elseif($result.region -eq 'header'){$headerValue.Text='Başlık: '+$result.address}elseif($result.region -eq 'list'){$listValue.Text='Liste: '+$result.address}elseif($result.region -eq 'final'){$finalValue.Text='Final özet: '+$result.address}elseif($result.region -eq 'resultHeader'){$resultHeaderValue.Text='Parça numaraları: '+$result.address}elseif($result.region -eq 'resultInput'){$resultInputValue.Text='Sonuç hücreleri: '+$result.address}elseif($result.region -eq 'resultSummary'){$resultSummaryValue.Text='Parça sonuçları: '+$result.address}elseif($result.region -eq 'evaluation'){$evaluationValue.Text='Değerlendirme: '+$result.address}elseif($result.region -eq 'repeatColumns'){$repeatColumnsValue.Text='Sol kolonlar: '+$result.address}
   if($result.kind -eq 'ready'){$script:ready=$true;if($result.direction -eq 'columns'){$direction.SelectedIndex=1};$decimalSeparator.SelectedIndex=[Math]::Max(0,[array]::IndexOf(@('auto','dot','comma'),[string]$result.decimal));$overflow.SelectedIndex=if($result.overflow -eq 'expandRows'){0}else{1};$sampleLayout.SelectedIndex=if($result.sampleLayout -eq 'sheets'){1}else{0};$paper.SelectedIndex=[Math]::Max(0,[array]::IndexOf(@('a4','a3','letter'),[string]$result.paper));$orientation.SelectedIndex=if($result.landscape){0}else{1}}
  if($result.kind -eq 'fatal'){$script:ready=$false}
  $insert.Enabled=$script:ready;$save.Enabled=$script:ready;$listArea.Enabled=$script:ready;$saveAs.Enabled=$script:ready;$saveClose.Enabled=$script:ready
  foreach($action in $pageActions){$action.Enabled=$script:ready}
 }
 if($script:busy -and ([DateTime]::UtcNow-$script:started).TotalSeconds -gt 10){$status.Text='Excel yanıtı bekleniyor. Excel uygulamasındaki açık iletişim kutusunu veya hücre düzenlemesini tamamlayın. Alan arama ve kopyalama kullanılabilir.'}
})
$poll.Start()
try{[Windows.Forms.Application]::Run($form)}
finally{
 $poll.Stop();$filter.Stop();$poll.Dispose();$filter.Dispose()
 $commands.Enqueue(@{kind='close'})
 if($handle.IsCompleted){try{$runner.EndInvoke($handle)}catch{};$runner.Dispose();$runspace.Dispose()}
 # Do not synchronously wait on a busy Excel COM call while closing the toolbox.
}

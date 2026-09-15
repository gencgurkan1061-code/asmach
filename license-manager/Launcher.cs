using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
[assembly:System.Reflection.AssemblyTitle("ASMach Lisans Yönetimi")]
[assembly:System.Reflection.AssemblyVersion("1.0.0.0")]
static class Launcher {
 [STAThread] static void Main() {
  try {
   string root=AppDomain.CurrentDomain.BaseDirectory;
   string node=Path.Combine(root,"license-manager","runtime","node.exe");
   string script=Path.Combine(root,"license-manager","server.cjs");
   if(!File.Exists(node)||!File.Exists(script))throw new Exception("Yönetim uygulamasının dosyaları bulunamadı. EXE dosyasını proje klasöründen taşımayın.");
   var info=new ProcessStartInfo(node,"\""+script+"\" --open");
   info.WorkingDirectory=root;info.UseShellExecute=false;info.CreateNoWindow=true;info.WindowStyle=ProcessWindowStyle.Hidden;
   Process.Start(info);
  } catch(Exception e) {MessageBox.Show(e.Message,"ASMach Lisans Yönetimi",MessageBoxButtons.OK,MessageBoxIcon.Error);}
 }
}

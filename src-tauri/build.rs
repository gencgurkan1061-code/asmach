fn main() {
    println!("cargo:rerun-if-changed=license-config.json");
    println!("cargo:rerun-if-env-changed=ASMACH_VERSION_URL");
    println!("cargo:rerun-if-changed=updater-config.json");
    tauri_build::build()
}

const STORAGE_COMMANDS: &[&str] = &[
    "aethoria_storage_write",
    "aethoria_storage_read",
    "aethoria_storage_list",
    "aethoria_storage_delete",
    "aethoria_storage_exists",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(STORAGE_COMMANDS)),
    )
    .expect("failed to build the Aethoria Tauri application manifest");
}

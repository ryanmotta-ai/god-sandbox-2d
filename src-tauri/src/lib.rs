mod storage;

use storage::{CommandError, SaveDescriptor};
use tauri::{AppHandle, Manager};

fn storage_root(app: &AppHandle) -> Result<std::path::PathBuf, CommandError> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("Aethoria"))
        .map_err(|error| CommandError::new("path_unavailable", error.to_string()))
}

async fn run_blocking<T, F>(operation: F) -> Result<T, CommandError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, CommandError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|error| CommandError::new("runtime_failure", error.to_string()))?
}

#[tauri::command]
async fn aethoria_storage_write(
    app: AppHandle,
    slot: u8,
    contents: String,
) -> Result<(), CommandError> {
    let root = storage_root(&app)?;
    run_blocking(move || storage::write(&root, slot, &contents)).await
}

#[tauri::command]
async fn aethoria_storage_read(app: AppHandle, slot: u8) -> Result<Option<String>, CommandError> {
    let root = storage_root(&app)?;
    run_blocking(move || storage::read(&root, slot)).await
}

#[tauri::command]
async fn aethoria_storage_list(app: AppHandle) -> Result<Vec<SaveDescriptor>, CommandError> {
    let root = storage_root(&app)?;
    run_blocking(move || storage::list(&root)).await
}

#[tauri::command]
async fn aethoria_storage_delete(app: AppHandle, slot: u8) -> Result<(), CommandError> {
    let root = storage_root(&app)?;
    run_blocking(move || storage::delete(&root, slot)).await
}

#[tauri::command]
async fn aethoria_storage_exists(app: AppHandle, slot: u8) -> Result<bool, CommandError> {
    let root = storage_root(&app)?;
    run_blocking(move || storage::exists(&root, slot)).await
}

#[tauri::command]
async fn aethoria_storage_export(app: AppHandle, slot: u8) -> Result<Option<String>, CommandError> {
    let root = storage_root(&app)?;
    run_blocking(move || storage::export(&root, slot)).await
}

#[tauri::command]
async fn aethoria_storage_import(
    app: AppHandle,
    slot: u8,
    contents: String,
) -> Result<(), CommandError> {
    let root = storage_root(&app)?;
    run_blocking(move || storage::import(&root, slot, &contents)).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            aethoria_storage_write,
            aethoria_storage_read,
            aethoria_storage_list,
            aethoria_storage_delete,
            aethoria_storage_exists,
            aethoria_storage_export,
            aethoria_storage_import
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Aethoria desktop runtime");
}

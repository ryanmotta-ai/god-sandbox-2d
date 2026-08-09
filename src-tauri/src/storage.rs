use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_SLOT: u8 = 4;
const MAX_BACKUPS_PER_SLOT: usize = 3;
const SAVE_FORMAT_VERSION: u64 = 3;
const INDEX_VERSION: u64 = 1;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl CommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexEntry {
    metadata: Value,
    bytes: u64,
    modified_at: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveIndex {
    #[serde(default)]
    index_version: u64,
    #[serde(default)]
    slots: BTreeMap<u8, IndexEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDescriptor {
    pub slot: u8,
    pub metadata: Option<Value>,
    pub bytes: u64,
    pub modified_at: u64,
    pub valid: bool,
    pub error: Option<String>,
}

fn io_error(operation: &str, error: io::Error) -> CommandError {
    let code = if matches!(error.raw_os_error(), Some(28 | 112)) {
        "disk_full"
    } else {
        match error.kind() {
            io::ErrorKind::PermissionDenied => "permission_denied",
            io::ErrorKind::NotFound => "missing_file",
            io::ErrorKind::InvalidData => "corrupted_file",
            io::ErrorKind::WriteZero => "write_failure",
            _ => "io_failure",
        }
    };
    CommandError::new(code, format!("{operation}: {error}"))
}

fn validate_slot(slot: u8) -> Result<(), CommandError> {
    if slot > MAX_SLOT {
        return Err(CommandError::new("invalid_slot", format!("slot must be between 0 and {MAX_SLOT}")));
    }
    Ok(())
}

fn slot_locks() -> &'static Vec<Mutex<()>> {
    static LOCKS: OnceLock<Vec<Mutex<()>>> = OnceLock::new();
    LOCKS.get_or_init(|| (0..=MAX_SLOT).map(|_| Mutex::new(())).collect())
}

fn ensure_structure(root: &Path) -> Result<(), CommandError> {
    for directory in ["saves", "autosaves", "backups"] {
        fs::create_dir_all(root.join(directory)).map_err(|error| io_error("create save directory", error))?;
    }
    Ok(())
}

fn slot_stem(slot: u8) -> String {
    if slot == 0 { "autosave-0".to_string() } else { format!("slot-{slot}") }
}

fn slot_path(root: &Path, slot: u8) -> PathBuf {
    let directory = if slot == 0 { "autosaves" } else { "saves" };
    root.join(directory).join(format!("{}.aethoria", slot_stem(slot)))
}

fn index_path(root: &Path) -> PathBuf { root.join("save-index.json") }

fn timestamp_nanos() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos()
}

fn modified_at(metadata: &fs::Metadata) -> u64 {
    metadata.modified().ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn supported_version(value: Option<u64>) -> bool {
    matches!(value, Some(1..=SAVE_FORMAT_VERSION))
}

fn valid_metadata(metadata: &Value, format_version: u64) -> bool {
    let Some(metadata) = metadata.as_object() else { return false; };
    metadata.get("saveFormatVersion").and_then(Value::as_u64) == Some(format_version)
        && metadata.get("gameVersion").is_some_and(Value::is_string)
        && metadata.get("worldName").is_some_and(Value::is_string)
        && metadata.get("timestamp").is_some_and(Value::is_number)
}

fn parse_document(contents: &str) -> Result<Value, CommandError> {
    let document: Value = serde_json::from_str(contents)
        .map_err(|error| CommandError::new("corrupted_file", format!("save is not valid JSON: {error}")))?;
    if document.get("kind").and_then(Value::as_str) != Some("aethoria-save") {
        return Err(CommandError::new("invalid_format", "save document kind must be 'aethoria-save'"));
    }
    let format_version = document.get("formatVersion").and_then(Value::as_u64);
    if !supported_version(format_version) {
        return Err(CommandError::new("unsupported_version", format!("save document format must be between 1 and {SAVE_FORMAT_VERSION}")));
    }
    let format_version = format_version.expect("validated above");
    let metadata = document.get("metadata").ok_or_else(|| CommandError::new("invalid_format", "save document has no metadata"))?;
    if !valid_metadata(metadata, format_version) {
        return Err(CommandError::new("corrupted_file", "save document metadata is missing, malformed, or version-mismatched"));
    }
    let payload = document.get("payload").ok_or_else(|| CommandError::new("invalid_format", "save document has no payload"))?;
    if !payload.is_object() || !payload.get("world").is_some_and(Value::is_object) {
        return Err(CommandError::new("invalid_format", "save payload is missing world data"));
    }
    if let Some(version) = payload.get("version") {
        if !supported_version(version.as_u64()) {
            return Err(CommandError::new("unsupported_version", format!("save payload format must be between 1 and {SAVE_FORMAT_VERSION}")));
        }
    }
    Ok(document)
}

fn write_temporary_file(path: &Path, contents: &[u8]) -> Result<(), CommandError> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)
        .map_err(|error| io_error("create temporary save", error))?;
    file.write_all(contents).map_err(|error| io_error("write temporary save", error))?;
    file.flush().map_err(|error| io_error("flush temporary save", error))?;
    file.sync_all().map_err(|error| io_error("sync temporary save", error))?;
    Ok(())
}

fn load_index(root: &Path) -> Option<SaveIndex> {
    let contents = fs::read_to_string(index_path(root)).ok()?;
    let index: SaveIndex = serde_json::from_str(&contents).ok()?;
    (index.index_version == INDEX_VERSION).then_some(index)
}

fn write_index(root: &Path, index: &SaveIndex) -> Result<(), CommandError> {
    let serialized = serde_json::to_vec(index).map_err(|error| CommandError::new("io_failure", error.to_string()))?;
    let target = index_path(root);
    let temporary = root.join(format!(".save-index-{}.tmp", timestamp_nanos()));
    write_temporary_file(&temporary, &serialized)?;

    // Windows cannot rename over an existing file. Keeping the old index until
    // the replacement is ready makes an interrupted update repairable on list.
    let previous = root.join(format!(".save-index-{}.previous", timestamp_nanos()));
    if target.exists() {
        fs::rename(&target, &previous).map_err(|error| io_error("stage previous save index", error))?;
    }
    if let Err(error) = fs::rename(&temporary, &target) {
        let _ = fs::remove_file(&temporary);
        if previous.exists() { let _ = fs::rename(&previous, &target); }
        return Err(io_error("promote save index", error));
    }
    if previous.exists() { let _ = fs::remove_file(previous); }
    Ok(())
}

fn entry_for(path: &Path, document: &Value) -> Result<IndexEntry, CommandError> {
    let metadata = fs::metadata(path).map_err(|error| io_error("inspect save", error))?;
    Ok(IndexEntry {
        metadata: document.get("metadata").cloned().expect("validated document metadata"),
        bytes: metadata.len(),
        modified_at: modified_at(&metadata),
    })
}

fn prune_backups(root: &Path, stem: &str) {
    let Ok(entries) = fs::read_dir(root.join("backups")) else { return; };
    let prefix = format!("{stem}-");
    let mut paths: Vec<PathBuf> = entries.filter_map(Result::ok).map(|entry| entry.path()).filter(|path| {
        path.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.starts_with(&prefix))
            && path.extension().and_then(|ext| ext.to_str()) == Some("aethoria")
    }).collect();
    paths.sort();
    let remove_count = paths.len().saturating_sub(MAX_BACKUPS_PER_SLOT);
    for old_backup in paths.into_iter().take(remove_count) {
        let _ = fs::remove_file(old_backup);
    }
}

fn latest_valid_backup(root: &Path, slot: u8) -> Result<Option<(PathBuf, String, Value)>, CommandError> {
    let prefix = format!("{}-", slot_stem(slot));
    let entries = fs::read_dir(root.join("backups")).map_err(|error| io_error("inspect backups", error))?;
    let mut paths: Vec<PathBuf> = entries.filter_map(Result::ok).map(|entry| entry.path()).filter(|path| {
        path.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.starts_with(&prefix))
            && path.extension().and_then(|ext| ext.to_str()) == Some("aethoria")
    }).collect();
    paths.sort_by(|a, b| b.cmp(a));
    for path in paths {
        if let Ok(contents) = fs::read_to_string(&path) {
            if let Ok(document) = parse_document(&contents) { return Ok(Some((path, contents, document))); }
        }
    }
    Ok(None)
}

fn restore_backup(root: &Path, slot: u8, contents: &str, document: &Value) -> Result<(), CommandError> {
    let target = slot_path(root, slot);
    let temporary = target.with_file_name(format!(".{}.recover-{}.tmp", slot_stem(slot), timestamp_nanos()));
    write_temporary_file(&temporary, contents.as_bytes())?;
    if target.exists() {
        let corrupt = root.join("backups").join(format!("{}-corrupt-{}.aethoria", slot_stem(slot), timestamp_nanos()));
        fs::rename(&target, corrupt).map_err(|error| io_error("quarantine corrupted save", error))?;
    }
    fs::rename(&temporary, &target).map_err(|error| io_error("restore backup save", error))?;
    let mut index = load_index(root).unwrap_or(SaveIndex { index_version: INDEX_VERSION, ..Default::default() });
    index.slots.insert(slot, entry_for(&target, document)?);
    write_index(root, &index)
}

pub fn write(root: &Path, slot: u8, contents: &str) -> Result<(), CommandError> {
    validate_slot(slot)?;
    let _guard = slot_locks()[slot as usize].lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let document = parse_document(contents)?;
    ensure_structure(root)?;
    let target = slot_path(root, slot);
    let temporary = target.with_file_name(format!(".{}.{}.tmp", slot_stem(slot), timestamp_nanos()));
    if let Err(error) = write_temporary_file(&temporary, contents.as_bytes()) { let _ = fs::remove_file(&temporary); return Err(error); }
    let read_back = fs::read_to_string(&temporary).map_err(|error| io_error("validate temporary save", error))?;
    if let Err(error) = parse_document(&read_back) { let _ = fs::remove_file(&temporary); return Err(error); }

    let backup = if target.exists() {
        let backup = root.join("backups").join(format!("{}-{}.aethoria", slot_stem(slot), timestamp_nanos()));
        fs::rename(&target, &backup).map_err(|error| io_error("preserve previous save", error))?;
        Some(backup)
    } else { None };
    if let Err(error) = fs::rename(&temporary, &target) {
        let promotion_error = io_error("promote temporary save", error);
        let _ = fs::remove_file(&temporary);
        if let Some(backup) = backup.as_ref() {
            if let Err(restore_error) = fs::rename(backup, &target) {
                return Err(CommandError::new("rollback_failure", format!("{}; restore failed: {}", promotion_error.message, restore_error)));
            }
        }
        return Err(promotion_error);
    }
    let mut index = load_index(root).unwrap_or(SaveIndex { index_version: INDEX_VERSION, ..Default::default() });
    index.slots.insert(slot, entry_for(&target, &document)?);
    write_index(root, &index)?;
    prune_backups(root, &slot_stem(slot));
    Ok(())
}

pub fn read(root: &Path, slot: u8) -> Result<Option<String>, CommandError> {
    validate_slot(slot)?;
    let _guard = slot_locks()[slot as usize].lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    ensure_structure(root)?;
    let target = slot_path(root, slot);
    if let Ok(contents) = fs::read_to_string(&target) {
        if parse_document(&contents).is_ok() { return Ok(Some(contents)); }
    }
    if let Some((_path, contents, document)) = latest_valid_backup(root, slot)? {
        restore_backup(root, slot, &contents, &document)?;
        return Ok(Some(contents));
    }
    if target.exists() { Err(CommandError::new("corrupted_file", "primary save is invalid and no valid backup exists")) } else { Ok(None) }
}

pub fn list(root: &Path) -> Result<Vec<SaveDescriptor>, CommandError> {
    ensure_structure(root)?;
    let mut index = load_index(root).unwrap_or(SaveIndex { index_version: INDEX_VERSION, ..Default::default() });
    let mut changed = false;
    let mut descriptors = Vec::new();
    for slot in 0..=MAX_SLOT {
        let path = slot_path(root, slot);
        let file_metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => { if index.slots.remove(&slot).is_some() { changed = true; } continue; }
            Err(error) => return Err(io_error("inspect save", error)),
        };
        let bytes = file_metadata.len();
        let modified_at = modified_at(&file_metadata);
        if let Some(entry) = index.slots.get(&slot) {
            if entry.bytes == bytes && entry.modified_at == modified_at {
                descriptors.push(SaveDescriptor { slot, metadata: Some(entry.metadata.clone()), bytes, modified_at, valid: true, error: None });
                continue;
            }
        }
        // Only legacy, interrupted, or externally changed saves are parsed here.
        match fs::read_to_string(&path).map_err(|error| io_error("read changed save", error)).and_then(|contents| parse_document(&contents)) {
            Ok(document) => {
                let entry = entry_for(&path, &document)?;
                descriptors.push(SaveDescriptor { slot, metadata: Some(entry.metadata.clone()), bytes, modified_at, valid: true, error: None });
                index.slots.insert(slot, entry);
            }
            Err(error) => {
                descriptors.push(SaveDescriptor { slot, metadata: None, bytes, modified_at, valid: false, error: Some(error.message) });
                index.slots.remove(&slot);
            }
        }
        changed = true;
    }
    if changed { write_index(root, &index)?; }
    Ok(descriptors)
}

pub fn delete(root: &Path, slot: u8) -> Result<(), CommandError> {
    validate_slot(slot)?;
    let _guard = slot_locks()[slot as usize].lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let path = slot_path(root, slot);
    match fs::remove_file(path) {
        Ok(()) => {},
        Err(error) if error.kind() == io::ErrorKind::NotFound => {},
        Err(error) => return Err(io_error("delete save", error)),
    }
    if let Some(mut index) = load_index(root) { if index.slots.remove(&slot).is_some() { write_index(root, &index)?; } }
    Ok(())
}

pub fn exists(root: &Path, slot: u8) -> Result<bool, CommandError> { validate_slot(slot)?; Ok(slot_path(root, slot).is_file()) }
pub fn export(root: &Path, slot: u8) -> Result<Option<String>, CommandError> { read(root, slot) }
pub fn import(root: &Path, slot: u8, contents: &str) -> Result<(), CommandError> { write(root, slot, contents) }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_a_versioned_save_envelope() {
        let document = r#"{"kind":"aethoria-save","formatVersion":3,"metadata":{"saveFormatVersion":3,"gameVersion":"1.0","worldName":"Test","timestamp":1},"payload":{"version":3,"world":{}}}"#;
        assert!(parse_document(document).is_ok());
    }

    #[test]
    fn rejects_future_or_mismatched_versions() {
        let document = r#"{"kind":"aethoria-save","formatVersion":4,"metadata":{},"payload":{"world":{}}}"#;
        assert!(parse_document(document).is_err());
    }

    #[test]
    fn slot_paths_never_use_frontend_input() {
        let root = Path::new("application-data").join("Aethoria");
        assert_eq!(slot_path(&root, 0), root.join("autosaves").join("autosave-0.aethoria"));
        assert_eq!(slot_path(&root, 4), root.join("saves").join("slot-4.aethoria"));
    }
}

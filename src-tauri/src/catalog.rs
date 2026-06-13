// Pure catalog logic — shared between the Tauri app and the CLI binary.
// No Tauri dependencies here.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ── Entry schema ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    pub language: String,
    pub status: String,
    pub origin: String,
    pub touched: Vec<String>,
    pub tags: Vec<String>,
    pub contract: String,
    pub inputs: String,
    pub outputs: String,
    pub scars: String,
    pub notes: String,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryWithSource {
    #[serde(flatten)]
    pub entry: Entry,
    #[serde(rename = "sourceContent")]
    pub source_content: String,
}

#[derive(Debug, Deserialize)]
pub struct EntryInput {
    pub id: String,
    pub name: String,
    pub language: String,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub origin: String,
    #[serde(default)]
    pub touched: Vec<String>,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub contract: String,
    #[serde(default)]
    pub inputs: String,
    #[serde(default)]
    pub outputs: String,
    #[serde(default)]
    pub scars: String,
    #[serde(default)]
    pub notes: String,
    #[serde(rename = "sourceContent", default)]
    pub source_content: String,
}

// ── Config ────────────────────────────────────────────────────────────────────

pub fn config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".spellbook")
        .join("config.json")
}

/// Returns the configured library dir, or the default (`library/` next to the exe).
pub fn read_library_dir() -> Option<PathBuf> {
    // 1. Explicit override in ~/.spellbook/config.json
    if let Ok(text) = fs::read_to_string(config_path()) {
        if let Ok(val) = serde_json::from_str::<Value>(&text) {
            if let Some(dir) = val["dir"].as_str().map(PathBuf::from) {
                return Some(dir);
            }
        }
    }
    // 2. Default: library/ next to the running executable
    std::env::current_exe().ok()
        .and_then(|p| p.parent().map(|d| d.join("library")))
}

pub fn write_library_dir(dir: &Path) -> Result<(), String> {
    let cfg = config_path();
    if let Some(p) = cfg.parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    let mut map = serde_json::Map::new();
    map.insert("dir".into(), Value::String(dir.to_string_lossy().into_owned()));
    let text = serde_json::to_string_pretty(&Value::Object(map)).map_err(|e| e.to_string())?;
    fs::write(&cfg, text).map_err(|e| e.to_string())
}

pub fn require_library_dir() -> Result<PathBuf, String> {
    let dir = read_library_dir()
        .ok_or_else(|| "Cannot determine library path.".to_string())?;
    // Auto-create on first use — no setup required
    fs::create_dir_all(dir.join("sources")).map_err(|e| e.to_string())?;
    Ok(dir)
}

// ── Catalog I/O ───────────────────────────────────────────────────────────────

pub fn catalog_path(lib_dir: &Path) -> PathBuf { lib_dir.join("index.json") }
pub fn sources_dir(lib_dir: &Path)  -> PathBuf { lib_dir.join("sources") }

pub fn ensure_dirs(lib_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(sources_dir(lib_dir)).map_err(|e| e.to_string())
}

pub fn read_catalog(lib_dir: &Path) -> Result<Vec<Entry>, String> {
    let path = catalog_path(lib_dir);
    if !path.exists() { return Ok(vec![]); }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

pub fn write_catalog(lib_dir: &Path, entries: &[Entry]) -> Result<(), String> {
    let text = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())? + "\n";
    fs::write(catalog_path(lib_dir), text).map_err(|e| e.to_string())
}

pub fn read_source(lib_dir: &Path, entry: &Entry) -> String {
    fs::read_to_string(lib_dir.join(&entry.source)).unwrap_or_default()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

pub const LANG_EXT: &[(&str, &str)] = &[
    ("javascript","js"),("typescript","ts"),("python","py"),("rust","rs"),
    ("c","c"),("cpp","cpp"),("go","go"),("lua","lua"),("glsl","glsl"),
    ("hlsl","hlsl"),("gdscript","gd"),("csharp","cs"),("java","java"),
    ("zig","zig"),("wgsl","wgsl"),("css","css"),("scss","scss"),("sass","sass"),
    ("html","html"),("shell","sh"),("sql","sql"),("kotlin","kt"),("swift","swift"),
    ("ruby","rb"),("php","php"),("dart","dart"),("scala","scala"),("groovy","groovy"),
    ("elixir","ex"),("r","r"),("powershell","ps1"),("assembly","asm"),("nim","nim"),
    ("julia","jl"),("perl","pl"),("d","d"),("crystal","cr"),("odin","odin"),
    ("solidity","sol"),("objc","m"),("vhdl","vhd"),("verilog","v"),("fortran","f90"),
    ("haskell","hs"),("ocaml","ml"),("fsharp","fs"),("kql","kql"),
];

pub fn get_ext(lang: &str) -> &'static str {
    let lower = lang.to_lowercase();
    LANG_EXT.iter()
        .find(|(l, _)| *l == lower.as_str())
        .map(|(_, e)| *e)
        .unwrap_or("txt")
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty() { return Err("id is required".into()); }
    let re = regex_lite::Regex::new(r"^[a-z0-9][a-z0-9-]*$").unwrap();
    if !re.is_match(id) {
        return Err("id must be lowercase alphanumeric with hyphens (e.g. my-fn-js)".into());
    }
    Ok(())
}

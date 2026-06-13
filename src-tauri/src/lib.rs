use std::collections::HashMap;
use std::fs;
use std::io::{Cursor, Write as IoWrite};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ── Entry schema ─────────────────────────────────────────────────────────────

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

// ── Config / library path ─────────────────────────────────────────────────────

fn config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".spellbook")
        .join("config.json")
}

fn read_library_dir() -> Option<PathBuf> {
    let cfg_path = config_path();
    if !cfg_path.exists() {
        return None;
    }
    let text = fs::read_to_string(&cfg_path).ok()?;
    let val: Value = serde_json::from_str(&text).ok()?;
    val["dir"].as_str().map(PathBuf::from)
}

fn write_library_dir(dir: &Path) -> Result<(), String> {
    let cfg_path = config_path();
    if let Some(parent) = cfg_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut map = serde_json::Map::new();
    map.insert("dir".into(), Value::String(dir.to_string_lossy().into_owned()));
    let text = serde_json::to_string_pretty(&Value::Object(map)).map_err(|e| e.to_string())?;
    fs::write(&cfg_path, text).map_err(|e| e.to_string())
}

fn require_library_dir() -> Result<PathBuf, String> {
    read_library_dir().ok_or_else(|| {
        "No library configured. Use the settings panel to select your library folder.".to_string()
    })
}

// ── Catalog helpers ───────────────────────────────────────────────────────────

fn catalog_path(lib_dir: &Path) -> PathBuf {
    lib_dir.join("index.json")
}

fn sources_dir(lib_dir: &Path) -> PathBuf {
    lib_dir.join("sources")
}

fn ensure_dirs(lib_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(sources_dir(lib_dir)).map_err(|e| e.to_string())
}

fn read_catalog(lib_dir: &Path) -> Result<Vec<Entry>, String> {
    let path = catalog_path(lib_dir);
    if !path.exists() {
        return Ok(vec![]);
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

fn write_catalog(lib_dir: &Path, entries: &[Entry]) -> Result<(), String> {
    let text =
        serde_json::to_string_pretty(entries).map_err(|e| e.to_string())? + "\n";
    fs::write(catalog_path(lib_dir), text).map_err(|e| e.to_string())
}

fn read_source(lib_dir: &Path, entry: &Entry) -> String {
    let p = lib_dir.join(&entry.source);
    fs::read_to_string(p).unwrap_or_default()
}

const LANG_EXT: &[(&str, &str)] = &[
    ("javascript", "js"), ("typescript", "ts"), ("python", "py"),
    ("rust", "rs"), ("c", "c"), ("cpp", "cpp"), ("go", "go"),
    ("lua", "lua"), ("glsl", "glsl"), ("hlsl", "hlsl"), ("gdscript", "gd"),
    ("csharp", "cs"), ("java", "java"), ("zig", "zig"), ("wgsl", "wgsl"),
    ("css", "css"), ("scss", "scss"), ("sass", "sass"), ("html", "html"),
    ("shell", "sh"), ("sql", "sql"), ("kotlin", "kt"), ("swift", "swift"),
    ("ruby", "rb"), ("php", "php"), ("dart", "dart"), ("scala", "scala"),
    ("groovy", "groovy"), ("elixir", "ex"), ("r", "r"), ("powershell", "ps1"),
    ("assembly", "asm"), ("nim", "nim"), ("julia", "jl"), ("perl", "pl"),
    ("d", "d"), ("crystal", "cr"), ("odin", "odin"), ("solidity", "sol"),
    ("objc", "m"), ("vhdl", "vhd"), ("verilog", "v"), ("fortran", "f90"),
    ("haskell", "hs"), ("ocaml", "ml"), ("fsharp", "fs"), ("kql", "kql"),
];

fn get_ext(lang: &str) -> &str {
    let lower = lang.to_lowercase();
    LANG_EXT
        .iter()
        .find(|(l, _)| *l == lower.as_str())
        .map(|(_, e)| *e)
        .unwrap_or("txt")
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_library_dir() -> Option<String> {
    read_library_dir().map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn set_library_dir(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    write_library_dir(&p)?;
    Ok(path)
}

#[tauri::command]
fn get_entries() -> Result<Vec<Entry>, String> {
    let lib = require_library_dir()?;
    read_catalog(&lib)
}

#[tauri::command]
fn get_entry(id: String) -> Result<EntryWithSource, String> {
    let lib = require_library_dir()?;
    let entries = read_catalog(&lib)?;
    let entry = entries
        .into_iter()
        .find(|e| e.id == id)
        .ok_or_else(|| format!("Entry not found: {}", id))?;
    let source_content = read_source(&lib, &entry);
    Ok(EntryWithSource { entry, source_content })
}

#[tauri::command]
fn create_entry(data: EntryInput) -> Result<EntryWithSource, String> {
    if data.id.is_empty() || data.name.is_empty() || data.language.is_empty() {
        return Err("id, name, and language are required".into());
    }
    let re = regex_lite::Regex::new(r"^[a-z0-9][a-z0-9-]*$").unwrap();
    if !re.is_match(&data.id) {
        return Err("id must be lowercase alphanumeric with hyphens".into());
    }

    let lib = require_library_dir()?;
    ensure_dirs(&lib)?;
    let mut entries = read_catalog(&lib)?;

    if entries.iter().any(|e| e.id == data.id) {
        return Err(format!("Entry \"{}\" already exists", data.id));
    }

    let ext = get_ext(&data.language);
    let source_rel = format!("sources/{}.{}", data.id, ext);
    fs::write(lib.join(&source_rel), &data.source_content).map_err(|e| e.to_string())?;

    let now = now_iso();
    let entry = Entry {
        id: data.id,
        name: data.name,
        r#type: data.r#type,
        language: data.language,
        tags: data.tags,
        origin: data.origin,
        touched: data.touched,
        status: if data.status.is_empty() { "experimental".into() } else { data.status },
        contract: data.contract,
        inputs: data.inputs,
        outputs: data.outputs,
        scars: data.scars,
        notes: data.notes,
        source: source_rel,
        created_at: now.clone(),
        updated_at: now,
    };

    let source_content = data.source_content;
    entries.push(entry.clone());
    write_catalog(&lib, &entries)?;
    Ok(EntryWithSource { entry, source_content })
}

#[tauri::command]
fn update_entry(id: String, data: Value) -> Result<EntryWithSource, String> {
    let lib = require_library_dir()?;
    let mut entries = read_catalog(&lib)?;
    let idx = entries
        .iter()
        .position(|e| e.id == id)
        .ok_or_else(|| format!("Entry not found: {}", id))?;

    let existing = entries[idx].clone();

    let source_content = if let Some(sc) = data["sourceContent"].as_str() {
        fs::write(lib.join(&existing.source), sc).map_err(|e| e.to_string())?;
        sc.to_string()
    } else {
        read_source(&lib, &existing)
    };

    fn str_or(val: &Value, fallback: &str) -> String {
        val.as_str().unwrap_or(fallback).to_string()
    }
    fn vec_or(val: &Value, fallback: &[String]) -> Vec<String> {
        val.as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_else(|| fallback.to_vec())
    }

    entries[idx] = Entry {
        id: existing.id,
        name: str_or(&data["name"], &existing.name),
        r#type: data["type"].as_str().map(String::from).or(existing.r#type),
        language: str_or(&data["language"], &existing.language),
        status: str_or(&data["status"], &existing.status),
        origin: str_or(&data["origin"], &existing.origin),
        touched: vec_or(&data["touched"], &existing.touched),
        tags: vec_or(&data["tags"], &existing.tags),
        contract: str_or(&data["contract"], &existing.contract),
        inputs: str_or(&data["inputs"], &existing.inputs),
        outputs: str_or(&data["outputs"], &existing.outputs),
        scars: str_or(&data["scars"], &existing.scars),
        notes: str_or(&data["notes"], &existing.notes),
        source: existing.source,
        created_at: existing.created_at,
        updated_at: now_iso(),
    };

    write_catalog(&lib, &entries)?;
    let updated = entries[idx].clone();
    Ok(EntryWithSource { entry: updated, source_content })
}

#[tauri::command]
fn delete_entry(id: String) -> Result<(), String> {
    let lib = require_library_dir()?;
    let mut entries = read_catalog(&lib)?;
    let idx = entries
        .iter()
        .position(|e| e.id == id)
        .ok_or_else(|| format!("Entry not found: {}", id))?;

    let entry = &entries[idx];
    let src_path = lib.join(&entry.source);
    if src_path.exists() {
        fs::remove_file(&src_path).map_err(|e| e.to_string())?;
    }
    entries.remove(idx);
    write_catalog(&lib, &entries)
}

#[tauri::command]
async fn export_entries(
    ids: Vec<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let lib = require_library_dir()?;
    let entries = read_catalog(&lib)?;
    let selected: Vec<_> = entries.iter().filter(|e| ids.contains(&e.id)).collect();

    if selected.is_empty() {
        return Err("No matching entries".into());
    }

    // Group by language
    let mut by_lang: HashMap<String, Vec<(&Entry, String)>> = HashMap::new();
    for entry in &selected {
        let source = read_source(&lib, entry);
        by_lang
            .entry(entry.language.to_lowercase())
            .or_default()
            .push((entry, source));
    }

    // Build zip in memory
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut buf);
        let opts = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        fn line_comment(lang: &str) -> &'static str {
            match lang {
                "python" | "lua" | "gdscript" | "ruby" | "shell" | "r" | "powershell" => "#",
                _ => "//",
            }
        }

        for (lang, lang_entries) in &by_lang {
            let ext = get_ext(lang);
            let c = line_comment(lang);
            let mut content = String::new();

            for (entry, source) in lang_entries {
                content.push_str(&format!("{} {}\n", c, "=".repeat(72)));
                content.push_str(&format!("{} Name:     {}\n", c, entry.name));
                content.push_str(&format!("{} Origin:   {}\n", c, entry.origin));
                content.push_str(&format!("{} Status:   {}\n", c, entry.status));
                content.push_str(&format!("{} Contract: {}\n", c, entry.contract));
                if !entry.inputs.is_empty() {
                    content.push_str(&format!("{} Inputs:   {}\n", c, entry.inputs));
                }
                if !entry.outputs.is_empty() {
                    content.push_str(&format!("{} Outputs:  {}\n", c, entry.outputs));
                }
                if !entry.scars.is_empty() {
                    content.push_str(&format!("{} Scars:    {}\n", c, entry.scars));
                }
                content.push_str(&format!("{} {}\n\n", c, "=".repeat(72)));
                content.push_str(source.trim());
                content.push_str("\n\n\n");
            }

            zip.start_file(format!("{}.{}", lang, ext), opts).map_err(|e| e.to_string())?;
            zip.write_all(content.trim_end().as_bytes()).map_err(|e| e.to_string())?;
            zip.write_all(b"\n").map_err(|e| e.to_string())?;
        }

        // README
        let mut readme = format!(
            "# Spell Book Export\n\nGenerated: {}\n\n## Entries\n\n",
            now_iso()
        );
        for entry in &selected {
            readme.push_str(&format!("- **{}** ({}) — {}\n", entry.name, entry.language, entry.contract));
        }
        zip.start_file("README.md", opts).map_err(|e| e.to_string())?;
        zip.write_all(readme.as_bytes()).map_err(|e| e.to_string())?;

        zip.finish().map_err(|e| e.to_string())?;
    }

    // Ask user where to save
    let save_path = tauri_plugin_dialog::DialogExt::dialog(&app)
        .file()
        .add_filter("ZIP archive", &["zip"])
        .set_file_name("spellbook-export.zip")
        .blocking_save_file();

    match save_path {
        Some(file_path) => {
            let pb = file_path.into_path().map_err(|e| e.to_string())?;
            fs::write(&pb, buf.into_inner()).map_err(|e| e.to_string())?;
            Ok(pb.to_string_lossy().into_owned())
        }
        None => Err("Export cancelled".into()),
    }
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_library_dir,
            set_library_dir,
            get_entries,
            get_entry,
            create_entry,
            update_entry,
            delete_entry,
            export_entries,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

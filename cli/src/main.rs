// sb — Spell Book CLI
// Build:   cargo build --bin sb --release   (inside src-tauri/)
// Install: copy target/release/sb.exe to anywhere on your PATH

use std::env;
use std::fs;
use std::io::Read as IoRead;
use std::path::PathBuf;

use spellbook_core::*;

fn main() {
    let args: Vec<String> = env::args().collect();
    let cmd = args.get(1).map(|s| s.as_str()).unwrap_or("help");

    let result = match cmd {
        "use"     => cmd_use(args.get(2).map(|s| s.as_str())),
        "status"  => cmd_status(),
        "init-ai" => cmd_init_ai(),
        "add"     => cmd_add(args.get(2).map(|s| s.as_str())),
        "search"  => cmd_search(args[2..].join(" ")),
        "get"     => cmd_get(args.get(2).map(|s| s.as_str())),
        "update"  => cmd_update(),
        _         => { print_help(); return; }
    };

    if let Err(e) = result {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}

// ── Commands ──────────────────────────────────────────────────────────────────

fn cmd_use(path: Option<&str>) -> Result<(), String> {
    let path = path.ok_or("Usage: sb use <path-to-library-folder>")?;
    let p = PathBuf::from(path);
    if !p.exists() { return Err(format!("Path does not exist: {}", path)); }
    write_library_dir(&p)?;
    println!("Library set to: {}", p.display());
    Ok(())
}

fn cmd_status() -> Result<(), String> {
    match read_library_dir() {
        None => println!("No library configured.\nRun: sb use <path>"),
        Some(dir) => {
            println!("Library: {}", dir.display());
            let entries = read_catalog(&dir)?;
            println!("Entries: {}", entries.len());
        }
    }
    Ok(())
}

const AI_README: &str = include_str!("../../AI_README.md");

fn cmd_init_ai() -> Result<(), String> {
    let dest = env::current_dir()
        .map_err(|e| e.to_string())?
        .join("AI_README.md");

    fs::write(&dest, AI_README).map_err(|e| e.to_string())?;
    println!("Wrote AI_README.md to: {}", dest.display());
    Ok(())
}

fn cmd_add(path: Option<&str>) -> Result<(), String> {
    let path = path.ok_or("Usage: sb add <entry.json>")?;
    let text = fs::read_to_string(path).map_err(|e| format!("Cannot read file: {}", e))?;
    let data: EntryInput = serde_json::from_str(&text)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    if data.name.is_empty() || data.language.is_empty() {
        return Err("Entry must have name and language".into());
    }
    validate_id(&data.id)?;

    let lib = require_library_dir()?;
    ensure_dirs(&lib)?;
    let mut entries = read_catalog(&lib)?;

    if entries.iter().any(|e| e.id == data.id) {
        return Err(format!("Entry \"{}\" already exists", data.id));
    }

    let source_rel = format!("sources/{}.{}", data.id, get_ext(&data.language));
    fs::write(lib.join(&source_rel), &data.source_content)
        .map_err(|e| e.to_string())?;

    let now = now_iso();
    let entry = Entry {
        id: data.id, name: data.name.clone(), r#type: data.r#type,
        language: data.language, tags: data.tags, origin: data.origin,
        touched: data.touched,
        status: if data.status.is_empty() { "experimental".into() } else { data.status },
        contract: data.contract, inputs: data.inputs, outputs: data.outputs,
        scars: data.scars, notes: data.notes, source: source_rel,
        created_at: now.clone(), updated_at: now,
    };

    entries.push(entry);
    write_catalog(&lib, &entries)?;
    println!("Added: {} ({})", data.name, &entries.last().unwrap().id);
    Ok(())
}

fn cmd_search(query: String) -> Result<(), String> {
    if query.trim().is_empty() { return Err("Usage: sb search <query>".into()); }
    let lib = require_library_dir()?;
    let q = query.to_lowercase();
    let matches: Vec<_> = read_catalog(&lib)?
        .into_iter()
        .filter(|e| {
            e.name.to_lowercase().contains(&q)
            || e.language.to_lowercase().contains(&q)
            || e.tags.iter().any(|t| t.to_lowercase().contains(&q))
            || e.contract.to_lowercase().contains(&q)
        })
        .collect();

    if matches.is_empty() {
        println!("No matches.");
    } else {
        for e in matches {
            let tags = e.tags.join(", ");
            if tags.is_empty() {
                println!("{}  [{}]  {}", e.name, e.id, e.language);
            } else {
                println!("{}  [{}]  {}  {}", e.name, e.id, e.language, tags);
            }
        }
    }
    Ok(())
}

fn cmd_get(name_or_id: Option<&str>) -> Result<(), String> {
    let q = name_or_id.ok_or("Usage: sb get <name-or-id>")?
        .to_lowercase();
    let lib = require_library_dir()?;
    let entry = read_catalog(&lib)?
        .into_iter()
        .find(|e| e.id.to_lowercase() == q || e.name.to_lowercase() == q)
        .ok_or_else(|| format!("Not found: {}", q))?;

    let source = read_source(&lib, &entry);
    println!("Name: {}", entry.name);
    println!("ID:   {}", entry.id);
    if !entry.contract.is_empty() { println!("What: {}", entry.contract); }
    if !entry.inputs.is_empty()   { println!("In:   {}", entry.inputs); }
    if !entry.outputs.is_empty()  { println!("Out:  {}", entry.outputs); }
    if !entry.scars.is_empty()    { println!("Scars: {}", entry.scars); }
    println!("---");
    println!("{}", source);
    Ok(())
}

const VERSION: &str = env!("CARGO_PKG_VERSION");
const REPO: &str = "evyatarmitz/spell-book";

fn cmd_update() -> Result<(), String> {
    println!("Checking for updates (current: v{})...", VERSION);

    let url = format!("https://api.github.com/repos/{}/releases/latest", REPO);
    let resp: serde_json::Value = ureq::get(&url)
        .set("User-Agent", "sb-cli")
        .call()
        .map_err(|e| format!("Network error: {}", e))?
        .into_json()
        .map_err(|e| format!("Parse error: {}", e))?;

    let tag = resp["tag_name"].as_str().ok_or("No tag_name in response")?;
    let latest = tag.trim_start_matches('v');

    if latest == VERSION {
        println!("Already up to date.");
        return Ok(());
    }

    println!("New version available: v{}", latest);

    // Find the sb.exe asset
    let assets = resp["assets"].as_array().ok_or("No assets in response")?;
    let asset = assets.iter()
        .find(|a| a["name"].as_str() == Some("sb.exe"))
        .ok_or("sb.exe not found in release assets")?;
    let download_url = asset["browser_download_url"].as_str()
        .ok_or("No download URL")?;

    println!("Downloading {}...", download_url);
    let mut reader = ureq::get(download_url)
        .set("User-Agent", "sb-cli")
        .call()
        .map_err(|e| format!("Download error: {}", e))?
        .into_reader();

    let exe_path = env::current_exe().map_err(|e| e.to_string())?;
    let tmp_path = exe_path.with_extension("exe.new");
    let old_path = exe_path.with_extension("exe.old");

    let mut buf = Vec::new();
    reader.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    fs::write(&tmp_path, &buf).map_err(|e| format!("Write error: {}", e))?;

    // Rename current → .old, new → current (works on Windows while running)
    if old_path.exists() { let _ = fs::remove_file(&old_path); }
    fs::rename(&exe_path, &old_path).map_err(|e| format!("Rename error: {}", e))?;
    fs::rename(&tmp_path, &exe_path).map_err(|e| format!("Install error: {}", e))?;
    let _ = fs::remove_file(&old_path);

    println!("Updated to v{}. Open a new terminal to use the new version.", latest);
    Ok(())
}

fn print_help() {
    println!(r#"
Spell Book CLI

  sb use <path>         Point sb at your library folder (run once)
  sb status             Show library path and entry count

  sb init-ai            Copy AI_README.md into the current folder
  sb add <entry.json>   Add a new entry from a JSON file
  sb search <query>     Search by name, language, tags, or contract
  sb get <name|id>      Print source for an entry
  sb update             Check for a new release and self-update
"#);
}

//! WASI entry point: stdin = enclave input JSON, stdout = one JSON value. Nothing else is written.

use std::io::{Read, Write};

#[cfg(target_arch = "wasm32")]
#[used]
#[link_section = "outlayer.manifest"]
static OUTLAYER_MANIFEST: [u8; include_bytes!("../manifest.json").len()] = *include_bytes!("../manifest.json");

fn main() {
    let mut raw = Vec::new();
    let _ = std::io::stdin().read_to_end(&mut raw);
    let out = bandsheet_enclave::run::handle(&raw, &|name| std::env::var(name).ok());
    let mut stdout = std::io::stdout();
    let _ = stdout.write_all(out.as_bytes());
    let _ = stdout.flush();
}

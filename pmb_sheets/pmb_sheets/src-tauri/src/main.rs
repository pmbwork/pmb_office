// Impedisce l'apertura della finestra console su Windows in modalità release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pmb_sheets_lib::run();
}

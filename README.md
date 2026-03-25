# efficy-labels-editor

Browser-based tool to edit Efficy CRM localization files (`.txt`, tab-separated, UTF-8 BOM).

No install, no server, no dependencies — open `index.html` and go.

## Features

- Load / edit / save label files directly in the browser
- Search with fuzzy or exact match
- Add rows and comment lines
- Optional AI translation via Anthropic API (per-cell, uses claude-haiku)
- Backup with auto-generated timestamp

## Usage

Open `index.html` in your browser, load a `.txt` labels file, edit, download.

See `help.html` for full documentation.

## Warning

This tool does not replace your vigilance, make sure the changes are okay before pushing on the SVN :-)

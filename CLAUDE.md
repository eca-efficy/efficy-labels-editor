# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a single-file browser-based tool (`labels-editor.html`) for editing Efficy localization/labels files. No build process, no dependencies, no server — open the HTML file directly in a browser.

## File Format

The tool parses `.txt` label files with this tab-separated structure:

```
==> Languages:	EN	FR	NL	...
// Comment line
LABEL_KEY	English value	French value	Dutch value
```

- Header line starts with `==> Languages:` followed by tab-separated language codes
- Comment lines start with `//`
- Data lines: `KEY\tval1\tval2\t...`
- Empty lines are preserved as-is
- Files are saved with a UTF-8 BOM (`\uFEFF`)

## Architecture

Everything lives in `labels-editor.html` as a single self-contained file:

**State:**
- `rows[]` — all parsed rows (type: `header` | `empty` | `comment` | `data`)
- `filteredRows[]` — subset shown after search filtering (data + comment rows only)
- `languages[]` — language codes from the header line
- `virtualScrollOffset` — current scroll position for virtual rendering

**Key functions:**
- `parseFile(content)` — splits content into typed row objects
- `renderTable()` — re-renders the full table using virtual scrolling (renders only visible rows ± `BUFFER_SIZE`)
- `buildFileContent()` — serializes `rows[]` back to the tab-separated format
- `filterTable()` — applies fuzzy or exact search, resets `filteredRows` and re-renders
- `downloadFile()` / `createBackup()` — trigger browser download of the current content

**Virtual scrolling:** The table renders only the rows visible in the viewport plus a buffer of 10 rows above/below. `ROW_HEIGHT = 41px` is a fixed constant used for spacer calculations. On scroll, `handleScroll` updates `virtualScrollOffset` and calls `renderTable()`.

**Search:** Wrapping the term in `"quotes"` triggers exact substring match; otherwise uses fuzzy match (characters must appear in order).

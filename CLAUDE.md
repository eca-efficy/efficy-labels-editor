# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A browser-based tool for editing Efficy localization/labels files. No build process, no dependencies, no server — open `index.html` directly in a browser. Logic lives in `app.js`, styles in `style.css`.

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

**State (app.js globals):**
- `rows[]` — all parsed rows (type: `header` | `empty` | `comment` | `data`)
- `filteredRows[]` — subset shown after search filtering (data + comment rows only)
- `languages[]` — language codes from the header line
- `currentPage`, `pageSize` — pagination state
- `anthropicApiKey` — loaded from `localStorage`, used for AI translation

**Key functions:**
- `parseFile(content)` — splits content into typed row objects
- `renderTable()` — renders the current page of `filteredRows` as an HTML table; rebuilds `innerHTML` of `#dataTable`
- `renderPagination()` — updates the pagination bar UI
- `buildFileContent()` — serializes `rows[]` back to the tab-separated format
- `filterTable()` — applies fuzzy or exact search, resets `filteredRows`, resets to page 1, re-renders
- `downloadFile()` / `createBackup()` — trigger browser download of the current content
- `updateKey(index, newKey)` — updates the key of a data row; if the first language cell (EN) is empty, auto-fills it with the key value and removes the translate button from that cell
- `updateValue(index, langIndex, newValue)` — updates a single translation cell value
- `handleValueInput(input)` — live input handler that shows/hides the per-cell translate button based on whether the cell is empty

**Pagination:** Table is paginated (default 50 rows/page). `goToPage()` resets scroll to top. `goToLastPage()` is used after adding rows.

**Add Row behavior:** `addNewRow()` appends a blank data row, navigates to the last page, scrolls the table container to the bottom, and focuses the Key input of the new row.

**Search:** Wrapping the term in `"quotes"` triggers exact substring match; otherwise uses fuzzy match (characters must appear in order). Debounced at 150ms.

**Layout:** `.container` uses `height: 100vh` with flexbox so `.table-container` (with `overflow: auto; flex: 1`) fills the remaining viewport. This makes the `<thead>` sticky (`position: sticky; top: 0`) work correctly within the scroll container.

**AI Translation:** Uses the Anthropic Messages API (`claude-haiku-4-5-20251001`) directly from the browser. API key stored in `localStorage`. Per-cell (✨) and per-row (✨) translate buttons appear on empty cells when a key is configured.

**Column expand on focus:** Language column inputs have `onfocus="expandColumn(j)"` / `onblur="collapseColumn()"`. `expandColumn` sets `min-width: 400px` directly on the matching `<th data-lang-col="j">` element; `collapseColumn` clears it after a 150ms debounce (so switching between cells in the same table doesn't cause a visible flash). Note: do **not** use `<col>` width for this — browsers ignore `<col> width` when the table uses `table-layout: auto` with `width: 100%`; only `min-width` on `<th>` reliably forces column expansion.

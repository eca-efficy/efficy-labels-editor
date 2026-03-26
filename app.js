let currentFilename = '';
let languages = [];
let rows = [];
let filteredRows = [];
let currentPage = 1;
let pageSize = 50;
let searchDebounceTimeout = null;
let anthropicApiKey = localStorage.getItem('anthropicApiKey') || '';
let collapseTimeout = null;

const fileInput = document.getElementById('fileInput');
const dataTable = document.getElementById('dataTable');
const noData = document.getElementById('noData');
const saveBtn = document.getElementById('saveBtn');
const backupBtn = document.getElementById('backupBtn');
const addRowBtn = document.getElementById('addRowBtn');
const addCommentBtn = document.getElementById('addCommentBtn');
const deeplBtn = document.getElementById('deeplBtn');
const searchInput = document.getElementById('searchInput');
const filenameDisplay = document.getElementById('filenameDisplay');
const rowCount = document.getElementById('rowCount');
const langCount = document.getElementById('langCount');

updateApiKeyButton();

fileInput.addEventListener('change', handleFileSelect);
saveBtn.addEventListener('click', downloadFile);
backupBtn.addEventListener('click', createBackup);
addRowBtn.addEventListener('click', addNewRow);
addCommentBtn.addEventListener('click', addNewComment);
deeplBtn.addEventListener('click', openDeepL);
searchInput.addEventListener('input', handleSearchInput);

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    currentFilename = file.name;
    const reader = new FileReader();

    reader.onload = function(e) {
        const content = e.target.result;
        parseFile(content);
        filteredRows = getDataRows();
        renderTable();
        updateStats();

        saveBtn.disabled = false;
        backupBtn.disabled = false;
        addRowBtn.disabled = false;
        addCommentBtn.disabled = false;
        deeplBtn.disabled = false;
        searchInput.disabled = false;

        filenameDisplay.textContent = currentFilename;
        filenameDisplay.classList.remove('hidden');

        noData.classList.add('hidden');
        dataTable.classList.remove('hidden');
    };

    reader.readAsText(file, 'UTF-8');
}

function parseFile(content) {
    const lines = content.split('\n');
    rows = [];
    languages = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('==> Languages:')) {
            const langLine = line.substring('==> Languages:'.length);
            languages = langLine.split('\t').filter(l => l.trim());
            rows.push({ type: 'header', content: line });
        } else if (line.trim() === '') {
            rows.push({ type: 'empty', content: '' });
        } else if (line.trim().startsWith('//')) {
            rows.push({ type: 'comment', content: line });
        } else {
            const parts = line.split('\t');
            if (parts.length > 0 && parts[0].trim()) {
                rows.push({ type: 'data', key: parts[0], values: parts.slice(1) });
            }
        }
    }
}

function getDataRows() {
    return rows.map((row, index) => ({ row, index }))
               .filter(item => item.row.type === 'data' || item.row.type === 'comment');
}

function renderTable() {
    const totalRows = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(totalRows, startIndex + pageSize);

    let html = '<thead><tr><th>#</th><th data-key-col>Key</th>';
    languages.forEach((lang, j) => { html += `<th data-lang-col="${j}">${escapeHtml(lang)}</th>`; });
    html += '</tr></thead><tbody>';

    for (let i = startIndex; i < endIndex; i++) {
        const { row, index } = filteredRows[i];
        const displayLineNumber = i + 1;

        if (row.type === 'comment') {
            html += `<tr class="comment-row" data-index="${index}">`;
            html += `<td>${displayLineNumber}</td>`;
            html += `<td colspan="${languages.length + 1}">`;
            html += `<input type="text" value="${escapeHtml(row.content)}"
                     onchange="updateComment(${index}, this.value)"
                     onblur="deleteRowIfEmpty(${index})">`;
            html += `</td></tr>`;
        } else if (row.type === 'data') {
            const hasEmptyCells = languages.some((_, i) => !(row.values[i] || '').trim());
            const showRowTranslate = hasEmptyCells && anthropicApiKey;
            html += `<tr data-index="${index}">`;
            html += `<td class="row-number-cell"><span>${displayLineNumber}</span>`;
            if (showRowTranslate) {
                html += `<button class="translate-row-btn" title="Translate all empty cells with Claude AI" onclick="translateRow(${index}, this)">✨</button>`;
            }
            html += `</td>`;
            html += `<td><input type="text" value="${escapeHtml(row.key)}"
                     onchange="updateKey(${index}, this.value)"
                     onfocus="expandColumn('key')"
                     onblur="collapseColumn(); deleteRowIfEmpty(${index})"></td>`;
            for (let j = 0; j < languages.length; j++) {
                const value = row.values[j] || '';
                const showTranslate = !value && anthropicApiKey;
                html += `<td${!value ? ' class="empty-cell"' : ''}><div class="cell-wrapper">`;
                html += `<input type="text" value="${escapeHtml(value)}"
                         data-row-index="${index}" data-lang-index="${j}"
                         onchange="updateValue(${index}, ${j}, this.value)"
                         oninput="handleValueInput(this)"
                         onfocus="expandColumn(${j})"
                         onblur="collapseColumn()">`;
                if (showTranslate) {
                    html += `<button class="translate-btn" title="Translate with Claude AI" onclick="translateCell(${index}, ${j}, this)">✨</button>`;
                }
                html += `</div></td>`;
            }
            html += '</tr>';
        }
    }

    html += '</tbody>';
    dataTable.innerHTML = html;

    renderPagination(totalRows, startIndex, endIndex, totalPages);
}

function renderPagination(totalRows, startIndex, endIndex, totalPages) {
    const bar = document.getElementById('paginationBar');
    if (totalRows === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');

    document.getElementById('paginationInfo').innerHTML =
        `<strong>${startIndex + 1}–${endIndex}</strong> / ${totalRows}`;

    document.getElementById('pgFirst').disabled = currentPage === 1;
    document.getElementById('pgPrev').disabled  = currentPage === 1;
    document.getElementById('pgNext').disabled  = currentPage === totalPages;
    document.getElementById('pgLast').disabled  = currentPage === totalPages;
}

function goToPage(page) {
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    currentPage = Math.max(1, Math.min(page, totalPages));
    document.querySelector('.table-container').scrollTop = 0;
    renderTable();
}

function goToLastPage() {
    goToPage(Math.ceil(filteredRows.length / pageSize));
}

function changePageSize(val) {
    pageSize = parseInt(val);
    currentPage = 1;
    renderTable();
    updateStats();
}

function updateKey(index, newKey) {
    rows[index].key = newKey;
    if (languages.length > 0 && !(rows[index].values[0] || '').trim()) {
        rows[index].values[0] = newKey;
        const enInput = document.querySelector(`#dataTable input[data-row-index="${index}"][data-lang-index="0"]`);
        if (enInput) {
            enInput.value = newKey;
            const td = enInput.closest('td');
            td?.classList.remove('empty-cell');
            td?.querySelector('.translate-btn')?.remove();
        }
    }
}

function updateValue(index, langIndex, newValue) {
    while (rows[index].values.length <= langIndex) {
        rows[index].values.push('');
    }
    rows[index].values[langIndex] = newValue;
}

function updateComment(index, newComment) {
    rows[index].content = newComment;
}

function deleteRowIfEmpty(index) {
    const row = rows[index];
    if (!row) return;
    const isEmpty = row.type === 'data'
        ? !row.key.trim()
        : !row.content.replace(/^\/\/\s*/, '').trim();
    if (!isEmpty) return;
    rows.splice(index, 1);
    filteredRows = getDataRows();
    renderTable();
    updateStats();
}

function addNewRow() {
    rows.push({ type: 'data', key: '', values: new Array(languages.length).fill('') });
    filteredRows = getDataRows();
    goToLastPage();
    updateStats();
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) tableContainer.scrollTop = tableContainer.scrollHeight;
    const lastRow = document.querySelector('#dataTable tbody tr:last-child');
    if (lastRow) lastRow.querySelector('td:nth-child(2) input')?.focus();
}

function addNewComment() {
    rows.push({ type: 'comment', content: '// ' });
    filteredRows = getDataRows();
    goToLastPage();
    updateStats();
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) tableContainer.scrollTop = tableContainer.scrollHeight;
    const lastRow = document.querySelector('#dataTable tbody tr:last-child');
    const input = lastRow?.querySelector('input');
    if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
}

function buildFileContent() {
    let content = '';

    rows.forEach(row => {
        if (row.type === 'header') {
            content += row.content + '\n';
        } else if (row.type === 'empty') {
            content += '\n';
        } else if (row.type === 'comment') {
            content += row.content + '\n';
        } else if (row.type === 'data') {
            const values = [...row.values];
            while (values.length < languages.length) {
                values.push('');
            }
            content += row.key + '\t' + values.join('\t') + '\n';
        }
    });

    if (content.endsWith('\n')) {
        content = content.slice(0, -1);
    }

    return content;
}

function downloadFile() {
    const content = buildFileContent();
    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function createBackup() {
    const content = buildFileContent();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const backupFilename = `efficy_labels_bkp_${year}${month}${day}${hours}${minutes}${seconds}.txt`;

    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function openDeepL() {
    window.open('https://www.deepl.com/translator', '_blank');
}

function handleSearchInput() {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
        filterTable();
    }, 150);
}

function fuzzyMatch(text, pattern) {
    if (!pattern) return true;

    text = text.toLowerCase();
    pattern = pattern.toLowerCase();

    let patternIdx = 0;
    let textIdx = 0;

    while (textIdx < text.length && patternIdx < pattern.length) {
        if (text[textIdx] === pattern[patternIdx]) {
            patternIdx++;
        }
        textIdx++;
    }

    return patternIdx === pattern.length;
}

function exactMatch(text, pattern) {
    if (!pattern) return true;
    return text.toLowerCase().includes(pattern.toLowerCase());
}

function filterTable() {
    let searchTerm = searchInput.value.trim();

    const isExactMatch = searchTerm.startsWith('"') && searchTerm.endsWith('"') && searchTerm.length > 1;
    if (isExactMatch) {
        searchTerm = searchTerm.slice(1, -1);
    }

    const matchFunc = isExactMatch ? exactMatch : fuzzyMatch;

    if (!searchTerm) {
        filteredRows = getDataRows();
    } else {
        filteredRows = getDataRows().filter(({ row }) => {
            if (matchFunc(row.key || '', searchTerm)) return true;
            if (row.values) {
                for (const value of row.values) {
                    if (matchFunc(value || '', searchTerm)) return true;
                }
            }
            if (row.content && matchFunc(row.content, searchTerm)) return true;
            return false;
        });
    }

    currentPage = 1;
    document.querySelector('.table-container').scrollTop = 0;
    renderTable();
    updateStats();
}

function updateStats() {
    const totalDataRows = rows.filter(r => r.type === 'data').length;
    const visibleRows = filteredRows.filter(item => item.row.type === 'data').length;

    if (searchInput.value.trim()) {
        rowCount.textContent = `${visibleRows} / ${totalDataRows}`;
    } else {
        rowCount.textContent = totalDataRows;
    }

    langCount.textContent = languages.length;
}

// ── API Key management ──────────────────────────────────────────────

function updateApiKeyButton() {
    const btn = document.getElementById('apiKeyBtn');
    if (anthropicApiKey) {
        btn.textContent = '✨ AI Translate ✓';
        btn.className = 'btn btn-api-set';
    } else {
        btn.textContent = '✨ AI Translate';
        btn.className = 'btn btn-secondary';
    }
}

function openApiKeyModal() {
    const input = document.getElementById('apiKeyInput');
    input.value = anthropicApiKey;
    input.type = 'password';
    document.getElementById('clearKeyBtn').classList.toggle('hidden', !anthropicApiKey);
    document.getElementById('apiKeyModal').classList.remove('hidden');
    setTimeout(() => input.focus(), 50);
}

function closeApiKeyModal() {
    document.getElementById('apiKeyModal').classList.add('hidden');
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function saveApiKey() {
    const val = document.getElementById('apiKeyInput').value.trim();
    if (!val) { alert('Please enter an API key.'); return; }
    localStorage.setItem('anthropicApiKey', val);
    anthropicApiKey = val;
    updateApiKeyButton();
    closeApiKeyModal();
    renderTable();
}

function clearApiKey() {
    if (!confirm('Remove your saved API key?')) return;
    localStorage.removeItem('anthropicApiKey');
    anthropicApiKey = '';
    updateApiKeyButton();
    closeApiKeyModal();
    renderTable();
}

document.getElementById('apiKeyModal').addEventListener('click', function(e) {
    if (e.target === this) closeApiKeyModal();
});

// ── Cell translation ────────────────────────────────────────────────

function handleValueInput(input) {
    const wrapper = input.parentElement;
    let btn = wrapper.querySelector('.translate-btn');

    if (input.value) {
        if (btn) btn.style.display = 'none';
    } else {
        if (btn) {
            btn.style.display = '';
        } else if (anthropicApiKey) {
            const rowIndex = input.dataset.rowIndex;
            const langIndex = input.dataset.langIndex;
            btn = document.createElement('button');
            btn.className = 'translate-btn';
            btn.title = 'Translate with Claude AI';
            btn.textContent = '✨';
            btn.setAttribute('onclick', `translateCell(${rowIndex}, ${langIndex}, this)`);
            wrapper.appendChild(btn);
        }
    }
}

async function translateCell(rowIndex, langIndex, btn) {
    if (!anthropicApiKey) { openApiKeyModal(); return; }

    const row = rows[rowIndex];
    const targetLang = languages[langIndex];

    const context = languages
        .map((lang, i) => (row.values[i] || '').trim() ? `${lang}: ${row.values[i]}` : null)
        .filter(Boolean).join('\n');

    btn.disabled = true;
    btn.textContent = '⏳';

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicApiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 256,
                messages: [{
                    role: 'user',
                    content: `You are a translation assistant for a CRM software UI localization file. The application is Efficy CRM, which manages business entities such as contacts, companies, documents, opportunities, projects, actions, and meetings. Labels are short UI strings (button labels, field names, menu items, tooltips, status messages).

Translate the following label value into ${targetLang}.

Label key: ${row.key}${context ? `\nExisting translations:\n${context}` : ''}

Reply with ONLY the translated text — no quotes, no explanation.`
                }]
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const translation = data.content[0].text.trim();

        updateValue(rowIndex, langIndex, translation);
        const input = btn.parentElement.querySelector('input');
        input.value = translation;
        btn.style.display = 'none';

    } catch (err) {
        btn.disabled = false;
        btn.textContent = '✨';
        alert(`Translation failed: ${err.message}`);
    }
}

async function translateRow(rowIndex, btn) {
    if (!anthropicApiKey) { openApiKeyModal(); return; }

    const row = rows[rowIndex];
    const emptyLangIndexes = languages
        .map((_, i) => i)
        .filter(i => !(row.values[i] || '').trim());

    if (emptyLangIndexes.length === 0) return;

    btn.disabled = true;
    btn.textContent = '⏳';

    try {
        for (const langIndex of emptyLangIndexes) {
            const targetLang = languages[langIndex];
            const context = languages
                .map((lang, i) => (row.values[i] || '').trim() ? `${lang}: ${row.values[i]}` : null)
                .filter(Boolean).join('\n');

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': anthropicApiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 256,
                    messages: [{
                        role: 'user',
                        content: `You are a translation assistant for a CRM software UI localization file. The application is Efficy CRM, which manages business entities such as contacts, companies, documents, opportunities, projects, actions, and meetings. Labels are short UI strings (button labels, field names, menu items, tooltips, status messages).

Translate the following label value into ${targetLang}.

Label key: ${row.key}${context ? `\nExisting translations:\n${context}` : ''}

Reply with ONLY the translated text — no quotes, no explanation.`
                    }]
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const translation = data.content[0].text.trim();

            updateValue(rowIndex, langIndex, translation);

            const input = document.querySelector(`input[data-row-index="${rowIndex}"][data-lang-index="${langIndex}"]`);
            if (input) {
                input.value = translation;
                const cellBtn = input.parentElement.querySelector('.translate-btn');
                if (cellBtn) cellBtn.style.display = 'none';
            }
        }

        btn.remove();
    } catch (err) {
        btn.disabled = false;
        btn.textContent = '✨';
        alert(`Translation failed: ${err.message}`);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── Column expand on focus ───────────────────────────────────────

function expandColumn(colId) {
    clearTimeout(collapseTimeout);

    const keyTh = dataTable.querySelector('th[data-key-col]');
    if (keyTh) {
        const active = colId === 'key';
        keyTh.style.minWidth = active ? '400px' : '';
        keyTh.classList.toggle('col-active', active);
    }

    dataTable.querySelectorAll('th[data-lang-col]').forEach((th, i) => {
        const active = i === colId;
        th.style.minWidth = active ? '400px' : '';
        th.classList.toggle('col-active', active);
    });
}

function collapseColumn() {
    collapseTimeout = setTimeout(() => {
        const keyTh = dataTable.querySelector('th[data-key-col]');
        if (keyTh) { keyTh.style.minWidth = ''; keyTh.classList.remove('col-active'); }
        dataTable.querySelectorAll('th[data-lang-col]').forEach(th => {
            th.style.minWidth = '';
            th.classList.remove('col-active');
        });
    }, 150);
}

// popup.js
// Extension popup: displays the 12×6 tactile grid and handles user interaction.
//
// Short press (click):      reads the cell aloud via Web Speech API
// Long press (500 ms hold): sends TACTILE_CELL_ACTIVATE → content script → DOM click/focus

'use strict';

const GRID_WIDTH  = 12;
const GRID_HEIGHT = 6;

// ─── DOM references ───────────────────────────────────────────────────────────

const gridContainer = document.getElementById('grid');
const infoPanel     = document.getElementById('info');
const perfPanel     = document.getElementById('perf');

// ─── State ────────────────────────────────────────────────────────────────────

let latestMetadataGrid = null;

// ─── Grid creation ────────────────────────────────────────────────────────────

function createGrid() {
    gridContainer.innerHTML = '';

    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.x = x;
            cell.dataset.y = y;

            // Hover: show metadata in info panel
            cell.addEventListener('mouseenter', onCellHover);

            // Short press (click): read aloud
            cell.addEventListener('click', onCellClick);

            // Long press: activate element
            setupLongPress(cell);

            gridContainer.appendChild(cell);
        }
    }
}

// ─── Grid rendering ───────────────────────────────────────────────────────────

function renderGrid(grid, metadataGrid) {
    latestMetadataGrid = metadataGrid;
    if (!grid) return;

    const cells = document.querySelectorAll('.cell');

    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const index = y * GRID_WIDTH + x;
            const cell  = cells[index];
            if (!cell) continue;

            const raised = !!grid[y][x];
            cell.classList.toggle('raised', raised);

            // Accessibility: announce raised cells
            cell.setAttribute('aria-pressed', raised ? 'true' : 'false');

            // Tooltip for sighted debugging
            const meta = metadataGrid?.[y]?.[x];
            cell.title = meta ? `[${meta.type}] ${meta.text.slice(0, 60)}` : '';
        }
    }
}

// ─── Hover inspection ─────────────────────────────────────────────────────────

function onCellHover(e) {
    const x    = parseInt(e.target.dataset.x, 10);
    const y    = parseInt(e.target.dataset.y, 10);
    const meta = latestMetadataGrid?.[y]?.[x];

    if (!meta) {
        infoPanel.innerHTML = '<em>Empty cell</em>';
        return;
    }

    infoPanel.innerHTML =
        `<b>Type:</b> ${escapeHtml(meta.type)}<br>` +
        `<b>Tag:</b>  ${escapeHtml(meta.tag)}<br>`  +
        `<b>Interactive:</b> ${meta.interactive}<br>` +
        `<b>Text:</b> ${escapeHtml((meta.text || '').slice(0, 120))}`;
}

// ─── Short press → TTS ────────────────────────────────────────────────────────

function onCellClick(e) {
    const x    = parseInt(e.target.dataset.x, 10);
    const y    = parseInt(e.target.dataset.y, 10);
    const meta = latestMetadataGrid?.[y]?.[x];

    if (!meta) { speak('Empty'); return; }

    const label = buildSpeechLabel(meta);
    speak(label);
}

function buildSpeechLabel(meta) {
    const typeLabel = {
        button: 'Button',
        input:  'Input field',
        header: 'Heading',
        image:  'Image',
        nav:    'Navigation',
        text:   'Text',
    }[meta.type] || meta.type;

    const content = meta.text || '';
    return `${typeLabel}. ${content}`.trim();
}

// Web Speech – call from a user gesture so Chrome allows it.
// The popup itself provides the gesture context, so this works reliably.
function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate   = 1.1;
    utt.volume = 1.0;
    window.speechSynthesis.speak(utt);
}

// ─── Long press → activate element ───────────────────────────────────────────

function setupLongPress(cell) {
    let timer = null;

    const start = () => {
        timer = setTimeout(() => {
            timer = null;
            onCellLongPress(cell);
        }, 500);
    };

    const cancel = () => {
        if (timer) { clearTimeout(timer); timer = null; }
    };

    cell.addEventListener('mousedown',   start);
    cell.addEventListener('mouseup',     cancel);
    cell.addEventListener('mouseleave',  cancel);
    cell.addEventListener('touchstart',  start,  { passive: true });
    cell.addEventListener('touchend',    cancel);
    cell.addEventListener('touchcancel', cancel);
}

function onCellLongPress(cell) {
    const x = parseInt(cell.dataset.x, 10);
    const y = parseInt(cell.dataset.y, 10);

    // Visual feedback
    cell.classList.add('activating');
    setTimeout(() => cell.classList.remove('activating'), 400);

    chrome.runtime.sendMessage(
        { type: 'TACTILE_CELL_ACTIVATE', x, y },
        (response) => {
            if (chrome.runtime.lastError) {
                speak('Could not activate element.');
                return;
            }
            if (response?.ok) {
                speak('Activated.');
            } else {
                speak('No element here.');
            }
        }
    );
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TACTILE_ELEMENTS_UPDATE') {
        renderGrid(message.tactileGrid, message.metadataGrid);

        if (message.perfMs && perfPanel) {
            perfPanel.textContent =
                `Extract: ${message.perfMs.extract.toFixed(1)} ms | ` +
                `Map: ${message.perfMs.map.toFixed(1)} ms`;
        }
    }
});

// ─── Hardware key events (via background → content already handled,
//     but serial key messages also arrive via chrome.runtime) ─────────────────

// If the bridge forwards hardware key events as chrome runtime messages,
// handle them here.  Format: { type: 'HARDWARE_KEY', row, col, press: 'S'|'L' }
chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'HARDWARE_KEY') return;

    const x = message.col;
    const y = message.row;

    if (message.press === 'S') {
        // Short press → TTS
        const meta = latestMetadataGrid?.[y]?.[x];
        speak(meta ? buildSpeechLabel(meta) : 'Empty');
    } else if (message.press === 'L') {
        // Long press → activate
        chrome.runtime.sendMessage({ type: 'TACTILE_CELL_ACTIVATE', x, y });
    }
});

// ─── Initialise ───────────────────────────────────────────────────────────────

createGrid();

// Ask the content script to re-render immediately so the popup is populated
// without waiting for the next DOM mutation.
chrome.runtime.sendMessage({ type: 'TACTILE_REQUEST_LATEST' });

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
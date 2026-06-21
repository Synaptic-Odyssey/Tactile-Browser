// ─── Constants ───────────────────────────────────────────────────────────────

const GRID_WIDTH       = 12;
const GRID_HEIGHT      = 6;
const MAX_ELEMENTS     = 32;
const MAX_SEARCH_RADIUS = 3;
const DEBOUNCE_SCROLL  = 120;   // ms
const DEBOUNCE_MUTATION = 200;  // ms
const DEBOUNCE_RESIZE  = 200;   // ms
const WS_RECONNECT_DELAY = 2000; // ms

// Minimum fraction of grid cells that must change before we send an update.
// Prevents continuous sends from micro-mutations (e.g. cursor blink, badge
// counters) that don't meaningfully alter the tactile layout.
const CHANGE_THRESHOLD = 0.05;   // 5 % of 72 cells ≈ 4 cells

// ─── Logging / Measurement ───────────────────────────────────────────────────
// Set TACTILE_DEBUG=true in localStorage to enable verbose perf logging.

const DEBUG = (() => {
    try { return localStorage.getItem('TACTILE_DEBUG') === 'true'; }
    catch { return false; }
})();

function log(...args) {
    if (DEBUG) console.log('[TactileBrowser]', ...args);
}

/**
 * Wrap a synchronous function with performance timing.
 * Returns { result, ms }.
 */
function timed(label, fn) {
    const t0 = performance.now();
    const result = fn();
    const ms = performance.now() - t0;
    log(`${label}: ${ms.toFixed(2)} ms`);
    return { result, ms };
}

// ─── WebSocket (with auto-reconnect) ─────────────────────────────────────────

let socket = null;
let wsReady = false;

function connectWebSocket() {
    socket = new WebSocket('ws://localhost:8765');

    socket.onopen = () => {
        wsReady = true;
        log('WebSocket connected');
    };

    socket.onerror = (err) => {
        wsReady = false;
        log('WebSocket error', err);
    };

    socket.onclose = () => {
        wsReady = false;
        log('WebSocket closed – reconnecting in', WS_RECONNECT_DELAY, 'ms');
        setTimeout(connectWebSocket, WS_RECONNECT_DELAY);
    };
}

//connectWebSocket();

// ─── Semantic element selectors & patterns ───────────────────────────────────

const SEMANTIC_SELECTORS = [
    'button', 'a',
    'input', 'textarea', 'select',
    'img', 'video',
    'h1', 'h2', 'h3', 'h4',
    'p', 'article', 'section',
    '[role="button"]', '[role="link"]', '[role="textbox"]',
    'nav',
];

/** Tactile patterns: 1 = raised cell, 0 = gap. */
const TACTILE_PATTERNS = {
    button: [[1]],
    input:  [[1, 1], [1, 0]],
    header: [[1, 1, 1]],
    image:  [[0, 1], [1, 1]],
    nav:    [[1], [1]],
    text:   [[1, 1]],
};

const TYPE_PRIORITY = {
    header: 10,
    input:  9,
    button: 8,
    nav:    7,
    image:  6,
    text:   5,
};

// ─── Element classification ───────────────────────────────────────────────────

function classify(el) {
    const tag  = el.tagName.toLowerCase();
    const role = el.getAttribute('role');

    if (tag === 'button' || tag === 'a' || role === 'button' || role === 'link') return 'button';
    if (tag === 'input'  || tag === 'textarea' || tag === 'select')               return 'input';
    if (['h1','h2','h3','h4'].includes(tag))                                       return 'header';
    if (tag === 'img'    || tag === 'video')                                       return 'image';
    if (tag === 'p'      || tag === 'article' || tag === 'section')                return 'text';
    if (tag === 'nav')                                                             return 'nav';
    return null;
}

function isVisible(el) {
    const rect  = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
        rect.width  > 24 &&
        rect.height > 16 &&
        rect.bottom > 0 &&
        rect.top    < window.innerHeight &&
        rect.right  > 0 &&
        rect.left   < window.innerWidth &&
        style.display     !== 'none' &&
        style.visibility  !== 'hidden' &&
        parseFloat(style.opacity) > 0
    );
}

function getAccessibleText(el) {
    return (
        el.getAttribute('aria-label') ||
        el.innerText ||
        el.alt ||
        el.value ||
        el.placeholder ||
        ''
    ).replace(/\s+/g, ' ').trim();
}

// ─── DOM extraction ───────────────────────────────────────────────────────────

function extractSemanticElements() {
    const elements = [];
    const seen     = new Set();

    for (const selector of SEMANTIC_SELECTORS) {
        for (const el of document.querySelectorAll(selector)) {
            if (seen.has(el)) continue;
            seen.add(el);

            if (!isVisible(el)) continue;

            const rect = el.getBoundingClientRect();
            const text = getAccessibleText(el);
            const tag  = el.tagName.toLowerCase();

            // Skip tiny elements
            if (rect.width < 30 || rect.height < 18) continue;

            // Skip near-full-viewport elements (likely background containers)
            if (
                rect.width  > window.innerWidth  * 0.95 &&
                rect.height > window.innerHeight * 0.95
            ) continue;

            // Text-only elements need meaningful content
            if (
                text.length < 12 &&
                !['img','video'].includes(tag)
            ) continue;

            const type = classify(el);
            if (!type) continue;

            // Assign a stable tactile ID so metadata stays consistent across renders
            if (!el.dataset.tactileId) {
                el.dataset.tactileId = Math.random().toString(36).slice(2);
            }

            const isInteractive =
                !!el.onclick ||
                el.getAttribute('tabindex') !== null ||
                ['button','a','input','textarea','select'].includes(tag);

            elements.push({
                tactileId:   el.dataset.tactileId,
                type,
                text,
                tag,
                interactive: isInteractive,
                position: {
                    x:      rect.left,
                    y:      rect.top,
                    width:  rect.width,
                    height: rect.height,
                },
            });
        }
    }

    return elements;
}

// ─── Scoring / ranking ────────────────────────────────────────────────────────

function scoreElement(el) {
    const area            = el.position.width * el.position.height;
    const normalizedArea  = Math.min(area, 150_000);
    const interactiveBoost = el.interactive ? 5_000 : 0;
    const textBoost       = Math.min((el.text || '').length, 100) * 15;
    const headerBoost     = el.type === 'header' ? 8_000 : 0;
    const controlBoost    = (el.type === 'button' || el.type === 'input') ? 6_000 : 0;
    const giantPenalty    = area > window.innerWidth * window.innerHeight * 0.35 ? -12_000 : 0;

    return (
        (TYPE_PRIORITY[el.type] || 0) * 10_000 +
        interactiveBoost +
        textBoost +
        headerBoost +
        controlBoost +
        normalizedArea * 0.02 +
        giantPenalty
    );
}

// ─── Grid utilities ───────────────────────────────────────────────────────────

function createGrid()         { return Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(0)); }
function createMetadataGrid() { return Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(null)); }

function viewportToGrid(x, y) {
    return {
        gx: Math.max(0, Math.min(GRID_WIDTH  - 1, Math.floor((x / window.innerWidth)  * GRID_WIDTH))),
        gy: Math.max(0, Math.min(GRID_HEIGHT - 1, Math.floor((y / window.innerHeight) * GRID_HEIGHT))),
    };
}

/**
 * Check whether a pattern can be placed at (gx, gy) in the grid.
 * Enforces the orthogonal-adjacency constraint (no two raised cells
 * may be orthogonally adjacent, even from different elements).
 */
function canPlace(grid, pattern, gx, gy) {
    for (let py = 0; py < pattern.length; py++) {
        for (let px = 0; px < pattern[py].length; px++) {
            if (!pattern[py][px]) continue;

            const x = gx + px;
            const y = gy + py;

            if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
            if (grid[y][x]) return false;

            for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
                if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT && grid[ny][nx]) {
                    return false;
                }
            }
        }
    }
    return true;
}

function findNearestSpot(grid, pattern, idealX, idealY) {
    for (let radius = 0; radius <= MAX_SEARCH_RADIUS; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const gx = idealX + dx;
                const gy = idealY + dy;
                if (canPlace(grid, pattern, gx, gy)) return { gx, gy };
            }
        }
    }
    return null;
}

// ─── Change detection ─────────────────────────────────────────────────────────

/**
 * Serialise a binary grid to a compact string for cheap equality checks.
 * e.g. "010011000000..." (72 chars for 12×6)
 */
function gridToString(grid) {
    return grid.map(row => row.join('')).join('');
}

let previousGridString = '';

/**
 * Returns the fraction of cells that changed between the last sent grid and
 * the new one.  Returns 1.0 on the very first call.
 */
function changeFraction(newGrid) {
    const s = gridToString(newGrid);
    if (!previousGridString) { previousGridString = s; return 1.0; }

    let diff = 0;
    const total = s.length;
    for (let i = 0; i < total; i++) {
        if (s[i] !== previousGridString[i]) diff++;
    }
    return diff / total;
}

// ─── Core render pipeline ─────────────────────────────────────────────────────

let latestGrid         = null;
let latestMetadataGrid = null;

/**
 * Full render cycle:
 *   1. Extract & rank semantic elements  (timed)
 *   2. Place elements into the grid      (timed)
 *   3. Diff against previous grid
 *   4. If changed enough → send via WS + chrome message
 *
 * @param {boolean} force  Skip change threshold check (e.g. initial load).
 */
function renderSemanticGrid(force = false) {
    // ── 1. Extraction ──
    const { result: rawElements, ms: extractMs } =
        timed('DOM extraction', extractSemanticElements);

    // ── 2. Ranking ──
    const { result: semantic } = timed('Ranking', () => {
        return rawElements
            .sort((a, b) => scoreElement(b) - scoreElement(a))
            .slice(0, MAX_ELEMENTS);
    });

    // ── 3. Placement ──
    const { result: { grid, metadataGrid }, ms: mapMs } =
        timed('Grid mapping', () => {
            const g  = createGrid();
            const mg = createMetadataGrid();

            for (const el of semantic) {
                const pattern = TACTILE_PATTERNS[el.type];
                if (!pattern) continue;

                const centerX = el.position.x + el.position.width  / 2;
                const centerY = el.position.y + el.position.height / 2;
                const { gx, gy } = viewportToGrid(centerX, centerY);
                const nearest = findNearestSpot(g, pattern, gx, gy);
                if (!nearest) continue;

                for (let py = 0; py < pattern.length; py++) {
                    for (let px = 0; px < pattern[py].length; px++) {
                        if (!pattern[py][px]) continue;
                        const x = nearest.gx + px;
                        const y = nearest.gy + py;
                        g[y][x]  = 1;
                        mg[y][x] = el;
                    }
                }
            }

            return { grid: g, metadataGrid: mg };
        });

    // ── 4. Change detection ──
    const fraction = changeFraction(grid);
    const changed  = fraction >= CHANGE_THRESHOLD;

    log(`Change fraction: ${(fraction * 100).toFixed(1)}% | ` +
        `Extract: ${extractMs.toFixed(1)} ms | Map: ${mapMs.toFixed(1)} ms | ` +
        `Will send: ${force || changed}`);

    if (!force && !changed) return;

    previousGridString = gridToString(grid);
    latestGrid         = grid;
    latestMetadataGrid = metadataGrid;

    // ── 5. Serial send (top-left 3×6 sub-grid) ──
    // if (wsReady) {
    //     let serialString = '';
    //     for (let r = 0; r < 3; r++) {
    //         for (let c = 0; c < 6; c++) {
    //             serialString += grid[r][c] ? '1' : '0';
    //         }
    //     }
    //     socket.send(serialString);
    //     log('Sent serial string:', serialString);
    // }

    // ── 6. Popup / background message ──
    chrome.runtime.sendMessage({
        type:         'TACTILE_ELEMENTS_UPDATE',
        tactileGrid:  grid,
        metadataGrid,
        url:          location.href,
        timestamp:    Date.now(),
        perfMs: {
            extract: extractMs,
            map:     mapMs,
        },
    });
}

// ─── Debounce helper ──────────────────────────────────────────────────────────

function debounce(fn, wait) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

// ─── Event listeners ─────────────────────────────────────────────────────────

// Initial render (forced)
renderSemanticGrid(true);

window.addEventListener('scroll', debounce(() => renderSemanticGrid(), DEBOUNCE_SCROLL));
window.addEventListener('resize', debounce(() => renderSemanticGrid(), DEBOUNCE_RESIZE));

// MutationObserver: only re-render on subtree changes that add/remove nodes
// or alter meaningful attributes. Ignore style/class churn (e.g. hover states,
// cursor blinks, live-region updates) that don't affect layout or content.
const IGNORED_MUTATION_ATTRS = new Set(['class', 'style', 'aria-live', 'data-tactile-id']);

const observer = new MutationObserver(debounce((mutations) => {
    const meaningful = mutations.some(m => {
        if (m.type === 'childList')  return m.addedNodes.length > 0 || m.removedNodes.length > 0;
        if (m.type === 'attributes') return !IGNORED_MUTATION_ATTRS.has(m.attributeName);
        if (m.type === 'characterData') return true;
        return false;
    });
    if (meaningful) renderSemanticGrid();
}, DEBOUNCE_MUTATION));

observer.observe(document.body, {
    childList:     true,
    subtree:       true,
    attributes:    true,
    characterData: true,
    attributeFilter: [
        // Attributes whose change genuinely affects tactile output
        'aria-label', 'aria-hidden', 'aria-disabled',
        'disabled', 'hidden', 'href', 'src', 'alt', 'value',
        'placeholder', 'role', 'tabindex',
    ],
});

// ─── Incoming messages from popup ────────────────────────────────────────────
// Handles cell-interaction requests: short press (read) and long press (act).

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'TACTILE_CELL_READ') {
        // Short press: return the metadata for the cell so the popup can
        // pass it to TTS.
        const { x, y } = message;
        const meta = latestMetadataGrid?.[y]?.[x];
        sendResponse({ meta: meta ?? null });
        return true;
    }

    if (message.type === 'TACTILE_CELL_ACTIVATE') {
        // Long press: programmatically click/focus the element.
        const { x, y } = message;
        const meta = latestMetadataGrid?.[y]?.[x];
        if (!meta) { sendResponse({ ok: false, reason: 'no element' }); return true; }

        // Re-query by tactileId so we always act on the live DOM node.
        const el = document.querySelector(`[data-tactile-id="${meta.tactileId}"]`);
        if (!el) { sendResponse({ ok: false, reason: 'element not found' }); return true; }

        if (meta.type === 'input' || meta.type === 'textarea' || meta.type === 'select') {
            el.focus();
        } else {
            el.click();
        }

        sendResponse({ ok: true });
        return true;
    }
});
const socket = new WebSocket(
    "ws://localhost:8765"
);

socket.onopen = () => {

    console.log(
        "WebSocket connected"
    );
};

socket.onerror = (err) => {

    console.error(
        "WebSocket error:",
        err
    );
};

socket.onclose = () => {

    console.warn(
        "WebSocket closed"
    );
};

const GRID_WIDTH = 12;
const GRID_HEIGHT = 6;

const semanticSelectors = [

    'button',
    'a',

    'input',
    'textarea',
    'select',

    'img',
    'video',

    'h1',
    'h2',
    'h3',
    'h4',

    'p',
    'article',
    'section',

    '[role="button"]',
    '[role="link"]',
    '[role="textbox"]',

    'nav'
];

const tactilePatterns = {

    button: [
        [1]
    ],

    input: [
        [1,1],
        [1,0]
    ],

    header: [
        [1,1,1]
    ],

    image: [
        [0,1],
        [1,1]
    ],

    nav: [
        [1],
        [1]
    ],

    text: [
        [1,1]
    ]
};

const typePriority = {

    header: 10,

    input: 9,

    button: 8,

    nav: 7,

    image: 6,

    text: 5
};

const MAX_ELEMENTS = 28;

const MAX_SEARCH_RADIUS = 2;

let latestGrid = null;
let latestMetadataGrid = null;

function debounce(func, wait) {

    let timeout;

    return function () {

        clearTimeout(timeout);

        timeout = setTimeout(() => {
            func.apply(this, arguments);
        }, wait);
    };
}

function isVisible(el) {

    const rect =
        el.getBoundingClientRect();

    const style =
        getComputedStyle(el);

    return (

        rect.width > 24 &&
        rect.height > 16 &&

        rect.bottom > 0 &&
        rect.top < window.innerHeight &&

        rect.right > 0 &&
        rect.left < window.innerWidth &&

        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) !== 0
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

function classify(el) {

    const tag =
        el.tagName.toLowerCase();

    const role =
        el.getAttribute('role');

    if (
        tag === 'button' ||
        tag === 'a' ||
        role === 'button' ||
        role === 'link'
    ) {
        return 'button';
    }

    if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select'
    ) {
        return 'input';
    }

    if (
        ['h1','h2','h3','h4']
        .includes(tag)
    ) {
        return 'header';
    }

    if (
        tag === 'img' ||
        tag === 'video'
    ) {
        return 'image';
    }

    if (
        tag === 'p' ||
        tag === 'article' ||
        tag === 'section'
    ) {
        return 'text';
    }

    if (tag === 'nav') {
        return 'nav';
    }

    return null;
}

function extractSemanticElements() {

    const elements = [];

    const seen = new Set();

    for (const selector of semanticSelectors) {

        const matches =
            document.querySelectorAll(selector);

        for (const el of matches) {

            if (seen.has(el))
                continue;

            seen.add(el);

            if (!isVisible(el))
                continue;

            const rect =
                el.getBoundingClientRect();

            const text =
                getAccessibleText(el);

            if (
                text.length < 12 &&
                !['img', 'video']
                .includes(el.tagName.toLowerCase())
            ) {
                continue;
            }

            if (
                rect.width < 30 ||
                rect.height < 18
            ) {
                continue;
            }

            if (
                rect.width >
                    window.innerWidth * 0.95 &&
                rect.height >
                    window.innerHeight * 0.95
            ) {
                continue;
            }

            if (!el.dataset.tactileId) {

                el.dataset.tactileId =
                    Math.random()
                    .toString(36)
                    .slice(2);
            }

            const type =
                classify(el);

            if (!type)
                continue;

            elements.push({

                tactileId:
                    el.dataset.tactileId,

                type,

                text,

                tag:
                    el.tagName.toLowerCase(),

                interactive:
                    (
                        !!el.onclick ||

                        el.tagName.toLowerCase()
                            === 'button' ||

                        el.tagName.toLowerCase()
                            === 'a'
                    ),

                position: {

                    x: rect.left,

                    y: rect.top,

                    width: rect.width,

                    height: rect.height
                }
            });
        }
    }

    return elements;
}

function viewportToGrid(x, y) {

    return {

        gx: Math.max(
            0,
            Math.min(
                GRID_WIDTH - 1,

                Math.floor(
                    (x / window.innerWidth)
                    * GRID_WIDTH
                )
            )
        ),

        gy: Math.max(
            0,
            Math.min(
                GRID_HEIGHT - 1,

                Math.floor(
                    (y / window.innerHeight)
                    * GRID_HEIGHT
                )
            )
        )
    };
}

function createGrid() {

    return Array.from(

        { length: GRID_HEIGHT },

        () => Array(GRID_WIDTH).fill(0)
    );
}

function createMetadataGrid() {

    return Array.from(

        { length: GRID_HEIGHT },

        () => Array(GRID_WIDTH).fill(null)
    );
}

function canPlace(
    grid,
    pattern,
    gx,
    gy
) {

    for (let py = 0; py < pattern.length; py++) {

        for (let px = 0; px < pattern[py].length; px++) {

            if (!pattern[py][px])
                continue;

            const x = gx + px;
            const y = gy + py;

            if (
                x < 0 ||
                x >= GRID_WIDTH ||
                y < 0 ||
                y >= GRID_HEIGHT
            ) {
                return false;
            }

            if (grid[y][x]) {
                return false;
            }

            const orthogonal = [

                [x+1, y],
                [x-1, y],
                [x, y+1],
                [x, y-1]
            ];

            for (const [nx, ny] of orthogonal) {

                if (
                    nx >= 0 &&
                    nx < GRID_WIDTH &&
                    ny >= 0 &&
                    ny < GRID_HEIGHT
                ) {

                    if (grid[ny][nx]) {
                        return false;
                    }
                }
            }
        }
    }

    return true;
}

function findNearestSpot(
    grid,
    pattern,
    idealX,
    idealY
) {

    for (
        let radius = 0;
        radius <= MAX_SEARCH_RADIUS;
        radius++
    ) {

        for (
            let dy = -radius;
            dy <= radius;
            dy++
        ) {

            for (
                let dx = -radius;
                dx <= radius;
                dx++
            ) {

                const gx = idealX + dx;
                const gy = idealY + dy;

                if (
                    canPlace(
                        grid,
                        pattern,
                        gx,
                        gy
                    )
                ) {

                    return { gx, gy };
                }
            }
        }
    }

    return null;
}

function renderSemanticGrid() {

    let semantic =
        extractSemanticElements();

    semantic.sort((a, b) => {

        function score(el) {

            const semanticPriority =
                typePriority[el.type] || 0;

            const area =
                el.position.width *
                el.position.height;

            const normalizedArea =
                Math.min(area, 150000);

            const interactiveBoost =
                el.interactive
                ? 5000
                : 0;

            const textBoost =
                Math.min(
                    (el.text || '').length,
                    100
                ) * 15;

            const headerBoost =
                el.type === 'header'
                ? 8000
                : 0;

            const controlBoost =
                (
                    el.type === 'button' ||
                    el.type === 'input'
                )
                ? 6000
                : 0;

            const giantPenalty =
                area > (
                    window.innerWidth *
                    window.innerHeight *
                    0.35
                )
                ? -12000
                : 0;

            return (

                semanticPriority * 10000 +

                interactiveBoost +

                textBoost +

                headerBoost +

                controlBoost +

                normalizedArea * 0.02 +

                giantPenalty
            );
        }

        return score(b) - score(a);
    });

    semantic =
        semantic.slice(
            0,
            MAX_ELEMENTS
        );

    const grid =
        createGrid();

    const metadataGrid =
        createMetadataGrid();

    for (const el of semantic) {

        const pattern =
            tactilePatterns[el.type];

        if (!pattern)
            continue;

        const centerX =
            el.position.x +
            el.position.width / 2;

        const centerY =
            el.position.y +
            el.position.height / 2;

        const {
            gx,
            gy
        } = viewportToGrid(
            centerX,
            centerY
        );

        const nearest =
            findNearestSpot(
                grid,
                pattern,
                gx,
                gy
            );

        if (!nearest)
            continue;

        for (
            let py = 0;
            py < pattern.length;
            py++
        ) {

            for (
                let px = 0;
                px < pattern[py].length;
                px++
            ) {

                if (!pattern[py][px])
                    continue;

                const x =
                    nearest.gx + px;

                const y =
                    nearest.gy + py;

                grid[y][x] = 1;

                metadataGrid[y][x] = el;
            }
        }
    }

    latestGrid = grid;
    latestMetadataGrid =
        metadataGrid;

    if (socket.readyState === WebSocket.OPEN) {

        let serialString = '';

        for (let r = 0; r < 3; r++) {

            for (let c = 0; c < 6; c++) {

                serialString +=
                    grid[r][c]
                    ? '1'
                    : '0';
            }
        }

        socket.send(serialString);
    }

    chrome.runtime.sendMessage({

        type:
            'TACTILE_ELEMENTS_UPDATE',

        tactileGrid:
            grid,

        metadataGrid,

        url:
            location.href,

        timestamp:
            Date.now()
    });
}

renderSemanticGrid();

window.addEventListener(
    'scroll',
    debounce(renderSemanticGrid, 150)
);

window.addEventListener(
    'resize',
    debounce(renderSemanticGrid, 150)
);

new MutationObserver(
    debounce(renderSemanticGrid, 150)
).observe(document.body, {

    childList: true,

    subtree: true
});
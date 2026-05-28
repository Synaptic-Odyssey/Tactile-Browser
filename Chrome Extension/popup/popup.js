const GRID_WIDTH = 12;
const GRID_HEIGHT = 6;

const gridContainer =
    document.getElementById("grid");

const info =
    document.createElement("div");

info.style.marginTop = "12px";
info.style.color = "white";
info.style.fontSize = "12px";
info.style.maxWidth = "320px";
info.style.fontFamily = "sans-serif";

document.body.appendChild(info);

let latestMetadataGrid = null;

function createGrid() {

    gridContainer.innerHTML = "";

    for (let y = 0; y < GRID_HEIGHT; y++) {

        for (let x = 0; x < GRID_WIDTH; x++) {

            const cell =
                document.createElement("div");

            cell.classList.add("cell");

            cell.dataset.x = x;
            cell.dataset.y = y;

            cell.addEventListener(
                "mouseenter",
                (e) => {

                    if (
                        !latestMetadataGrid
                    ) {
                        return;
                    }

                    const x =
                        parseInt(
                            e.target.dataset.x
                        );

                    const y =
                        parseInt(
                            e.target.dataset.y
                        );

                    const data =
                        latestMetadataGrid?.[
                            y
                        ]?.[
                            x
                        ];

                    if (!data) {

                        info.innerHTML =
                            "Empty";

                        return;
                    }

                    info.innerHTML = `

                        <b>Type:</b>
                        ${data.type}
                        <br>

                        <b>Tag:</b>
                        ${data.tag}
                        <br>

                        <b>Text:</b>
                        ${
                            data.text ||
                            '(none)'
                        }
                    `;
                }
            );

            gridContainer.appendChild(cell);
        }
    }
}

function renderGrid(
    grid,
    metadataGrid
) {

    latestMetadataGrid =
        metadataGrid;

    if (!grid)
        return;

    const cells =
        document.querySelectorAll(".cell");

    for (let y = 0; y < GRID_HEIGHT; y++) {

        for (let x = 0; x < GRID_WIDTH; x++) {

            const index =
                y * GRID_WIDTH + x;

            const cell =
                cells[index];

            if (!cell)
                continue;

            if (grid[y][x]) {

                cell.classList.add(
                    "raised"
                );

            } else {

                cell.classList.remove(
                    "raised"
                );
            }
        }
    }
}

chrome.runtime.onMessage.addListener(
    (message) => {

        if (
            message.type ===
            'TACTILE_ELEMENTS_UPDATE'
        ) {

            renderGrid(

                message.tactileGrid,

                message.metadataGrid
            );
        }
    }
);

createGrid();
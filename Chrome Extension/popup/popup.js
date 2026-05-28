const GRID_WIDTH = 12;
const GRID_HEIGHT = 6;

const gridContainer =
    document.getElementById("grid");

function createGrid() {

    gridContainer.innerHTML = "";

    for (let y = 0; y < GRID_HEIGHT; y++) {

        for (let x = 0; x < GRID_WIDTH; x++) {

            const cell =
                document.createElement("div");

            cell.className = "cell";

            gridContainer.appendChild(cell);
        }
    }
}

function renderGrid(grid) {

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

chrome.runtime.sendMessage({

    type:
        'REQUEST_LATEST_GRID'

}, (response) => {

    console.log(
        'POPUP RESPONSE:',
        response
    );

    if (
        response?.tactileGrid
    ) {

        renderGrid(
            response.tactileGrid
        );
    }
});

createGrid();
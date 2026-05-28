let latestGrid = null;

chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {

        if (
            message.type ===
            'TACTILE_ELEMENTS_UPDATE'
        ) {

            latestGrid = message;

            return;
        }

        if (
            message.type ===
            'REQUEST_LATEST_GRID'
        ) {

            sendResponse(
                latestGrid
            );

            return true;
        }
    }
);
chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {

        chrome.runtime.sendMessage(
            message
        );
    }
);
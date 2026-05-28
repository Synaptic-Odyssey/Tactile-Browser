let port = null;

function connectNative() {
    if (!port) {
        port = chrome.runtime.connectNative("com.tactilebrowser.host");

        port.onMessage.addListener((response) => {
            console.log("Message from native app:", response);
        });

        port.onDisconnect.addListener(() => {
            console.error("Disconnected from native app");
            port = null;
        });
    }
}

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "TACTILE_ELEMENTS_UPDATE") {
        console.log("Forwarding parsed elements to native app...");
        connectNative();

        if (port) {
            port.postMessage({
                type: "elements",
                url: message.url,
                timestamp: message.timestamp,
                elements: message.elements
            });
        }
    }
});

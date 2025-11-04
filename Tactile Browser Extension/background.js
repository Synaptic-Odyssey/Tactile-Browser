//listens for messages from the native app
//essentially allows the user to interact with the web from the tactile browser

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "TACTILE_ELEMENTS_UPDATE") {
        console.log("Received parsed elements:", message.elements);
        // Later: send this to native app via chrome.runtime.connectNative()
    }
});

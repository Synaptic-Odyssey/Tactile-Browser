// Injected into every page, extracts live HTML + structure basically parses the rendered DOM of the javascript
//later when the user interacts with the element on the tactile browser it must correlate to the actual element on screen
//a unique id will map this out later
//should work with horizontal scrolling as well



function debounce(func, wait) {
    let timeout;
    return function () {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, arguments), wait);
    };
}

function elIsVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);

    const verticallyVisible = rect.bottom > 0 && rect.top < window.innerHeight;
    const horizontallyVisible = rect.right > 0 && rect.left < window.innerWidth;

    return (
        verticallyVisible &&
        horizontallyVisible &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) !== 0
    );
}

function extractText(el) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        return el.value.trim();
    } else if (el.tagName === 'IMG') {
        return el.alt || '';
    } else {
        return el.innerText.trim();
    }
}

function detectInteractivity(el) {
    const tagInteractive = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
    const roleInteractive = ['button', 'link'].includes(el.getAttribute('role'));
    const tabInteractive = el.tabIndex >= 0 && !el.disabled;

    return tagInteractive || roleInteractive || tabInteractive;
}

function extractElements(el) {
    if (!elIsVisible(el)) return null;

    if (!el.dataset.tactileId) {
        el.dataset.tactileId = crypto.randomUUID(); // unique ID, refer back to it later for interaction
    }

    const text = extractText(el);
    const isInteractive = detectInteractivity(el);

    const children = [];
    for (const child of el.children) {
        const c = extractElements(child);
        if (c) children.push(c);
    }

    if (!text && !isInteractive && children.length === 0) return null;

    const rect = el.getBoundingClientRect();

    return {
    tag: el.tagName.toLowerCase(),
    text,
    isInteractive,
    id: el.dataset.tactileId,
    position: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
    },
    children
    };

}

function sendElements() {
    const rootElements = [];
    for (const child of document.body.children) {
        const e = extractElements(child);
        if (e) rootElements.push(e);
    }

    chrome.runtime.sendMessage({
        type: 'TACTILE_ELEMENTS_UPDATE',
        elements: rootElements,
        url: window.location.href,
        timestamp: Date.now()
    });
}

sendElements();

//Updates after scrolling and inactivity for 150 milliseconds. 
// However, I might make scrolling discrete (with a button) in the future. It depends on which case works better.

window.addEventListener('scroll', debounce(sendElements, 150));
window.addEventListener('resize', debounce(sendElements, 150));

const observer = new MutationObserver(debounce(sendElements, 150));
observer.observe(document.body, { childList: true, subtree: true });








/*

Future improvements:


Current selects all elements
Fixes:
document.querySelectorAll('a,button,input,textarea,select,header,h1,h2,h3,p,img')
Walk document.body.children top-level or use TreeWalker to be selective.
Use throttling/debouncing if its run on scroll/resize.

*/
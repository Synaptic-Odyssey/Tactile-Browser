#Need to make it so that only the visible (on the tactile browser) portion of the html files is the portion visible on screen, 
# or if there are too many elements, optimize the fit from top to down.
#Actually this will parse ALL visual elements, the layout.py module will decide what the portion to display on the tactile browser

from bs4 import BeautifulSoup
from html_element import HTMLElement

def load_html(filepath: str) -> str:
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def parse_html(html: str):
    soup = BeautifulSoup(html, "html.parser")
    body = soup.body
    if body is None:
        return []

    elements = extract_visible_elements(body)

    return elements


def extract_visible_elements(node):
    visible = []

    for child in node.children:
        if getattr(child, "name", None) is None:
            continue

        if child.name in ("script", "style", "meta", "link", "noscript"):
            continue

        attributes = dict(child.attrs)
        text = child.get_text(strip=True)

        children = extract_visible_elements(child)

        is_interactive = (
            child.name in ["a", "button", "input", "select", "textarea"]
            or attributes.get("role") in ["button", "link"]
            or "onclick" in attributes
        )

        if child.name == "img":
            alt_text = attributes.get("alt", "")
            element = HTMLElement(tag="img", text=alt_text, attributes=attributes, children=children)
            visible.append(element)
            continue

        element = HTMLElement(tag=child.name, text=text, attributes=attributes, children=children)
        element.is_interactive = is_interactive

        if text or is_interactive or children:
            visible.append(element)

    return visible


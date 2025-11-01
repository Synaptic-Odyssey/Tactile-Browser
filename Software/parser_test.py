from html_parser import load_html, parse_html

def print_tree(elements, indent=0):
    for el in elements:
        print("  " * indent + f"<{el.tag}>: '{el.text[:40]}'")
        if el.children:
            print_tree(el.children, indent + 1)

def main():
    html = load_html("/Users/kevin/Github/Tactile-Browser/Files/Example Domain.html")
    elements = parse_html(html)

    print(f"Top-level elements: {len(elements)}")
    print("Document structure:\n")
    print_tree(elements)

if __name__ == "__main__":
    main()

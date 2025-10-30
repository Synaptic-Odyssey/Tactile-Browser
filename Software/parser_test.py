from html_parser import load_html, parse_html

def main():
    html = load_html("/Users/kevin/Github/Tactile-Browser/Files/Home _ American Foundation for the Blind.html")
    elements = parse_html(html)

    print("Found elements:", len(elements))
    for e in elements[:20]:
        print(e)

if __name__ == "__main__":
    main()

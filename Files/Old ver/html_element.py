class HTMLElement:
    
    #1 is raised, 0 and 2 are flat. 0 allows other elements to be raised, but nothing can be raised on 2 (for orthogonal separation).
    #this way no need for separate footprint and bounding box definitions
    #all elements should fit in a 2x3 layout. Elements are allowed to touch diagonally but not orthogonally.
    
    
    TACTILE_PATTERNS = {
    "button": [
        [0, 2, 0],
        [2, 1, 2],
        [0, 2, 0],
    ],
    
    "link": [
        [0, 2, 0],
        [2, 1, 2],
        [0, 2, 0],
    ],
    
    "input_field": [
        [0, 0, 0, 2, 0],
        [2, 2, 2, 1, 2],
        [2, 1, 1, 1, 2],
        [0, 2, 2, 2, 0]
    ],
    
    "text_area": [
        [0, 2, 2, 0],
        [2, 1, 1, 2],
        [0, 2, 2, 0],
    ],
    
    "header": [
        [0, 2, 2, 2, 0],
        [2, 1, 1, 1, 2],
        [0, 2, 2, 2, 0],
    ],
    
    "popups": [
        [0, 2, 2, 0],
        [2, 1, 1, 2],
        [2, 1, 1, 2],
        [0, 2, 2, 0]
    ],
    
    #dropdowns are dependent on how many links they have. Replace this with method.
    #dropdowns are dependent on how many links they have. The plan is all the links be represented by one block, 
    #the dropdown will be 2 blocks wide, and n/2 blocks tall (n = number of links).
    "dropdown": [
        [1, 1, 1],
        [1, 0, 1],
        [0, 1, 0],
    ]
    }

    
    def __init__(self, tag, text, attributes=None, children=None):
        self.tag = tag
        self.text = text.strip() if text else ""
        self.attributes = attributes or {}
        
        #stores only direct children to preserve tree structure
        self.children = children or []

        self.is_interactive = self.determine_interactivity()
        
        #only gives the KEY to the configuration of raised keycaps
        #accessing later -->
        #HTMLElement.TACTILE_PATTERNS[element.tactile_element]
        self.tactile_element = self.determine_tactile()
        
        self.display_type = self.determine_display_type()

        

    def determine_display_type(self):
        block_tags = ["div", "p", "header", "footer", "section", "article"]
        inline_tags = ["span", "a", "strong", "em", "label"]
        interactive_tags = ["button", "input", "select", "textarea"]
        
        #This is probably redundant, leave it for now
        if self.tag in interactive_tags:
            return "interactive"
        elif self.tag in block_tags:
            return "block"
        elif self.tag in inline_tags:
            return "inline"
        else:
            return "unknown"
        

    def determine_interactivity(self):
        return self.tag in ["a", "button", "input", "select", "textarea"]
    

    def determine_tactile(self):
        roles = {
            "a": "link",
            "button": "button",
            "input": "input_field",
            "select": "dropdown",
            "textarea": "text_area",
            "h1": "header",
            "h2": "header",
            "h3": "header",
            "h4": "header",
            "h5": "header",
            "h6": "header",
        }
        return roles.get(self.tag)

    def __repr__(self):
        return f"<HTMLElement tag={self.tag} tactile={self.tactile_element} text='{self.text[:15]}...'>"

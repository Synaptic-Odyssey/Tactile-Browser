#determines visible elements + maps to tactile grid (17x11)
#This could actually handle resized windows


class Layout:
    
    def __init__(self):
        pass
    
    #for testing purposes
    def print_elements(self, elements):

        def recurse(elems, indent=0):
            for el in elems:
                print(" " * indent + f"- {el.get('tag')} | interactive: {el.get('isInteractive')} | text: '{el.get('text')[:30]}'")
                if el.get("children"):
                    recurse(el["children"], indent + 2)
        
        recurse(elements)





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

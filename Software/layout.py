

# approximate cap for visible elements on the tactile surface; tune later during optimization/layout phase.
#will require a function
MAX_ELEMENTS_ON_SCREEN = 40

def fit_to_screen(elements):

    if len(elements) <= MAX_ELEMENTS_ON_SCREEN:
        return elements

    return elements[:MAX_ELEMENTS_ON_SCREEN]


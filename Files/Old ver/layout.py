# approximate cap for visible elements on the tactile surface; tune later during optimization/layout phase.
#will require a function

#Layout is in charge of flattening out the tree from the html parser

import numpy as np

from html_element import HTMLElement
from html_parser import load_html, parse_html

class LayoutEngine: 
    
    def __init__(self, elements):
        self.grid = np.zeros((17, 11))
        self.elemtents = elements
        
        
#ISSUE: to actually get the viewport and what portion of the website is on the screen, I will need the DOM and 
#will have to parse the javascript as well. Essentially I need to run the javascript first for dyanmic elements too
#So I will have to restructure a ton of code.
from planager.Tool import Tool

# importing the module
import json
import os.path

# Opening JSON file
with open(os.path.join(os.path.dirname(__file__), "ifs.tool")) as json_file:
    CONFIG = json.load(json_file)


class dontmatter(Tool, config=CONFIG):
    def set_pathData(self, str):
        self.outports["pathData"] = str

    def set_pathEls(self, lst):
        self.outports["pathEls"] = lst

from planager.Tool import Tool

# importing the module
import json
import os.path

# Opening JSON file
with open(os.path.join(os.path.dirname(__file__), "ColorVis.tool")) as json_file:
    CONFIG = json.load(json_file)


class ColorVis(Tool, config=CONFIG):
    def inports_updated(self, key):
        self.state["color"] = self.inports["color"]

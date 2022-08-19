import { LitElement, html } from "lit";
import { ref, createRef } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";

import { themes } from "../ui/themes";
import { PlanController } from "../controllers/PlanController";

// Basic workspace things
import "./workspace_ui/Workspace";
import "./workspace_ui/Toolbar";

// Tool UI
import "./tool_ui/Module";
import "./tool_ui/Pane";

// Floating Modules
import "./floating_modules/PlanagerLibrary";
import "./floating_modules/PlanagerSettings";
import "./floating_modules/PlanViewer";

export class PlanagerRoot extends LitElement {
  canvasRef = createRef();
  planController = new PlanController(this);
  currentOffset = { x: 100, y: 100 };

  static properties = {
    socket: {},
    modules: {},
    theme: {},
  };

  constructor() {
    super();
    this.modules = [];
    this.socket = io.connect("http://localhost:5000/");

    this.socket.emit("newPlan");
    this.socket.on("toolAdded", (module, callback) => {
      this.handleNewModule(module).then(() => callback(module.id));
    });
    this.theme = "dracula";
  }

  handleKeyDown(event) {
    let charCode = String.fromCharCode(event.which).toLowerCase();
    if ((event.ctrlKey || event.metaKey) && charCode === "s") {
      event.preventDefault();
      this.planController.downloadPlan(event);
    } else if ((event.ctrlKey || event.metaKey) && charCode === "c") {
      event.preventDefault();
      console.log("CTRL+C Pressed");
    } else if ((event.ctrlKey || event.metaKey) && charCode === "v") {
      event.preventDefault();
      console.log("CTRL+V Pressed");
    } else if ((event.ctrlKey || event.metaKey) && charCode === "z") {
      event.preventDefault();
      console.log("CTRL+Z pressed");
    }
  }

  connectedCallback() {
    super.connectedCallback();
    addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  increaseOffset() {
    this.currentOffset.x += 10;
    this.currentOffset.y += 10;
  }

  handleRemove(e, toolID) {
    this.socket.emit("remove_tool", toolID);
    let toolToRemove = this.canvasRef.value.querySelector(
      `planager-module[toolid="${toolID}"]`
    );
    this.canvasRef.value.removeChild(toolToRemove);
  }

  async handleNewModule(module) {
    const elementName = (
      "planager-" + module.actionType.slice(1).join("-")
    ).toLowerCase();

    // If the element for the action has not been registered
    // we import it and define it as a custom element
    if (!customElements.get(elementName)) {
      const modulePath = `../../${module.actionType.join("/")}.js`;
      let moduleElement = await import(modulePath);
      customElements.define(elementName, moduleElement.default);
    }

    // Create the element, put it inside a draggable, and append it as a child to the canvas
    let d = document.createElement("planager-module");
    d.slot = "draggable";
    d.info = module;
    d.toolid = module.id;

    if (d.info.coords) {
      // If the tool includes coordinates, set them as the tool location
      d.dx = d.info.coords.x;
      d.dy = d.info.coords.y;
    } else {
      // Otherwise use the default offset and increase it so it is staggered
      d.dx = this.currentOffset.x;
      d.dy = this.currentOffset.y;
      this.increaseOffset();
    }
    this.socket.emit("moveTool", {
      id: d.info.id,
      coords: { x: d.dx, y: d.dy },
    });
    let el = document.createElement(elementName);
    // Pass it the socket connection
    el.socket = this.socket;
    el.info = module;
    d.handleRemove = (e) => this.handleRemove(e, d.info.id);
    d.appendChild(el);
    this.canvasRef.value.appendChild(d);
    this.requestUpdate();

    return "DONE";
  }

  render() {
    return html`
      <main style=${styleMap(themes[this.theme])}>
        <planager-toolbar .socket=${this.socket}></planager-toolbar>
        <planager-workspace ${ref(this.canvasRef)} .socket=${this.socket}>
          <!-- <planager-pane
            slot="floating"
            displayName="Settings"
            style="--dx:1100;--dy:300"
            ><planager-settings></planager-settings
          ></planager-pane>
          <planager-pane
            slot="floating"
            displayName="Plan Viewer"
            style="--dx:1100;--dy:500"
            ><plan-viewer .socket=${this.socket}></plan-viewer
          ></planager-pane> -->
          <planager-pane
            slot="floating"
            displayName="Tool Library"
            .dx=${0}
            .dy=${30}
          >
            <planager-library
              .socket=${this.socket}
              .addModule=${this.handleNewModule.bind(this)}
            ></planager-library>
          </planager-pane>
        </planager-workspace>
      </main>
    `;
  }
}
customElements.define("planager-root", PlanagerRoot);
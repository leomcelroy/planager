import { LitElement, html } from "lit";
import { ref, createRef } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";

import { themes } from "./ui/themes";
import { ToolchainController } from "./controllers/ToolchainController";

// Basic workspace things
import "./components/workspace_ui/Workspace";
import "./components/workspace_ui/Toolbar";

// Tool UI
import "./components/tool_ui/Module";
import "./components/tool_ui/Pane";

// Floating Modules
import "./components/floating_modules/ToolLibrary";
import "./components/floating_modules/PlanagerSettings";
import "./components/floating_modules/ToolchainInfo";

import { io } from "socket.io-client";
const socket = io({ path: "/socket.io", transports: ["websocket"] });

async function handleToolImport(toolType) {
  const elementName = ("planager-" + toolType.slice(1).join("-")).toLowerCase();

  // If the element for the tool has not been registered
  // we import it and define it as a custom element
  if (!customElements.get(elementName)) {
    const modulePath = `${toolType.slice(1).join("/")}`;

    let moduleElement = await import(
      /* webpackChunkName: "tools-[request]" */
      /* webpackExclude: /ignore/ */ `../tools/${modulePath}.js`
    );

    try {
      customElements.define(elementName, moduleElement.default);
    } catch {
      console.log(elementName, "already defined");
    }
  }
  return document.createElement(elementName);
}

export class PlanagerRoot extends LitElement {
  canvasRef = createRef();
  toolchainController = new ToolchainController(this);
  currentOffset = { x: 100, y: 100 };

  static properties = {
    socket: {},
    modules: {},
    theme: {},
  };

  constructor() {
    super();
    this.modules = [];

    socket.on("connect", () => {
      console.log("Connected to backend!");
      console.info("Socket ID:", socket.id);
      console.info("Current transport:", socket.io.engine.transport.name); // in most cases, prints "polling"
    });

    socket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
    });

    socket.on("tool_added", (module, callback) => {
      this.handleNewModule(module).then(() => callback(module.id));
    });

    socket.emit("new_toolchain");
    this.theme = "dracula";
  }

  handleKeyDown(event) {
    // TODO: There is a bug where the key combos result in an infinite loop ?
    let charCode = String.fromCharCode(event.which).toLowerCase();
    if ((event.ctrlKey || event.metaKey) && charCode === "s") {
      event.preventDefault();
      this.toolchainController.downloadToolchain(event);
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
    // TODO: This should instead request a tool's removal, and there should be a listener for tool_removed messages
    socket.emit("remove_tool", toolID, () => {
      let toolToRemove = this.canvasRef.value.querySelector(
        `planager-module[toolid="${toolID}"]`
      );
      // TODO: Go through and confirm that any attached pipes are removed
      this.canvasRef.value.removeChild(toolToRemove);
    });
  }

  async handleNewModule(module) {
    const toolElement = await handleToolImport(module.toolType);

    // Create the element, put it inside a draggable, and append it as a child to the canvas inside the tool slot
    let toolWrapper = document.createElement("planager-module");
    toolWrapper.slot = "tools";
    toolWrapper.info = module;
    toolWrapper.toolid = module.id;

    if (toolWrapper.info.coords) {
      // If the tool includes coordinates, set them as the tool location
      toolWrapper.dx = toolWrapper.info.coords.x;
      toolWrapper.dy = toolWrapper.info.coords.y;
    } else {
      // Otherwise use the default offset and increase it so it is staggered
      toolWrapper.dx = this.currentOffset.x;
      toolWrapper.dy = this.currentOffset.y;
      this.increaseOffset();
    }

    // Pass it the socket connection
    toolElement.socket = socket;
    toolElement.info = module;
    toolWrapper.handleRemove = (e) => this.handleRemove(e, toolWrapper.info.id);
    toolWrapper.appendChild(toolElement);
    this.canvasRef.value.appendChild(toolWrapper);
    // this.requestUpdate();
    socket.emit("update_tool_coordinates", {
      tool_id: toolWrapper.info.id,
      coordinates: { x: toolWrapper.dx, y: toolWrapper.dy },
    });
    return "DONE";
  }

  render() {
    return html`
      <main style=${styleMap(themes[this.theme])}>
        <planager-toolbar .socket=${socket}></planager-toolbar>
        <planager-workspace
          ${ref(this.canvasRef)}
          .socket=${socket}>
          <!-- <planager-pane
            slot="floating"
            displayName="Settings"
            style="--dx:1100;--dy:300"
            ><planager-settings></planager-settings
          ></planager-pane> -->
          <!-- <planager-pane
            slot="floating"
            displayName="Toolchain Info"
            .dx=${0}
            .dy=${500}
            ><toolchain-info .socket=${this.socket}></toolchain-info
          ></planager-pane> -->
          <planager-pane
            slot="floating"
            displayName="Tool Library"
            .dx=${0}
            .dy=${30}>
            <tool-library
              .socket=${socket}
              .addModule=${this.handleNewModule.bind(this)}></tool-library>
          </planager-pane>
        </planager-workspace>
      </main>
    `;
  }
}
customElements.define("planager-root", PlanagerRoot);

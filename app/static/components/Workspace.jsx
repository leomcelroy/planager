import React from "react";

import Action from "./Action";
import Dropdown from "./Dropdown";
import Link from "./Link";
import Toolbar from "./Toolbar";

import "./styles/workspace.css";

import { socket, SocketContext } from "../context/socket";
import { default as actionUImap } from "../ActionLoader";

export default class Workspace extends React.Component {
  static contextType = SocketContext;
  constructor(props) {
    super(props);
    this.state = {
      plan: {},
      dropdown: {},
      actionDict: {},
      examples: {},
      links: {},
      actions: {},
      mouseX: 0,
      mouseY: 0,
    };

    // Get all of the actions that are available for the Planager
    fetch("/getActions", {
      method: "get",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((result) => {
        this.setState({
          actionDict: result.actions,
          dropdown: result.dropdown,
        });
      });
    fetch("/clearPlan", { method: "get" });

    // Bind these callbacks so that we can remove them from event listeners
    // If we don't bind them, we won't have references to the correct listener
    // callbacks because they will be anonymous, and the listener will keep listening
    this.removeMouseListeners = this.removeMouseListeners.bind(this);
    this.mousemoveCallback = this.mousemoveCallback.bind(this);
    this.cancelConnection = this.cancelConnection.bind(this);
  }
  componentDidMount() {
    // Once the workspace has loaded, we must tell it what methods to run on socket events
    let socket = this.context;
    socket.on("update", this.update.bind(this));
  }
  // uploadPlan(event) {
  //   var reader = new FileReader();

  // // This callback is run when the file loads
  // reader.onload = (event) => {
  //   const plan = JSON.parse(event.target.result);
  //   fetch("/uploadPlan", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify(plan),
  //   })
  //     .then((res) => res.json())
  //     // Todo: check for plan correctness in the backend and return the appropriate code
  //     .then((result) => {
  //       console.debug(result);
  //       this.setState({ plan: plan }, this.updatePlan);
  //     });
  // };
  // reader.readAsText(event.target.files[0]);
  // }
  update(action) {
    let actions = this.state.actions;
    if (!actions[action.id]) return;

    console.debug(action);
    console.debug(actions);

    actions[action.id].component = React.cloneElement(
      actions[action.id].component,
      {
        inports: action.inports,
        outports: action.outports,
      }
    );

    this.setState({ actions: actions });
  }
  getConnections(actionID) {
    // Builds an object containing all of the connections to and from an action.
    const action = this.state.actions[actionID];
    let connections = { inports: {}, outports: {} };

    // Get connections to inports
    for (const [inportName, inport] of Object.entries(action.inports)) {
      for (const [actionID, portID] of Object.entries(inport.connections)) {
        connections.inports[inportName] = [actionID, portID];
      }
    }
    // Get connections from outports
    for (const [outportName, outport] of Object.entries(action.outports)) {
      for (const [actionID, portID] of Object.entries(outport.connections)) {
        connections.outports[outportName] = [actionID, portID];
      }
    }
    return connections;
  }
  makeLinkID(startActionID, startPortID, endActionID, endPortID) {
    // Builds a unique ID for a link
    // TODO: add assertion
    return `${startActionID}_${startPortID}_${endActionID}_${endPortID}`;
  }
  breakLinkID(linkID) {
    const splitID = linkID.split("_");
    return {
      startActionID: splitID[0],
      startPortID: splitID[1],
      endActionID: splitID[2],
      endPortID: splitID[3],
    };
  }
  triggerRender() {
    // Helper function to trigger a render, as react doesn't detect changes to nested objects in the state
    this.setState(this.state);
  }
  mousemoveCallback(e) {
    this.setState({ mouseX: e.clientX, mouseY: e.clientY });
  }
  removeMouseListeners() {
    // Remove the mouse listeners we added when creating a new connection
    window.removeEventListener("mousemove", this.mousemoveCallback);
    window.removeEventListener("contextmenu", this.cancelConnection);
  }
  cancelConnection(e) {
    e.preventDefault();

    let oldLinks = this.state.links;
    delete oldLinks.linkInProgress;
    this.setState({ links: oldLinks }, this.removeMouseListeners);
  }
  beginConnection(e, startActionID, startPortID) {
    // Create a temporary link object
    let link = {
      startActionID: startActionID,
      startPortID: startPortID,
      startPortRef: this.state.actions[startActionID].outportRefs[startPortID],
    };

    // Add the temporary link to the link object in the state. Also add the current mouse position from the event, so the link in progress will render from the correct location.
    let oldLinks = { ...this.state.links };
    oldLinks["linkInProgress"] = link;
    this.setState({ links: oldLinks, mouseX: e.clientX, mouseY: e.clientY });

    // Add an event listener so the link tracks the mouse movement
    window.addEventListener("mousemove", this.mousemoveCallback);
    // Add an event listener so we can cancel the connection on right click
    window.addEventListener("contextmenu", this.cancelConnection);
  }
  endConnection(e, endActionID, endPortID) {
    const linkInProgress = this.state.links.linkInProgress;
    if (!linkInProgress) return;

    // Tell the backend that this link has been made
    fetch("/addLink", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startActionID: linkInProgress.startActionID,
        startPortID: linkInProgress.startPortID,
        endActionID: endActionID,
        endPortID: endPortID,
      }),
    })
      .then((res) => res.json())
      .then((result) => {
        // Call the create link method to add the new link to the state
        this.createLink(result.linkData);
        // Update the two actions that were connected
        this.update(result.startAction);
        this.update(result.endAction);
      });

    // Remove the temporary link from the state and then remove the listeners
    let oldLinks = this.state.links;
    delete oldLinks.linkInProgress;
    this.setState({ links: oldLinks }, this.removeMouseListeners);
  }
  renderActions() {
    let renderedActions = [];
    for (const [actionID, action] of Object.entries(this.state.actions)) {
      renderedActions.push(action.component);
    }
    return renderedActions;
  }
  renderLinks() {
    let renderedLinks = [];
    for (const [linkID, link] of Object.entries(this.state.links)) {
      let coords = {};
      if (link.startPortRef.current == null) continue;
      const startBounds = link.startPortRef.current.getBoundingClientRect();
      coords.startx = startBounds.left + startBounds.width / 2;
      coords.starty = startBounds.top + startBounds.height / 2;

      // If this is the temporary link, we want the endpoint to be
      // at the mouse rather than the port.
      if (linkID == "linkInProgress") {
        coords.endx = this.state.mouseX;
        coords.endy = this.state.mouseY;
      } else {
        if (link.endPortRef.current == null) continue;
        const endBounds = link.endPortRef.current.getBoundingClientRect();
        coords.endx = endBounds.left + endBounds.width / 2;
        coords.endy = endBounds.top + endBounds.height / 2;
      }

      renderedLinks.push(
        <Link
          removeLink={this.removeLink.bind(this)}
          ref={link.linkRef}
          link={link}
          id={linkID}
          key={linkID}
          startX={coords.startx}
          startY={coords.starty}
          endX={coords.endx}
          endY={coords.endy}
        />
      );
    }
    return renderedLinks;
  }
  // TODO: Action UI loading should be dynamic
  // getComponent(actionName) {
  //   let component = this.state.actionDict[actionName].component;
  //   if (component) return component;
  //   // Else, load the UI component
  //   // const componentPath = `../../planager/actionsets/${this.state.actionDict[actionName].actionSet}/${actionName}/${actionName}`;
  //   const componentPath =
  //     "../../planager/actionsets/axidraw/AxidrawConnect/AxidrawConnect";
  //   // component = React.lazy(() => import(componentPath));
  //   return Loadable({
  //     loader: () => import(componentPath),
  //     loading: <div>Loading...</div>,
  //   });
  // }
  sendToOutport(actionID, dataDict) {
    console.log(actionID);
    console.log(dataDict);

    // for (const [outportID, data] of dataDict) {
    //   // this.makeLinkID(actionID, outportID)
    //   const linksToUpdate =
    //     this.state.actions[actionID].outports[outportID].connections;
    //   console.log(linksToUpdate);
    // }

    fetch("/sendDataToOutport", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actionID: actionID,
        dataDict: dataDict,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        // TODO: res is the plan. in the backend we should only return the actions that have changed, and then update their values here on the frontend.
        // console.log(res);
      });
  }
  renderActionUI(action) {
    let ui;
    try {
      ui = React.createElement(actionUImap[action.name], {
        sendToOutport: this.sendToOutport.bind(this),
        action: action,
      });
    } catch (error) {
      ui = React.createElement("span");
    }
    return ui;
  }
  createLink(link) {
    const linkID = this.makeLinkID(
      link.startActionID,
      link.startPortID,
      link.endActionID,
      link.endPortID
    );
    link["startPortRef"] =
      this.state.actions[link.startActionID].outportRefs[link.startPortID];
    link["endPortRef"] =
      this.state.actions[link.endActionID].inportRefs[link.endPortID];
    link["linkRef"] = React.createRef(null);

    let oldLinks = { ...this.state.links };
    oldLinks[linkID] = link;
    this.setState({ links: oldLinks });
  }
  createAction(action) {
    console.log(action);
    let inportRefs = {};
    let outportRefs = {};

    for (const [inportName, inport] of Object.entries(action.inports)) {
      inportRefs[inportName] = React.createRef();
    }
    action["inportRefs"] = inportRefs;

    for (const [outportName, outport] of Object.entries(action.outports)) {
      outportRefs[outportName] = React.createRef();
    }

    action["outportRefs"] = outportRefs;

    // This passes through the action's UI as a child of the generic action component
    let actionComponent = (
      <Action
        action={action}
        inports={action.inports}
        inportRefs={inportRefs}
        outports={action.outports}
        outportRefs={outportRefs}
        beginConnection={this.beginConnection.bind(this)}
        endConnection={this.endConnection.bind(this)}
        removeAction={this.removeAction.bind(this)}
        key={action.id}
        triggerRender={this.triggerRender.bind(this)}
        coords={{ x: 1000, y: 1000 }}>
        {this.renderActionUI(action)}
      </Action>
    );

    action["component"] = actionComponent;

    let oldActions = { ...this.state.actions };
    oldActions[action.id] = action;
    this.setState({ actions: oldActions });
  }
  addAction(actionSet, action) {
    fetch("/addAction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actionSet: actionSet,
        action: action,
      }),
    })
      .then((res) => res.json())
      .then((action) => {
        this.createAction(action);
      });
  }
  removeAction(actionID) {
    fetch("/removeAction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actionID: actionID,
      }),
    })
      .then((res) => res.json())
      .then((action) => {
        // Goes through the links attached to the removed action and removes them
        let links = { ...this.state.links };
        for (const [outportID, outport] of Object.entries(action.outports)) {
          // For each outport
          for (const [endActionID, inportID] of Object.entries(
            // For each connection attached to the port
            outport.connections
          )) {
            delete links[
              this.makeLinkID(action.id, outportID, endActionID, inportID)
            ];
          }
        }
        for (const [inportID, inport] of Object.entries(action.inports)) {
          // For each inport
          for (const [startActionID, outportID] of Object.entries(
            // For each connection attached to the port
            inport.connections
          )) {
            delete links[
              this.makeLinkID(startActionID, outportID, action.id, inportID)
            ];
          }
        }

        // Then removes the action
        let actions = { ...this.state.actions };
        delete actions[action.id];

        // And updates the state
        this.setState({ actions: actions, links: links });
      });
  }
  removeLink(linkID) {
    const socket = this.context;
    const linkInfo = this.breakLinkID(linkID);
    socket.emit("removeLink", {
      startActionID: linkInfo["startActionID"],
      startPortID: linkInfo["startPortID"],
      endActionID: linkInfo["endActionID"],
      endPortID: linkInfo["endPortID"],
    });
    let oldLinks = { ...this.state.links };
    delete oldLinks[linkID];
    this.setState({ links: oldLinks });
  }
  // loadExample(example) {
  //   console.log("loading an example");
  //   console.log(example);
  // }
  // renderExampleDropdown() {
  //   // TODO: Make a react dropdown component
  //   let exampleList = [];

  //   for (const value of this.state.examples) {
  //     exampleList.push(
  //       <div key={value}>
  //         <div
  //           type='button'
  //           className='dropdownActionSet'
  //           onClick={this.loadExample.bind(this, value)}>
  //           {value}
  //         </div>
  //       </div>
  //     );
  //   }

  //   return exampleList;
  // }
  render() {
    return (
      <div id='container'>
        <Toolbar
          dropdownInfo={this.state.dropdown}
          addAction={this.addAction.bind(this)}
        />
        <div id='workflowCanvas'>
          {this.renderLinks()}
          {this.renderActions()}
        </div>
      </div>
    );
  }
}

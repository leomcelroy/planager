import { html, css } from "lit";
import { Tool } from "../../../src/components/tool_ui/Tool";
import { addPanZoom } from "./addPanZoom.js";

export default class ifs extends Tool {
  static styles = css`
    .container {
      resize: both;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }

    textarea {
      height: 40%;
      width: 100%;
    }

    svg {
      height: 100%;
      width: 100%;
    }

  `;

  static properties = {};

  constructor() {
    super();
  }

  firstUpdated() {
    const defaultText = `
// dragon
const rules = {
 "X":"X+YF+",
  "Y":"-FX-Y"
}

const a = 90;

const instructions = {
  "F": t => t.forward(10),
  "G": t => t.forward(10),
  "+": t => t.right(a),
  "-": t => t.left(a),
  "[": t => t.store(),
  "]": t => t.restore()
}

return new Turtle()
  .lSystem({
    axiom: "X",
    steps: 13,
    rules,
    instructions,
  })
`;

    const textarea = this.shadowRoot.querySelector("textarea");
    textarea.value = defaultText;

    const svg = this.shadowRoot.querySelector("svg");
    addPanZoom(svg)
  }

  render() {
    return html`
      <div class="container">
        <textarea></textarea>
        <button @click=${(e) => {
          const el = e.target.parentNode.querySelector("textarea");
          const group = e.target.parentNode.querySelector(".transform-group");
          const text = el.value;

          const result = new Function("Turtle", text)(Turtle);
          let d = "";
          result.pls.forEach(pl => {
            d += "M"
            pl.forEach((pt, i) => {
              if (i > 0) d += "L";
              d += pt.join(",");
            })
          });

          let minX = Math.Infinty;
          let maxX = -Math.Infinty;
          let minY = Math.Infinty;
          let maxY = -Math.Infinty;

          this.api.runMethod("set_pathData", `
            <svg xmlns="http://www.w3.org/2000/svg">
              <path stroke="black" stroke-width="2" fill="none" d="${d}"></path>
            </svg>
          `);

          this.api.runMethod("set_pathEls", [
              `<path stroke="black" stroke-width="2" fill="none" d="${d}"></path>`
          ]);

          group.innerHTML = `<path stroke="black" stroke-width="2" fill="none" d="${d}">`
        }}>generate</button>
        <svg>
          <g class="transform-group"></g>
        </svg>
      </div>
    `;
  }
}

class Turtle {
  constructor() {
    this.pls = [ [ [0, 0] ] ];
    this.states = [];
    this.angle = 0;
  }

  right(angle) {
    this.angle += angle;
    return this;
  }

  left(angle) {
    this.angle -= angle;
    return this;
  }

  forward(distance) {
    const [ lastX, lastY ] = this.pls.at(-1).at(-1);
    const x = Math.cos(this.angle/180*Math.PI)*distance + lastX;
    const y = Math.sin(this.angle/180*Math.PI)*distance + lastY;

    this.pls.at(-1).push([x, y]);

    return this;
  }

  store() {
    this.states.push(this.pls.at(-1).at(-1));

    return this;
  }

  restore() {
    const pt = this.states.pop();
    this.pls.push([pt]);

    return this;
  }

  lSystem({ 
    axiom, 
    rules, 
    instructions, 
    steps, 
    max, 
  }) {
    let state = typeof axiom === "string"
      ? axiom.split("")
      : axiom;

    for (let i = 0; i < steps; i++) {
      let newState = [];
      state.forEach(symbol => {
        let replacement = rules[symbol] ?? [symbol];
        if (typeof replacement === "string") replacement = replacement.split("")
        newState.push(...replacement);
      })
      
      state = newState;
    }

    const t = this;  

    state.forEach((c, i) => {
      if ((max === undefined || i < max) && instructions[c]) return instructions[c](t);
    });
    
    return t;
  }
}

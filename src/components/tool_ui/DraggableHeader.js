import { LitElement, html, css } from "lit";
import { unselectable } from "../../ui/styles";

export class DraggableHeader extends LitElement {
  static styles = [
    unselectable,
    css`
      #header {
        background-color: var(--planager-purple);
        color: var(--planager-text-light);
        display: flex;
        justify-content: space-between;
        cursor: move;
        padding: 0.2rem;
        min-height: 0.5rem;
        pointer-events: all;
      }
      #title {
        font-size: 0.7rem;
        font-weight: bolder;
      }
    `,
  ];

  render() {
    return html`<div id="header" class="unselectable">
      <span id="title"><slot name="title"></slot></span>
      <slot name="icons"></slot>
    </div>`;
  }
}
customElements.define("planager-draggable-header", DraggableHeader);
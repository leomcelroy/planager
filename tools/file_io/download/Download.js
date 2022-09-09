import { html, css } from "lit";
import { Tool } from "../../../src/components/tool_ui/Tool";

export default class Gate extends Tool {
  static styles = css`
    #downloadButton {
      padding: 5px 10px;
      background-color: var(--blue);
      color: var(--base3);
      text-align: center;
      font-weight: bolder;
    }

    #downloadButton:hover {
      background-color: var(--blueHover);
    }

    .hidden {
      display: none;
    }
  `;

  static properties = {
    file: undefined,
    fileType: "json",
    fileDownloadUrl: null,
  };

  download(e) {
    e.preventDefault();
    // Prepare the file
    let output = this.props.action.inports.file.value;

    // if (this.state.fileType === "json") {
    //   output = JSON.stringify({ states: this.state.data }, null, 4);
    // } else if (this.state.fileType === "csv") {
    //   // Prepare data:
    //   let contents = [];
    //   contents.push(["State", "Electors"]);
    //   this.state.data.forEach((row) => {
    //     contents.push([row.state, row.electors]);
    //   });
    //   output = this.makeCSV(contents);
    // } else if (this.state.fileType === "text") {
    //   // Prepare data:
    //   output = "";
    //   this.state.data.forEach((row) => {
    //     output += `${row.state}: ${row.electors}\n`;
    //   });
    // }

    // Download it
    const blob = new Blob([output]);
    const fileDownloadUrl = URL.createObjectURL(blob);
    this.setState({ fileDownloadUrl: fileDownloadUrl }, () => {
      this.doFileDownload.click();
      URL.revokeObjectURL(fileDownloadUrl); // free up storage--no longer needed.
      this.setState({ fileDownloadUrl: "" });
    });
  }
  render() {
    return html`<div className="background">
      <div id="downloadButton" @click=${(e) => this.download(e)}>Download</div>
      <a
        className="hidden"
        download=${"file"}
        href="{this.state.fileDownloadUrl}"
        ref=${(e) => (this.doFileDownload = e)}
      >
        download it
      </a>
    </div>`;
  }
}

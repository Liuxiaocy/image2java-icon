import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("image2java-icon.openPanel", () => {
      vscode.window.showInformationMessage("Image2Java Icon: panel not yet implemented.");
    })
  );
}

export function deactivate() {}

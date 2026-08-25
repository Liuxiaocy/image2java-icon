import * as vscode from 'vscode';
import { generatePixelIcon } from './generator/pixelGenerator';
import { generateVectorIcon } from './generator/vectorGenerator';
import { GenerateRequest, GenerateResultMessage, MAX_SIZE, DEFAULT_CLASS_NAME } from './generator/types';
import { getWebviewContent } from './webview/panel';

class IconViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'image2java-icon.iconView';
  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [this.context.extensionUri] };
    webviewView.webview.html = getWebviewContent();
    webviewView.webview.onDidReceiveMessage(
      (msg: GenerateRequest) => { if (msg.command === 'generate') this.handleGenerate(msg); },
      undefined,
      this.context.subscriptions
    );
  }

  private async handleGenerate(req: GenerateRequest) {
    if (!this.view) return;
    const post = (m: GenerateResultMessage) => this.view!.webview.postMessage(m);
    try {
      if (req.size < 1 || req.size > MAX_SIZE) throw new Error(`size 必须在 1..${MAX_SIZE}`);
      let code = '';
      if (req.mode === 'pixel') {
        if (!req.pixels || req.pixels.length !== req.size) throw new Error('像素数据尺寸不匹配');
        code = generatePixelIcon({ size: req.size, pixels: req.pixels, className: req.className || DEFAULT_CLASS_NAME });
      } else if (req.mode === 'vector') {
        if (!req.shapes) throw new Error('矢量数据缺失');
        code = generateVectorIcon({ size: req.size, shapes: req.shapes, className: req.className || DEFAULT_CLASS_NAME });
      } else {
        throw new Error('未知模式: ' + req.mode);
      }
      const doc = await vscode.workspace.openTextDocument({ language: 'java', content: code });
      await vscode.window.showTextDocument(doc, { preview: false });
      post({ command: 'generated', code });
    } catch (e) {
      post({ command: 'generateError', error: String(e) });
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new IconViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(IconViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('image2java-icon.openPanel', () => {
      vscode.commands.executeCommand(`${IconViewProvider.viewType}.focus`);
    })
  );
}

export function deactivate() {}

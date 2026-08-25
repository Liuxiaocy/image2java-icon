# Image2Java Icon — 设计文档

日期：2026-08-25
状态：待用户评审

## 1. 目标

做一个 VS Code 扩展，让用户上传一张图片，在 webview 里拖选正方形区域裁剪、选输出分辨率、选生成模式（像素栅格 / 矢量识别），然后生成 **Java 8 + Swing 原生**（不依赖任何第三方库）的 icon 代码，并在编辑器里新开一个未保存的 `.java` 标签展示。

## 2. 已确认的需求

- 输出目标：Java 8，Swing，原生 API，无第三方库。
- 两种代码模式都要：
  - **像素栅格模式**：忠实还原，代码量随 `size²` 增长。
  - **矢量识别模式**：工程近似，可能失真（见 §6 定位）。
- 交互：webview 内拖选正方形裁剪 + 选分辨率（16/32/64/128/256/自定义）。
- 启动方式：侧边栏 activitybar 图标点击，打开一个 webview 面板。
- 输出落点：新开编辑器标签（未保存 `.java`），用户自行保存/复制。
- 同一张图支持像素/矢量**一键切换对比**（不重新裁剪）。
- 矢量模式需在 UI 给出"尽量防失真"的操作提示。

## 3. 技术路线（已定：Webview 中心化）

所有图片处理（显示、拖选裁剪、缩放到目标分辨率、像素采样、矢量轮廓识别）在 webview 内用浏览器原生 Canvas API 完成 —— 零 npm 图片库依赖，契合"原生"取向。

扩展宿主（Node/TS）只做：
1. 注册侧边栏视图与命令、创建 webview panel。
2. 接收 webview 回传的结构化数据。
3. 调用纯函数 generator 拼出 Java 代码字符串。
4. 新开 `.java` 标签展示。

## 4. 项目结构

新文件夹：`D:\Program Files\code\image2java-icon`（TypeScript VS Code 扩展，沿用 `vsplugin/c-java-struct-converter` 的脚本与依赖配置风格）。

```
image2java-icon/
  package.json            # activitybar 视图容器 + webview view + 命令；engines.vscode ^1.80.0
  tsconfig.json
  .vscodeignore
  media/icon.svg          # 侧边栏图标
  src/
    extension.ts          # 注册命令/视图、webview 生命周期、消息处理、生成代码并打开编辑器
    generator/
      javaTemplate.ts     # 公共：类壳/import/工具，两种模式共用
      pixelGenerator.ts   # 像素矩阵 -> BufferedImage + ImageIcon 代码
      vectorGenerator.ts  # 形状列表 -> 实现 javax.swing.Icon 的 Graphics2D 绘制代码
      types.ts            # WebviewMessage、PixelData、ShapeData、生成选项等类型
    webview/
      panel.html          # webview 容器
      crop.ts             # Canvas 显示、拖选正方形裁剪框、分辨率/模式控件、生成/切换按钮
      process.ts          # 缩放到目标分辨率、getImageData 采样、矢量轮廓识别(marching squares + Douglas-Peucker)
  src/test/
    generator.test.ts     # mocha 单测：给定小矩阵/形状，断言生成片段
    extension.test.ts     # vscode-test 集成：打开面板、发消息、校验生成串含关键 API
```

## 5. 数据流

1. 用户点侧边栏图标 → `extension.ts` 创建 webview panel（加载 `panel.html`）。
2. webview 内 `<input type=file>` 或拖拽上传图片 → Canvas 显示原图。
3. 用户在 Canvas 上拖选正方形裁剪框（约束为正方形，可拖动/缩放）。
4. 用户选：分辨率（16/32/64/128/256/自定义，上限 512 防代码爆炸）、模式（像素/矢量）。
5. 点"生成"：
   - `process.ts` 先把裁剪框区域缩放到目标分辨率，得到标准 `size×size` 位图（**这一步只做一次，持久保存在 webview 内存**）。
   - 像素模式：从该位图采样 `int[size][size]` RGB 矩阵。
   - 矢量模式：对该位图做颜色量化 + 轮廓追踪（marching squares）+ 多边形简化（Douglas-Peucker），按主色分组得到 `ShapeData[]`。
   - webview 把 `{mode, size, pixels|shapes, options}` 回传宿主。
6. 宿主按 `mode` 调 `pixelGenerator` 或 `vectorGenerator` → Java 代码字符串。
7. `vscode.workspace.openTextDocument({language:'java', content})` 新开标签展示。
8. **一键切换对比**：因第 5 步的标准位图已缓存，切换模式只需对缓存位图重新跑像素采样或矢量识别并发回，无需重新上传/裁剪。webview 提供"像素 / 矢量"切换按钮，切换后即时重新生成并回传。

## 6. 矢量模式定位与防失真提示

- **定位**：矢量识别是工程近似，不是完美 CV。识别管线 = 颜色量化（减少色块）→ 边缘检测/轮廓追踪（marching squares）→ 多边形简化（Douglas-Peucker，按容差删点）→ 按主色分组填充。复杂图、渐变图、细线条会失真。
- **UI 防失真提示**（在 webview 矢量模式区域常驻一处提示框）：
  - 用高对比度、色块少、边缘清晰的图（logo / 扁平图标最佳）。
  - 避免渐变、照片、半透明、细发丝线。
  - 适当提高输出分辨率，轮廓更平滑。
  - 调大"简化容差"会让形状更简洁但更失真，调小更保真但顶点更多。
  - （可选控件）提供"颜色数量"与"简化容差"两个滑块让用户在保真/简洁间权衡。

## 7. 两种生成模板（Java 8 Swing 原生）

**像素模式** —— 生成类（如 `ImageIconFromPixels`）：
- 构造 `BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB)`。
- 用嵌套循环 `img.setRGB(x, y, pixels[y][x])` 填充。
- 提供 `ImageIcon toImageIcon()` 返回 `new ImageIcon(img)`。
- 提供 `BufferedImage toBufferedImage()`。

**矢量模式** —— 生成类（如 `VectorIcon` implements `javax.swing.Icon`）：
- 实现 `getIconWidth()/getIconHeight()` 返回 `size`。
- `paintIcon(Component c, Graphics g, int x, int y)` 中：`Graphics2D g2 = (Graphics2D) g.create();` 按 `ShapeData[]` 用 `g2.setPaint(...)` + `g2.fill(Path2D)` / `draw` 绘制各主色多边形，坐标相对 `(x,y)` 偏移。
- 用 `java.awt.geom.Path2D` 与 `java.awt.Color` 原生类。

两者共用 `javaTemplate.ts` 生成的头部：package 占位（可空）、import（`javax.swing.*`、`java.awt.*`、`java.awt.image.*`、`java.awt.geom.*`）、类注释说明来源图与尺寸。

## 8. 错误处理

- webview 内即时校验并提示：非图片文件、未选图就生成、空/零尺寸裁剪区、分辨率超出上限（>512 拒绝并提示）。
- 宿主侧对回传数据做基本结构校验（size 合法、pixels/shapes 非空），异常时 `vscode.window.showErrorMessage`。
- 不引入额外依赖；错误提示用 VS Code 原生 API。

## 9. 测试

- `generator.test.ts`（mocha）：像素 generator 给定 2×2 矩阵，断言生成串含 `setRGB` 与对应十六进制色；矢量 generator 给定简单形状，断言含 `Path2D`/`fill` 与 `implements Icon` 关键片段。
- `extension.test.ts`（vscode-test）：启动扩展、执行打开面板命令、模拟 webview 回传消息、断言新开文档语言为 java 且内容含目标 API。
- 不做 UI 自动化截图测试（超出范围）。

## 10. 范围边界（YAGNI）

- 不做：多图批量、导出 `.ico`/`.png` 二进制、历史记录、云同步、右键图片菜单（本期仅侧边栏入口）、JavaFX/Android 目标（仅 Swing）。
- 矢量模式不追求学术级识别精度，按 §6 工程近似实现即可。

## 11. 后续可扩展（非本期）

- 右键图片菜单入口。
- 导出为文件而非仅标签。
- 更多目标框架（JavaFX）。
- 矢量识别升级（更优的边缘/角点算法）。

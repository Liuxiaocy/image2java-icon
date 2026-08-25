export interface HeaderOptions {
  className: string;
  imports: string[];
  comment: string;
}

// 生成 Java 文件头：import + 类注释。各 generator 在其后拼接类体。
export function buildHeader(opts: HeaderOptions): string {
  const imp = opts.imports.map((i) => `import ${i};`).join('\n');
  return `${imp}\n\n/**\n * ${opts.comment}\n */`;
}

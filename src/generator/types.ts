// 像素模式输入：pixels[y][x] = 0xAARRGGBB（32 位无符号整数）
export interface PixelInput {
  size: number;
  pixels: number[][];
  className?: string;
}

// 单个矢量形状：一个颜色 + 若干多边形（每个多边形是 [[x,y],...]，坐标在 0..size 空间）
export interface VectorShape {
  color: number; // 0xAARRGGBB
  polygons: number[][][];
}

export interface VectorInput {
  size: number;
  shapes: VectorShape[];
  className?: string;
}

// webview -> 宿主 的 generate 请求
export type GenerateMode = 'pixel' | 'vector';
export interface GenerateRequest {
  command: 'generate';
  mode: GenerateMode;
  size: number;
  pixels?: number[][];      // mode === 'pixel'
  shapes?: VectorShape[];   // mode === 'vector'
  className?: string;
}

// 宿主 -> webview 的状态回传
export interface GenerateResultMessage {
  command: 'generated' | 'generateError';
  code?: string;
  error?: string;
}

export const MAX_SIZE = 512;
export const DEFAULT_CLASS_NAME = 'GeneratedIcon';

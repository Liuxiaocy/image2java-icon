export function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Image2Java Icon</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; height:100%; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:var(--vscode-foreground); background:var(--vscode-sideBar-background); }
  .wrap { display:flex; flex-direction:column; height:100vh; padding:10px; gap:8px; overflow:auto; }
  .row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
  canvas { max-width:100%; border:1px solid var(--vscode-panel-border); background:
    repeating-conic-gradient(#888 0% 25%, #ccc 0% 50%) 50% / 16px 16px; touch-action:none; }
  #stage { position:relative; display:inline-block; line-height:0; }
  #crop { position:absolute; border:2px dashed #fff; box-shadow:0 0 0 9999px rgba(0,0,0,0.45); cursor:move; }
  #crop .handle { position:absolute; right:-6px; bottom:-6px; width:12px; height:12px; background:#fff; border-radius:2px; cursor:nwse-resize; }
  button { padding:4px 10px; font-size:12px; color:var(--vscode-button-foreground); background:var(--vscode-button-background); border:none; border-radius:4px; cursor:pointer; }
  button:hover { background:var(--vscode-button-hoverBackground); }
  button.secondary { background:var(--vscode-button-secondaryBackground); color:var(--vscode-button-secondaryForeground); }
  button.active { outline:2px solid var(--vscode-focusBorder); }
  select, input[type=number] { padding:4px 6px; font-size:12px; color:var(--vscode-input-foreground); background:var(--vscode-input-background); border:1px solid var(--vscode-input-border,transparent); border-radius:4px; }
  label.lbl { font-size:11px; color:var(--vscode-descriptionForeground); }
  .status { font-size:11px; min-height:16px; color:var(--vscode-descriptionForeground); }
  .status.error { color:var(--vscode-errorForeground); }
  .status.success { color:var(--vscode-terminal-ansiGreen); }
  .tip { font-size:10px; color:var(--vscode-descriptionForeground); opacity:0.8; border-left:2px solid var(--vscode-panel-border); padding-left:6px; }
  .hidden { display:none; }
  .opts { display:flex; flex-direction:column; gap:4px; padding:6px; border:1px solid var(--vscode-panel-border); border-radius:4px; }
  .opts .r { display:flex; gap:6px; align-items:center; font-size:11px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="row">
    <input type="file" id="file" accept="image/*">
    <button id="clear" class="secondary">清空</button>
  </div>
  <div id="stage" class="hidden">
    <canvas id="view"></canvas>
    <div id="crop"><div class="handle"></div></div>
  </div>
  <div class="row">
    <label class="lbl">分辨率</label>
    <select id="res">
      <option value="16">16</option><option value="32">32</option><option value="64">64</option>
      <option value="128" selected>128</option><option value="256">256</option>
      <option value="custom">自定义</option>
    </select>
    <input type="number" id="resCustom" class="hidden" min="1" max="512" value="128" style="width:70px;">
  </div>
  <div class="row">
    <label class="lbl">模式</label>
    <button id="modePixel" class="active">像素</button>
    <button id="modeVector">矢量</button>
  </div>
  <div id="vecOpts" class="opts hidden">
    <div class="r"><label class="lbl" style="flex:1">颜色数量</label><input type="range" id="colors" min="2" max="32" value="8"><span id="colorsVal">8</span></div>
    <div class="r"><label class="lbl" style="flex:1">简化容差</label><input type="range" id="tol" min="0" max="100" value="20"><span id="tolVal">0.20</span></div>
    <div class="tip">防失真提示：用高对比度、色块少、边缘清晰的图（logo / 扁平图标最佳）；避免渐变、照片、半透明、细发丝线；适当提高分辨率轮廓更平滑；调大容差更简洁但更失真，调小更保真但顶点更多。</div>
  </div>
  <div class="row">
    <button id="gen">生成</button>
    <span class="status" id="status"></span>
  </div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const fileEl = document.getElementById('file');
  const stage = document.getElementById('stage');
  const view = document.getElementById('view');
  const crop = document.getElementById('crop');
  const ctx = view.getContext('2d');
  const resEl = document.getElementById('res');
  const resCustom = document.getElementById('resCustom');
  const modePixel = document.getElementById('modePixel');
  const modeVector = document.getElementById('modeVector');
  const vecOpts = document.getElementById('vecOpts');
  const colorsEl = document.getElementById('colors');
  const tolEl = document.getElementById('tol');
  const colorsVal = document.getElementById('colorsVal');
  const tolVal = document.getElementById('tolVal');
  const genBtn = document.getElementById('gen');
  const statusEl = document.getElementById('status');
  const clearBtn = document.getElementById('clear');

  let img = null;
  let mode = 'pixel';
  let cropRect = { x: 0, y: 0, size: 100 };
  let dragging = false, resizing = false, startX = 0, startY = 0;

  function setStatus(msg, type) { statusEl.textContent = msg || ''; statusEl.className = 'status' + (type ? ' ' + type : ''); }

  fileEl.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setStatus('请选择图片文件', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        img = im;
        view.width = im.naturalWidth; view.height = im.naturalHeight;
        ctx.drawImage(im, 0, 0);
        stage.classList.remove('hidden');
        const s = Math.min(im.naturalWidth, im.naturalHeight);
        cropRect = { x: (im.naturalWidth - s) / 2, y: (im.naturalHeight - s) / 2, size: s };
        positionCrop();
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(f);
  });

  function positionCrop() {
    crop.style.left = cropRect.x + 'px';
    crop.style.top = cropRect.y + 'px';
    crop.style.width = cropRect.size + 'px';
    crop.style.height = cropRect.size + 'px';
  }

  crop.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('handle')) { resizing = true; } else { dragging = true; }
    startX = e.clientX; startY = e.clientY;
    crop.setPointerCapture(e.pointerId);
  });
  crop.addEventListener('pointermove', (e) => {
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (dragging) {
      cropRect.x = Math.max(0, Math.min(view.width - cropRect.size, cropRect.x + dx));
      cropRect.y = Math.max(0, Math.min(view.height - cropRect.size, cropRect.y + dy));
      startX = e.clientX; startY = e.clientY; positionCrop();
    } else if (resizing) {
      const ns = Math.max(8, Math.min(view.width - cropRect.x, view.height - cropRect.y, cropRect.size + dx));
      cropRect.size = ns; positionCrop();
    }
  });
  crop.addEventListener('pointerup', () => { dragging = false; resizing = false; });

  resEl.addEventListener('change', () => {
    resCustom.classList.toggle('hidden', resEl.value !== 'custom');
  });
  function resolveSize() {
    let s = resEl.value === 'custom' ? parseInt(resCustom.value, 10) : parseInt(resEl.value, 10);
    if (!s || s < 1) s = 128;
    if (s > 512) { setStatus('分辨率上限 512，已限制', 'error'); s = 512; }
    return s;
  }

  modePixel.addEventListener('click', () => { mode = 'pixel'; modePixel.classList.add('active'); modeVector.classList.remove('active'); vecOpts.classList.add('hidden'); });
  modeVector.addEventListener('click', () => { mode = 'vector'; modeVector.classList.add('active'); modePixel.classList.remove('active'); vecOpts.classList.remove('hidden'); });
  colorsEl.addEventListener('input', () => colorsVal.textContent = colorsEl.value);
  tolEl.addEventListener('input', () => tolVal.textContent = (tolEl.value / 100).toFixed(2));

  clearBtn.addEventListener('click', () => {
    img = null; stage.classList.add('hidden'); fileEl.value = ''; setStatus('');
  });

  function samplePixels(data, size) {
    const px = [];
    for (let y = 0; y < size; y++) { const row = []; for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; const a = data[i+3], r = data[i], g = data[i+1], b = data[i+2]; row.push(((a << 24) | (r << 16) | (g << 8) | b) >>> 0); } px.push(row); }
    return px;
  }
  function unpack(c) { return [(c >>> 24) & 0xff, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff]; }
  function quantizeColors(pixels, size, maxColors) {
    const hist = new Map(); const TRANSPARENT = 0;
    for (let y=0;y<size;y++) for (let x=0;x<size;x++){ const c=pixels[y][x]; const a=unpack(c)[0]; if(a<16) continue; hist.set(c,(hist.get(c)||0)+1); }
    const reps = [...hist.entries()].filter(([c])=>c!==TRANSPARENT).sort((a,b)=>b[1]-a[1]).slice(0,Math.max(1,maxColors)).map(([c])=>c);
    const out=[]; for(let y=0;y<size;y++){ const row=[]; for(let x=0;x<size;x++){ const c=pixels[y][x]; const a=unpack(c)[0]; if(a<16){row.push(TRANSPARENT);continue;} let best=reps[0],bd=Infinity; for(const r of reps){const[ar,rr,gr,br]=unpack(r);const[ac,rc,gc,bc]=unpack(c);const d=(ar-ac)**2+(rr-rc)**2+(gr-gc)**2+(br-bc)**2; if(d<bd){bd=d;best=r;}} row.push(best);} out.push(row);} return out;
  }
  function mooreTrace(mask,h,w){ const inside=(y,x)=>y>=0&&x>=0&&y<h&&x<w&&mask[y][x]; let sy=-1,sx=-1; for(let y=0;y<h&&sy<0;y++)for(let x=0;x<w;x++)if(mask[y][x]){sy=y;sx=x;break;} if(sy<0)return null; const dirs=[[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1]]; const bnd=[]; let cy=sy,cx=sx,dir=7,steps=0; const max=h*w*4; do{ bnd.push([cy,cx]); let f=false; for(let k=0;k<8;k++){const nd=(dir+k)%8;const ny=cy+dirs[nd][0],nx=cx+dirs[nd][1]; if(inside(ny,nx)){cy=ny;cx=nx;dir=(nd+6)%8;f=true;break;}} if(!f)break; steps++; }while((cy!==sy||cx!==sx)&&steps<max); return bnd.length>=3?bnd:null; }
  function douglasPeucker(points,eps){ if(points.length<3)return points; let md=0,idx=0; const[y0,x0]=points[0],[y1,x1]=points[points.length-1]; const dx=x1-x0,dy=y1-y0,len=Math.hypot(dx,dy)||1; for(let i=1;i<points.length-1;i++){const[py,px]=points[i];const d=Math.abs((px-x0)*dy-(py-y0)*dx)/len; if(d>md){md=d;idx=i;}} if(md>eps){const L=douglasPeucker(points.slice(0,idx+1),eps); const R=douglasPeucker(points.slice(idx),eps); return L.slice(0,-1).concat(R);} return [points[0],points[points.length-1]]; }
  function traceShapes(quantized,size,tolerance){ const TRANSPARENT=0; const colors=new Map(); for(let y=0;y<size;y++)for(let x=0;x<size;x++){const c=quantized[y][x]; if(c===TRANSPARENT)continue; if(!colors.has(c)){colors.set(c,Array.from({length:size},()=>new Array(size).fill(false)));} colors.get(c)[y][x]=true;} const shapes=[]; for(const[color,mask]of colors){ const visited=Array.from({length:size},()=>new Array(size).fill(false)); for(let y=0;y<size;y++)for(let x=0;x<size;x++){ if(!mask[y][x]||visited[y][x])continue; const st=[[y,x]]; while(st.length){const[cy,cx]=st.pop(); if(cy<0||cx<0||cy>=size||cx>=size)continue; if(!mask[cy][cx]||visited[cy][cx])continue; visited[cy][cx]=true; st.push([cy+1,cx],[cy-1,cx],[cy,cx+1],[cy,cx-1]);} const c=mooreTrace(mask,size,size); if(c){const s=douglasPeucker(c,Math.max(0.5,tolerance*size)); shapes.push({color,polygons:[s]});} } } return shapes; }

  genBtn.addEventListener('click', () => {
    if (!img) { setStatus('请先上传图片', 'error'); return; }
    if (cropRect.size < 1) { setStatus('裁剪区域无效', 'error'); return; }
    const size = resolveSize();
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const octx = off.getContext('2d');
    octx.drawImage(img, cropRect.x, cropRect.y, cropRect.size, cropRect.size, 0, 0, size, size);
    const data = octx.getImageData(0, 0, size, size).data;
    if (mode === 'pixel') {
      const pixels = samplePixels(data, size);
      vscode.postMessage({ command: 'generate', mode: 'pixel', size, pixels });
      setStatus('已发送像素生成请求', 'success');
    } else {
      const px = samplePixels(data, size);
      const q = quantizeColors(px, size, parseInt(colorsEl.value, 10));
      const shapes = traceShapes(q, size, parseInt(tolEl.value, 10) / 100);
      vscode.postMessage({ command: 'generate', mode: 'vector', size, shapes });
      setStatus('已发送矢量生成请求（' + shapes.length + ' 个形状）', 'success');
    }
  });
</script>
</body>
</html>`;
}

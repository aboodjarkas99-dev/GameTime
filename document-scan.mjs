// Page correction runs locally; source images never leave the browser.
export function perspectiveMap(corners) {
  const uv=[[0,0],[1,0],[1,1],[0,1]], a=[];
  corners.forEach(([x,y],i)=>{const [u,v]=uv[i];a.push([u,v,1,0,0,0,-x*u,-x*v,x],[0,0,0,u,v,1,-y*u,-y*v,y]);});
  for(let i=0;i<8;i++){
    let pivot=i;for(let j=i+1;j<8;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    [a[i],a[pivot]]=[a[pivot],a[i]];
    if(Math.abs(a[i][i])<1e-9)throw new Error('Place the four corners around the page.');
    const n=a[i][i];for(let k=i;k<9;k++)a[i][k]/=n;
    for(let j=0;j<8;j++)if(j!==i){const f=a[j][i];for(let k=i;k<9;k++)a[j][k]-=f*a[i][k];}
  }
  const h=a.map(r=>r[8]);
  return (u,v)=>{const d=h[6]*u+h[7]*v+1;return [(h[0]*u+h[1]*v+h[2])/d,(h[3]*u+h[4]*v+h[5])/d]};
}
export function pdfPageText(items) {
  const rows=[];
  for(const item of items){if(!item.str?.trim())continue;const y=item.transform?.[5]??0,x=item.transform?.[4]??0;
    let row=rows.find(r=>Math.abs(r.y-y)<Math.max(2,Math.min(Number(item.height)||8,10)*0.4));
    if(!row){row={y,items:[]};rows.push(row)}row.items.push({x,text:item.str});
  }
  return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')).join('\n');
}
function warpPage(image,corners){
  // Reject crossed or collapsed quadrilaterals before projective correction.
  const cross=corners.map((p,i)=>{const q=corners[(i+1)%4],r=corners[(i+2)%4];return (q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0])});
  if(cross.some(x=>x<1))throw new Error('Keep corners in order: top left, top right, bottom right, bottom left.');
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const w=(distance(corners[0],corners[1])+distance(corners[3],corners[2]))/2;
  const h=(distance(corners[0],corners[3])+distance(corners[1],corners[2]))/2;
  if(Math.min(w,h)<250)throw new Error('The page is too small. Retake it closer, with all four corners visible.');
  const scale=Math.min(2,2200/Math.max(w,h)),width=Math.round(w*scale),height=Math.round(h*scale);
  const src=document.createElement('canvas');src.width=image.naturalWidth;src.height=image.naturalHeight;src.getContext('2d').drawImage(image,0,0);
  const pixels=src.getContext('2d').getImageData(0,0,src.width,src.height).data;
  const out=document.createElement('canvas');out.width=width;out.height=height;
  const ctx=out.getContext('2d'),result=ctx.createImageData(width,height),map=perspectiveMap(corners);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const [sx,sy]=map(x/(width-1),y/(height-1));const xx=Math.max(0,Math.min(src.width-2,sx)),yy=Math.max(0,Math.min(src.height-2,sy));
    const x0=Math.floor(xx),y0=Math.floor(yy),fx=xx-x0,fy=yy-y0;
    let grey=0;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      const i=((y0+dy)*src.width+x0+dx)*4,weight=(dx?fx:1-fx)*(dy?fy:1-fy);
      grey+=weight*(0.299*pixels[i]+0.587*pixels[i+1]+0.114*pixels[i+2]);
    }
    const g=Math.max(0,Math.min(255,(grey-128)*1.15+128)),i=(y*width+x)*4;
    result.data[i]=result.data[i+1]=result.data[i+2]=g;result.data[i+3]=255;
  }
  ctx.putImageData(result,0,0);return out;
}
export async function scanPage(file){
  const url=URL.createObjectURL(file),image=new Image();image.src=url;
  try{await image.decode()}catch{URL.revokeObjectURL(url);throw new Error('Could not open this image. Use a JPEG or PNG photo.');}
  return new Promise((resolve,reject)=>{
    const overlay=document.createElement('section');overlay.className='document-scanner';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Scan packing slip');
    overlay.innerHTML='<div class="scan-dialog"><h2>Scan packing slip</h2><p>Drag each blue corner onto the matching corner of the paper. Include the entire order, header, and bottom rows.</p><canvas class="scan-canvas"></canvas><p class="scan-note"></p><div class="scan-actions"><button type="button" data-scan-cancel>Cancel</button><button type="button" data-scan-rotate>Rotate 90°</button><button type="button" data-scan-use>Correct page & read</button></div></div>';
    document.body.append(overlay);const canvas=overlay.querySelector('canvas'),ctx=canvas.getContext('2d'),note=overlay.querySelector('.scan-note');
    let corners,drag=-1;
    const reset=()=>{const ratio=Math.min(1,1000/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);corners=[[0,0],[canvas.width-1,0],[canvas.width-1,canvas.height-1],[0,canvas.height-1]];draw();note.textContent=Math.min(image.naturalWidth,image.naturalHeight)<1200?'Low-resolution photo: retake closer for small text. Check every line after reading.':'Avoid shadows, blur, and reflections. Reading can still miss lines: compare against the paper.'};
    const draw=()=>{ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.strokeStyle='#0284c7';ctx.lineWidth=4;ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.stroke();corners.forEach((p,i)=>{ctx.fillStyle='#0284c7';ctx.beginPath();ctx.arc(...p,16,0,Math.PI*2);ctx.fill();ctx.fillStyle='white';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText(String(i+1),p[0],p[1]+6)})};
    const position=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]};
    canvas.onpointerdown=e=>{const p=position(e);drag=corners.map(c=>Math.hypot(c[0]-p[0],c[1]-p[1])).reduce((best,d,i,all)=>d<all[best]?i:best,0);canvas.setPointerCapture(e.pointerId)};
    canvas.onpointermove=e=>{if(drag<0)return;const p=position(e);corners[drag]=[Math.max(0,Math.min(canvas.width-1,p[0])),Math.max(0,Math.min(canvas.height-1,p[1]))];draw()};
    canvas.onpointerup=canvas.onpointercancel=()=>{drag=-1};
    const close=()=>{overlay.remove();URL.revokeObjectURL(url)};
    overlay.querySelector('[data-scan-cancel]').onclick=()=>{close();resolve(null)};
    overlay.querySelector('[data-scan-rotate]').onclick=async()=>{const c=document.createElement('canvas');c.width=image.naturalHeight;c.height=image.naturalWidth;const cx=c.getContext('2d');cx.translate(c.width,0);cx.rotate(Math.PI/2);cx.drawImage(image,0,0);image.src=c.toDataURL('image/jpeg',0.98);await image.decode();reset()};
    overlay.querySelector('[data-scan-use]').onclick=()=>{try{const corrected=warpPage(image,corners.map(([x,y])=>[x*image.naturalWidth/canvas.width,y*image.naturalHeight/canvas.height]));close();resolve(corrected)}catch(e){note.textContent=e.message}};
    reset();
  });
}

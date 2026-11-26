import { REGISTERED_ART } from './registered-art.mjs';
import { renderArmorClaspEmblem } from './armor-clasp-emblem.mjs';
const THEMES={nurgle:'green',slaanesh:'violet',khorne:'ember',tzeentch:'blue',green:'green',violet:'violet',ember:'ember',blue:'blue'};
const INK={green:'#f4ecd3',violet:'#f7e9f2',ember:'#f8e6d0',blue:'#e6eff8'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const round=r=>r.map(v=>Math.round(v*1000)/1000);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CUTS={armor:{task:{x:[765,795,1575,1640],y:[390,520],base:[19,13,2156,716]},catalog:{x:[720,724,1496,1500],layoutX:[700,770,1440,1510],y:[430,500],base:[32,33,2144,691]}},gothic:{task:{x:[680,684,1445,1449],y:[390,510],base:[9,0,2093,749]},catalog:{x:[371,375,1541,1545],layoutX:[340,400,1460,1530],y:[430,500],base:[31,16,1905,796]}}};
function measureFor(options){return(text,size,role)=>{let n;try{n=options.measureText?.(text,size,role);}catch{/* fallback below */}return Number.isFinite(n)&&n>=0?n:String(text).length*size*.54;};}
function wrap(value,width,size,measure){
 const out=[];let line='';
 for(const word of String(value).trim().split(/\s+/)){
  const next=line?line+' '+word:word;
  if(measure(next,size,'title')<=width){line=next;continue;}
  if(measure(word,size,'title')<=width){if(line)out.push(line);line=word;continue;}
  // A compound may break at its existing hyphen, retaining the printed hyphen.
  const parts=word.split(/(?<=[-‐‑–—])/u);
  for(let i=0;i<parts.length;i++){
   const candidate=line+(line&&i===0?' ':'')+parts[i];
   if(line&&measure(candidate,size,'title')>width){out.push(line);line=parts[i];}
   else line=candidate;
  }
 }
 if(line)out.push(line);return out.length?out:[''];
}
function fitTitle(value,width,preferred,measure,maxLines){
 let size=preferred,lines=wrap(value,width,size,measure);
 while(size>18&&(lines.length>maxLines||lines.some(s=>measure(s,size,'title')>width))){
  size=Math.max(18,size-.5);lines=wrap(value,width,size,measure);
 }
 const omitted=lines.length>maxLines,truncated=omitted||lines.some(s=>measure(s,size,'title')>width);
 lines=lines.slice(0,maxLines).map((line,i,shown)=>{
  const clipped=measure(line,size,'title')>width;
  if(!clipped&&!(omitted&&i===shown.length-1))return line;
  while(line&&measure(line.trimEnd()+'…',size,'title')>width)line=line.slice(0,-1);
  return line.trimEnd()+'…';
 });
 return{text:String(value),fontSize:size,lines,lineHeight:size*1.08,truncated};
}
function mapping(points,lengths,start){const dst=[start];for(const n of lengths)dst.push(dst.at(-1)+n);return{source:points,destination:dst,map(v){if(v<=points[0])return dst[0]+v-points[0];for(let i=0;i<points.length-1;i++)if(v<=points[i+1])return dst[i]+(v-points[i])/(points[i+1]-points[i])*(dst[i+1]-dst[i]);return dst.at(-1)+v-points.at(-1);}};}
const rectBetween=(x1,y1,x2,y2)=>[x1,y1,Math.max(0,x2-x1),Math.max(0,y2-y1)];

/** The catalogue retains its own two-part painting. Quiet stone in the opening
 * absorbs the extra height needed by the shared page envelope; sculpted corners
 * and the original return plaque keep their native optical scale. */
function getCompactCatalogLayout(availableWidth,options){
 const shell=getClassicLayout(availableWidth,{...options,mode:'task',page:'task'});
 const {width,height,style,theme}=shell,art=REGISTERED_ART[style].catalog[theme],cfg=CUTS[style].catalog,b=art.bounds;
 const bw=b[2]-b[0],bh=b[3]-b[1],k=(width-16)/bw;
 const nativeX=x=>b[0]+(x-cfg.base[0])/(cfg.base[2]-cfg.base[0])*bw;
 const nativeY=y=>b[1]+(y-cfg.base[1])/(cfg.base[3]-cfg.base[1])*bh;
 const xp=[b[0],...cfg.x.map(nativeX),b[2]],xm=mapping(xp,xp.slice(1).map((x,i)=>(x-xp[i])*k),8);
 const yp=[b[1],...cfg.y.map(nativeY),b[3]],extra=height-8-bh*k;
 const ym=mapping(yp,yp.slice(1).map((y,i)=>(y-yp[i])*k+(i===1?extra:0)),4);
 const zone=name=>{const z=art.zones[name];return rectBetween(xm.map(b[0]+z[0]*bw),ym.map(b[1]+z[1]*bh),xm.map(b[0]+z[2]*bw),ym.map(b[1]+z[3]*bh));};
 const title=zone('title'),back=zone('back'),measure=measureFor(options),labels={},rects={},hits={};
 labels.title={...fitTitle(options.catalogTitle||'All tasks',title[2],22,measure,2),rect:title};
 const full=options.backToTaskLabel||'Back to task',text=options.backToTaskLabel||'Back',fontSize=14;
 const icon=14,gap=6,pad=5,textW=Math.min(measure(text,fontSize,'back'),back[2]-pad*2),hasArrow=back[2]>=textW+icon+gap+pad*2;
 const groupW=textW+(hasArrow?icon+gap:0),gx=back[0]+(back[2]-groupW)/2,cy=back[1]+back[3]/2;
 labels.back={text,fullText:full,fontSize,rect:[gx+(hasArrow?icon+gap:0),back[1],textW,back[3]]};
 rects.title=title.slice();rects.back=back.slice();
 if(hasArrow)rects.backArrow=[gx,cy-icon/2,icon,icon];
 const hitHeight=Math.max(44,back[3]),hitY=Math.max(48,cy-hitHeight/2);
 hits.back=[back[0],hitY,Math.max(44,back[2]),Math.max(44,Math.min(hitHeight,back[1]+back[3]-hitY))];
 const blue=style==='gothic'?[29,18,1907,794]:[20,24,2184,690],sourceGem=style==='gothic'?[970,245]:[1104,175];
 const cx=xm.map(b[0]+(sourceGem[0]-blue[0])/(blue[2]-blue[0])*bw),gy=ym.map(b[1]+(sourceGem[1]-blue[1])/(blue[3]-blue[1])*bh);
 rects.theme=[cx-22,Math.max(0,gy-22),44,44];rects.themeHousing=rects.theme.slice();hits.theme=rects.theme.slice();
 const th=rects.theme,backHit=hits.back;
 th[1]=Math.min(th[1],Math.max(0,backHit[1]-48));hits.theme=th.slice();
 for(const[key,r]of Object.entries(rects))rects[key]=round(r);for(const[key,r]of Object.entries(hits))hits[key]=round(r);for(const l of Object.values(labels))l.rect=round(l.rect);
 const registeredArt={file:art.file,size:art.size,xSource:xp,xDestination:xm.destination,ySource:yp,yDestination:ym.destination,backReplacement:null};
 delete hits.theme;
 return{version:'10.9',width,height,availableWidth:Number(availableWidth),style,mode:'catalog',theme,rects,hits,labels,text:labels,decor:{q:0,sideReveal:1,dock:1},anchor:{width,height,baseline:height-4,centerX:width/2},artScale:1,registeredArt,showTheme:false,appearanceLocation:'external'};
}
/** One registered V5 painting; only quiet connecting material extends. */
export function getClassicLayout(availableWidth,options={}){
 const mode=(options.mode||options.page)==='catalog'?'catalog':'task',style=options.style==='armor'?'armor':'gothic';
 if(mode==='catalog')return getCompactCatalogLayout(availableWidth,options);
 const width=clamp(Number(availableWidth)||288,288,1040),theme=THEMES[options.theme]||'green';
 // Task keeps its registered navigation painting. Catalogue registration uses
 // its own original painting with this same measured outer envelope.
 const art=REGISTERED_ART[style].task[theme],cfg=CUTS[style].task,b=art.bounds,bw=b[2]-b[0],bh=b[3]-b[1];
 const inner=width-16,opticalWidth=inner<=414?inner:414+(inner-414)*.18,k=opticalWidth/bw,extra=inner-opticalWidth;
 const nativeX=x=>b[0]+(x-cfg.base[0])/(cfg.base[2]-cfg.base[0])*bw;
 const nativeY=y=>b[1]+(y-cfg.base[1])/(cfg.base[3]-cfg.base[1])*bh;
 const xp=[b[0],...cfg.x.map(nativeX),b[2]],xm=mapping(xp,xp.slice(1).map((x,i)=>(x-xp[i])*k+(i===1||i===3?extra/2:0)),8);
 const yp=[b[1],...cfg.y.map(nativeY),b[3]],makeY=added=>mapping(yp,yp.slice(1).map((y,i)=>(y-yp[i])*k+(i===1?added:0)),4);
 let ym=makeY(0);
 const zone=name=>{const z=art.zones[name];return rectBetween(xm.map(b[0]+z[0]*bw),ym.map(b[1]+z[1]*bh),xm.map(b[0]+z[2]*bw),ym.map(b[1]+z[3]*bh));};
 const rects={},hits={},labels={},measure=measureFor(options),wide=clamp((width-430)/1170,0,1);
 const crestY=style==='gothic'?nativeY(210):nativeY(150);
 rects.theme=[width/2-22,Math.max(0,ym.map(crestY)-22),44,44];hits.theme=rects.theme.slice();rects.themeHousing=rects.theme.slice();
 let backReplacement=null,z=zone('title'),pr=zone('prev'),nr=zone('next');
 const pc=pr[0]+pr[2]/2,nc=nr[0]+nr[2]/2,left=Math.max(z[0],pc+27),right=Math.min(z[0]+z[2],nc-27),tw=Math.min(760,right-left),tx=(left+right-tw)/2;
 const y1=b[1]+art.zones.title[1]*bh,y2=b[1]+art.zones.title[3]*bh;
 const influence=clamp((y2-yp[1])/(yp[2]-yp[1]),0,1)-clamp((y1-yp[1])/(yp[2]-yp[1]),0,1);
 // Reserve two normal text lines once, independently of either page title.
 const reservedTitleHeight=(20+14*wide)*1.08*2+8;
 const added=Math.max(0,(reservedTitleHeight-z[3])/Math.max(.2,influence));
 ym=makeY(added);z=zone('title');
 const number=zone('number'),nh=14+2*wide,numberY=Math.min(number[1]+number[3]/2-nh/2,z[1]+2-nh-2);
 const titleBox=mode==='catalog'?[tx,numberY,tw,z[1]+z[3]-numberY]:[tx,z[1]+2,tw,z[3]-4];
 const value=mode==='catalog'?(options.catalogTitle||'All tasks'):(options.taskTitle??options.title??'Reverse a String');
 labels.title={...fitTitle(value,tw,(mode==='catalog'?22:20)+14*wide,measure,2),rect:titleBox};
 if(mode==='task')labels.number={text:'TASK '+String(options.taskNumber??1).padStart(2,'0'),rect:[tx,numberY,tw,nh],fontSize:12+2*wide};
 const navY=z[1]+z[3]/2;
 rects.previous=[pc-22,navY-22,44,44];rects.next=[nc-22,navY-22,44,44];
 if(mode==='task'){
  hits.previous=rects.previous.slice();hits.next=rects.next.slice();
  rects.arrowPrevious=[pc-8,navY-9,16,18];rects.arrowNext=[nc-8,navY-9,16,18];
 }
 rects.title=[tx-8,numberY-4,tw+16,z[1]+z[3]-numberY+8];
 let back=zone('back');
 const source=style==='gothic'?[285,188,641,337]:[282,99,765,275],sr=[nativeX(source[0]),nativeY(source[1]),nativeX(source[2]),nativeY(source[3])];
 const bx=xm.map(sr[0]),by=ym.map(sr[1]),originalW=xm.map(sr[2])-bx,backH=ym.map(sr[3])-by;
 const targetW=Math.max(originalW,Math.min(100,rects.theme[0]-4-bx)),backFont=14+4*wide;
 if(targetW>originalW+.5){backReplacement={source:sr,destination:[bx,by,targetW,backH]};back=[bx+6,by+2,targetW-12,Math.max(18,backH-4)];}
 const cy=back[1]+back[3]/2,hy=Math.min(cy-22,rects.previous[1]-46);
 hits.back=[back[0]-3,Math.max(0,hy),Math.max(44,back[2]+6),44];rects.back=back.slice();
 const customLabel=mode==='catalog'?options.backToTaskLabel:options.allTasksLabel;
 const full=customLabel||(mode==='catalog'?'Back to task':'All tasks');
 const text=!customLabel&&(width<=430||measure(full,backFont,'back')+34>back[2])?'Back':full;
 labels.back={text,fullText:full,rect:back.slice(),fontSize:backFont};
 // A short Back label and its arrow share one centered visual group.
 const backBox=rects.back,backLabel=labels.back,icon=14,gap=8,pad=6;
 const textW=Math.min(measure(backLabel.text,backLabel.fontSize,'back'),backBox[2]-2*pad);
 const iconFits=backBox[2]>=textW+icon+gap+2*pad;
 const groupW=textW+(iconFits?icon+gap:0),groupX=backBox[0]+(backBox[2]-groupW)/2,backCy=backBox[1]+backBox[3]/2;
 if(iconFits)rects.backArrow=[groupX,backCy-icon/2,icon,icon];
 labels.back={...backLabel,rect:[groupX+(iconFits?icon+gap:0),backCy-backLabel.rect[3]/2,textW,backLabel.rect[3]]};
 for(const [key,r]of Object.entries(rects))rects[key]=round(r);for(const [key,r]of Object.entries(hits))hits[key]=round(r);for(const l of Object.values(labels))if(l.rect)l.rect=round(l.rect);
 const height=ym.destination.at(-1)+4;
 const registeredArt={file:art.file,size:art.size,xSource:xp,xDestination:xm.destination,ySource:yp,yDestination:ym.destination,backReplacement};
 const frameSource=style==='gothic'?[292,333,1514,331]:[268,273,1637,367];
 const frame=round([xm.map(frameSource[0]),ym.map(frameSource[1]),xm.map(frameSource[0]+frameSource[2])-xm.map(frameSource[0]),ym.map(frameSource[1]+frameSource[3])-ym.map(frameSource[1])]);
 const anchor={width,height,baseline:height-4,centerX:width/2,frame,crest:rects.themeHousing.slice(),back:rects.back.slice(),theme:rects.theme.slice(),registeredArt};
 delete hits.theme;
 return{version:'10.9',width,height,availableWidth:Number(availableWidth),style,mode,theme,rects,hits,labels,text:labels,decor:{q:wide,sideReveal:1,dock:1},anchor,artScale:1,registeredArt,showTheme:false,appearanceLocation:'external'};
}

/** Source SVG strips preserve transparent edges; original PNG bytes are unchanged. */
export function renderClassicHeader(layout,options={}){
 const {width,height,theme,labels,rects:r,registeredArt:a}=layout;
 const prefix=String(options.idPrefix||'classic').replace(/[^\w-]/g,'-'),imageId=prefix+'-registered',base=(options.assetBase||'./classic/assets').replace(/\/$/,'');
 const href=options.resolveAsset?options.resolveAsset(a.file):base+'/'+a.file;
 const crop=(s,d)=>`<svg x="${d[0]}" y="${d[1]}" width="${d[2]}" height="${d[3]}" viewBox="${s.join(' ')}" preserveAspectRatio="none" overflow="hidden"><use href="#${imageId}"/></svg>`;
 let body='';
 for(let row=0;row<a.ySource.length-1;row++)for(let col=0;col<a.xSource.length-1;col++)body+=crop([a.xSource[col],a.ySource[row],a.xSource[col+1]-a.xSource[col],a.ySource[row+1]-a.ySource[row]],[a.xDestination[col],a.yDestination[row],a.xDestination[col+1]-a.xDestination[col],a.yDestination[row+1]-a.yDestination[row]]);
 if(a.backReplacement){const s=a.backReplacement.source,d=a.backReplacement.destination,sw=s[2]-s[0],sh=s[3]-s[1],cap=Math.min(52*d[3]/sh,d[2]*.2);body+=crop([s[0],s[1],52,sh],[d[0],d[1],cap,d[3]])+crop([s[0]+52,s[1],sw-104,sh],[d[0]+cap,d[1],d[2]-cap*2,d[3]])+crop([s[2]-52,s[1],52,sh],[d[0]+d[2]-cap,d[1],cap,d[3]]);}
 const claspEmblem=renderArmorClaspEmblem(layout,{...options,idPrefix:prefix+'-clasp-emblem'});
 body+=claspEmblem.body;
 if(options.includeLabels!==false){
  const txt=(l,serif=false)=>{const b=l.rect,lines=l.lines?.length?l.lines:[l.text],lh=l.lineHeight||l.fontSize*1.1,y=b[1]+b[3]/2-(lines.length-1)*lh/2,inscription=serif&&layout.style==='gothic'&&layout.mode==='catalog';return`<text x="${b[0]+b[2]/2}" y="${y}" fill="${inscription?(theme==='violet'?'#e2e3e5':'#e8e1d1'):INK[theme]}" dominant-baseline="middle" text-anchor="middle" font-family="${serif?(inscription?'CatTasksDisplay,DejaVu Serif,Georgia,serif':'Georgia,DejaVu Serif,serif'):'Arial,DejaVu Sans,sans-serif'}" font-size="${l.fontSize}" font-weight="700">${lines.map((line,i)=>`<tspan x="${b[0]+b[2]/2}" dy="${i?lh:0}">${esc(line)}</tspan>`).join('')}</text>`;};
  body+=txt(labels.title,true)+txt(labels.back);if(labels.number)body+=txt(labels.number);
  const arrow=(b,right=false,full=false)=>{if(!b)return'';const cx=b[0]+b[2]/2,cy=b[1]+b[3]/2;return`<path d="${full?`M${cx+6} ${cy}h-12m5-5-5 5 5 5`:right?`M${cx-3} ${cy-7}l7 7-7 7`:`M${cx+3} ${cy-7}l-7 7 7 7`}" fill="none" stroke="${INK[theme]}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;};
  body+=arrow(r.backArrow,false,true)+arrow(r.arrowPrevious)+arrow(r.arrowNext,true);
 }
 return`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(layout.style+' '+layout.mode+' header')}" data-style="${layout.style}" data-theme="${theme}" data-width="${width}" data-art-scale="1"><defs><image id="${imageId}" href="${esc(href)}" width="${a.size[0]}" height="${a.size[1]}"/>${claspEmblem.defs}</defs>${body}</svg>`;
}
export const CLASSIC_STYLE_LIMITS=Object.freeze({minWidth:288,maxWidth:1040,catalogMaxWidth:1040,taskMaxWidth:1040,minimumHitSize:44,globalScale:false,deviceArtSwitches:false});

/** Preview-only sizing study. Approved production sources remain untouched. */
import { CLASSIC_ASSETS } from '../classic/src/assets.mjs';
import { REGISTERED_ART } from '../classic/src/registered-art.mjs';
import { getClassicLayout as getCompactLayout, renderClassicHeader as renderCompactHeader } from '../classic/src/registered-header.mjs';
import { renderTaskBands } from './task-bands.mjs';
import { renderArmorVentBand, getArmorVentGeometry } from './armor-vent-band.mjs';
import { renderGothicSkullFrieze } from '../classic/src/gothic-skull-frieze.mjs';
import { renderGothicSkeletalCrest } from '../classic/src/gothic-skeletal-crest.mjs';
import { addGothicApexHeadroom, renderGothicApexSkull } from '../classic/src/gothic-apex-skull.mjs';
import { renderArmorClaspEmblem } from '../classic/src/armor-clasp-emblem.mjs';
import { renderGothicCompactReturn } from '../classic/src/gothic-compact-return.mjs';
import { renderGothicNavigationGlyph } from '../classic/src/gothic-navigation-glyphs.mjs';

const THEMES={nurgle:'green',slaanesh:'violet',khorne:'ember',tzeentch:'blue',green:'green',violet:'violet',ember:'ember',blue:'blue'};
const GOTHIC_RELIEF_ASSETS={
 blue:'gothic-catalog-relief-blue-v1.png',
 green:'gothic-catalog-relief-green-v1.png',
 ember:'gothic-catalog-relief-ember-v1.png',
 violet:'gothic-catalog-relief-v2.png'
};
const INK={green:'#f4ecd3',violet:'#f7e9f2',ember:'#f8e6d0',blue:'#e6eff8'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const mixRect=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
function project(v,source,dest){for(let i=0;i<source.length-1;i++)if(v<=source[i+1])return dest[i]+(v-source[i])/(source[i+1]-source[i])*(dest[i+1]-dest[i]);return dest.at(-1)+(v-source.at(-1));}
const rounded=r=>r.map(v=>Math.round(v*1000)/1000);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function measureFor(options){return(text,size,role)=>{let n;try{n=options.measureText?.(text,size,role);}catch{/* fallback below */}return Number.isFinite(n)&&n>=0?n:String(text).length*size*.54;};}
function wrap(value,width,size,measure){const out=[];let line='';for(const word of String(value).trim().split(/\s+/)){const next=line?line+' '+word:word;if(measure(next,size,'title')<=width){line=next;continue;}if(measure(word,size,'title')<=width){if(line)out.push(line);line=word;continue;}for(const [i,part]of word.split(/(?<=[-‐‑–—])/u).entries()){const candidate=line+(line&&i===0?' ':'')+part;if(line&&measure(candidate,size,'title')>width){out.push(line);line=part;}else line=candidate;}}if(line)out.push(line);return out.length?out:[''];}
function fitTitle(value,width,preferred,measure,maxLines=2){let size=preferred,lines=wrap(value,width,size,measure);while(size>18&&(lines.length>maxLines||lines.some(s=>measure(s,size,'title')>width))){size=Math.max(18,size-.5);lines=wrap(value,width,size,measure);}const omitted=lines.length>maxLines,truncated=omitted||lines.some(s=>measure(s,size,'title')>width);lines=lines.slice(0,maxLines).map((line,i,shown)=>{if(measure(line,size,'title')<=width&&!(omitted&&i===shown.length-1))return line;while(line&&measure(line.trimEnd()+'…',size,'title')>width)line=line.slice(0,-1);return line.trimEnd()+'…';});return{text:String(value),fontSize:size,lines,lineHeight:size*1.08,truncated};}

/** Page content fits a width-driven envelope. The envelope never depends on
 * title length or task number; page-specific composition stays inside it.
 */
function fitInBox(value,box,preferred,measure){
 let fitted=fitTitle(value,box[2],preferred,measure,2);
 while(fitted.lines.length*fitted.lineHeight>box[3]&&fitted.fontSize>18)fitted=fitTitle(value,box[2],Math.max(18,fitted.fontSize-.5),measure,2);
 if(fitted.lines.length*fitted.lineHeight>box[3])fitted=fitTitle(value,box[2],18,measure,Math.max(1,Math.floor(box[3]/(18*1.08))));
 return{...fitted,rect:box};
}

/** Catalogue composition shares the chassis with Task, preserving its broad
 * opening and return. Only the large Gothic finial adds space above the shell. */
function getCatalogLayout(shell,options){
 const {width,height,style,theme}=shell;
 if(shell.composition==='compact')return{...getCompactLayout(width,{...options,mode:'catalog',page:'catalog'}),version:'10.9',availableWidth:shell.availableWidth,composition:'compact'};
 const measure=measureFor(options),q=shell.decor.q,d={...shell.decor},f=d.frame,rects={},hits={},labels={};
 const side=style==='gothic'?8+d.towerW:f[0]+8;
 let field=[side,f[1],width-side*2,f[3]];
 const backW=style==='gothic'?lerp(142,278,q):lerp(132,220,q),backH=style==='gothic'?lerp(50,66,q):lerp(48,70,q),backX=field[0]+field[2]-backW-20;
 let back=[backX,field[1]+(field[3]-backH)/2,backW,backH],titleBox=[field[0]+20,field[1]+12,backX-field[0]-60,field[3]-24];
 let crown=d.crest.slice();
 if(style==='gothic'){
  const cw=Math.min(width-d.towerW*2-24,d.crest[2]*1.45),ch=cw*345/1395;
  crown=[width/2-cw/2,f[1]-ch+8,cw,ch];
 }
 let preferred=lerp(24,34,q),backFont=lerp(15,18,q),compactTheme=null,compactMix=1;
 if(width<622){
  const compact=getCompactLayout(Math.min(430,width),{...options,style,theme,mode:'catalog',page:'catalog'}),t=smooth((width-430)/192),shift=Math.max(0,(width-430)/2);
  const shifted=b=>[b[0]+shift,b[1],b[2],b[3]],cb=compact.rects.back,ct=compact.labels.title.rect;
  compactTheme=shifted(compact.rects.theme);compactMix=t;
  const field0=[ct[0]-12+shift,Math.min(ct[1],cb[1])-5,cb[0]+cb[2]-ct[0]+24,Math.max(ct[1]+ct[3],cb[1]+cb[3])-Math.min(ct[1],cb[1])+10];
  field=mixRect(field0,field,t);back=mixRect(shifted(cb),back,t);titleBox=mixRect(shifted(ct),titleBox,t);
  preferred=lerp(compact.labels.title.fontSize,preferred,t);backFont=lerp(compact.labels.back.fontSize,backFont,t);
  if(style==='gothic'){
   const a=compact.registeredArt,source=[285,12,1395,345],x=project(source[0],a.xSource,a.xDestination)+shift,y=project(source[1],a.ySource,a.yDestination);
   const base=[x,y,project(source[0]+source[2],a.xSource,a.xDestination)+shift-x,project(source[1]+source[3],a.ySource,a.yDestination)-y];
   crown=mixRect(base,crown,t);
  }else{
   const smallScale=Math.min(1,(width-16)/414),ch=80*smallScale,cw=ch*368/255;
   crown=mixRect([width/2-cw/2,4,cw,ch],crown,t);
   d.shoulderH=lerp(112*smallScale,lerp(126,182,q),t);
   const sh=d.shoulderH,sw=sh*271/361,sx=Math.max(7,f[0]-sw+3),bw=140*smallScale;
   back=mixRect([width-sx-sw*.56-bw,back[1],bw,back[3]],back,t);
   const safeLeft=Math.max(titleBox[0],sx+sw*.9+4),safeRight=back[0]-6;
   titleBox=[safeLeft,titleBox[1],Math.max(44,safeRight-safeLeft),titleBox[3]];
   preferred=lerp(20,preferred,t);
  }
 }
 // The slate reaches the common lower casting even while its content moves
 // out of the compact two-part arrangement.
 field[3]=Math.max(field[3],f[1]+f[3]-field[1]);
 // The catalogue heading has its own left-hand balance. Keep the safe inset
 // next to the tower/shoulder, and trim the opposite side of its fitting box
 // so longer headings still wrap inside the stone instead of sliding over it.
 const titleShift=(style==='gothic'?36:28)*smooth((width-622)/418);
 titleBox[2]=Math.max(44,titleBox[2]-titleShift*2);
 if(style==='gothic'){
  // The lower casting covers part of catalogField. Center the return plate in
  // the visible stone opening, not in the backing plane behind that casting.
  // At the phone edge preserve the accepted two-part composition exactly.
  const k=crown[2]/1395,openingTop=crown[1]+318*k;
  const openingBottom=f[1]+f[3]+8-(22+4*q);
  const openingCenter=(openingTop+openingBottom)/2,centering=smooth((width-430)/192);
  const oldCenter=back[1]+back[3]/2,newCenter=lerp(oldCenter,openingCenter,centering);
  back[1]=newCenter-back[3]/2;
  titleBox[1]+=(openingCenter-(titleBox[1]+titleBox[3]/2))*centering;
  d.catalogOpening=[field[0],openingTop,field[2],openingBottom-openingTop];
  d.catalogContentCenter=newCenter;
 }
 d.catalogField=field;d.catalogCrown=style==='gothic'?crown:null;if(style==='armor')d.crest=crown;d.back=back.slice();
 d.catalogReliefOpacity=style==='gothic'?smooth((width-622)/318):0;
 rects.title=field.slice();rects.back=back.slice();
 const hitHeight=Math.max(44,back[3]),hitY=Math.max(48,back[1]+back[3]/2-hitHeight/2);
 hits.back=[back[0],hitY,back[2],Math.max(44,Math.min(hitHeight,back[1]+back[3]-hitY))];
 const tracking=style==='gothic'?.01*smooth((width-430)/192):0;
 const titleMeasure=style==='gothic'?(value,size,role)=>measure(value,size,role)+(role==='title'?Array.from(String(value)).length*size*tracking:0):measure;
 labels.title=fitInBox(options.catalogTitle||'All tasks',titleBox,preferred,titleMeasure);
 if(style==='gothic')labels.title.letterSpacing=labels.title.fontSize*tracking;
 const full=options.backToTaskLabel||'Back to task',icon=16,gap=8,pad=12;
 const text=!options.backToTaskLabel&&(width<480||measure(full,backFont,'back')+icon+gap+pad*2>back[2])?'Back':full;
 while(backFont>12&&measure(text,backFont,'back')>back[2]-pad*2)backFont-=.25;
 const tw=Math.min(measure(text,backFont,'back'),back[2]-pad*2),useIcon=back[2]>=tw+icon+gap+pad*2,gw=tw+(useIcon?icon+gap:0),gx=back[0]+(back[2]-gw)/2,cy=back[1]+back[3]/2;
 labels.back={text,fullText:full,fontSize:backFont,rect:[gx+(useIcon?icon+gap:0),cy-18,tw,36]};
 if(useIcon)rects.backArrow=[gx,cy-icon/2,icon,icon];
 const themeCenter=style==='gothic'?[crown[0]+crown[2]*(970-285)/1395,crown[1]+crown[3]*(245-12)/345]:[shell.rects.theme[0]+22,shell.rects.theme[1]+22];
 rects.theme=[themeCenter[0]-22,Math.max(0,themeCenter[1]-22),44,44];hits.theme=rects.theme.slice();rects.themeHousing=crown.slice();
 if(compactTheme)rects.theme=mixRect(compactTheme,rects.theme,compactMix);
 const th=rects.theme,bh=hits.back;
 th[1]=Math.min(th[1],Math.max(0,bh[1]-48));hits.theme=th.slice();
 for(const[key,r]of Object.entries(rects))rects[key]=rounded(r);for(const[key,r]of Object.entries(hits))hits[key]=rounded(r);for(const l of Object.values(labels))l.rect=rounded(l.rect);
 delete hits.theme;
 return addGothicApexHeadroom({...shell,version:'10.9',mode:'catalog',rects,hits,labels,text:labels,decor:d,showTheme:false,appearanceLocation:'external',anchor:{width,height,baseline:shell.anchor.baseline,centerX:width/2,frame:d.frame.slice()}});
}

export function getClassicLayout(availableWidth,options={}){
 const mode=(options.mode||options.page)==='catalog'?'catalog':'task',style=options.style==='armor'?'armor':'gothic';
 if(mode==='catalog')return getCatalogLayout(getClassicLayout(availableWidth,{...options,mode:'task',page:'task'}),options);
 const width=clamp(Number(availableWidth)||288,288,1040),theme=THEMES[options.theme]||'green';
 const q=clamp((width-430)/610,0,1),rects={},hits={},labels={},measure=measureFor(options);
 const frameW=Math.min(680,lerp(334,680,q)),frameX=(width-frameW)/2,frameY=style==='gothic'?lerp(82,120,q):lerp(100,132,q);
 const frameH=lerp(92,112,q),nav=lerp(44,52,q),frameInset=nav+22,titleW=frameW-frameInset*2,navY=frameY+frameH/2;
 rects.title=[frameX,frameY,frameW,frameH];
 rects.previous=[frameX+8,navY-nav/2,nav,nav];rects.next=[frameX+frameW-nav-8,navY-nav/2,nav,nav];
 if(mode==='task'){
  hits.previous=rects.previous.slice();hits.next=rects.next.slice();
  rects.arrowPrevious=[rects.previous[0]+nav/2-13,navY-13,26,26];rects.arrowNext=[rects.next[0]+nav/2-13,navY-13,26,26];
  labels.number={text:'TASK '+String(options.taskNumber??1).padStart(2,'0'),rect:[frameX+frameInset,frameY+15,titleW,16],fontSize:lerp(12,13,q)};
 }
 const titleValue=mode==='catalog'?(options.catalogTitle||'All tasks'):(options.taskTitle??options.title??'Reverse a String');
 const titleBox=[frameX+frameInset,frameY+(mode==='catalog'?14:34),titleW,frameH-(mode==='catalog'?28:48)];
 labels.title=fitInBox(titleValue,titleBox,lerp(mode==='catalog'?24:22,32,q),measure);
 const backW=lerp(132,220,q),backH=lerp(48,56,q),ventBandH=lerp(38,44,q);
 const crestClearX=style==='gothic'?width/2-lerp(210,320,q)/2-backW-14:width;
 const backX=Math.max(28,Math.min(frameX-lerp(12,30,q),crestClearX));
 const backY=style==='armor'?frameY-ventBandH+6-backH:frameY-backH+10-34*q;
 rects.back=[backX,backY,backW,backH];hits.back=rects.back.slice();
 const fullBackText=mode==='catalog'?(options.backToTaskLabel||'Back to task'):(options.allTasksLabel||'All tasks');
 labels.back={text:fullBackText,fullText:fullBackText,rect:[backX+36,backY+7,backW-48,34],fontSize:lerp(15,18,q)};
 const crestW=style==='gothic'?lerp(210,320,q):lerp(118,162,q),crestH=style==='gothic'?crestW*382/954:crestW*255/368;
 const crest=[width/2-crestW/2,Math.max(4,frameY-crestH+10),crestW,crestH];
 const themeCy=style==='gothic'?crest[1]+crestH*.73:crest[1]+crestH*.46;
 rects.theme=[width/2-22,themeCy-22,44,44];hits.theme=rects.theme.slice();rects.themeHousing=crest.slice();
 const decor={q,frame:rects.title.slice(),crest,ventBandH:style==='armor'?ventBandH:undefined,towerW:style==='gothic'?lerp(68,86,q):lerp(42,86,q),back:rects.back.slice(),outerY:frameY-56,outerBottom:frameY+frameH+18};
 let height=decor.outerBottom+(style==='gothic'?32:18);

 // Task grows from its registered compact painting. Catalogue has its own
 // content and painting transition inside this same outer page envelope.
 if(width<622){
  const compact=getCompactLayout(Math.min(430,width),{...options,style,mode,theme}),t=smooth((width-430)/192),shift=Math.max(0,(width-430)/2),smallScale=Math.min(1,(width-16)/414);
  const shifted=b=>[b[0]+shift,b[1],b[2],b[3]],a=compact.registeredArt;
  const source=style==='gothic'?[292,333,1514,331]:[268,273,1637,367];
  const x=project(source[0],a.xSource,a.xDestination)+shift,y=project(source[1],a.ySource,a.yDestination);
  const baseFrame=[x,y,project(source[0]+source[2],a.xSource,a.xDestination)+shift-x,project(source[1]+source[3],a.ySource,a.yDestination)-y];
  const h=(style==='gothic'?70:60)*smallScale,w=style==='gothic'?h*954/382:h*368/255;
  const baseCrest=[width/2-w/2,Math.max(4,compact.rects.theme[1]+22-h*(style==='gothic'?.73:.46)),w,h];
  for(const name of['previous','next']){
   rects[name]=mixRect(shifted(compact.rects[name]),rects[name],t);
   if(mode==='task'){
    hits[name]=rects[name].slice();const size=lerp(18,26,t),cy=hits[name][1]+hits[name][3]/2;
    rects[name==='previous'?'arrowPrevious':'arrowNext']=[hits[name][0]+hits[name][2]/2-size/2,cy-size/2,size,size];
   }
  }
  if(labels.number){labels.number.rect=mixRect(shifted(compact.labels.number.rect),labels.number.rect,t);labels.number.fontSize=lerp(compact.labels.number.fontSize,labels.number.fontSize,t);}
  const bw=(style==='gothic'?304:280)*Math.min(414,width-16)/(style==='gothic'?2088:2137);
  decor.towerW=lerp(bw,decor.towerW,t);decor.shoulderH=lerp(84*smallScale,lerp(126,182,q),t);decor.ornamentW=lerp(70*smallScale,108,t);
  rects.title=mixRect(baseFrame,rects.title,t);decor.crest=mixRect(baseCrest,decor.crest,t);rects.themeHousing=decor.crest.slice();
  rects.theme=mixRect(shifted(compact.rects.theme),rects.theme,t);hits.theme=rects.theme.slice();
  const originalBack=compact.registeredArt.backReplacement?.destination||compact.rects.back;
  rects.back=mixRect(shifted(originalBack),rects.back,t);hits.back=mixRect(shifted(compact.hits.back),hits.back,t);
  labels.back.fontSize=lerp(compact.labels.back.fontSize,labels.back.fontSize,t);
  const box=mixRect(shifted(compact.labels.title.rect),labels.title.rect,t),preferred=lerp(compact.labels.title.fontSize,labels.title.fontSize,t);
  labels.title=fitInBox(titleValue,box,preferred,measure);
  height=lerp(compact.height,height,t);
 }
 // The stem is artwork, not part of the text area. On narrow Armor headers
 // reserve its bottom before placing the task number and two live title lines.
 if(style==='armor'&&labels.number){
  const n=labels.number.rect,c=decor.crest,numberY=Math.max(n[1],c[1]+c[3]+2);
  labels.number.rect=[n[0],numberY,n[2],n[3]];
  const titleY=Math.max(labels.title.rect[1],numberY+n[3]+2);
  const titleBottom=rects.title[1]+rects.title[3]-4;
  labels.title=fitInBox(titleValue,[labels.title.rect[0],titleY,labels.title.rect[2],titleBottom-titleY],labels.title.fontSize,measure);
 }
 // Full destination labels appear only when their icon+label group fits. The
 // return housing itself has identical geometry in both modes.
 const back=rects.back,icon=16,gap=8,pad=12,customLabel=mode==='task'?options.allTasksLabel:options.backToTaskLabel;
 const backText=!customLabel&&(width<480||measure(fullBackText,labels.back.fontSize,'back')+icon+gap+pad*2>back[2])?'Back':fullBackText;
 let backFont=labels.back.fontSize;while(backFont>12&&measure(backText,backFont,'back')>back[2]-pad*2)backFont-=.25;
 const useIcon=back[2]>=measure(backText,backFont,'back')+icon+gap+pad*2;
 const labelW=Math.min(measure(backText,backFont,'back'),back[2]-pad*2),groupW=labelW+(useIcon?icon+gap:0),gx=back[0]+(back[2]-groupW)/2,cy=back[1]+back[3]/2;
 if(useIcon)rects.backArrow=[gx,cy-icon/2,icon,icon];
 labels.back={...labels.back,text:backText,fullText:fullBackText,fontSize:backFont,rect:[gx+(useIcon?icon+gap:0),cy-18,labelW,36]};
 decor.frame=rects.title.slice();decor.back=rects.back.slice();decor.outerY=rects.title[1]-56;decor.outerBottom=rects.title[1]+rects.title[3]+18;
 for(const [key,r]of Object.entries(rects))rects[key]=rounded(r);for(const [key,r]of Object.entries(hits))hits[key]=rounded(r);for(const l of Object.values(labels))l.rect=rounded(l.rect);
 const anchor={width,height,baseline:decor.frame[1]+decor.frame[3],centerX:width/2,frame:rects.title.slice(),crest:rects.themeHousing.slice(),back:rects.back.slice(),theme:rects.theme.slice(),outerY:decor.outerY,outerBottom:decor.outerBottom};
 delete hits.theme;
 return{version:'10.9',width,height,availableWidth:Number(availableWidth),style,mode,theme,rects,hits,labels,text:labels,decor,anchor,artScale:1,composition:'modular',showTheme:false,appearanceLocation:'external'};
}

export function renderClassicHeader(layout,options={}){
 if(layout.composition==='compact')return renderCompactHeader(layout,options);
 const{width,height,style,mode,theme,labels,rects:r,decor:d}=layout,meta=CLASSIC_ASSETS[style][theme];
 const prefix=String(options.idPrefix||'classic').replace(/[^\w-]/g,'-'),base=(options.assetBase||'./classic/assets').replace(/\/$/,'');
 const href=file=>esc(options.resolveAsset?options.resolveAsset(file):base+'/'+file);
 const ids={atlas:prefix+'-atlas',panel:prefix+'-panel',tablet:prefix+'-tablet',catalog:prefix+'-catalog',relief:prefix+'-relief',iron:prefix+'-iron',enamel:prefix+'-enamel',brass:prefix+'-brass'};
 const metalColors=theme==='violet'?['#eee6ee','#776c78','#bcb0bd','#302a34','#d2c4d3']:['#f4d28a','#805122','#c69348','#35251c','#d9a75c'];
 const metalHighlight=theme==='violet'?'#f1e9f2':'#ecd49b';
 let defs=`<image id="${ids.atlas}" href="${href(`atlas-${style}-${theme}.png`)}" width="1254" height="1254"/><image id="${ids.panel}" href="${href(`panel-${style}-${theme}.png`)}" width="${meta.panel[0]}" height="${meta.panel[1]}"/>`;
 if(style==='gothic')defs+=`<image id="${ids.tablet}" href="${href(`tablet-task-gothic-${theme}.png`)}" width="2172" height="724"/>`;
 const dockTexture=prefix+'-dock-texture',wallTexture=prefix+'-wall-texture',dockImage=prefix+'-dock-image';
 if(style==='gothic'&&mode==='task'){
  // Uniform, restrained relief grain. The reflected adjoining tile meets
  // itself at the same native edge, avoiding a rectangular repeat seam. The
  // button dock has finer grain; the open arcade keeps its quieter large scale.
  defs+=`<image id="${dockImage}" href="${href('gothic-dock-texture-v123.png')}" width="1254" height="1254"/>`;
  for(const[id,scale]of[[dockTexture,.16],[wallTexture,.26]]){
   const tile=1254*scale;
   defs+=`<pattern id="${id}" patternUnits="userSpaceOnUse" x="0" y="${d.frame[1]-tile*.3}" width="${tile*2}" height="${tile}"><use href="#${dockImage}" transform="scale(${scale})"/><use href="#${dockImage}" transform="translate(${tile*2} 0) scale(${-scale} ${scale})"/></pattern>`;
  }
 }
 let windowImage=ids.tablet,buttonImage=ids.atlas;
 const windowContour='M406.8 388.3C402.5 391.2 397.4 397.1 397.5 401C397.5 403.5 399 405.8 400 407.6C396.6 407.5 394.1 409.8 392.8 412.3C392 414.5 392 417.4 393.1 420.5L392.3 428V434L390.8 439V492.8Q390.8 499.3 396.5 499.3H418.5Q424.2 499.3 424.2 492.8V439L422.7 434V428L421.9 420.5C423 417.4 423 414.5 422.2 412.3C420.9 409.8 418.4 407.5 415 407.6C416 405.8 417.5 403.5 417.5 401C417.6 397.1 411.1 391.2 406.8 388.3Z';
 if(style==='gothic'&&mode==='task'&&theme==='green'){
  // Tint the native recess pixels only. The contour stays inside the black
  // inner lip, clear of the gold arch, lobed tips and projecting capitals.
  // Luminance supplies the original cracks and deep shadows; alpha is identity.
  const interior=prefix+'-nurgle-window-interior',wine=prefix+'-nurgle-window-wine';
  const contour=windowContour;
  windowImage=prefix+'-nurgle-window-paint';
  defs+=`<clipPath id="${interior}" clipPathUnits="userSpaceOnUse"><path d="${contour}"/><path d="${contour}" transform="translate(62 0)"/></clipPath><filter id="${wine}" filterUnits="userSpaceOnUse" x="384" y="386" width="108" height="116" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".26575 .894 .09025 0 0 .0708667 .2384 .0240667 0 0 .12756 .42912 .04332 0 0 0 0 0 1 0"/></filter><g id="${windowImage}" data-study-nurgle-window-paint="wine"><use href="#${ids.tablet}"/><g clip-path="url(#${interior})"><use href="#${ids.tablet}" filter="url(#${wine})"/></g></g>`;
 }
 if(mode==='task'&&theme==='ember'){
  // R-2G selects crimson enamel, excluding yellow/bronze metal. Complementary
  // composites preserve native alpha instead of stacking opaque colour.
  const crimsonFilter=(name,bounds,matrix)=>{
   const id=prefix+'-'+name;
   defs+=`<filter id="${id}" data-study-khorne-tone="${name}" filterUnits="userSpaceOnUse" x="${bounds[0]}" y="${bounds[1]}" width="${bounds[2]}" height="${bounds[3]}" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 4 -8 0 0 -.12" result="crimson"/><feColorMatrix in="SourceGraphic" type="matrix" values="${matrix}" result="deep"/><feComposite in="deep" in2="crimson" operator="in" result="toned"/><feComposite in="SourceGraphic" in2="crimson" operator="out" result="original"/><feComposite in="toned" in2="original" operator="arithmetic" k2="1" k3="1"/></filter>`;
   return id;
  };
  const s=meta.parts['back-button'],bounds=[s[0]-1,s[1]-1,s[2]+2,s[3]+2];
  const tone=crimsonFilter('button-oxblood',bounds,'.72 .02 0 0 0 .07 .77 0 0 0 .10 0 .73 0 0 0 0 0 1 0');
  buttonImage=prefix+'-khorne-button-paint';
  defs+=`<g id="${buttonImage}" data-study-khorne-button-paint="oxblood"><use href="#${ids.atlas}" filter="url(#${tone})"/></g>`;
  if(style==='gothic'){
   windowImage=prefix+'-khorne-window-paint';
   const tones=['.62 .04 .02 0 0 .06 .72 .04 0 0 .08 .03 .66 0 0 0 0 0 1 0','.60 .04 .02 0 0 .058 .70 .04 0 0 .078 .03 .65 0 0 0 0 0 1 0'];
   let recesses='';
   for(let i=0;i<2;i++){
    const clip=prefix+'-khorne-window-interior-'+i,tint=crimsonFilter('window-brown-wine-'+i,[384,386,108,116],tones[i]);
    defs+=`<clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><path d="${windowContour}" transform="translate(${i*62} 0)"/></clipPath>`;
    recesses+=`<g clip-path="url(#${clip})"><use href="#${ids.tablet}" filter="url(#${tint})"/></g>`;
   }
   defs+=`<g id="${windowImage}" data-study-khorne-window-paint="brown-wine"><use href="#${ids.tablet}"/>${recesses}</g>`;
  }
 }
 const catalogArt=mode==='catalog'?REGISTERED_ART[style].catalog[theme]:null;
 if(catalogArt)defs+=`<image id="${ids.catalog}" href="${href(catalogArt.file)}" width="${catalogArt.size[0]}" height="${catalogArt.size[1]}"/>`;
 if(d.catalogReliefOpacity>0){
  const reliefFile=GOTHIC_RELIEF_ASSETS[theme]||GOTHIC_RELIEF_ASSETS.green;
  defs+=`<image id="${ids.relief}" href="${href(reliefFile)}" width="2172" height="724"/>`;
  if(theme==='violet')defs+=`<filter id="${prefix}-relief-pewter"><feColorMatrix type="saturate" values=".12"/></filter>`;
 }
 for(const[what,file]of[['iron','forged-iron'],['enamel','enamel-'+theme],['brass','aged-brass']])defs+=`<image id="${ids[what]}" href="${href(`material-${file}.png`)}" width="1254" height="1254"/>`;
 defs+=`<linearGradient id="${prefix}-gold" x2="0" y2="1"><stop stop-color="${metalColors[0]}"/><stop offset=".22" stop-color="${metalColors[1]}"/><stop offset=".46" stop-color="${metalColors[2]}"/><stop offset=".65" stop-color="${metalColors[3]}"/><stop offset="1" stop-color="${metalColors[4]}"/></linearGradient><linearGradient id="${prefix}-shade" x2="0" y2="1"><stop stop-color="#000" stop-opacity=".45"/><stop offset=".5" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>`;
 let serial=0;
 const crop=(id,s,d,aspect='xMidYMid slice')=>`<svg x="${d[0]}" y="${d[1]}" width="${d[2]}" height="${d[3]}" viewBox="${s.join(' ')}" preserveAspectRatio="${aspect}" overflow="hidden"><use href="#${id}"/></svg>`;
 const part=(name,d)=>crop(ids.atlas,meta.parts[name],d,'xMidYMid meet');
 const catalogCrop=(source,d,aspect='xMidYMid slice')=>{
  const bb=style==='gothic'?[29,18,1907,794]:[20,24,2184,690],b=catalogArt.bounds,sx=(b[2]-b[0])/(bb[2]-bb[0]),sy=(b[3]-b[1])/(bb[3]-bb[1]);
  return crop(ids.catalog,[b[0]+(source[0]-bb[0])*sx,b[1]+(source[1]-bb[1])*sy,source[2]*sx,source[3]*sy],d,aspect);
 };
 const clipped=(path,body)=>{const id=prefix+'-clip-'+serial++;defs+=`<clipPath id="${id}"><path d="${path}"/></clipPath>`;return`<g clip-path="url(#${id})">${body}</g>`;};
 const quietWall=(b,darkness=.44,texture=dockTexture)=>`<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" fill="url(#${texture})"/><rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" fill="#050506" opacity="${darkness}"/>`;
 const metal=(path,b,material='iron',outline=true)=>clipped(path,crop(ids[material],[0,0,1254,1254],b)+`<path d="${path}" fill="url(#${prefix}-shade)"/>`)+(outline?`<path d="${path}" fill="none" stroke="#241b14" stroke-width="8"/><path d="${path}" fill="none" stroke="url(#${prefix}-gold)" stroke-width="5"/><path d="${path}" fill="none" stroke="${metalHighlight}" stroke-opacity=".65" stroke-width=".8"/>`:'');
 const chamfer=(b,c=12)=>`M${b[0]+c},${b[1]}H${b[0]+b[2]-c}L${b[0]+b[2]},${b[1]+c}V${b[1]+b[3]-c}L${b[0]+b[2]-c},${b[1]+b[3]}H${b[0]+c}L${b[0]},${b[1]+b[3]-c}V${b[1]+c}Z`;
 const button=b=>{
  // Catalogue has a substantial return plate, using the frame already painted
  // in its own master. Keep its faceted ends proportional while only the quiet
  // enamel centre grows; the delicate Task button belongs to the other page.
  if(style==='gothic'&&mode==='catalog'){
   const s=[1057,351,632,193],scale=b[3]/s[3],cap=92*scale,middle=s[2]-184;
   const midBox=[b[0]+cap-.35,b[1],b[2]-cap*2+.7,b[3]],step=middle*scale;
   let painted='';
   for(let x=midBox[0];x<midBox[0]+midBox[2];x+=step-.25)painted+=catalogCrop([s[0]+92,s[1],middle,s[3]],[x,b[1],step,b[3]],'xMidYMid meet');
   const p=`M${midBox[0]} ${midBox[1]}H${midBox[0]+midBox[2]}V${midBox[1]+midBox[3]}H${midBox[0]}Z`;
   const complete=clipped(p,painted)+catalogCrop([s[0],s[1],92,s[3]],[b[0],b[1],cap,b[3]],'xMidYMid meet')+catalogCrop([s[0]+s[2]-92,s[1],92,s[3]],[b[0]+b[2]-cap,b[1],cap,b[3]],'xMidYMid meet');
   // The master paints its surrounding stone behind the return plate. A
   // rectangular source crop retained four foreign stone corners against the
   // new relief. Follow the complete outer bevel, with a small dark underlap
   // around the gold lip; cap geometry stays at its native uniform scale.
   const silhouette=chamfer([b[0]+scale,b[1]+scale,b[2]-2*scale,b[3]-scale],48*scale);
   return `<g data-gothic-return-silhouette="beveled">${clipped(silhouette,complete)}</g>`;
  }
  const s=meta.parts['back-button'],paint=d.backArtwork||b,cap=d.backCapWidth??Math.min(26,b[2]/4),scale=paint[3]/s[3],sw=cap/scale,path=chamfer([b[0]+3,b[1]+4,b[2]-6,b[3]-8],12);
  const source=[s[0]+sw,s[1],s[2]-2*sw,s[3]],step=source[2]*scale;
  let middle='';for(let x=b[0]+cap-1;x<b[0]+b[2]-cap+1;x+=step-.25)middle+=crop(buttonImage,source,[x,paint[1],step,paint[3]],'xMidYMid meet');
  const clipPath=`M${b[0]+cap-1} ${paint[1]}H${b[0]+b[2]-cap+1}V${paint[1]+paint[3]}H${b[0]+cap-1}Z`;
  const painted=clipped(clipPath,middle)+crop(buttonImage,[s[0],s[1],sw,s[3]],[b[0],paint[1],cap,paint[3]])+crop(buttonImage,[s[0]+s[2]-sw,s[1],sw,s[3]],[b[0]+b[2]-cap,paint[1],cap,paint[3]]);
  if(mode!=='task')return metal(path,b,'enamel',false)+painted;
  // Native caps curve/cut farther inward than a generic 12px chamfer. Limit
  // only the extra underpaint to their alpha; do not clip the gold artwork.
  // The safe middle fills tiny texture/assembly gaps, away from all corners.
  const mask=prefix+'-button-native-alpha',face=d.backPaintedBody||b;
  defs+=`<mask id="${mask}" maskUnits="userSpaceOnUse" x="${b[0]-1}" y="${paint[1]-1}" width="${b[2]+2}" height="${paint[3]+2}" style="mask-type:alpha">${painted}<rect x="${b[0]+cap}" y="${face[1]+10}" width="${Math.max(0,b[2]-cap*2)}" height="${Math.max(0,face[3]-20)}" fill="white"/></mask>`;
  return `<g data-study-button-silhouette="native-alpha"><g mask="url(#${mask})">${metal(path,b,'enamel',false)}</g>${painted}</g>`;
 };
 const taskFrame=b=>{
  const g=style==='gothic',left=g?[292,333,250,331]:[268,273,240,367],right=g?[1553,333,253,331]:[1658,273,247,367],stone=g?[510,365,1050,260]:[510,315,1140,270],k=b[3]/left[3],lw=left[2]*k,rw=right[2]*k;
  const path=chamfer([b[0]+4,b[1]+5,b[2]-8,b[3]-10],14);
  // Caps come from a complete panel painting: their rectangular crop contains
  // neighbouring enamel outside the actual gold bevel, with opaque alpha.
  // Follow that outer native edge (including its dark lip), not its crop box.
  const x=b[0],y=b[1],rightX=x+b[2],bottom=y+b[3];
  const silhouette=g?
   `M${x+69*k} ${y-.5*k}H${rightX-70*k}C${rightX-60*k} ${y+26*k} ${rightX-32*k} ${y+44*k} ${rightX+.5*k} ${y+47*k}V${bottom-48*k}C${rightX-29*k} ${bottom-45*k} ${rightX-51*k} ${bottom-30*k} ${rightX-65*k} ${bottom+.5*k}H${x+64*k}C${x+54*k} ${bottom-29*k} ${x+30*k} ${bottom-44*k} ${x-.5*k} ${bottom-48*k}V${y+47*k}C${x+31*k} ${y+44*k} ${x+59*k} ${y+27*k} ${x+69*k} ${y-.5*k}Z`:
   `M${x+68*k} ${y+8*k}L${x+lw} ${y-.5*k}H${rightX-rw}L${rightX-70*k} ${y+8*k}L${rightX} ${y+87*k}V${bottom-80*k}L${rightX-68*k} ${bottom+.5*k}H${x+68*k}L${x+6*k} ${bottom-80*k}V${y+87*k}Z`;
  // Both styles already paint their gold rails and caps. Retain that artwork
  // as the only outline; clip the backing to the same native corner contour.
  const backing=metal(path,b,'iron',false)+clipped(path,crop(ids.panel,stone,[b[0]+lw*.65,b[1]+10,b[2]-(lw+rw)*.65,b[3]-20]));
  let out=clipped(silhouette,backing);
  const rails=g?[[600,338,240,33],[600,632,240,44]]:[[600,276,240,38],[600,623,240,40]];
  for(const source of rails){
   const x=b[0]+lw*.7,w=b[2]-(lw+rw)*.7,y=b[1]+(source[1]-left[1])*k,h=source[3]*k,step=source[2]*k;
   let rail='';for(let xx=x;xx<x+w;xx+=step-.3)rail+=crop(ids.panel,source,[xx,y,step,h],'xMidYMid meet');
   out+=clipped(`M${x} ${y}H${x+w}V${y+h}H${x}Z`,rail);
  }
  const caps=crop(ids.panel,left,[b[0],b[1],lw,b[3]])+crop(ids.panel,right,[b[0]+b[2]-rw,b[1],rw,b[3]]);
  return `<g data-study-task-frame-silhouette="native-bevel">${out}${clipped(silhouette,caps)}</g>`;
 };
 const catalogFrame=b=>{
  const p=chamfer([b[0]+2,b[1]+4,b[2]-4,b[3]-8],style==='gothic'?12:17);
  let out=metal(p,b,'iron',style!=='gothic')+clipped(p,catalogCrop(style==='gothic'?[310,365,725,180]:[340,355,600,200],[b[0]+3,b[1]+5,b[2]-6,b[3]-10]));
  // One continuous wall painting carries the shallow faces and forged scrolls.
  // It grows at a uniform scale behind the original casting; the phone keeps
  // its quiet stone while the wider catalogue gradually reveals this relief.
  if(style==='gothic'&&d.catalogReliefOpacity>0){
   const filter=theme==='violet'?` filter="url(#${prefix}-relief-pewter)"`:'';
   out+=clipped(p,`<g opacity="${d.catalogReliefOpacity}"${filter}>${crop(ids.relief,[0,212,2172,300],b,'xMidYMid slice')}</g>`);
  }
  return out;
 };
 const f=d.frame,tw=d.towerW,body=[tw*.65,d.outerY,width-tw*1.3,d.outerBottom-d.outerY];
 const bridge=[body[0],f[1]+12,body[2],f[3]-12];
 let bodySvg=metal(chamfer(bridge,9),bridge,'enamel',false);
 // The broad catalogue stone is the backing plane. Cast rails and their worn
 // gold edges must be laid over it, rather than being obscured by a later fill.
 if(style==='gothic'&&mode==='catalog'){
  const field=d.catalogField;
  // Backing slate continues behind the upper casting. The overlap closes the
  // transparent slit without changing the content box or common page baseline.
  // The content field interpolates independently on tablets; the material must
  // still reach behind both towers throughout that transition.
  const bx=8+tw*.65;
  bodySvg+=catalogFrame([bx,field[1]-8,width-bx*2,field[3]+8]);
 }
 // The canopy joins the crown shoulder and grips the front of the cornice.
 const skeletal=renderGothicSkeletalCrest(layout,{...options,idPrefix:prefix+'-skeletal'});
 defs+=skeletal.defs;bodySvg+=skeletal.body;
 const skulls=renderGothicSkullFrieze(layout,{...options,idPrefix:prefix+'-skulls'});
 defs+=skulls.defs;bodySvg+=skulls.underlay;
 // Draw the cornice once, then its whole canopy and small inset skull reliefs.
 const structure=renderTaskBands(layout,{...options,idPrefix:prefix+'-structure'});
 defs+=structure.defs;
 // Task side materials and arcade sit behind their shared cast frame. Defer
 // that frame until they are painted so neither texture can cover a moulding.
 if(style!=='gothic'||mode!=='task')bodySvg+=structure.body+skeletal.overlay+skulls.body;
 // Sparse cast-metal joints articulate the body; the central texture is a
 // uniformly scaled square material, never a stretched strip or repeating facade.
 if(style==='gothic'){
  if(mode==='catalog'){
   // Join the original sculpted crown into the continuous painted cornice.
   // Only its plain outer ends blend; the eyes, shrine and gemstone stay exact.
   const c=d.catalogCrown,fade=24/c[2],cut=6/c[2],gradient=prefix+'-catalog-cornice-fade',mask=gradient+'-mask';
   defs+=`<linearGradient id="${gradient}" x1="0" y1="0" x2="1" y2="0"><stop stop-color="black"/><stop offset="${cut}" stop-color="black"/><stop offset="${fade}" stop-color="white"/><stop offset="${1-fade}" stop-color="white"/><stop offset="${1-cut}" stop-color="black"/><stop offset="1" stop-color="black"/></linearGradient><mask id="${mask}" maskUnits="userSpaceOnUse" x="${c[0]}" y="${c[1]}" width="${c[2]}" height="${c[3]}"><rect x="${c[0]}" y="${c[1]}" width="${c[2]}" height="${c[3]}" fill="url(#${gradient})"/></mask>`;
   bodySvg+=`<g mask="url(#${mask})">${catalogCrop([285,12,1395,345],d.catalogCrown,'xMidYMid meet')}</g>`;
   const apex=renderGothicApexSkull(layout,{...options,idPrefix:prefix+'-apex'});
   defs+=apex.defs;bodySvg+=apex.body;
  }else{
   const ah=f[3]+5,lx=8+tw-4,rx=width-8-tw+4;
   const leftAvailable=Math.max(.01,f[0]-lx+4),rightAvailable=Math.max(.01,rx-f[0]-f[2]+4);
   const wallTop=Math.min(f[1],d.crest[1]+364*d.crest[2]/954)-8;
   const wallBottom=f[1]+f[3]+5,wallLeft=lx-8;
   // A continuous recessed wall runs underneath towers, curved frame corners
   // and mouldings. Its visible outline is defined by those original castings.
   bodySvg+=`<g data-study-gothic-wall="recessed-continuous">${quietWall([wallLeft,wallTop,rx-lx+16,wallBottom-wallTop],.60,wallTexture)}</g>`;
   const dockMix=d.embeddedBackMix||0;
   if(dockMix>0&&d.backDock){
    const b=d.backDock,underlap=74*f[3]/331;
    bodySvg+=`<g data-study-back-field="under-castings" data-study-gothic-texture="carved-iron" opacity="${dockMix}">${quietWall([wallLeft,wallTop,b[0]+b[2]+underlap-wallLeft,wallBottom-wallTop],.44)}</g>`;
   }
   // A complete painted arcade connects the wide side field. Narrow gaps
   // retain their original compact window treatment as the frame closes.
   const bay=(x,w,side='left')=>{
    const arcade=renderGothicTaskArcade(layout,{x,width:w,side},{...options,idPrefix:prefix+'-arcade-'+side});
    if(arcade.body){defs+=arcade.defs;return arcade.body;}
    const sourceH=(d.sideBays?.sourceHeight??260)-6*smooth((width-622)/418);
    const columns=d.sideBays?.columns||[],sections=[];let cursor=x;
    for(const column of columns){
     const half=column.rect[2]*column.opacity/2,end=clamp(column.cutCenter-half,x,x+w);
     if(end>cursor)sections.push([cursor,end-cursor]);
     cursor=Math.max(cursor,column.cutCenter+half);
    }
    if(cursor<x+w)sections.push([cursor,x+w-cursor]);
    let painted='';
    for(const [start,room]of sections){
     if(room<=1)continue;
     // These adjacent native crops share the same painted mullion. At full
     // opacity they reconstruct the original pair exactly, at one uniform
     // scale. The first window moves aside before the second can appear;
     // neither window is sliced away against a moving buttress.
     const scale=ah/sourceH,singleWidth=73*scale,pairWidth=132*scale;
     const arrange=smooth((room-singleWidth-8)/(pairWidth-singleWidth));
     const firstOpacity=smooth((room-singleWidth-8)/12);
     const secondOpacity=smooth((room-pairWidth-8)/8);
     const firstX=start+(room-singleWidth)/2-(pairWidth-singleWidth)*arrange/2;
     if(firstOpacity>0)painted+=`<g data-study-gothic-arch="1" opacity="${firstOpacity}">${crop(windowImage,[370,360,73,sourceH],[firstX,f[1],singleWidth,ah],'xMidYMid meet')}</g>`;
     if(secondOpacity>0)painted+=`<g data-study-gothic-arch="2" opacity="${secondOpacity}">${crop(windowImage,[433,360,69,sourceH],[firstX+63*scale,f[1],69*scale,ah],'xMidYMid meet')}</g>`;
    }
    let piers='';
    for(const column of columns)if(column.opacity>0){
     // One native slender pilaster has its own capital and foot. The common
     // cornice and sill are painted afterwards and seat both joints in place.
     const b=column.rect;
     piers+=`<g data-study-gothic-column="native-pilaster" data-study-gothic-base="under-shared-castings">${crop(ids.tablet,column.source,b,'xMidYMid meet')}</g>`;
    }
    return clipped(`M${x} ${f[1]}H${x+w}V${f[1]+ah}H${x}Z`,painted)+piers;
   };
   bodySvg+=`<g opacity="${1-dockMix}">${bay(lx,leftAvailable)}</g>`;
   bodySvg+=`<g transform="translate(${width} 0) scale(-1 1)">${bay(lx,rightAvailable,'right')}</g>`;
   bodySvg+=structure.body+skeletal.overlay+skulls.body;
   // The crown's native footing belongs behind the Task frame. Painting its
   // full rectangular crop last left a second gold ledge at both shoulders.
   // Only the pointed crystal setting crosses the frame's single top rail.
   const crownPaint=crop(ids.tablet,[662,0,954,382],d.crest,'xMidYMid meet');
   bodySvg+=crownPaint;
   bodySvg+=taskFrame(f);
   const crownScale=d.crest[2]/954,tipClip=prefix+'-task-crystal-tip';
   const tipPoints=[[1115,333],[1184,333],[1196,346],[1192,354],[1151,382],[1143,382],[1106,354],[1104,347]]
    .map(([x,y])=>`${d.crest[0]+(x-662)*crownScale},${d.crest[1]+y*crownScale}`).join(' ');
   defs+=`<clipPath id="${tipClip}"><polygon points="${tipPoints}"/></clipPath>`;
   bodySvg+=`<g data-gothic-crown-joint="single-rail" clip-path="url(#${tipClip})">${crownPaint}</g>`;
  }
  const leftH=624/276*tw,rightH=624/262*tw,base=f[1]+f[3]+8;
  const tower=(sx,sw,x,nativeH)=>{
   const scale=tw/sw,nativeTop=base-nativeH;
   if(width>=622)return crop(ids.tablet,[sx,0,sw,624],[x,nativeTop,tw,nativeH],'xMidYMid meet');
   // The phone has readable fixed-height content between a smaller crown and
   // footing. Keep the sculpted capital/skull and pedestal proportional; only
   // the quiet straight pillar shaft absorbs that extra vertical space.
   // Both pages use the shared Task crown as their structural attachment.
   const railY=d.crest[1]+224*d.crest[2]/954;
   const attachedTop=Math.max(0,railY-200*scale);
   const top=lerp(attachedTop,nativeTop,smooth((width-430)/192));
   const headEnd=410,footStart=480,headH=headEnd*scale,footH=(624-footStart)*scale;
   const middleY=top+headH,middleH=Math.max(.01,base-footH-middleY);
   return crop(ids.tablet,[sx,0,sw,headEnd],[x,top,tw,headH],'xMidYMid meet')+
    crop(ids.tablet,[sx,headEnd,sw,footStart-headEnd],[x,middleY,tw,middleH],'none')+
    crop(ids.tablet,[sx,footStart,sw,624-footStart],[x,base-footH,tw,footH],'xMidYMid meet');
  };
  bodySvg+=tower(56,276,8,leftH)+tower(1910,262,width-8-tw,rightH);
  const sealW=tw*lerp(.5,.62,d.q),sealH=sealW*356/248,sealY=Math.min(base-sealH*.7,height-sealH-1);
  bodySvg+=part('seal',[12+tw*.12,sealY,sealW,sealH]);
  if(mode==='task'){
   const pw=d.ornamentW??108,ph=pw/2;bodySvg+=part('plinth',[width/2-pw/2,f[1]+f[3]-ph*.45,pw,ph]);
  }
 }else{
  bodySvg+=mode==='catalog'?catalogFrame(d.catalogField):taskFrame(f);
  const vents=renderArmorVentBand(layout,{...options,idPrefix:prefix});
  defs+=vents.defs;bodySvg+=vents.body;
  bodySvg+=part('crest',d.crest);
  const sh=d.shoulderH??lerp(126,182,d.q),sw=sh*271/361,base=f[1]+f[3]+5,sx=d.shoulderX??Math.max(7,f[0]-sw+3);
  const shoulderTop=Math.min(base-sh,getArmorVentGeometry(layout).right[1]-2);
  bodySvg+=part('shoulder-left',[sx,shoulderTop,sw,sh])+part('shoulder-right',[width-sx-sw,shoulderTop,sw,sh]);
  // A broad central fastening belongs to the lower chassis. Grow it with the
  // frame, while interpolating from the compact painting at the phone edge.
  const claspGrowth=smooth((width-430)/192),claspW=d.claspW??lerp(52,lerp(84,130,d.q),claspGrowth),claspH=claspW*34.6/90;
  const claspRect=[width/2-claspW/2,f[1]+f[3]+7-claspH/2,claspW,claspH];
  const claspEmblem=renderArmorClaspEmblem(layout,{...options,claspRect,idPrefix:prefix+'-clasp-emblem'});
  defs+=claspEmblem.defs;
  bodySvg+=`<g data-armor-clasp-width="${claspW}">${part('clasp',claspRect)}${claspEmblem.body}</g>`;
 }
 const compactReturn=renderGothicCompactReturn(layout,{...options,idPrefix:prefix});
 defs+=compactReturn.defs;
 bodySvg+=compactReturn.body||button(d.back);
 if(options.includeLabels!==false){
  const txt=(l,serif=false)=>{const b=l.rect,lines=l.lines?.length?l.lines:[l.text],lh=l.lineHeight||l.fontSize*1.1,y=b[1]+b[3]/2-(lines.length-1)*lh/2,inscription=serif&&style==='gothic'&&mode==='catalog';return`<text x="${b[0]+b[2]/2}" y="${y}" fill="${inscription?(theme==='violet'?'#e2e3e5':'#e8e1d1'):INK[theme]}"${inscription?` letter-spacing="${l.letterSpacing??0}"`:''} dominant-baseline="middle" text-anchor="middle" font-family="${serif?(inscription?'CatTasksDisplay,DejaVu Serif,Georgia,serif':'Georgia,DejaVu Serif,serif'):'Arial,DejaVu Sans,sans-serif'}" font-size="${l.fontSize}" font-weight="700">${lines.map((line,i)=>`<tspan x="${b[0]+b[2]/2}" dy="${i?lh:0}">${esc(line)}</tspan>`).join('')}</text>`;};
  bodySvg+=txt(labels.title,true)+txt(labels.back);if(labels.number)bodySvg+=txt(labels.number);
  const arrow=(b,right=false,full=false)=>{if(!b)return'';const cx=b[0]+b[2]/2,cy=b[1]+b[3]/2,h=b[3]*(full?.32:.43),w=b[2]*(full?.38:.23);return`<path d="${full?`M${cx+w} ${cy}H${cx-w}m${h} ${-h}-${h} ${h} ${h} ${h}`:right?`M${cx-w} ${cy-h}L${cx+w} ${cy} ${cx-w} ${cy+h}`:`M${cx+w} ${cy-h}L${cx-w} ${cy} ${cx+w} ${cy+h}`}" fill="none" stroke="${INK[theme]}" stroke-width="${full?1.8:2.5}" stroke-linecap="round" stroke-linejoin="round"/>`;};
  bodySvg+=arrow(r.backArrow,false,true)+(renderGothicNavigationGlyph(layout,'previous',INK[theme])||arrow(r.arrowPrevious))+(renderGothicNavigationGlyph(layout,'next',INK[theme])||arrow(r.arrowNext,true));
 }
 return`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(style+' '+mode+' header')}" data-style="${style}" data-theme="${theme}" data-width="${width}" data-art-scale="1"${style==='gothic'&&mode==='catalog'?' data-catalog-heading="inscription"':''}><defs>${defs}</defs>${bodySvg}</svg>`;
}

export const CLASSIC_STYLE_LIMITS=Object.freeze({minWidth:288,maxWidth:1040,catalogMaxWidth:1040,taskMaxWidth:1040,minimumHitSize:44,globalScale:false,deviceArtSwitches:false});


// Co-located from size-study/gothic-arch-daemon.mjs; sole consumer above.
/** A figure seated in the darkness of one lancet, behind its native metal lip.
 * Coordinates belong to the source arcade atlas, before its uniform scaling. */
export const GOTHIC_ARCH_DAEMON_ART = {
 file: 'gothic-arch-daemon-silhouettes-v134.png',
 size: [1254,1254],
 // Native alpha bounds with eight pixels of transparent padding.
 crops: {blue:[101,73,426,503],green:[670,76,514,507],ember:[53,704,532,480],violet:[726,642,422,551]}
};
export function renderGothicArchDaemon(art,theme,rowY,options={}){
 const source=art.crops[theme];
 if(!source)return {defs:'',body:''};
 const prefix=String(options.idPrefix||'gothic-arch-daemon').replace(/[^\w-]/g,'-');
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,''),href=esc(options.resolveAsset?options.resolveAsset(art.file):base+'/'+art.file);
 const image=prefix+'-shadow',clip=prefix+'-niche',depth=prefix+'-depth',foot=prefix+'-foot';
 // The painted opening owns the figure's boundary. A common standing height
 // places the rounded bust edge below the sill; broad shoulders disappear
 // behind the jambs instead of shrinking into a freestanding portrait badge.
 const contour='M630 56C601 74 572 104 565 137V206H695V137C688 104 659 74 630 56Z';
 // Nurgle's offset horn and Khorne's broad pair need their own headroom.
 // Each source box still ends at225, behind the native sill at206.
 const [figureH,centerX]=({green:[160,620],ember:[152,630]})[theme]||[178,630];
 const figureW=figureH*source[2]/source[3],figureX=centerX-figureW/2,figureY=rowY+225-figureH;
 const defs=`<image id="${image}" href="${href}" width="${art.size[0]}" height="${art.size[1]}"/><clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><path d="${contour}" transform="translate(0 ${rowY})"/></clipPath><radialGradient id="${depth}" gradientUnits="userSpaceOnUse" cx="630" cy="${rowY+126}" r="83" gradientTransform="translate(630 ${rowY+126}) scale(.83 1) translate(-630 ${-rowY-126})"><stop stop-color="#09080d" stop-opacity=".12"/><stop offset=".55" stop-color="#09080d" stop-opacity=".30"/><stop offset="1" stop-color="#09080d" stop-opacity=".76"/></radialGradient><linearGradient id="${foot}" gradientUnits="userSpaceOnUse" x1="0" y1="${rowY+143}" x2="0" y2="${rowY+206}"><stop stop-color="#09080d" stop-opacity="0"/><stop offset=".58" stop-color="#09080d" stop-opacity=".24"/><stop offset="1" stop-color="#09080d" stop-opacity=".72"/></linearGradient>`;
 const opening=`<rect x="563" y="${rowY+54}" width="134" height="152"/>`;
 const body=`<g data-gothic-arch-daemon="${esc(theme)}" data-daemon-window="629" data-daemon-integration="recessed-behind-sill" clip-path="url(#${clip})" pointer-events="none"><g fill="url(#${depth})">${opening}</g><svg x="${figureX}" y="${figureY}" width="${figureW}" height="${figureH}" viewBox="${source.join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="hidden" opacity=".82"><use href="#${image}"/></svg><g fill="url(#${foot})">${opening}</g></g>`;
 return {defs,body};
}


// Co-located from size-study/gothic-task-arcade.mjs; sole consumer above.
/** One painted architectural arcade: shared piers, carved spandrels and
 * continuous coping/plinth. The existing outer castings own its perimeter. */

export const GOTHIC_TASK_ARCADE_ART = {
 file: 'gothic-task-arcade-atlas-v133.png',
 size: [1254,1254],
 rows: {blue:[47,66,1161,234],green:[47,368,1161,234],ember:[47,672,1161,233],violet:[47,975,1161,234]},
 // Each crop includes whole pointed openings and the piers at both ends.
 // The wider native row is revealed in complete architectural bays.
 spans: {1:[490,283],2:[282,495],3:[282,704],4:[47,939]}
};
const arcadeClamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const arcadeEsc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function getGothicTaskArcadeGeometry(layout,x,width){
 if(layout.style!=='gothic'||layout.mode!=='task'||layout.width<=622||width<112)return null;
 const art=GOTHIC_TASK_ARCADE_ART,row=art.rows[layout.theme]||art.rows.green,d=layout.decor;
 const count=arcadeClamp(Math.floor((width-15)/90),1,4),span=art.spans[count];
 const scale=arcadeClamp((width+12)/span[1],.44,.58);
 const source=[span[0],row[1],span[1],row[3]],paintWidth=span[1]*scale,paintHeight=row[3]*scale;
 const corniceBottom=d.crest[1]+338*d.crest[2]/954,bottom=d.frame[1]+d.frame[3]+3;
 // The pointed arch heads stay below the cornice. The full sculpture's feet
 // enter the shared sill, which is painted later and conceals the joint.
 const y=Math.max(bottom-paintHeight,corniceBottom+2-34*scale);
 const rect=[x+(width-paintWidth)/2,y,paintWidth,paintHeight];
 return {count,source,scale,rect,clip:[x-8,corniceBottom-5,width+16,bottom-corniceBottom+5]};
}

export function renderGothicTaskArcade(layout,box,options={}){
 const geometry=getGothicTaskArcadeGeometry(layout,box.x,box.width);
 if(!geometry)return {defs:'',body:'',geometry:null};
 const art=GOTHIC_TASK_ARCADE_ART,prefix=String(options.idPrefix||'gothic-task-arcade').replace(/[^\w-]/g,'-');
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,''),href=arcadeEsc(options.resolveAsset?options.resolveAsset(art.file):base+'/'+art.file);
 const image=prefix+'-image',clip=prefix+'-clip',g=geometry,b=g.rect,c=g.clip;
 const daemon=box.side==='right'?renderGothicArchDaemon(GOTHIC_ARCH_DAEMON_ART,layout.theme,g.source[1],{...options,idPrefix:prefix+'-daemon'}):{defs:'',body:''};
 const defs=`<image id="${image}" href="${href}" width="${art.size[0]}" height="${art.size[1]}"/><clipPath id="${clip}"><rect x="${c[0]}" y="${c[1]}" width="${c[2]}" height="${c[3]}"/></clipPath>`+daemon.defs;
 const body=`<g data-gothic-task-arcade="connected" data-arch-count="${g.count}" data-art-scale="${g.scale}" clip-path="url(#${clip})"><svg x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" viewBox="${g.source.join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><use href="#${image}"/>${daemon.body}</svg></g>`;
 return {defs,body,geometry};
}

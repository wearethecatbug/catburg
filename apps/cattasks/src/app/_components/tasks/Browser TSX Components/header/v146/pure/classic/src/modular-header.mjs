import { CLASSIC_ASSETS } from './assets.mjs';
import { REGISTERED_ART } from './registered-art.mjs';
import { getClassicLayout as getCompactLayout, renderClassicHeader as renderCompactHeader } from './registered-header.mjs';
import { renderTaskBands } from './task-bands.mjs';
import { renderArmorVentBand, getArmorVentGeometry } from './armor-vent-band.mjs';
import { renderGothicSkullFrieze } from './gothic-skull-frieze.mjs';
import { renderGothicSkeletalCrest } from './gothic-skeletal-crest.mjs';
import { addGothicApexHeadroom, renderGothicApexSkull } from './gothic-apex-skull.mjs';
import { renderArmorClaspEmblem } from './armor-clasp-emblem.mjs';
import { renderArmorCatalogPanels } from './armor-catalog-panels.mjs';
import { renderGothicCompactReturn } from './gothic-compact-return.mjs';
import { renderGothicNavigationGlyph } from './gothic-navigation-glyphs.mjs';

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
 // Trim the heading's fitting box while the compact content grows. The
 // complete content geometry is placed into its left-navigation order below.
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
 if(style==='gothic'&&width>1040){
  const wide=smooth((width-1040)/400),inscriptionWidth=392;
  // The wide catalogue gets a real centre inscription under its shrine.
  // The return control keeps its independent side bay.
  titleBox=mixRect(titleBox,[width/2-(inscriptionWidth-80)/2,titleBox[1],inscriptionWidth-80,titleBox[3]],wide);
  d.catalogWideProgress=wide;d.catalogInscriptionWidth=inscriptionWidth;
 }
 if(style==='armor'&&(width>1040||d.sharedArmorShell)){
  const wide=d.sharedArmorShell?d.sharedArmorProgress:smooth((width-1040)/240),inscriptionWidth=392;
  // A complete centre plate sits below the crest. The return plate grows
  // with its own side bay, keeping clear of the centre plate and shoulder.
  titleBox=mixRect(titleBox,[width/2-152,f[1]+12,304,f[3]-24],wide);
  const center=titleBox[0]+titleBox[2]/2;
  const inscription=[center-inscriptionWidth/2,f[1],inscriptionWidth,f[3]];
  const right=inscription[0]+inscription[2],end=field[0]+field[2];
  d.catalogWideProgress=wide;d.catalogInscriptionWidth=inscriptionWidth;
  d.catalogInscription=inscription;
  d.catalogOpening=field.slice();
  d.catalogLeftBay=[field[0],field[1],Math.max(0,inscription[0]-field[0]),field[3]];
  d.catalogRightBay=[right,field[1],Math.max(0,end-right),field[3]];
  // The side bay briefly narrows while the title recentres. Grow the control
  // from viewport width so that transition never makes the button shrink.
  const expansion=clamp((width-1160)/120,0,1);
  const returnWidth=width<=1280?220+32*expansion*expansion:Math.min(360,252+(width-1280)*.5);
  const returnHeight=lerp(back[3],88,wide);
  back=[end-20-returnWidth,field[1]+(field[3]-returnHeight)/2,returnWidth,returnHeight];
  backFont=lerp(backFont,22,wide);
 }
 // Move boxes rather than reflecting the painting: the return plate keeps
 // its native cap orientation, and arrow, label and hit target are built from
 // its final left-hand geometry. A centered wide inscription stays centered.
 back=[width-back[0]-back[2],back[1],back[2],back[3]];
 titleBox=[width-titleBox[0]-titleBox[2],titleBox[1],titleBox[2],titleBox[3]];
 if(style==='armor'&&d.catalogInscription){
  const center=titleBox[0]+titleBox[2]/2,inscription=[center-d.catalogInscriptionWidth/2,f[1],d.catalogInscriptionWidth,f[3]];
  const right=inscription[0]+inscription[2],end=field[0]+field[2];
  d.catalogInscription=inscription;
  d.catalogLeftBay=[field[0],field[1],Math.max(0,inscription[0]-field[0]),field[3]];
  d.catalogRightBay=[right,field[1],Math.max(0,end-right),field[3]];
 }
 const sharedBack=style==='armor'?options.sharedCatalogBack:null;
 if(sharedBack){back=sharedBack.rect.slice();backFont=sharedBack.fontSize??backFont;}
 d.back=back.slice();
 rects.title=field.slice();rects.back=back.slice();
 const hitHeight=Math.max(44,back[3]),hitY=Math.max(48,back[1]+back[3]/2-hitHeight/2);
 hits.back=sharedBack||style==='armor'&&width>1040?back.slice():[back[0],hitY,back[2],Math.max(44,Math.min(hitHeight,back[1]+back[3]-hitY))];
 const tracking=style==='gothic'?.01*smooth((width-430)/192):0;
 const titleMeasure=style==='gothic'?(value,size,role)=>measure(value,size,role)+(role==='title'?Array.from(String(value)).length*size*tracking:0):measure;
 labels.title=fitInBox(options.catalogTitle||'All tasks',titleBox,preferred,titleMeasure);
 if(style==='gothic')labels.title.letterSpacing=labels.title.fontSize*tracking;
 const returnGrowth=style==='armor'?(d.catalogWideProgress||0):0;
 const full=options.backToTaskLabel||'Back to task',icon=sharedBack?.iconSize??lerp(16,20,returnGrowth),gap=sharedBack?.gap??lerp(8,10,returnGrowth),pad=12;
 const text=!sharedBack&&!options.backToTaskLabel&&(width<480||measure(full,backFont,'back')+icon+gap+pad*2>back[2])?'Back':full;
 const textWidth=back[2]-pad*2-(sharedBack?icon+gap:0);
 while(backFont>12&&measure(text,backFont,'back')>textWidth)backFont-=.25;
 const tw=Math.min(measure(text,backFont,'back'),textWidth),useIcon=back[2]>=tw+icon+gap+pad*2,gw=tw+(useIcon?icon+gap:0),gx=back[0]+(back[2]-gw)/2,cy=back[1]+back[3]/2;
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

/** Compose catalogue content inside the workspace's common Armor chassis. */
export function getClassicCatalogLayoutFromShell(shell,options={}){
 return getCatalogLayout(shell,options);
}

export function getClassicLayout(availableWidth,options={}){
 const mode=(options.mode||options.page)==='catalog'?'catalog':'task',style=options.style==='armor'?'armor':'gothic';
 if(mode==='catalog'){
  let shell=getClassicLayout(availableWidth,{...options,mode:'task',page:'task'});
  const width=clamp(Number(availableWidth)||288,288,1600);
  const extra=width-shell.width;
  if(extra>0){
   // Extend the catalogue chassis, not its sculpted artwork. Its established
   // 1040px height, crown, towers and live controls keep their native size.
   const shift=r=>[r[0]+extra/2,r[1],r[2],r[3]];
   const f=shell.decor.frame,frame=[f[0],f[1],f[2]+extra,f[3]];
   const wideDecor={};
   if(style==='armor'){
    const progress=smooth((width-1040)/240),shoulderH=shell.decor.shoulderH??182;
    const shoulderW=shoulderH*271/361,nativeX=Math.max(7,f[0]-shoulderW+3);
    const shoulderX=lerp(nativeX,8,progress),inset=shoulderX+shoulderW-3;
    frame[0]=inset;frame[2]=width-2*inset;
    // Preserve the 1040px lower casting's native height as the rail lengthens.
    // The workspace uses this same edge to align Task and Catalogue.
    wideDecor.shoulderH=shoulderH;wideDecor.shoulderX=shoulderX;
    wideDecor.lowerRailHeight=(shell.width/2-35-nativeX-shoulderW*.25)*61/700;
   }
   shell={...shell,width,
    rects:{...shell.rects,theme:shift(shell.rects.theme),themeHousing:shift(shell.rects.themeHousing)},
    decor:{...shell.decor,...wideDecor,frame,crest:shift(shell.decor.crest)},
    anchor:{...shell.anchor,width,centerX:width/2,frame,crest:shift(shell.anchor.crest),theme:shift(shell.anchor.theme)}};
  }
  return getCatalogLayout(shell,options);
 }
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
 const ids={atlas:prefix+'-atlas',panel:prefix+'-panel',tablet:prefix+'-tablet',catalog:prefix+'-catalog',relief:prefix+'-relief',inset:prefix+'-inset',iron:prefix+'-iron',enamel:prefix+'-enamel',brass:prefix+'-brass'};
 const insetArt=GOTHIC_CATALOG_INSETS[theme];
 const metalColors=theme==='violet'?['#eee6ee','#776c78','#bcb0bd','#302a34','#d2c4d3']:['#f4d28a','#805122','#c69348','#35251c','#d9a75c'];
 const metalHighlight=theme==='violet'?'#f1e9f2':'#ecd49b';
 let defs=`<image id="${ids.atlas}" href="${href(`atlas-${style}-${theme}.png`)}" width="1254" height="1254"/><image id="${ids.panel}" href="${href(`panel-${style}-${theme}.png`)}" width="${meta.panel[0]}" height="${meta.panel[1]}"/>`;
 if(style==='gothic')defs+=`<image id="${ids.tablet}" href="${href(`tablet-task-gothic-${theme}.png`)}" width="2172" height="724"/>`;
 const catalogArt=mode==='catalog'?REGISTERED_ART[style].catalog[theme]:null;
 if(catalogArt)defs+=`<image id="${ids.catalog}" href="${href(catalogArt.file)}" width="${catalogArt.size[0]}" height="${catalogArt.size[1]}"/>`;
 if(d.catalogReliefOpacity>0){
  const reliefFile=GOTHIC_RELIEF_ASSETS[theme]||GOTHIC_RELIEF_ASSETS.green;
  defs+=`<image id="${ids.relief}" href="${href(reliefFile)}" width="2172" height="724"/>`;
  if(insetArt&&width>1040)defs+=`<image id="${ids.inset}" href="${href(insetArt.file)}" width="${insetArt.size[0]}" height="${insetArt.size[1]}"/>`;
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
  if(style==='armor'&&mode==='catalog'&&d.sharedArmorShell){
   // The paired screens share the same native button caps and transparent
   // corners. Only the quiet enamel middle changes width with its housing.
   const s=meta.parts['back-button'],paint=d.backArtwork||b,cap=d.backCapWidth??Math.min(26,b[2]/4),scale=paint[3]/s[3],sw=cap/scale;
   const path=chamfer([b[0]+3,b[1]+4,b[2]-6,b[3]-8],12);
   let buttonImage=ids.atlas;
   if(theme==='ember'){
    const tone=prefix+'-button-oxblood',bounds=[s[0]-1,s[1]-1,s[2]+2,s[3]+2];
    defs+=`<filter id="${tone}" filterUnits="userSpaceOnUse" x="${bounds[0]}" y="${bounds[1]}" width="${bounds[2]}" height="${bounds[3]}" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 4 -8 0 0 -.12" result="crimson"/><feColorMatrix in="SourceGraphic" type="matrix" values=".72 .02 0 0 0 .07 .77 0 0 0 .10 0 .73 0 0 0 0 0 1 0" result="deep"/><feComposite in="deep" in2="crimson" operator="in" result="toned"/><feComposite in="SourceGraphic" in2="crimson" operator="out" result="original"/><feComposite in="toned" in2="original" operator="arithmetic" k2="1" k3="1"/></filter>`;
    buttonImage=prefix+'-khorne-button-paint';
    defs+=`<g id="${buttonImage}"><use href="#${ids.atlas}" filter="url(#${tone})"/></g>`;
   }
   const source=[s[0]+sw,s[1],s[2]-2*sw,s[3]],step=source[2]*scale;
   let middle='';for(let x=b[0]+cap-1;x<b[0]+b[2]-cap+1;x+=step-.25)middle+=crop(buttonImage,source,[x,paint[1],step,paint[3]],'xMidYMid meet');
   const clipPath=`M${b[0]+cap-1} ${paint[1]}H${b[0]+b[2]-cap+1}V${paint[1]+paint[3]}H${b[0]+cap-1}Z`;
   const painted=clipped(clipPath,middle)+crop(buttonImage,[s[0],s[1],sw,s[3]],[b[0],paint[1],cap,paint[3]])+crop(buttonImage,[s[0]+s[2]-sw,s[1],sw,s[3]],[b[0]+b[2]-cap,paint[1],cap,paint[3]]);
   const mask=prefix+'-button-native-alpha',face=d.backPaintedBody||b;
   defs+=`<mask id="${mask}" maskUnits="userSpaceOnUse" x="${b[0]-1}" y="${paint[1]-1}" width="${b[2]+2}" height="${paint[3]+2}" style="mask-type:alpha">${painted}<rect x="${b[0]+cap}" y="${face[1]+10}" width="${Math.max(0,b[2]-cap*2)}" height="${Math.max(0,face[3]-20)}" fill="white"/></mask>`;
   return `<g data-catalog-button-silhouette="native-alpha"><g mask="url(#${mask})">${metal(path,b,'enamel',false)}</g>${painted}</g>`;
  }
  const returnScale=style==='armor'&&mode==='catalog'&&d.catalogWideProgress?b[3]/70:1;
  const s=meta.parts['back-button'],cap=Math.min(26*returnScale,b[2]/4),scale=b[3]/s[3],sw=cap/scale,path=chamfer([b[0]+3*returnScale,b[1]+4*returnScale,b[2]-6*returnScale,b[3]-8*returnScale],12*returnScale);
  const source=[s[0]+sw,s[1],s[2]-2*sw,s[3]],step=source[2]*scale;
  let middle='';for(let x=b[0]+cap-1;x<b[0]+b[2]-cap+1;x+=step-.25)middle+=crop(ids.atlas,source,[x,b[1],step,b[3]],'xMidYMid meet');
  const clipPath=`M${b[0]+cap-1} ${b[1]}H${b[0]+b[2]-cap+1}V${b[1]+b[3]}H${b[0]+cap-1}Z`;
  return metal(path,b,'enamel',false)+clipped(clipPath,middle)+crop(ids.atlas,[s[0],s[1],sw,s[3]],[b[0],b[1],cap,b[3]])+crop(ids.atlas,[s[0]+s[2]-sw,s[1],sw,s[3]],[b[0]+b[2]-cap,b[1],cap,b[3]]);
 };
 const taskFrame=b=>{
  const g=style==='gothic',left=g?[292,333,250,331]:[268,273,240,367],right=g?[1553,333,253,331]:[1658,273,247,367],stone=g?[510,365,1050,260]:[510,315,1140,270],k=b[3]/left[3],lw=left[2]*k,rw=right[2]*k;
  const path=chamfer([b[0]+4,b[1]+5,b[2]-8,b[3]-10],14);
  // Armor's painted rails and side caps already carry the complete gold edge.
  // A second procedural outline doubles its lower lip, most visibly while
  // the compact frame grows through tablet widths. Keep only the native edge.
  let out=metal(path,b,'iron',g)+clipped(path,crop(ids.panel,stone,[b[0]+lw*.65,b[1]+10,b[2]-(lw+rw)*.65,b[3]-20]));
  const rails=g?[[600,338,240,33],[600,632,240,44]]:[[600,276,240,38],[600,623,240,40]];
  for(const source of rails){
   const x=b[0]+lw*.7,w=b[2]-(lw+rw)*.7,y=b[1]+(source[1]-left[1])*k,h=source[3]*k,step=source[2]*k;
   let rail='';for(let xx=x;xx<x+w;xx+=step-.3)rail+=crop(ids.panel,source,[xx,y,step,h],'xMidYMid meet');
   out+=clipped(`M${x} ${y}H${x+w}V${y+h}H${x}Z`,rail);
  }
  return out+crop(ids.panel,left,[b[0],b[1],lw,b[3]])+crop(ids.panel,right,[b[0]+b[2]-rw,b[1],rw,b[3]]);
 };
 const catalogInscriptionGeometry=()=>{
  const text=labels.title.rect,cx=text[0]+text[2]/2,opening=d.catalogOpening;
  const b=[cx-d.catalogInscriptionWidth/2,opening[1]-2,d.catalogInscriptionWidth,opening[3]+4],k=b[3]/331;
  const x=b[0],y=b[1],right=x+b[2],bottom=y+b[3],cap=134*k;
  const silhouette=`M${x+cap-3} ${y+2}H${right-cap+3}C${right-14} ${y+8} ${right-4} ${y+28} ${right-3} ${y+b[3]/2}C${right-4} ${bottom-28} ${right-14} ${bottom-8} ${right-cap+3} ${bottom-2}H${x+cap-3}C${x+14} ${bottom-8} ${x+4} ${bottom-28} ${x+3} ${y+b[3]/2}C${x+4} ${y+28} ${x+14} ${y+8} ${x+cap-3} ${y+2}Z`;
  return{b,k,x,y,right,cap,silhouette};
 };
 const catalogFrame=b=>{
  const p=chamfer([b[0]+2,b[1]+4,b[2]-4,b[3]-8],style==='gothic'?12:17);
  let out=metal(p,b,'iron',style!=='gothic')+clipped(p,catalogCrop(style==='gothic'?[310,365,725,180]:[340,355,600,200],[b[0]+3,b[1]+5,b[2]-6,b[3]-10]));
  // Faces retain the height-driven scale of the accepted desktop panel.
  // Widen the quiet stone between the cast reliefs, never their anatomy.
  if(style==='gothic'&&d.catalogReliefOpacity>0){
   const filter=theme==='violet'?` filter="url(#${prefix}-relief-pewter)"`:'';
   if(width<=1040)out+=clipped(p,`<g opacity="${d.catalogReliefOpacity}"${filter}>${crop(ids.relief,[0,212,2172,300],b,'xMidYMid slice')}</g>`);
   else{
    const wide=d.catalogWideProgress,scale=b[3]/300,quiet=[1650,250,450,210],tileW=quiet[2]*b[3]/quiet[3];
    const material=prefix+'-catalog-relief-stone';
    const tile=crop(ids.relief,quiet,[0,0,tileW,b[3]],'xMidYMid meet');
    defs+=`<pattern id="${material}" patternUnits="userSpaceOnUse" x="${b[0]}" y="${b[1]}" width="${tileW*2}" height="${b[3]}">${tile}<g transform="translate(${tileW*2} 0) scale(-1 1)">${tile}</g></pattern>`;
    let wall=`<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" fill="url(#${material})"/>`;
    const reliefPart=(source,box,edge,name)=>{
     const gradient=prefix+'-relief-'+name,mask=gradient+'-mask',fade=Math.min(.2,edge/box[2]);
     defs+=`<linearGradient id="${gradient}" x1="0" x2="1" y1="0" y2="0"><stop stop-color="black"/><stop offset="${fade}" stop-color="white"/><stop offset="${1-fade}" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="${mask}" maskUnits="userSpaceOnUse" x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}"><rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="url(#${gradient})"/></mask>`;
     return `<g mask="url(#${mask})">${crop(ids.relief,source,box,'xMidYMid meet')}</g>`;
    };
    if(wide<1){
     const referenceWidth=1040-2*(8+d.towerW*.65),reference=[b[0]+(b[2]-referenceWidth)/2,b[1],referenceWidth,b[3]];
     wall+=`<g opacity="${1-wide}">${reliefPart([0,212,2172,300],reference,20,'reference')}</g>`;
    }
    const label=labels.title.rect,center=label[0]+label[2]/2,plateLeft=center-d.catalogInscriptionWidth/2,plateRight=center+d.catalogInscriptionWidth/2;
    const leftCenter=(d.back[0]+d.back[2]+plateLeft)/2,rightCenter=plateRight+(b[0]+b[2]-plateRight)*.45;
    const left=[leftCenter-470*scale,b[1],920*scale,b[3]],right=[rightCenter-250*scale,b[1],680*scale,b[3]];
    let rightRelief;
    if(insetArt){
     // Translate the accepted relief into the right bay without reflecting
     // its face or tendrils. Height fixes its native scale; the trailing ends
     // continue beneath the right tower when the bay is narrower than the art.
     const source=insetArt.crop,opening=d.catalogOpening;
     const insetScale=(opening[3]+6)/source[3];
     const box=[plateRight-7,opening[1]-2,source[2]*insetScale,source[3]*insetScale];
     const mask=prefix+'-inset-cartouche-mask',{silhouette}=catalogInscriptionGeometry();
     // The title casting owns its silhouette even as its border fades in.
     // Keep the art in the right opening with a small underlap at its lip.
     const insetLeft=plateRight-14,insetRight=b[0]+b[2];
     defs+=`<mask id="${mask}" maskUnits="userSpaceOnUse" x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}"><rect x="${insetLeft}" y="${b[1]}" width="${Math.max(0,insetRight-insetLeft)}" height="${b[3]}" fill="white"/><path d="${silhouette}" fill="black"/></mask>`;
     rightRelief=`<g data-catalog-relief="${insetArt.kind}" data-catalog-relief-side="right" data-relief-scale="${insetScale}" mask="url(#${mask})">${crop(ids.inset,source,box,'xMidYMid meet')}</g>`;
    }else rightRelief=reliefPart([0,212,680,300],right,14,'right');
    wall+=`<g data-catalog-relief-scale="${scale}" opacity="${wide}">${reliefPart([800,212,920,300],left,28,'left')}${rightRelief}</g>`;
    out+=clipped(p,`<g opacity="${d.catalogReliefOpacity}"${filter}>${wall}</g>`);
   }
  }
  return out;
 };
 const catalogInscription=()=>{
  if(style!=='gothic'||mode!=='catalog'||!d.catalogWideProgress)return'';
  const{b,k,x,y,right,cap,silhouette}=catalogInscriptionGeometry();
  let painted=crop(ids.panel,[560,380,900,230],b);
  for(const source of [[600,338,240,33],[600,632,240,31]]){
   const yy=y+(source[1]-333)*k,hh=source[3]*k,step=source[2]*k;
   let rail='';for(let at=x+cap-5;at<right-cap+5;at+=step-.3)rail+=crop(ids.panel,source,[at,yy,step,hh],'xMidYMid meet');
   painted+=clipped(`M${x+cap-5} ${yy}H${right-cap+5}V${yy+hh}H${x+cap-5}Z`,rail);
  }
  painted+=crop(ids.panel,[421,333,134,331],[x,y,134*k,b[3]],'xMidYMid meet')+crop(ids.panel,[1540,333,140,331],[right-140*k,y,140*k,b[3]],'xMidYMid meet');
  return `<g data-catalog-inscription="native-slate-cartouche" opacity="${d.catalogWideProgress}">${clipped(silhouette,painted)}</g>`;
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
  bodySvg+=catalogInscription();
 }
 // The canopy joins the crown shoulder and grips the front of the cornice.
 const skeletal=renderGothicSkeletalCrest(layout,{...options,idPrefix:prefix+'-skeletal'});
 defs+=skeletal.defs;bodySvg+=skeletal.body;
 const skulls=renderGothicSkullFrieze(layout,{...options,idPrefix:prefix+'-skulls'});
 defs+=skulls.defs;bodySvg+=skulls.underlay;
 // Draw the cornice once, then its whole canopy and small inset skull reliefs.
 const structure=renderTaskBands(layout,{...options,idPrefix:prefix+'-structure'});
 defs+=structure.defs;
 const wideArmorCatalog=style==='armor'&&mode==='catalog'&&d.catalogWideProgress>0;
 if(!wideArmorCatalog)bodySvg+=structure.body;
 bodySvg+=skeletal.overlay+skulls.body;
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
   bodySvg+=crop(ids.tablet,[320,360,181,260],[lx,f[1],leftAvailable,ah],'xMaxYMid slice');
   bodySvg+=`<g transform="translate(${width} 0) scale(-1 1)">${crop(ids.tablet,[320,360,181,260],[lx,f[1],rightAvailable,ah],'xMaxYMid slice')}</g>`;
   bodySvg+=taskFrame(f);
   bodySvg+=crop(ids.tablet,[662,0,954,382],d.crest,'xMidYMid meet');
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
  if(wideArmorCatalog){
   const panels=renderArmorCatalogPanels(layout,{...options,idPrefix:prefix+'-catalog'});
   defs+=panels.defs;
   bodySvg+=`<g opacity="${1-d.catalogWideProgress}">${catalogFrame(d.catalogField)}</g>`+panels.body+structure.body;
  }else bodySvg+=mode==='catalog'?catalogFrame(d.catalogField):taskFrame(f);
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

export const CLASSIC_STYLE_LIMITS=Object.freeze({minWidth:288,maxWidth:1600,catalogMaxWidth:1600,taskMaxWidth:1040,minimumHitSize:44,globalScale:false,deviceArtSwitches:false});


// Co-located from classic/src/gothic-catalog-insets.mjs; sole consumer above.
/** Individually painted shallow reliefs for the wide catalogue's left bay.
 * Source crops are measured from native alpha; rendering uses uniform scale. */
export const GOTHIC_CATALOG_INSETS = {
 green: {
  file: 'gothic-nurgle-recess-relief-v131.png',
  size: [2172,724],
  crop: [17,146,2144,415],
  kind: 'organic-left-inset'
 },
 ember: {
  file: 'gothic-khorne-recess-relief-v132.png',
  size: [2172,724],
  crop: [14,135,2142,463],
  kind: 'armored-left-inset'
 },
 blue: {
  file: 'gothic-tzeentch-recess-relief-v132.png',
  size: [2172,724],
  crop: [0,135,2152,433],
  kind: 'avian-left-inset'
 },
 violet: {
  file: 'gothic-slaanesh-recess-relief-v132.png',
  size: [2172,724],
  crop: [47,105,2093,447],
  kind: 'baroque-left-inset'
 }
};

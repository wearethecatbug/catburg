/**
 * Preview-only full-width Task composition. The accepted <=622px layout and
 * renderer are used verbatim. Desktop sculptures keep their native aspect;
 * only connecting bays, flat fields and rails absorb horizontal space.
 */
import { getClassicLayout, renderClassicHeader as renderApproved } from '../classic/src/modular-header.mjs';
import { renderClassicHeader as renderStudy } from './classic-task-renderer.mjs';
import { CLASSIC_ASSETS } from '../classic/src/assets.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const mixRect=(a,b,t)=>a.map((value,index)=>mix(value,b[index],t));
const round=rect=>rect.map(value=>Math.round(value*1000)/1000);

function measurer(options){
 return (text,size,role)=>{
  let value;try{value=options.measureText?.(text,size,role);}catch{/* fallback below */}
  return Number.isFinite(value)&&value>=0?value:Array.from(String(text)).length*size*.54;
 };
}
function wrap(text,width,size,measure){
 const result=[];let line='';
 for(const word of String(text).trim().split(/\s+/)){
  const next=line?line+' '+word:word;
  if(line&&measure(next,size,'title')>width){result.push(line);line=word;}else line=next;
 }
 if(line)result.push(line);
 return result.length?result:[''];
}
function fit(text,rect,preferred,measure){
 let fontSize=preferred,lines=wrap(text,rect[2],fontSize,measure);
 while(fontSize>18&&(lines.length>2||lines.length*fontSize*1.08>rect[3]||lines.some(line=>measure(line,fontSize,'title')>rect[2]))){
  fontSize=Math.max(18,fontSize-.25);lines=wrap(text,rect[2],fontSize,measure);
 }
 const count=Math.max(1,Math.min(2,Math.floor(rect[3]/(fontSize*1.08)))),omitted=lines.length>count;
 let truncated=omitted;
 lines=lines.slice(0,count).map((value,index)=>{
  if(measure(value,fontSize,'title')<=rect[2]&&!(omitted&&index===count-1))return value;
  truncated=true;
  while(value&&measure(value.trimEnd()+'…',fontSize,'title')>rect[2])value=value.slice(0,-1);
  return value.trimEnd()+'…';
 });
 return {text:String(text),accessibleText:String(text),rect:round(rect),fontSize,lines,lineHeight:fontSize*1.08,truncated};
}

export function getCompactTaskLayout(availableWidth,options={}){
 const width=clamp(Number(availableWidth)||288,288,1600),style=(options.style??options.headerStyle)==='armor'?'armor':'gothic';
 const settings={...options,mode:'task',page:'task',style};
 const original=getClassicLayout(width,settings);
 original.fullBackLabel=original.labels.back.fullText;
 original.appearance=options.theme||'nurgle';
 if(width<=622)return {...original,sizeStudy:false};

 const p=smooth((width-622)/418),gothic=style==='gothic',shift=(width-original.width)/2;
 const shifted=rect=>[rect[0]+shift,rect[1],rect[2],rect[3]];
 const d0=original.decor,measure=measurer(options),targetHeight=220;
 const targetShoulderH=152,targetShoulderW=targetShoulderH*271/361;
 const targetFrameW=620;
 const targetFrame=[(width-targetFrameW)/2,gothic?92:96,targetFrameW,96];
 const frame=mixRect(shifted(d0.frame),targetFrame,p);
 const height=mix(original.height,targetHeight,p);
 const targetCrestW=gothic?250:134,targetCrestH=targetCrestW*(gothic?382/954:255/368);
 const targetCrest=[width/2-targetCrestW/2,Math.max(4,targetFrame[1]-targetCrestH+10),targetCrestW,targetCrestH];
 const crest=mixRect(shifted(d0.crest),targetCrest,p);
 const towerW=mix(d0.towerW,64,p),originalShoulderH=d0.shoulderH??126+56*d0.q;
 const shoulderH=mix(originalShoulderH,targetShoulderH,p),shoulderW=shoulderH*271/361;
 const originalShoulderX=Math.max(7,d0.frame[0]-originalShoulderH*271/361+3)+shift;
 const shoulderX=mix(originalShoulderX,8,p);
 const targetBack=[gothic?80:16+targetShoulderW,gothic?30:14,200,52];
 const floatingBack=mixRect(shifted(original.rects.back),targetBack,p);
 const leftInner=gothic?8+towerW-4:shoulderX+shoulderW-3;
 const backDock=[leftInner,frame[1],Math.max(.01,frame[0]-leftInner+4),frame[3]];
 // Move horizontally into a fully fitting slot first. Only then can the
 // button descend into the body, so it never crosses the Task frame.
 const horizontalMix=smooth((backDock[2]-172)/24);
 const embeddedBackMix=smooth((backDock[2]-196)/24);
 // The painted dock underlaps the center frame by4px. Bias the button4px
 // outward so its actual edge still clears that frame by at least8px.
 // Keep a material border around the plate. Armor shares this larger dock
 // with its catalogue return; Gothic retains its accepted compact plate.
 const dockBaseWidth=clamp(backDock[2]-16,180,360),dockWidth=dockBaseWidth*(gothic?.9:.96);
 const dockX=backDock[0]+(backDock[2]-dockWidth)/2-4;
 const dockGrowth=smooth((dockBaseWidth-180)/180),dockHeight=mix(gothic?70:72,gothic?86:88,dockGrowth);
 const backW=mix(floatingBack[2],dockWidth,horizontalMix),backH=mix(floatingBack[3],dockHeight,embeddedBackMix);
 const backCenter=mix(floatingBack[1]+floatingBack[3]/2,frame[1]+frame[3]/2,embeddedBackMix);
 const back=[mix(floatingBack[0],dockX,horizontalMix),backCenter-backH/2,backW,backH];
 // Gothic's small floating plate includes about27% transparent/ornamental
 // vertical space. Seat the real face in the dock; let its native barbs join
 // the surrounding rails instead of shrinking the usable painted button.
 const buttonSource=CLASSIC_ASSETS[style][original.theme].parts['back-button'];
 const bodyRows=gothic?{blue:[28,165],green:[29,166],ember:[27,164],violet:[27,160]}:{blue:[5,178],green:[7,176],ember:[5,181],violet:[5,180]};
 const [bodyTop,bodyBottom]=bodyRows[original.theme],bodyScale=(backH-8)/(bodyBottom-bodyTop);
 const paintMix=gothic?embeddedBackMix:0,artScale=mix(backH/buttonSource[3],bodyScale,paintMix);
 const artY=mix(back[1],back[1]+4-bodyTop*bodyScale,paintMix);
 const backArtwork=[back[0],artY,backW,buttonSource[3]*artScale];
 const backPaintedBody=[back[0],artY+bodyTop*artScale,backW,(bodyBottom-bodyTop)*artScale];
 const backCapWidth=Math.min(backW/3,mix(26,78*artScale,paintMix));
 const nav=mix(original.rects.previous[2],48,p),navY=frame[1]+frame[3]/2;
 const rects={
  title:frame.slice(),back:back.slice(),
  previous:[frame[0]+8,navY-nav/2,nav,nav],
  next:[frame[0]+frame[2]-nav-8,navY-nav/2,nav,nav],
  themeHousing:crest.slice()
 };
 for(const name of ['previous','next']){
  const box=rects[name],oldArrow=original.rects[name==='previous'?'arrowPrevious':'arrowNext'],size=mix(oldArrow[2],24,p);
  rects[name==='previous'?'arrowPrevious':'arrowNext']=[box[0]+box[2]/2-size/2,navY-size/2,size,size];
 }
 const themeY=crest[1]+crest[3]*(gothic?.73:.46);
 rects.theme=[width/2-22,Math.max(0,themeY-22),44,44];

 // Text stays bounded independently from the wide lateral body fields.
 const titleWidth=Math.min(gothic?520:560,targetFrame[2]-2*(48+22));
 const titleX=(width-titleWidth)/2,numberY=Math.max(targetFrame[1]+15,gothic?0:targetCrest[1]+targetCrest[3]+2);
 const titleY=numberY+19,titleBottom=targetFrame[1]+targetFrame[3]-6;
 const numberBox=mixRect(shifted(original.labels.number.rect),[titleX,numberY,titleWidth,16],p);
 const titleBox=mixRect(shifted(original.labels.title.rect),[titleX,titleY,titleWidth,Math.max(40,titleBottom-titleY)],p);
 const title=options.title??options.taskTitle??'Reverse a String';
 const labels={
  number:{text:'TASK '+String(options.taskNumber??1).padStart(2,'0'),rect:numberBox,fontSize:mix(original.labels.number.fontSize,13,p)},
  title:fit(title,titleBox,mix(original.labels.title.fontSize,30,p),measure)
 };
 const full=String(options.allTasksLabel||'All tasks');
 let backFont=mix(original.labels.back.fontSize,17,p)+5*dockGrowth*embeddedBackMix;
 while(backFont>12&&measure(full,backFont,'back')>back[2]-48)backFont-=.25;
 let text=full;
 if(measure(text,backFont,'back')>back[2]-48){while(text&&measure(text+'…',backFont,'back')>back[2]-48)text=text.slice(0,-1);text+='…';}
 const arrowSize=16+6*dockGrowth*embeddedBackMix,arrowGroup=arrowSize+8;
 const textW=measure(text,backFont,'back'),groupW=textW+arrowGroup,gx=back[0]+(back[2]-groupW)/2;
 labels.back={text,fullText:full,accessibleText:full,fontSize:backFont,rect:[gx+arrowGroup,backCenter-18,textW,36]};
 rects.backArrow=[gx,backCenter-arrowSize/2,arrowSize,arrowSize];

 const ornamentW=mix(d0.ornamentW??108,92,p),claspW=mix(84+46*d0.q,100,p);
 let nativeRailHeight;
 if(gothic){
  const outer=8+d0.towerW*.65,gap=(d0.ornamentW??108)*.4;
  nativeRailHeight=(original.width/2-gap-outer)*51/706;
 }else{
  const sh=d0.shoulderH??126+56*d0.q,sw=sh*271/361,sx=Math.max(7,d0.frame[0]-sw+3);
  nativeRailHeight=(original.width/2-35-sx-sw*.25)*61/720;
 }
 let sideBays;
 if(gothic){
  const bayH=frame[3]+5,bayW=backDock[2],railBottom=crest[1]+338*crest[2]/954;
  // Use a complete native pilaster, including its real capital and foot.
  // Both ends enter the shared castings; no pedestal is reused as a top cap.
  const columnTop=railBottom-5,columnBottom=frame[1]+frame[3]+3;
  const columnH=columnBottom-columnTop,columnW=50*columnH/210;
  // Architecture must stay solid at every viewport. Add a whole pier only
  // when the resulting window bays have room, rather than fading a ghost in.
  const count=bayW>=400?2:bayW>=248?1:0;
  const room=(bayW-count*columnW)/(count+1);
  const columns=Array.from({length:count},(_,i)=>{
   const x=leftInner+room*(i+1)+columnW*i;
   return {rect:[x,columnTop,columnW,columnH],source:[1908,264,50,210],cutCenter:x+columnW/2,opacity:1};
  });
  sideBays={left:[leftInner,frame[1],bayW,bayH],right:[width-leftInner-bayW,frame[1],bayW,bayH],columns,sourceHeight:mix(260,172,p)};
 }
 const decor={...d0,frame:frame.slice(),crest:crest.slice(),back:back.slice(),towerW,shoulderH,shoulderX,ornamentW,claspW,
  backDock,embeddedBackMix,backInsetProgress:horizontalMix,backArtwork,backPaintedBody,backCapWidth,sideBays,
  ventBandH:gothic?undefined:mix(d0.ventBandH,38,p),lowerRailHeight:mix(nativeRailHeight,gothic?26:24,p),
  outerY:frame[1]-56,outerBottom:frame[1]+frame[3]+18,sizeStudyProgress:p};
 const hits={back:back.slice(),previous:rects.previous.slice(),next:rects.next.slice()};
 for(const [key,value]of Object.entries(rects))rects[key]=round(value);
 for(const [key,value]of Object.entries(hits))hits[key]=round(value);
 for(const label of Object.values(labels))label.rect=round(label.rect);
 const anchor={width,height,baseline:frame[1]+frame[3],centerX:width/2,frame:frame.slice(),crest:crest.slice(),back:back.slice(),outerY:decor.outerY,outerBottom:decor.outerBottom};
 return {...original,width,availableWidth:Number(availableWidth),height,style,mode:'task',rects,hits,labels,text:labels,decor,anchor,
  fullBackLabel:full,visibleBackLabel:text,composition:'modular',showTheme:false,appearanceLocation:'external',sizeStudy:true};
}

/** Asset resolution follows header-kit: resolveAsset receives "classic/name". */
export function renderCompactTaskArtwork(layout,options={}){
 const resolveAsset=name=>options.resolveAsset?options.resolveAsset('classic/'+name):options.assetBase
  ? `${String(options.assetBase).replace(/\/$/,'')}/classic/${name}`
  : (()=>{throw new Error('v146 compact artwork requires the closed asset resolver');})();
 return (layout.sizeStudy?renderStudy:renderApproved)(layout,{...options,resolveAsset});
}

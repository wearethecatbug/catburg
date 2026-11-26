/** Preview-only sizing study. Approved production sources remain untouched. */
/** Structural Task bands from the original V5 paintings.
 * This layer sits behind the existing frame, controls and sculpted ornaments.
 * Source rectangles stay proportional; broad plain sections may be cropped or
 * repeated to bridge the space between independently positioned ornaments.
 */
import { REGISTERED_ART } from '../classic/src/registered-art.mjs';
import { ARMOR_SIDE_CHASSIS, renderArmorDockSurface } from '../classic/src/armor-surface-art.mjs';
export { ARMOR_SIDE_CHASSIS } from '../classic/src/armor-surface-art.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};

export function getArmorSideChassisGeometry(layout){
 const art=ARMOR_SIDE_CHASSIS[layout.theme],d=layout.decor;
 if(layout.style!=='armor'||layout.composition==='compact'||!art||!d?.frame)return null;
 const f=d.frame,q=clamp(d.q||0,0,1),sh=d.shoulderH??(126+56*q),sw=sh*271/361;
 const sx=d.shoulderX??Math.max(7,f[0]-sw+3),left=f[0]+f[2],right=layout.width-sx-sw;
 const availableWidth=Math.max(0,right-left),opacity=smooth((availableWidth-180)/50)*smooth((layout.width-622)/418);
 if(opacity<=0)return null;
 // Enter the painted nav/shoulder cores, not only their transparent crop boxes.
 // Symmetric overscan retains the former material scale and relief centre.
 const underlap=40,rect=[left-underlap,f[1]-4,availableWidth+2*underlap,f[3]+12];
 const sourceWidth=Math.min(art.crop[2],rect[2]*art.crop[3]/rect[3]);
 const sourceX=clamp(art.focalX-sourceWidth/2,art.crop[0],art.crop[0]+art.crop[2]-sourceWidth);
 return{file:art.file,size:art.size.slice(),nativeCrop:art.crop.slice(),crop:[sourceX,art.crop[1],sourceWidth,art.crop[3]],
  rect,opacity,availableWidth,underlap,focalX:art.focalX};
}

export function renderTaskBands(layout,options={}){
 if(layout.composition==='compact'||!layout.decor?.frame)return{defs:'',body:''};
 const {width,height,style,theme,decor:d}=layout;
 const f=d.frame,crest=d.crest,tw=d.towerW,bottom=f[1]+f[3];
 const prefix=String(options.idPrefix||'classic').replace(/[^\w-]/g,'-')+'-task-bands';
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,'');
 const file=style==='gothic'?`tablet-task-gothic-${theme}.png`:`panel-armor-${theme}.png`;
 const href=esc(options.resolveAsset?options.resolveAsset(file):base+'/'+file);
 const imageId=prefix+'-source';
 let defs=`<image id="${imageId}" href="${href}" width="2172" height="724"/>`,serial=0;
 const crop=(source,dest,aspect='xMidYMid slice')=>`<svg x="${dest[0]}" y="${dest[1]}" width="${dest[2]}" height="${dest[3]}" viewBox="${source.join(' ')}" preserveAspectRatio="${aspect}" overflow="hidden"><use href="#${imageId}"/></svg>`;
 const clip=(box,body)=>{
  const id=prefix+'-clip-'+serial++;
  defs+=`<clipPath id="${id}"><rect x="${box[0]}" y="${box[1]}" width="${Math.max(0,box[2])}" height="${Math.max(0,box[3])}"/></clipPath>`;
  return`<g clip-path="url(#${id})">${body}</g>`;
 };
 const railHalf=(source,x,w,y,reflect=false)=>{
  if(w<=0)return'';
  const h=d.lowerRailHeight??w*source[3]/source[2],step=source[2]*h/source[3];
  let painted='';
  for(let at=x,index=0;at<x+w;at+=step-.3,index++){
   const tile=crop(source,[at,y,step,h],'xMidYMid meet');
   painted+=reflect&&index%2?`<g transform="translate(${2*at+step} 0) scale(-1 1)">${tile}</g>`:tile;
  }
  return clip([x,y,w,h],painted);
 };
 let body='';
 if(style==='gothic'){
  // One continuous casting reaches into each tower's solid pitched capital.
  // Stopping at a spire's transparent bounds left a floating cut end; the
  // whole last section is now seated behind the native tower artwork.
  const corniceEnd=width-8-tw*.55,blend=18;
  const cornice=(x,y,h,catalog=false,leftInner=null)=>{
   const paint=(start,name)=>renderGothicCornice({x:start,y,width:Math.max(0,corniceEnd-start),height:h,theme,catalog},{...options,idPrefix:prefix+'-cornice-'+name});
   const right=paint(x,'right'),left=paint(leftInner===null?x:width-leftInner,'left');
   defs+=right.defs+left.defs;
   return right.body+`<g transform="translate(${width} 0) scale(-1 1)">${left.body}</g>`;
  };
  if(layout.mode==='catalog'&&d.catalogCrown){
   const art=REGISTERED_ART.gothic.catalog[theme],blue=[29,18,1907,794],b=art.bounds,catId=prefix+'-catalog';
   const catHref=esc(options.resolveAsset?options.resolveAsset(art.file):base+'/'+art.file);
   defs+=`<image id="${catId}" href="${catHref}" width="${art.size[0]}" height="${art.size[1]}"/>`;
   const c=d.catalogCrown,k=c[2]/1395,x=c[0]+c[2]-24,y=c[1]+206*k,h=112*k;
   const sx=(b[2]-b[0])/(blue[2]-blue[0]),sy=(b[3]-b[1])/(blue[3]-blue[1]);
   const native=s=>[b[0]+(s[0]-blue[0])*sx,b[1]+(s[1]-blue[1])*sy,s[2]*sx,s[3]*sy];
   const catCrop=(s,dest)=>`<svg x="${dest[0]}" y="${dest[1]}" width="${dest[2]}" height="${dest[3]}" viewBox="${native(s).join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><use href="#${catId}"/></svg>`;
   const catTile=(s,box)=>{const step=s[2]*box[3]/s[3];let out='';for(let dx=0;dx<box[2];dx+=step-.3)out+=catCrop(s,[box[0]+dx,box[1],step,box[3]]);return clip(box,out);};
   // The original crown covers the inner junction. Long enamel and gold
   // mouldings are drawn continuously instead of repeating a chopped crop.
   body+=cornice(x,y,h,true,c[0]+24);
   // A complete worn casting with regularly spaced bosses is the catalogue's
   // lower frame. It sits in front of the stone and replaces the orphaned
   // central Task pendant, while retaining the common baseline.
   // Its underside is seated in the same base as both towers; leaving it
   // lower exposed a square cut end outside each foot at tablet widths.
   const outer=8+tw*.65,railH=22+4*clamp(d.q||0,0,1),railY=bottom+8-railH;
   body+=catTile([365,550,1280,110],[outer,railY,width-outer*2,railH]);
  }else{
   // The native cornice ends at338. Rows338–364 belong to the lower
   // crown footing, not to the cornice: including them stretched the flat
   // strip below the curved shoulder and doubled the Task frame moulding.
   const k=crest[2]/954,tail=[1580,140,230,198],tailX=crest[0]+(tail[0]-662)*k,tailY=crest[1]+tail[1]*k,tailW=tail[2]*k,tailH=tail[3]*k;
   const flatX=tailX+tailW-blend,flatY=crest[1]+224*k,flatH=114*k;
   body+=cornice(flatX,flatY,flatH);
   const gradient=prefix+'-native-tail-fade',mask=gradient+'-mask';
   defs+=`<linearGradient id="${gradient}" gradientUnits="userSpaceOnUse" x1="${tailX+tailW-blend}" x2="${tailX+tailW}" y1="0" y2="0"><stop stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="${mask}" maskUnits="userSpaceOnUse" x="${tailX}" y="${tailY}" width="${tailW}" height="${tailH}"><rect x="${tailX}" y="${tailY}" width="${tailW}" height="${tailH}" fill="url(#${gradient})"/></mask>`;
   const paintedTail=`<g mask="url(#${mask})">${crop(tail,[tailX,tailY,tailW,tailH],'xMidYMid meet')}</g>`;
   body+=paintedTail+`<g transform="translate(${width} 0) scale(-1 1)">${paintedTail}</g>`;
  }
  // One complete native sill owns the lower edge of both side bays. The
  // former565–616 crop began inside the enamel, omitting its upper moulding;
  // isolated window sills then supplied a broken substitute on the right.
  // This plain interval includes the upper gold lip, enamel and bottom bead,
  // without a copied pedestal or pendant. Adjacent reflections join cleanly.
  if(layout.mode!=='catalog'){
   const outer=8+tw*.65;
   const railY=bottom-3,railH=d.lowerRailHeight;
   if(Number.isFinite(railH)){
    // The repeated middle has two open ends. Finish its exposed right end
    // with the original heel's closed, sloping alpha contour below the tower.
    // Both pieces use the same uniform scale; the upper joint enters the
    // tower's solid foot and the lower bead keeps the established baseline.
    const terminalSource=[2054,527,118,94],terminalW=terminalSource[2]*railH/terminalSource[3];
    const terminalX=width-8-terminalW;
    const middle=railHalf([620,510,350,94],outer,terminalX-outer+.3,railY,true);
    const terminal=crop(terminalSource,[terminalX,railY,terminalW,railH],'xMidYMid meet');
    body+=`<g data-gothic-lower-sill="continuous-native">${middle}<g data-gothic-right-terminal="native-closed-heel">${terminal}</g></g>`;
   }else body+=`<g data-gothic-lower-sill="continuous-native">${railHalf([620,510,350,94],outer,width-outer*2,railY,true)}</g>`;
  }
 }else{
  // The purpose-painted vent band owns the entire upper rail. Keep the source
  // chassis only at the sides and bottom; no old blue rail behind vent pods.
  const q=clamp(d.q||0,0,1),sh=d.shoulderH??(126+56*q),sw=sh*271/361,sx=d.shoulderX??Math.max(7,f[0]-sw+3);
  const outer=sx+sw*.25;
  // A full enamel plate joins the outer shoulder to the smaller central
  // frame. Its material is sampled at a fixed scale: widening the bay never
  // magnifies one narrow chassis crop into an oversized blurry column.
  const sideX=sx+sw*.48,sideW=Math.max(0,f[0]-sideX+18),sideY=f[1]-4,sideH=f[3]+12;
  if(sideW>0&&!(d.sharedArmorShell&&layout.mode==='catalog')){
   const chassis=getArmorSideChassisGeometry(layout),backingOpacity=1-(chassis?.opacity??0);
   const materialSize=1254*.32,material=prefix+'-side-enamel',shade=prefix+'-side-shade';
   const materialFile=`material-enamel-${theme}.png`,materialHref=esc(options.resolveAsset?options.resolveAsset(materialFile):base+'/'+materialFile);
   defs+=`<pattern id="${material}" patternUnits="userSpaceOnUse" width="${materialSize}" height="${materialSize}"><image href="${materialHref}" width="${materialSize}" height="${materialSize}"/></pattern><linearGradient id="${shade}" x2="0" y2="1"><stop stop-color="#080909" stop-opacity=".22"/><stop offset=".48" stop-color="#080909" stop-opacity=".43"/><stop offset="1" stop-color="#080909" stop-opacity=".18"/></linearGradient>`;
   const plate=`<rect x="${sideX}" y="${sideY}" width="${sideW}" height="${sideH}" fill="url(#${material})"/><rect x="${sideX}" y="${sideY}" width="${sideW}" height="${sideH}" fill="url(#${shade})"/>`;
   // Shared creased steel stays legible in the exposed margins of the dock.
   const dock=renderArmorDockSurface([sideX,sideY,sideW,sideH],theme,{...options,idPrefix:prefix+'-dock',enamelPattern:material});
   defs+=dock.defs;
   const dockPlate=dock.body;
   // The right backing retains the original inner fastening. On the left,
   // its rivets intruded into the large button's transparent bevelled corner:
   // that dock is one uninterrupted plate, including during button descent.
   const fasteningW=sideH*111/328,fasteningX=f[0]-fasteningW*.48;
   const fastening=crop([174,302,111,328],[fasteningX,sideY,fasteningW,sideH],'xMidYMid meet');
   const plateMix=smooth((width-622)/418);
   const compactJoin=plateMix<1?crop([174,302,111,328],[sideX,sideY,sideW,sideH],'xMidYMid slice'):'';
   const leftSide=clip([sideX,sideY,sideW,sideH],`<g opacity="${1-plateMix}">${compactJoin}</g><g data-armor-left-dock="continuous" opacity="${plateMix}">${dockPlate}</g>`);
   // The complete cast plate replaces the provisional backing and fastening
   // together. Their rectangular ends must not survive beneath its contour.
   const rightSide=clip([sideX,sideY,sideW,sideH],`<g opacity="${1-plateMix}">${compactJoin}</g><g data-armor-right-backing="provisional" opacity="${plateMix*backingOpacity}">${plate+fastening}</g>`);
   body+=`<g data-armor-side-panel="left">${leftSide}</g><g data-armor-side-panel="right" transform="translate(${width} 0) scale(-1 1)">${rightSide}</g>`;
   if(chassis){
    const chassisId=prefix+'-right-chassis',r=chassis.rect;
    const chassisHref=esc(options.resolveAsset?options.resolveAsset(chassis.file):base+'/'+chassis.file);
    defs+=`<image id="${chassisId}" href="${chassisHref}" width="${chassis.size[0]}" height="${chassis.size[1]}"/>`;
    let chassisPaint=`<use href="#${chassisId}"/>`;
    if(theme==='ember'){
     // The upper native plate becomes warm steel; the lower overlapping
     // plate remains crimson. Follow the painted bronze lip in source units.
     // Only red-dominant enamel contributes to the conversion, so the skull,
     // rivets and worn gold fissures retain the original painted material.
     const steel=prefix+'-ember-steel',upper=prefix+'-ember-upper-plate',soft=prefix+'-ember-plate-edge';
     defs+=`<filter id="${steel}" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 6 -12 0 0 -.25" result="redness"/><feComponentTransfer in="redness" result="enamel"><feFuncA type="table" tableValues="0 .15625 .5 .84375 1"/></feComponentTransfer><feColorMatrix in="SourceGraphic" type="matrix" values=".32 .25 .08 0 .010 .28 .22 .07 0 .010 .24 .18 .06 0 .009 0 0 0 1 0" result="warmsteel"/><feComposite in="warmsteel" in2="enamel" operator="in"/></filter><filter id="${soft}"><feGaussianBlur stdDeviation="1.8"/></filter><mask id="${upper}" maskUnits="userSpaceOnUse" x="0" y="0" width="2172" height="724"><polygon points="63,284 145,276 179,204 655,204 675,219 1230,219 1262,204 1739,204 1752,230 1669,357 1280,411 1155,520 231,520 147,415 63,415" fill="white" filter="url(#${soft})"/></mask>`;
     chassisPaint+=`<g data-armor-ember-material="upper-steel-lower-enamel" mask="url(#${upper})"><use href="#${chassisId}" filter="url(#${steel})"/></g>`;
    }
    body+=`<g data-armor-side-chassis="${theme}" opacity="${chassis.opacity}"><svg x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" viewBox="${chassis.crop.join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="hidden">${chassisPaint}</svg></g>`;
   }
  }
  // Original stepped lower chassis; no copied clasp, button or task lettering.
  const centerGap=35;
  const halfW=width/2-centerGap-outer;
  body+=railHalf([250,652,720,61],outer,halfW,bottom-3);
  // Finish with the original closed lower-right heel, including its alpha
  // contour. A cropped repeat used to leave a straight projecting strip.
  const rightRail=[1220,652,700,61],railX=width/2+centerGap,railY=bottom-3;
  const railH=d.lowerRailHeight??halfW*61/700,terminalW=Math.min(halfW,168*railH/61);
  const terminalX=railX+halfW-terminalW,terminalMix=smooth((width-622)/418);
  body+=railHalf(rightRail,railX,Math.max(0,halfW-terminalW),railY);
  if(terminalMix<1)body+=`<g opacity="${1-terminalMix}">${clip([terminalX,railY,terminalW,railH],railHalf(rightRail,railX,halfW,railY))}</g>`;
  body+=`<g data-armor-right-terminal="native-closed-heel" opacity="${terminalMix}">${crop([1920,652,168,61],[terminalX,railY,terminalW,railH],'xMidYMid meet')}</g>`;
  body+=crop([520,652,280,61],[width/2-centerGap-1,bottom-3,centerGap*2+2,(d.lowerRailHeight??halfW*61/710)],'xMidYMid slice');
 }
 // Compact geometry owns the phone silhouette. From the first modular width,
 // connecting castings stay present so the growing crown has no exposed cuts.
 const opacity=1;
 const painted=clip([0,0,width,height],body);
 return{defs,body:`<g data-task-bands="${style}" opacity="${opacity}">${painted}</g>`};
}


// Co-located from size-study/gothic-cornice.mjs; sole consumer above.
/** Preview-only extension of the approved native cornice. */
/** Continuous painted Gothic mouldings.
 * Each palette is one long, purpose-painted strip. The crop uses a fixed
 * height-driven, uniform scale: extending the cornice reveals more material;
 * neither sculpted modules nor a short slice are repeated or stretched.
 */
export const GOTHIC_CORNICE_ART={
 file:'gothic-cornice-continuous-atlas.png',size:[1774,887],
 rows:{blue:[32,110,1712,112],green:[32,301,1712,116],violet:[32,499,1712,116],ember:[32,698,1712,116]}
};
export const GOTHIC_CATALOG_CORNICE_ART={
 file:'gothic-catalog-cornice-continuous-atlas.png',size:[1774,887],
 rows:{blue:[32,78,1712,145],green:[32,286,1712,147],violet:[32,486,1712,146],ember:[32,694,1712,147]}
};
export function renderGothicCornice({x,y,width,height,theme='blue',catalog=false},options={}){
 if(width<=0||height<=0)return{defs:'',body:''};
 const id=String(options.idPrefix||'cornice').replace(/[^\w-]/g,'-');
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,'');
 const art=catalog?GOTHIC_CATALOG_CORNICE_ART:GOTHIC_CORNICE_ART;
 const file=art.file,href=esc(options.resolveAsset?options.resolveAsset(file):base+'/'+file),source=art.rows[theme]||art.rows.blue;
 const scale=height/source[3],nativeWidth=source[2]*scale;
 const defs=`<image id="${id}-atlas" href="${href}" width="1774" height="887"/><clipPath id="${id}-extent"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath>`;
 // Preview-only: the thinner1600px construction can exhaust the long
 // original strip before reaching its tower. Continue the same native paint
 // at the same uniform scale, reflecting its last edge for a matching joint.
 // The architectural tower still covers the outer end of the complete rail.
 let painted='';
 for(let offset=0,index=0;offset<width;offset+=nativeWidth-.3,index++){
  const at=x+offset,strip=`<svg x="${at}" y="${y}" width="${nativeWidth}" height="${height}" viewBox="${source.join(' ')}" preserveAspectRatio="xMinYMin meet" overflow="hidden"><use href="#${id}-atlas"/></svg>`;
  painted+=index%2?`<g transform="translate(${2*at+nativeWidth} 0) scale(-1 1)">${strip}</g>`:strip;
 }
 const body=`<g data-gothic-cornice="continuous" data-material-scale="${scale}" clip-path="url(#${id}-extent)">${painted}</g>`;
 return{defs,body};
}

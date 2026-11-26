/** Structural Task bands from the original V5 paintings.
 * This layer sits behind the existing frame, controls and sculpted ornaments.
 * Source rectangles stay proportional; broad plain sections may be cropped or
 * repeated to bridge the space between independently positioned ornaments.
 */
import { REGISTERED_ART } from './registered-art.mjs';
import { renderTaskBands as renderSharedTaskBands } from '../../size-study/task-bands.mjs';
import { renderGothicCornice } from './gothic-cornice.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function renderTaskBands(layout,options={}){
 if(layout.composition==='compact'||!layout.decor?.frame)return{defs:'',body:''};
 // Workspace's Armor pair uses the exact Task rail and native heel. Its
 // catalogue panel renderer owns the interior, so only the casting is shared.
 if(layout.style==='armor'&&layout.mode==='catalog'&&layout.decor.sharedArmorShell)return renderSharedTaskBands(layout,options);
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
 const railHalf=(source,x,w,y)=>{
  if(w<=0)return'';
  if(style==='armor'&&layout.mode==='catalog'&&Number.isFinite(d.lowerRailHeight)){
   const h=d.lowerRailHeight,step=source[2]*h/source[3];
   let painted='';
   for(let at=x;at<x+w;at+=step-.3)painted+=crop(source,[at,y,step,h],'xMidYMid meet');
   return clip([x,y,w,h],painted);
  }
  const h=w*source[3]/source[2];
  return clip([0,0,width,height],crop(source,[x,y,w,h],'xMidYMid meet'));
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
   const k=crest[2]/954,tail=[1580,140,230,224],tailX=crest[0]+(tail[0]-662)*k,tailY=crest[1]+tail[1]*k,tailW=tail[2]*k,tailH=tail[3]*k;
   const flatX=tailX+tailW-blend,flatY=crest[1]+224*k,flatH=140*k;
   body+=cornice(flatX,flatY,flatH);
   const gradient=prefix+'-native-tail-fade',mask=gradient+'-mask';
   defs+=`<linearGradient id="${gradient}" gradientUnits="userSpaceOnUse" x1="${tailX+tailW-blend}" x2="${tailX+tailW}" y1="0" y2="0"><stop stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="${mask}" maskUnits="userSpaceOnUse" x="${tailX}" y="${tailY}" width="${tailW}" height="${tailH}"><rect x="${tailX}" y="${tailY}" width="${tailW}" height="${tailH}" fill="url(#${gradient})"/></mask>`;
   const paintedTail=`<g mask="url(#${mask})">${crop(tail,[tailX,tailY,tailW,tailH],'xMidYMid meet')}</g>`;
   body+=paintedTail+`<g transform="translate(${width} 0) scale(-1 1)">${paintedTail}</g>`;
  }
  // Full-height lower enamel, worn gold edging and the original support feet.
  // The central pendant is intentionally omitted; the existing plinth covers it.
  if(layout.mode!=='catalog'){
   const outer=8+tw*.65,centerGap=(d.ornamentW??108)*.40,halfW=width/2-centerGap-outer;
   body+=railHalf([330,565,706,51],outer,halfW,bottom-3);
   body+=railHalf([1226,565,684,51],width/2+centerGap,halfW,bottom-3);
   body+=crop([620,565,350,51],[width/2-centerGap-1,bottom-3,centerGap*2+2,halfW*51/695],'xMidYMid slice');
  }
 }else{
  // The purpose-painted vent band owns the entire upper rail. Keep the source
  // chassis only at the sides and bottom; no old blue rail behind vent pods.
  const q=clamp(d.q||0,0,1),sh=d.shoulderH??(126+56*q),sw=sh*271/361,sx=d.shoulderX??Math.max(7,f[0]-sw+3);
  const outer=sx+sw*.25;
  // The shoulder and navigation panel must share one solid armored body. A
  // broad original vertical chassis section carries worn enamel and rivets
  // through the formerly empty slots; the sculpted shoulders cover its edge.
  const sideX=sx+sw*.48,sideW=Math.max(0,f[0]-sideX+18),sideY=f[1]-4,sideH=f[3]+12;
  if(sideW>0){
   const side=crop([174,302,111,328],[sideX,sideY,sideW,sideH],'xMidYMid slice');
   body+=side+`<g transform="translate(${width} 0) scale(-1 1)">${side}</g>`;
  }
  // Original stepped lower chassis; no copied clasp, button or task lettering.
  const centerGap=35;
  const halfW=width/2-centerGap-outer;
  body+=railHalf([250,652,720,61],outer,halfW,bottom-3);
  if(Number.isFinite(d.lowerRailHeight)){
   const railY=bottom-3,railX=width/2+centerGap,terminalW=Math.min(halfW,168*d.lowerRailHeight/61);
   body+=railHalf([1220,652,700,61],railX,halfW-terminalW,railY);
   body+=crop([1920,652,168,61],[railX+halfW-terminalW,railY,terminalW,d.lowerRailHeight],'xMidYMid meet');
  }else body+=railHalf([1220,652,700,61],width/2+centerGap,halfW,bottom-3);
  body+=crop([520,652,280,61],[width/2-centerGap-1,bottom-3,centerGap*2+2,d.lowerRailHeight??halfW*61/710],'xMidYMid slice');
 }
 // Compact geometry owns the phone silhouette. From the first modular width,
 // connecting castings stay present so the growing crown has no exposed cuts.
 const opacity=1;
 const painted=clip([0,0,width,height],body);
 return{defs,body:`<g data-task-bands="${style}" opacity="${opacity}">${painted}</g>`};
}

import { GOTHIC_CATALOG_CORNICE_ART } from './gothic-cornice.mjs';
import { getGothicRibCanopyPose } from './gothic-skeletal-crest.mjs';

/** Small complete skull reliefs sit within the enamel. The architectural
 * rib canopy supplies the larger silhouette and the grip around the cornice. */
export const GOTHIC_SKULL_FRIEZE_ART={
 file:'gothic-cornice-castings-v5.png',size:[1536,1024],
 casts:[{"crop":[99,116,324,384],"face":[99,116,324,384]},{"crop":[1103,117,335,386],"face":[1103,117,335,386],"mirror":true},{"crop":[1103,117,335,386],"face":[1103,117,335,386]}],
 enamel:{blue:[40,111],green:[41,113],violet:[41,113],ember:[40,112]}
};
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function getGothicSkullPlacements(layout){
 if(layout.style!=='gothic'||layout.mode!=='catalog'||!layout.decor?.catalogCrown||layout.width<=622)return[];
 const {width,decor:d}=layout,c=d.catalogCrown,k=c[2]/1395,art=GOTHIC_SKULL_FRIEZE_ART;
 const canopy=getGothicRibCanopyPose(layout),wideScale=1+.18*smooth((width-1040)/560);
 // Whole side-specific castings already cover the front of the cornice.
 // The former small relief row would sit on top of their anatomy.
 const canopyReliefOpacity=canopy?.fullSpan?1-canopy.opacity:1;
 if(canopyReliefOpacity<=.0001)return[];
 const outside=canopy?canopy.drawRect[0]+3:8+d.towerW+8,inside=c[0]-8,available=Math.max(0,inside-outside);
 const railTop=c[1]+206*k,railHeight=112*k,railBottom=railTop+railHeight;
 const row=GOTHIC_CATALOG_CORNICE_ART.rows[layout.theme]||GOTHIC_CATALOG_CORNICE_ART.rows.green;
 const rowScale=railHeight/row[3],inset=art.enamel[layout.theme]||art.enamel.green;
 const openingTop=railTop+inset[0]*rowScale-1,openingBottom=railTop+inset[1]*rowScale-.25;
 const headCenter=(openingTop+openingBottom)/2,maxFaceHeight=Math.min(18.5,openingBottom-openingTop);
 const safeTop=openingTop,safeBottom=openingBottom;
 const units=art.casts.map(({crop,face})=>{
  const faceY=face[1]+face[3]/2-crop[1];
  const scale=Math.min(maxFaceHeight/face[3],18.5/crop[2]);
  return{crop,face,scale,width:crop[2]*scale,height:crop[3]*scale,faceY};
 });
 // Keep the heads between the canopy's front hooks. Whole reliefs fade as
 // their available flat enamel span is exhausted, from the inner head out.
 const outerWidth=Math.max(units[0].width,units[2].width),cellWidths=[outerWidth,units[1].width,outerWidth];
 const outerCenter=['ember','green'].includes(layout.theme)?35:11;
 const centers=[outerCenter,64,135].map(x=>x*wideScale),clearance=6,fadeRoom=14,out=[];
 for(const side of ['left','right']){
  const order=side==='left'?[0,1,2]:[2,1,0];
  for(let index=0;index<order.length;index++){
   const variant=order[index],unit=units[variant],cellWidth=cellWidths[index],center=centers[index];
   const opacity=canopyReliefOpacity*smooth((width-622)/70)*smooth((available-center-cellWidth/2-clearance)/fadeRoom);
   if(opacity<=.0001)continue;
   const cellX=side==='left'?outside+center-cellWidth/2:width-outside-center-cellWidth/2;
   const x=cellX+(cellWidth-unit.width)/2,y=headCenter-unit.faceY*unit.scale;
   const ornamentRect=[x,y,unit.width,unit.height];
   const headRect=[x+(unit.face[0]-unit.crop[0])*unit.scale,y+(unit.face[1]-unit.crop[1])*unit.scale,unit.face[2]*unit.scale,unit.face[3]*unit.scale];
   out.push({side,index,variant,source:unit.crop,faceSource:unit.face,rect:ornamentRect,ornamentRect,headRect,baseRect:headRect,
    opacity,cellWidth,railTop,railBottom,safeTop,safeBottom,maxFaceHeight,
    slot:side==='left'?[outside,openingTop,available,openingBottom-openingTop]:[width-inside,openingTop,available,openingBottom-openingTop]});
  }
 }
 return out;
}

export function renderGothicSkullFrieze(layout,options={}){
 const placements=getGothicSkullPlacements(layout);
 if(!placements.length)return{defs:'',underlay:'',body:''};
 const prefix=String(options.idPrefix||'gothic-skulls').replace(/[^\w-]/g,'-'),art=GOTHIC_SKULL_FRIEZE_ART;
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,''),href=esc(options.resolveAsset?options.resolveAsset(art.file):base+'/'+art.file);
 let defs=`<image id="${prefix}-relief-source" href="${href}" width="${art.size[0]}" height="${art.size[1]}"/>`;
 const pewter=layout.theme==='violet';
 if(pewter)defs+=`<filter id="${prefix}-pewter" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="0 .10 .30 .57 .81 .98 1"/><feFuncG type="table" tableValues="0 .095 .29 .56 .80 .96 .99"/><feFuncB type="table" tableValues="0 .09 .28 .55 .79 .95 .98"/><feFuncA type="identity"/></feComponentTransfer></filter>`;
 const filter=pewter?` filter="url(#${prefix}-pewter)"`:'';
 const castings=placements.map(a=>{
  const r=a.ornamentRect;
  const mirror=art.casts[a.variant].mirror?` transform="translate(${2*a.source[0]+a.source[2]} 0) scale(-1 1)"`:'';
  return`<g data-gothic-skull-relief="${a.side}-${a.index}" data-skull-variant="${a.variant}" opacity="${a.opacity}"><svg x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" viewBox="${a.source.join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><use href="#${prefix}-relief-source"${mirror}/></svg></g>`;
 }).join('');
 return{defs,underlay:'',body:`<g data-gothic-skull-frieze="small-inset-reliefs"${filter}>${castings}</g>`};
}

/** A whole themed finial seats on the crown's existing apex. Its native
 * saddle anchor, rather than its asymmetric crop centre, locates the mount. */
export const GOTHIC_APEX_SKULL_ART={
 file:'gothic-apex-skulls-v11.png',size:[1536,1024],
 casts:{
  blue:{file:'gothic-avian-apex-v12.png',size:[1536,1024],crop:[264,23,867,892],anchor:[718,781],contactRects:[[452,781,255,132],[730,781,257,132]]},
  ember:{crop:[863,26,540,407],anchor:[1133.5,374],contactRects:[[998,374,128,56],[1142,374,130,54]]},
  green:{crop:[209,512,391,453],anchor:[392,907],contactRects:[[267,907,118,56],[400,907,118,54]]},
  violet:{crop:[888,500,368,467],anchor:[1125,907],contactRects:[[997,907,121,56],[1133,907,119,55]]}
 }
};
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const progress=width=>smooth((width-900)/140);

// Native alpha landmarks in catalog-mobile-gothic-*.png. The painted apex is
// left of the crop centre; shoulder seats are four native pixels inside its
// first opaque roof edge, rather than a mirrored transparent bounding box.
export const GOTHIC_CROWN_LANDMARKS={
 blue:{peak:[968.5,18],left:[515,155],right:[1422,156]},
 green:{peak:[970.5,16],left:[515,160],right:[1426,161]},
 ember:{peak:[970,17],left:[515,164],right:[1425,169]},
 violet:{peak:[971,16],left:[515,173],right:[1427,177]}
};
export function getGothicPaintedCrownAnchors(layout){
 const c=layout.decor.catalogCrown,k=c[2]/1395,native=GOTHIC_CROWN_LANDMARKS[layout.theme]||GOTHIC_CROWN_LANDMARKS.green;
 const point=p=>[c[0]+(p[0]-285)*k,c[1]+(p[1]-12)*k];
 return{peak:point(native.peak),left:point(native.left),right:point(native.right),native};
}

/** Translate the completed catalogue composition once. Fresh arrays preserve
 * the Task shell and keep DOM controls, labels, artwork and anchors aligned. */
export function addGothicApexHeadroom(layout){
 if(layout.style!=='gothic'||layout.mode!=='catalog'||layout.composition==='compact'||layout.width<=900)return layout;
 const headroom=38*progress(layout.width);
 const shift=r=>[r[0],r[1]+headroom,r[2],r[3]];
 const rects=Object.fromEntries(Object.entries(layout.rects).map(([key,r])=>[key,shift(r)]));
 const hits=Object.fromEntries(Object.entries(layout.hits).map(([key,r])=>[key,shift(r)]));
 const labels=Object.fromEntries(Object.entries(layout.labels).map(([key,label])=>[key,{...label,rect:shift(label.rect)}]));
 const decor={...layout.decor,apexHeadroom:headroom};
 for(const key of ['frame','crest','back','catalogField','catalogCrown','catalogOpening'])if(Array.isArray(decor[key]))decor[key]=shift(decor[key]);
 for(const key of ['outerY','outerBottom','catalogContentCenter'])if(Number.isFinite(decor[key]))decor[key]+=headroom;
 const height=layout.height+headroom,anchor={...layout.anchor,height};
 for(const key of ['frame','crest','back','theme'])if(Array.isArray(anchor[key]))anchor[key]=shift(anchor[key]);
 for(const key of ['baseline','outerY','outerBottom'])if(Number.isFinite(anchor[key]))anchor[key]+=headroom;
 return{...layout,height,rects,hits,labels,text:labels,decor,anchor};
}

export function getGothicApexSkullPlacement(layout){
 if(layout.style!=='gothic'||layout.mode!=='catalog'||!layout.decor?.catalogCrown||layout.width<=900)return null;
 const art=GOTHIC_APEX_SKULL_ART,theme=art.casts[layout.theme]?layout.theme:'green',cast=art.casts[theme];
 const source=cast.crop,sourceAnchor=cast.anchor,{peak}=getGothicPaintedCrownAnchors(layout);
 const mountOverlap=2,topGuard=4,anchor=[peak[0],peak[1]+mountOverlap];
 const scale=Math.max(0,Math.min(66/source[2],56/source[3],(anchor[1]-topGuard)/(sourceAnchor[1]-source[1])));
 const x=anchor[0]-(sourceAnchor[0]-source[0])*scale,y=anchor[1]-(sourceAnchor[1]-source[1])*scale;
 const rect=[x,y,source[2]*scale,source[3]*scale];
 const contactRects=cast.contactRects.map(r=>[x+(r[0]-source[0])*scale,y+(r[1]-source[1])*scale,r[2]*scale,r[3]*scale]);
 return{theme,source,sourceFile:cast.file||art.file,sourceSize:cast.size||art.size,sourceAnchor,sourceContacts:cast.contactRects,
  rect,drawRect:rect.slice(),anchor,peak,scale,opacity:progress(layout.width),contactRects,mountOverlap,topGuard,
  headroom:layout.decor.apexHeadroom||0};
}

export function renderGothicApexSkull(layout,options={}){
 const placement=getGothicApexSkullPlacement(layout);
 if(!placement||placement.opacity<=.0001)return{defs:'',body:''};
 const prefix=String(options.idPrefix||'gothic-apex').replace(/[^\w-]/g,'-');
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,'');
 const href=esc(options.resolveAsset?options.resolveAsset(placement.sourceFile):base+'/'+placement.sourceFile);
 let defs=`<image id="${prefix}-source" href="${href}" width="${placement.sourceSize[0]}" height="${placement.sourceSize[1]}"/>`;
 const pewter=placement.theme==='violet';
 if(pewter)defs+=`<filter id="${prefix}-pewter" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="0 .10 .30 .57 .81 .98 1"/><feFuncG type="table" tableValues="0 .095 .29 .56 .80 .96 .99"/><feFuncB type="table" tableValues="0 .09 .28 .55 .79 .95 .98"/><feFuncA type="identity"/></feComponentTransfer></filter>`;
 const filter=pewter?` filter="url(#${prefix}-pewter)"`:'',r=placement.rect;
 const body=`<g data-gothic-apex-skull="${placement.theme}" opacity="${placement.opacity}" pointer-events="none" aria-hidden="true"${filter}><svg x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" viewBox="${placement.source.join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><use href="#${prefix}-source"/></svg></g>`;
 return{defs,body};
}

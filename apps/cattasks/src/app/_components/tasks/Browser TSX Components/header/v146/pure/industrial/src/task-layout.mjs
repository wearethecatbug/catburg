import {clamp,mix,smoothstep,makeMeasure,fittedFont,nativeArchGroups} from './layout-utils.mjs';

/** The task heading gets a third line on a narrow plaque instead of tiny type. */
function taskHeading(measure, originalText, preferred, width, height) {
  const text=String(originalText).replace(/\s+/g,' ').trim();
  const available=Math.max(1,width-2),minimum=20,lineRatio=1.12;
  const wrap=size=>{
    const lines=[];
    let line='';
    for(const word of text.split(' ').filter(Boolean)) {
      if(measure(word,size,'title')>available) {
        if(line){lines.push(line);line='';}
        let fragment='';
        for(const character of word) {
          if(fragment && measure(fragment+character,size,'title')>available) {
            lines.push(fragment);fragment='';
          }
          fragment+=character;
        }
        line=fragment;
      } else if(!line || measure(line+' '+word,size,'title')<=available) {
        line=line?line+' '+word:word;
      } else {
        lines.push(line);line=word;
      }
    }
    if(line || !lines.length)lines.push(line);
    return lines;
  };
  const at=size=>{
    const lines=wrap(size),lineHeight=size*(lines.length===3?1.06:lineRatio);
    return lines.length<=3 && lines.length*lineHeight<=height
      ? {lines,fontSize:size,lineHeight,truncated:false}:null;
  };
  let best=at(preferred);
  if(best)return best;
  best=at(minimum);
  if(best) {
    let lo=minimum,hi=preferred;
    for(let i=0;i<18;i++){
      const size=(lo+hi)/2,candidate=at(size);
      if(candidate){lo=size;best=candidate;}else hi=size;
    }
    return best;
  }
  // A custom title can exceed even three readable lines. Keep its full string
  // in aria-label while shortening the final visible line, never the font.
  const lineHeight=minimum*1.06,maxLines=Math.max(1,Math.min(3,Math.floor(height/lineHeight)));
  const lines=wrap(minimum).slice(0,maxLines);
  let last=lines[lines.length-1] || '';
  while(last && measure(last+'…',minimum,'title')>available)last=last.slice(0,-1);
  lines[lines.length-1]=last.trimEnd()+'…';
  return {lines,fontSize:minimum,lineHeight,truncated:true};
}

/** The source PNG uses asymmetric top/bottom slopes. These contours are in
 * source pixels relative to its visible [78,132,2014,437] rectangle. */
function taskPlaqueInterior(rect) {
  const [x,y,w,h]=rect,s=h/437;
  return [[x+186*s,y+64*s],[x+w-186*s,y+64*s],
    [x+w-77*s,y+188*s],[x+w-189*s,y+372*s],
    [x+189*s,y+372*s],[x+77*s,y+188*s]];
}
function taskVentOpening(frame,mirror=false) {
  const [x,y,w,h]=frame,s=h/379;
  const points=[[x+106*s,y+70*s],[x+w-395*s,y+70*s],
    [x+w-225*s,y+312*s],[x+106*s,y+312*s],
    [x+82*s,y+284*s],[x+82*s,y+98*s]];
  return mirror?points.map(([px,py])=>[2*x+w-px,py]):points;
}
function taskBounds(points) {
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const x=Math.min(...xs),y=Math.min(...ys);
  return [x,y,Math.max(...xs)-x,Math.max(...ys)-y];
}

/**
 * One utility rail contains All tasks and the theme socket. The title plaque
 * owns its two angular navigation sectors. From1120to1600 the rail receives
 * its own restrained desktop proportions; the title, text and navigation are
 * never scaled with the viewport. Arches always retain their source aspect.
 */
export function getIndustrialLayout(width, options={}) {
  const mode=options.mode==='catalog'?'catalog':'task',catalog=mode==='catalog';
  const value=Number(width);
  const availableWidth=clamp(Number.isFinite(value)?value:288,288,1600);
  const W=availableWidth,t=clamp((W-288)/832,0,1);
  const desktopProgress=smoothstep((W-1120)/480);
  // Compact headers keep their two useful rows, but drop the spare height
  // formerly reserved for the Catalog rune stripe. Both page envelopes use
  // this same progression, so switching pages never shifts the lower beam.
  const mobileCompact=1-smoothstep((W-430)/192);
  const shoulderReveal=smoothstep((W-1120)/240);
  const sideInset=clamp(8+(W-288)/35.5,8,12);
  const titleInset=clamp(4+(W-288)/52,4,12);
  const plaqueNarrowing=smoothstep((W-620)/220);
  const bodyDescent=smoothstep((W-940)/160);
  const typography=smoothstep((W-430)/530);
  const bodyHeight=mix(44,64,desktopProgress),beamHeight=mix(12,14,desktopProgress);
  const backHeight=mix(52,70,desktopProgress),navSize=64;
  const titleWidth=Math.min(W-2*titleInset,560);
  const titleHeight=mix(124,100,plaqueNarrowing)-20*mobileCompact;
  // The upper rail and title share this joint throughout the stacked range.
  // Width changes reveal the shoulders horizontally; they do not open an
  // extra vertical row between the rail and the title at tablet widths.
  const titleY=52;
  const title=[(W-titleWidth)/2,titleY,titleWidth,titleHeight];
  const titleInterior=taskPlaqueInterior(title);
  const plaqueBottom=titleY+titleHeight;
  const bodyBottom=mix(52,plaqueBottom,bodyDescent);
  const body=[sideInset,bodyBottom-bodyHeight,W-2*sideInset,bodyHeight];
  const beam=[0,plaqueBottom,W,beamHeight];

  const regularBackWidth=mix(clamp(128+(W-360)*.06,128,172),230,desktopProgress);
  const backWidth=mix(regularBackWidth,clamp(96+(W-288)*8/142,96,104),mobileCompact);
  const back=[sideInset,bodyBottom-backHeight,backWidth,backHeight];
  const backHit=[...back];
  const regularCrestWidth=mix(clamp(96+(W-360)*.10,92,140),180,desktopProgress);
  const crestWidth=mix(regularCrestWidth,clamp(72+(W-288)*20/142,72,92),mobileCompact);
  const crestHeight=crestWidth/3.324,crestOverlap=4;
  // While the utility rail is above the title, its center owns the eagle.
  // Interpolate from this fixed rail position only once as the rail descends.
  const stackedCrestY=52-bodyHeight/2-crestHeight/2;
  const wideCrestY=titleY+crestOverlap-crestHeight;
  const crest=[W/2-crestWidth/2,mix(stackedCrestY,wideCrestY,bodyDescent),crestWidth,crestHeight];

  // The desktop terminal is the original diagonal armor PNG, at its native
  // visible1338:553 ratio. Its common inner area safely contains a44px target.
  // At smaller widths it is unpainted and the established compact socket stays
  // exactly where it was. One opaque shell changes contour beneath the sigil.
  const armorWidth=bodyHeight*1338/553;
  const rightArmorCap=[body[0]+body[2]-armorWidth,body[1],armorWidth,bodyHeight];
  const armorThemeCenterX=rightArmorCap[0]+rightArmorCap[2]*.485;
  const themeSocket=[mix(W-sideInset-52,armorThemeCenterX-26,desktopProgress),body[1],52,bodyHeight];
  const theme=[themeSocket[0]+4,themeSocket[1]+(bodyHeight-44)/2,44,44];
  const themeArt=[theme[0]+10,theme[1]+10,24,24];
  const [sx,sy,sw,sh]=themeSocket;
  const themeSocketPolygon=[[sx+6,sy],[sx+sw-8,sy],[sx+sw,sy+8],
    [sx+sw,sy+sh-8],[sx+sw-8,sy+sh],[sx+6,sy+sh],[sx,sy+sh-6],[sx,sy+6]];
  const endArmor=[...themeSocket];
  // Eight dominant corners measured from the original PNG alpha boundary,
  // relative to its visible[207,167,1338,553] region. A single opaque shell
  // interpolates to this contour; materials must not expose arches through it.
  const armorSourceOutline=[[27,2],[846,2],[1336,499],[1336,520],
    [1304,551],[490,551],[1,50],[1,28]];
  const terminalOriginalOutline=armorSourceOutline.map(([px,py])=>
    [rightArmorCap[0]+px*armorWidth/1338,rightArmorCap[1]+py*bodyHeight/553]);
  const terminalOutline=themeSocketPolygon.map(([px,py],index)=>
    [mix(px,terminalOriginalOutline[index][0],desktopProgress),
      mix(py,terminalOriginalOutline[index][1],desktopProgress)]);
  // Preserve the rectangular base at1120, then bring its right edge onto the
  // same shell contour. The compact8px corner backing withdraws early, so a
  // gray triangle cannot stick out beyond the desktop armor's upper slope.
  const cornerBacking=8*(1-smoothstep(desktopProgress/.25));
  const upperBacking=Math.min(cornerBacking,terminalOutline[2][0]-terminalOutline[1][0]);
  const lowerBacking=Math.min(cornerBacking,terminalOutline[3][0]-terminalOutline[4][0]);
  const railOutline=[[body[0],body[1]],
    [terminalOutline[1][0]+upperBacking,terminalOutline[1][1]],
    [...terminalOutline[2]],[...terminalOutline[3]],
    [terminalOutline[4][0]+lowerBacking,terminalOutline[4][1]],
    [body[0],body[1]+body[3]]];

  // Fill the FULL interior of each source frame. Foreground plaque/control
  // faces occlude underlying arches. No independent rectangular trim can
  // create a dark seam at a sloping inner corner or beside the Back button.
  // Reveal the source frame's sloping inner braces before the desktop size is
  // fully reached. Their ends sit under the title's lower metal corners. The
  // far-right frame ends under the common solid part of the terminal armor,
  // preventing a green triangular remnant beyond its diagonal edge.
  const crestRoom=smoothstep((W-430)/100);
  const stackedFrameEnd=mix(W/2+4,W/2-crestWidth/2-8,crestRoom);
  const leftFrameEnd=mix(stackedFrameEnd,title[0]+36,shoulderReveal);
  const rightFrameStart=W-leftFrameEnd;
  const rightFrameEnd=mix(body[0]+body[2],rightArmorCap[0]+armorWidth*.50,desktopProgress);
  const ventLeft=[body[0],body[1],leftFrameEnd-body[0],bodyHeight];
  const ventRight=[rightFrameStart,body[1],rightFrameEnd-rightFrameStart,bodyHeight];
  const cavities={left:taskVentOpening(ventLeft),right:taskVentOpening(ventRight,true)};
  const leftField=taskBounds(cavities.left),rightField=taskBounds(cavities.right);
  const openingY=leftField[1],openingHeight=leftField[3];
  const native=nativeArchGroups(leftField[0],leftField[0]+leftField[2],
    rightField[0],rightField[0]+rightField[2],openingY,openingHeight);
  const {arches,archGap,archWidth,archWidths,archHeight,archGroupWidth}=native;

  // Both navigation faces are actual ends of the title plaque. A 64px hit
  // sector includes the outer rim, while artwork follows the inner contour.
  const [tx,ty,tw,th]=title,ts=th/437;
  const upper=ty+64*ts,lower=ty+372*ts;
  const dividerTop=tx+64,dividerBottom=tx+60;
  const previousPolygon=[[tx+186*ts,upper],[dividerTop,upper],
    [dividerBottom,lower],[tx+189*ts,lower],[tx+77*ts,ty+188*ts]];
  const previousHitPolygon=[[tx+158*ts,ty],[tx+64,ty],
    [tx+64,ty+th],[tx+158*ts,ty+th],[tx,ty+181*ts]];
  const mirror=points=>points.map(([px,py])=>[2*tx+tw-px,py]);
  const previous=[tx,ty,64,th],next=[tx+tw-64,ty,64,th];
  const navigation={
    previous:{polygon:previousPolygon,separator:[[dividerTop,upper],[dividerBottom,lower]],hitPolygon:previousHitPolygon},
    next:{polygon:mirror(previousPolygon),separator:mirror([[dividerTop,upper],[dividerBottom,lower]]),hitPolygon:mirror(previousHitPolygon)}
  };
  const arrowSize=24,arrowCenterX=tx+40,arrowCenterY=(upper+lower)/2;
  const arrowPrevious=[arrowCenterX-arrowSize/2,arrowCenterY-arrowSize/2,arrowSize,arrowSize];
  const arrowNext=[2*tx+tw-arrowCenterX-arrowSize/2,arrowCenterY-arrowSize/2,arrowSize,arrowSize];

  const copyX=tx+68,copyWidth=tw-136;
  const numberFont=14,numberHeight=16,copyGap=3;
  const titleText=options.title==null?(catalog?'All tasks':'Reverse a String'):String(options.title);
  const taskNumber=options.taskNumber==null?1:options.taskNumber;
  const numberText=`TASK ${typeof taskNumber==='number'?String(taskNumber).padStart(2,'0'):String(taskNumber)}`;
  const measure=makeMeasure(options);
  const heading=taskHeading(measure,titleText,mix(22,32,typography),copyWidth,
    lower-upper-(catalog?0:numberHeight+copyGap)-4);
  const headingHeight=heading.lines.length*heading.lineHeight;
  const copyHeight=(catalog?0:numberHeight+copyGap)+headingHeight;
  const copyTop=(upper+lower-copyHeight)/2;
  const numberLabelRect=[copyX,copyTop,copyWidth,numberHeight];
  const titleLabelRect=[copyX,copyTop+(catalog?0:numberHeight+copyGap),copyWidth,headingHeight];

  const arrowSectionWidth=mix(34,44,desktopProgress),backArrowGap=mix(5,6,desktopProgress);
  const backInset=mix(14,18,desktopProgress),backArrowSize=mix(20,24,desktopProgress);
  const backSection=[back[0],back[1],arrowSectionWidth,backHeight];
  const backDivider=[back[0]+arrowSectionWidth-4,back[1]+7,8,backHeight-14];
  const backHousingScale=.11,backGlyphInset=3.5;
  const backFaceTop=back[1]+90*backHousingScale;
  const backFaceBottom=back[1]+backHeight-132*backHousingScale;
  const backFaceCenter=(backFaceTop+backFaceBottom)/2;
  const backArrow=[back[0]+110*backHousingScale+backGlyphInset-backArrowSize*4/24,
    backFaceCenter-backArrowSize/2,backArrowSize,backArrowSize];
  const backLabelRect=[back[0]+arrowSectionWidth+backArrowGap,backFaceTop,
    backWidth-arrowSectionWidth-backArrowGap-backInset,backFaceBottom-backFaceTop];
  const fullBackLabel=options.backLabel==null?(catalog?'Back to task':'All tasks'):String(options.backLabel);
  const compactBackLabel=options.compactBackLabel==null?'Back':String(options.compactBackLabel);
  const compactBack=W<=430||measure(fullBackLabel,16,'back')>backLabelRect[2]-2;
  const visibleBackLabel=compactBack?compactBackLabel:fullBackLabel;
  const backFont=fittedFont(measure,visibleBackLabel,mix(16,21,desktopProgress),backLabelRect[2],16,'back');

  return {
    mode,shell:'industrial-shared',width:W,availableWidth,height:plaqueBottom+beamHeight,t,extra:0,
    anchor:{width:W,height:plaqueBottom+beamHeight,beam:[...beam],baseline:beam[1],centerAxis:W/2,crestAxis:W/2},
    layoutMode:bodyDescent===0?'stacked':bodyDescent===1?'single':'reflowing',
    transitions:{plaqueNarrowing,slotMove:bodyDescent,bodyDescent,crestLift:1,utilityToSingleRow:bodyDescent,desktop:desktopProgress,shoulderReveal,mobileCompact},
    metrics:{housingScale:.11,navigationInset:0,bodyHeight,beamHeight,navSize,backHeight,
      minimumTitleFont:20,navigationIntegrated:true,crestOverlap,desktopProgress,armorVisibility:desktopProgress,mobileCompact},
    rects:{title,back,body,beam,crest,theme,themeArt,themeSocket,backArrow,backSection,backDivider,
      ...(!catalog?{arrowPrevious,arrowNext}:{}),previousFace:previous,nextFace:next,endArmor,rightArmorCap,ventLeft,ventRight},
    hits:{back:backHit,theme,...(!catalog?{previous,next}:{})},
    titleInterior,navigation,themeSocketPolygon,terminalOutline,terminalOriginalOutline,railOutline,
    labels:{
      title:{rect:titleLabelRect,text:titleText,accessibleText:titleText,fontSize:heading.fontSize,
        lines:heading.lines,lineHeight:heading.lineHeight,truncated:heading.truncated},
      ...(!catalog?{number:{rect:numberLabelRect,text:numberText,lines:[numberText],fontSize:numberFont,lineHeight:16}}:{}),
      back:{rect:backLabelRect,text:visibleBackLabel,lines:[visibleBackLabel],fontSize:backFont,
        lineHeight:backFont*1.12,accessibleText:fullBackLabel,compact:compactBack}
    },
    arches,cavities,
    fields:{opening:[body[0],openingY,body[2],openingHeight],left:leftField,right:rightField},
    fonts:{title:heading.fontSize,number:numberFont,back:backFont},
    titleWidth,titleHeight,backWidth,backHeight,bodyHeight,bodyBottom,
    beamY:plaqueBottom,beamHeight,crestWidth,crestOverlap,archWidth,archWidths,archHeight,archGap,archGroupWidth,
    innerSlopeReserve:bodyHeight*(430/379)+2,archCountPerSide:native.archCountPerSide,sideInset,
    fullBackLabel,visibleBackLabel,compactBack,desktopProgress,shoulderReveal,armorVisibility:desktopProgress,showTheme:options.showTheme!==false
  };
}

/** Task-only entry point. Catalog shares its envelope, beam and center axis
 * while composing its own title, return plaque and engraved rune joints. */
export function getTaskLayout(width, options={}) {
  return getIndustrialLayout(width, { ...options, mode: 'task' });
}

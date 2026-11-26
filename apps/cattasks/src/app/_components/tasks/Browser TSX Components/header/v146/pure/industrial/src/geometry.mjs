import {clamp,mix,smoothstep,makeMeasure,nativeArchGroups,fittedFont} from './layout-utils.mjs';
import {getTaskLayout} from './task-layout.mjs';
export {getTaskLayout};

// The opening follows the original PNG, including its sloping inner end.
// Coordinates are tied to the very same 379-unit-high caps used by render.mjs.
function catalogVentOpening(frame, mirror=false) {
  const [x,y,w,h]=frame,s=h/379;
  const points=[
    [x+106*s,y+70*s],[x+w-395*s,y+70*s],
    [x+w-225*s,y+312*s],[x+106*s,y+312*s],
    [x+82*s,y+284*s],[x+82*s,y+98*s]
  ];
  return mirror?points.map(([px,py])=>[2*x+w-px,py]):points;
}
function catalogOpeningBounds(points) {
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const x=Math.min(...xs),y=Math.min(...ys);
  return [x,y,Math.max(...xs)-x,Math.max(...ys)-y];
}

/** Catalog has its own two plaques and engraved lower joints. The Task beam
 * and outer envelope are the common architectural anchor; page-specific
 * crowns and controls are free to compose themselves above that support. */
export function getCatalogLayout(width, options = {}) {
  const numericWidth=Number(width);
  const availableWidth=clamp(Number.isFinite(numericWidth)?numericWidth:288,288,1600);
  const anchorLayout=getTaskLayout(availableWidth,options);
  const W=anchorLayout.width,measure=makeMeasure(options);
  const t=clamp((W-288)/832,0,1);
  // The center is always one rail deep. Plaques share its lower support until
  // their preferred windows run out of horizontal room; exposed side faces
  // receive rune clusters only as those plaques rise.
  const desktopProgress=smoothstep((availableWidth-1120)/480);
  const mobileCompact=anchorLayout.metrics.mobileCompact;
  const sideInset=anchorLayout.sideInset,ventHeight=mix(44,64,desktopProgress);
  const beam=[...anchorLayout.rects.beam],beamY=beam[1],beamHeight=beam[3];
  const runeBandHeight=0;
  const bodyHeight=ventHeight;
  const bodyY=beamY-bodyHeight;
  const titleText=options.title==null?'All tasks':String(options.title);
  const fullBackLabel=options.backLabel==null?'Back to task':String(options.backLabel);
  const compactBackLabel=options.compactBackLabel==null?'Back':String(options.compactBackLabel);
  const showTheme=options.showTheme!==false;
  const titleFont=clamp(20+(W-288)*14/832,20,34)+2*desktopProgress;
  const titleInset=16;
  const normalTitleWidth=Math.max(measure('All tasks',titleFont,'title')+2*titleInset+2,
    clamp(130+(W-320)*.17,130,260)+64*desktopProgress);
  // The left plaque is one housing containing Back and its theme socket.
  // Recover only2px of the narrowest inter-control gap; all broader geometry
  // keeps the existing12px spacing. No label is reduced below16px.
  const controlGap=showTheme?clamp(10+(W-288)/16,10,12):12;
  const minimumBackWidth=showTheme?Math.max(126,34+4+50+2+measure('Back',16,'back')+2):126;
  const titleWidth=Math.min(normalTitleWidth,W-2*sideInset-controlGap-minimumBackWidth);
  const titleHeight=56+8*clamp((W-680)/440,0,1)+12*desktopProgress;
  const backWidth=Math.min(Math.max(minimumBackWidth,clamp(156+(W-320)*.105,126,240)+54*desktopProgress),W-2*sideInset-titleWidth-controlGap);
  const backHeight=52+4*clamp((W-800)/320,0,1)+14*desktopProgress;
  const crestWidth=88+52*clamp((W-430)/690,0,1)+40*desktopProgress,crestHeight=crestWidth/3.324;
  const crestX=(W-crestWidth)/2;
  const crestGap=6;
  const leftFrameEnd=crestX-crestGap;
  const rightFrameStart=crestX+crestWidth+crestGap;
  const connectorClearance=12;
  const wideLeftStart=sideInset+backWidth+connectorClearance;
  const wideRightEnd=W-sideInset-titleWidth-connectorClearance;
  // Keep complete metal caps and a physical gap around both wings. The
  // single-height rail meets the shared beam at every width.
  const sideRoom=Math.min(leftFrameEnd-wideLeftStart,wideRightEnd-rightFrameStart);
  const compactVentWidth=110;
  const preferredVentWidth=204+120*desktopProgress;
  // Use the unsqueezed window requirement, not the already-clamped width.
  // Both plaques rise together when the tighter side loses its 12px joint.
  // A 2px overscan starts the movement before that joint is consumed; the
  // windows keep shrinking safely until their 110px minimum is reached.
  const collisionOverscan=2;
  const collisionDeficit=preferredVentWidth+collisionOverscan-sideRoom;
  const collisionSpan=preferredVentWidth-compactVentWidth+collisionOverscan;
  const collisionRise=smoothstep(collisionDeficit/collisionSpan);
  const inlineProgress=1-collisionRise;
  const railRise=inlineProgress,slotMove=inlineProgress;
  const loweredBaseline=beamY,raisedBaseline=Math.max(bodyY,32+titleHeight);
  const baseline=mix(loweredBaseline,raisedBaseline,collisionRise);
  const plaqueLift=loweredBaseline-baseline;
  // Move the complete plaques without reflecting their art or internal order.
  // All labels, the return arrow and its theme socket derive from these anchors.
  const title=[W-sideInset-titleWidth,baseline-titleHeight,titleWidth,titleHeight];
  const back=[sideInset,baseline-backHeight,backWidth,backHeight];
  const body=[sideInset,bodyY,W-2*sideInset,bodyHeight];
  const crest=[crestX,bodyY+(ventHeight-crestHeight)/2,crestWidth,crestHeight];
  const outerRoom=Math.min(leftFrameEnd-sideInset,W-sideInset-rightFrameStart);
  // Window width can grow; the source arch keeps its aspect and shares the
  // Task rail's decorative scale. The final slice is clipped by the opening.
  const ventWidth=Math.min(preferredVentWidth,outerRoom,Math.max(compactVentWidth,sideRoom));
  const ventLeft=[leftFrameEnd-ventWidth,bodyY,ventWidth,ventHeight];
  const ventRight=[rightFrameStart,bodyY,ventWidth,ventHeight];
  const cavities={left:catalogVentOpening(ventLeft),right:catalogVentOpening(ventRight,true)};
  const leftField=catalogOpeningBounds(cavities.left),rightField=catalogOpeningBounds(cavities.right);
  const leftStart=leftField[0],leftEnd=leftStart+leftField[2];
  const rightStart=rightField[0],rightEnd=rightStart+rightField[2];
  const openingY=leftField[1],openingHeight=leftField[3];
  const native=nativeArchGroups(leftStart,leftEnd,rightStart,rightEnd,openingY,openingHeight);
  // Straight inner ends underlap the beveled PNG corners. 8.5px stays outside
  // the arch cavity, whose nearest inner edge is82/379 of the rail height.
  const connectorUnderlap=8.5*ventHeight/44;
  const leftSupportY=Math.min(bodyY,back[1]+back[3])-.5;
  const rightSupportY=Math.min(bodyY,title[1]+title[3])-.5;
  const connectorLeft=[body[0],leftSupportY,Math.max(0,ventLeft[0]-body[0]+connectorUnderlap),beamY+.5-leftSupportY];
  const connectorRight=[ventRight[0]+ventRight[2]-connectorUnderlap,rightSupportY,
    Math.max(0,body[0]+body[2]-(ventRight[0]+ventRight[2]-connectorUnderlap)),beamY+.5-rightSupportY];
  // The title PNG has two feet below its continuous lower belt. Back those
  // transparent source pixels with an iron seat, without moving the label.
  const titleBeltBottom=title[1]+(550-103)*titleHeight/506;
  const seatTop=Math.min(bodyY,titleBeltBottom-1.5);
  const seatBottom=Math.min(bodyY+1,title[1]+title[3]+1);
  const titleSeat=[title[0]+2,seatTop,titleWidth-4,seatBottom-seatTop];
  const themeSocket=[back[0]+backWidth-50,back[1],50,backHeight];
  const theme=[back[0]+backWidth-48,back[1]+(backHeight-44)/2,44,44];
  const themeDivider=[themeSocket[0]-1,back[1]+7,2,backHeight-14];
  const arrowSectionWidth=mix(34,44,desktopProgress),arrowSize=mix(20,24,desktopProgress),arrowGap=showTheme?4:6,backInset=14;
  const backSection=[back[0],back[1],arrowSectionWidth,backHeight];
  const backDivider=[back[0]+arrowSectionWidth-4,back[1]+7,8,backHeight-14];
  // Centre copy in the housing's red cavity, whose lower metal foot is thicker.
  // The 24-unit arrow's stroked tip is at x=4, not at its SVG box's left edge.
  const backHousingScale=.11,backGlyphInset=3.5;
  const backFaceTop=back[1]+90*backHousingScale;
  const backFaceBottom=back[1]+backHeight-132*backHousingScale;
  const backFaceCenter=(backFaceTop+backFaceBottom)/2;
  const backArrow=[back[0]+110*backHousingScale+backGlyphInset-arrowSize*4/24,
    backFaceCenter-arrowSize/2,arrowSize,arrowSize];
  const themeArt=[theme[0]+10,backFaceCenter-12,24,24];
  const backHit=showTheme?[back[0],back[1],backWidth-50,backHeight]:[...back];
  const backLabelRight=showTheme?themeSocket[0]-2:back[0]+backWidth-backInset;
  const backLabelRect=[back[0]+arrowSectionWidth+arrowGap,backFaceTop,
    backLabelRight-back[0]-arrowSectionWidth-arrowGap,backFaceBottom-backFaceTop];
  const compactBack=W<=430||measure(fullBackLabel,16,'back')>backLabelRect[2]-2;
  let visibleBackLabel=compactBack?compactBackLabel:fullBackLabel;
  if(measure(visibleBackLabel,16,'back')>backLabelRect[2]-2){
    while(visibleBackLabel.length && measure(visibleBackLabel+'…',16,'back')>backLabelRect[2]-2)visibleBackLabel=visibleBackLabel.slice(0,-1);
    visibleBackLabel=visibleBackLabel.trimEnd()+'…';
  }
  const titleLabelRect=[title[0]+titleInset,title[1]+titleHeight*.08,titleWidth-2*titleInset,titleHeight*.72];
  const backFont=fittedFont(measure,visibleBackLabel,mix(16,21,desktopProgress),backLabelRect[2],16,'back');
  let visibleTitle=titleText;
  if(measure(visibleTitle,titleFont,'title')>titleLabelRect[2]-2){
    while(visibleTitle.length && measure(visibleTitle+'…',titleFont,'title')>titleLabelRect[2]-2)visibleTitle=visibleTitle.slice(0,-1);
    visibleTitle+='…';
  }
  return {
    mode:'catalog',shell:'industrial-catalog-anchored',width:W,availableWidth,height:anchorLayout.height,t,extra:0,
    anchor:{width:W,height:anchorLayout.height,beam:[...beam],baseline:beamY,centerAxis:W/2,crestAxis:W/2},
    arrangement:railRise===0?'stacked':railRise===1?'inline':'reflow',
    transitions:{slotMove,railRise,inlineProgress,collisionRise,sideRoom,desktop:desktopProgress,mobileCompact},
    metrics:{housingScale:.11,navigationInset:0,themeIntegrated:showTheme,bodyHeight,ventHeight,beamHeight,desktopProgress,mobileCompact,runeBandHeight,plaqueLift,
      collisionRise,inlineProgress,collisionOverscan,collisionDeficit,collisionSpan,preferredVentWidth,compactVentWidth,loweredBaseline,raisedBaseline,plaqueBaseline:baseline},
    rects:{title,back,body,beam,crest,theme,themeArt,themeSocket,themeDivider,backArrow,backSection,backDivider,ventLeft,ventRight,connectorLeft,connectorRight,titleSeat},
    hits:{back:backHit,...(showTheme?{theme}:{})},
    labels:{
      title:{rect:titleLabelRect,fontSize:titleFont,text:titleText,accessibleText:titleText,
        lines:[visibleTitle],lineHeight:titleFont*1.12,truncated:visibleTitle!==titleText},
      back:{rect:backLabelRect,fontSize:backFont,text:visibleBackLabel,accessibleText:fullBackLabel,
        compact:compactBack,lines:[visibleBackLabel],lineHeight:backFont*1.12},
    },
    ...native,
    cavities,
    fields:{opening:[body[0],openingY,body[2],openingHeight],left:leftField,right:rightField},
    fonts:{title:titleFont,back:backFont},titleWidth,titleHeight,backWidth,backHeight,
    bodyHeight,ventHeight,beamY,beamHeight,crestWidth,crestGap,connectorClearance,connectorUnderlap,sideInset,
    fullBackLabel,visibleBackLabel,compactBack,showTheme,controlGap,desktopProgress
  };
}

export default getCatalogLayout;

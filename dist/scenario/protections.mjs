import * as THREE from 'three';
import {printedMaterial,resinMaterial} from './printed-material.mjs?v=20261007-ws-status1';
import {interventions,surfaceHeight,clamp,bounds} from './model.mjs?v=20261010-footprint1';
import {siteMoved} from './render-policy.mjs?v=20261007-ws-status1';
import {createContactLight} from './contact-light.mjs?v=20261010-footprint1';

export function protectionAnchor(id,location) {
  const index=interventions.findIndex(i=>i.id===id),angle=-2.65+index*Math.PI*2/5;
  return {x:clamp(location.x+1.55*Math.cos(angle),-bounds.width/2+.55,bounds.width/2-.55),z:clamp(location.z+1.55*Math.sin(angle),-bounds.depth/2+.55,bounds.depth/2-.55)};
}

function symbolTexture(symbol) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.strokeStyle='#f5fff6';ctx.lineWidth=7;ctx.lineCap='round';ctx.lineJoin='round';
  if(symbol==='water') {
    ctx.beginPath();ctx.moveTo(64,17);ctx.bezierCurveTo(58,39,29,58,29,79);ctx.bezierCurveTo(29,119,99,119,99,79);ctx.bezierCurveTo(99,58,70,39,64,17);ctx.closePath();ctx.stroke();
  } else if(symbol==='leaf') {
    ctx.beginPath();ctx.moveTo(101,24);ctx.bezierCurveTo(22,14,20,87,48,96);ctx.bezierCurveTo(88,106,109,62,101,24);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(23,112);ctx.lineTo(83,46);ctx.stroke();
  } else if(symbol==='wind') {
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(18,36+i*28);ctx.lineTo(97-i*9,36+i*28);ctx.stroke();}
  } else if(symbol==='monitor') {
    for(let i=0;i<3;i++)ctx.strokeRect(25+i*29,80-i*20,13,30+i*20);
  } else {
    ctx.beginPath();ctx.ellipse(64,35,37,13,0,0,Math.PI*2);ctx.moveTo(27,35);ctx.lineTo(27,90);ctx.ellipse(64,90,37,13,0,Math.PI,0,true);ctx.lineTo(101,35);ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function createAttachedProtections(scene) {
  let visible=true,previousLocation;
  const cylinders=interventions.map(i=>{
    const group=new THREE.Group();group.userData.protection=i.id;scene.add(group);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.43,.46,.07,48),printedMaterial('#d5dedb',{transparent:true}));
    base.position.y=.035;base.receiveShadow=true;group.add(base);
    const bodyMaterial=resinMaterial(i.color,{transparent:true,emissiveIntensity:.2});
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.4,.43,.24,32),bodyMaterial);body.receiveShadow=true;group.add(body);
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,.025,32),resinMaterial(i.color,{transparent:true,emissiveIntensity:.4}));group.add(lid);
    const icon=new THREE.Mesh(new THREE.PlaneGeometry(.42,.42),new THREE.MeshBasicMaterial({map:symbolTexture(i.symbol),transparent:true,depthWrite:false,toneMapped:false}));
    icon.rotation.x=-Math.PI/2;group.add(icon);
    const contact=createContactLight(scene,i.color);
    const outline=new THREE.Group();group.add(outline);
    const dashed=new THREE.LineDashedMaterial({color:i.color,dashSize:.065,gapSize:.045,transparent:true,opacity:.7,depthWrite:false});
    for(const [y,radius] of [[.07,.43],[.31,.4]]) {
      const points=Array.from({length:97},(_,n)=>{const a=n*Math.PI*2/96;return new THREE.Vector3(Math.cos(a)*radius,y,Math.sin(a)*radius);});
      const ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),dashed);ring.computeLineDistances();outline.add(ring);
    }
    const rails=[];
    for(let n=0;n<6;n++){const a=n*Math.PI/3;rails.push(new THREE.Vector3(Math.cos(a)*.43,.07,Math.sin(a)*.43),new THREE.Vector3(Math.cos(a)*.4,.31,Math.sin(a)*.4));}
    const sides=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rails),dashed);sides.computeLineDistances();outline.add(sides);
    const shell=new THREE.Mesh(new THREE.CylinderGeometry(.4,.43,.24,48,1,true),new THREE.MeshBasicMaterial({color:i.color,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
    shell.position.y=.19;outline.add(shell);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(65*3),3));
    const link=new THREE.Line(geometry,new THREE.LineDashedMaterial({color:i.color,dashSize:.14,gapSize:.08,transparent:true,opacity:.65,depthWrite:false}));
    link.renderOrder=6;scene.add(link);
    return {id:i.id,group,base,body,lid,icon,outline,contact,link,funded:0,requested:false,anchor:{x:0,z:0}};
  });
  function applyVisibility() {for(const p of cylinders){p.group.visible=p.link.visible=visible&&p.requested;p.contact.update(p.anchor,p.funded,visible&&p.requested);}}
  return {
    update(result) {
      const moved=siteMoved(previousLocation,result.location);
      for(const p of cylinders) {
        if(moved) {
        const anchor=protectionAnchor(p.id,result.location);
        p.anchor=anchor;
        const floor=Math.max(...[[0,0],[-.3,-.3],[.3,.3],[-.3,.3],[.3,-.3]].map(([x,z])=>surfaceHeight(anchor.x+x,anchor.z+z)))+.06;
        p.group.position.set(anchor.x,floor,anchor.z);
        const positions=p.link.geometry.attributes.position;
        for(let j=0;j<positions.count;j++) {
          const t=.3+.55*j/(positions.count-1),x=result.location.x+(anchor.x-result.location.x)*t,z=result.location.z+(anchor.z-result.location.z)*t;
          positions.setXYZ(j,x,surfaceHeight(x,z)+.16,z);
        }
        positions.needsUpdate=true;p.link.computeLineDistances();p.link.geometry.computeBoundingSphere();
        }
        p.funded=result.strength[p.id];p.requested=result.funding.allocations[p.id].requested;
        const empty=p.funded===0,height=empty?.24:.24*p.funded;
        p.body.scale.y=height/.24;p.body.position.y=.07+height/2;
        p.lid.position.y=.07+height+.0125;p.icon.position.y=.07+height+.027;
        p.outline.visible=p.funded<1;
        p.body.material.emissiveIntensity=empty?0:.2;p.lid.material.emissiveIntensity=empty?0:.4;
        for(const part of [p.base,p.body,p.lid]){part.material.opacity=empty?.12:1;part.material.depthWrite=!empty;}
        p.icon.material.opacity=empty?.2:.4+.6*p.funded;p.link.material.opacity=empty?.25:.3+.4*p.funded;
      }
      previousLocation={...result.location};
      applyVisibility();
    },
    setVisible(value){visible=value;applyVisibility();}
  };
}

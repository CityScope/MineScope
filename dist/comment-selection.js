/* Keep a selected comment tied to its map location and detail panel. */
(() => {
  'use strict';
  const shell=document.querySelector('.map-shell');
  const inspector=document.querySelector('#inspector');
  const mapElement=document.querySelector('#map');
  const colors={concerned:'#dc947e',hopeful:'#82b9a7',mixed:'#d6ba7e',neutral:'#8faebd'};
  const moving=new Set();
  let marker=null,currentId=null,comment=null,frame=0,highlightedText=null;

  shell.insertAdjacentHTML('beforeend',`<svg class="comment-connector" aria-hidden="true" focusable="false" hidden>
    <defs><clipPath id="comment-map-clip"><rect/></clipPath></defs>
    <g clip-path="url(#comment-map-clip)">
      <path class="comment-connector-outline"/>
      <path class="comment-connector-line"/>
      <circle class="comment-connector-end" r="4"/>
    </g>
  </svg>`);
  const connector=shell.querySelector('.comment-connector');
  const clip=connector.querySelector('rect');
  const paths=connector.querySelectorAll('path');
  const endpoint=connector.querySelector('circle');

  function resolveComment(id){
    const example=window.MineScopeSimulation.records.find(n=>n.id===id);
    if(example)return {coords:example.coords,layer:'simulated',color:colors[example.sentiment],label:`Selected note #${String(example.sample).padStart(3,'0')}`};
    const workshop=notes.find(n=>n.id===id);
    if(workshop)return {coords:workshop.coords,layer:'community',color:'#b7bd9a',label:'Selected workshop note'};
    const theme=concerns.find(n=>n.id===id);
    if(theme)return {coords:theme.coords,layer:'community',color:'#b7bd9a',label:`Selected comment: ${t(...theme.title)}`};
    return null;
  }

  function clear(){
    if(marker){marker.remove();marker=null;}
    if(highlightedText){highlightedText.classList.remove('selected-comment-text');highlightedText=null;}
    inspector.classList.remove('comment-selected');
    connector.setAttribute('hidden','');
  }

  function draw(){
    frame=0;
    if(selected!==currentId){currentId=selected;comment=resolveComment(selected);clear();}
    if(!comment||inspector.hidden||!map.hasLayer(groups[comment.layer])){clear();return;}
    if(!marker){
      marker=L.marker(comment.coords,{
        zIndexOffset:10000,autoPanOnFocus:false,title:comment.label,alt:comment.label,
        icon:L.divIcon({className:'selected-comment-marker',iconSize:[56,56],iconAnchor:[28,28],
          html:`<span class="selected-comment-pin" style="--comment-color:${comment.color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-6 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 8h10M7 12h7"/></svg></span>`})
      }).addTo(map).on('click',()=>inspector.scrollTo({top:0,behavior:'smooth'}));
      marker.getElement().setAttribute('aria-label',comment.label);
      marker.getElement().setAttribute('aria-current','true');
      inspector.classList.add('comment-selected');
      inspector.style.setProperty('--comment-color',comment.color);
      connector.style.setProperty('--comment-color',comment.color);
    }
    const text=inspector.querySelector('.sample-quote,.user-note,.inspector-body > p');
    if(highlightedText!==text){
      highlightedText?.classList.remove('selected-comment-text');
      highlightedText=text;
      text?.classList.add('selected-comment-text');
    }

    // Read the rendered marker, including Leaflet's in-progress CSS zoom transform.
    const root=shell.getBoundingClientRect(),view=mapElement.getBoundingClientRect();
    const pin=marker.getElement().getBoundingClientRect(),panel=inspector.getBoundingClientRect();
    const paragraph=(text||inspector).getBoundingClientRect();
    const start={x:pin.left+pin.width/2-root.left,y:pin.top+pin.height/2-root.top};
    const bounds={left:panel.left-root.left,right:panel.right-root.left,top:panel.top-root.top,bottom:panel.bottom-root.top};
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    let end;
    if(mobileQuery.matches){
      // Meet the edge facing the marker without crossing the comment text.
      if(start.y<=bounds.top||start.y>=bounds.bottom){
        end={x:clamp(start.x,bounds.left+24,bounds.right-24),y:start.y<=bounds.top?bounds.top+1:bounds.bottom-1};
      }else{
        end={x:start.x<bounds.left?bounds.left+1:bounds.right-1,y:clamp(start.y,bounds.top+24,bounds.bottom-24)};
      }
    }else{
      end={x:start.x>bounds.right?bounds.right-1:bounds.left+1,y:clamp(paragraph.top-root.top+20,bounds.top+24,bounds.bottom-24)};
    }
    const dx=end.x-start.x,dy=end.y-start.y,distance=Math.hypot(dx,dy);
    const covered=start.x>bounds.left&&start.x<bounds.right&&start.y>bounds.top&&start.y<bounds.bottom;
    const hidden=covered||distance<34;
    connector.toggleAttribute('hidden',hidden);
    if(!hidden){
      connector.setAttribute('viewBox',`0 0 ${root.width} ${root.height}`);
      clip.setAttribute('x',view.left-root.left);clip.setAttribute('y',view.top-root.top);
      clip.setAttribute('width',view.width);clip.setAttribute('height',view.height);
      const x=start.x+dx/distance*30,y=start.y+dy/distance*30;
      const path=`M ${x.toFixed(2)} ${y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
      paths.forEach(el=>el.setAttribute('d',path));
      endpoint.setAttribute('cx',end.x);endpoint.setAttribute('cy',end.y);
    }
    if(moving.size)schedule();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  map.on('movestart',()=>{moving.add('move');schedule();});
  map.on('zoomstart',()=>{moving.add('zoom');schedule();});
  map.on('moveend',()=>{moving.delete('move');schedule();});
  map.on('zoomend',()=>{moving.delete('zoom');schedule();});
  map.on('move zoom zoomanim viewreset resize',schedule);
  map.on('layeradd layerremove',event=>{if(layers.some(layer=>groups[layer.id]===event.layer))schedule();});
  inspector.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  new ResizeObserver(schedule).observe(inspector);
  new MutationObserver(schedule).observe(inspector,{childList:true,attributes:true,attributeFilter:['hidden']});
  schedule();
})();

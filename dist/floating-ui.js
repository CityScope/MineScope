/* Keep the existing controls and handlers in compact floating panels. */
(() => {
  const shell=document.querySelector('.map-shell');
  const header=document.querySelector('.topbar');
  const headerRow=document.createElement('div');
  headerRow.className='header-main-row';
  headerRow.append(...header.children);
  header.append(headerRow);
  const toolbar=document.querySelector('.map-top');
  toolbar.prepend(document.getElementById('mobile-toggle'));
  toolbar.insertBefore(document.getElementById('map-display-controls'),document.getElementById('reset-view'));
  toolbar.querySelector('.background-control').after(document.querySelector('.leaflet-control-zoom'));
  header.append(toolbar);

  const tray=document.createElement('div');
  tray.className='map-tray';
  for(const selector of ['.place-dock','.collection-timeline'])tray.append(document.querySelector(selector));
  shell.append(tray);

  const legend=document.createElement('details');
  legend.className='timeline-legend';
  legend.innerHTML='<summary aria-label="Map legend" title="Map legend"><span aria-hidden="true">i</span></summary><div class="timeline-legend-panel"><strong>Map legend</strong><div class="legend-content"></div><div class="legend-sources"><strong>Note sources</strong></div></div>';
  document.querySelector('.timeline-caption').append(legend);
  legend.querySelector('.legend-content').append(document.querySelector('.map-bottom'),document.querySelector('.heat-key'));
  legend.querySelector('.legend-sources').append(document.querySelector('.timeline-sources'));
  document.querySelector('.timeline-bottomline').remove();
  document.addEventListener('pointerdown',event=>{if(!legend.contains(event.target))legend.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&legend.open){legend.open=false;legend.querySelector('summary').focus();}});

  const observer=new ResizeObserver(()=>{
    document.documentElement.style.setProperty('--float-tray',Math.ceil(tray.getBoundingClientRect().height)+'px');
    document.documentElement.style.setProperty('--float-header',Math.ceil(header.getBoundingClientRect().height)+'px');
  });
  observer.observe(tray);observer.observe(header);
  requestAnimationFrame(()=>{map.invalidateSize({pan:false});window.MineScopeSim.showAll();});
})();

(()=>{
  const session=window.MineScopeSession;if(!session)return;
  const active=document.body.dataset.appView||'community';
  const names={community:'Community map',table:'Interactive table',dashboard:'Live dashboard'};
  const menu=document.createElement('details');menu.className='view-menu';
  const summary=document.createElement('summary');summary.textContent=names[active]+' ⌄';summary.setAttribute('aria-label','Switch MineScope view');menu.append(summary);
  const nav=document.createElement('nav');nav.setAttribute('aria-label','MineScope views');
  for(const [view,name]of Object.entries(names)){
    const link=document.createElement('a');link.href=session.urlFor(view);link.referrerPolicy='no-referrer';link.rel='noopener noreferrer';link.dataset.appView=view;link.textContent=name;
    if(view===active)link.setAttribute('aria-current','page');nav.append(link);
  }
  menu.append(nav);
  const old=document.querySelector('.scenario-link,.map-link,[data-view-menu]');
  if(old)old.replaceWith(menu);else document.querySelector('.topbar')?.append(menu);
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[data-app-view],.brand');if(!link||event.defaultPrevented)return;
    const view=link.dataset.appView||'community';if(!Object.hasOwn(names,view))return;
    event.preventDefault();if(view===active&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&link.target!=='_blank'){menu.open=false;return;}const url=session.urlFor(view);
    if(event.metaKey||event.ctrlKey||event.shiftKey||link.target==='_blank')window.open(url,'_blank','noopener,noreferrer');
    else location.assign(url);
  });
  document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))menu.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;summary.focus();}});
})();

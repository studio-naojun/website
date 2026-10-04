/* Progressive enhancement: every route and catalogue item works without JS. */
(() => {
  const body=document.body, menu=document.querySelector('.menu-toggle'), nav=document.querySelector('#studio-nav');
  if(menu&&nav){
    body.classList.add('nav-enhanced');
    const close=(focus=false)=>{nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','メニューを開く');if(focus)menu.focus();};
    menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';nav.classList.toggle('is-open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'メニューを閉じる':'メニューを開く');});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true')close(true);});
    document.addEventListener('click',e=>{if(!e.target.closest('.site-header'))close();});
    nav.addEventListener('click',e=>{if(e.target.closest('a'))close();});
    matchMedia('(min-width:761px)').addEventListener('change',()=>close());
  }
  const filters=document.querySelector('.work-filters'), works=[...document.querySelectorAll('[data-work]')], count=document.querySelector('.work-count');
  if(filters&&works.length){
    filters.hidden=false;
    filters.addEventListener('click',e=>{
      const button=e.target.closest('button[data-filter]');if(!button)return;
      const filter=button.dataset.filter;
      filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      works.forEach(work=>work.hidden=filter!=='all'&&work.dataset.category!==filter);
      if(count)count.textContent=works.filter(w=>!w.hidden).length+' 件の作品';
    });
  }
})();

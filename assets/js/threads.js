/* Original 2D ribbon study. One loop; offscreen/hidden work stops; no dependencies. */
(() => {
  const canvas=document.querySelector('#thread-canvas');
  const button=document.querySelector('.motion-toggle');
  if(!canvas||!button)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=media.matches, inView=true, frame=0, last=0, phase=0, aimX=0, aimY=0, tiltX=0, tiltY=0;
  const steps=160, segments=[];
  for(let ribbon=0;ribbon<2;ribbon++)for(let j=0;j<steps;j++)segments.push({ribbon,t:j/steps*Math.PI*2});
  function point(a,w,r,turn){
    let x=(175+w*24)*Math.cos(a), y=(175+w*24)*Math.sin(a);
    const z=82*Math.sin(a*2+r*Math.PI+phase*.17);
    if(r){x=x*.7+52;y=y*.94-15;}else{x=x*.98-30;y=y*.65+20;}
    const c=Math.cos(turn),s=Math.sin(turn), xx=x*c+z*s, zz=-x*s+z*c;
    return [350+xx*1.2,350+(y*Math.cos(.6+tiltY)-zz*Math.sin(.6+tiltY))*1.2,zz];
  }
  function draw(){
    const scale=canvas.width/700;ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,700,700);
    const turn=.51+Math.sin(phase*.23)*.13+tiltX, polys=[];
    for(const {ribbon:r,t} of segments){
      const pts=[point(t,-1,r,turn),point(t,1,r,turn),point(t+Math.PI*2/steps,1,r,turn),point(t+Math.PI*2/steps,-1,r,turn)];
      const shade=.5+.5*Math.cos(t-.8+phase*.17);
      const c=r?[141+45*shade,155+48*shade,74+45*shade]:[18+28*shade,47+36*shade,165+61*shade];
      polys.push({pts,z:pts.reduce((n,p)=>n+p[2],0)/4,color:'rgb('+c.map(Math.round).join(',')+')'});
    }
    polys.sort((a,b)=>a.z-b.z);
    for(const {pts,color} of polys){
      ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
      ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='rgba(244,243,236,.18)';ctx.lineWidth=.55;ctx.stroke();
    }
  }
  function tick(now){
    frame=0;
    if(paused||!inView||document.hidden)return;
    if(now-last>=1000/30){
      phase+=Math.min((now-last)/1000,.05);last=now;
      tiltX+=(aimX-tiltX)*.05;tiltY+=(aimY-tiltY)*.05;draw();
    }
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    if(frame){cancelAnimationFrame(frame);frame=0;}
    button.textContent=paused?'動きを再生':'動きを止める';
    button.setAttribute('aria-pressed',String(!paused));
    canvas.dataset.motion=paused?'paused':'running';
    if(!paused&&inView&&!document.hidden){last=performance.now();frame=requestAnimationFrame(tick);}
  }
  function resize(){
    const size=Math.min(1000,Math.max(350,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,1.5))));
    if(canvas.width!==size){canvas.width=size;canvas.height=size;}draw();
  }
  button.hidden=false;
  button.addEventListener('click',()=>{paused=!paused;sync();});
  media.addEventListener('change',()=>{paused=media.matches;aimX=aimY=tiltX=tiltY=0;draw();sync();});
  document.addEventListener('visibilitychange',sync);
  const art=canvas.parentElement;
  art.addEventListener('pointermove',e=>{if(paused||e.pointerType!=='mouse')return;const r=art.getBoundingClientRect();aimX=((e.clientX-r.left)/r.width-.5)*.4;aimY=((e.clientY-r.top)/r.height-.5)*.16;});
  art.addEventListener('pointerleave',()=>{aimX=aimY=0;});
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{threshold:.05}).observe(art);
  if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
  resize();canvas.classList.add('is-ready');art.classList.add('is-live');sync();
})();

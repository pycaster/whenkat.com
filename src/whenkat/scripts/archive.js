import { rankJournals } from '../lib/search';
export { rankJournals } from '../lib/search';

const OPEN_POSITIONS = [
  [0,15,90,0,0,1],[-375,-65,-120,8,-2,.96],[375,-65,-160,-8,2,.94],
  [-370,205,-340,9,-2,.85],[370,205,-380,-9,2,.84],
  [-480,-250,-780,14,-5,.5],[480,-245,-820,-14,5,.48],
  [-100,-225,-660,3,-3,.58],[180,255,-800,-4,4,.45],[30,-300,-1200,0,0,.35],
];
export function spatialPosition(rank, width, searching) {
  const scale=Math.min(1.16,Math.max(.61,width/1320));
  let p=OPEN_POSITIONS[rank] ?? [(rank%2?-1:1)*(520+Math.floor(rank/2)*25),((rank-10)%5-2)*150,-900-(rank-10)*100,0,0,.3];
  if(searching){
    const layouts=[[0,-15,130,0,0,1],[-365,90,-110,6,-1,.96],[365,90,-140,-6,1,.94],[-370,-160,-370,8,-2,.82],[370,-160,-390,-8,2,.8],[0,250,-450,0,0,.7]];
    p=layouts[rank]??[ ((rank%3)-1)*430,rank%2?250:-260,-900-rank*30,0,0,.42];
  }
  return [p[0]*scale,p[1],p[2],p[3],p[4],p[5]];
}
export function mountLivingArchive(root){
  if(root.dataset.archiveMounted)return;
  root.dataset.archiveMounted='true';
  const input=root.querySelector('input[type=search]');
  const form=root.querySelector('form');
  const clear=root.querySelector('.search-clear');
  const cards=[...root.querySelectorAll('[data-journal]')];
  const space=root.querySelector('.journal-space');
  const viewport=root.querySelector('.space-viewport');
  const counter=root.querySelector('.result-count');
  const label=root.querySelector('[data-space-label]');
  const empty=root.querySelector('.archive-empty');
  const viewButton=root.querySelector('[data-view]');
  const motionButton=root.querySelector('[data-motion]');
  const dialog=root.querySelector('dialog');
  const content=dialog.querySelector('.reader-content');
  const readerTitle=dialog.querySelector('#reader-title');
  const meta=dialog.querySelector('.reader-meta');
  const permalink=dialog.querySelector('.reader-permalink');
  const scroll=dialog.querySelector('.reader-scroll');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const narrow=matchMedia('(max-width: 720px)');
  const abort=new AbortController(),options={signal:abort.signal};
  let motion=!reduced.matches, list=false, timer, disposed=false, lastFocus, pushed=false, loadingId=0;
  let activePost, previousURL, cached=new Map();
  let posts=cards.map((card,index)=>({id:String(index),title:card.querySelector('h2').textContent,description:card.querySelector('.object-excerpt').textContent,href:card.getAttribute('href'),series:card.querySelector('.object-series').textContent,date:card.querySelector('time').dateTime,body:''}));
  let rankings=rankJournals(posts,'');
  root.classList.add('space-mode');
  function setPosition(card,p){
    for(const [name,value,unit] of [['x',p[0],'px'],['y',p[1],'px'],['z',p[2],'px'],['ry',p[3],'deg'],['rz',p[4],'deg'],['alpha',p[5],'']]) card.style.setProperty('--'+name,value+unit);
  }
  function layout(){
    const searching=input.value.trim().length>0;
    const visible=new Map(rankings.map((r,i)=>[r.index,i]));
    // Put the VRAM story nearest in the opening arrangement, then the other journals.
    const initialLeader=posts.findIndex(p=>/VRAM matters/i.test(p.title));
    const initialOrder=[initialLeader,...posts.map((_,i)=>i).filter(i=>i!==initialLeader)].filter(i=>i>=0);
    cards.forEach((card,i)=>{
      const rank=searching?visible.get(i):initialOrder.indexOf(i);
      const matched=rank!==undefined;
      card.classList.toggle('is-receded',!matched);
      card.classList.toggle('is-leading',matched&&rank===0);
      card.tabIndex=matched?0:-1;
      if(matched)card.removeAttribute('aria-hidden');else card.setAttribute('aria-hidden','true');
      card.style.order=String(rank??999);
      const p=matched?spatialPosition(rank,viewport.clientWidth,searching):[(i%2?-1:1)*(610+i*30),((i%3)-1)*190,-1300-i*45,0,0,rankings.length?.1:0];
      setPosition(card,p);
    });
    empty.hidden=rankings.length!==0;
    counter.textContent=searching?`${rankings.length} ${rankings.length===1?'journal':'journals'} in focus`:`${posts.length} journals to explore`;
    label.textContent=searching?'FOLLOWING YOUR CURIOSITY':'THE OPEN ARCHIVE';
    clear.hidden=!input.value;
    root.querySelector('.search-shortcut').hidden=!!input.value;
    root.querySelectorAll('[data-query]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.query===input.value)));
  }
  function search(){rankings=rankJournals(posts,input.value);layout();}
  function setQuery(value){clearTimeout(timer);input.value=value;search();}
  function reset(){setQuery('');input.focus();}
  function updateMotion(){root.classList.toggle('motion-off',!motion);motionButton.textContent=motion?'Motion on':'Motion off';motionButton.setAttribute('aria-pressed',String(motion));if(!motion){space.style.setProperty('--look-x','0deg');space.style.setProperty('--look-y','0deg');}}
  form.addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);search();},options);
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,180);},options);
  clear.addEventListener('click',reset,options);
  root.querySelector('[data-reset]').addEventListener('click',reset,options);
  root.querySelectorAll('[data-query]').forEach(button=>button.addEventListener('click',()=>setQuery(button.dataset.query),options));
  viewButton.addEventListener('click',()=>{list=!list;root.classList.toggle('list-mode',list);root.classList.toggle('space-mode',!list);viewButton.textContent=list?'Space view ◇':'List view ☷';viewButton.setAttribute('aria-pressed',String(list));layout();},options);
  motionButton.addEventListener('click',()=>{motion=!motion;updateMotion();},options);
  reduced.addEventListener('change',()=>{motion=!reduced.matches;updateMotion();},options);
  viewport.addEventListener('pointermove',event=>{
    if(!motion||list||dialog.open||narrow.matches||event.pointerType==='touch')return;
    const r=viewport.getBoundingClientRect();
    space.style.setProperty('--look-x',`${((event.clientX-r.left)/r.width-.5)*3}deg`);
    space.style.setProperty('--look-y',`${-((event.clientY-r.top)/r.height-.5)*2}deg`);
  },{...options,passive:true});
  viewport.addEventListener('pointerleave',()=>{space.style.setProperty('--look-x','0deg');space.style.setProperty('--look-y','0deg');},options);
  const resize=new ResizeObserver(layout);resize.observe(viewport);
  const dateFormat=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
  function cleanReader(html,url){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const source=doc.querySelector('article.prose')??doc.querySelector('.prose')??doc.querySelector('article');
    if(!source)throw new Error('Reading content not found');
    source.querySelectorAll('script,style,iframe,.comments,.title').forEach(n=>n.remove());
    source.querySelectorAll('*').forEach(el=>{
      [...el.attributes].forEach(attr=>{if(attr.name.startsWith('on'))el.removeAttribute(attr.name);});
      if(el.hasAttribute('src'))el.setAttribute('src',new URL(el.getAttribute('src'),url).href);
      if(el.hasAttribute('href')){
        const href=el.getAttribute('href');
        if(href.startsWith('#'))return;
        const resolved=new URL(href,url);
        if(['http:','https:','mailto:'].includes(resolved.protocol))el.setAttribute('href',resolved.href);else el.removeAttribute('href');
      }
    });
    return source.innerHTML;
  }
  async function openReader(post,fromHistory=false){
    if(!post)return;
    activePost=post;
    const current=++loadingId;
    if(!dialog.open){lastFocus=document.activeElement;dialog.showModal();root.classList.add('reading');document.documentElement.style.overflow='hidden';}
    readerTitle.textContent=post.title;
    const date=new Date(post.date);
    meta.textContent=post.series+' / '+(Number.isNaN(date.getTime())?'':dateFormat.format(date));
    permalink.href=post.href;
    content.replaceChildren();
    const pending=document.createElement('p');pending.className='reader-loading';pending.textContent='Opening journal';content.append(pending);content.setAttribute('aria-busy','true');
    scroll.scrollTop=0;
    if(!fromHistory){previousURL=location.pathname+location.search+location.hash;history.pushState({livingArchiveReader:post.href},'',`#read=${encodeURIComponent(post.href)}`);pushed=true;}
    try{
      if(!cached.has(post.href)){
        const url=new URL(post.href,location.href);
        if(url.origin!==location.origin)throw new Error('External article');
        const response=await fetch(url,{signal:abort.signal});if(!response.ok)throw new Error('Article unavailable');
        cached.set(post.href,cleanReader(await response.text(),url));
      }
      if(current!==loadingId||!dialog.open)return;
      content.innerHTML=cached.get(post.href);
      content.removeAttribute('aria-busy');
    }catch(error){
      if(disposed||current!==loadingId)return;
      content.removeAttribute('aria-busy');
      const message=document.createElement('p');message.textContent='This journal is available on its own page.';
      const link=document.createElement('a');link.href=post.href;link.textContent='Open the article ↗';content.replaceChildren(message,link);
    }
  }
  function closeReader(updateHistory=true){
    if(!dialog.open)return;
    ++loadingId;dialog.close();root.classList.remove('reading');document.documentElement.style.overflow='';
    if(updateHistory&&pushed){pushed=false;history.back();}
    else if(updateHistory&&location.hash.startsWith('#read=')){history.replaceState(null,'',location.pathname+location.search);}
    lastFocus?.focus({preventScroll:true});
  }
  cards.forEach((card,index)=>card.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();openReader(posts[index]);
  },options));
  content.addEventListener('click',event=>{
    const link=event.target.closest('a');if(!link||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const url=new URL(link.href,location.href);
    if(link.getAttribute('href')?.startsWith('#')){
      const id=decodeURIComponent(link.getAttribute('href').slice(1));const target=[...content.querySelectorAll('[id]')].find(el=>el.id===id);if(target){event.preventDefault();target.scrollIntoView({behavior:'instant',block:'start'});}return;
    }
    const post=posts.find(p=>new URL(p.href,location.origin).pathname===url.pathname&&url.origin===location.origin);
    if(post){event.preventDefault();openReader(post,true);history.replaceState({livingArchiveReader:post.href},'',`#read=${encodeURIComponent(post.href)}`);}
  },options);
  dialog.querySelectorAll('.reader-close').forEach(b=>b.addEventListener('click',()=>closeReader(),options));
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeReader();},options);
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeReader();}},options);
  window.addEventListener('popstate',()=>{
    const href=readerHash();
    if(href){openReader(posts.find(p=>p.href===href),true);}else{pushed=false;closeReader(false);}
  },options);
  document.addEventListener('keydown',event=>{
    if(dialog.open)return;
    if(event.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();input.focus();}
    if(event.key==='Escape'&&document.activeElement===input)reset();
  },options);
  function readerHash(){try{return location.hash.startsWith('#read=')?decodeURIComponent(location.hash.slice(6)):null;}catch{return null;}}
  updateMotion();search();
  const initial=readerHash();if(initial)openReader(posts.find(p=>p.href===initial),true);
  const applyIndex=data=>{
    if(!Array.isArray(data)||data.length!==cards.length)return;
    posts=posts.map(p=>({...p,...data.find(item=>item.href===p.href)}));search();
  };
  const inline=root.querySelector('script[data-archive-index]');
  if(inline){try{applyIndex(JSON.parse(inline.textContent));}catch{/* Keep rendered summaries searchable. */}}
  else if(root.dataset.index){fetch(root.dataset.index,{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('Search index unavailable');return r.json();}).then(applyIndex).catch(()=>{/* Summary search still works. */});}
  const dispose=()=>{disposed=true;clearTimeout(timer);abort.abort();resize.disconnect();if(dialog.open)closeReader(false);delete root.dataset.archiveMounted;};
  return dispose;
}

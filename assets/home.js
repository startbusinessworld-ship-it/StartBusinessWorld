const SBW_URL = "https://grwimhqsthcmfwblwdwg.supabase.co";
const SBW_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyd2ltaHFzdGhjbWZ3Ymx3ZHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTA5NDIsImV4cCI6MjA5MDA2Njk0Mn0.faK7rX_1OElj5g28NJyAkhucvJIX1R8scopOZ8TRKXc";
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const topics = [
    ['all', 'Tout explorer', '◈'], ['Business Chine', 'Business Chine', '中'],
    ['Import-Export', 'Import-export B2B', '⇄'], ['Fiscalité', 'Fiscalité', '％'],
    ['Création de société', 'Création de sociétés', '▥'], ['Mindset', 'Entrepreneuriat', '↗'],
    ['E-commerce', 'E-commerce', '▧'], ['Finance', 'Finance', '◎'],
    ['Expatriation', 'Expatriation', '✳'], ['Outils', 'Outils', '⊞'], ['Actualité', 'Actualité', '▤']
  ];
  const palettes = [['#e9eddf','#6a8056'],['#e7e8f2','#747492'],['#f0e6dc','#9a7657'],['#dfece9','#518076']];
  let articles = [], category = new URLSearchParams(location.search).get('category') || 'all', query = '', savedOnly = false, limit = 6, loading = false;
  let saved;
  try { const data = JSON.parse(localStorage.getItem('sbw-saved-articles') || '[]'); saved = new Set(Array.isArray(data) ? data.filter(id => typeof id === 'string') : []); } catch { saved = new Set(); }
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  const normalize = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const canonicalCategory = c => normalize(c) === 'creation societe' ? 'Création de société' : c;
  const categories = a => [...new Set(String(a.category || '').split(',').map(s => canonicalCategory(s.trim())).filter(Boolean))];
  category = canonicalCategory(category);
  const articleURL = a => 'article.html?id=' + encodeURIComponent(a.id);
  const videoID = id => /^[A-Za-z0-9_-]{11}$/.test(id || '');
  function date(a) { const d = new Date(a.created_at); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }); }
  function symbol(a) { return (topics.find(t => categories(a).includes(t[0])) || ['','','↗'])[2]; }
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 3500); }
  function updateSavedCount() { $('savedCount').textContent = saved.size; }
  function saveArticle(a) {
    saved.has(a.id) ? saved.delete(a.id) : saved.add(a.id);
    try { localStorage.setItem('sbw-saved-articles', JSON.stringify([...saved])); }
    catch { toast('Stockage indisponible : ta sélection sera conservée seulement jusqu’au rechargement.'); }
    updateSavedCount();
    if (savedOnly) renderArticles();
    else document.querySelectorAll('.save').forEach(b => { if (b.dataset.id === a.id) updateSaveButton(b,a); });
  }
  function updateSaveButton(b,a) { const selected = saved.has(a.id); b.setAttribute('aria-pressed',String(selected)); b.setAttribute('aria-label', (selected?'Retirer de mes lectures : ':'Enregistrer : ') + a.title); }
  function selectCategory(value) { category=value; savedOnly=false; limit=6; syncFilters(); renderArticles(); }
  function syncFilters() {
    document.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.category === category && !savedOnly)));
    $('savedToggle').setAttribute('aria-pressed',String(savedOnly)); $('mobileSavedToggle').setAttribute('aria-pressed',String(savedOnly)); $('savedNote').hidden=!savedOnly;
    const params=new URLSearchParams(location.search); category==='all'?params.delete('category'):params.set('category',category);
    history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);
  }
  function renderTopics() {
    // Keep existing editorial categories; add any new category published by the admin.
    for (const a of articles) for (const c of categories(a)) if(!topics.some(t=>t[0]===c)) topics.push([c,c,'↗']);
    $('topics').replaceChildren(); $('railTopics').replaceChildren();
    for(const [value,label,icon] of topics){
      const b=el('button','',label); b.type='button'; b.dataset.category=value;
      b.addEventListener('click',()=>selectCategory(value)); $('topics').append(b);
      if(value!=='all') { const r=el('button'); r.type='button'; r.dataset.category=value; r.append(el('span','topic-icon',icon),document.createTextNode(label)); r.addEventListener('click',()=>{selectCategory(value); $('articles-section').scrollIntoView({behavior:'smooth'});}); $('railTopics').append(r); }
    }
    syncFilters();
  }
  function lead(a, large) {
    const link=el('a',large?'lead-card':'side-card'); link.href=articleURL(a);
    if(large){
      const art=el('div','lead-art'); art.setAttribute('aria-hidden','true'); link.append(art);
      const kicker=el('div','lead-kicker'); kicker.append(el('span','',a.featured?'À LA UNE':'DERNIÈRE PUBLICATION'),el('span','','SBW ↗')); link.append(kicker);
      link.append(el('span','card-label',categories(a).join(' · ')),el('h2','',a.title),el('p','',a.deck || ''));
      const more=el('span','read-link','Lire le décryptage'); more.append(el('b','','↗')); link.append(more);
    }else{const text=el('div','side-text'); text.append(el('span','card-label',categories(a)[0] || 'Business'),el('h3','',a.title),el('span','date',date(a))); const icon=el('div','side-symbol',symbol(a));icon.setAttribute('aria-hidden','true');link.append(text,icon);}
    return link;
  }
  function renderLead() {
    const grid=$('leadGrid'); grid.replaceChildren();
    if(!articles.length){grid.append(el('p','empty','Les prochaines publications apparaîtront ici.')); return;}
    const first=articles.find(a=>a.featured) || articles[0]; grid.append(lead(first,true));
    const side=el('div','lead-side'); articles.filter(a=>a.id!==first.id).slice(0,2).forEach(a=>side.append(lead(a,false))); if(side.childNodes.length)grid.append(side);
  }
  function articleCard(a,index) {
    const card=el('article','article-card'); const [bg,ink]=palettes[index%palettes.length];card.style.setProperty('--card-bg',bg);card.style.setProperty('--card-ink',ink);
    const visual=el('a','article-visual');visual.href=articleURL(a);visual.setAttribute('aria-label',a.title);visual.tabIndex=-1;
    const fallback=()=>{visual.replaceChildren(el('span','visual-symbol',symbol(a)),el('span','visual-caption','START BUSINESS WORLD'));};
    fallback();
    if(videoID(a.youtube_id)){const img=el('img');img.src='https://i.ytimg.com/vi/'+a.youtube_id+'/hqdefault.jpg';img.alt='';img.loading='lazy';img.addEventListener('error',fallback,{once:true});visual.replaceChildren(img);}
    const save=el('button','save');save.type='button';save.dataset.id=a.id;
    save.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';updateSaveButton(save,a);save.addEventListener('click',()=>saveArticle(a));
    const body=el('div','article-body');const title=el('h3');const link=el('a','',a.title);link.href=articleURL(a);title.append(link);body.append(el('span','card-label',categories(a)[0]||'Business'),title,el('p','',a.deck||''));
    const foot=el('div','article-footer');foot.append(el('span','date',date(a)),el('span','','↗'));card.append(visual,save,body,foot);return card;
  }
  function renderArticles() {
    const container=$('articles');container.replaceChildren();
    let results=articles.filter(a=>(category==='all'||categories(a).some(c=>normalize(c)===normalize(category)))&&(!savedOnly||saved.has(a.id))&&normalize([a.title,a.deck,a.category].join(' ')).includes(normalize(query)));
    if($('sortOrder').value==='oldest')results=results.slice().reverse();
    $('resultCount').textContent=results.length+' article'+(results.length>1?'s':'')+(savedOnly?' dans tes lectures':'')+(loading?' · chargement en cours…':'');
    $('resetFilters').hidden=category==='all'&&!query&&!savedOnly;
    if(!results.length&&!loading){const box=el('div','empty',savedOnly?'Aucun article enregistré dans cette sélection. Utilise le marque-page sur un article.':'Aucun article ne correspond à ta recherche.');container.append(box);}
    results.slice(0,limit).forEach((a,i)=>container.append(articleCard(a,i)));$('loadMore').hidden=limit>=results.length;
  }
  async function getRows(table,select,from,to) {
    const url=new URL(SBW_URL+'/rest/v1/'+table);url.searchParams.set('select',select);url.searchParams.set('status','eq.published');url.searchParams.set('order','created_at.desc,id.desc');url.searchParams.set('offset',String(from));url.searchParams.set('limit',String(to-from+1));
    const res=await fetch(url,{headers:{apikey:SBW_KEY},signal:AbortSignal.timeout(20000)});if(!res.ok)throw new Error('HTTP '+res.status);const rows=await res.json();if(!Array.isArray(rows))throw new Error('Invalid response');return rows;
  }
  function errorBox(target,message,retry) {const box=el('div','empty',message);const button=el('button','','Réessayer');button.type='button';button.addEventListener('click',retry);box.append(button);target.replaceChildren(box);}
  async function loadArticles() {
    if(loading)return;loading=true;$('articles').replaceChildren(el('p','loading','Chargement des articles…'));
    try {
      const rows=[];let offset=0;
      while(true){const page=await getRows('articles','id,title,deck,category,youtube_id,created_at,featured',offset,offset+99);rows.push(...page);if(page.length<100)break;offset+=100;}
      articles=rows;loading=false;renderTopics();renderLead();renderArticles();
    }catch(error){loading=false;$('resultCount').textContent='Chargement indisponible';$('loadMore').hidden=true;errorBox($('articles'),'Impossible de charger les articles. Vérifie ta connexion, puis réessaie.',loadArticles);errorBox($('leadGrid'),'Les publications sont momentanément indisponibles.',loadArticles);}
  }
  async function loadShorts() {
    $('shortsContainer').replaceChildren(el('p','loading','Chargement des vidéos…'));
    try{const rows=await getRows('shorts','id,title,category,youtube_id,created_at',0,99);const valid=rows.filter(s=>videoID(s.youtube_id));$('shortsContainer').replaceChildren();
      if(!valid.length){$('shortsContainer').append(el('p','empty','Aucune vidéo publiée pour le moment.'));return;}
      valid.forEach(s=>{const b=el('button','short-card');b.type='button';b.setAttribute('aria-label','Lire la vidéo : '+s.title);const visual=el('div','short-image');const image=el('img');image.src='https://i.ytimg.com/vi/'+s.youtube_id+'/hqdefault.jpg';image.alt='';image.loading='lazy';image.addEventListener('error',()=>image.remove(),{once:true});visual.append(image,el('span','play','▶'));b.append(visual,el('h3','',s.title),el('span','small-label',s.category||'YouTube Shorts'));b.addEventListener('click',()=>openVideo(s.youtube_id));$('shortsContainer').append(b);});
    }catch{errorBox($('shortsContainer'),'Impossible de charger les vidéos.',loadShorts);}
  }
  function openVideo(id){if(!videoID(id))return;$('videoFrame').src='https://www.youtube.com/embed/'+id+'?autoplay=1&rel=0';$('videoModal').showModal();document.body.style.overflow='hidden';}
  function closeVideo(){$('videoModal').close();}
  $('closeVideo').addEventListener('click',closeVideo);
  $('videoModal').addEventListener('click',e=>{if(e.target===$('videoModal'))closeVideo();});
  $('videoModal').addEventListener('close',()=>{$('videoFrame').removeAttribute('src');document.body.style.overflow='';});
  ['Prev','Next'].forEach(dir=>$('short'+dir).addEventListener('click',()=>$('shortsContainer').scrollBy({left:dir==='Next'?380:-380,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})));
  $('searchInput').addEventListener('input',e=>{query=e.target.value.trim();limit=6;renderArticles();});$('sortOrder').addEventListener('change',()=>{limit=6;renderArticles();});$('loadMore').addEventListener('click',()=>{limit+=6;renderArticles();});
  function toggleSaved(){savedOnly=!savedOnly;category='all';query='';$('searchInput').value='';limit=6;syncFilters();renderArticles();$('articles-section').scrollIntoView({behavior:'smooth'});}
  $('savedToggle').addEventListener('click',toggleSaved);$('mobileSavedToggle').addEventListener('click',toggleSaved);
  $('resetFilters').addEventListener('click',()=>{query='';$('searchInput').value='';selectCategory('all');});
  function closeMenu(){$('mobileMenu').hidden=true;$('menuToggle').setAttribute('aria-expanded','false');$('menuToggle').setAttribute('aria-label','Ouvrir le menu');}
  $('menuToggle').addEventListener('click',()=>{const open=$('mobileMenu').hidden;$('mobileMenu').hidden=!open;$('menuToggle').setAttribute('aria-expanded',String(open));$('menuToggle').setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');});
  $('mobileMenu').addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();}if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();$('searchInput').focus();}});window.addEventListener('resize',()=>{if(innerWidth>800)closeMenu();});
  $('newsletterForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;button.textContent='Inscription…';$('newsletterMessage').textContent='';
    try{const res=await fetch(SBW_URL+'/rest/v1/subscribers',{method:'POST',headers:{'Content-Type':'application/json',apikey:SBW_KEY,Authorization:'Bearer '+SBW_KEY,Prefer:'return=minimal'},body:JSON.stringify({email:$('newsletterEmail').value.trim(),source:'index'}),signal:AbortSignal.timeout(20000)});
      if(!res.ok&&res.status!==409)throw new Error();form.hidden=true;$('newsletterMessage').textContent=res.status===409?'Cette adresse est déjà inscrite à la newsletter.':'Merci ! Ton inscription à la newsletter est enregistrée.';
    }catch{$('newsletterMessage').textContent='L’inscription n’a pas abouti. Réessaie dans un instant.';button.disabled=false;button.textContent='Je m’abonne ↗';}
  });
  updateSavedCount();renderTopics();loadArticles();loadShorts();
})();

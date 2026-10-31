(async()=>{
  const report=document.createElement('pre');report.id='testReport';report.style='position:fixed;inset:15px;z-index:999;background:white;color:#123;padding:25px;overflow:auto;box-shadow:0 0 0 20px #1118';
  const results=[];const check=(name,condition)=>{results.push((condition?'PASS ':'FAIL ')+name);};
  const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
  const $=id=>document.getElementById(id);
  await wait();
  if(testMode==='error'){check('article API error is visible',$('articles').textContent.includes('Impossible'));check('lead API error is visible',$('leadGrid').textContent.includes('indisponibles'));check('shorts API error is visible',$('shortsContainer').textContent.includes('Impossible'));testMode='success';$('articles').querySelector('button').click();$('shortsContainer').querySelector('button').click();await wait();check('retry recovers articles',$('resultCount').textContent==='103 articles');}
  if(testMode==='empty'){check('empty published feed',$('articles').textContent.includes('Aucun article'));check('empty hero',$('leadGrid').textContent.includes('prochaines publications'));report.textContent=results.join('\n');document.body.append(report);return;}
  check('103 articles fetched across 2 pages', $('resultCount').textContent==='103 articles'&&testRequests.filter(r=>r.url.includes('/articles?')).length>=2);
  check('published-only query on every read',testRequests.every(r=>new URL(r.url).searchParams.get('status')==='eq.published'));
  check('6 initial cards',document.querySelectorAll('.article-card').length===6);
  $('loadMore').click();check('load more displays 12',document.querySelectorAll('.article-card').length===12);
  document.querySelector('#topics [data-category="Business Chine"]').click();check('comma-separated categories supported',$('resultCount').textContent==='51 articles');
  document.querySelector('#topics [data-category="Création de société"]').click();check('legacy category alias supported',$('resultCount').textContent==='52 articles');
  $('resetFilters').click();$('searchInput').value='TEST ONLY 102';$('searchInput').dispatchEvent(new Event('input'));check('search includes second server page',$('resultCount').textContent==='1 article');
  $('searchInput').value='__none__';$('searchInput').dispatchEvent(new Event('input'));check('empty search message',$('articles').textContent.includes('Aucun article'));
  $('resetFilters').click();document.querySelector('.save').click();$('savedToggle').click();check('saved article selected',document.querySelectorAll('.article-card').length>=1&&$('savedToggle').getAttribute('aria-pressed')==='true');
  $('resetFilters').click();$('sortOrder').value='oldest';$('sortOrder').dispatchEvent(new Event('change'));check('sort changes first article',document.querySelector('.article-body h3').textContent==='TEST ONLY 102');
  check('shorts empty state',$('shortsContainer').textContent.includes('Aucune vidéo'));
  $('newsletterEmail').value='not-an-email';check('native email validation rejects invalid input',!$('newsletterForm').checkValidity());
  const form=$('newsletterForm');$('newsletterEmail').value='test@example.invalid';testMode='error';form.dispatchEvent(new Event('submit',{cancelable:true}));await wait();check('newsletter failure re-enables submit',!form.querySelector('button').disabled&&$('newsletterMessage').textContent.includes('pas abouti'));
  testMode='duplicate';form.dispatchEvent(new Event('submit',{cancelable:true}));await wait();check('newsletter duplicate acknowledged',$('newsletterMessage').textContent.includes('déjà inscrite'));
  form.hidden=false;form.querySelector('button').disabled=false;testMode='success';form.dispatchEvent(new Event('submit',{cancelable:true}));await wait();check('newsletter success acknowledged',form.hidden&&$('newsletterMessage').textContent.includes('enregistrée'));
  check('newsletter request contract unchanged',testRequests.filter(r=>r.method==='POST').every(r=>JSON.parse(r.body).source==='index'));
  $('menuToggle').click();check('menu exposes expanded state',$('menuToggle').getAttribute('aria-expanded')==='true');$('mobileMenu').querySelector('a').addEventListener('click',e=>e.preventDefault());$('mobileMenu').querySelector('a').click();check('menu closes on navigation',$('mobileMenu').hidden);
  check('no placeholder href',!document.querySelector('a[href="#"]'));
  if(window.originalSaved===null)localStorage.removeItem('sbw-saved-articles');else localStorage.setItem('sbw-saved-articles',window.originalSaved);
  report.textContent=results.join('\n')+'\n\n'+results.filter(r=>r.startsWith('PASS')).length+'/'+results.length+' checks passed. All network responses mocked. No production writes.';document.body.append(report);
})();

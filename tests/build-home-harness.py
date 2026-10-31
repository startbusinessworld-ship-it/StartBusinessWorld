"""Build an isolated browser test page. No Supabase requests or newsletter writes.
Usage: python tests/build-home-harness.py
Serve repository locally, then open tests/home-harness.html. Generated file is untracked.
"""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
html=re.sub(r'<script[\s\S]*?</script>', '', html)
html=html.replace('<head>','<head><base href="../">')
bootstrap='''<script>
window.originalSaved=localStorage.getItem('sbw-saved-articles');localStorage.removeItem('sbw-saved-articles');
window.testMode=new URLSearchParams(location.search).get('scenario')||'success';window.testRequests=[];
// Deliberately labeled fixtures; never included in the actual homepage.
const fixture=Array.from({length:103},(_,i)=>({id:'test-'+i,title:'TEST ONLY '+i,deck:'Fixture de test',category:i%2?'Fiscalité, Business Chine':'Création société',created_at:'2026-01-01T00:00:00Z',featured:i===2,youtube_id:null}));
window.fetch=async(input,options={})=>{const u=new URL(input,location.href);testRequests.push({url:u.href,method:options.method||'GET',body:options.body});
if(u.pathname.endsWith('/subscribers'))return {ok:testMode==='success',status:testMode==='duplicate'?409:testMode==='success'?201:500};
if(testMode==='error')return {ok:false,status:503};
const rows=testMode==='empty'||u.pathname.endsWith('/shorts')?[]:fixture.slice(Number(u.searchParams.get('offset')),Number(u.searchParams.get('offset'))+Number(u.searchParams.get('limit')));
return {ok:true,json:async()=>rows};};
</script><script src="assets/home.js"></script><script src="tests/home-harness.js"></script>'''
html=html.replace('</body>',bootstrap+'</body>')
(root/'tests/home-harness.html').write_text(html)

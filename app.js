/* =====================================================================
   Bid Pipeline — front end (plain JavaScript, no build step)
   Data, logins and files live in Supabase. See README.md for setup.
   ===================================================================== */

/* ---------- constants ---------- */
const SCOPES=[['earthwork','Earthwork'],['underground','Underground'],['erosion','Erosion control'],['demo','Site demo'],['paving','Paving & curb']];
const SCOPE_ST=['Not Started','In Progress','Complete','N/A'];
const SCOPE_CLS={'Not Started':'','In Progress':'warn','Complete':'good','N/A':'na'};
const PROPOSAL_ST=['Not Started','In Progress','Complete','Sent'];
const PROP_CLS={'Not Started':'','In Progress':'warn','Complete':'good','Sent':'info'};
const BID_ST=['Estimating','Submitted','On Hold','Awarded','Lost','No Bid'];
const BID_CLS={Estimating:'warn',Submitted:'info','On Hold':'',Awarded:'good',Lost:'bad','No Bid':'na'};
const ACTIVE=['Estimating','Submitted','On Hold'];
const QUOTE_ST=['Not requested','Requested','Received','Declined','No response'];
const QUOTE_CLS={'Not requested':'','Requested':'warn','Received':'good','Declined':'bad','No response':'na'};
const QUOTE_EXTRA=['Materials','Trucking','Testing','Other'];
const PERFORM=['Self perform','Sub','Both'];
const PERF_SHORT={'Self perform':'Self','Sub':'Sub','Both':'Self + sub'};
const DEFAULT_SUB=['Asphalt paving','Concrete paving','Curb & gutter','Sidewalks','Striping & signage','Fencing','Testing allowance','Retaining walls','Grassing & stabilization'];
const SCOPE_GROUPS=['Site prep & demo','Erosion control','Earthwork','Underground utilities','Paving & concrete','Other'];
const DEFAULT_LIB={scopes:[
  ['Clearing & grubbing','Site prep & demo'],['Site demolition','Site prep & demo'],['Tree protection','Site prep & demo'],['Construction entrance','Site prep & demo'],
  ['Erosion control','Erosion control'],['Sediment basin','Erosion control'],['Grassing & stabilization','Erosion control'],
  ['Mass grading','Earthwork'],['Fine grading','Earthwork'],['Building pad','Earthwork'],['Topsoil strip & respread','Earthwork'],['Undercut & replacement','Earthwork'],['Rock excavation','Earthwork'],['Import / export haul','Earthwork'],
  ['Storm drainage','Underground utilities'],['Sanitary sewer','Underground utilities'],['Water','Underground utilities'],['Fire line','Underground utilities'],['Detention / water quality','Underground utilities'],['Underground detention','Underground utilities'],
  ['Graded aggregate base','Paving & concrete'],['Asphalt paving','Paving & concrete'],['Concrete paving','Paving & concrete'],['Curb & gutter','Paving & concrete'],['Sidewalks','Paving & concrete'],['Striping & signage','Paving & concrete'],
  ['Retaining walls','Other'],['Fencing','Other'],['Traffic control','Other'],['Dewatering','Other'],['Testing allowance','Other']].map(([name,group])=>({name,group,perform:DEFAULT_SUB.includes(name)?'Sub':'Self perform'})),
 templates:[
  {id:'tpl-full',name:'Full site package',scopes:['Clearing & grubbing','Erosion control','Mass grading','Fine grading','Building pad','Storm drainage','Sanitary sewer','Water','Fire line','Graded aggregate base','Asphalt paving','Curb & gutter']},
  {id:'tpl-earth',name:'Earthwork only',scopes:['Clearing & grubbing','Erosion control','Mass grading','Fine grading','Building pad']},
  {id:'tpl-ug',name:'Underground utilities',scopes:['Storm drainage','Sanitary sewer','Water','Fire line','Detention / water quality']},
  {id:'tpl-demo',name:'Demo & clearing',scopes:['Site demolition','Clearing & grubbing','Tree protection','Erosion control']}]};
const TRADE_GROUP={'Pipe & utility supply':'Underground utilities','Precast structures':'Underground utilities','Utility sub':'Underground utilities','Erosion control':'Erosion control','Landscaping & grassing':'Erosion control','Demolition':'Site prep & demo','Clearing & grubbing':'Site prep & demo','Asphalt paving':'Paving & concrete','Concrete & curb':'Paving & concrete','Grading sub':'Earthwork','Dewatering':'Earthwork','Trucking & hauling':'Trucking','Stone & aggregate':'Materials','Testing & inspection':'Testing'};
const FILE_CATS=['Plans','Specs','Addenda','Geotech report','Takeoff','Proposal','Bid form','Photos','Other'];
const TRADES=['Pipe & utility supply','Precast structures','Stone & aggregate','Trucking & hauling','Asphalt paving','Concrete & curb','Erosion control','Demolition','Clearing & grubbing','Grading sub','Utility sub','Dewatering','Fencing','Landscaping & grassing','Surveying','Testing & inspection','Equipment rental','Other'];
const CLIENT_TYPES=['General contractor','Developer','Owner','Municipality / public','Other'];
const PROJECT_TYPES=['Commercial','Multifamily','Single-family','Industrial','Public / municipal','Institutional','Other'];
const BID_TYPES=['Hard bid','Negotiated','Budget / pricing','Design-assist'];
const LOST_REASONS=['','Price','Schedule','Relationship / incumbent','Project cancelled','Scope','Unknown'];
const ROLES=[['admin','Admin (precon manager)'],['estimator','Estimator'],['board','Board member'],['pending','No access yet']];
const ROLE_LABEL={admin:'Admin',estimator:'Estimator',board:'Board',pending:'Pending'};
const WIDGETS=[['kpis','Headline numbers'],['monthly','Bid and award volume by month'],['funnel','Pipeline by stage'],['clients','Top clients & GCs'],['estimators','Estimator performance'],['types','Project type mix'],['upcoming','Bids due in the next 30 days'],['lost','Why we lose']];
const AV_COLORS=['#2C5E99','#2C7A4C','#8B5E34','#7A3E8E','#B24A2A','#2F7C83','#5A6B1E','#9C3D5C'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const BUCKET='bid-files';
const BID_COLS=['id','name','location','project_type','bid_type','size','status','probability','due_date','due_time','walk_date','rfi_date','lead_estimator_id','support_estimator_ids','client_ids','client_contacts','client_proposals','awarded_client_id','addenda','revisions','scope_items','proposal_status','amount_with','amount_without','use_for','margin','follow_ups','notes','submitted_date','awarded_date','awarded_amount','awarded_to','lost_reason'];
const Q_COLS=['id','bid_id','vendor_id','scope','status','requested_date','due_date','received_date','amount','note','file_path','file_name'];
const ENT_COLS={estimators:['id','name','title','email','phone','active'],clients:['id','company','type','phone','email','address','notes','contacts'],vendors:['id','company','vendor_type','trade','scopes','contact_name','phone','email','area','preferred','notes']};
const VENDOR_TYPES=['Supplier','Subcontractor','Supplier & sub','Service / testing','Trucking'];

/* ---------- Supabase client with "remember me" ---------- */
const CFG=window.BID_PIPELINE_CONFIG||{};
const CONFIGURED=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey&&!/YOUR-/.test(CFG.supabaseUrl+CFG.supabaseAnonKey));
const INITIAL_HASH=location.hash;
const REMEMBER_KEY='bp-remember',EMAIL_KEY='bp-email';
// Remember me ON  → session kept in localStorage (stays signed in after closing the browser)
// Remember me OFF → session kept in sessionStorage (signed out when the browser closes)
const authStorage={
  getItem:k=>{try{return localStorage.getItem(k)??sessionStorage.getItem(k)}catch(e){return null}},
  setItem:(k,v)=>{try{if(localStorage.getItem(REMEMBER_KEY)==='0'){sessionStorage.setItem(k,v);localStorage.removeItem(k)}else{localStorage.setItem(k,v);sessionStorage.removeItem(k)}}catch(e){}},
  removeItem:k=>{try{localStorage.removeItem(k);sessionStorage.removeItem(k)}catch(e){}}
};
const sb=CONFIGURED?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{storage:authStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;


/* ---------- company branding (colors + logo from config.js) ---------- */
const BRAND=CFG.brand||{};
(function applyBrand(){
  const hex=/^#?([0-9a-f]{6})$/i.exec(String(BRAND.primary||'').trim());if(!hex)return;
  const n=parseInt(hex[1],16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;
  let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360}
  const c=(S2,L2)=>{S2=Math.max(0,Math.min(1,S2));L2=Math.max(0,Math.min(1,L2));const C=(1-Math.abs(2*L2-1))*S2,X=C*(1-Math.abs((h/60)%2-1)),m=L2-C/2;
    const [R,G,B]=h<60?[C,X,0]:h<120?[X,C,0]:h<180?[0,C,X]:h<240?[0,X,C]:h<300?[X,0,C]:[C,0,X];
    return '#'+[R,G,B].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('')};
  const top=/^#[0-9a-f]{6}$/i.test(BRAND.topBar||'')?BRAND.topBar:c(s*.9,Math.max(.1,l-.2));
  const dark=`--accent:${c(s*1.1,Math.min(.72,l+.2))};--accent-ink:${c(s,.08)};--accent-soft:${c(s*.8,.17)};--accent-2:${c(s*1.1,Math.min(.72,l+.2))};--top:${c(s*.8,.1)};--top-ink:#FFFFFF;--sel:${c(s*.9,.8)};--sel-ink:${c(s,.08)};`;
  const css=`:root{--accent:#${hex[1]};--accent-ink:${l>.62?'#111111':'#FFFFFF'};--accent-soft:${c(Math.min(s,.4),.92)};--accent-2:${c(s*1.05,Math.min(.8,l+.25))};--top:${top};--top-ink:#FFFFFF;--sel:${top};--sel-ink:#FFFFFF;}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}}}
:root[data-theme="dark"]{${dark}}`;
  const el=document.createElement('style');el.textContent=css;document.head.appendChild(el);
})();

/* ---------- state ---------- */
const TABLES=['bids','quotes','bid_files','estimators','clients','vendors','settings'];
const S={loading:true,session:null,profile:null,profileFor:null,needPassword:/type=(invite|recovery)/.test(INITIAL_HASH),authView:'login',authMsg:null,
  bids:[],quotes:[],bid_files:[],estimators:[],clients:[],vendors:[],profiles:[],settings:{},
  view:'dashboard',dash:'precon',filter:'active',q:{},estF:'',clientF:'',year:new Date().getFullYear()};
let channel=null;

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newId=()=>crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
const num=v=>(v===''||v==null||isNaN(+v))?null:+v;
const money=n=>n==null||isNaN(n)?'—':'$'+Math.round(+n).toLocaleString('en-US');
const moneyK=n=>{n=+n||0;const a=Math.abs(n);if(a>=1e6)return '$'+(n/1e6).toFixed(a>=1e7?1:2).replace(/\.?0+$/,'')+'M';if(a>=1e3)return '$'+Math.round(n/1e3)+'K';return '$'+Math.round(n)};
const pad=n=>String(n).padStart(2,'0');
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const parseD=s=>s?new Date(String(s).slice(0,10)+'T00:00:00'):null;
const daysUntil=s=>s?Math.round((parseD(s)-parseD(todayStr()))/864e5):null;
const fmtDate=s=>{if(!s)return '—';const d=parseD(s);return MONTHS[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear()};
const fmtShort=s=>{if(!s)return '—';const d=parseD(s);return MONTHS[d.getMonth()]+' '+d.getDate()};
const fmtTime=t=>{if(!t)return '';const[h,m]=t.split(':').map(Number);return (h%12||12)+':'+pad(m)+(h<12?' am':' pm')};
const fmtSize=b=>!b?'':b>1e6?(b/1e6).toFixed(1)+' MB':Math.max(1,Math.round(b/1e3))+' KB';
const clone=o=>JSON.parse(JSON.stringify(o));
const byId=(arr,id)=>arr.find(x=>x.id===id);
const estName=id=>byId(S.estimators,id)?.name||'';
const clientName=id=>byId(S.clients,id)?.company||'Removed client';
const vendorOf=id=>byId(S.vendors,id);
const initials=n=>(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
const avColor=id=>{let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return AV_COLORS[h%AV_COLORS.length]};
const avatar=(id,size)=>{const e=byId(S.estimators,id);if(!e)return '';return `<span class="av" style="background:${avColor(id)}${size?';width:'+size+'px;height:'+size+'px':''}" title="${esc(e.name)}">${esc(initials(e.name))}</span>`};
const pill=(t,c)=>`<span class="pill ${c||''}">${esc(t)}</span>`;
// Per-GC proposals: client_proposals = {client_id: {amount_with, amount_without, sent_date, status}}
// A blank GC amount falls back to the bid's base proposal.
const CP_ST=['Not sent','Sent','Lost'];
const propOf=(b,cid)=>(b.client_proposals||{})[cid]||{};
const pick=(b,w,o)=>b.use_for==='without'?(o??w):(w??o);
function clientAmount(b,cid){const p=propOf(b,cid);return pick(b,num(p.amount_with)??num(b.amount_with),num(p.amount_without)??num(b.amount_without))??0}
const bidValue=b=>{const base=pick(b,num(b.amount_with),num(b.amount_without));if(base!=null)return base;
  const a=(b.client_ids||[]).map(id=>clientAmount(b,id)).filter(Boolean);return a.length?Math.max(...a):0};
const wonValue=b=>num(b.awarded_amount)??(b.awarded_client_id?clientAmount(b,b.awarded_client_id):bidValue(b));
const clientWon=(b,cid)=>b.status==='Awarded'&&(b.awarded_client_id?b.awarded_client_id===cid:(b.client_ids||[]).length===1);
const clientLost=(b,cid)=>!clientWon(b,cid)&&(b.status==='Lost'||propOf(b,cid).status==='Lost'||(b.status==='Awarded'&&!!b.awarded_client_id));
/* ---- addenda & proposal revisions ---- */
const addenda=b=>Array.isArray(b.addenda)?b.addenda:[];
const revisions=b=>Array.isArray(b.revisions)?b.revisions:[];
const openAddenda=b=>addenda(b).filter(a=>!a.priced||!a.acknowledged);
function revSnap(b){const gcs={};(b.client_ids||[]).forEach(id=>{const p=propOf(b,id);gcs[id]={w:num(p.amount_with)??num(b.amount_with),o:num(p.amount_without)??num(b.amount_without)}});return{w:num(b.amount_with),o:num(b.amount_without),gcs}}
function snapValue(b,sn){if(!sn)return null;const base=pick(b,sn.w,sn.o);if(base!=null)return base;const a=Object.values(sn.gcs||{}).map(g=>pick(b,g.w,g.o)).filter(v=>v!=null);return a.length?Math.max(...a):null}
function addRevision(d,reason,auto){const r=revisions(d);d.revisions=r;r.push({id:newId(),rev:r.length?Math.max(...r.map(x=>+x.rev||0))+1:0,date:todayStr(),reason,addendum:'',snapshot:revSnap(d),by:myName(),auto:!!auto})}
// addenda issued after the latest revision on a bid that has gone out
function staleAddenda(b){const r=revisions(b);if(!r.length)return [];const last=r[r.length-1].date||'';const used=new Set(r.map(x=>String(x.addendum)));return addenda(b).filter(a=>a.date&&a.date>last&&!used.has(String(a.number)))}
function clientsLine(b,max=2){const ids=b.client_ids||[];if(!ids.length)return 'No client assigned';
  if(b.status==='Awarded'&&b.awarded_client_id)return 'Awarded by '+esc(clientName(b.awarded_client_id))+(ids.length>1?` <span class="dim">(bid to ${ids.length})</span>`:'');
  return ids.slice(0,max).map(id=>esc(clientName(id))).join(', ')+(ids.length>max?` +${ids.length-max} more`:'')}
const yearOf=b=>+(String(b.due_date||b.submitted_date||'').slice(0,4))||new Date(b.created_at||Date.now()).getFullYear();
const lastTouch=b=>(b.follow_ups||[]).map(f=>f.date).filter(Boolean).sort().pop()||b.submitted_date||'';
const needsFollowUp=b=>b.status==='Submitted'&&(!lastTouch(b)||daysUntil(lastTouch(b))<=-7);
const quotesFor=id=>S.quotes.filter(q=>q.bid_id===id);
const filesFor=id=>S.bid_files.filter(f=>f.bid_id===id).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
const openQuotes=b=>quotesFor(b.id).filter(q=>q.status==='Requested');
const lib=()=>S.settings.scope_library&&Array.isArray(S.settings.scope_library.scopes)?S.settings.scope_library:DEFAULT_LIB;
const libScope=name=>lib().scopes.find(x=>x.name.toLowerCase()===String(name).toLowerCase());
const groupOf=name=>libScope(name)?.group||'Other';
const vendorScopes=v=>Array.isArray(v?.scopes)?v.scopes:[];
const vendorFits=(v,name)=>vendorScopes(v).some(x=>x.toLowerCase()===String(name).toLowerCase());
const performOf=it=>PERFORM.includes(it.perform)?it.perform:'Self perform';
// scope_items: [{id,name,group,status,assignee_id,signed_initials,signed_by_name,signed_by_user,signed_by_estimator_id,signed_at}]
function scopeItems(b){
  if(Array.isArray(b.scope_items))return b.scope_items;
  return SCOPES.filter(([k])=>(b.scopes?.[k]||'N/A')!=='N/A').map(([k,l])=>({id:k,name:l,group:groupOf(l),status:b.scopes[k]}));
}
const scopeCls=x=>x.status==='Complete'?'good':x.status==='In Progress'?'warn':'';
const myInitials=()=>initials(myEst()?.name||S.profile?.full_name||S.session?.user?.email||'');
function toast(msg){const t=$('#toast');t.innerHTML=`<div class="toast">${esc(msg)}</div>`;clearTimeout(toast._t);toast._t=setTimeout(()=>t.innerHTML='',3800)}


/* ---------- pipeline progress (derived automatically from the bid) ---------- */
const STAGES=['Received','Takeoff','Quotes','Proposal','Submitted','Decision'];
const STAGE_NAMES=['Bid received','Scope takeoff','Vendor quotes','Proposal','Submitted to GC','Decision'];
function stageInfo(b,qs){
  qs=qs||quotesFor(b.id);
  const sc=scopeItems(b).map(x=>x.status||'Not Started');
  const decided=['Awarded','Lost','No Bid'].includes(b.status);
  const submitted=b.status==='Submitted'||b.status==='Awarded'||b.status==='Lost';
  const st=[1,
    sc.length&&sc.every(x=>x==='Complete')?1:sc.some(x=>x!=='Not Started')?.5:0,
    qs.length&&qs.every(q=>['Received','Declined','No response'].includes(q.status))?1:qs.some(q=>q.status==='Received')?.5:qs.length?.2:0,
    ['Complete','Sent'].includes(b.proposal_status)?1:b.proposal_status==='In Progress'?.5:0,
    submitted?1:0,
    decided?1:0];
  if(submitted)for(let i=0;i<4;i++)st[i]=1;              // once it's in, earlier steps count as done
  const current=decided?5:Math.max(0,st.findIndex(x=>x<1));
  const qOpen=qs.filter(q=>q.status==='Requested').length;
  const detail=[
    'Bid set up',
    sc.length?`${sc.filter(x=>x==='Complete').length} of ${sc.length} scopes signed off`:'No scopes selected yet',
    qs.length?`${qs.length-qOpen} of ${qs.length} quotes in`:'No quotes requested yet',
    'Proposal '+String(b.proposal_status||'Not Started').toLowerCase(),
    (b.client_ids||[]).length>1?`Sent to ${(b.client_ids||[]).filter(id=>['Sent','Lost','Awarded'].includes(propOf(b,id).status)).length} of ${b.client_ids.length} GCs · waiting on decision`:'Waiting on GC decision',
    b.status==='Awarded'?'Awarded':b.status==='Lost'?'Lost':b.status==='No Bid'?'Passed on this bid':''][current];
  return {st,current,detail,decided};
}
function progress(b,opts={}){
  const {st,current,detail,decided}=stageInfo(b,opts.quotes);
  const end=b.status==='Awarded'?'won':b.status==='Lost'?'lost':b.status==='No Bid'?'nobid':'';
  const bars=STAGES.map((s,i)=>{const cls=i===5&&decided?end:st[i]>=1?'done':i===current?'cur':'';
    return `<i class="${cls}"><b style="width:${Math.round((i===current&&!decided?Math.max(st[i],.12):st[i])*100)}%"></b></i>`}).join('');
  const labs=STAGES.map((s,i)=>`<span class="${i===current?(decided?end||'cur':'cur'):st[i]>=1?'done':''}">${i===5&&decided?esc(b.status):s}</span>`).join('');
  const hold=b.status==='On Hold'?' · on hold':'';
  return `<div class="prog${opts.lg?' lg':''}" title="${esc(STAGE_NAMES.map((n,i)=>n+': '+(st[i]>=1?'done':st[i]>0?'in progress':'not started')).join('\n'))}">
    <div class="prog-bar">${bars}</div><div class="prog-lab">${labs}</div>
    ${opts.lg?`<div class="prog-now">Step ${current+1} of 6 · <b>${STAGE_NAMES[current]}</b> — ${esc(detail)}${hold}</div>`:''}</div>`;
}

/* ---------- roles ---------- */
const role=()=>S.profile?.role||'pending';
const isAdmin=()=>role()==='admin';
const myEst=()=>S.estimators.find(e=>e.user_id&&e.user_id===S.session?.user?.id)||null;
const assigned=b=>{const me=myEst();return !!me&&(b.lead_estimator_id===me.id||(b.support_estimator_ids||[]).includes(me.id))};
const canWork=b=>isAdmin()||(role()==='estimator'&&assigned(b));
const myName=()=>S.profile?.full_name||myEst()?.name||S.session?.user?.email||'';

/* ---------- data ---------- */
async function loadTable(t){
  const {data,error}=await sb.from(t).select('*');
  if(error){console.error(t,error);return}
  S.lastLoaded=new Date();
  if(t==='settings')S.settings=Object.fromEntries((data||[]).map(r=>[r.key,r.value||{}]));
  else S[t]=data||[];
  schedule();
}
async function loadProfiles(){
  if(!isAdmin())return;
  const {data,error}=await sb.from('profiles').select('*').order('created_at');
  if(!error){S.profiles=data||[];schedule()}
}
const pending={};
function debounceLoad(t){clearTimeout(pending[t]);pending[t]=setTimeout(()=>loadTable(t),250)}
async function afterLogin(){
  const uid=S.session?.user?.id;if(!uid||S.profileFor===uid)return;S.profileFor=uid;
  const {data,error}=await sb.from('profiles').select('*').eq('id',uid).maybeSingle();
  if(error||!data){S.profile={role:'pending'};S.authMsg={err:'Your account has no profile yet. Ask your admin to check the database setup (see README).'}}
  else S.profile=data;
  if(role()==='board')S.dash='board';
  if(role()!=='pending'){
    await Promise.all(TABLES.map(loadTable));
    await loadProfiles();
    if(channel)sb.removeChannel(channel);
    channel=sb.channel('bid-pipeline').on('postgres_changes',{event:'*',schema:'public'},p=>{if(TABLES.includes(p.table))debounceLoad(p.table)}).subscribe();
  }
  S.loading=false;schedule();
}
function resetData(){TABLES.forEach(t=>{if(t!=='settings')S[t]=[]});S.settings={};S.profiles=[];S.profile=null;S.profileFor=null;S.view='dashboard';S.dash='precon';if(channel){sb.removeChannel(channel);channel=null}}
function errMsg(e){const m=(e&&(e.message||e.error_description))||'Something went wrong.';
  if(/row-level security|permission denied/i.test(m))return 'You don’t have permission to make that change.';
  if(/Failed to fetch|NetworkError/i.test(m))return 'Can’t reach the server. Check your connection and try again.';
  return m}
async function run(p){const {data,error}=await p;if(error)throw error;return data}

/* ---------- render loop ---------- */
let rq=0;
function schedule(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;render()})}
function render(){
  const main=$('#main');const top=$('#topwrap');
  if(!CONFIGURED){top.hidden=true;main.innerHTML=setupScreen();return}
  if(S.loading){top.hidden=true;main.innerHTML=`<div class="auth"><div class="spin" aria-label="Loading"></div></div>`;return}
  if(!S.session){top.hidden=true;main.innerHTML=authScreen();return}
  if(S.needPassword){top.hidden=true;main.innerHTML=setPasswordScreen();return}
  if(!S.profile){top.hidden=true;main.innerHTML=`<div class="auth"><div class="spin" aria-label="Loading"></div></div>`;return}
  if(role()==='pending'){top.hidden=true;main.innerHTML=pendingScreen();return}
  top.hidden=false;renderTop();
  const a=document.activeElement;const fid=a&&a.id&&main.contains(a)?a.id:null;const pos=fid?a.selectionStart:null;
  const views={dashboard:vDashboard,pipeline:vPipeline,estimators:vEstimators,clients:vClients,vendors:vVendors,scopes:vScopes,team:vTeam};
  if(!navItems().some(n=>n[0]===S.view))S.view='dashboard';
  main.innerHTML=views[S.view]();
  if(fid){const n=document.getElementById(fid);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}}
}
function navItems(){
  if(isAdmin())return [['dashboard','Dashboard'],['pipeline','Pipeline'],['estimators','Estimators'],['clients','Clients & GCs'],['vendors','Vendors'],['scopes','Scopes'],['team','Team & logins']];
  if(role()==='estimator')return [['dashboard','My dashboard'],['pipeline','My bids'],['vendors','Vendors'],['clients','Clients & GCs']];
  return [['dashboard','Board dashboard'],['pipeline','Pipeline']];
}
function renderTop(){
  const company=S.settings.general?.companyName||CFG.companyName||'Bid Pipeline';
  $('#top').innerHTML=`<button class="brand" ${isAdmin()?'data-act="company" title="Edit company name"':'tabindex="-1" style="cursor:default"'}>${BRAND.logo?`<img class="brand-logo" src="${esc(BRAND.logo)}" alt="">`:'<span class="stake"></span>'}<span><b>${esc(company)}</b><small>Bid pipeline</small></span></button>
  <nav class="nav">${navItems().map(([k,l])=>`<button class="${S.view===k?'on':''}" data-act="nav" data-v="${k}">${l}</button>`).join('')}</nav>
  <div class="userbox"><span>${esc(myName())}<br><span class="rolepill">${ROLE_LABEL[role()]}</span></span>
  ${isAdmin()?'<button class="btn primary" data-act="new-bid">+ New bid</button>':''}<button class="btn sm" data-act="signout">Sign out</button></div>`;
}

/* ---------- auth screens ---------- */
function brandBlock(){return BRAND.loginLogo?`<picture>${BRAND.loginLogoDark?`<source srcset="${esc(BRAND.loginLogoDark)}" media="(prefers-color-scheme: dark)">`:''}<img class="auth-logo" src="${esc(BRAND.loginLogo)}" alt="${esc(CFG.companyName||'')}"></picture>`:`<div class="auth-brand"><span class="stake"></span><div><b>${esc(CFG.companyName||'Bid Pipeline')}</b><small>Bid pipeline</small></div></div>`}
function msgBlock(){const m=S.authMsg;return m?(m.err?`<div class="err">${esc(m.err)}</div>`:`<div class="okmsg">${esc(m.ok)}</div>`):''}
function authScreen(){
  let remembered='',rememberOn=true;try{remembered=localStorage.getItem(EMAIL_KEY)||'';rememberOn=localStorage.getItem(REMEMBER_KEY)!=='0'}catch(e){}
  if(S.authView==='forgot')return `<div class="auth"><div class="auth-card">${brandBlock()}<h1>Reset your password</h1><p class="lead">We’ll email you a link to set a new one.</p>
    <form id="forgot-form">${msgBlock()}<label class="f">Email<input class="field" type="email" name="email" autocomplete="email" required value="${esc(remembered)}"></label>
    <button class="btn primary" type="submit">Send reset link</button><div class="rowx"><button type="button" class="linkbtn" data-act="auth-view" data-v="login">Back to sign in</button></div></form></div></div>`;
  return `<div class="auth"><div class="auth-card">${brandBlock()}<h1>Sign in</h1><p class="lead">Use the email your precon manager set up for you.</p>
  <form id="login-form">${msgBlock()}
   <label class="f">Email<input class="field" type="email" name="email" autocomplete="username" required value="${esc(remembered)}" ${remembered?'':'autofocus'}></label>
   <label class="f">Password<input class="field" type="password" name="password" autocomplete="current-password" required ${remembered?'autofocus':''}></label>
   <div class="rowx"><label class="check"><input type="checkbox" name="remember" ${rememberOn?'checked':''}> Remember me</label><button type="button" class="linkbtn" data-act="auth-view" data-v="forgot">Forgot password?</button></div>
   <button class="btn primary" type="submit">Sign in</button></form>
  <p class="hint" style="margin-top:14px">Don’t have a login? Ask your precon manager to add you.</p></div></div>`;
}
function setPasswordScreen(){return `<div class="auth"><div class="auth-card">${brandBlock()}<h1>Set your password</h1><p class="lead">Choose a password for ${esc(S.session?.user?.email||'your account')}.</p>
  <form id="password-form">${msgBlock()}<label class="f">New password<input class="field" type="password" name="p1" minlength="8" autocomplete="new-password" required autofocus></label>
  <label class="f">Confirm password<input class="field" type="password" name="p2" minlength="8" autocomplete="new-password" required></label>
  <button class="btn primary" type="submit">Save password</button></form></div></div>`}
function pendingScreen(){return `<div class="auth"><div class="auth-card">${brandBlock()}<h1>Almost there</h1><p class="lead">You’re signed in as ${esc(S.session?.user?.email)}, but an admin hasn’t given your account access yet. Ask your precon manager to set your role on the Team & logins page, then sign in again.</p>${msgBlock()}
  <div class="rowx"><button class="btn" data-act="recheck">Check again</button><button class="btn" data-act="signout">Sign out</button></div></div></div>`}
function setupScreen(){return `<div class="auth"><div class="auth-card">${brandBlock()}<h1>Connect Supabase</h1><p class="lead">This copy of the app isn’t connected to a database yet. Open <b>config.js</b> and paste your Supabase project URL and anon key, then reload. The README walks through every step.</p></div></div>`}

document.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target;const fd=new FormData(f);const btn=f.querySelector('button[type=submit]');
  const busy=t=>{btn.disabled=true;btn.textContent=t};
  if(f.id==='login-form'){
    const email=String(fd.get('email')).trim(),remember=!!fd.get('remember');
    try{localStorage.setItem(REMEMBER_KEY,remember?'1':'0');if(remember)localStorage.setItem(EMAIL_KEY,email);else localStorage.removeItem(EMAIL_KEY)}catch(x){}
    busy('Signing in…');
    const {error}=await sb.auth.signInWithPassword({email,password:String(fd.get('password'))});
    if(error){const m=error.message||'';S.authMsg={err:m==='Invalid login credentials'?'That email and password don’t match. Try again or reset your password.':/not confirmed/i.test(m)?'This email hasn’t been confirmed. In Supabase, delete the user and add it again with “Auto Confirm User” checked.':/api key|apikey|jwt|No API key/i.test(m)?'Supabase rejected the key in config.js. Copy the anon / public key again from Project Settings → API Keys.':'Sign-in failed: '+m};render()}
    else S.authMsg=null;
  }
  if(f.id==='forgot-form'){
    busy('Sending…');
    const {error}=await sb.auth.resetPasswordForEmail(String(fd.get('email')).trim(),{redirectTo:location.origin+location.pathname});
    S.authMsg=error?{err:errMsg(error)}:{ok:'Check your email for a reset link. It can take a minute to arrive.'};render();
  }
  if(f.id==='password-form'){
    const p1=String(fd.get('p1')),p2=String(fd.get('p2'));
    if(p1!==p2){S.authMsg={err:'The passwords don’t match.'};render();return}
    busy('Saving…');
    const {error}=await sb.auth.updateUser({password:p1});
    if(error){S.authMsg={err:errMsg(error)};render();return}
    S.needPassword=false;S.authMsg=null;history.replaceState(null,'',location.pathname);toast('Password saved');render();
  }
});

/* ---------- dashboard ---------- */
function vDashboard(){
  const d=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  if(role()==='estimator')return `<div class="head"><div><h1>My dashboard</h1><p>${d}</p></div></div>`+mine();
  if(role()==='board')return `<div class="head"><div><h1>Board dashboard</h1><p>${d}</p></div><div class="tools">${yearSelect()}</div></div>`+board();
  return `<div class="head"><div><h1>${S.dash==='precon'?'Bid pipeline dashboard':'Board dashboard'}</h1><p>${d}${S.lastLoaded?` · <span class="dim">Last updated ${S.lastLoaded.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span>`:''}</p></div>
  <div class="tools">${S.dash==='board'?yearSelect()+'<button class="btn" data-act="board-custom">Customize view</button>':'<button class="btn" data-act="refresh">↻ Refresh</button>'}
  <div class="seg" role="tablist"><button class="${S.dash==='precon'?'on':''}" data-act="dash" data-v="precon">Precon<small>Daily work</small></button><button class="${S.dash==='board'?'on':''}" data-act="dash" data-v="board">Board<small>Results & trends</small></button></div></div></div>`
  +(S.dash==='precon'?precon():board());
}
function yearSelect(){const ys=new Set([new Date().getFullYear()]);S.bids.forEach(b=>ys.add(yearOf(b)));return `<select class="field" data-act="year" style="width:auto">${[...ys].sort((a,b)=>b-a).map(y=>`<option${y===S.year?' selected':''}>${y}</option>`).join('')}</select>`}
function kpi(l,v,s,cls,filter){const tag=filter?'button':'div';return `<${tag} class="kpi ${cls||''}"${filter?` data-act="kpi-filter" data-v="${filter}"`:''}><div class="l">${l}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></${tag}>`}
function dueCell(b){
  if(!b.due_date)return '<span class="dim">No date</span>';
  const d=daysUntil(b.due_date);let cls='ok',txt='';
  if(b.status==='Submitted')txt='Submitted';
  else if(b.status!=='Estimating'&&b.status!=='On Hold')txt='';
  else if(d<0){cls='bad';txt=(-d)+' day'+(d===-1?'':'s')+' past due'}
  else if(d===0){cls='bad';txt='Due today'}
  else if(d<=3){cls='bad';txt='In '+d+' day'+(d===1?'':'s')}
  else if(d<=7){cls='warn';txt='In '+d+' days'}
  else txt='In '+d+' days';
  return `<div class="due ${cls}">${fmtDate(b.due_date)}${b.due_time?' <span class="dim small">'+esc(fmtTime(b.due_time))+'</span>':''}<small>${txt}</small></div>`;
}
function scopeBar(b){const it=scopeItems(b);if(!it.length)return '<span class="dim small">No scopes</span>';const d=it.filter(x=>x.status==='Complete').length;
  return `<span class="who" style="gap:8px"><span class="scopebar" title="${esc(it.map(x=>x.name+': '+(x.status==='Complete'?'signed off'+(x.signed_initials?' by '+x.signed_initials:''):x.status||'Not Started')).join('\n'))}">${it.slice(0,14).map(x=>`<i class="${scopeCls(x)}"></i>`).join('')}</span><span class="small num">${d}/${it.length}</span></span>`}
function bidTable(list,opts={}){
  const rows=list.map(b=>{const qs=quotesFor(b.id);const rec=qs.filter(q=>q.status==='Received').length;const me=myEst();
    return `<tr class="click" data-act="open-bid" data-id="${b.id}">
    <td><div class="proj">${esc(b.name)}</div><div class="dim small">${esc(b.location||b.project_type||'')}</div></td>
    <td>${(b.client_ids||[]).map(id=>`<div style="white-space:nowrap">${esc(clientName(id))}${clientWon(b,id)?' '+pill('Awarded','good'):''}${(b.client_ids.length>1&&clientAmount(b,id))?` <span class="dim small">${moneyK(clientAmount(b,id))}</span>`:''}</div>`).join('')||'<span class="dim">—</span>'}</td>
    ${opts.mine?`<td>${me&&b.lead_estimator_id===me.id?pill('Lead','hot'):pill('Support')}</td>`:`<td>${b.lead_estimator_id?`<span class="who">${avatar(b.lead_estimator_id)}${esc(estName(b.lead_estimator_id))}</span>`:'<span class="dim">Unassigned</span>'}</td>`}
    <td>${dueCell(b)}</td><td>${scopeBar(b)}</td><td>${pill(b.proposal_status||'Not Started',PROP_CLS[b.proposal_status])}</td>
    <td class="num">${qs.length?`${rec}/${qs.length}`:'<span class="dim">—</span>'}</td>
    <td class="num">${filesFor(b.id).length||'<span class="dim">—</span>'}</td>
    <td class="r num" style="font-weight:600">${bidValue(b)?money(bidValue(b)):'<span class="dim">—</span>'}</td>
    <td>${pill(b.status,BID_CLS[b.status])}<div class="dim small" style="margin-top:3px;white-space:nowrap">Step ${stageInfo(b).current+1}: ${STAGES[stageInfo(b).current]}</div></td></tr>`}).join('');
  return `<div class="panel scroll"><table><thead><tr><th>Project</th><th>Bidding to</th><th>${opts.mine?'My role':'Estimator'}</th><th>Due</th><th>Scope takeoff</th><th>Proposal</th><th>Quotes in</th><th>Files</th><th class="r">Bid value</th><th>Status</th></tr></thead>
   <tbody>${rows||`<tr><td colspan="10"><div class="empty"><b>No active bids</b>${opts.mine?'Bids your precon manager assigns to you will show up here.':'Add a new bid to get started.'}</div></td></tr>`}</tbody></table></div>`;
}
function quoteList(pairs,empty){return pairs.length?`<div class="list">${pairs.slice(0,12).map(({b,q})=>{const v=vendorOf(q.vendor_id);
  return `<div class="li"><div><button class="linkish" data-act="open-bid" data-id="${b.id}">${esc(v?.company||'Removed vendor')}</button><div class="dim small">${esc(q.scope||'')} for ${esc(b.name)}${q.requested_date?', asked '+fmtShort(q.requested_date):''}</div></div><div class="small">${q.due_date?'Need by '+fmtShort(q.due_date):b.due_date?'Bid '+fmtShort(b.due_date):''}</div></div>`}).join('')}</div>`:`<div class="empty">${empty}</div>`}

function precon(){
  const act=S.bids.filter(b=>ACTIVE.includes(b.status)).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
  const est=act.filter(b=>b.status==='Estimating');
  const due7=est.filter(b=>b.due_date&&daysUntil(b.due_date)>=0&&daysUntil(b.due_date)<=7);
  const past=est.filter(b=>b.due_date&&daysUntil(b.due_date)<0);
  const sub=act.filter(b=>b.status==='Submitted');
  const oq=act.flatMap(b=>openQuotes(b).map(q=>({b,q}))).sort((a,b)=>(a.q.due_date||a.b.due_date||'9').localeCompare(b.q.due_date||b.b.due_date||'9'));
  const fu=sub.filter(needsFollowUp);
  const val=act.reduce((s,b)=>s+bidValue(b),0);
  const Y=new Date().getFullYear();
  const yr=S.bids.filter(b=>yearOf(b)===Y);
  const proposed=yr.filter(b=>['Submitted','Awarded','Lost'].includes(b.status));
  const won=yr.filter(b=>b.status==='Awarded');
  const split=list=>{const w=list.filter(b=>bidValue(b)&&b.use_for!=='without').length,o=list.filter(b=>bidValue(b)&&b.use_for==='without').length;return `${w} w/ site, ${o} w/o site`};
  const kpis=`<div class="kpis">
    ${kpi('Active bids',act.length,'In pipeline','','active')}
    ${kpi('Due this week',due7.length,past.length?past.length+' past due':'Upcoming deadlines',due7.length||past.length?'hot':'','estimating')}
    ${kpi('Pending decision',sub.length,'Bids submitted','','submitted')}
    ${kpi('Awarded',won.length,won.length?moneyK(won.reduce((x,b)=>x+wonValue(b),0))+' this year':'This year','good','awarded')}
    ${kpi('Yearly proposals',moneyK(proposed.reduce((x,b)=>x+bidValue(b),0)),split(proposed))}
    ${kpi('Active bid value',moneyK(val),split(act),'good')}</div>`;
  const fuList=fu.map(b=>`<div class="li"><div><button class="linkish" data-act="open-bid" data-id="${b.id}">${esc(b.name)}</button><div class="dim small">${(b.client_ids||[]).map(clientName).map(esc).join(', ')||'No client'}</div></div><div class="small">${lastTouch(b)?'Last '+fmtShort(lastTouch(b)):'Never contacted'}</div></div>`).join('');
  const load=S.estimators.filter(e=>e.active!==false).map(e=>({e,n:est.filter(b=>b.lead_estimator_id===e.id||(b.support_estimator_ids||[]).includes(e.id)).length,soon:due7.filter(b=>b.lead_estimator_id===e.id).length}));
  const maxL=Math.max(1,...load.map(x=>x.n));
  const loadHtml=load.length?`<div class="hbars">${load.sort((a,b)=>b.n-a.n).map(x=>`<div class="hb"><span class="lab who">${avatar(x.e.id,22)}${esc(x.e.name)}</span><div class="track"><div class="fill ${x.soon?'acc':''}" style="width:${x.n/maxL*100}%"></div></div><span class="v">${x.n} bid${x.n===1?'':'s'}${x.soon?` · ${x.soon} due soon`:''}</span></div>`).join('')}</div>`:`<div class="empty"><b>No estimators yet</b><button class="btn sm" data-act="nav" data-v="estimators">Add estimators</button></div>`;
  const closed=yr.filter(b=>['Awarded','Lost','No Bid'].includes(b.status)).sort((a,b)=>(b.awarded_date||b.due_date||'').localeCompare(a.awarded_date||a.due_date||''));
  return kpis+`<div class="sec"><div class="sec-h"><h2>Projects overview</h2><span>Active bids and upcoming deadlines · click a row to open it</span></div>${overviewTable(act)}</div>
  ${closed.length?`<div class="sec"><div class="sec-h"><h2>Closed this year</h2><span>Awarded, lost and no-bid</span></div>${closedTable(closed)}</div>`:''}
  <div class="grid3">
    <div class="sec"><div class="sec-h"><h2>Estimator workload</h2><span>Bids in estimating</span></div><div class="panel pad">${loadHtml}</div></div>
    <div class="sec"><div class="sec-h"><h2>Quotes outstanding</h2><span>${oq.length}</span></div><div class="panel pad">${quoteList(oq,'All requested quotes are in.')}</div></div>
    <div class="sec"><div class="sec-h"><h2>Follow-ups needed</h2><span>${fu.length}</span></div><div class="panel pad"><div class="list">${fuList||'<div class="empty">Every submitted bid has a recent follow-up.</div>'}</div></div></div></div>`;
}
// Scope columns for the overview: each groups related scopes from the scope library
const OV_GROUPS=[['Earthwork',['Earthwork']],['Underground',['Underground utilities']],['Erosion / demo',['Erosion control','Site prep & demo']],['Paving',['Paving & concrete']],['Other',['Other']]];
function groupStatus(b,groups){
  const it=scopeItems(b).filter(x=>groups.includes(x.group||groupOf(x.name)));
  if(!it.length)return '<span class="dim">—</span>';
  const done=it.filter(x=>x.status==='Complete').length,started=it.some(x=>x.status==='In Progress');
  const tip=esc(it.map(x=>x.name+' ('+performOf(x)+'): '+(x.status==='Complete'?'signed off'+(x.signed_initials?' ('+x.signed_initials+')':''):x.status||'Not Started')).join('\n'));
  const count=it.length>1?` <span class="ov-n">${done}/${it.length}</span>`:'';
  const pf=[...new Set(it.map(performOf))];const perf=pf.length===1&&pf[0]==='Self perform'?'':`<div class="dim small" style="margin-top:3px">${pf.length===1?(pf[0]==='Sub'?'Sub':'Self + sub'):'Mixed'}</div>`;
  if(done===it.length)return `<span class="pill good" title="${tip}">✓ Complete${it.length===1&&it[0].signed_initials?' · '+esc(it[0].signed_initials):count}</span>${perf}`;
  if(done||started)return `<span class="pill warn" title="${tip}">In progress${count}</span>${perf}`;
  return `<span class="pill" title="${tip}">Not started${count}</span>${perf}`;
}
function amtCell(b,key){
  const base=num(b[key]);if(base!=null)return money(base);
  const a=(b.client_ids||[]).map(id=>num(propOf(b,id)[key])).filter(v=>v!=null);
  if(!a.length)return '<span class="dim">—</span>';
  const lo=Math.min(...a),hi=Math.max(...a);return lo===hi?money(hi):`${moneyK(lo)}–${moneyK(hi)}`;
}
function overviewTable(list){
  const groups=OV_GROUPS.filter(([l,g])=>['Earthwork','Underground','Erosion / demo'].includes(l)||list.some(b=>scopeItems(b).some(x=>g.includes(x.group||groupOf(x.name)))));
  const rows=list.map(b=>`<tr class="click" data-act="open-bid" data-id="${b.id}">
    <td><div class="proj">${esc(b.name)}</div>${b.lead_estimator_id?`<div class="dim small">${esc(estName(b.lead_estimator_id))}</div>`:''}</td>
    <td>${(b.client_ids||[]).map(id=>`<div style="white-space:nowrap">${esc(clientName(id))}</div>`).join('')||'<span class="dim">—</span>'}</td>
    <td>${dueCell(b)}</td>
    ${groups.map(([,g])=>`<td>${groupStatus(b,g)}</td>`).join('')}
    <td>${pill(b.proposal_status||'Not Started',PROP_CLS[b.proposal_status])}${revisions(b).length>1?`<div class="dim small" style="margin-top:3px">Rev ${esc(revisions(b)[revisions(b).length-1].rev)}</div>`:''}${openAddenda(b).length?`<div class="small" style="margin-top:3px;color:var(--warn);font-weight:600;white-space:nowrap">${openAddenda(b).length} addend${openAddenda(b).length===1?'um':'a'} open</div>`:''}</td>
    <td class="r num">${amtCell(b,'amount_with')}</td>
    <td class="r num">${amtCell(b,'amount_without')}</td>
    <td class="r num" style="font-weight:700">${bidValue(b)?money(bidValue(b))+` <span class="dim small">${b.use_for==='without'?'w/o':'w/'}</span>`:'<span class="dim">—</span>'}</td>
    <td>${lastTouch(b)?fmtShort(lastTouch(b)):'<span class="dim">—</span>'}</td>
    <td>${pill(b.status,BID_CLS[b.status])}</td></tr>`).join('');
  return `<div class="panel scroll"><table class="ov"><thead><tr><th>Project</th><th>GC / client</th><th>Due date</th>${groups.map(([l])=>`<th>${l}</th>`).join('')}<th>Proposal</th><th class="r">W/ site impr.</th><th class="r">W/O site impr.</th><th class="r">Dashboard $</th><th>Last GC contact</th><th>Status</th></tr></thead>
   <tbody>${rows||`<tr><td colspan="${9+groups.length}"><div class="empty"><b>No active bids</b>${isAdmin()?'Click <b>+ New bid</b> to add one.':''}</div></td></tr>`}</tbody></table></div>`;
}
function closedTable(list){
  return `<div class="panel scroll"><table><thead><tr><th>Project</th><th>GC / client</th><th>Due date</th><th class="r">W/ site impr.</th><th class="r">W/O site impr.</th><th class="r">Contract</th><th>Status</th></tr></thead><tbody>
  ${list.slice(0,20).map(b=>`<tr class="click" data-act="open-bid" data-id="${b.id}"><td class="proj">${esc(b.name)}</td><td>${clientsLine(b,3)}</td><td>${fmtDate(b.due_date)}</td>
    <td class="r num">${amtCell(b,'amount_with')}</td><td class="r num">${amtCell(b,'amount_without')}</td>
    <td class="r num" style="font-weight:700">${b.status==='Awarded'?money(wonValue(b)):'<span class="dim">—</span>'}</td><td>${pill(b.status,BID_CLS[b.status])}${b.status==='Lost'&&b.lost_reason?`<div class="dim small">${esc(b.lost_reason)}</div>`:''}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function setupGuide(){
  const step=(done,t,d,v)=>`<div class="li"><div><b style="font-weight:600">${done?'✓ ':''}${t}</b><div class="dim small">${d}</div></div>${v?`<button class="btn sm" data-act="${v==='new-bid'?'new-bid':'nav'}" data-v="${v}">${done?'Open':'Start'}</button>`:''}</div>`;
  return `<div class="sec"><div class="sec-h"><h2>Set up your pipeline</h2></div><div class="panel pad"><div class="list">
  ${step(!!S.settings.general?.companyName,'Name your company','Click the name in the top-left corner.','')}
  ${step(S.estimators.length>0,'Add your estimators','Use the same email they log in with so their account links automatically.','estimators')}
  ${step(S.profiles.length>1,'Give your team logins','Add people in Supabase, then set their role on the Team & logins page.','team')}
  ${step(S.clients.length>0,'Add clients and GCs','Store companies and their contacts once, then pick them on each bid.','clients')}
  ${step(S.vendors.length>0,'Build your vendor list','Suppliers and subs by trade, so anyone on a bid can request and log quotes.','vendors')}
  ${step(false,'Enter your first bid','Assign estimators, GCs and vendors from the lists above.','new-bid')}</div></div></div>`;
}

/* ----- estimator personal view ----- */
function mine(){
  const me=myEst();
  if(!me)return `<div class="notice">Your login isn’t linked to an estimator record yet, so no bids can be assigned to you. Ask your precon manager to link your account on the Team & logins page.</div>`;
  const my=S.bids.filter(assigned);
  const act=my.filter(b=>ACTIVE.includes(b.status)).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
  const est=act.filter(b=>b.status==='Estimating');
  const due7=est.filter(b=>b.due_date&&daysUntil(b.due_date)>=0&&daysUntil(b.due_date)<=7);
  const oq=act.flatMap(b=>openQuotes(b).map(q=>({b,q}))).sort((a,b)=>(a.q.due_date||a.b.due_date||'9').localeCompare(b.q.due_date||b.b.due_date||'9'));
  const yr=my.filter(b=>yearOf(b)===new Date().getFullYear());
  const dates=[];act.forEach(b=>{[['due_date','Bid due'],['walk_date','Site walk'],['rfi_date','RFI deadline']].forEach(([k,l])=>{const d=daysUntil(b[k]);if(b[k]&&d>=0&&d<=21)dates.push({b,l,date:b[k],d})})});
  dates.sort((a,b)=>a.date.localeCompare(b.date));
  const recent=S.bid_files.filter(f=>my.some(b=>b.id===f.bid_id)).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).slice(0,8);
  return `<div class="kpis">
    ${kpi('My active bids',act.length,est.length+' estimating','','active')}
    ${kpi('Due in 7 days',due7.length,due7.length?'Next: '+esc(due7[0].name):'Nothing this week',due7.length?'hot':'','estimating')}
    ${kpi('Quotes outstanding',oq.length,'On my bids',oq.length?'hot':'')}
    ${kpi('Submitted',act.filter(b=>b.status==='Submitted').length,'Awaiting decision','','submitted')}
    ${kpi('Bids this year',yr.length,yr.filter(b=>b.status==='Awarded').length+' awarded')}
    ${kpi('My active value',moneyK(act.reduce((s,b)=>s+bidValue(b),0)),'Across my active bids','good')}</div>
  <div class="sec"><div class="sec-h"><h2>My bids</h2><span>Open a bid to see details, request quotes and upload files</span></div>${bidTable(act,{mine:true})}</div>
  ${(()=>{const open=act.flatMap(b=>scopeItems(b).filter(x=>x.status!=='Complete'&&(!x.assignee_id||x.assignee_id===me.id)).map(x=>({b,x})));
    return `<div class="sec"><div class="sec-h"><h2>Scopes to sign off</h2><span>${open.length} open on your bids</span></div><div class="panel pad">${open.length?`<div class="list">${open.slice(0,15).map(({b,x})=>`<div class="li"><div><button class="linkish" data-act="open-bid" data-id="${b.id}">${esc(x.name)}</button><div class="dim small">${esc(b.name)}${b.due_date?' · bid due '+fmtShort(b.due_date):''}</div></div><div style="text-align:right">${pill(x.status||'Not Started',scopeCls(x))}<div class="dim small">${x.assignee_id===me.id?'Assigned to you':'Whole team'}</div></div></div>`).join('')}</div>`:'<div class="empty">Every scope on your bids is signed off.</div>'}</div></div>`})()}
  <div class="grid3">
   <div class="sec"><div class="sec-h"><h2>Key dates</h2><span>Next 3 weeks</span></div><div class="panel pad">${dates.length?`<div class="list">${dates.map(x=>`<div class="li"><div><button class="linkish" data-act="open-bid" data-id="${x.b.id}">${esc(x.b.name)}</button><div class="dim small">${x.l}</div></div><div class="small" style="text-align:right"><b>${fmtShort(x.date)}</b><div class="dim">${x.d===0?'Today':'In '+x.d+' day'+(x.d===1?'':'s')}</div></div></div>`).join('')}</div>`:'<div class="empty">No bid dates, site walks or RFI deadlines coming up.</div>'}</div></div>
   <div class="sec"><div class="sec-h"><h2>Quotes outstanding</h2><span>${oq.length}</span></div><div class="panel pad">${quoteList(oq,'All requested quotes on your bids are in.')}</div></div>
   <div class="sec"><div class="sec-h"><h2>Recent files</h2><span>On my bids</span></div><div class="panel pad">${recent.length?`<div class="list">${recent.map(f=>`<div class="li"><div><button class="linkish" data-act="dl" data-path="${esc(f.file_path)}" data-name="${esc(f.file_name)}">${esc(f.file_name)}</button><div class="dim small">${esc(f.category)} · ${esc(byId(S.bids,f.bid_id)?.name||'')}</div></div><div class="dim small">${fmtShort(String(f.created_at).slice(0,10))}</div></div>`).join('')}</div>`:'<div class="empty">No files uploaded yet.</div>'}</div></div>
  </div>`;
}

/* ----- board ----- */
function boardCfg(){const d={};WIDGETS.forEach(([k])=>d[k]=true);return Object.assign(d,S.settings.board?.widgets||{})}
function panel(t,sub,body){return `<div class="sec" style="margin:0"><div class="sec-h"><h2>${esc(t)}</h2><span>${sub}</span></div><div class="panel pad">${body}</div></div>`}
function hbars(items){return `<div class="hbars">${items.map(x=>`<div class="hb"><span class="lab">${esc(x.l)}</span><div class="track"><div class="fill ${x.c||''}" style="width:${Math.max(0,x.w*100)}%"></div></div><span class="v">${esc(x.v)}</span></div>`).join('')}</div>`}
function board(){
  const Y=S.year,cfg=boardCfg();
  const yb=S.bids.filter(b=>yearOf(b)===Y);
  const sub=yb.filter(b=>['Submitted','Awarded','Lost'].includes(b.status));
  const won=yb.filter(b=>b.status==='Awarded'),lost=yb.filter(b=>b.status==='Lost');
  const subVal=sub.reduce((s,b)=>s+bidValue(b),0),wonVal=won.reduce((s,b)=>s+wonValue(b),0);
  const decided=won.length+lost.length;const winRate=decided?Math.round(won.length/decided*100):null;
  const decVal=[...won,...lost].reduce((s,b)=>s+bidValue(b),0);
  const dollarRate=decVal?Math.round(won.reduce((s,b)=>s+bidValue(b),0)/decVal*100):null;
  const act=S.bids.filter(b=>ACTIVE.includes(b.status));
  const weighted=act.reduce((s,b)=>s+bidValue(b)*(num(b.probability)??50)/100,0);
  const out=[];
  if(cfg.kpis)out.push(`<div class="wide"><div class="kpis" style="margin:0">
    ${kpi('Bids submitted',sub.length,moneyK(subVal)+' total in '+Y)}
    ${kpi('Awarded',moneyK(wonVal),won.length+' project'+(won.length===1?'':'s')+' won','good')}
    ${kpi('Win rate',winRate==null?'—':winRate+'%',decided?`${won.length} of ${decided} decided`:'No decisions yet')}
    ${kpi('Dollar hit rate',dollarRate==null?'—':dollarRate+'%','Won $ ÷ decided $')}
    ${kpi('Open pipeline',moneyK(act.reduce((s,b)=>s+bidValue(b),0)),act.length+' active bids')}
    ${kpi('Weighted pipeline',moneyK(weighted),'Value × win probability','hot')}</div></div>`);
  if(cfg.monthly){
    const m=MONTHS.map((l,i)=>({l,s:sub.filter(b=>parseD(b.due_date||b.submitted_date)?.getMonth()===i).reduce((a,b)=>a+bidValue(b),0),
      w:won.filter(b=>parseD(b.awarded_date||b.due_date)?.getMonth()===i).reduce((a,b)=>a+wonValue(b),0)}));
    const mx=Math.max(1,...m.flatMap(x=>[x.s,x.w]));const any=m.some(x=>x.s||x.w);
    out.push(`<div class="wide">${panel('Bid and award volume by month',`<span class="legend"><span><i style="background:var(--bar);opacity:.8"></i>Bid</span><span><i style="background:var(--accent)"></i>Awarded</span></span>`,
      any?`<div class="mchart">${m.map(x=>`<div class="mcol" title="${x.l}: bid ${money(x.s)}, awarded ${money(x.w)}"><div class="mbars"><i class="b1" style="height:${x.s/mx*100}%"></i><i class="b2" style="height:${x.w/mx*100}%"></i></div><span>${x.l}</span></div>`).join('')}</div>`:`<div class="empty">No submitted or awarded bids in ${Y} yet.</div>`)}</div>`);
  }
  if(cfg.funnel){
    const st=BID_ST.map(s=>{const bs=yb.filter(b=>b.status===s);return{l:s,n:bs.length,v:bs.reduce((a,b)=>a+(s==='Awarded'?wonValue(b):bidValue(b)),0)}});
    const mx=Math.max(1,...st.map(x=>x.v));const cls={Estimating:'acc',Submitted:'info',Awarded:'good',Lost:'bad'};
    out.push(panel('Pipeline by stage',Y+'',hbars(st.map(x=>({l:x.l,w:x.v/mx,v:`${moneyK(x.v)} · ${x.n}`,c:cls[x.l]||''})))));
  }
  if(cfg.clients){
    const g={};yb.forEach(b=>(b.client_ids||[]).forEach(id=>{g[id]=g[id]||{n:0,v:0,w:0,d:0};g[id].n++;g[id].v+=clientAmount(b,id);if(clientWon(b,id)){g[id].w++;g[id].d++}else if(clientLost(b,id))g[id].d++}));
    const rows=Object.entries(g).sort((a,b)=>b[1].v-a[1].v).slice(0,8);
    out.push(panel('Top clients & GCs','By dollars bid',rows.length?`<div class="scroll"><table><thead><tr><th>Client</th><th class="r">Bids</th><th class="r">$ bid</th><th class="r">Won</th><th class="r">Win rate</th></tr></thead><tbody>${rows.map(([id,x])=>`<tr><td>${esc(clientName(id))}</td><td class="r num">${x.n}</td><td class="r num">${moneyK(x.v)}</td><td class="r num">${x.w}</td><td class="r num">${x.d?Math.round(x.w/x.d*100)+'%':'—'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No client data for this year.</div>'));
  }
  if(cfg.estimators){
    const rows=S.estimators.map(e=>{const bs=yb.filter(b=>b.lead_estimator_id===e.id);const w=bs.filter(b=>b.status==='Awarded').length,l=bs.filter(b=>b.status==='Lost').length;
      return{e,n:bs.length,v:bs.reduce((a,b)=>a+bidValue(b),0),w,r:w+l?Math.round(w/(w+l)*100)+'%':'—'}}).filter(x=>x.n).sort((a,b)=>b.v-a.v);
    out.push(panel('Estimator performance','As lead estimator',rows.length?`<div class="scroll"><table><thead><tr><th>Estimator</th><th class="r">Bids</th><th class="r">$ bid</th><th class="r">Won</th><th class="r">Win rate</th></tr></thead><tbody>${rows.map(x=>`<tr><td><span class="who">${avatar(x.e.id,22)}${esc(x.e.name)}</span></td><td class="r num">${x.n}</td><td class="r num">${moneyK(x.v)}</td><td class="r num">${x.w}</td><td class="r num">${x.r}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No estimator data for this year.</div>'));
  }
  if(cfg.types){
    const g={};yb.forEach(b=>{const k=b.project_type||'Other';g[k]=(g[k]||0)+bidValue(b)});
    const e=Object.entries(g).sort((a,b)=>b[1]-a[1]);const mx=Math.max(1,...e.map(x=>x[1]));
    out.push(panel('Project type mix','Dollars bid',e.length?hbars(e.map(([l,v])=>({l,w:v/mx,v:moneyK(v)}))):'<div class="empty">No bids this year.</div>'));
  }
  if(cfg.upcoming){
    const up=S.bids.filter(b=>b.status==='Estimating'&&b.due_date&&daysUntil(b.due_date)>=0&&daysUntil(b.due_date)<=30).sort((a,b)=>a.due_date.localeCompare(b.due_date));
    out.push(panel('Bids due in the next 30 days',up.length+' bids · '+moneyK(up.reduce((s,b)=>s+bidValue(b),0)),up.length?`<div class="list">${up.map(b=>`<div class="li"><div><b style="font-weight:600">${esc(b.name)}</b><div class="dim small">${(b.client_ids||[]).map(clientName).map(esc).join(', ')||esc(b.project_type||'')}</div></div><div style="text-align:right"><div class="num" style="font-weight:600">${bidValue(b)?money(bidValue(b)):'Pricing'}</div><div class="dim small">${fmtShort(b.due_date)}</div></div></div>`).join('')}</div>`:'<div class="empty">Nothing due in the next 30 days.</div>'));
  }
  if(cfg.lost){
    const g={};lost.forEach(b=>{const k=b.lost_reason||'Not recorded';g[k]=(g[k]||0)+1});
    const e=Object.entries(g).sort((a,b)=>b[1]-a[1]);const mx=Math.max(1,...e.map(x=>x[1]));
    out.push(panel('Why we lose',lost.length+' lost in '+Y,e.length?hbars(e.map(([l,v])=>({l,w:v/mx,v:v+'',c:'bad'}))):'<div class="empty">No lost bids recorded this year.</div>'));
  }
  if(!out.length)return `<div class="panel"><div class="empty"><b>No sections selected</b>${isAdmin()?'<button class="btn sm" data-act="board-custom">Choose what to show</button>':'Ask your precon manager to choose what this view shows.'}</div></div>`;
  return `<div class="widgets">${out.join('')}</div>`;
}

/* ----- pipeline ----- */
const FILTERS=[['active','All active',b=>ACTIVE.includes(b.status)],['estimating','Estimating',b=>b.status==='Estimating'],['submitted','Submitted',b=>b.status==='Submitted'],['hold','On hold',b=>b.status==='On Hold'],['awarded','Awarded',b=>b.status==='Awarded'],['lost','Lost / no bid',b=>b.status==='Lost'||b.status==='No Bid'],['all','Everything',()=>true]];
function vPipeline(){
  const q=(S.q.pipe||'').toLowerCase();const est=role()==='estimator';
  const pool=est?S.bids.filter(assigned):S.bids;
  const base=pool.filter(b=>(!S.estF||b.lead_estimator_id===S.estF||(b.support_estimator_ids||[]).includes(S.estF))&&(!S.clientF||(b.client_ids||[]).includes(S.clientF))
    &&(!q||[b.name,b.location,...(b.client_ids||[]).map(clientName)].join(' ').toLowerCase().includes(q)));
  const f=FILTERS.find(x=>x[0]===S.filter)||FILTERS[0];
  const list=base.filter(f[2]).sort((a,b)=>ACTIVE.includes(a.status)?(a.due_date||'9999').localeCompare(b.due_date||'9999'):(b.due_date||'').localeCompare(a.due_date||''));
  return `<div class="head"><div><h1>${est?'My bids':'Pipeline'}</h1><p>${pool.length} bid${pool.length===1?'':'s'}${est?' assigned to you':' on file'}</p></div><div class="tools">${est?'':'<button class="btn" data-act="export-xlsx">Export Excel</button><button class="btn ghost" data-act="export">CSV</button>'}${isAdmin()?'<button class="btn" data-act="import">Import from Excel</button><button class="btn primary" data-act="new-bid">+ New bid</button>':''}</div></div>
  <div class="bar">${FILTERS.map(([k,l,fn])=>`<button class="chip ${S.filter===k?'on':''}" data-act="filter" data-v="${k}">${l}<b>${base.filter(fn).length}</b></button>`).join('')}</div>
  <div class="bar"><input id="q-pipe" class="field search" placeholder="Search projects, locations, GCs" value="${esc(S.q.pipe||'')}" data-q="pipe">
   ${est?'':`<select class="field" data-act="estF"><option value="">All estimators</option>${S.estimators.map(e=>`<option value="${e.id}"${S.estF===e.id?' selected':''}>${esc(e.name)}</option>`).join('')}</select>`}
   <select class="field" data-act="clientF"><option value="">All clients & GCs</option>${S.clients.slice().sort((a,b)=>a.company.localeCompare(b.company)).map(c=>`<option value="${c.id}"${S.clientF===c.id?' selected':''}>${esc(c.company)}</option>`).join('')}</select></div>
  ${list.length?`<div class="cards">${list.map(card).join('')}</div>`:`<div class="panel"><div class="empty"><b>No bids match</b>${pool.length?'Try a different filter or search.':est?'Bids assigned to you will appear here.':'Create your first bid to fill the pipeline.'}</div></div>`}`;
}
function scopePills(b){const it=scopeItems(b);if(!it.length)return '<span class="dim small">No scopes selected</span>';
  return it.slice(0,6).map(x=>`<span class="pill ${scopeCls(x)}" title="${esc(x.name+': '+(x.status||'Not Started')+' · '+performOf(x))}">${esc(x.name)}${performOf(x)!=='Self perform'?` <span class="perf-tag">${PERF_SHORT[performOf(x)]==='Sub'?'Sub':'S+S'}</span>`:''}${x.status==='Complete'?' ✓'+(x.signed_initials?' '+esc(x.signed_initials):''):''}</span>`).join('')+(it.length>6?`<span class="pill na">+${it.length-6} more</span>`:'')}
function card(b){
  const qs=quotesFor(b.id);const rec=qs.filter(q=>q.status==='Received').length;const v=bidValue(b);const nf=filesFor(b.id).length;
  const team=[b.lead_estimator_id,...(b.support_estimator_ids||[])].filter(id=>byId(S.estimators,id));
  return `<div class="card" role="button" tabindex="0" data-act="open-bid" data-id="${b.id}">
   <div class="card-top"><div><h3>${esc(b.name)}</h3><div class="meta">${clientsLine(b)}</div></div>${pill(b.status,BID_CLS[b.status])}</div>
   ${progress(b)}
   <div class="row">${dueCell(b)}<div style="text-align:right">${v?`<div class="val">${money(v)}</div><div class="dim small">${b.use_for==='without'?'Without':'With'} site improvements</div>`:`<div class="dim small">Proposal ${esc((b.proposal_status||'Not Started').toLowerCase())}</div>`}</div></div>
   <div class="scopes">${scopePills(b)}</div>
   <div class="foot"><span class="who" style="gap:3px">${team.map(id=>avatar(id,24)).join('')||'<span class="dim small">No estimator</span>'}</span>
   <span class="dim small" style="margin-left:auto">${qs.length?`Quotes ${rec}/${qs.length} in`:'No vendor quotes'}${nf?` · ${nf} file${nf===1?'':'s'}`:''}${addenda(b).length?` · ${addenda(b).length} add.${openAddenda(b).length?` <b style="color:var(--warn)">(${openAddenda(b).length} open)</b>`:''}`:''}${revisions(b).length>1?` · Rev ${revisions(b)[revisions(b).length-1].rev}`:''}</span></div></div>`;
}

/* ----- directories ----- */
function dbHead(title,sub,act,label,importType){return `<div class="head"><div><h1>${title}</h1><p>${sub}</p></div><div class="tools">${isAdmin()&&importType?`<button class="btn" data-act="import" data-type="${importType}">Import from Excel</button>`:''}${isAdmin()?`<button class="btn primary" data-act="${act}">${label}</button>`:''}</div></div>`}
function vEstimators(){
  const q=(S.q.est||'').toLowerCase();const list=S.estimators.filter(e=>!q||(e.name+' '+e.title+' '+e.email).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
  return dbHead('Estimators',S.estimators.length+' people','new-est','+ Add estimator')+`<div class="bar"><input id="q-est" class="field search" data-q="est" placeholder="Search estimators" value="${esc(S.q.est||'')}"></div>
  <div class="panel scroll"><table><thead><tr><th>Name</th><th>Title</th><th>Contact</th><th>Login</th><th class="r">Active bids</th><th class="r">Bids this year</th><th class="r">Won this year</th><th>Status</th></tr></thead><tbody>
  ${list.map(e=>{const mine=S.bids.filter(b=>b.lead_estimator_id===e.id||(b.support_estimator_ids||[]).includes(e.id));const y=mine.filter(b=>yearOf(b)===new Date().getFullYear());
   return `<tr class="click" data-act="open-est" data-id="${e.id}"><td><span class="who">${avatar(e.id)}<b style="font-weight:600">${esc(e.name)}</b></span></td><td>${esc(e.title)}</td><td class="small">${esc(e.email)}${e.phone?'<br>'+esc(e.phone):''}</td><td>${e.user_id?pill('Linked','good'):pill('No login')}</td><td class="r num">${mine.filter(b=>ACTIVE.includes(b.status)).length}</td><td class="r num">${y.length}</td><td class="r num">${y.filter(b=>b.status==='Awarded').length}</td><td>${e.active===false?pill('Inactive'):pill('Active','good')}</td></tr>`}).join('')
  ||`<tr><td colspan="8"><div class="empty"><b>No estimators yet</b>Add the people who price your work.</div></td></tr>`}</tbody></table></div>`;
}
function vClients(){
  const q=(S.q.cl||'').toLowerCase();const list=S.clients.filter(c=>!q||[c.company,c.type,...(c.contacts||[]).map(x=>x.name)].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.company.localeCompare(b.company));
  const showStats=role()!=='estimator';
  return dbHead('Clients & GCs',S.clients.length+' companies','new-client','+ Add client or GC','clients')+`<div class="bar"><input id="q-cl" class="field search" data-q="cl" placeholder="Search companies or contacts" value="${esc(S.q.cl||'')}"></div>
  <div class="panel scroll"><table><thead><tr><th>Company</th><th>Type</th><th>Contacts</th>${showStats?'<th class="r">Bids</th><th class="r">$ bid</th><th class="r">Won</th><th class="r">Win rate</th>':'<th>Phone</th>'}</tr></thead><tbody>
  ${list.map(c=>{const bs=S.bids.filter(b=>(b.client_ids||[]).includes(c.id));const w=bs.filter(b=>clientWon(b,c.id)).length,l=bs.filter(b=>clientLost(b,c.id)).length;
   return `<tr class="click" data-act="open-client" data-id="${c.id}"><td class="proj">${esc(c.company)}</td><td>${esc(c.type)}</td><td class="small">${(c.contacts||[]).map(x=>esc(x.name)).filter(Boolean).join(', ')||'<span class="dim">—</span>'}</td>${showStats?`<td class="r num">${bs.length}</td><td class="r num">${moneyK(bs.reduce((s,b)=>s+clientAmount(b,c.id),0))}</td><td class="r num">${w}</td><td class="r num">${w+l?Math.round(w/(w+l)*100)+'%':'—'}</td>`:`<td class="small">${esc(c.phone)}</td>`}</tr>`}).join('')
  ||`<tr><td colspan="7"><div class="empty"><b>No clients yet</b>${isAdmin()?'Add the GCs, developers and owners you bid to.':''}</div></td></tr>`}</tbody></table></div>`;
}
function vendorStats(id){const qs=S.quotes.filter(q=>q.vendor_id===id).map(q=>({q,b:byId(S.bids,q.bid_id)})).filter(x=>x.b);
  const asked=qs.filter(x=>x.q.status!=='Not requested');const rec=qs.filter(x=>x.q.status==='Received');
  return{qs,asked:asked.length,rec:rec.length,open:qs.filter(x=>x.q.status==='Requested').length,rate:asked.length?Math.round(rec.length/asked.length*100):null}}
function vVendors(){
  const q=(S.q.ven||'').toLowerCase();const tf=S.q.trade||'';const sf=S.q.vscope||'';const yf=S.q.vtype||'';
  const list=S.vendors.filter(v=>(!tf||v.trade===tf)&&(!sf||vendorFits(v,sf))&&(!yf||v.vendor_type===yf)&&(!q||[v.company,v.trade,v.contact_name,v.area,v.vendor_type,...vendorScopes(v)].join(' ').toLowerCase().includes(q))).sort((a,b)=>a.company.localeCompare(b.company));
  const L=lib();
  return dbHead('Vendors & subs',S.vendors.length+' companies','new-vendor','+ Add vendor','vendors')+`<div class="bar"><input id="q-ven" class="field search" data-q="ven" placeholder="Search vendors, contacts, areas" value="${esc(S.q.ven||'')}">
   <select class="field" data-act="vtypeF"><option value="">All types</option>${VENDOR_TYPES.map(t=>`<option${yf===t?' selected':''}>${esc(t)}</option>`).join('')}</select>
   <select class="field" data-act="tradeF"><option value="">All trades</option>${TRADES.map(t=>`<option${tf===t?' selected':''}>${esc(t)}</option>`).join('')}</select>
   <select class="field" data-act="vscopeF"><option value="">All scopes</option>${SCOPE_GROUPS.map(g=>{const xs=L.scopes.filter(x=>x.group===g);return xs.length?`<optgroup label="${esc(g)}">${xs.map(x=>`<option${sf===x.name?' selected':''}>${esc(x.name)}</option>`).join('')}</optgroup>`:''}).join('')}</select></div>
  <div class="panel scroll"><table><thead><tr><th>Vendor</th><th>Type & trade</th><th>Scopes</th><th>Contact</th><th class="r">Quotes asked</th><th class="r">Received</th><th class="r">Response rate</th><th class="r">Open now</th></tr></thead><tbody>
  ${list.map(v=>{const s=vendorStats(v.id);return `<tr class="click" data-act="open-vendor" data-id="${v.id}"><td><span class="proj">${esc(v.company)}</span>${v.preferred?' '+pill('Preferred','hot'):''}${v.area?`<div class="dim small">${esc(v.area)}</div>`:''}</td><td>${v.vendor_type?`<b style="font-weight:600">${esc(v.vendor_type)}</b><br>`:''}<span class="dim small">${esc(v.trade)}</span></td><td style="max-width:320px">${vendorScopes(v).length?`<div class="tagrow">${vendorScopes(v).slice(0,4).map(x=>`<span class="pill" style="font-size:11.5px">${esc(x)}</span>`).join('')}${vendorScopes(v).length>4?`<span class="pill na" style="font-size:11.5px">+${vendorScopes(v).length-4}</span>`:''}</div>`:'<span class="dim small">None set</span>'}</td><td class="small">${esc(v.contact_name)}${v.phone?'<br>'+esc(v.phone):''}${v.email?'<br>'+esc(v.email):''}</td><td class="r num">${s.asked}</td><td class="r num">${s.rec}</td><td class="r num">${s.rate==null?'—':s.rate+'%'}</td><td class="r num">${s.open||'—'}</td></tr>`}).join('')
  ||`<tr><td colspan="8"><div class="empty"><b>No vendors ${tf||q||sf||yf?'match':'yet'}</b>${tf||q||sf||yf?'Try another search or filter.':isAdmin()?'Add suppliers and subs so you can request quotes on bids.':''}</div></td></tr>`}</tbody></table></div>`;
}

/* ----- scope library (admin) ----- */
function vScopes(){const L=lib();const groups=SCOPE_GROUPS.filter(g=>L.scopes.some(x=>x.group===g));
  return `<div class="head"><div><h1>Scopes & templates</h1><p>${L.scopes.length} scopes · ${(L.templates||[]).length} templates${S.settings.scope_library?'':' · starter list, edit it to make it yours'}</p></div><div class="tools"><button class="btn" data-act="edit-lib">Edit scope list</button><button class="btn primary" data-act="new-tpl">+ New template</button></div></div>
  <div class="grid2"><div class="sec"><div class="sec-h"><h2>Templates</h2><span>Apply to a bid in one click</span></div><div class="panel pad"><div class="list">${(L.templates||[]).map(t=>`<div class="li"><div><button class="linkish" data-act="edit-tpl" data-id="${esc(t.id)}">${esc(t.name)}</button><div class="dim small">${t.scopes.map(esc).join(', ')}</div></div><span class="pill">${t.scopes.length}</span></div>`).join('')||'<div class="empty">No templates yet.</div>'}</div></div></div>
  <div class="sec"><div class="sec-h"><h2>Scope list</h2><span>What your team picks from on each bid</span></div><div class="panel pad">${groups.map(g=>`<div style="margin-bottom:14px"><div class="small" style="font-weight:600;margin-bottom:6px">${esc(g)}</div><div class="tagrow">${L.scopes.filter(x=>x.group===g).map(x=>`<span class="pill">${esc(x.name)}${x.perform&&x.perform!=='Self perform'?` <span class="perf-tag">${x.perform==='Sub'?'Sub':'S+S'}</span>`:''}</span>`).join('')}</div></div>`).join('')}</div></div></div>`}
function libModal(){return mhead('Scope list','The scopes your team can pick from on any bid, and who usually performs each one.')+`<div class="mbody"><fieldset><legend>Scopes</legend><div class="rows">${M.draft.map((x,i)=>`<div class="rowline" style="grid-template-columns:minmax(0,1fr) 190px 140px auto"><input class="field" data-lf="${i}.name" value="${esc(x.name)}" placeholder="Scope name"><select class="field" data-lf="${i}.group">${SCOPE_GROUPS.map(g=>`<option${x.group===g?' selected':''}>${esc(g)}</option>`).join('')}</select><select class="field" data-lf="${i}.perform" title="Default when added to a bid">${PERFORM.map(o=>`<option${(x.perform||'Self perform')===o?' selected':''}>${o}</option>`).join('')}</select><button class="rm" data-act="rm-lib" data-i="${i}" aria-label="Remove">×</button></div>`).join('')}</div>
  <div class="adders"><button class="btn sm" data-act="add-lib">+ Add scope</button></div><p class="hint">The self perform / sub setting is the default when a scope is added to a bid; it can be changed on each bid. Changes here don’t alter bids that already use a scope.</p></fieldset></div>
  <div class="mfoot"><div></div><div class="r"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="save">Save scope list</button></div></div>`}
function tplModal(){const d=M.draft;const L=lib();const names=[...new Set([...L.scopes.map(x=>x.name),...d.scopes])];
  return mhead(M.isNew?'New template':d.name||'Template','Pick the scopes this template adds to a bid.')+`<div class="mbody"><fieldset><legend>Template</legend><label class="f">Name<input class="field" data-tn value="${esc(d.name)}" placeholder="e.g. Retail pad site"></label></fieldset>
  <fieldset><legend id="tpl-count">Scopes (${d.scopes.length})</legend>${SCOPE_GROUPS.map(g=>{const xs=names.filter(n=>groupOf(n)===g);return xs.length?`<div style="margin-bottom:12px"><div class="small" style="font-weight:600;margin-bottom:6px">${esc(g)}</div><div class="tplgrid">${xs.map(n=>`<label class="check"><input type="checkbox" data-tc="${esc(n)}" ${d.scopes.includes(n)?'checked':''}> ${esc(n)}</label>`).join('')}</div></div>`:''}).join('')}</fieldset></div>
  <div class="mfoot"><div>${M.isNew?'':`<button class="btn danger ${M.arm?'arm':''}" data-act="del">${M.arm?'Click again to delete':'Delete template'}</button>`}</div><div class="r"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="save">Save template</button></div></div>`}

/* ----- team & logins (admin) ----- */
function vTeam(){
  const me=S.session.user.id;
  return `<div class="head"><div><h1>Team & logins</h1><p>${S.profiles.length} account${S.profiles.length===1?'':'s'}</p></div><div class="tools"><button class="btn" data-act="reload-team">Refresh</button></div></div>
  <div class="notice"><b>To add someone:</b> in Supabase go to Authentication → Users → Add user → Send invitation (or Create new user with a password). They show up here as “No access yet”. Set their role, and for estimators pick which estimator record is theirs. Tip: if their email matches an estimator record, they’re linked automatically.</div>
  <div class="panel scroll"><table><thead><tr><th>Person</th><th>Name</th><th>Role</th><th>Linked estimator</th><th>Joined</th></tr></thead><tbody>
  ${S.profiles.map(p=>{const linked=S.estimators.find(e=>e.user_id===p.id);const self=p.id===me;
    return `<tr><td><b style="font-weight:600">${esc(p.email)}</b>${self?' '+pill('You','hot'):''}</td>
    <td><input class="field" style="min-width:160px" data-pname="${p.id}" value="${esc(p.full_name)}" placeholder="Display name"></td>
    <td><select class="field" data-prole="${p.id}" ${self?'disabled title="You can’t change your own role"':''}>${ROLES.map(([k,l])=>`<option value="${k}"${p.role===k?' selected':''}>${l}</option>`).join('')}</select></td>
    <td>${p.role==='estimator'?`<div style="display:flex;gap:6px;align-items:center"><select class="field" data-plink="${p.id}"><option value="">Not linked</option>${S.estimators.filter(e=>!e.user_id||e.user_id===p.id).map(e=>`<option value="${e.id}"${linked?.id===e.id?' selected':''}>${esc(e.name)}</option>`).join('')}</select>${linked?'':`<button class="btn sm" data-act="make-est" data-id="${p.id}">Create record</button>`}</div>`:'<span class="dim">—</span>'}</td>
    <td class="small dim">${fmtShort(String(p.created_at).slice(0,10))}</td></tr>`}).join('')}</tbody></table></div>
  <p class="hint">Estimators see only bids they’re assigned to (lead or supporting). On those bids they can change anything except who’s assigned, sign off scopes, manage vendor quotes, and upload and download files. Board members see the board dashboard and pipeline, read-only. Only admins can create, change or delete bids and directory records.</p>`;
}
async function setRole(id,r){try{await run(sb.from('profiles').update({role:r}).eq('id',id));toast('Role updated');await loadProfiles()}catch(e){toast(errMsg(e))}}
async function setProfileName(id,n){try{await run(sb.from('profiles').update({full_name:n}).eq('id',id));await loadProfiles()}catch(e){toast(errMsg(e))}}
async function linkEstimator(uid,estId){
  try{await run(sb.from('estimators').update({user_id:null}).eq('user_id',uid));
    if(estId)await run(sb.from('estimators').update({user_id:uid}).eq('id',estId));
    toast(estId?'Login linked to estimator':'Login unlinked');await loadTable('estimators')}catch(e){toast(errMsg(e))}}
async function makeEstimatorFor(uid){const p=byId(S.profiles,uid);if(!p)return;
  try{await run(sb.from('estimators').insert({name:p.full_name||p.email.split('@')[0],email:p.email,user_id:uid}));toast('Estimator record created and linked');await loadTable('estimators')}catch(e){toast(errMsg(e))}}

/* ---------- modals ---------- */
let M=null;
function closeModal(){M=null;$('#modal').innerHTML='';document.body.style.overflow=''}
function showModal(){document.body.style.overflow='hidden';renderModal(true)}
function renderModal(first){
  if(!M)return;const body=$('#modal .mbody');const st=body?body.scrollTop:0;
  const html={import:importModal,bid:bidModal,lib:libModal,tpl:tplModal,est:estModal,client:clientModal,vendor:vendorModal,board:boardModal,company:companyModal}[M.kind]();
  $('#modal').innerHTML=`<div class="modal-wrap" data-act="backdrop"><div class="modal${first?' enter':''}${M.kind==='import'?' wide':''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const nb=$('#modal .mbody');if(nb)nb.scrollTop=st;
}
function mhead(t,s){return `<div class="mhead"><div><h2>${esc(t)}</h2>${s?`<p>${esc(s)}</p>`:''}</div><button class="x" data-act="close" aria-label="Close">×</button></div>`}
const DIS=()=>M&&M.kind==='bid'?(canWork(M.draft)?'':' disabled'):(isAdmin()?'':' disabled');

/* ----- bid editor ----- */
function newBid(){return{id:newId(),name:'',location:'',project_type:'Commercial',bid_type:'Hard bid',size:'',status:'Estimating',probability:50,
  due_date:'',due_time:'',walk_date:'',rfi_date:'',lead_estimator_id:'',support_estimator_ids:[],client_ids:[],client_contacts:{},client_proposals:{},awarded_client_id:'',addenda:[],revisions:[],
  scope_items:[],
  proposal_status:'Not Started',amount_with:null,amount_without:null,use_for:'with',margin:null,follow_ups:[],notes:'',
  submitted_date:'',awarded_date:'',awarded_amount:null,awarded_to:'',lost_reason:'',quotes:[],_new:true}}
function openBid(id){
  const b=byId(S.bids,id);if(!b)return;
  const d=Object.assign(newBid(),clone(b));d._new=false;
  d.scope_items=clone(scopeItems(b));d.client_proposals=d.client_proposals||{};d.client_contacts=d.client_contacts||{};d.awarded_client_id=d.awarded_client_id||'';d.addenda=Array.isArray(d.addenda)?d.addenda:[];d.revisions=Array.isArray(d.revisions)?d.revisions:[];d.due_time=d.due_time?String(d.due_time).slice(0,5):'';
  ['due_date','walk_date','rfi_date','submitted_date','awarded_date'].forEach(k=>d[k]=d[k]||'');
  d.lead_estimator_id=d.lead_estimator_id||'';d.quotes=clone(quotesFor(id));d.quotes.forEach(q=>{['requested_date','due_date','received_date'].forEach(k=>q[k]=q[k]||'')});
  M={kind:'bid',draft:d,origQuoteIds:d.quotes.map(q=>q.id)};showModal();
}
const getPath=p=>p.split('.').reduce((o,k)=>o?.[k],M.draft);
function bf(path,type){return `data-bf="${path}"${type?` data-t="${type}"`:''} value="${esc(getPath(path)??'')}"${DIS()}`}
function sel(path,list){const v=getPath(path);return `<select class="field" data-bf="${path}"${DIS()}>${list.map(o=>`<option value="${esc(o)}"${o===v?' selected':''}>${esc(o||'—')}</option>`).join('')}</select>`}
/* ---- vendor picker: steps through each scope on the bid ---- */
function pickerStart(){
  const d=M.draft;
  const sel={};d.scope_items.forEach(it=>{sel[it.name]=S.vendors.filter(v=>v.preferred&&vendorFits(v,it.name)&&!d.quotes.some(q=>q.vendor_id===v.id&&q.scope===it.name)).map(v=>v.id)});
  M.picker={step:0,sel,all:false,q:''};renderModal();$('#modal .mbody').scrollTop=0;
}
function pickerCount(){return Object.values(M.picker.sel).reduce((n,a)=>n+a.length,0)}
function pickerView(){
  const d=M.draft,P=M.picker,items=d.scope_items,review=P.step>=items.length;
  const chips=`<div class="pick-chips">${items.map((it,i)=>{const n=(P.sel[it.name]||[]).length,have=d.quotes.filter(q=>q.scope===it.name).length;
    return `<button class="chip${i===P.step?' on':''}" data-act="pick-go" data-i="${i}">${esc(it.name)}${n||have?`<b>${n?'+'+n:''}${n&&have?' · ':''}${have?have+' on bid':''}</b>`:''}</button>`}).join('')}<button class="chip${review?' on':''}" data-act="pick-go" data-i="${items.length}">Review<b>${pickerCount()}</b></button></div>`;
  let body;
  if(review){
    const rows=items.filter(it=>(P.sel[it.name]||[]).length).map(it=>`<div class="li"><div><b style="font-weight:600">${esc(it.name)}</b><div class="dim small">${P.sel[it.name].map(id=>esc(vendorOf(id)?.company||'')).join(', ')}</div></div><span class="pill">${P.sel[it.name].length}</span></div>`).join('');
    body=`<fieldset><legend>Review</legend>${rows?`<div class="list">${rows}</div>`:'<div class="empty">No vendors selected yet. Go back and pick some.</div>'}
      <p class="hint">Each vendor gets a quote request for that scope, marked Requested with today’s date.</p></fieldset>`;
  }else{
    const it=items[P.step];const q=P.q.toLowerCase();
    const on=d.quotes.filter(x=>x.scope===it.name).map(x=>x.vendor_id);
    const fit=S.vendors.filter(v=>vendorFits(v,it.name)).sort((a,b)=>(b.preferred-a.preferred)||a.company.localeCompare(b.company));
    const rest=S.vendors.filter(v=>!vendorFits(v,it.name)&&(!q||[v.company,v.trade,v.vendor_type].join(' ').toLowerCase().includes(q))).sort((a,b)=>a.trade.localeCompare(b.trade)||a.company.localeCompare(b.company));
    const row=v=>{const already=on.includes(v.id);const checked=already||(P.sel[it.name]||[]).includes(v.id);
      return `<label class="pick-row${already?' done':''}"><input type="checkbox" data-pick="${v.id}" ${checked?'checked':''}${already?' disabled':''}>
        <span><b>${esc(v.company)}</b>${v.preferred?' '+pill('Preferred','hot'):''}${already?' '+pill('Already requested','good'):''}<span class="dim small" style="display:block">${[v.vendor_type,v.trade,v.contact_name,v.phone].filter(Boolean).map(esc).join(' · ')}</span></span></label>`};
    body=`<fieldset><legend>${esc(it.name)}</legend>
      <p class="hint" style="margin:0 0 12px">${esc(it.group||'')} · <b>${esc(performOf(it))}</b>${performOf(it)==='Self perform'?' — pick suppliers for materials, or skip.':' — pick the subs to ask for pricing.'}</p>
      ${fit.length?`<div class="small" style="font-weight:600;margin-bottom:6px">Vendors set up for this scope</div><div class="pick-list">${fit.map(row).join('')}</div>`
        :`<div class="dim small" style="margin-bottom:10px">No vendors are set up for this scope yet.${isAdmin()?' Tick scopes on a vendor’s record on the Vendors page and they’ll show here next time.':''}</div>`}
      <div class="adders" style="margin-top:14px"><button class="btn sm" data-act="pick-all">${P.all?'Hide other vendors':'Show all other vendors ('+S.vendors.filter(v=>!vendorFits(v,it.name)).length+')'}</button>${P.all?`<input class="field" id="pick-q" data-pickq placeholder="Search other vendors" value="${esc(P.q)}" style="width:220px">`:''}</div>
      ${P.all?`<div class="pick-list" style="margin-top:10px">${rest.map(row).join('')||'<div class="dim small">No other vendors match.</div>'}</div>`:''}
    </fieldset>`;
  }
  return mhead('Select vendors',review?'Review and add the quote requests':`Scope ${P.step+1} of ${items.length}`).replace('data-act="close"','data-act="pick-cancel"')+`<div class="mbody">${chips}${body}</div>
   <div class="mfoot"><div><button class="btn" data-act="pick-cancel">Cancel</button></div><div class="r">
    ${P.step>0?'<button class="btn" data-act="pick-back">Back</button>':''}
    ${review?`<button class="btn primary" data-act="pick-finish"${pickerCount()?'':' disabled'}>Add ${pickerCount()} quote request${pickerCount()===1?'':'s'}</button>`:`<button class="btn primary" data-act="pick-next">${P.step===items.length-1?'Review':'Next scope'}</button>`}</div></div>`;
}
function pickerFinish(){
  const P=M.picker;let n=0;
  Object.entries(P.sel).forEach(([scope,ids])=>ids.forEach(id=>{if(addQuote(id,scope))n++}));
  M.picker=null;renderModal();toast(`Added ${n} quote request${n===1?'':'s'}. Save to keep them.`);
  setTimeout(()=>{const f=[...document.querySelectorAll('#modal legend')].find(l=>l.textContent.startsWith('Vendor & sub'));f?.scrollIntoView({block:'start'})},0);
}
function bidModal(){
  if(M.picker)return pickerView();
  const b=M.draft;const admin=isAdmin();const work=canWork(b);const isNew=b._new;
  const ests=S.estimators.filter(e=>e.active!==false||e.id===b.lead_estimator_id||b.support_estimator_ids.includes(e.id));
  const clientsSorted=S.clients.slice().sort((a,c)=>a.company.localeCompare(c.company));
  const vendorsSorted=S.vendors.slice().sort((a,c)=>a.trade.localeCompare(c.trade)||a.company.localeCompare(c.company));
  const tradesWithVendors=TRADES.filter(t=>S.vendors.some(v=>v.trade===t));
  const outcome=['Submitted','Awarded','Lost','No Bid'].includes(b.status);
  const sub=isNew?'Project details, team, scope, vendor quotes and files':admin?'Last saved '+(b.updated_at?new Date(b.updated_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—'):work?'You’re on this bid, so you can update anything here except who’s assigned to it.':'Read-only';
  const files=isNew?[]:filesFor(b.id);
  return mhead(isNew?'New bid':b.name||'Untitled bid',sub)+`<div class="mbody">
  ${isNew?'':`<div class="panel pad" style="margin-bottom:14px">${progress(b,{lg:true,quotes:b.quotes})}</div>`}
  <fieldset><legend>Project</legend><div class="fg">
    <label class="f s2">Project name ${work?'<span class="req">required</span>':''}<input class="field" ${bf('name')} placeholder="e.g. Riverside Commerce Park"></label>
    <label class="f s2">Location<input class="field" ${bf('location')} placeholder="City, county or address"></label>
    <label class="f">Project type${sel('project_type',PROJECT_TYPES)}</label>
    <label class="f">Bid type${sel('bid_type',BID_TYPES)}</label>
    <label class="f">Size<input class="field" ${bf('size')} placeholder="e.g. 14 acres"></label>
    <label class="f">Bid status${sel('status',BID_ST)}</label>
    <label class="f">Bid due date<input type="date" class="field" ${bf('due_date')}></label>
    <label class="f">Due time<input type="time" class="field" ${bf('due_time')}></label>
    <label class="f">Site walk / pre-bid<input type="date" class="field" ${bf('walk_date')}></label>
    <label class="f">RFI deadline<input type="date" class="field" ${bf('rfi_date')}></label>
  </div></fieldset>

  <fieldset><legend>Estimating team</legend><div class="fg">
    <label class="f s2">Lead estimator<select class="field" data-bf="lead_estimator_id"${admin?'':' disabled'}><option value="">Unassigned</option>${ests.map(e=>`<option value="${e.id}"${b.lead_estimator_id===e.id?' selected':''}>${esc(e.name)}${e.title?' — '+esc(e.title):''}</option>`).join('')}</select></label>
    <div class="f s2" style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500;color:var(--ink-2)">Supporting estimators
      <div class="tagrow">${b.support_estimator_ids.map(id=>`<span class="tag">${avatar(id,20)} ${esc(estName(id)||'Removed')}${admin?`<button class="rm" data-act="rm-support" data-id="${id}" aria-label="Remove">×</button>`:'&nbsp;'}</span>`).join('')||(admin?'':'<span class="dim">None</span>')}
      ${admin?`<select class="field" data-act="add-support" style="width:auto"><option value="">+ Add</option>${ests.filter(e=>e.id!==b.lead_estimator_id&&!b.support_estimator_ids.includes(e.id)).map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>`:''}</div></div>
  </div>${admin&&!S.estimators.length?'<p class="hint">No estimators on file yet. Add them in the Estimators tab.</p>':''}</fieldset>



  ${scopeSection(b,work)}

  <fieldset><legend>Proposal</legend><div class="fg">
    <label class="f">Proposal status${sel('proposal_status',PROPOSAL_ST)}</label>
    <label class="f">Base — with site improvements<input type="number" step="0.01" min="0" class="field" ${bf('amount_with','n')} placeholder="$0.00"></label>
    <label class="f">Base — without site improvements<input type="number" step="0.01" min="0" class="field" ${bf('amount_without','n')} placeholder="$0.00"></label>
    <label class="f">Estimated margin %<input type="number" step="0.1" class="field" ${bf('margin','n')} placeholder="e.g. 12"></label>
    <div class="s2"><div class="small" style="font-weight:500;color:var(--ink-2);margin-bottom:6px">Use for dashboard totals</div><div class="radio">
      <label><input type="radio" name="usefor" data-bf="use_for" value="with"${b.use_for!=='without'?' checked':''}${DIS()}> With site improvements</label>
      <label><input type="radio" name="usefor" data-bf="use_for" value="without"${b.use_for==='without'?' checked':''}${DIS()}> Without</label></div></div>
    <label class="f s2">Win probability: <b id="probv">${b.probability??50}%</b><input type="range" min="0" max="100" step="5" data-bf="probability" data-t="n" value="${b.probability??50}"${DIS()}></label>
  </div><p class="hint">The base numbers apply to every GC below unless you enter a different amount for them.</p></fieldset>

  ${clientsSection(b,work)}

  ${addendaSection(b,work)}

  ${revisionSection(b,work)}

  <fieldset><legend>Vendor & sub quotes</legend>
    ${b.quotes.length?`<div class="qhead"><span>Vendor</span><span>Scope</span><span>Status</span><span>Need by</span><span>Amount</span><span>Quote file</span><span></span></div>`:''}
    <div class="rows">${b.quotes.map((q,i)=>quoteRow(q,i,work,admin)).join('')||'<div class="dim small">No quote requests yet.</div>'}</div>
    ${work?`<div class="adders"><button class="btn primary sm" data-act="pick-open"${b.scope_items.length&&S.vendors.length?'':' disabled title="Add scopes and vendors first"'}>Select vendors by scope…</button><select class="field" data-act="add-quote"><option value="">+ Request a quote from…</option>${vendorsSorted.map(v=>`<option value="${v.id}">${esc(v.company)} (${esc(v.trade)})</option>`).join('')}</select>
    ${tradesWithVendors.length?`<select class="field" data-act="add-trade"><option value="">+ Add every vendor in a trade…</option>${tradesWithVendors.map(t=>`<option>${esc(t)}</option>`).join('')}</select>`:''}</div>
    <p class="hint">Upload the quote when it comes in (PDF, Excel, image — any file). Status switches to Received automatically. Save to keep changes.</p>`:''}
  </fieldset>

  <fieldset><legend>Project files</legend>
    ${isNew?'<p class="hint" style="margin:0">Create the bid first, then attach plans, specs, addenda and other files.</p>':`
    <div class="list filelist">${files.map(f=>`<div class="li"><div><button class="linkish" data-act="dl" data-path="${esc(f.file_path)}" data-name="${esc(f.file_name)}">${esc(f.file_name)}</button><div class="dim small">${esc(f.category)}${f.size_bytes?' · '+fmtSize(f.size_bytes):''} · ${esc(f.uploaded_by_name||'Someone')} · ${fmtShort(String(f.created_at).slice(0,10))}</div></div>
      <div style="display:flex;gap:4px"><button class="btn sm" data-act="dl" data-path="${esc(f.file_path)}" data-name="${esc(f.file_name)}">Download</button>${admin||f.uploaded_by===S.session.user.id?`<button class="rm" data-act="rm-file" data-id="${f.id}" title="Delete file">×</button>`:''}</div></div>`).join('')||'<div class="dim small">No files yet.</div>'}</div>
    ${work?`<div class="adders" style="align-items:center"><select class="field" id="file-cat" style="min-width:160px">${FILE_CATS.map(c=>`<option>${c}</option>`).join('')}</select>
      <label class="btn sm" style="cursor:pointer">Upload files<input type="file" multiple data-docupload style="display:none"></label>${M.uploading?'<span class="dim small">Uploading…</span>':''}</div>`:''}`}
  </fieldset>

  <fieldset><legend>GC follow-up log</legend><div class="rows">
    ${b.follow_ups.map((f,i)=>`<div class="rowline fu"><input type="date" class="field" data-ff="${i}.date" value="${esc(f.date||'')}"${DIS()}><input type="text" class="field" data-ff="${i}.note" value="${esc(f.note||'')}" placeholder="e.g. Called PM, decision expected next week"${DIS()}>${work?`<button class="rm" data-act="rm-fu" data-i="${i}" aria-label="Remove">×</button>`:'<span></span>'}</div>`).join('')||'<div class="dim small">No follow-ups logged.</div>'}
  </div>${work?'<div class="adders"><button class="btn sm" data-act="add-fu">+ Log a follow-up</button></div>':''}</fieldset>

  ${outcome?`<fieldset><legend>Outcome</legend><div class="fg">
    <label class="f">Submitted on<input type="date" class="field" ${bf('submitted_date')}></label>
    ${b.status==='Awarded'?`<label class="f">Awarded on<input type="date" class="field" ${bf('awarded_date')}></label>
    <label class="f">Awarded by<select class="field" data-act="award-sel"${DIS()}><option value="">${b.client_ids.length?'Pick the GC…':'Add GCs above first'}</option>${b.client_ids.map(id=>`<option value="${id}"${b.awarded_client_id===id?' selected':''}>${esc(clientName(id))}</option>`).join('')}</select></label>
    <label class="f">Contract amount<input type="number" step="0.01" class="field" ${bf('awarded_amount','n')} placeholder="${b.awarded_client_id&&clientAmount(b,b.awarded_client_id)?money(clientAmount(b,b.awarded_client_id)):'Defaults to bid value'}"></label>`:''}
    ${b.status==='Lost'?`<label class="f">Lost reason${sel('lost_reason',LOST_REASONS)}</label><label class="f s2">Awarded to / low number<input class="field" ${bf('awarded_to')} placeholder="Who got it, and at what price"></label>`:''}
  </div></fieldset>`:''}

  <fieldset><legend>Notes</legend><textarea class="field" data-bf="notes" placeholder="Scope clarifications, bid strategy, site conditions…"${DIS()}>${esc(b.notes||'')}</textarea></fieldset>
  </div>
  <div class="mfoot"><div>${admin&&!isNew?`<button class="btn danger ${M.arm?'arm':''}" data-act="del">${M.arm?'Click again to delete':'Delete bid'}</button>`:''}</div>
  <div class="r"><button class="btn" data-act="close">${admin||work?'Cancel':'Close'}</button>${work?`<button class="btn primary" data-act="save">${isNew?'Create bid':'Save changes'}</button>`:''}</div></div>`;
}
function clientsSection(b,work){
  const d=work?'':' disabled';
  const clientsSorted=S.clients.slice().sort((a,c)=>a.company.localeCompare(c.company));
  const amts=b.client_ids.map(id=>clientAmount(b,id)).filter(Boolean);
  const rows=b.client_ids.map(id=>{
    const c=byId(S.clients,id);const cs=c?.contacts||[];const ct=cs.find(x=>x.name===b.client_contacts?.[id]);const p=propOf(b,id);
    const won=b.status==='Awarded'&&b.awarded_client_id===id;
    const status=won?`<div class="signing">${pill('Awarded ✓','good')}${work?'<button class="btn sm ghost" data-act="unaward">Undo</button>':''}</div>`
      :`<div class="signing"><select class="field" data-cp="${id}.status"${d} style="width:110px">${CP_ST.map(x=>`<option${(p.status||'Not sent')===x?' selected':''}>${x}</option>`).join('')}</select>${work?`<button class="btn sm" data-act="award" data-id="${id}">${b.status==='Awarded'&&b.awarded_client_id?'Switch award here':'Mark awarded'}</button>`:''}</div>`;
    return `<div class="gc-row${won?' is-won':''}">
      <div><b style="font-weight:600">${esc(clientName(id))}</b><div class="dim small">${esc(c?.type||'')}${ct?.phone?' · '+esc(ct.phone):''}${ct?.email?' · '+esc(ct.email):''}</div>
        <select class="field" data-cc="${id}"${d} style="margin-top:6px"><option value="">Contact…</option>${cs.map(x=>`<option${b.client_contacts?.[id]===x.name?' selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
      <label class="f">With site impr.<input type="number" step="0.01" min="0" class="field" data-cp="${id}.amount_with" data-t="n" value="${esc(p.amount_with??'')}" placeholder="${num(b.amount_with)!=null?money(b.amount_with):'$'}"${d}></label>
      <label class="f">Without<input type="number" step="0.01" min="0" class="field" data-cp="${id}.amount_without" data-t="n" value="${esc(p.amount_without??'')}" placeholder="${num(b.amount_without)!=null?money(b.amount_without):'$'}"${d}></label>
      <label class="f">Sent on<input type="date" class="field" data-cp="${id}.sent_date" value="${esc(p.sent_date||'')}"${d}></label>
      <div class="f">Proposal${status}</div>
      ${work?`<button class="rm" data-act="rm-client" data-id="${id}" aria-label="Remove">×</button>`:'<span></span>'}</div>`}).join('');
  return `<fieldset><legend>Bidding to & proposals</legend>
    ${b.client_ids.length>1&&amts.length?`<p class="hint" style="margin:0 0 10px">${b.client_ids.length} GCs · proposals range ${money(Math.min(...amts))} – ${money(Math.max(...amts))}</p>`:''}
    <div class="rows">${rows||'<div class="dim small">No GCs, owners or contractors added yet.</div>'}</div>
    ${work?`<div class="adders"><select class="field" data-act="add-client"><option value="">+ Add a GC, owner or contractor…</option>${clientsSorted.filter(c=>!b.client_ids.includes(c.id)).map(c=>`<option value="${c.id}">${esc(c.company)}${c.type?' ('+esc(c.type)+')':''}</option>`).join('')}</select></div>
    <p class="hint">${S.clients.length?'Add everyone you’re sending a number to. Leave an amount blank to use the base proposal. When the job is awarded, click <b>Mark awarded</b> on the winning GC — the others are marked lost.':'No clients on file yet. Add them in the Clients & GCs tab.'}</p>`:''}
  </fieldset>`;
}
function addendaSection(b,work){
  const d=work?'':' disabled';const list=addenda(b);const stale=staleAddenda(b);
  const rows=list.map((a,i)=>`<div class="ad-row${a.priced&&a.acknowledged?' is-done':''}">
    <label class="f">No.<input type="number" min="0" class="field" data-ad="${i}.number" data-t="n" value="${esc(a.number??'')}"${d}></label>
    <label class="f">Issued<input type="date" class="field" data-ad="${i}.date" value="${esc(a.date||'')}"${d}></label>
    <label class="f">What changed<input class="field" data-ad="${i}.description" value="${esc(a.description||'')}" placeholder="e.g. Revised storm layout, added 200 LF of 24&quot; RCP"${d}></label>
    <div class="ad-checks"><label class="check"><input type="checkbox" data-ad="${i}.priced" ${a.priced?'checked':''}${d}> Priced</label><label class="check"><input type="checkbox" data-ad="${i}.acknowledged" ${a.acknowledged?'checked':''}${d}> Acknowledged</label></div>
    <div class="file">${a.file_path?`<button class="linkbtn" style="font-size:13px;font-weight:600" data-act="dl" data-path="${esc(a.file_path)}" data-name="${esc(a.file_name||'addendum')}">${esc(a.file_name||'Download')}</button>${work?` <button class="rm" data-act="ad-clear" data-i="${i}" title="Detach file">×</button>`:''}`
      :work&&!b._new?`<label>Attach file<input type="file" data-adupload="${i}"></label>`:'<span class="dim small">No file</span>'}</div>
    ${work?`<button class="rm" data-act="rm-ad" data-i="${i}" aria-label="Remove">×</button>`:'<span></span>'}</div>`).join('');
  return `<fieldset><legend>Addendum log</legend>
    ${list.length?`<p class="hint" style="margin:0 0 10px">${list.length} addend${list.length===1?'um':'a'} · ${openAddenda(b).length?`<b style="color:var(--warn)">${openAddenda(b).length} not yet priced and acknowledged</b>`:'all priced and acknowledged'}</p>`:''}
    ${stale.length?`<div class="notice" style="margin-bottom:10px">Addend${stale.length===1?'um':'a'} ${stale.map(a=>esc(a.number??'?')).join(', ')} came out after the last proposal revision. If pricing changed, update the numbers or click <b>Record revision</b>.</div>`:''}
    <div class="rows">${rows||'<div class="dim small">No addenda logged.</div>'}</div>
    ${work?`<div class="adders"><button class="btn sm" data-act="add-ad">+ Log addendum</button></div>${b._new?'<p class="hint">Create the bid first to attach addendum files.</p>':'<p class="hint">Attached files also appear under Project files as “Addenda”.</p>'}`:''}
  </fieldset>`;
}
function revisionSection(b,work){
  const list=revisions(b);const d=work?'':' disabled';
  const rows=list.map((r,i)=>{const v=snapValue(b,r.snapshot),pv=i?snapValue(b,list[i-1].snapshot):null;const diff=v!=null&&pv!=null?v-pv:null;
    const gcs=Object.entries(r.snapshot?.gcs||{}).map(([id,g])=>`${esc(clientName(id))} ${moneyK(pick(b,g.w,g.o)||0)}`).join(' · ');
    return `<div class="rev-row">
      <div class="rev-no">Rev ${esc(r.rev)}</div>
      <div><div class="num" style="font-weight:700">${v!=null?money(v):'—'}${diff?` <span class="small" style="color:var(--info);font-weight:600">${diff>0?'+':'−'}${money(Math.abs(diff))}</span>`:''}</div><div class="dim small">${fmtDate(r.date)} · ${esc(r.by||'')}${r.auto?' · logged automatically':''}</div>${gcs&&Object.keys(r.snapshot.gcs).length>1?`<div class="dim small">${gcs}</div>`:''}</div>
      <label class="f">Reason<input class="field" data-rv="${i}.reason" value="${esc(r.reason||'')}" placeholder="e.g. Addendum 2, GC value engineering"${d}></label>
      <label class="f">Addendum<select class="field" data-rv="${i}.addendum"${d}><option value="">—</option>${addenda(b).filter(a=>a.number!=null).map(a=>`<option value="${esc(a.number)}"${String(r.addendum)===String(a.number)?' selected':''}>Addendum ${esc(a.number)}</option>`).join('')}</select></label>
      ${work&&isAdmin()?`<button class="rm" data-act="rm-rev" data-i="${i}" aria-label="Remove">×</button>`:'<span></span>'}</div>`}).join('');
  return `<fieldset><legend>Proposal revision log</legend>
    <div class="rows">${rows||'<div class="dim small">No revisions yet. Rev 0 is recorded automatically when the proposal goes out.</div>'}</div>
    ${work?`<div class="adders"><button class="btn sm" data-act="add-rev">+ Record revision</button></div><p class="hint">Records the current proposal numbers. A revision is also logged automatically whenever the numbers change after the proposal has been sent — add the reason here.</p>`:''}
  </fieldset>`;
}
async function uploadAddendum(i,file){
  const a=M?.draft.addenda[i];if(!a||!file)return;const bidId=M.draft.id;M.uploading=true;renderModal();
  try{const path=await uploadTo(bidId,'docs',file);
    await run(sb.from('bid_files').insert({bid_id:bidId,file_path:path,file_name:file.name,category:'Addenda',size_bytes:file.size,uploaded_by:S.session.user.id,uploaded_by_name:myName()}));
    a.file_path=path;a.file_name=file.name;await loadTable('bid_files');toast('Addendum file attached. Save to keep the link.')}
  catch(e){toast(errMsg(e))}finally{if(M){M.uploading=false;renderModal()}}
}
function awardClient(id){
  const d=M.draft;d.client_proposals=d.client_proposals||{};
  d.client_ids.forEach(c=>{const p=d.client_proposals[c]=Object.assign({},d.client_proposals[c]);
    if(c===id){p.status='Awarded';if(!p.sent_date)p.sent_date=d.submitted_date||todayStr()}else if(p.status!=='Lost')p.status='Lost'});
  d.status='Awarded';d.awarded_client_id=id;if(!d.awarded_date)d.awarded_date=todayStr();
  d.awarded_amount=clientAmount(d,id)||null;d.proposal_status='Sent';
  renderModal();toast(`Marked awarded by ${clientName(id)}. Save to keep it.`);
}
function unaward(){
  const d=M.draft;d.client_ids.forEach(c=>{const p=d.client_proposals[c];if(p&&(p.status==='Awarded'||p.status==='Lost'))p.status='Sent'});
  d.status='Submitted';d.awarded_client_id='';d.awarded_amount=null;d.awarded_date='';renderModal();
}
function scopeSection(b,work){
  const L=lib();const items=b.scope_items;const have=new Set(items.map(x=>x.name.toLowerCase()));
  const team=[b.lead_estimator_id,...b.support_estimator_ids].filter(id=>id&&byId(S.estimators,id));
  const done=items.filter(x=>x.status==='Complete').length;
  const avail=SCOPE_GROUPS.map(g=>[g,L.scopes.filter(x=>x.group===g&&!have.has(x.name.toLowerCase()))]).filter(([,xs])=>xs.length);
  return `<fieldset><legend>Scope takeoff</legend>
   ${items.length?`<p class="hint" style="margin:0 0 10px">${done} of ${items.length} scopes signed off</p>`:''}
   <div class="rows">${items.map((it,i)=>scopeRow(it,i,work,team)).join('')||`<div class="dim small">No scopes selected yet.${work?' Start from a template or pick scopes from the list.':''}</div>`}</div>
   ${work?`<div class="adders">
     <select class="field" data-act="apply-template"><option value="">Apply a template…</option>${(L.templates||[]).map(t=>`<option value="${esc(t.id)}">${esc(t.name)} (${t.scopes.length})</option>`).join('')}</select>
     <select class="field" data-act="add-scope"><option value="">+ Add a scope…</option>${avail.map(([g,xs])=>`<optgroup label="${esc(g)}">${xs.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select>
     <span style="display:flex;gap:6px"><input class="field" id="custom-scope" placeholder="Custom scope" style="width:170px"><button class="btn sm" data-act="add-custom-scope">Add</button></span></div>
   <p class="hint">When a scope’s takeoff is done, sign it off with your initials. Sign-offs save right away and record who did it and when.${isAdmin()?' Edit the scope list and templates on the Scopes page.':''}</p>`:''}
  </fieldset>`;
}
// For scopes that use a sub, show how the sub quotes for that scope are coming along
function subQuoteNote(it){
  if(performOf(it)==='Self perform')return '';
  const qs=(M.draft.quotes||[]).filter(q=>q.scope===it.name);
  if(!qs.length)return ' · <span style="color:var(--warn);font-weight:600">No sub quotes yet</span>';
  const rec=qs.filter(q=>q.status==='Received').length,req=qs.filter(q=>q.status==='Requested').length;
  return ` · <span style="color:var(--${rec?'good':'warn'});font-weight:600">Sub quotes: ${rec} in${req?`, ${req} waiting`:''}</span>`;
}
function scopeRow(it,i,work,team){
  const signed=it.status==='Complete';const canUnsign=work&&(isAdmin()||it.signed_by_user===S.session.user.id);
  let right;
  if(signed)right=`<div class="signed"><span class="stamp">${esc(it.signed_initials||'✓')}</span><div class="small"><b>Signed off</b>${it.signed_by_name?' by '+esc(it.signed_by_name):''}<div class="dim">${it.signed_at?new Date(it.signed_at).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'No sign-off recorded'}</div></div>${canUnsign?`<button class="btn sm ghost" data-act="unsign" data-i="${i}">Reopen</button>`:''}</div>`;
  else if(M.signing===i)right=`<div class="signing"><input class="field" id="sign-init" maxlength="4" value="${esc(myInitials())}" aria-label="Your initials" style="width:74px;text-transform:uppercase;font-weight:700"><button class="btn sm primary" data-act="sign-confirm" data-i="${i}">Confirm sign-off</button><button class="btn sm ghost" data-act="sign-cancel">Cancel</button></div>`;
  else right=`<div class="signing"><select class="field" data-sf="${i}.status"${work?'':' disabled'} style="width:140px">${['Not Started','In Progress'].map(x=>`<option${(it.status||'Not Started')===x?' selected':''}>${x}</option>`).join('')}</select>${work?`<button class="btn sm" data-act="sign-start" data-i="${i}">Sign off</button>`:''}</div>`;
  return `<div class="scope-row${signed?' is-signed':''}">
   <div><b style="font-weight:600">${esc(it.name)}</b><div class="dim small">${esc(it.group||'')}${subQuoteNote(it)}</div></div>
   <select class="field perf-${performOf(it)==='Self perform'?'self':performOf(it)==='Sub'?'sub':'both'}" data-sf="${i}.perform" title="Who performs this scope"${work&&!signed?'':' disabled'}>${PERFORM.map(x=>`<option${performOf(it)===x?' selected':''}>${x}</option>`).join('')}</select>
   <select class="field" data-sf="${i}.assignee_id" title="Who is doing this scope"${work&&!signed?'':' disabled'}><option value="">Whole team</option>${team.map(id=>`<option value="${id}"${it.assignee_id===id?' selected':''}>${esc(estName(id))}</option>`).join('')}</select>
   ${right}
   ${work&&(!signed||isAdmin())?`<button class="rm" data-act="rm-scope" data-i="${i}" aria-label="Remove scope">×</button>`:'<span></span>'}</div>`;
}
function addScope(name,group){name=String(name||'').trim();if(!name)return false;
  if(M.draft.scope_items.some(x=>x.name.toLowerCase()===name.toLowerCase()))return false;
  M.draft.scope_items.push({id:newId(),name,group:group||groupOf(name),perform:PERFORM.includes(libScope(name)?.perform)?libScope(name).perform:'Self perform',status:'Not Started',assignee_id:''});return true}
const UNSIGNED={signed_initials:null,signed_by_name:null,signed_by_user:null,signed_by_estimator_id:null,signed_at:null};
async function signScope(i){
  const it=M.draft.scope_items[i];const ini=($('#sign-init')?.value||'').trim().toUpperCase();
  if(!/^[A-Z]{1,4}$/.test(ini)){toast('Enter your initials (letters only).');return}
  const prev=clone(it);
  Object.assign(it,{status:'Complete',signed_initials:ini,signed_by_name:myName(),signed_by_user:S.session.user.id,signed_by_estimator_id:myEst()?.id||null,signed_at:new Date().toISOString()});
  M.signing=null;
  if(M.draft._new){renderModal();toast('Signed off. Create the bid to keep it.');return}
  try{await saveBid();renderModal();toast(`${it.name} signed off by ${ini}`)}catch(e){Object.assign(it,prev);renderModal();toast(errMsg(e))}
}
async function unsignScope(i){
  const it=M.draft.scope_items[i];const prev=clone(it);
  Object.assign(it,{status:'In Progress'},UNSIGNED);
  if(M.draft._new){renderModal();return}
  try{await saveBid();renderModal();toast(`${it.name} reopened`)}catch(e){Object.assign(it,prev);renderModal();toast(errMsg(e))}
}
function quoteRow(q,i,work,admin){
  const v=vendorOf(q.vendor_id);const d=work?'':' disabled';
  const file=q._uploading?'<span class="dim small">Uploading…</span>'
    :q.file_path?`<span class="file"><button class="linkbtn" style="font-size:13px;font-weight:600;text-align:left;word-break:break-all" data-act="dl" data-path="${esc(q.file_path)}" data-name="${esc(q.file_name||'quote')}">${esc(q.file_name||'Download quote')}</button>${work?` <button class="rm" data-act="clear-file" data-i="${i}" title="Detach file">×</button>`:''}</span>`
    :work?`<span class="file"><label>Upload quote<input type="file" data-upload="${i}"></label></span>`:'<span class="dim small">No file</span>';
  return `<div class="quote"><div class="vn">${esc(v?.company||'Removed vendor')}<small>${esc(v?.trade||'')}${v?.phone?' · '+esc(v.phone):''}${q.requested_date?' · asked '+fmtShort(q.requested_date):''}${q.received_date?' · in '+fmtShort(q.received_date):''}</small></div>
   <select class="field" data-qf="${i}.scope"${d}>${[...new Set([...M.draft.scope_items.map(x=>x.name),...QUOTE_EXTRA,q.scope].filter(Boolean))].map(x=>`<option${q.scope===x?' selected':''}>${esc(x)}</option>`).join('')}</select>
   <select class="field" data-qf="${i}.status"${d}>${QUOTE_ST.map(s=>`<option${q.status===s?' selected':''}>${s}</option>`).join('')}</select>
   <input type="date" class="field" data-qf="${i}.due_date" value="${esc(q.due_date||'')}" title="Need quote by"${d}>
   <input type="number" step="0.01" class="field" data-qf="${i}.amount" data-t="n" value="${esc(q.amount??'')}" placeholder="$"${d}>
   <div>${file}<input class="field" style="margin-top:4px" data-qf="${i}.note" value="${esc(q.note||'')}" placeholder="Note"${d}></div>
   ${admin||(work&&!M.origQuoteIds?.includes(q.id))?`<button class="rm" data-act="rm-quote" data-i="${i}" aria-label="Remove">×</button>`:'<span></span>'}</div>`;
}
function defaultScopeForTrade(t){const g=TRADE_GROUP[t];const inG=M.draft.scope_items.filter(x=>x.group===g);const m=inG.find(x=>performOf(x)!=='Self perform')||inG[0];return m?m.name:(['Trucking','Materials','Testing'].includes(g)?g:'Other')}
function addQuote(vid,scope){const v=vendorOf(vid);if(!v)return false;
  if(!scope){const fit=M.draft.scope_items.find(x=>vendorFits(v,x.name));scope=fit?fit.name:defaultScopeForTrade(v.trade)}
  if(M.draft.quotes.some(q=>q.vendor_id===vid&&q.scope===scope))return false;
  M.draft.quotes.push({id:newId(),bid_id:M.draft.id,vendor_id:vid,scope,status:'Requested',requested_date:todayStr(),due_date:'',received_date:'',amount:null,note:'',file_path:null,file_name:null});return true}

/* ----- directory modals ----- */
function ef(path,ph,type){return `<input class="field" ${type?`type="${type}"`:''} data-ef="${path}" value="${esc(M.draft[path]??'')}" placeholder="${esc(ph||'')}"${DIS()}>`}
function efSel(path,list){return `<select class="field" data-ef="${path}"${DIS()}>${list.map(o=>`<option${M.draft[path]===o?' selected':''}>${esc(o)}</option>`).join('')}</select>`}
function entFoot(label,isNew){return `<div class="mfoot"><div>${isAdmin()&&!isNew?`<button class="btn danger ${M.arm?'arm':''}" data-act="del">${M.arm?'Click again to delete':'Delete'}</button>`:''}</div><div class="r"><button class="btn" data-act="close">${isAdmin()?'Cancel':'Close'}</button>${isAdmin()?`<button class="btn primary" data-act="save">${isNew?label:'Save changes'}</button>`:''}</div></div>`}
function bidMiniList(bs,extra){return bs.length?`<div class="list">${bs.sort((a,b)=>(b.due_date||'').localeCompare(a.due_date||'')).map(b=>`<div class="li"><div><button class="linkish" data-act="open-bid" data-id="${b.id}">${esc(b.name)}</button><div class="dim small">${fmtDate(b.due_date)}${extra?' · '+extra(b):''}</div></div><div style="text-align:right">${pill(b.status,BID_CLS[b.status])}<div class="num small">${bidValue(b)?money(bidValue(b)):''}</div></div></div>`).join('')}</div>`:'<div class="empty">No bids yet.</div>'}
function estModal(){const e=M.draft,isNew=M.isNew;
  const bs=S.bids.filter(b=>b.lead_estimator_id===e.id||(b.support_estimator_ids||[]).includes(e.id));
  return mhead(isNew?'New estimator':e.name||'Estimator',e.user_id?'Has a login':'No login linked yet')+`<div class="mbody"><fieldset><legend>Details</legend><div class="fg">
   <label class="f s2">Name <span class="req">required</span>${ef('name','Full name')}</label><label class="f s2">Title${ef('title','e.g. Senior estimator')}</label>
   <label class="f s2">Email${ef('email','name@company.com','email')}</label><label class="f s2">Phone${ef('phone','(000) 000-0000','tel')}</label>
   <label class="check s4"><input type="checkbox" data-ef="active" ${e.active!==false?'checked':''}${DIS()}> Active — can be assigned to new bids</label></div>
   <p class="hint">Use the same email as their login, and their account links to this record automatically when they’re added.</p></fieldset>
   ${isNew?'':`<fieldset><legend>Assigned bids</legend>${bidMiniList(bs,b=>b.lead_estimator_id===e.id?'Lead':'Support')}</fieldset>`}</div>`+entFoot('Add estimator',isNew)}
function clientModal(){const c=M.draft,isNew=M.isNew;const admin=isAdmin();
  const bs=S.bids.filter(b=>(b.client_ids||[]).includes(c.id));const w=bs.filter(b=>clientWon(b,c.id)),l=bs.filter(b=>clientLost(b,c.id));
  return mhead(isNew?'New client or GC':c.company||'Client','')+`<div class="mbody">
   ${isNew||role()==='estimator'?'':`<div class="statline"><div><b>${bs.length}</b>Bids</div><div><b>${moneyK(bs.reduce((s,b)=>s+clientAmount(b,c.id),0))}</b>Total bid</div><div><b>${w.length}</b>Won</div><div><b>${w.length+l.length?Math.round(w.length/(w.length+l.length)*100)+'%':'—'}</b>Win rate</div><div><b>${moneyK(w.reduce((s,b)=>s+wonValue(b),0))}</b>Awarded</div></div>`}
   <fieldset><legend>Company</legend><div class="fg">
   <label class="f s2">Company name ${admin?'<span class="req">required</span>':''}${ef('company','e.g. Summit Builders')}</label><label class="f s2">Type${efSel('type',CLIENT_TYPES)}</label>
   <label class="f s2">Main phone${ef('phone','(000) 000-0000','tel')}</label><label class="f s2">Website or email${ef('email','')}</label>
   <label class="f s4">Address${ef('address','Office address')}</label>
   <label class="f s4">Notes<textarea class="field" data-ef="notes" placeholder="Prequal status, bonding requirements, payment history…"${DIS()}>${esc(c.notes||'')}</textarea></label></div></fieldset>
   <fieldset><legend>Contacts</legend><div class="rows">${(c.contacts||[]).map((x,i)=>`<div class="rowline contact"><input class="field" data-ctf="${i}.name" value="${esc(x.name||'')}" placeholder="Name"${DIS()}><input class="field" data-ctf="${i}.title" value="${esc(x.title||'')}" placeholder="Role, e.g. PM"${DIS()}><input class="field" data-ctf="${i}.phone" value="${esc(x.phone||'')}" placeholder="Phone"${DIS()}><input class="field" data-ctf="${i}.email" value="${esc(x.email||'')}" placeholder="Email"${DIS()}>${admin?`<button class="rm" data-act="rm-contact" data-i="${i}" aria-label="Remove">×</button>`:'<span></span>'}</div>`).join('')||'<div class="dim small">No contacts.</div>'}</div>
   ${admin?'<div class="adders"><button class="btn sm" data-act="add-contact">+ Add contact</button></div>':''}</fieldset>
   ${isNew?'':`<fieldset><legend>Bid history</legend>${bidMiniList(bs,b=>[clientAmount(b,c.id)?'Our number '+money(clientAmount(b,c.id)):'',clientWon(b,c.id)?'<b style="color:var(--good)">Awarded to us</b>':clientLost(b,c.id)?'Lost':(propOf(b,c.id).status||'Not sent'),b.client_contacts?.[c.id]?'Contact: '+esc(b.client_contacts[c.id]):''].filter(Boolean).join(' · '))}</fieldset>`}</div>`+entFoot('Add client',isNew)}
function vendorScopeField(v){
  const L=lib();const mine=vendorScopes(v);const names=[...new Set([...L.scopes.map(x=>x.name),...mine])];const d=DIS();
  return `<fieldset><legend id="vs-count">Scopes they quote (${mine.length})</legend>
   <p class="hint" style="margin:0 0 10px">These vendors are suggested for those scopes when you click <b>Select vendors</b> on a bid.</p>
   ${SCOPE_GROUPS.map(g=>{const xs=names.filter(n=>groupOf(n)===g);return xs.length?`<div style="margin-bottom:12px"><div class="small" style="font-weight:600;margin-bottom:6px">${esc(g)}</div><div class="tplgrid">${xs.map(n=>`<label class="check"><input type="checkbox" data-vs="${esc(n)}" ${mine.some(x=>x.toLowerCase()===n.toLowerCase())?'checked':''}${d}> ${esc(n)}</label>`).join('')}</div></div>`:''}).join('')}
  </fieldset>`;
}
function vendorModal(){const v=M.draft,isNew=M.isNew;const s=vendorStats(v.id);
  return mhead(isNew?'New vendor':v.company||'Vendor',v.trade||'')+`<div class="mbody">
   ${isNew?'':`<div class="statline"><div><b>${s.asked}</b>Quotes asked</div><div><b>${s.rec}</b>Received</div><div><b>${s.rate==null?'—':s.rate+'%'}</b>Response rate</div><div><b>${s.open}</b>Open now</div></div>`}
   <fieldset><legend>Vendor</legend><div class="fg">
   <label class="f s2">Company ${isAdmin()?'<span class="req">required</span>':''}${ef('company','e.g. Metro Pipe Supply')}</label><label class="f">Vendor type<select class="field" data-ef="vendor_type"${DIS()}><option value="">Pick one…</option>${VENDOR_TYPES.map(o=>`<option${v.vendor_type===o?' selected':''}>${esc(o)}</option>`).join('')}</select></label><label class="f">Trade${efSel('trade',TRADES)}</label>
   <label class="f s2">Contact name${ef('contact_name','Estimator or rep')}</label><label class="f">Phone${ef('phone','(000) 000-0000','tel')}</label><label class="f">Email${ef('email','quotes@vendor.com','email')}</label>
   <label class="f s2">Area served${ef('area','e.g. Metro Atlanta, north GA')}</label><label class="check s2" style="align-self:end;padding-bottom:10px"><input type="checkbox" data-ef="preferred" ${v.preferred?'checked':''}${DIS()}> Preferred vendor</label>
   <label class="f s4">Notes<textarea class="field" data-ef="notes" placeholder="Pricing terms, lead times, insurance on file…"${DIS()}>${esc(v.notes||'')}</textarea></label></div></fieldset>
   ${vendorScopeField(v)}
   ${isNew?'':`<fieldset><legend>Quote history</legend>${s.qs.length?`<div class="list">${s.qs.sort((a,b)=>(b.q.requested_date||'').localeCompare(a.q.requested_date||'')).map(({b,q})=>`<div class="li"><div><button class="linkish" data-act="open-bid" data-id="${b.id}">${esc(b.name)}</button><div class="dim small">${esc(q.scope||'')}${q.requested_date?' · asked '+fmtShort(q.requested_date):''}${q.file_path?` · <button class="linkbtn" style="font-size:12.5px" data-act="dl" data-path="${esc(q.file_path)}" data-name="${esc(q.file_name||'quote')}">${esc(q.file_name||'Quote file')}</button>`:''}</div></div><div style="text-align:right">${pill(q.status,QUOTE_CLS[q.status])}<div class="num small">${q.amount!=null?money(q.amount):''}</div></div></div>`).join('')}</div>`:'<div class="empty">No quote requests yet.</div>'}</fieldset>`}</div>`+entFoot('Add vendor',isNew)}
function boardModal(){const cfg=M.draft;return mhead('Customize board view','Choose what board members see. Saved for everyone.')+`<div class="mbody"><fieldset><legend>Sections</legend><div class="rows">
  ${WIDGETS.map(([k,l])=>`<label class="check"><input type="checkbox" data-wf="${k}" ${cfg[k]?'checked':''}> ${l}</label>`).join('')}</div></fieldset></div>
  <div class="mfoot"><div></div><div class="r"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="save">Save view</button></div></div>`}
function companyModal(){return mhead('Company','Shown at the top of the app for your whole team.')+`<div class="mbody"><fieldset><legend>Details</legend><div class="fg"><label class="f s4">Company name${ef('companyName','Your company name')}</label></div></fieldset></div>
  <div class="mfoot"><div></div><div class="r"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="save">Save</button></div></div>`}

/* ---------- saving ---------- */
const nullIfEmpty=v=>v===''||v===undefined?null:v;
function quoteRowData(q){const r={};Q_COLS.forEach(k=>r[k]=q[k]);['requested_date','due_date','received_date','file_path','file_name'].forEach(k=>r[k]=nullIfEmpty(r[k]));r.updated_by=S.session.user.id;return r}
async function saveBid(){
  const d=M.draft;
  if(d.quotes.some(q=>q._uploading)||M.uploading)throw new Error('Wait for the upload to finish.');
  if(!canWork(d))throw new Error('You don’t have permission to change this bid.');
  if(!d.name.trim())throw new Error('Add a project name before saving.');
  d.client_proposals=Object.fromEntries(Object.entries(d.client_proposals||{}).filter(([k])=>d.client_ids.includes(k)));
  if(!d.client_ids.includes(d.awarded_client_id))d.awarded_client_id='';
  const sent=d.client_ids.map(id=>propOf(d,id)).filter(p=>['Sent','Lost','Awarded'].includes(p.status));
  if(d.status==='Estimating'&&sent.length)d.status='Submitted';          // a proposal went out
  if(!d.submitted_date){const ds=sent.map(p=>p.sent_date).filter(Boolean).sort();if(ds.length)d.submitted_date=ds[0]}
  if(d.status==='Awarded'&&!d.awarded_client_id&&d.client_ids.length===1)d.awarded_client_id=d.client_ids[0];
  if(['Submitted','Awarded','Lost'].includes(d.status)&&!d.submitted_date)d.submitted_date=todayStr();
  d.addenda=addenda(d).filter(a=>a.number!=null||a.description||a.date);d.revisions=revisions(d);
  // Log a proposal revision automatically once the proposal has gone out and its numbers change
  const out=['Submitted','Awarded','Lost'].includes(d.status)||d.proposal_status==='Sent';
  if(out&&bidValue(d)){const last=d.revisions[d.revisions.length-1];
    if(!last)addRevision(d,'Original proposal',true);
    else if(JSON.stringify(last.snapshot)!==JSON.stringify(revSnap(d)))addRevision(d,'Numbers updated',true);}
  if(d.status==='Awarded'&&!d.awarded_date)d.awarded_date=todayStr();
  if(d.status==='Submitted'&&d.proposal_status!=='Sent')d.proposal_status='Sent';
  const row={};BID_COLS.forEach(k=>row[k]=d[k]);
  ['due_date','due_time','walk_date','rfi_date','submitted_date','awarded_date','lead_estimator_id','awarded_client_id'].forEach(k=>row[k]=nullIfEmpty(row[k]));
  row.follow_ups=(d.follow_ups||[]).filter(f=>f.date||f.note);row.updated_by=S.session.user.id;
  if(d._new)await run(sb.from('bids').insert(row));
  else{const {id,...rest}=row;await run(sb.from('bids').update(rest).eq('id',id))}
  d._new=false;
  if(isAdmin()){const gone=(M.origQuoteIds||[]).filter(id=>!d.quotes.some(q=>q.id===id));if(gone.length)await run(sb.from('quotes').delete().in('id',gone))}
  if(d.quotes.length)await run(sb.from('quotes').upsert(d.quotes.map(quoteRowData)));
  M.origQuoteIds=d.quotes.map(q=>q.id);
  await Promise.all([loadTable('bids'),loadTable('quotes')]);
}
async function saveLib(next){await run(sb.from('settings').upsert({key:'scope_library',value:next}));await loadTable('settings')}
async function saveModal(){
  const d=M.draft;const btn=$('#modal [data-act=save]');if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{
    if(M.kind==='bid'){await saveBid();toast(`Saved ${d.name}`)
    }else if(['est','client','vendor'].includes(M.kind)){
      const t={est:'estimators',client:'clients',vendor:'vendors'}[M.kind];
      if(!String(d.name??d.company??'').trim())throw new Error(M.kind==='est'?'Add a name.':'Add a company name.');
      if(M.kind==='client')d.contacts=(d.contacts||[]).filter(c=>c.name||c.email||c.phone);
      const row={};ENT_COLS[t].forEach(k=>row[k]=d[k]);
      await run(sb.from(t).upsert(row));await loadTable(t);toast('Saved');
    }else if(M.kind==='board'){await run(sb.from('settings').upsert({key:'board',value:{widgets:d}}));await loadTable('settings');toast('Board view saved')}
    else if(M.kind==='lib'){
      const seen=new Set();const scopes=M.draft.map(x=>({name:String(x.name||'').trim(),group:x.group,perform:PERFORM.includes(x.perform)?x.perform:'Self perform'})).filter(x=>x.name&&!seen.has(x.name.toLowerCase())&&seen.add(x.name.toLowerCase()));
      await saveLib({scopes,templates:lib().templates||[]});toast('Scope list saved');
    }else if(M.kind==='tpl'){
      if(!d.name.trim())throw new Error('Name the template.');if(!d.scopes.length)throw new Error('Pick at least one scope.');
      const L=clone(lib());L.templates=L.templates||[];const i=L.templates.findIndex(t=>t.id===d.id);const t={id:d.id,name:d.name.trim(),scopes:d.scopes};
      if(i>=0)L.templates[i]=t;else L.templates.push(t);await saveLib(L);toast('Template saved');
    }
    else if(M.kind==='company'){await run(sb.from('settings').upsert({key:'general',value:{companyName:(d.companyName||'').trim()}}));await loadTable('settings');toast('Company name saved')}
    closeModal();
  }catch(e){toast(errMsg(e));if(btn){btn.disabled=false;btn.textContent='Try again'}}
}
async function deleteModal(){
  if(!M.arm){M.arm=true;renderModal();return}
  if(M.kind==='tpl'){try{const L=clone(lib());L.templates=(L.templates||[]).filter(t=>t.id!==M.draft.id);await saveLib(L);toast('Template deleted');closeModal()}catch(e){toast(errMsg(e))}return}
  const t={bid:'bids',est:'estimators',client:'clients',vendor:'vendors'}[M.kind];
  try{
    if(M.kind==='bid'){ // remove the bid's stored files too
      const paths=[...filesFor(M.draft.id).map(f=>f.file_path),...quotesFor(M.draft.id).map(q=>q.file_path).filter(Boolean)];
      if(paths.length)await sb.storage.from(BUCKET).remove(paths);
    }
    await run(sb.from(t).delete().eq('id',M.draft.id));await loadTable(t);toast('Deleted');closeModal();
  }catch(e){toast(errMsg(e))}
}

/* ---------- files ---------- */
const safeName=n=>n.replace(/[^\w.\-]+/g,'_').slice(-120);
async function uploadTo(bidId,folder,file){
  const path=`${bidId}/${folder}/${newId()}-${safeName(file.name)}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
  if(error)throw error;return path;
}
async function uploadQuote(i,file){
  const q=M?.draft.quotes[i];if(!q||!file)return;q._uploading=true;renderModal();
  try{const path=await uploadTo(M.draft.id,'quotes',file);q.file_path=path;q.file_name=file.name;if(q.status!=='Received')q.status='Received';if(!q.received_date)q.received_date=todayStr();toast('Quote uploaded. Save to keep it.')}
  catch(e){toast(/exceeded|too large|413/i.test(e.message||'')?'That file is too large for your storage settings.':errMsg(e))}
  finally{delete q._uploading;if(M)renderModal()}
}
async function uploadDocs(files){
  const bidId=M.draft.id;const cat=$('#file-cat')?.value||'Other';M.uploading=true;renderModal();let n=0;
  for(const file of files){
    try{const path=await uploadTo(bidId,'docs',file);
      await run(sb.from('bid_files').insert({bid_id:bidId,file_path:path,file_name:file.name,category:cat,size_bytes:file.size,uploaded_by:S.session.user.id,uploaded_by_name:myName()}));n++}
    catch(e){toast(`${file.name}: ${errMsg(e)}`)}
  }
  await loadTable('bid_files');if(M){M.uploading=false;renderModal()}if(n)toast(`Uploaded ${n} file${n===1?'':'s'}`);
}
async function removeFile(id){
  const f=byId(S.bid_files,id);if(!f)return;
  try{await sb.storage.from(BUCKET).remove([f.file_path]);await run(sb.from('bid_files').delete().eq('id',id));await loadTable('bid_files');renderModal();toast('File deleted')}catch(e){toast(errMsg(e))}
}
async function download(path,name){
  toast('Preparing download…');
  const {data,error}=await sb.storage.from(BUCKET).download(path);
  if(error){toast(errMsg(error));return}
  const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=name||'file';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function exportCsv(){
  const cols=['Project','Location','Status','Clients','Lead estimator','Due date','Bid type','Project type','With site impr.','Without site impr.','Dashboard value','Win %','Submitted','Awarded date','Awarded by','Awarded amount','Lost reason','Scopes signed off','Addenda','Addenda open','Latest revision','Quotes received','Quotes requested'];
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const rows=S.bids.map(b=>{const qs=quotesFor(b.id);return [b.name,b.location,b.status,(b.client_ids||[]).map(clientName).join('; '),estName(b.lead_estimator_id),b.due_date,b.bid_type,b.project_type,b.amount_with,b.amount_without,bidValue(b),b.probability,b.submitted_date,b.awarded_date,b.awarded_client_id?clientName(b.awarded_client_id):'',b.awarded_amount,b.lost_reason,scopeItems(b).filter(x=>x.status==='Complete').length+'/'+scopeItems(b).length,addenda(b).length,openAddenda(b).length,revisions(b).length?'Rev '+revisions(b)[revisions(b).length-1].rev:'',qs.filter(x=>x.status==='Received').length,qs.length].map(q).join(',')});
  const blob=new Blob([[cols.map(q).join(','),...rows].join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bid-pipeline-'+todayStr()+'.csv';a.click();
}


/* =====================================================================
   Excel import / export (template in templates/Bid-Import-Template.xlsx)
   ===================================================================== */
// The import template is built into the app (base64 .xlsx), so it always downloads — no extra file needed.
const IMPORT_TEMPLATE_B64='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';
function downloadTemplate(type){
  type=type||'bids';const bin=atob(type==='bids'?IMPORT_TEMPLATE_B64:DIR_TEMPLATES[type]);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a');a.href=url;a.download=({bids:'Bid',clients:'Clients',vendors:'Vendors'}[type])+'-Import-Template.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
const IMPORT_COLS=[
  ['name','Project name*',['projectname','project','job','jobname','projectnameoptional']],
  ['location','Location',['location','address','city','jobaddress']],
  ['project_type','Project type',['projecttype','type']],
  ['bid_type','Bid type',['bidtype']],
  ['status','Status',['status','bidstatus']],
  ['due_date','Bid due date',['bidduedate','duedate','due','biddue']],
  ['due_time','Due time',['duetime','time']],
  ['walk_date','Site walk date',['sitewalkdate','sitewalk','prebid','prebiddate']],
  ['rfi_date','RFI deadline',['rfideadline','rfidate','rfi']],
  ['lead','Lead estimator',['leadestimator','estimator','lead']],
  ['support','Supporting estimators',['supportingestimators','supportestimators','support']],
  ['clients','GCs / clients',['gcsclients','gcclients','gcclient','gc','gcs','client','clients','generalcontractor','generalcontractors','owner']],
  ['amount_with','Base w/ site impr.',['basewsiteimpr','wsiteimpr','withsiteimprovements','withsite','amountwith','proposalwithsiteimprovements','proposaltotalwithsiteimprovements']],
  ['amount_without','Base w/o site impr.',['basewositeimpr','wositeimpr','withoutsiteimprovements','withoutsite','amountwithout','proposalwithoutsiteimprovements','proposaltotalwithoutsiteimprovements']],
  ['use_for','Dashboard uses (With/Without)',['dashboarduseswithwithout','dashboarduses','usefor','usefordashboardtotals']],
  ['probability','Win probability %',['winprobability','probability','win']],
  ['proposal_status','Proposal status',['proposalstatus','proposal']],
  ['submitted_date','Submitted date',['submitteddate','datesubmitted','submitted']],
  ['awarded_by','Awarded by',['awardedby']],
  ['awarded_date','Awarded date',['awardeddate','dateawarded']],
  ['awarded_amount','Contract amount',['contractamount','awardedamount','contract']],
  ['lost_reason','Lost reason',['lostreason']],
  ['awarded_to','Awarded to / low number',['awardedtolownumber','awardedto','lownumber','winner']],
  ['last_contact','Last GC contact',['lastgccontact','lastcontact','lastfollowup']],
  ['scopes','Scopes',['scopes','scope']],
  ['notes','Notes',['notes','comments','comment']]];
const GCP_COLS=[['project','Project name*',['projectname','project','job']],['client','GC / client*',['gcclient','gc','client','generalcontractor','owner']],
  ['amount_with','W/ site impr.',['wsiteimpr','withsiteimprovements','amountwith','withsite']],['amount_without','W/O site impr.',['wositeimpr','withoutsiteimprovements','amountwithout','withoutsite']],
  ['sent_date','Sent date',['sentdate','datesent','sent']],['status','Status',['status','proposalstatus']]];
const DATE_KEYS=['due_date','walk_date','rfi_date','submitted_date','awarded_date','last_contact','sent_date'];
const MONEY_KEYS=['amount_with','amount_without','awarded_amount'];
const normH=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
let XLSXP=null;
const XLSX_SRC=['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'];
function loadXLSX(){return XLSXP||(XLSXP=new Promise((res,rej)=>{if(window.XLSX)return res(window.XLSX);
  const tryAt=i=>{if(i>=XLSX_SRC.length){XLSXP=null;return rej(new Error('Couldn’t load the Excel reader. Check your connection and try again.'))}
    const sc=document.createElement('script');sc.src=XLSX_SRC[i];sc.onload=()=>window.XLSX?res(window.XLSX):tryAt(i+1);sc.onerror=()=>{sc.remove();tryAt(i+1)};document.head.appendChild(sc)};tryAt(0)}))}
function xDate(v,X){
  if(v===''||v==null)return '';
  if(typeof v==='number'){const c=X.SSF.parse_date_code(v);return c?`${c.y}-${pad(c.m)}-${pad(c.d)}`:null}
  const t=String(v).trim();if(!t||/^[-–—]+$/.test(t))return '';
  let m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);if(m)return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(t);if(m){const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${pad(m[1])}-${pad(m[2])}`}
  const d=new Date(t.replace(/^[^\w]*/,''));return isNaN(d)?null:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function xTime(v){
  if(v===''||v==null)return '';
  if(typeof v==='number'){const mins=Math.round((v%1)*1440);return `${pad(Math.floor(mins/60)%24)}:${pad(mins%60)}`}
  const m=/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(String(v).trim());if(!m)return null;
  let h=+m[1];if(m[3]){h=h%12+(/pm/i.test(m[3])?12:0)}return `${pad(h)}:${m[2]||'00'}`;
}
function xMoney(v){if(v===''||v==null)return null;if(typeof v==='number')return v;const t=String(v).replace(/[$,\s]/g,'');if(!t||/^[-–—]+$/.test(t))return null;const n=+t;return isNaN(n)?undefined:n}
const xList=v=>String(v??'').split(/[;\n]|,(?=\s*[A-Za-z])/).map(x=>x.trim()).filter(Boolean);
function xStatus(v){const t=normH(v);if(!t)return '';
  if(['estimating','pending','inprogress','notstarted','active','open','bidding'].includes(t))return 'Estimating';
  if(['submitted','sent','pendingdecision','awaitingdecision','proposalsent'].includes(t))return 'Submitted';
  if(['onhold','hold','paused'].includes(t))return 'On Hold';
  if(['awarded','won','win','awardedtous'].includes(t))return 'Awarded';
  if(['lost','notawarded','didnotwin'].includes(t))return 'Lost';
  if(['nobid','declined','passed','didnotbid'].includes(t))return 'No Bid';return null}
function xProposal(v){const t=normH(v);if(!t)return '';return {notstarted:'Not Started',inprogress:'In Progress',complete:'Complete',completed:'Complete',done:'Complete',sent:'Sent',submitted:'Sent'}[t]||null}
function xFromList(v,list){const t=normH(v);if(!t)return '';return list.find(x=>normH(x)===t)||null}
function mapHeader(row,cols){const map={};const ignored=[];row.forEach((h,i)=>{const n=normH(h);if(!n)return;const c=cols.find(([k,l,al])=>normH(l)===n||al.includes(n));if(c&&map[c[0]]==null)map[c[0]]=i;else ignored.push(String(h).trim())});return{map,ignored}}
function findTable(X,ws,cols){
  const rows=X.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
  for(let r=0;r<Math.min(rows.length,15);r++){const {map,ignored}=mapHeader(rows[r],cols);if(map[cols[0][0]]!=null&&Object.keys(map).length>=2)return{rows:rows.slice(r+1),map,ignored,headerRow:r+1}}
  return null;
}

async function readImportFile(file){
  const X=await loadXLSX();
  const wb=X.read(await file.arrayBuffer(),{type:'array'});
  const names=wb.SheetNames;
  const bidName=names.find(n=>/^\s*bids?\s*$/i.test(n))||names.find(n=>!/instruction|list|proposal/i.test(n))||names[0];
  const t=findTable(X,wb.Sheets[bidName],IMPORT_COLS);
  if(!t)throw new Error('Couldn’t find a “Project name” column. Use the import template, or make sure the first row has column headings.');
  const gName=names.find(n=>/proposal/i.test(n));const g=gName?findTable(X,wb.Sheets[gName],GCP_COLS):null;
  return buildImportPlan(X,t,g,file.name);
}

function buildImportPlan(X,t,g,fileName){
  const cName=n=>normH(n);
  const clientBy=new Map(S.clients.map(c=>[cName(c.company),c]));
  const estBy=new Map();S.estimators.forEach(e=>{estBy.set(cName(e.name),e);if(e.email)estBy.set(cName(e.email),e)});
  const existing=new Map(S.bids.map(b=>[normH(b.name)+'|'+(b.due_date||''),b]));
  const existingByName=new Map();S.bids.forEach(b=>{const k=normH(b.name);existingByName.set(k,(existingByName.get(k)||[]).concat(b))});
  const newClients=new Map(),newEsts=new Map(),seen=new Set();
  const clientRef=name=>{const k=cName(name);if(!k)return null;if(clientBy.has(k))return clientBy.get(k).id;if(!newClients.has(k))newClients.set(k,{id:newId(),company:name.trim(),type:'General contractor',contacts:[]});return newClients.get(k).id};
  const estRef=name=>{const k=cName(name);if(!k)return null;if(estBy.has(k))return estBy.get(k).id;if(!newEsts.has(k))newEsts.set(k,{id:newId(),name:name.trim(),active:true});return newEsts.get(k).id};
  const get=(row,key)=>t.map[key]==null?'':row[t.map[key]];
  const items=[];
  t.rows.forEach((row,ri)=>{
    if(row.every(c=>String(c).trim()===''))return;
    const rowNo=t.headerRow+ri+1;const issues=[],errors=[];const f={};
    const name=String(get(row,'name')).trim();if(!name){errors.push('Missing project name');}
    f.name=name;
    ['location','notes','awarded_to'].forEach(k=>{const v=String(get(row,k)).trim();if(v)f[k]=v});
    DATE_KEYS.forEach(k=>{if(t.map[k]==null)return;const v=xDate(get(row,k),X);if(v===null)issues.push(`Couldn’t read ${k.replace(/_/g,' ')} “${get(row,k)}”`);else if(v)f[k]=v});
    if(t.map.due_time!=null){const v=xTime(get(row,'due_time'));if(v===null)issues.push(`Couldn’t read due time “${get(row,'due_time')}”`);else if(v)f.due_time=v}
    MONEY_KEYS.forEach(k=>{if(t.map[k]==null)return;const v=xMoney(get(row,k));if(v===undefined)issues.push(`Couldn’t read amount “${get(row,k)}”`);else if(v!=null)f[k]=v});
    const st=xStatus(get(row,'status'));if(st===null){issues.push(`Unknown status “${get(row,'status')}”, used Estimating`);f.status='Estimating'}else if(st)f.status=st;
    const ps=xProposal(get(row,'proposal_status'));if(ps===null)issues.push(`Unknown proposal status “${get(row,'proposal_status')}”`);else if(ps)f.proposal_status=ps;
    const pt=xFromList(get(row,'project_type'),PROJECT_TYPES);if(pt===null){issues.push(`Project type “${get(row,'project_type')}” set to Other`);f.project_type='Other'}else if(pt)f.project_type=pt;
    const bt=xFromList(get(row,'bid_type'),BID_TYPES);if(bt===null)issues.push(`Unknown bid type “${get(row,'bid_type')}”, left as default`);else if(bt)f.bid_type=bt;
    const lr=xFromList(get(row,'lost_reason'),LOST_REASONS.filter(Boolean));if(lr===null){const v=String(get(row,'lost_reason')).trim();f.lost_reason='Unknown';f.notes=((f.notes?f.notes+'\n':'')+'Lost reason: '+v);issues.push(`Lost reason “${v}” saved in notes`)}else if(lr)f.lost_reason=lr;
    const uf=normH(get(row,'use_for'));if(uf)f.use_for=/without|wo|^no/.test(uf)?'without':'with';else if(f.amount_without!=null&&f.amount_with==null)f.use_for='without';
    if(t.map.probability!=null&&String(get(row,'probability')).trim()!==''){let p=xMoney(String(get(row,'probability')).replace('%',''));if(p!=null&&p!==undefined){if(p<=1&&p>0)p*=100;f.probability=Math.max(0,Math.min(100,Math.round(p/5)*5))}}
    const lead=String(get(row,'lead')).trim();if(lead)f.lead_estimator_id=estRef(lead);
    const sup=xList(get(row,'support')).map(estRef).filter(id=>id&&id!==f.lead_estimator_id);if(sup.length)f.support_estimator_ids=[...new Set(sup)];
    const cl=xList(get(row,'clients')).map(clientRef).filter(Boolean);if(cl.length)f.client_ids=[...new Set(cl)];
    const ab=String(get(row,'awarded_by')).trim();if(ab){const id=clientRef(ab);f.awarded_client_id=id;f.client_ids=[...new Set([...(f.client_ids||[]),id])];if(!f.status)f.status='Awarded'}
    const sc=xList(get(row,'scopes'));if(sc.length)f.scopes=sc;
    const key=normH(name)+'|'+(f.due_date||'');
    let action='new',target=null;
    if(!errors.length){
      const sameName=existingByName.get(normH(name))||[];
      target=existing.get(key)||(!f.due_date&&sameName.length?sameName[0]:null);
      if(target){action='duplicate';issues.push('Already in the app — left as it is')}
      else if(sameName.length){action='possible';target=sameName[0];issues.push(`A bid with this name is already in the app${sameName[0].due_date?' (due '+fmtDate(sameName[0].due_date)+')':''}`)}
      if(seen.has(key)||seen.has(normH(name)+'|')){action='skip';issues.push('Same project appears earlier in this file')}
      seen.add(key);if(!f.due_date)seen.add(normH(name)+'|');
    }else action='error';
    items.push({rowNo,f,issues,errors,action,target});
  });
  // GC proposals sheet
  const gcRows=[];
  if(g){g.rows.forEach((row,ri)=>{const gv=k=>g.map[k]==null?'':row[g.map[k]];const project=String(gv('project')).trim(),client=String(gv('client')).trim();
    if(!project&&!client)return;const it=items.find(x=>normH(x.f.name)===normH(project)&&x.action!=='error'&&x.action!=='skip');
    const r={rowNo:g.headerRow+ri+1,project,client,ok:!!(it&&client),item:it};
    if(r.ok){const cid=clientRef(client);const st=xFromList(gv('status'),[...CP_ST,'Awarded'])||'';
      const w=xMoney(gv('amount_with')),o=xMoney(gv('amount_without'));const sd=xDate(gv('sent_date'),X);
      it.gcs=it.gcs||[];it.gcs.push({cid,amount_with:w??null,amount_without:o??null,sent_date:sd||'',status:st});}
    gcRows.push(r)})}
  return {fileName,items,gcRows,newClients:[...newClients.values()],newEsts:[...newEsts.values()],ignored:t.ignored,include:{},createClients:true,createEsts:true};
}

function importBid(f,base){
  const d=Object.assign(clone(base),{});
  Object.entries(f).forEach(([k,v])=>{if(['scopes','support_estimator_ids','client_ids','last_contact','awarded_client_id'].includes(k))return;d[k]=v});
  d.support_estimator_ids=[...new Set([...(d.support_estimator_ids||[]),...(f.support_estimator_ids||[])])];
  d.client_ids=[...new Set([...(d.client_ids||[]),...(f.client_ids||[])])];
  d.client_proposals=Object.assign({},d.client_proposals||{});
  if(f.awarded_client_id)d.awarded_client_id=f.awarded_client_id;
  if(f.last_contact&&!(d.follow_ups||[]).some(x=>x.date===f.last_contact))d.follow_ups=[...(d.follow_ups||[]),{date:f.last_contact,note:'Imported'}];
  const closed=['Submitted','Awarded','Lost'].includes(d.status);
  if(f.scopes){const have=new Set(scopeItems(d).map(x=>x.name.toLowerCase()));d.scope_items=[...scopeItems(d)];
    f.scopes.forEach(n=>{if(have.has(n.toLowerCase()))return;const ls=libScope(n);const it={id:newId(),name:ls?.name||n,group:ls?.group||'Other',perform:ls?.perform||'Self perform',status:'Not Started',assignee_id:''};
      if(closed)Object.assign(it,{status:'Complete',signed_initials:'IMP',signed_by_name:'Imported',signed_by_user:S.session.user.id,signed_by_estimator_id:null,signed_at:new Date().toISOString()});
      d.scope_items.push(it)})}
  if(closed)d.client_ids.forEach(cid=>{const p=d.client_proposals[cid]=Object.assign({},d.client_proposals[cid]);if(!p.status||p.status==='Not sent')p.status='Sent';if(!p.sent_date&&d.submitted_date)p.sent_date=d.submitted_date});
  (f._gcs||[]).forEach(x=>{if(!d.client_ids.includes(x.cid))d.client_ids.push(x.cid);const p=d.client_proposals[x.cid]=Object.assign({},d.client_proposals[x.cid]);
    ['amount_with','amount_without'].forEach(k=>{if(x[k]!=null)p[k]=x[k]});if(x.sent_date)p.sent_date=x.sent_date;if(x.status)p.status=x.status;if(x.status==='Awarded'){d.awarded_client_id=x.cid;if(d.status!=='Awarded')d.status='Awarded'}});
  if(d.status==='Awarded'&&!d.awarded_client_id&&d.client_ids.length===1)d.awarded_client_id=d.client_ids[0];
  if(d.status==='Awarded'&&d.awarded_client_id)d.client_ids.forEach(cid=>{const p=d.client_proposals[cid]=Object.assign({},d.client_proposals[cid]);p.status=cid===d.awarded_client_id?'Awarded':(p.status==='Not sent'?p.status:'Lost')});
  if((d.status==='Estimating'||!d.status)&&d.client_ids.some(cid=>['Sent','Lost','Awarded'].includes(propOf(d,cid).status)))d.status='Submitted';
  const closed2=['Submitted','Awarded','Lost'].includes(d.status);
  if(d.status==='Lost')d.client_ids.forEach(cid=>{const p=d.client_proposals[cid]=Object.assign({},d.client_proposals[cid]);if(p.status!=='Not sent')p.status='Lost'});
  if(closed2&&!d.submitted_date){const ds=d.client_ids.map(cid=>propOf(d,cid).sent_date).filter(Boolean).sort();d.submitted_date=ds[0]||d.due_date||''}
  if(closed2)d.proposal_status='Sent';
  if(closed2&&bidValue(d)&&!revisions(d).length)d.revisions=[{id:newId(),rev:0,date:d.submitted_date||todayStr(),reason:'Imported',addendum:'',snapshot:revSnap(d),by:myName(),auto:true}];
  return d;
}

async function runImport(){
  const P=M.plan;M.running=true;renderModal();
  const res={created:0,skipped:0,failed:[],clients:0,ests:0};
  try{
    const usedC=new Set(),usedE=new Set();
    const willAdd=x=>x.action==='new'||(x.action==='possible'&&P.include[x.rowNo]);
    const todo=P.items.filter(willAdd);
    todo.forEach(x=>{(x.f.client_ids||[]).forEach(id=>usedC.add(id));if(x.f.awarded_client_id)usedC.add(x.f.awarded_client_id);(x.gcs||[]).forEach(g=>usedC.add(g.cid));[x.f.lead_estimator_id,...(x.f.support_estimator_ids||[])].forEach(id=>id&&usedE.add(id))});
    const nc=P.newClients.filter(c=>usedC.has(c.id)),ne=P.newEsts.filter(e=>usedE.has(e.id));
    if(P.createClients&&nc.length){await run(sb.from('clients').insert(nc));res.clients=nc.length}
    if(P.createEsts&&ne.length){await run(sb.from('estimators').insert(ne));res.ests=ne.length}
    const dropC=new Set(P.createClients?[]:nc.map(c=>c.id)),dropE=new Set(P.createEsts?[]:ne.map(e=>e.id));
    const inserts=[];
    for(const x of P.items){
      if(!willAdd(x)){res.skipped++;continue}
      const f=clone(x.f);f._gcs=(x.gcs||[]).filter(g=>!dropC.has(g.cid));
      if(f.client_ids)f.client_ids=f.client_ids.filter(id=>!dropC.has(id));if(dropC.has(f.awarded_client_id))delete f.awarded_client_id;
      if(dropE.has(f.lead_estimator_id))delete f.lead_estimator_id;if(f.support_estimator_ids)f.support_estimator_ids=f.support_estimator_ids.filter(id=>!dropE.has(id));
      const base=newBid();
      const d=importBid(f,base);
      const row={};BID_COLS.forEach(k=>row[k]=d[k]);
      ['due_date','due_time','walk_date','rfi_date','submitted_date','awarded_date','lead_estimator_id','awarded_client_id'].forEach(k=>row[k]=nullIfEmpty(row[k]));
      row.updated_by=S.session.user.id;
      inserts.push([x,row]);
    }
    for(let i=0;i<inserts.length;i+=100){const chunk=inserts.slice(i,i+100);
      try{await run(sb.from('bids').insert(chunk.map(c=>c[1])));res.created+=chunk.length}
      catch(e){for(const [x,row] of chunk){try{await run(sb.from('bids').insert(row));res.created++}catch(e2){res.failed.push(`Row ${x.rowNo}: ${errMsg(e2)}`)}}}}
    await Promise.all(['bids','clients','estimators'].map(loadTable));
  }catch(e){res.failed.push(errMsg(e))}
  M.running=false;M.result=res;M.plan=null;renderModal();
}

function importModal(){
  if(M.type&&M.type!=='bids')return dirImportModal();
  const foot=(l,r)=>`<div class="mfoot"><div>${l||''}</div><div class="r">${r}</div></div>`;
  if(M.result){const r=M.result;return mhead('Import finished',M.fileName||'')+`<div class="mbody"><div class="statline"><div><b>${r.created}</b>Bids added</div><div><b>${r.skipped}</b>Skipped</div><div><b>${r.clients}</b>GCs added</div><div><b>${r.ests}</b>Estimators added</div><div><b>${r.failed.length}</b>Problems</div></div>
    <p class="hint">Nothing already in the app was changed.</p>
    ${r.failed.length?`<fieldset><legend>Problems</legend><div class="list">${r.failed.map(x=>`<div class="li small">${esc(x)}</div>`).join('')}</div></fieldset>`:''}</div>`+foot('','<button class="btn primary" data-act="close">Done</button>')}
  if(!M.plan)return mhead('Import bids from Excel','Move your existing jobs into the app')+`<div class="mbody">
    <div class="notice">This is for bringing jobs over from spreadsheets. It only <b>adds</b> jobs that aren’t in the app yet — nothing already here is changed or removed. New bids are still created with <b>+ New bid</b>.</div>
    <fieldset><legend>1. Download the template</legend><p style="margin:0 0 10px">Fill in one row per job, current and past. Only <b>Project name</b> is required; leave anything you don’t know blank. The <b>GC proposals</b> tab is optional, for jobs that went to several GCs at different numbers.</p>
      <div class="adders" style="margin:0"><button class="btn primary" data-act="dl-template">Download import template (.xlsx)</button></div>
      <p class="hint">Already have a spreadsheet? It can import that too, as long as the first row has column headings like “Project”, “GC”, “Due date”, “Status”. Excel (.xlsx, .xls) and CSV files work.</p></fieldset>
    <fieldset><legend>2. Choose your file</legend><label class="drop${M.reading?' busy':''}"><input type="file" accept=".xlsx,.xls,.csv" data-importfile>${M.reading?'Reading file…':'<b>Click to choose a file</b><span class="dim small">or drag it here</span>'}</label>
      ${M.error?`<div class="err" style="margin-top:10px">${esc(M.error)}</div>`:''}
      <p class="hint">Nothing is saved until you review the preview and click Import.</p></fieldset></div>`+foot('','<button class="btn" data-act="close">Cancel</button>');
  const P=M.plan;const it=P.items;
  const cnt=a=>it.filter(x=>x.action===a).length;const withIssues=it.filter(x=>x.issues.length&&x.action!=='error').length;
  const willImport=cnt('new')+it.filter(x=>x.action==='possible'&&P.include[x.rowNo]).length;
  const label={new:['Add','good'],duplicate:['Already in app','na'],possible:['Possible duplicate','warn'],skip:['Skip',''],error:['Error','bad']};
  return mhead('Review import',P.fileName)+`<div class="mbody">
    <div class="statline"><div><b>${it.length}</b>Rows</div><div><b>${cnt('new')}</b>New bids</div><div><b>${cnt('duplicate')}</b>Already in app</div><div><b>${cnt('possible')}</b>Possible duplicates</div><div><b>${cnt('error')}</b>Errors</div></div>
    <fieldset><legend>Options</legend><div class="rows">
      ${cnt('duplicate')?`<div class="small"><b>${cnt('duplicate')} job${cnt('duplicate')===1?' is':'s are'} already in the app</b> (same name and due date) and will be skipped. They won’t be changed.</div>`:''}
      ${cnt('possible')?`<div class="small"><b>${cnt('possible')} possible duplicate${cnt('possible')===1?'':'s'}</b>: same name as a bid in the app but a different due date. They’re skipped unless you tick <b>Add anyway</b> on the row.</div>`:''}
      ${P.newClients.length?`<label class="check"><input type="checkbox" data-imp="createClients"${P.createClients?' checked':''}> Add ${P.newClients.length} new GC${P.newClients.length===1?'':'s'} / client${P.newClients.length===1?'':'s'}: <span class="dim small">${P.newClients.slice(0,8).map(c=>esc(c.company)).join(', ')}${P.newClients.length>8?'…':''}</span></label>`:''}
      ${P.newEsts.length?`<label class="check"><input type="checkbox" data-imp="createEsts"${P.createEsts?' checked':''}> Add ${P.newEsts.length} new estimator${P.newEsts.length===1?'':'s'}: <span class="dim small">${P.newEsts.map(e=>esc(e.name)).join(', ')}</span></label>`:''}
      ${!cnt('duplicate')&&!cnt('possible')&&!P.newClients.length&&!P.newEsts.length?'<div class="dim small">No duplicates, and every GC and estimator matches what’s already in the app.</div>':''}
      ${P.ignored.length?`<div class="dim small">Columns not imported: ${P.ignored.map(esc).join(', ')}</div>`:''}
      ${P.gcRows.length?`<div class="dim small">GC proposals tab: ${P.gcRows.filter(r=>r.ok).length} of ${P.gcRows.length} rows matched to a project in this file.</div>`:''}
    </div></fieldset>
    <div class="panel scroll"><table><thead><tr><th>Row</th><th>Project</th><th>GCs / clients</th><th>Due</th><th>Status</th><th class="r">Value</th><th>Result</th><th>Notes</th></tr></thead><tbody>
    ${it.map(x=>{const f=x.f;const names=[...(f.client_ids||[])].map(id=>byId(S.clients,id)?.company||P.newClients.find(c=>c.id===id)?.company||'').filter(Boolean);
      const v=f.use_for==='without'?(f.amount_without??f.amount_with):(f.amount_with??f.amount_without);
      return `<tr><td class="num dim">${x.rowNo}</td><td class="proj">${esc(f.name||'—')}</td><td class="small">${names.map(esc).join(', ')||'<span class="dim">—</span>'}${x.gcs?.length?` <span class="dim">(+${x.gcs.length} proposals)</span>`:''}</td><td class="small" style="white-space:nowrap">${f.due_date?fmtDate(f.due_date):'<span class="dim">—</span>'}</td><td>${f.status?pill(f.status,BID_CLS[f.status]):'<span class="dim small">Estimating</span>'}</td><td class="r num">${v!=null?money(v):'<span class="dim">—</span>'}</td>
      <td style="white-space:nowrap">${pill(label[x.action][0],label[x.action][1])}${x.action==='possible'?`<label class="check small" style="margin-top:6px"><input type="checkbox" data-incl="${x.rowNo}"${P.include[x.rowNo]?' checked':''}> Add anyway</label>`:''}</td><td class="small" style="min-width:220px">${[...x.errors.map(e=>`<b style="color:var(--bad)">${esc(e)}</b>`),...x.issues.map(esc)].join('<br>')||'<span class="dim">—</span>'}</td></tr>`}).join('')}
    </tbody></table></div></div>`+foot('<button class="btn" data-act="imp-restart">Choose a different file</button>',`<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="imp-run"${willImport&&!M.running?'':' disabled'}>${M.running?'Adding…':`Add ${willImport} bid${willImport===1?'':'s'}`}</button>`);
}


/* ---- Clients & GCs / Vendors import (add-only, duplicate-safe) ---- */
const DIR_TEMPLATES={clients:'UEsDBBQAAAAIAHWOPF1Gx01IlQAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE3PTQvCMAwG4L9SdreZih6kDkQ9ip68zy51hbYpbYT67+0EP255ecgboi6JIia2mEXxLuRtMzLHDUDWI/o+y8qhiqHke64x3YGMsRoPpB8eA8OibdeAhTEMOMzit7Dp1C5GZ3XPlkJ3sjpRJsPiWDQ6sScfq9wcChDneiU+ixNLOZcrBf+LU8sVU57mym/8ZAW/B7oXUEsDBBQAAAAIAHWOPF3E6dN58AAAACsCAAARAAAAZG9jUHJvcHMvY29yZS54bWzNks9OwzAMh18F5d666WBA1PWyiRNISEwCcYsSb4to/igxavf2tGHrhOABOMb+5fNnyY0KQvmIz9EHjGQwXQ22c0mosGIHoiAAkjqglakcE25s7ny0ksZn3EOQ6kPuEeqqWoJFklqShAlYhJnI2kYroSJK8vGE12rGh8/YZZhWgB1adJSAlxxYO00Mx6Fr4AKYYITRpu8C6pmYq39icwfYKTkkM6f6vi/7Rc6NO3B4e3p8yesWxiWSTuH4KxlBx4Ardp78ulhvtg+srat6WVT3RX235bfihovr+n1y/eF3EbZem535x8ZnwbaBX3fRfgFQSwMEFAAAAAgAdY48XZlcnCMQBgAAnCcAABMAAAB4bC90aGVtZS90aGVtZTEueG1s7Vpbc9o4FH7vr9B4Z/ZtC8Y2gba0E3Npdtu0mYTtTh+FEViNbHlkkYR/v0c2EMuWDe2STbqbPAQs6fvORUfn6Dh58+4uYuiGiJTyeGDZL9vWu7cv3uBXMiQRQTAZp6/wwAqlTF61WmkAwzh9yRMSw9yCiwhLeBTL1lzgWxovI9bqtNvdVoRpbKEYR2RgfV4saEDQVFFab18gtOUfM/gVy1SNZaMBE1dBJrmItPL5bMX82t4+Zc/pOh0ygW4wG1ggf85vp+ROWojhVMLEwGpnP1Zrx9HSSICCyX2UBbpJ9qPTFQgyDTs6nVjOdnz2xO2fjMradDRtGuDj8Xg4tsvSi3AcBOBRu57CnfRsv6RBCbSjadBk2PbarpGmqo1TT9P3fd/rm2icCo1bT9Nrd93TjonGrdB4Db7xT4fDronGq9B062kmJ/2ua6TpFmhCRuPrehIVteVA0yAAWHB21szSA5ZeKfp1lBrZHbvdQVzwWO45iRH+xsUE1mnSGZY0RnKdkAUOADfE0UxQfK9BtorgwpLSXJDWzym1UBoImsiB9UeCIcXcr/31l7vJpDN6nX06zmuUf2mrAaftu5vPk/xz6OSfp5PXTULOcLwsCfH7I1thhyduOxNyOhxnQnzP9vaRpSUyz+/5CutOPGcfVpawXc/P5J6MciO73fZYffZPR24j16nAsyLXlEYkRZ/ILbrkETi1SQ0yEz8InYaYalAcAqQJMZahhvi0xqwR4BN9t74IyN+NiPerb5o9V6FYSdqE+BBGGuKcc+Zz0Wz7B6VG0fZVvNyjl1gVAZcY3zSqNSzF1niVwPGtnDwdExLNlAsGQYaXJCYSqTl+TUgT/iul2v6c00DwlC8k+kqRj2mzI6d0Js3oMxrBRq8bdYdo0jx6/gX5nDUKHJEbHQJnG7NGIYRpu/AerySOmq3CEStCPmIZNhpytRaBtnGphGBaEsbReE7StBH8Waw1kz5gyOzNkXXO1pEOEZJeN0I+Ys6LkBG/HoY4SprtonFYBP2eXsNJweiCy2b9uH6G1TNsLI73R9QXSuQPJqc/6TI0B6OaWQm9hFZqn6qHND6oHjIKBfG5Hj7lengKN5bGvFCugnsB/9HaN8Kr+ILAOX8ufc+l77n0PaHStzcjfWfB04tb3kZuW8T7rjHa1zQuKGNXcs3Ix1SvkynYOZ/A7P1oPp7x7frZJISvmlktIxaQS4GzQSS4/IvK8CrECehkWyUJy1TTZTeKEp5CG27pU/VKldflr7kouDxb5OmvoXQ+LM/5PF/ntM0LM0O3ckvqtpS+tSY4SvSxzHBOHssMO2c8kh22d6AdNfv2XXbkI6UwU5dDuBpCvgNtup3cOjiemJG5CtNSkG/D+enFeBriOdkEuX2YV23n2NHR++fBUbCj7zyWHceI8qIh7qGGmM/DQ4d5e1+YZ5XGUDQUbWysJCxGt2C41/EsFOBkYC2gB4OvUQLyUlVgMVvGAyuQonxMjEXocOeXXF/j0ZLj26ZltW6vKXcZbSJSOcJpmBNnq8reZbHBVR3PVVvysL5qPbQVTs/+Wa3InwwRThYLEkhjlBemSqLzGVO+5ytJxFU4v0UzthKXGLzj5sdxTlO4Ena2DwIyubs5qXplMWem8t8tDAksW4hZEuJNXe3V55ucrnoidvqXd8Fg8v1wyUcP5TvnX/RdQ65+9t3j+m6TO0hMnHnFEQF0RQIjlRwGFhcy5FDukpAGEwHNlMlE8AKCZKYcgJj6C73yDLkpFc6tPjl/RSyDhk5e0iUSFIqwDAUhF3Lj7++TaneM1/osgW2EVDJk1RfKQ4nBPTNyQ9hUJfOu2iYLhdviVM27Gr4mYEvDem6dLSf/217UPbQXPUbzo5ngHrOHc5t6uMJFrP9Y1h75Mt85cNs63gNe5hMsQ6R+wX2KioARq2K+uq9P+SWcO7R78YEgm/zW26T23eAMfNSrWqVkKxE/Swd8H5IGY4xb9DRfjxRiraaxrcbaMQx5gFjzDKFmON+HRZoaM9WLrDmNCm9B1UDlP9vUDWj2DTQckQVeMZm2NqPkTgo83P7vDbDCxI7h7Yu/AVBLAwQUAAAACAB1jjxd4Us+YG4DAACYCgAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbL1W23LaMBD9FVXt9KGTiY1JCKWYGSDXTtMySS/PAgusiSy50lJCv74ryUDK2Awv7Ysvqz27Z1e7WvVX2jzZnHMgz4VUNqU5QNmLIjvLecHsqS65wpW5NgUD/DWLyJaGs8yDChklcdyJCiYUHfS9bGIGfb0EKRSfGGKXRcHMesSlXqW0RTeCB7HIwQmiQb9kC/7I4Vs5MfgXba1kouDKCq2I4fOUDlu9j17fK3wXfGVffBMXyVTrJ/dzl6U0ps6y4uT5sZTC+yLr3Sfo8hOfw5hLmdJRQgmbgfjFJ4hI6VQD6MJzRMbAAGVzo39z5f1zyVEZeZVeG00F1Zq1YMl5al6t/AQCgdDQZepnFTbdZsXF9vJ7k4Brvz2Y7imzfKzlD5FBntIuJRmfs6WEB7265VXKz529mZbWP8kq6LZjSmZLi3QqMDIohApv9lxt1QtA0gRIKkCyB2h1GgDtCtDe99AEOKsAZ3uAdtIAOK8A5/uAswZApwJ09ik1ebioABfHBt2tAN1jAe8rwPt9St2mjYs3Oxf7Cgpb7uvlkgEb9I1eEeP1XV3skretFOygmdPw1Ri6JqVCudZ+BIOrAg3CYKwLLOf1u34E6MbJolmFHAVk0oD8ui55DWp8GHWPpw0pc63qsJeHsT/41ArgRBuC55uQNRauDlsYZpnh1tYArw8DP2vgdbCbw7CxVoBHA1GsqIv39ji00bIOfXccuinZH4+D12Q6wuLbnGShGjN8fmdS4BsPSEtmeqnAtez+0vZgTHrDsxiL3OZ6dWl0ealXyp37XnCnyiXc40bhcAmDB4VXxmizFaImkziXRpKpJ69TGixl+CpA4nJV1htpSh/4z6UwPHPdVE9plPRGx1KKj6ME2CIplcICJsKN4aVkrUH6CQX21Zvhm6SHj04/2i71o7+5NXG9TnrX/zJ9vtx3yZsYzB6TJ2SqVSbU4gRH4BrnO5AcQ9Fm/fZ1N2nHH5qTe5P0bv7tfu8abcf7C94gZps24Ia4Q9NRbSUf8FpScgYEcqfii4UgXaY0SoIm7goptNmasM3h3Sa92/8RnjsJduHx08UpmdyfkCsLAu8Q2pwQ3Cqki7NDoV3jZ8dec4Y72z0zC4GdKvF2g+5PL3DMmjA6wg9ejDyPcM0Jkwavjtw4BVyfa6yR6sd52V5GB38AUEsDBBQAAAAIAHWOPF2Ss2CtYAMAAGIIAAAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDIueG1sjVZtb+M2DP4rhAccNqCN27R52V0S4NrbcPdhW3HFdp8Vm7aFypIn0XXz70fKsZvDpcY+JLEs8hGfh6SYTef8U6gQCV5qY8M2qYia92kasgprFWauQcs7hfO1Il76Mg2NR5VHp9qk86urZVorbZPdJr578LuNa8loiw8eQlvXyh/u0Lhum1wnw4uvuqxIXqS7TaNKfET6u3nwvEpHlFzXaIN2FjwW2+Tj9fu7tdhHg380duHkGYTJ3rknWXzJt8mVBIQGMxIExT/PeI/GCBCH8e8RMxmPFMfT5wH998iduexVwHtnvumcqm2yTiDHQrWGvrruMx75LAQvcybEb+h62/kygawN5OqjM0dQa9v/qpejDicOv87fcJgfHeYx7v6gGOUnRWq38a4DL9aMJg+R6ja5SYCD01aS8kiedzX70e7eaLQUQNeN8wSEdWMU4SYlBheTNOMPg47INyPyTUS+fQP5W6UINL37aT2/Xn0IwAX0PWoEuetBFm+AfMxzbUvIXN0oqzEAOaAKQTUNaAvOIpRuBp/U4ZLcZa4OF6DyHJTNAXNNYluL4eCjArShVWY2QfB2JHg7SfAvPlxcGvQcoCUusHMEb6cJHrkdOO9UcZwecUALUCJ/9e/4pHABqLJqsMTR1aqaDbBBzlw+g/vj6xxJaRNYJcM2iLmot0deR+9C+0CCOyXGYhRjMSnGby860HepOqfFYlKLLwWokZMOoIxcM4eT/HF2eWuURw9EDHKlQe4w2GO90ehdqWf29SiF0UugaQZ/OqokXDSBd/Z8XQlCVilbYpgSZDkKspwUZDiAebhn9J3XRGjPibKcFiU2piDFNDKJMGRY+uFHjeDnIOUgNXEBmWo0Ka4B6YimtRm1Kt6GurTOY/5LVCY86abBvm0MFiRtwmgH2ZzSYjVqsZrU4lEVKMJ7vPTtWQ1W/0ODSDByiwlXJY8cUAVx+6n+mpAegVgA8w+9XOJieTTwRRFei2CK03rktJ7k9ODxWYZO7KJzlNbTlF7zdXAtBO5w5DI5CIcL6OTu7LQx0q593UpuuPj7oiLZl45mUlJWMaV75CsWX4248gLX/nm26cnIkOn7h/KltiGmnyfnbMWB+36i9QtyTZxBe0c8k+JjxZWHXgx4v3COhoUMpvFvxe4/UEsDBBQAAAAIAHWOPF1MQE8smwMAALsNAAAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDMueG1spZfbUtswEIZfReOrttNixzlBJ8k0CRBgSpshPVwr9ibRIEuupBDo03dlm0AzspxOuQBL3m+12v0tVoOdVPd6A2DIY8aFHgYbY/KPYaiTDWRUn8gcBL5ZSZVRg0O1DnWugKYFlPEwjqJemFEmgtGgmJur0cDQ5VRyqYhaL4dBFE2KnyAcDeTWcCZgrojeZhlVTxPgcjcMWsHzxB1bb4ydQOucrmEB5ns+VzgK9/5TloHQTAqiYDUMxq2PNx1rXxj8YLDTr56J3eNSyns7uE4xnsB6FkAeFzlnxVrk6eXRyPwzrMwUOB8GkzggNDHsAeZIDIOlNEZmRYwYsaEG51ZK/gZRrA8c0BjjygtrdFWaOt6VnuxK9W+rdcoAyoDGNlO/qm0H+6zYvb1+fk7AZVE4TPeSasCa/GSp2QyD04CksKJbbu7k7gqqlHetv0RyXfwmu9K2HQUk2WoMp4IxgoyJ8i99rEr1CojrgLgC4gOg1asB2hXQPlyhDuhUQOcAaMc1QLcCuodApwboVUDvMKS6FfoV0D9206cVcHoscFYBZ4chndYVLnquXFQoqCx5oZdzauhooOSOqMLe6uIleXul4BeUWItCjeVXMwyYsJ/2wih8y9ChGU1lhnJ+ejcIDS5j58KkIiclGdeQ355ycFBTP3WL5xDJN1K42HM/+xOWmhkgeGrhyce4w8OF38M4TRVo7QAv/eAXacCFzfzYVAqDRwMRNHPt9+o4Wknuoq+Po+uSfXMc7sh0iOLbKzDeCy0u/PVq/C3wfwczZLJlPAXlyuXE72AGAhTlJMHAFEYmlUt9fh9vOlHnLel2ux+iVhS5FOjndbGJZbWHk0RmLg36feDCZA402RgFQBbmPRkbTjHZ78ls7FKm391cwa8t5WzFICVxFPdcKvW7uKXqnlxRp8iuGla/dQnzH4rQcinTz2cbDPVTUyn+Eml7L9L2/4q0zsGLBBstzhstLhotLhstZv6tfmaakjlW3lV0P3qhDcOWxfkBXvvRv2ofu2rv53mOEf9b7Tv72ne8rieKipTMFfbTyjDnaT/xe/i6wxPKdSj5sTf9fvSck7Mz16FUx7/opdHistFi5o/ym8zIHUDqkoufPIcHvEHkeB8w2NMIvDA4hdMY4I1/GXucpp+Wtoo5FrFOFeGrJspeXvDwWzOhCcc2Hy8eJ33sN1XZQ5UDvCEU7VPZ75ctF96uQFkDfL+S2BtUA9uq7e9roz9QSwMEFAAAAAgAdY48XVgaebKNAQAAeQMAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0NC54bWx9k1FP4zAMx79KlA9AxmADobYSBzruHhAT6LjnrHXXiDQJjkvZtz+nsGgP1z1UsR3nl79rpxg9vsUOgMRnb10sZUcUbpSKdQe9jmc+gOOd1mOviV3cqRgQdDMd6q1aLhZr1WvjZFVMsQ1WhR/IGgcbFHHoe437H2D9WMpzeQg8m11HKaCqIugdvAD9CRtkT2VKY3pw0XgnENpS3p7f3K5T/pTwamCMR7ZIlWy9f0vO76aUiyQILNSUCJqXD7gDaxOIZbx/M2W+Mh08tg/0n1PtXMtWR7jz9q9pqCvltRQNtHqw9OzHX/BdzyoLvNekqwL9KDDVWRV1MtLdnGdc+j8vhBw3fBFVNe0DFIpYQQqomj8+nAnLTFjOEB7AAWorau8IuV6PJ3AXGXcxg7uHD25agFOUy0y5nKE8je4kYZUJqxnC4+BMbYK2hvZCiTBsralPENeZuJ7TRN3/NamjxqWhfNS4My4KCy2DFmdXrBG/Gv3lkA/TUG89ke8ns+O3AZgSeL/1ng5OmrP82qp/UEsDBBQAAAAIAHWOPF3CY90w9gIAACQPAAANAAAAeGwvc3R5bGVzLnhtbN1XbW/aMBD+K1F+wAIJpGQCJJoJadI2VWo/7KshTrDk2JnjdGG/fr44EKC+rqzdNC0Ixb7H99ybz4Z5rfec3u8o1V5bclEv/J3W1fsgqLc7WpL6nayoMEguVUm0maoiqCtFSVaDUsmDcDSKg5Iw4S/noinXpa69rWyEXvgjP1jOcykGSexbgVlKSuo9Er7wU8LZRrFuLSkZ31txCIKt5FJ52rhCF/4YJPUPC4/tDLzseUompAJhYC1c2lkpRjjgm55hMKCKjfF2tO6eMyujVxGGk+hDmJ4RxtcSXufKdasZ5vi0e1DC7lUbYsb5sbYT3wqW84poTZVYm0mn0wmfQF4/fthXpriFIvtxOPVfrFBLzjIwWaTulAcnqq8knaxubqcxStq9TDo2UmVUHRMy9g+i5ZzTXBt1xYodvLWsoMxSa1maQcZIIQXpsnXQ6AeGdks5v4c+/Zqfcbe5ZxvuYwa95kFRDkPjUD+0NHYC/KdslvuE9ua3aL2KPUp925hoRDf/1khN7xTNWdvN2/xoH2MfD+zhBTupKr5fcVaIktrYX2xwOScHPe+RKs22sJe3ZkqV731XpHqgre47IGjzF/kX/Yv+hX+0OhHO/ubRm974ZbSTv+zPVaWYvkkpgr41T/r/rPuPUg8O9oX/BW5oPlB4m4ZxzUQ/27Eso+LJIWDoNdmYnwBn/GZ9RnPScP1wBBf+MP5MM9aUyXHVHYTVrxrGn+Cwsxded7kYW0xktKVZ2k/N8Xp2ztoHFC6R4Wp+imA6FnMjgGF2MA8wHauF2fmf4pmh8VgM823mRGaozgzVsVouJO0+mB23TmIed6RJEkVxjGU0TZ0epFje4hi+bjbMN9DA7ICl63KNVxvfIc/vA6ymz+0QLFJ8J2KR4rkGxJ030EgSd7UxO6CBVQHbO2DfbQf2lFsniqCqmG9YB+NIkmAI7EX3Ho1jJDsxfNz1wbokipLEjQDm9iCKMAS6EUcwD8AHDImi7h68uI+Cwz0VDP+Llz8BUEsDBBQAAAAIAHWOPF2XirscwAAAABMCAAALAAAAX3JlbHMvLnJlbHOdkrluwzAMQH/F0J4wB9AhiDNl8RYE+QFWog/YEgWKRZ2/r9qlcZALGXk9PBLcHmlA7TiktoupGP0QUmla1bgBSLYlj2nOkUKu1CweNYfSQETbY0OwWiw+QC4ZZre9ZBanc6RXiFzXnaU92y9PQW+ArzpMcUJpSEszDvDN0n8y9/MMNUXlSiOVWxp40+X+duBJ0aEiWBaaRcnToh2lfx3H9pDT6a9jIrR6W+j5cWhUCo7cYyWMcWK0/jWCyQ/sfgBQSwMEFAAAAAgAdY48XelwUi9qAQAAzQMAAA8AAAB4bC93b3JrYm9vay54bWy1k9tOwzAMhl+lygPQMcYkJrobxmESAgSI+6xxV2s5VI7LgKfHTVUoQkLc7Crxb8v5fMj5PtBuE8Iue3PWx0LVzM0iz2NZg9PxKDTgxVMFcprFpG0eGwJtYg3AzubTyWSeO41eLc+HXA+Uj43AUDIGL2InvCDs47e/M7NXjLhBi/xeqHS3oDKHHh1+gCnURGWxDvubQPgRPGv7VFKwtlDHveMFiLH8JT91kM96E5PCevOoBaRQ84kkrJAip4iUXwvjK0hwb7UcrtAy0EozXFNoG/TbLo1UkY/KSH0Yzr6JC/pPG0NVYQmrULYOPPd9JLAdoI81NlFlXjso1IVFCYhdRfLE2vTVsWCNekULFAetTQI8HMzaR6Y2jXNMNP2DaHpYoss37ZruwS+Ykz9gTg4Lc4vxx6RmXyg1GgN+RDJLmzSsj4EKPZg7yRJFl1UuHyjrjjTw6ez0+ExWtrX2QrR7fxu0GbZx+EnLT1BLAwQUAAAACAB1jjxdAWXF7sAAAACrAwAAGgAAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzxZM5DsIwEEWvYvkADCSBAhEqmrQoF7DMZBHxIs8gkttjoAiWKGhQKuuP5fdfMT6ccVDcO0td70mMZrBUyo7Z7wFId2gUrZxHG28aF4ziGEMLXumrahGy9XoH4ZMhj4dPpqgnj78QXdP0Gk9O3wxa/gKGuwtX6hBZilqFFrmUMA7zmOB1bFaRLEV1KWWoLhsJSwtliVC2vFCeCOXLCxWJUPFHIeJpQJpt3jmp3/6xnuNbnNtf8T1Mt3b3dIDkbx4fUEsDBBQAAAAIAHWOPF2OsKfWJwEAAGcFAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbM2Uz07DMAzGX6XqdWoyBuKA1l2AK+zAC4TWXaPmn2JvdG+P226TQKNiKhK7NGpsfz/Hn5Ll2z4AJq01DvO0JgoPUmJRg1UofADHkcpHq4h/40YGVTRqA3Ixn9/LwjsCRxl1Gulq+QSV2hpKnlveRu1dnkYwmCaPQ2LHylMVgtGFIo7LnSu/UbIDQXBln4O1DjjjhFSeJXSRnwGHutcdxKhLSNYq0ouynCVbI5H2BlCMS5zp0VeVLqD0xdZyicAQQZVYA5A1YhCdjZOJJwzD92Yyv5cZA3LmOvqA7FiEy3FHS7rqLLAQRNLjRzwRWXry+aBzu4Tyl2we74ePTe8Hyn6ZPuOvHp/0L+xjcSV93F5JH3f/2Me7981fX/1uFVZpd+TL/n1dfQJQSwECFAMUAAAACAB1jjxdRsdNSJUAAADNAAAAEAAAAAAAAAAAAAAAgAEAAAAAZG9jUHJvcHMvYXBwLnhtbFBLAQIUAxQAAAAIAHWOPF3E6dN58AAAACsCAAARAAAAAAAAAAAAAACAAcMAAABkb2NQcm9wcy9jb3JlLnhtbFBLAQIUAxQAAAAIAHWOPF2ZXJwjEAYAAJwnAAATAAAAAAAAAAAAAACAAeIBAAB4bC90aGVtZS90aGVtZTEueG1sUEsBAhQDFAAAAAgAdY48XeFLPmBuAwAAmAoAABgAAAAAAAAAAAAAAICBIwgAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbFBLAQIUAxQAAAAIAHWOPF2Ss2CtYAMAAGIIAAAYAAAAAAAAAAAAAACAgccLAAB4bC93b3Jrc2hlZXRzL3NoZWV0Mi54bWxQSwECFAMUAAAACAB1jjxdTEBPLJsDAAC7DQAAGAAAAAAAAAAAAAAAgIFdDwAAeGwvd29ya3NoZWV0cy9zaGVldDMueG1sUEsBAhQDFAAAAAgAdY48XVgaebKNAQAAeQMAABgAAAAAAAAAAAAAAICBLhMAAHhsL3dvcmtzaGVldHMvc2hlZXQ0LnhtbFBLAQIUAxQAAAAIAHWOPF3CY90w9gIAACQPAAANAAAAAAAAAAAAAACAAfEUAAB4bC9zdHlsZXMueG1sUEsBAhQDFAAAAAgAdY48XZeKuxzAAAAAEwIAAAsAAAAAAAAAAAAAAIABEhgAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgAdY48XelwUi9qAQAAzQMAAA8AAAAAAAAAAAAAAIAB+xgAAHhsL3dvcmtib29rLnhtbFBLAQIUAxQAAAAIAHWOPF0BZcXuwAAAAKsDAAAaAAAAAAAAAAAAAACAAZIaAAB4bC9fcmVscy93b3JrYm9vay54bWwucmVsc1BLAQIUAxQAAAAIAHWOPF2OsKfWJwEAAGcFAAATAAAAAAAAAAAAAACAAYobAABbQ29udGVudF9UeXBlc10ueG1sUEsFBgAAAAAMAAwAEAMAAOIcAAAAAA==',vendors:'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'};
const CLIENT_COLS=[['company','Company*',['company','companyname','client','clientname','gc','generalcontractor','name','owner']],['type','Type',['type','companytype','clienttype']],
  ['phone','Main phone',['mainphone','phone','officephone','companyphone','office']],['email','Website or email',['websiteoremail','website','email','companyemail','web']],['address','Address',['address','officeaddress','location']],['notes','Notes',['notes','comments']],
  ['contact_name','Contact name',['contactname','contact','pm','projectmanager','person']],['contact_title','Contact role',['contactrole','role','title','contacttitle','position']],['contact_phone','Contact phone',['contactphone','cell','mobile','directphone','cellphone']],['contact_email','Contact email',['contactemail']]];
const VENDOR_COLS=[['company','Company*',['company','companyname','vendor','vendorname','name','supplier','subcontractor','sub']],['vendor_type','Vendor type',['vendortype','type']],['trade','Trade',['trade','category']],
  ['scopes','Scopes',['scopes','scope','scopesquoted']],['contact_name','Contact name',['contactname','contact','rep','salesrep']],['phone','Phone',['phone','contactphone','mobile','cell','office']],['email','Email',['email','contactemail']],
  ['area','Area served',['areaserved','area','region','territory','serviceArea'.toLowerCase()]],['preferred','Preferred',['preferred','preferredyesno']],['notes','Notes',['notes','comments']]];
function xClientType(v){const t=normH(v);if(!t)return '';if(['gc','generalcontractor','contractor','builder'].includes(t))return 'General contractor';if(['municipality','public','city','county','state','municipal','municipalitypublic','government'].includes(t))return 'Municipality / public';return xFromList(v,CLIENT_TYPES)}
function xVendorType(v){const t=normH(v);if(!t)return '';if(['sub','subcontractor','subs'].includes(t))return 'Subcontractor';if(['supplier','supply','materials','vendor'].includes(t))return 'Supplier';if(['both','suppliersub','supplierandsub','supplierandsubcontractor'].includes(t))return 'Supplier & sub';if(['service','testing','servicetesting','consultant'].includes(t))return 'Service / testing';if(['trucking','hauling','trucker'].includes(t))return 'Trucking';return xFromList(v,VENDOR_TYPES)}
async function readDirFile(file,type){
  const X=await loadXLSX();const wb=X.read(await file.arrayBuffer(),{type:'array'});
  const cols=type==='clients'?CLIENT_COLS:VENDOR_COLS;const want=type==='clients'?/client|gc|compan/i:/vendor|sub|supplier/i;
  const names=wb.SheetNames.filter(n=>!/instruction|^lists?$|example|scope list/i.test(n));
  const order=[...names.filter(n=>want.test(n)),...names.filter(n=>!want.test(n))];
  let t=null;for(const n of order){t=findTable(X,wb.Sheets[n],cols);if(t)break}
  if(!t)throw new Error('Couldn’t find a “Company” column. Use the import template, or make sure the first row has column headings.');
  const get=(row,k)=>t.map[k]==null?'':String(row[t.map[k]]??'').trim();
  const groups=new Map();const items=[];
  t.rows.forEach((row,ri)=>{if(row.every(c=>String(c).trim()===''))return;const rowNo=t.headerRow+ri+1;const company=get(row,'company');
    if(!company){items.push({rows:[rowNo],f:{company:''},issues:[],errors:['Missing company name'],action:'error'});return}
    const k=normH(company);if(!groups.has(k)){const g={rows:[],company,raw:[]};groups.set(k,g);items.push(g)}const g=groups.get(k);g.rows.push(rowNo);g.raw.push(row)});
  const libNames=new Map(lib().scopes.map(x=>[normH(x.name),x.name]));
  const out=items.map(g=>{
    if(g.errors)return g;
    const issues=[];const first=k=>{for(const r of g.raw){const v=get(r,k);if(v)return v}return ''};
    const f={company:g.company};
    if(type==='clients'){
      const ty=first('type');const tv=xClientType(ty);if(tv===null){issues.push(`Type “${ty}” set to Other`);f.type='Other'}else f.type=tv||'General contractor';
      ['phone','email','address','notes'].forEach(k=>f[k]=first(k));
      const seenC=new Set();f.contacts=[];g.raw.forEach(r=>{const c={name:get(r,'contact_name'),title:get(r,'contact_title'),phone:get(r,'contact_phone'),email:get(r,'contact_email')};
        if(!c.name&&!c.email&&!c.phone)return;const ck=normH(c.name||c.email);if(seenC.has(ck))return;seenC.add(ck);f.contacts.push(c)});
      const ex=S.clients.find(c=>normH(c.company)===normH(g.company));
      if(ex){const have=new Set((ex.contacts||[]).map(c=>normH(c.name||c.email)));const add=f.contacts.filter(c=>!have.has(normH(c.name||c.email)));
        return {...g,f,issues,existing:ex,newContacts:add,action:add.length?'contacts':'duplicate'}}
    }else{
      const vt=first('vendor_type');const vv=xVendorType(vt);if(vv===null){issues.push(`Vendor type “${vt}” not recognized, left blank`);f.vendor_type=''}else f.vendor_type=vv;
      const tr=first('trade');const tv=xFromList(tr,TRADES);if(tv===null){issues.push(`Trade “${tr}” set to Other`);f.trade='Other';f.notes=(f.notes?f.notes+'\n':'')+'Trade: '+tr}else f.trade=tv||'Other';
      const sc=new Map();g.raw.forEach(r=>xList(get(r,'scopes')).forEach(n=>{const c=libNames.get(normH(n));if(!c)issues.push(`Scope “${n}” isn’t on your Scopes page — added as written`);sc.set(normH(c||n),c||n)}));f.scopes=[...sc.values()];
      ['contact_name','phone','email','area'].forEach(k=>f[k]=first(k));f.notes=[f.notes,first('notes')].filter(Boolean).join('\n');
      const pr=normH(first('preferred'));f.preferred=['yes','y','true','x','1','preferred'].includes(pr);
      const ex=S.vendors.find(v=>normH(v.company)===normH(g.company));if(ex)return {...g,f,issues,existing:ex,action:'duplicate'};
    }
    if(g.rows.length>1&&type==='vendors')issues.push(`Combined ${g.rows.length} rows for this company`);
    return {...g,f,issues,action:'new'};
  });
  return {type,fileName:file.name,items:out,ignored:t.ignored};
}
async function runDirImport(){
  const P=M.plan;M.running=true;renderModal();const res={created:0,contacts:0,skipped:0,failed:[]};
  const table=P.type==='clients'?'clients':'vendors';const cols=ENT_COLS[table];
  const rows=P.items.filter(x=>x.action==='new').map(x=>{const r={id:newId()};cols.forEach(k=>{if(k!=='id'&&x.f[k]!==undefined)r[k]=x.f[k]});return r});
  res.skipped=P.items.filter(x=>x.action==='duplicate'||x.action==='error').length;
  try{
    for(let i=0;i<rows.length;i+=100){const chunk=rows.slice(i,i+100);try{await run(sb.from(table).insert(chunk));res.created+=chunk.length}
      catch(e){for(const r of chunk){try{await run(sb.from(table).insert(r));res.created++}catch(e2){res.failed.push(`${r.company}: ${errMsg(e2)}`)}}}}
    for(const x of P.items.filter(x=>x.action==='contacts')){
      try{await run(sb.from('clients').update({contacts:[...(x.existing.contacts||[]),...x.newContacts]}).eq('id',x.existing.id));res.contacts+=x.newContacts.length}
      catch(e){res.failed.push(`${x.f.company}: ${errMsg(e)}`)}}
    await loadTable(table);
  }catch(e){res.failed.push(errMsg(e))}
  M.running=false;M.result=res;M.plan=null;renderModal();
}
function dirImportModal(){
  const type=M.type,noun=type==='clients'?'clients & GCs':'vendors',Noun=type==='clients'?'Clients & GCs':'Vendors';
  const foot=(l,r)=>`<div class="mfoot"><div>${l||''}</div><div class="r">${r}</div></div>`;
  if(M.result){const r=M.result;return mhead('Import finished',M.fileName||'')+`<div class="mbody"><div class="statline"><div><b>${r.created}</b>Companies added</div>${type==='clients'?`<div><b>${r.contacts}</b>Contacts added</div>`:''}<div><b>${r.skipped}</b>Skipped</div><div><b>${r.failed.length}</b>Problems</div></div>
    <p class="hint">Nothing already in the app was changed${type==='clients'?', other than adding new contacts to existing companies':''}.</p>
    ${r.failed.length?`<fieldset><legend>Problems</legend><div class="list">${r.failed.map(x=>`<div class="li small">${esc(x)}</div>`).join('')}</div></fieldset>`:''}</div>`+foot('','<button class="btn primary" data-act="close">Done</button>')}
  if(!M.plan)return mhead(`Import ${noun} from Excel`,'Add companies to your list in one go')+`<div class="mbody">
    <div class="notice">This only <b>adds</b> companies that aren’t in the app yet — nothing already here is changed or removed${type==='clients'?' (new contacts for an existing company are added to it)':''}. You can still add and edit ${noun} one at a time as usual.</div>
    <fieldset><legend>1. Download the template</legend><p style="margin:0 0 10px">${type==='clients'?'One row per contact — repeat the company name on another row for each extra contact. Only <b>Company</b> is required.':'One row per vendor. List the <b>scopes</b> each one quotes, separated by semicolons, so they’re suggested in the vendor picker on bids. Only <b>Company</b> is required.'}</p>
      <div class="adders" style="margin:0"><button class="btn primary" data-act="dl-template">Download ${noun} template (.xlsx)</button></div>
      <p class="hint">Already have a list? It can import that too if the first row has headings like “Company”, “Contact”, “Phone”, “Email”. Excel (.xlsx, .xls) and CSV files work.</p></fieldset>
    <fieldset><legend>2. Choose your file</legend><label class="drop${M.reading?' busy':''}"><input type="file" accept=".xlsx,.xls,.csv" data-importfile>${M.reading?'Reading file…':'<b>Click to choose a file</b><span class="dim small">or drag it here</span>'}</label>
      ${M.error?`<div class="err" style="margin-top:10px">${esc(M.error)}</div>`:''}<p class="hint">Nothing is saved until you review the preview.</p></fieldset></div>`+foot('','<button class="btn" data-act="close">Cancel</button>');
  const P=M.plan,it=P.items;const cnt=a=>it.filter(x=>x.action===a).length;
  const label={new:['Add','good'],contacts:['Add contacts','info'],duplicate:['Already in app','na'],error:['Error','bad']};
  const n=cnt('new')+cnt('contacts');
  const body=it.map(x=>{const f=x.f;return `<tr><td class="num dim small">${x.rows.join(', ')}</td><td class="proj">${esc(f.company||'—')}</td>
    ${type==='clients'?`<td class="small">${esc(f.type||'')}</td><td class="small">${(x.action==='contacts'?x.newContacts:f.contacts||[]).map(c=>esc(c.name||c.email)+(c.title?` <span class="dim">(${esc(c.title)})</span>`:'')).join('<br>')||'<span class="dim">—</span>'}</td><td class="small">${esc(f.phone||'')}</td>`
     :`<td class="small">${esc(f.vendor_type||'—')}<br><span class="dim">${esc(f.trade||'')}</span></td><td class="small" style="max-width:260px">${(f.scopes||[]).map(esc).join(', ')||'<span class="dim">—</span>'}</td><td class="small">${esc(f.contact_name||'')}${f.phone?'<br>'+esc(f.phone):''}</td><td class="small">${f.preferred?pill('Preferred','hot'):''}</td>`}
    <td style="white-space:nowrap">${pill(label[x.action][0],label[x.action][1])}</td><td class="small" style="min-width:200px">${[...(x.errors||[]).map(e=>`<b style="color:var(--bad)">${esc(e)}</b>`),...(x.action==='duplicate'?['Already in the app — left as it is']:[]),...(x.action==='contacts'?[`Already in the app — ${x.newContacts.length} new contact${x.newContacts.length===1?'':'s'} will be added`]:[]),...x.issues.map(esc)].join('<br>')||'<span class="dim">—</span>'}</td></tr>`}).join('');
  return mhead('Review import',P.fileName)+`<div class="mbody">
    <div class="statline"><div><b>${it.length}</b>Companies in file</div><div><b>${cnt('new')}</b>New</div>${type==='clients'?`<div><b>${cnt('contacts')}</b>Get new contacts</div>`:''}<div><b>${cnt('duplicate')}</b>Already in app</div><div><b>${cnt('error')}</b>Errors</div></div>
    ${P.ignored.length?`<p class="hint" style="margin:0 0 10px">Columns not imported: ${P.ignored.map(esc).join(', ')}</p>`:''}
    <div class="panel scroll"><table><thead><tr><th>Row</th><th>Company</th>${type==='clients'?'<th>Type</th><th>Contacts</th><th>Phone</th>':'<th>Type & trade</th><th>Scopes</th><th>Contact</th><th></th>'}<th>Result</th><th>Notes</th></tr></thead><tbody>${body}</tbody></table></div></div>`
    +foot('<button class="btn" data-act="imp-restart">Choose a different file</button>',`<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="imp-run"${n&&!M.running?'':' disabled'}>${M.running?'Adding…':type==='clients'&&cnt('contacts')?`Add ${cnt('new')} compan${cnt('new')===1?'y':'ies'} + contacts`:`Add ${cnt('new')} compan${cnt('new')===1?'y':'ies'}`}</button>`);
}

async function exportXlsx(){
  let X;try{X=await loadXLSX()}catch(e){toast(errMsg(e));return}
  const serial=s=>{if(!s)return '';const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return {t:'n',v:(Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/864e5,z:'m/d/yyyy'}};
  const list=S.bids.slice().sort((a,b)=>(b.due_date||'').localeCompare(a.due_date||''));
  const rows=list.map(b=>{const v={name:b.name,location:b.location,project_type:b.project_type,bid_type:b.bid_type,status:b.status,due_date:serial(b.due_date),due_time:b.due_time?String(b.due_time).slice(0,5):'',walk_date:serial(b.walk_date),rfi_date:serial(b.rfi_date),
    lead:estName(b.lead_estimator_id),support:(b.support_estimator_ids||[]).map(estName).filter(Boolean).join('; '),clients:(b.client_ids||[]).map(clientName).join('; '),amount_with:num(b.amount_with)??'',amount_without:num(b.amount_without)??'',use_for:b.use_for==='without'?'Without':'With',probability:b.probability??'',proposal_status:b.proposal_status,
    submitted_date:serial(b.submitted_date),awarded_by:b.awarded_client_id?clientName(b.awarded_client_id):'',awarded_date:serial(b.awarded_date),awarded_amount:num(b.awarded_amount)??'',lost_reason:b.lost_reason,awarded_to:b.awarded_to,last_contact:serial(lastTouch(b)),scopes:scopeItems(b).map(x=>x.name).join('; '),notes:b.notes};
    return IMPORT_COLS.map(([k])=>v[k]??'')});
  const toSheet=(head,data,widths)=>{const ws=X.utils.aoa_to_sheet([head]);data.forEach((r,ri)=>r.forEach((c,ci)=>{const ref=X.utils.encode_cell({r:ri+1,c:ci});ws[ref]=typeof c==='object'&&c?c:(c===''?{t:'s',v:''}:{t:typeof c==='number'?'n':'s',v:c})}));
    ws['!ref']=X.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(1,data.length),c:head.length-1}});ws['!cols']=widths.map(w=>({wch:w}));return ws};
  const wb=X.utils.book_new();
  X.utils.book_append_sheet(wb,toSheet(IMPORT_COLS.map(c=>c[1]),rows,IMPORT_COLS.map(([k])=>['name','clients','notes','scopes'].includes(k)?30:['location','support','awarded_to','awarded_by'].includes(k)?22:15)),'Bids');
  const gc=[];list.forEach(b=>{if((b.client_ids||[]).length<2&&!Object.keys(b.client_proposals||{}).length)return;(b.client_ids||[]).forEach(id=>{const p=propOf(b,id);gc.push([b.name,clientName(id),num(p.amount_with)??'',num(p.amount_without)??'',serial(p.sent_date),clientWon(b,id)?'Awarded':p.status||''])})});
  X.utils.book_append_sheet(wb,toSheet(GCP_COLS.map(c=>c[1]),gc,[30,28,16,16,13,12]),'GC proposals');
  X.writeFile(wb,`bid-pipeline-${todayStr()}.xlsx`);
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t||t.tagName==='SELECT')return;const a=t.dataset.act;
  if(a==='backdrop'){if(e.target===t&&!(M&&(M.picker||M.running||M.plan)))closeModal();return}
  switch(a){
    case 'auth-view':S.authView=t.dataset.v;S.authMsg=null;render();break;
    case 'signout':sb.auth.signOut();break;
    case 'recheck':S.profileFor=null;S.profile=null;render();afterLogin();break;
    case 'nav':S.view=t.dataset.v;closeModal();render();window.scrollTo(0,0);break;
    case 'dash':S.dash=t.dataset.v;render();break;
    case 'kpi-filter':S.view='pipeline';S.filter=t.dataset.v;render();break;
    case 'filter':S.filter=t.dataset.v;render();break;
    case 'export':exportCsv();break;
    case 'export-xlsx':exportXlsx();break;
    case 'import':if(isAdmin()){M={kind:'import',type:t.dataset.type||'bids'};showModal();loadXLSX().catch(()=>{})}break;
    case 'imp-restart':M={kind:'import',type:M.type};renderModal();break;
    case 'dl-template':downloadTemplate(M&&M.type);break;
    case 'imp-run':if(M.plan&&!M.running)(M.type&&M.type!=='bids'?runDirImport():runImport());break;
    case 'refresh':Promise.all(TABLES.map(loadTable)).then(()=>toast('Up to date'));break;
    case 'reload-team':loadProfiles();loadTable('estimators');break;
    case 'make-est':makeEstimatorFor(t.dataset.id);break;
    case 'dl':download(t.dataset.path,t.dataset.name);break;
    case 'new-bid':if(isAdmin()){M={kind:'bid',draft:newBid(),origQuoteIds:[]};showModal()}break;
    case 'open-bid':openBid(t.dataset.id);break;
    case 'new-est':M={kind:'est',isNew:true,draft:{id:newId(),name:'',title:'',email:'',phone:'',active:true}};showModal();break;
    case 'open-est':M={kind:'est',draft:clone(byId(S.estimators,t.dataset.id))};showModal();break;
    case 'new-client':M={kind:'client',isNew:true,draft:{id:newId(),company:'',type:'General contractor',phone:'',email:'',address:'',notes:'',contacts:[{name:'',title:'',phone:'',email:''}]}};showModal();break;
    case 'open-client':M={kind:'client',draft:clone(byId(S.clients,t.dataset.id))};showModal();break;
    case 'new-vendor':M={kind:'vendor',isNew:true,draft:{id:newId(),company:'',vendor_type:S.q.vtype||'',scopes:S.q.vscope?[S.q.vscope]:[],trade:S.q.trade||TRADES[0],contact_name:'',phone:'',email:'',area:'',preferred:false,notes:''}};showModal();break;
    case 'open-vendor':{const vd=clone(byId(S.vendors,t.dataset.id));vd.scopes=vendorScopes(vd);vd.vendor_type=vd.vendor_type||'';M={kind:'vendor',draft:vd};showModal();break}
    case 'board-custom':M={kind:'board',draft:boardCfg()};showModal();break;
    case 'company':M={kind:'company',draft:{companyName:S.settings.general?.companyName||''}};showModal();break;
    case 'close':closeModal();break;
    case 'save':saveModal();break;
    case 'del':deleteModal();break;
    case 'rm-support':M.draft.support_estimator_ids=M.draft.support_estimator_ids.filter(x=>x!==t.dataset.id);renderModal();break;
    case 'rm-client':{const id=t.dataset.id;M.draft.client_ids=M.draft.client_ids.filter(x=>x!==id);delete M.draft.client_contacts[id];delete M.draft.client_proposals[id];if(M.draft.awarded_client_id===id)M.draft.awarded_client_id='';renderModal();break}
    case 'award':awardClient(t.dataset.id);break;
    case 'pick-open':pickerStart();break;
    case 'add-ad':{const l=M.draft.addenda;const n=l.reduce((m,a)=>Math.max(m,+a.number||0),0)+1;l.push({id:newId(),number:n,date:todayStr(),description:'',priced:false,acknowledged:false});renderModal();setTimeout(()=>{const x=document.querySelectorAll('[data-ad$=".description"]');x[x.length-1]?.focus()},0);break}
    case 'rm-ad':M.draft.addenda.splice(+t.dataset.i,1);renderModal();break;
    case 'ad-clear':{const a=M.draft.addenda[+t.dataset.i];a.file_path=null;a.file_name=null;renderModal();break}
    case 'add-rev':addRevision(M.draft,'',false);renderModal();setTimeout(()=>{const x=document.querySelectorAll('[data-rv$=".reason"]');x[x.length-1]?.focus()},0);break;
    case 'rm-rev':M.draft.revisions.splice(+t.dataset.i,1);renderModal();break;
    case 'pick-cancel':M.picker=null;renderModal();break;
    case 'pick-next':M.picker.step++;M.picker.q='';renderModal();$('#modal .mbody').scrollTop=0;break;
    case 'pick-back':M.picker.step--;M.picker.q='';renderModal();$('#modal .mbody').scrollTop=0;break;
    case 'pick-go':M.picker.step=+t.dataset.i;M.picker.q='';renderModal();$('#modal .mbody').scrollTop=0;break;
    case 'pick-all':M.picker.all=!M.picker.all;renderModal();break;
    case 'pick-finish':pickerFinish();break;
    case 'unaward':unaward();break;
    case 'rm-quote':M.draft.quotes.splice(+t.dataset.i,1);renderModal();break;
    case 'clear-file':{const q=M.draft.quotes[+t.dataset.i];q.file_path=null;q.file_name=null;renderModal();break}
    case 'rm-file':removeFile(t.dataset.id);break;
    case 'add-fu':M.draft.follow_ups.push({date:todayStr(),note:''});renderModal();setTimeout(()=>{const n=document.querySelectorAll('[data-ff$=".note"]');n[n.length-1]?.focus()},0);break;
    case 'rm-fu':M.draft.follow_ups.splice(+t.dataset.i,1);renderModal();break;
    case 'add-contact':(M.draft.contacts=M.draft.contacts||[]).push({name:'',title:'',phone:'',email:''});renderModal();break;
    case 'rm-contact':M.draft.contacts.splice(+t.dataset.i,1);renderModal();break;
    case 'rm-scope':M.draft.scope_items.splice(+t.dataset.i,1);M.signing=null;renderModal();break;
    case 'add-custom-scope':{const v=$('#custom-scope')?.value;if(addScope(v,'Other'))renderModal();else if(v)toast('That scope is already on this bid.');break}
    case 'sign-start':M.signing=+t.dataset.i;renderModal();setTimeout(()=>{const n=$('#sign-init');if(n){n.focus();n.select()}},0);break;
    case 'sign-cancel':M.signing=null;renderModal();break;
    case 'sign-confirm':signScope(+t.dataset.i);break;
    case 'unsign':unsignScope(+t.dataset.i);break;
    case 'edit-lib':M={kind:'lib',draft:clone(lib().scopes)};showModal();break;
    case 'add-lib':M.draft.push({name:'',group:'Other',perform:'Self perform'});renderModal();setTimeout(()=>{const n=document.querySelectorAll('[data-lf$=".name"]');n[n.length-1]?.focus()},0);break;
    case 'rm-lib':M.draft.splice(+t.dataset.i,1);renderModal();break;
    case 'new-tpl':M={kind:'tpl',isNew:true,draft:{id:'tpl-'+newId().slice(0,8),name:'',scopes:[]}};showModal();break;
    case 'edit-tpl':{const tp=(lib().templates||[]).find(x=>x.id===t.dataset.id);if(tp){M={kind:'tpl',draft:clone(tp)};showModal()}break}
  }
  if(M&&M.arm&&a!=='del'){M.arm=false;renderModal()}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.id==='sign-init'){e.preventDefault();const b=$('[data-act=sign-confirm]');if(b)signScope(+b.dataset.i);return}
  if(e.key==='Enter'&&e.target.id==='custom-scope'){e.preventDefault();$('[data-act=add-custom-scope]')?.click();return}
  if(e.key==='Escape'&&M){if(M.signing!=null){M.signing=null;renderModal();return}if(M.picker){M.picker=null;renderModal();return}closeModal()}
  if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('card')){e.preventDefault();e.target.click()}
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.q){S.q[t.dataset.q]=t.value;render();return}
  if(!M)return;
  const val=t.type==='checkbox'?t.checked:(t.dataset.t==='n'?num(t.value):t.value);
  if(t.dataset.bf){if(t.type==='radio'&&!t.checked)return;const p=t.dataset.bf.split('.');let o=M.draft;while(p.length>1)o=o[p.shift()];o[p[0]]=val;
    if(t.dataset.bf==='probability'){const pv=$('#probv');if(pv)pv.textContent=val+'%'}}
  else if(t.dataset.qf){const[i,k]=t.dataset.qf.split('.');M.draft.quotes[+i][k]=val}
  else if(t.dataset.ff){const[i,k]=t.dataset.ff.split('.');M.draft.follow_ups[+i][k]=val}
  else if(t.dataset.ctf){const[i,k]=t.dataset.ctf.split('.');M.draft.contacts[+i][k]=val}
  else if(t.dataset.cc){M.draft.client_contacts[t.dataset.cc]=val}
  else if(t.dataset.cp){const[id,k]=t.dataset.cp.split('.');const cp=M.draft.client_proposals=M.draft.client_proposals||{};cp[id]=Object.assign({},cp[id],{[k]:val})}
  else if(t.dataset.ef){M.draft[t.dataset.ef]=val}
  else if(t.dataset.wf){M.draft[t.dataset.wf]=t.checked}
  else if(t.dataset.sf){const[i,k]=t.dataset.sf.split('.');M.draft.scope_items[+i][k]=val}
  else if(t.dataset.lf){const[i,k]=t.dataset.lf.split('.');M.draft[+i][k]=val}
  else if(t.dataset.tn!=null){M.draft.name=val}
  else if(t.dataset.ad){const[i,k]=t.dataset.ad.split('.');M.draft.addenda[+i][k]=val}
  else if(t.dataset.rv){const[i,k]=t.dataset.rv.split('.');M.draft.revisions[+i][k]=val}
  else if(t.dataset.pick){const P=M.picker,sc=M.draft.scope_items[P.step].name;P.sel[sc]=(P.sel[sc]||[]).filter(x=>x!==t.dataset.pick);if(t.checked)P.sel[sc].push(t.dataset.pick);
    renderModal()}
  else if(t.dataset.pickq!=null){M.picker.q=val;const pos=t.selectionStart;renderModal();const n=$('#pick-q');if(n){n.focus();n.setSelectionRange(pos,pos)}}
  else if(t.dataset.vs!=null){const n=t.dataset.vs;M.draft.scopes=vendorScopes(M.draft).filter(x=>x.toLowerCase()!==n.toLowerCase());if(t.checked)M.draft.scopes.push(n);const lg=$('#vs-count');if(lg)lg.textContent='Scopes they quote ('+M.draft.scopes.length+')'}
  else if(t.dataset.tc!=null){const n=t.dataset.tc;M.draft.scopes=M.draft.scopes.filter(x=>x!==n);if(t.checked)M.draft.scopes.push(n);const lg=$('#tpl-count');if(lg)lg.textContent='Scopes ('+M.draft.scopes.length+')'}
});
document.addEventListener('change',e=>{
  const t=e.target;const a=t.dataset.act;
  if(t.dataset.upload!=null){uploadQuote(+t.dataset.upload,t.files[0]);return}
  if(t.dataset.importfile!=null){const file=t.files[0];if(!file)return;M.reading=true;M.error=null;M.fileName=file.name;renderModal();
    (M.type&&M.type!=='bids'?readDirFile(file,M.type):readImportFile(file)).then(pl=>{M.plan=pl;M.reading=false;renderModal()}).catch(e=>{M.reading=false;M.error=errMsg(e);renderModal()});return}
  if(M&&t.dataset.imp){const k=t.dataset.imp;M.plan[k]=t.type==='checkbox'?t.checked:t.value;renderModal();return}
  if(M&&t.dataset.incl){M.plan.include[t.dataset.incl]=t.checked;renderModal();return}
  if(t.dataset.adupload!=null){uploadAddendum(+t.dataset.adupload,t.files[0]);return}
  if(M&&t.dataset.ad&&/priced|acknowledged|date/.test(t.dataset.ad)){renderModal();return}
  if(t.dataset.docupload!=null){if(t.files.length)uploadDocs([...t.files]);return}
  if(t.dataset.prole){setRole(t.dataset.prole,t.value);return}
  if(t.dataset.plink!=null){linkEstimator(t.dataset.plink,t.value);return}
  if(t.dataset.pname){setProfileName(t.dataset.pname,t.value.trim());return}
  if(M&&t.dataset.bf){if(t.dataset.bf==='status'||t.dataset.bf==='lead_estimator_id')renderModal();return}
  if(M&&t.dataset.sf&&t.dataset.sf.endsWith('.perform')){renderModal();return}
  if(M&&t.dataset.cp&&t.dataset.cp.endsWith('.status')){const id=t.dataset.cp.split('.')[0];const p=M.draft.client_proposals[id];if(p.status==='Sent'&&!p.sent_date)p.sent_date=todayStr();renderModal();return}
  if(M&&t.dataset.cp&&/amount/.test(t.dataset.cp)){renderModal();return}
  if(M&&t.dataset.qf&&t.dataset.qf.endsWith('.status')){const q=M.draft.quotes[+t.dataset.qf.split('.')[0]];
    if(q.status==='Requested'&&!q.requested_date)q.requested_date=todayStr();if(q.status==='Received'&&!q.received_date)q.received_date=todayStr();renderModal();return}
  if(!a)return;
  switch(a){
    case 'year':S.year=+t.value;render();break;
    case 'estF':S.estF=t.value;render();break;
    case 'clientF':S.clientF=t.value;render();break;
    case 'tradeF':S.q.trade=t.value;render();break;
    case 'vscopeF':S.q.vscope=t.value;render();break;
    case 'vtypeF':S.q.vtype=t.value;render();break;
    case 'add-support':if(t.value){M.draft.support_estimator_ids.push(t.value);renderModal()}break;
    case 'add-client':if(t.value){M.draft.client_ids.push(t.value);const first=byId(S.clients,t.value)?.contacts?.[0]?.name;if(first)M.draft.client_contacts[t.value]=first;renderModal()}break;
    case 'add-quote':if(t.value){addQuote(t.value);renderModal()}break;
    case 'apply-template':if(t.value){const tp=(lib().templates||[]).find(x=>x.id===t.value);const n=tp?tp.scopes.filter(x=>addScope(x)).length:0;toast(n?`Added ${n} scope${n===1?'':'s'} from ${tp.name}`:'Those scopes are already on this bid');renderModal()}break;
    case 'add-scope':if(t.value){addScope(t.value);renderModal()}break;
    case 'award-sel':if(t.value)awardClient(t.value);else{M.draft.awarded_client_id='';renderModal()}break;
    case 'add-trade':if(t.value){const n=S.vendors.filter(v=>v.trade===t.value).map(v=>addQuote(v.id)).filter(Boolean).length;toast(n?`Added ${n} ${t.value.toLowerCase()} vendor${n===1?'':'s'}`:'Those vendors are already on this bid');renderModal()}break;
  }
});

/* ---------- start ---------- */
// Checks that config.js points at a real Supabase project with a valid key
async function checkConfig(){
  try{
    const r=await fetch(CFG.supabaseUrl.replace(/\/+$/,'')+'/auth/v1/settings',{headers:{apikey:CFG.supabaseAnonKey}});
    if(r.status===401||r.status===403)S.authMsg={err:'Setup problem: Supabase rejected the key in config.js. Copy the anon / public key again from Project Settings → API Keys (not the secret / service_role key).'};
    else if(!r.ok)S.authMsg={err:'Setup problem: the Supabase URL in config.js returned an error ('+r.status+'). Check it matches your Project URL exactly.'};
    else{const j=await r.json().catch(()=>({}));if(j.external&&j.external.email===false)S.authMsg={err:'Setup problem: email sign-in is turned off in Supabase. Turn Email back on under Authentication → Sign In / Providers.'}}
  }catch(e){S.authMsg={err:'Setup problem: can’t reach the Supabase URL in config.js. It should look like https://abcdefgh.supabase.co'}}
  render();
}
async function start(){
  render();
  if(!sb){S.loading=false;render();return}
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY')S.needPassword=true;
    S.session=session;
    if(!session){resetData();S.loading=false;closeModal();render();return}
    // run outside the callback (Supabase recommends not awaiting inside it)
    setTimeout(()=>afterLogin(),0);
  });
  checkConfig();
  const {data:{session}}=await sb.auth.getSession();
  S.session=session;
  if(session)await afterLogin();
  S.loading=false;render();
}
start();

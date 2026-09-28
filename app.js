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
const QUOTE_SCOPES=['Earthwork','Underground','Erosion control','Site demo','Paving & curb','Materials','Trucking','Testing','Other'];
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
const BID_COLS=['id','name','location','project_type','bid_type','size','status','probability','due_date','due_time','walk_date','rfi_date','lead_estimator_id','support_estimator_ids','client_ids','client_contacts','scopes','proposal_status','amount_with','amount_without','use_for','margin','follow_ups','notes','submitted_date','awarded_date','awarded_amount','awarded_to','lost_reason'];
const Q_COLS=['id','bid_id','vendor_id','scope','status','requested_date','due_date','received_date','amount','note','file_path','file_name'];
const ENT_COLS={estimators:['id','name','title','email','phone','active'],clients:['id','company','type','phone','email','address','notes','contacts'],vendors:['id','company','trade','contact_name','phone','email','area','preferred','notes']};

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
const bidValue=b=>{const w=num(b.amount_with),o=num(b.amount_without);return b.use_for==='without'?(o??w??0):(w??o??0)};
const wonValue=b=>num(b.awarded_amount)??bidValue(b);
const yearOf=b=>+(String(b.due_date||b.submitted_date||'').slice(0,4))||new Date(b.created_at||Date.now()).getFullYear();
const lastTouch=b=>(b.follow_ups||[]).map(f=>f.date).filter(Boolean).sort().pop()||b.submitted_date||'';
const needsFollowUp=b=>b.status==='Submitted'&&(!lastTouch(b)||daysUntil(lastTouch(b))<=-7);
const quotesFor=id=>S.quotes.filter(q=>q.bid_id===id);
const filesFor=id=>S.bid_files.filter(f=>f.bid_id===id).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
const openQuotes=b=>quotesFor(b.id).filter(q=>q.status==='Requested');
function toast(msg){const t=$('#toast');t.innerHTML=`<div class="toast">${esc(msg)}</div>`;clearTimeout(toast._t);toast._t=setTimeout(()=>t.innerHTML='',3800)}


/* ---------- pipeline progress (derived automatically from the bid) ---------- */
const STAGES=['Received','Takeoff','Quotes','Proposal','Submitted','Decision'];
const STAGE_NAMES=['Bid received','Scope takeoff','Vendor quotes','Proposal','Submitted to GC','Decision'];
function stageInfo(b,qs){
  qs=qs||quotesFor(b.id);
  const sc=SCOPES.map(([k])=>b.scopes?.[k]||'Not Started').filter(x=>x!=='N/A');
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
    `${sc.filter(x=>x==='Complete').length} of ${sc.length} scopes complete`,
    qs.length?`${qs.length-qOpen} of ${qs.length} quotes in`:'No quotes requested yet',
    'Proposal '+String(b.proposal_status||'Not Started').toLowerCase(),
    'Waiting on GC decision',
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
  const views={dashboard:vDashboard,pipeline:vPipeline,estimators:vEstimators,clients:vClients,vendors:vVendors,team:vTeam};
  if(!navItems().some(n=>n[0]===S.view))S.view='dashboard';
  main.innerHTML=views[S.view]();
  if(fid){const n=document.getElementById(fid);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}}
}
function navItems(){
  if(isAdmin())return [['dashboard','Dashboard'],['pipeline','Pipeline'],['estimators','Estimators'],['clients','Clients & GCs'],['vendors','Vendors'],['team','Team & logins']];
  if(role()==='estimator')return [['dashboard','My dashboard'],['pipeline','My bids'],['vendors','Vendors'],['clients','Clients & GCs']];
  return [['dashboard','Board dashboard'],['pipeline','Pipeline']];
}
function renderTop(){
  const company=S.settings.general?.companyName||CFG.companyName||'Bid Pipeline';
  $('#top').innerHTML=`<button class="brand" ${isAdmin()?'data-act="company" title="Edit company name"':'tabindex="-1" style="cursor:default"'}><span class="stake"></span><span><b>${esc(company)}</b><small>Bid pipeline</small></span></button>
  <nav class="nav">${navItems().map(([k,l])=>`<button class="${S.view===k?'on':''}" data-act="nav" data-v="${k}">${l}</button>`).join('')}</nav>
  <div class="userbox"><span>${esc(myName())}<br><span class="rolepill">${ROLE_LABEL[role()]}</span></span>
  ${isAdmin()?'<button class="btn primary" data-act="new-bid">+ New bid</button>':''}<button class="btn sm" data-act="signout">Sign out</button></div>`;
}

/* ---------- auth screens ---------- */
function brandBlock(){return `<div class="auth-brand"><span class="stake"></span><div><b>${esc(CFG.companyName||'Bid Pipeline')}</b><small>Bid pipeline</small></div></div>`}
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
  return `<div class="head"><div><h1>${S.dash==='precon'?'Precon dashboard':'Board dashboard'}</h1><p>${d}</p></div>
  <div class="tools">${S.dash==='board'?yearSelect()+'<button class="btn" data-act="board-custom">Customize view</button>':''}
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
function scopeBar(b){return `<span class="scopebar" title="${esc(SCOPES.map(([k,l])=>l+': '+(b.scopes?.[k]||'Not Started')).join('\n'))}">${SCOPES.map(([k])=>`<i class="${SCOPE_CLS[b.scopes?.[k]||'Not Started']}"></i>`).join('')}</span>`}
function bidTable(list,opts={}){
  const rows=list.map(b=>{const qs=quotesFor(b.id);const rec=qs.filter(q=>q.status==='Received').length;const me=myEst();
    return `<tr class="click" data-act="open-bid" data-id="${b.id}">
    <td><div class="proj">${esc(b.name)}</div><div class="dim small">${esc(b.location||b.project_type||'')}</div></td>
    <td>${(b.client_ids||[]).map(id=>esc(clientName(id))).join('<br>')||'<span class="dim">—</span>'}</td>
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
  const kpis=`<div class="kpis">
    ${kpi('Active bids',act.length,est.length+' estimating, '+sub.length+' submitted','','active')}
    ${kpi('Due in 7 days',due7.length,past.length?past.length+' past due':'Nothing past due',due7.length||past.length?'hot':'','estimating')}
    ${kpi('Awaiting decision',sub.length,'Submitted to GC','','submitted')}
    ${kpi('Follow-ups needed',fu.length,'No contact in 7+ days',fu.length?'bad':'')}
    ${kpi('Quotes outstanding',oq.length,'Requested, not received',oq.length?'hot':'')}
    ${kpi('Active bid value',moneyK(val),money(val),'good')}</div>`;
  if(!S.bids.length)return kpis+setupGuide();
  const fuList=fu.map(b=>`<div class="li"><div><button class="linkish" data-act="open-bid" data-id="${b.id}">${esc(b.name)}</button><div class="dim small">${(b.client_ids||[]).map(clientName).map(esc).join(', ')||'No client'}</div></div><div class="small">${lastTouch(b)?'Last '+fmtShort(lastTouch(b)):'Never contacted'}</div></div>`).join('');
  const load=S.estimators.filter(e=>e.active!==false).map(e=>({e,n:est.filter(b=>b.lead_estimator_id===e.id||(b.support_estimator_ids||[]).includes(e.id)).length,soon:due7.filter(b=>b.lead_estimator_id===e.id).length}));
  const maxL=Math.max(1,...load.map(x=>x.n));
  const loadHtml=load.length?`<div class="hbars">${load.sort((a,b)=>b.n-a.n).map(x=>`<div class="hb"><span class="lab who">${avatar(x.e.id,22)}${esc(x.e.name)}</span><div class="track"><div class="fill ${x.soon?'acc':''}" style="width:${x.n/maxL*100}%"></div></div><span class="v">${x.n} bid${x.n===1?'':'s'}${x.soon?` · ${x.soon} due soon`:''}</span></div>`).join('')}</div>`:`<div class="empty"><b>No estimators yet</b><button class="btn sm" data-act="nav" data-v="estimators">Add estimators</button></div>`;
  return kpis+`<div class="sec"><div class="sec-h"><h2>Active bids</h2><span>Sorted by due date. Scope bar: ${SCOPES.map(s=>s[1]).join(', ')}.</span></div>${bidTable(act)}</div>
  <div class="grid3">
    <div class="sec"><div class="sec-h"><h2>Estimator workload</h2><span>Bids in estimating</span></div><div class="panel pad">${loadHtml}</div></div>
    <div class="sec"><div class="sec-h"><h2>Quotes outstanding</h2><span>${oq.length}</span></div><div class="panel pad">${quoteList(oq,'All requested quotes are in.')}</div></div>
    <div class="sec"><div class="sec-h"><h2>Follow-ups needed</h2><span>${fu.length}</span></div><div class="panel pad"><div class="list">${fuList||'<div class="empty">Every submitted bid has a recent follow-up.</div>'}</div></div></div></div>`;
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
    const g={};yb.forEach(b=>(b.client_ids||[]).forEach(id=>{g[id]=g[id]||{n:0,v:0,w:0,d:0};g[id].n++;g[id].v+=bidValue(b);if(b.status==='Awarded'){g[id].w++;g[id].d++}if(b.status==='Lost')g[id].d++}));
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
  return `<div class="head"><div><h1>${est?'My bids':'Pipeline'}</h1><p>${pool.length} bid${pool.length===1?'':'s'}${est?' assigned to you':' on file'}</p></div><div class="tools">${est?'':'<button class="btn" data-act="export">Export CSV</button>'}${isAdmin()?'<button class="btn primary" data-act="new-bid">+ New bid</button>':''}</div></div>
  <div class="bar">${FILTERS.map(([k,l,fn])=>`<button class="chip ${S.filter===k?'on':''}" data-act="filter" data-v="${k}">${l}<b>${base.filter(fn).length}</b></button>`).join('')}</div>
  <div class="bar"><input id="q-pipe" class="field search" placeholder="Search projects, locations, GCs" value="${esc(S.q.pipe||'')}" data-q="pipe">
   ${est?'':`<select class="field" data-act="estF"><option value="">All estimators</option>${S.estimators.map(e=>`<option value="${e.id}"${S.estF===e.id?' selected':''}>${esc(e.name)}</option>`).join('')}</select>`}
   <select class="field" data-act="clientF"><option value="">All clients & GCs</option>${S.clients.slice().sort((a,b)=>a.company.localeCompare(b.company)).map(c=>`<option value="${c.id}"${S.clientF===c.id?' selected':''}>${esc(c.company)}</option>`).join('')}</select></div>
  ${list.length?`<div class="cards">${list.map(card).join('')}</div>`:`<div class="panel"><div class="empty"><b>No bids match</b>${pool.length?'Try a different filter or search.':est?'Bids assigned to you will appear here.':'Create your first bid to fill the pipeline.'}</div></div>`}`;
}
function card(b){
  const qs=quotesFor(b.id);const rec=qs.filter(q=>q.status==='Received').length;const v=bidValue(b);const nf=filesFor(b.id).length;
  const team=[b.lead_estimator_id,...(b.support_estimator_ids||[])].filter(id=>byId(S.estimators,id));
  return `<div class="card" role="button" tabindex="0" data-act="open-bid" data-id="${b.id}">
   <div class="card-top"><div><h3>${esc(b.name)}</h3><div class="meta">${(b.client_ids||[]).map(clientName).map(esc).join(', ')||'No client assigned'}</div></div>${pill(b.status,BID_CLS[b.status])}</div>
   ${progress(b)}
   <div class="row">${dueCell(b)}<div style="text-align:right">${v?`<div class="val">${money(v)}</div><div class="dim small">${b.use_for==='without'?'Without':'With'} site improvements</div>`:`<div class="dim small">Proposal ${esc((b.proposal_status||'Not Started').toLowerCase())}</div>`}</div></div>
   <div class="scopes">${SCOPES.map(([k,l])=>{const s=b.scopes?.[k]||'Not Started';return s==='N/A'?'':`<span class="pill ${SCOPE_CLS[s]}" title="${l}: ${s}">${l}${s==='Complete'?' ✓':''}</span>`}).join('')}</div>
   <div class="foot"><span class="who" style="gap:3px">${team.map(id=>avatar(id,24)).join('')||'<span class="dim small">No estimator</span>'}</span>
   <span class="dim small" style="margin-left:auto">${qs.length?`Quotes ${rec}/${qs.length} in`:'No vendor quotes'}${nf?` · ${nf} file${nf===1?'':'s'}`:''}</span></div></div>`;
}

/* ----- directories ----- */
function dbHead(title,sub,act,label){return `<div class="head"><div><h1>${title}</h1><p>${sub}</p></div><div class="tools">${isAdmin()?`<button class="btn primary" data-act="${act}">${label}</button>`:''}</div></div>`}
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
  return dbHead('Clients & GCs',S.clients.length+' companies','new-client','+ Add client or GC')+`<div class="bar"><input id="q-cl" class="field search" data-q="cl" placeholder="Search companies or contacts" value="${esc(S.q.cl||'')}"></div>
  <div class="panel scroll"><table><thead><tr><th>Company</th><th>Type</th><th>Contacts</th>${showStats?'<th class="r">Bids</th><th class="r">$ bid</th><th class="r">Won</th><th class="r">Win rate</th>':'<th>Phone</th>'}</tr></thead><tbody>
  ${list.map(c=>{const bs=S.bids.filter(b=>(b.client_ids||[]).includes(c.id));const w=bs.filter(b=>b.status==='Awarded').length,l=bs.filter(b=>b.status==='Lost').length;
   return `<tr class="click" data-act="open-client" data-id="${c.id}"><td class="proj">${esc(c.company)}</td><td>${esc(c.type)}</td><td class="small">${(c.contacts||[]).map(x=>esc(x.name)).filter(Boolean).join(', ')||'<span class="dim">—</span>'}</td>${showStats?`<td class="r num">${bs.length}</td><td class="r num">${moneyK(bs.reduce((s,b)=>s+bidValue(b),0))}</td><td class="r num">${w}</td><td class="r num">${w+l?Math.round(w/(w+l)*100)+'%':'—'}</td>`:`<td class="small">${esc(c.phone)}</td>`}</tr>`}).join('')
  ||`<tr><td colspan="7"><div class="empty"><b>No clients yet</b>${isAdmin()?'Add the GCs, developers and owners you bid to.':''}</div></td></tr>`}</tbody></table></div>`;
}
function vendorStats(id){const qs=S.quotes.filter(q=>q.vendor_id===id).map(q=>({q,b:byId(S.bids,q.bid_id)})).filter(x=>x.b);
  const asked=qs.filter(x=>x.q.status!=='Not requested');const rec=qs.filter(x=>x.q.status==='Received');
  return{qs,asked:asked.length,rec:rec.length,open:qs.filter(x=>x.q.status==='Requested').length,rate:asked.length?Math.round(rec.length/asked.length*100):null}}
function vVendors(){
  const q=(S.q.ven||'').toLowerCase();const tf=S.q.trade||'';
  const list=S.vendors.filter(v=>(!tf||v.trade===tf)&&(!q||[v.company,v.trade,v.contact_name,v.area].join(' ').toLowerCase().includes(q))).sort((a,b)=>a.company.localeCompare(b.company));
  return dbHead('Vendors & subs',S.vendors.length+' companies','new-vendor','+ Add vendor')+`<div class="bar"><input id="q-ven" class="field search" data-q="ven" placeholder="Search vendors, contacts, areas" value="${esc(S.q.ven||'')}">
   <select class="field" data-act="tradeF"><option value="">All trades</option>${TRADES.map(t=>`<option${tf===t?' selected':''}>${esc(t)}</option>`).join('')}</select></div>
  <div class="panel scroll"><table><thead><tr><th>Vendor</th><th>Trade</th><th>Contact</th><th class="r">Quotes asked</th><th class="r">Received</th><th class="r">Response rate</th><th class="r">Open now</th></tr></thead><tbody>
  ${list.map(v=>{const s=vendorStats(v.id);return `<tr class="click" data-act="open-vendor" data-id="${v.id}"><td><span class="proj">${esc(v.company)}</span>${v.preferred?' '+pill('Preferred','hot'):''}${v.area?`<div class="dim small">${esc(v.area)}</div>`:''}</td><td>${esc(v.trade)}</td><td class="small">${esc(v.contact_name)}${v.phone?'<br>'+esc(v.phone):''}${v.email?'<br>'+esc(v.email):''}</td><td class="r num">${s.asked}</td><td class="r num">${s.rec}</td><td class="r num">${s.rate==null?'—':s.rate+'%'}</td><td class="r num">${s.open||'—'}</td></tr>`}).join('')
  ||`<tr><td colspan="7"><div class="empty"><b>No vendors ${tf||q?'match':'yet'}</b>${tf||q?'Try another search.':isAdmin()?'Add suppliers and subs so you can request quotes on bids.':''}</div></td></tr>`}</tbody></table></div>`;
}

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
  <p class="hint">Estimators see only bids they’re assigned to, can request and update vendor quotes, and can upload and download files on those bids. Board members see the board dashboard and pipeline, read-only. Only admins can create, change or delete bids and directory records.</p>`;
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
  const html={bid:bidModal,est:estModal,client:clientModal,vendor:vendorModal,board:boardModal,company:companyModal}[M.kind]();
  $('#modal').innerHTML=`<div class="modal-wrap" data-act="backdrop"><div class="modal${first?' enter':''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const nb=$('#modal .mbody');if(nb)nb.scrollTop=st;
}
function mhead(t,s){return `<div class="mhead"><div><h2>${esc(t)}</h2>${s?`<p>${esc(s)}</p>`:''}</div><button class="x" data-act="close" aria-label="Close">×</button></div>`}
const DIS=()=>isAdmin()?'':' disabled';

/* ----- bid editor ----- */
function newBid(){return{id:newId(),name:'',location:'',project_type:'Commercial',bid_type:'Hard bid',size:'',status:'Estimating',probability:50,
  due_date:'',due_time:'',walk_date:'',rfi_date:'',lead_estimator_id:'',support_estimator_ids:[],client_ids:[],client_contacts:{},
  scopes:{earthwork:'Not Started',underground:'Not Started',erosion:'Not Started',demo:'Not Started',paving:'N/A'},
  proposal_status:'Not Started',amount_with:null,amount_without:null,use_for:'with',margin:null,follow_ups:[],notes:'',
  submitted_date:'',awarded_date:'',awarded_amount:null,awarded_to:'',lost_reason:'',quotes:[],_new:true}}
function openBid(id){
  const b=byId(S.bids,id);if(!b)return;
  const d=Object.assign(newBid(),clone(b));d._new=false;
  d.scopes=Object.assign(newBid().scopes,b.scopes||{});d.due_time=d.due_time?String(d.due_time).slice(0,5):'';
  ['due_date','walk_date','rfi_date','submitted_date','awarded_date'].forEach(k=>d[k]=d[k]||'');
  d.lead_estimator_id=d.lead_estimator_id||'';d.quotes=clone(quotesFor(id));d.quotes.forEach(q=>{['requested_date','due_date','received_date'].forEach(k=>q[k]=q[k]||'')});
  M={kind:'bid',draft:d,origQuoteIds:d.quotes.map(q=>q.id)};showModal();
}
const getPath=p=>p.split('.').reduce((o,k)=>o?.[k],M.draft);
function bf(path,type){return `data-bf="${path}"${type?` data-t="${type}"`:''} value="${esc(getPath(path)??'')}"${DIS()}`}
function sel(path,list){const v=getPath(path);return `<select class="field" data-bf="${path}"${DIS()}>${list.map(o=>`<option value="${esc(o)}"${o===v?' selected':''}>${esc(o||'—')}</option>`).join('')}</select>`}
function bidModal(){
  const b=M.draft;const admin=isAdmin();const work=canWork(b);const isNew=b._new;
  const ests=S.estimators.filter(e=>e.active!==false||e.id===b.lead_estimator_id||b.support_estimator_ids.includes(e.id));
  const clientsSorted=S.clients.slice().sort((a,c)=>a.company.localeCompare(c.company));
  const vendorsSorted=S.vendors.slice().sort((a,c)=>a.trade.localeCompare(c.trade)||a.company.localeCompare(c.company));
  const tradesWithVendors=TRADES.filter(t=>S.vendors.some(v=>v.trade===t));
  const outcome=['Submitted','Awarded','Lost','No Bid'].includes(b.status);
  const sub=isNew?'Project details, team, scope, vendor quotes and files':admin?'Last saved '+(b.updated_at?new Date(b.updated_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—'):work?'You can request and update vendor quotes and upload files. Other details are managed by your precon manager.':'Read-only';
  const files=isNew?[]:filesFor(b.id);
  return mhead(isNew?'New bid':b.name||'Untitled bid',sub)+`<div class="mbody">
  ${isNew?'':`<div class="panel pad" style="margin-bottom:14px">${progress(b,{lg:true,quotes:b.quotes})}</div>`}
  <fieldset><legend>Project</legend><div class="fg">
    <label class="f s2">Project name ${admin?'<span class="req">required</span>':''}<input class="field" ${bf('name')} placeholder="e.g. Riverside Commerce Park"></label>
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
    <label class="f s2">Lead estimator<select class="field" data-bf="lead_estimator_id"${DIS()}><option value="">Unassigned</option>${ests.map(e=>`<option value="${e.id}"${b.lead_estimator_id===e.id?' selected':''}>${esc(e.name)}${e.title?' — '+esc(e.title):''}</option>`).join('')}</select></label>
    <div class="f s2" style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500;color:var(--ink-2)">Supporting estimators
      <div class="tagrow">${b.support_estimator_ids.map(id=>`<span class="tag">${avatar(id,20)} ${esc(estName(id)||'Removed')}${admin?`<button class="rm" data-act="rm-support" data-id="${id}" aria-label="Remove">×</button>`:'&nbsp;'}</span>`).join('')||(admin?'':'<span class="dim">None</span>')}
      ${admin?`<select class="field" data-act="add-support" style="width:auto"><option value="">+ Add</option>${ests.filter(e=>e.id!==b.lead_estimator_id&&!b.support_estimator_ids.includes(e.id)).map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>`:''}</div></div>
  </div>${admin&&!S.estimators.length?'<p class="hint">No estimators on file yet. Add them in the Estimators tab.</p>':''}</fieldset>

  <fieldset><legend>Bidding to</legend><div class="rows">
    ${b.client_ids.map(id=>{const c=byId(S.clients,id);const cs=c?.contacts||[];const ct=cs.find(x=>x.name===b.client_contacts?.[id]);return `<div class="rowline client"><div><b style="font-weight:600">${esc(clientName(id))}</b><div class="dim small">${esc(c?.type||'')}${ct?.phone?' · '+esc(ct.phone):''}${ct?.email?' · '+esc(ct.email):''}</div></div>
      <select class="field" data-cc="${id}"${DIS()}><option value="">Contact…</option>${cs.map(x=>`<option${b.client_contacts?.[id]===x.name?' selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${admin?`<button class="rm" data-act="rm-client" data-id="${id}" aria-label="Remove">×</button>`:'<span></span>'}</div>`}).join('')||'<div class="dim small">No GCs or clients added.</div>'}
  </div>${admin?`<div class="adders"><select class="field" data-act="add-client"><option value="">+ Add a GC or client…</option>${clientsSorted.filter(c=>!b.client_ids.includes(c.id)).map(c=>`<option value="${c.id}">${esc(c.company)}</option>`).join('')}</select></div>
  <p class="hint">${S.clients.length?'Site work often goes to several GCs on the same project — add each one.':'No clients on file yet. Add them in the Clients & GCs tab.'}</p>`:''}</fieldset>

  <fieldset><legend>Scope takeoff</legend><div class="fg" style="grid-template-columns:repeat(5,minmax(0,1fr))">
    ${SCOPES.map(([k,l])=>`<label class="f">${l}${sel('scopes.'+k,SCOPE_ST)}</label>`).join('')}</div></fieldset>

  <fieldset><legend>Proposal</legend><div class="fg">
    <label class="f">Proposal status${sel('proposal_status',PROPOSAL_ST)}</label>
    <label class="f">With site improvements<input type="number" step="0.01" min="0" class="field" ${bf('amount_with','n')} placeholder="$0.00"></label>
    <label class="f">Without site improvements<input type="number" step="0.01" min="0" class="field" ${bf('amount_without','n')} placeholder="$0.00"></label>
    <label class="f">Estimated margin %<input type="number" step="0.1" class="field" ${bf('margin','n')} placeholder="e.g. 12"></label>
    <div class="s2"><div class="small" style="font-weight:500;color:var(--ink-2);margin-bottom:6px">Use for dashboard totals</div><div class="radio">
      <label><input type="radio" name="usefor" data-bf="use_for" value="with"${b.use_for!=='without'?' checked':''}${DIS()}> With site improvements</label>
      <label><input type="radio" name="usefor" data-bf="use_for" value="without"${b.use_for==='without'?' checked':''}${DIS()}> Without</label></div></div>
    <label class="f s2">Win probability: <b id="probv">${b.probability??50}%</b><input type="range" min="0" max="100" step="5" data-bf="probability" data-t="n" value="${b.probability??50}"${DIS()}></label>
  </div></fieldset>

  <fieldset><legend>Vendor & sub quotes</legend>
    ${b.quotes.length?`<div class="qhead"><span>Vendor</span><span>Scope</span><span>Status</span><span>Need by</span><span>Amount</span><span>Quote file</span><span></span></div>`:''}
    <div class="rows">${b.quotes.map((q,i)=>quoteRow(q,i,work,admin)).join('')||'<div class="dim small">No quote requests yet.</div>'}</div>
    ${work?`<div class="adders"><select class="field" data-act="add-quote"><option value="">+ Request a quote from…</option>${vendorsSorted.map(v=>`<option value="${v.id}">${esc(v.company)} (${esc(v.trade)})</option>`).join('')}</select>
    ${tradesWithVendors.length?`<select class="field" data-act="add-trade"><option value="">+ Add every vendor in a trade…</option>${tradesWithVendors.map(t=>`<option>${esc(t)}</option>`).join('')}</select>`:''}</div>
    <p class="hint">Upload the quote when it comes in (PDF, Excel, image — any file). Status switches to Received automatically. Save to keep quote changes.</p>`:''}
  </fieldset>

  <fieldset><legend>Project files</legend>
    ${isNew?'<p class="hint" style="margin:0">Create the bid first, then attach plans, specs, addenda and other files.</p>':`
    <div class="list filelist">${files.map(f=>`<div class="li"><div><button class="linkish" data-act="dl" data-path="${esc(f.file_path)}" data-name="${esc(f.file_name)}">${esc(f.file_name)}</button><div class="dim small">${esc(f.category)}${f.size_bytes?' · '+fmtSize(f.size_bytes):''} · ${esc(f.uploaded_by_name||'Someone')} · ${fmtShort(String(f.created_at).slice(0,10))}</div></div>
      <div style="display:flex;gap:4px"><button class="btn sm" data-act="dl" data-path="${esc(f.file_path)}" data-name="${esc(f.file_name)}">Download</button>${admin||f.uploaded_by===S.session.user.id?`<button class="rm" data-act="rm-file" data-id="${f.id}" title="Delete file">×</button>`:''}</div></div>`).join('')||'<div class="dim small">No files yet.</div>'}</div>
    ${work?`<div class="adders" style="align-items:center"><select class="field" id="file-cat" style="min-width:160px">${FILE_CATS.map(c=>`<option>${c}</option>`).join('')}</select>
      <label class="btn sm" style="cursor:pointer">Upload files<input type="file" multiple data-docupload style="display:none"></label>${M.uploading?'<span class="dim small">Uploading…</span>':''}</div>`:''}`}
  </fieldset>

  <fieldset><legend>GC follow-up log</legend><div class="rows">
    ${b.follow_ups.map((f,i)=>`<div class="rowline fu"><input type="date" class="field" data-ff="${i}.date" value="${esc(f.date||'')}"${DIS()}><input type="text" class="field" data-ff="${i}.note" value="${esc(f.note||'')}" placeholder="e.g. Called PM, decision expected next week"${DIS()}>${admin?`<button class="rm" data-act="rm-fu" data-i="${i}" aria-label="Remove">×</button>`:'<span></span>'}</div>`).join('')||'<div class="dim small">No follow-ups logged.</div>'}
  </div>${admin?'<div class="adders"><button class="btn sm" data-act="add-fu">+ Log a follow-up</button></div>':''}</fieldset>

  ${outcome?`<fieldset><legend>Outcome</legend><div class="fg">
    <label class="f">Submitted on<input type="date" class="field" ${bf('submitted_date')}></label>
    ${b.status==='Awarded'?`<label class="f">Awarded on<input type="date" class="field" ${bf('awarded_date')}></label>
    <label class="f s2">Contract amount<input type="number" step="0.01" class="field" ${bf('awarded_amount','n')} placeholder="Defaults to bid value"></label>`:''}
    ${b.status==='Lost'?`<label class="f">Lost reason${sel('lost_reason',LOST_REASONS)}</label><label class="f s2">Awarded to / low number<input class="field" ${bf('awarded_to')} placeholder="Who got it, and at what price"></label>`:''}
  </div></fieldset>`:''}

  <fieldset><legend>Notes</legend><textarea class="field" data-bf="notes" placeholder="Scope clarifications, bid strategy, site conditions…"${DIS()}>${esc(b.notes||'')}</textarea></fieldset>
  </div>
  <div class="mfoot"><div>${admin&&!isNew?`<button class="btn danger ${M.arm?'arm':''}" data-act="del">${M.arm?'Click again to delete':'Delete bid'}</button>`:''}</div>
  <div class="r"><button class="btn" data-act="close">${admin||work?'Cancel':'Close'}</button>${admin?`<button class="btn primary" data-act="save">${isNew?'Create bid':'Save changes'}</button>`:work?'<button class="btn primary" data-act="save">Save quotes</button>':''}</div></div>`;
}
function quoteRow(q,i,work,admin){
  const v=vendorOf(q.vendor_id);const d=work?'':' disabled';
  const file=q._uploading?'<span class="dim small">Uploading…</span>'
    :q.file_path?`<span class="file"><button class="linkbtn" style="font-size:13px;font-weight:600;text-align:left;word-break:break-all" data-act="dl" data-path="${esc(q.file_path)}" data-name="${esc(q.file_name||'quote')}">${esc(q.file_name||'Download quote')}</button>${work?` <button class="rm" data-act="clear-file" data-i="${i}" title="Detach file">×</button>`:''}</span>`
    :work?`<span class="file"><label>Upload quote<input type="file" data-upload="${i}"></label></span>`:'<span class="dim small">No file</span>';
  return `<div class="quote"><div class="vn">${esc(v?.company||'Removed vendor')}<small>${esc(v?.trade||'')}${v?.phone?' · '+esc(v.phone):''}${q.requested_date?' · asked '+fmtShort(q.requested_date):''}${q.received_date?' · in '+fmtShort(q.received_date):''}</small></div>
   <select class="field" data-qf="${i}.scope"${d}>${QUOTE_SCOPES.map(s=>`<option${q.scope===s?' selected':''}>${s}</option>`).join('')}</select>
   <select class="field" data-qf="${i}.status"${d}>${QUOTE_ST.map(s=>`<option${q.status===s?' selected':''}>${s}</option>`).join('')}</select>
   <input type="date" class="field" data-qf="${i}.due_date" value="${esc(q.due_date||'')}" title="Need quote by"${d}>
   <input type="number" step="0.01" class="field" data-qf="${i}.amount" data-t="n" value="${esc(q.amount??'')}" placeholder="$"${d}>
   <div>${file}<input class="field" style="margin-top:4px" data-qf="${i}.note" value="${esc(q.note||'')}" placeholder="Note"${d}></div>
   ${admin||(work&&!M.origQuoteIds?.includes(q.id))?`<button class="rm" data-act="rm-quote" data-i="${i}" aria-label="Remove">×</button>`:'<span></span>'}</div>`;
}
function defaultScopeForTrade(t){return({'Pipe & utility supply':'Underground','Precast structures':'Underground','Utility sub':'Underground','Erosion control':'Erosion control','Landscaping & grassing':'Erosion control','Demolition':'Site demo','Clearing & grubbing':'Site demo','Asphalt paving':'Paving & curb','Concrete & curb':'Paving & curb','Trucking & hauling':'Trucking','Stone & aggregate':'Materials','Testing & inspection':'Testing','Grading sub':'Earthwork','Dewatering':'Earthwork'})[t]||'Other'}
function addQuote(vid){const v=vendorOf(vid);if(!v||M.draft.quotes.some(q=>q.vendor_id===vid))return false;
  M.draft.quotes.push({id:newId(),bid_id:M.draft.id,vendor_id:vid,scope:defaultScopeForTrade(v.trade),status:'Requested',requested_date:todayStr(),due_date:'',received_date:'',amount:null,note:'',file_path:null,file_name:null});return true}

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
  const bs=S.bids.filter(b=>(b.client_ids||[]).includes(c.id));const w=bs.filter(b=>b.status==='Awarded'),l=bs.filter(b=>b.status==='Lost');
  return mhead(isNew?'New client or GC':c.company||'Client','')+`<div class="mbody">
   ${isNew||role()==='estimator'?'':`<div class="statline"><div><b>${bs.length}</b>Bids</div><div><b>${moneyK(bs.reduce((s,b)=>s+bidValue(b),0))}</b>Total bid</div><div><b>${w.length}</b>Won</div><div><b>${w.length+l.length?Math.round(w.length/(w.length+l.length)*100)+'%':'—'}</b>Win rate</div><div><b>${moneyK(w.reduce((s,b)=>s+wonValue(b),0))}</b>Awarded</div></div>`}
   <fieldset><legend>Company</legend><div class="fg">
   <label class="f s2">Company name ${admin?'<span class="req">required</span>':''}${ef('company','e.g. Summit Builders')}</label><label class="f s2">Type${efSel('type',CLIENT_TYPES)}</label>
   <label class="f s2">Main phone${ef('phone','(000) 000-0000','tel')}</label><label class="f s2">Website or email${ef('email','')}</label>
   <label class="f s4">Address${ef('address','Office address')}</label>
   <label class="f s4">Notes<textarea class="field" data-ef="notes" placeholder="Prequal status, bonding requirements, payment history…"${DIS()}>${esc(c.notes||'')}</textarea></label></div></fieldset>
   <fieldset><legend>Contacts</legend><div class="rows">${(c.contacts||[]).map((x,i)=>`<div class="rowline contact"><input class="field" data-ctf="${i}.name" value="${esc(x.name||'')}" placeholder="Name"${DIS()}><input class="field" data-ctf="${i}.title" value="${esc(x.title||'')}" placeholder="Role, e.g. PM"${DIS()}><input class="field" data-ctf="${i}.phone" value="${esc(x.phone||'')}" placeholder="Phone"${DIS()}><input class="field" data-ctf="${i}.email" value="${esc(x.email||'')}" placeholder="Email"${DIS()}>${admin?`<button class="rm" data-act="rm-contact" data-i="${i}" aria-label="Remove">×</button>`:'<span></span>'}</div>`).join('')||'<div class="dim small">No contacts.</div>'}</div>
   ${admin?'<div class="adders"><button class="btn sm" data-act="add-contact">+ Add contact</button></div>':''}</fieldset>
   ${isNew?'':`<fieldset><legend>Bid history</legend>${bidMiniList(bs,b=>b.client_contacts?.[c.id]?'Contact: '+esc(b.client_contacts[c.id]):'')}</fieldset>`}</div>`+entFoot('Add client',isNew)}
function vendorModal(){const v=M.draft,isNew=M.isNew;const s=vendorStats(v.id);
  return mhead(isNew?'New vendor':v.company||'Vendor',v.trade||'')+`<div class="mbody">
   ${isNew?'':`<div class="statline"><div><b>${s.asked}</b>Quotes asked</div><div><b>${s.rec}</b>Received</div><div><b>${s.rate==null?'—':s.rate+'%'}</b>Response rate</div><div><b>${s.open}</b>Open now</div></div>`}
   <fieldset><legend>Vendor</legend><div class="fg">
   <label class="f s2">Company ${isAdmin()?'<span class="req">required</span>':''}${ef('company','e.g. Metro Pipe Supply')}</label><label class="f s2">Trade${efSel('trade',TRADES)}</label>
   <label class="f s2">Contact name${ef('contact_name','Estimator or rep')}</label><label class="f">Phone${ef('phone','(000) 000-0000','tel')}</label><label class="f">Email${ef('email','quotes@vendor.com','email')}</label>
   <label class="f s2">Area served${ef('area','e.g. Metro Atlanta, north GA')}</label><label class="check s2" style="align-self:end;padding-bottom:10px"><input type="checkbox" data-ef="preferred" ${v.preferred?'checked':''}${DIS()}> Preferred vendor</label>
   <label class="f s4">Notes<textarea class="field" data-ef="notes" placeholder="Pricing terms, lead times, insurance on file…"${DIS()}>${esc(v.notes||'')}</textarea></label></div></fieldset>
   ${isNew?'':`<fieldset><legend>Quote history</legend>${s.qs.length?`<div class="list">${s.qs.sort((a,b)=>(b.q.requested_date||'').localeCompare(a.q.requested_date||'')).map(({b,q})=>`<div class="li"><div><button class="linkish" data-act="open-bid" data-id="${b.id}">${esc(b.name)}</button><div class="dim small">${esc(q.scope||'')}${q.requested_date?' · asked '+fmtShort(q.requested_date):''}${q.file_path?` · <button class="linkbtn" style="font-size:12.5px" data-act="dl" data-path="${esc(q.file_path)}" data-name="${esc(q.file_name||'quote')}">${esc(q.file_name||'Quote file')}</button>`:''}</div></div><div style="text-align:right">${pill(q.status,QUOTE_CLS[q.status])}<div class="num small">${q.amount!=null?money(q.amount):''}</div></div></div>`).join('')}</div>`:'<div class="empty">No quote requests yet.</div>'}</fieldset>`}</div>`+entFoot('Add vendor',isNew)}
function boardModal(){const cfg=M.draft;return mhead('Customize board view','Choose what board members see. Saved for everyone.')+`<div class="mbody"><fieldset><legend>Sections</legend><div class="rows">
  ${WIDGETS.map(([k,l])=>`<label class="check"><input type="checkbox" data-wf="${k}" ${cfg[k]?'checked':''}> ${l}</label>`).join('')}</div></fieldset></div>
  <div class="mfoot"><div></div><div class="r"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="save">Save view</button></div></div>`}
function companyModal(){return mhead('Company','Shown at the top of the app for your whole team.')+`<div class="mbody"><fieldset><legend>Details</legend><div class="fg"><label class="f s4">Company name${ef('companyName','Your company name')}</label></div></fieldset></div>
  <div class="mfoot"><div></div><div class="r"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="save">Save</button></div></div>`}

/* ---------- saving ---------- */
const nullIfEmpty=v=>v===''||v===undefined?null:v;
function quoteRowData(q){const r={};Q_COLS.forEach(k=>r[k]=q[k]);['requested_date','due_date','received_date','file_path','file_name'].forEach(k=>r[k]=nullIfEmpty(r[k]));r.updated_by=S.session.user.id;return r}
async function saveModal(){
  const d=M.draft;const btn=$('#modal [data-act=save]');if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{
    if(M.kind==='bid'){
      if(d.quotes.some(q=>q._uploading)||M.uploading)throw new Error('Wait for the upload to finish.');
      if(isAdmin()){
        if(!d.name.trim())throw new Error('Add a project name before saving.');
        if(['Submitted','Awarded','Lost'].includes(d.status)&&!d.submitted_date)d.submitted_date=todayStr();
        if(d.status==='Awarded'&&!d.awarded_date)d.awarded_date=todayStr();
        if(d.status==='Submitted'&&d.proposal_status!=='Sent')d.proposal_status='Sent';
        const row={};BID_COLS.forEach(k=>row[k]=d[k]);
        ['due_date','due_time','walk_date','rfi_date','submitted_date','awarded_date','lead_estimator_id'].forEach(k=>row[k]=nullIfEmpty(row[k]));
        row.follow_ups=(d.follow_ups||[]).filter(f=>f.date||f.note);row.updated_by=S.session.user.id;
        await run(sb.from('bids').upsert(row));
        const gone=(M.origQuoteIds||[]).filter(id=>!d.quotes.some(q=>q.id===id));
        if(gone.length)await run(sb.from('quotes').delete().in('id',gone));
      }
      if(d.quotes.length)await run(sb.from('quotes').upsert(d.quotes.map(quoteRowData)));
      await Promise.all([loadTable('bids'),loadTable('quotes')]);
      toast(`Saved ${d.name}`);
    }else if(['est','client','vendor'].includes(M.kind)){
      const t={est:'estimators',client:'clients',vendor:'vendors'}[M.kind];
      if(!String(d.name??d.company??'').trim())throw new Error(M.kind==='est'?'Add a name.':'Add a company name.');
      if(M.kind==='client')d.contacts=(d.contacts||[]).filter(c=>c.name||c.email||c.phone);
      const row={};ENT_COLS[t].forEach(k=>row[k]=d[k]);
      await run(sb.from(t).upsert(row));await loadTable(t);toast('Saved');
    }else if(M.kind==='board'){await run(sb.from('settings').upsert({key:'board',value:{widgets:d}}));await loadTable('settings');toast('Board view saved')}
    else if(M.kind==='company'){await run(sb.from('settings').upsert({key:'general',value:{companyName:(d.companyName||'').trim()}}));await loadTable('settings');toast('Company name saved')}
    closeModal();
  }catch(e){toast(errMsg(e));if(btn){btn.disabled=false;btn.textContent='Try again'}}
}
async function deleteModal(){
  if(!M.arm){M.arm=true;renderModal();return}
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
  const cols=['Project','Location','Status','Clients','Lead estimator','Due date','Bid type','Project type','With site impr.','Without site impr.','Dashboard value','Win %','Submitted','Awarded date','Awarded amount','Lost reason','Quotes received','Quotes requested'];
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const rows=S.bids.map(b=>{const qs=quotesFor(b.id);return [b.name,b.location,b.status,(b.client_ids||[]).map(clientName).join('; '),estName(b.lead_estimator_id),b.due_date,b.bid_type,b.project_type,b.amount_with,b.amount_without,bidValue(b),b.probability,b.submitted_date,b.awarded_date,b.awarded_amount,b.lost_reason,qs.filter(x=>x.status==='Received').length,qs.length].map(q).join(',')});
  const blob=new Blob([[cols.map(q).join(','),...rows].join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bid-pipeline-'+todayStr()+'.csv';a.click();
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t||t.tagName==='SELECT')return;const a=t.dataset.act;
  if(a==='backdrop'){if(e.target===t)closeModal();return}
  switch(a){
    case 'auth-view':S.authView=t.dataset.v;S.authMsg=null;render();break;
    case 'signout':sb.auth.signOut();break;
    case 'recheck':S.profileFor=null;S.profile=null;render();afterLogin();break;
    case 'nav':S.view=t.dataset.v;closeModal();render();window.scrollTo(0,0);break;
    case 'dash':S.dash=t.dataset.v;render();break;
    case 'kpi-filter':S.view='pipeline';S.filter=t.dataset.v;render();break;
    case 'filter':S.filter=t.dataset.v;render();break;
    case 'export':exportCsv();break;
    case 'reload-team':loadProfiles();loadTable('estimators');break;
    case 'make-est':makeEstimatorFor(t.dataset.id);break;
    case 'dl':download(t.dataset.path,t.dataset.name);break;
    case 'new-bid':if(isAdmin()){M={kind:'bid',draft:newBid(),origQuoteIds:[]};showModal()}break;
    case 'open-bid':openBid(t.dataset.id);break;
    case 'new-est':M={kind:'est',isNew:true,draft:{id:newId(),name:'',title:'',email:'',phone:'',active:true}};showModal();break;
    case 'open-est':M={kind:'est',draft:clone(byId(S.estimators,t.dataset.id))};showModal();break;
    case 'new-client':M={kind:'client',isNew:true,draft:{id:newId(),company:'',type:'General contractor',phone:'',email:'',address:'',notes:'',contacts:[{name:'',title:'',phone:'',email:''}]}};showModal();break;
    case 'open-client':M={kind:'client',draft:clone(byId(S.clients,t.dataset.id))};showModal();break;
    case 'new-vendor':M={kind:'vendor',isNew:true,draft:{id:newId(),company:'',trade:S.q.trade||TRADES[0],contact_name:'',phone:'',email:'',area:'',preferred:false,notes:''}};showModal();break;
    case 'open-vendor':M={kind:'vendor',draft:clone(byId(S.vendors,t.dataset.id))};showModal();break;
    case 'board-custom':M={kind:'board',draft:boardCfg()};showModal();break;
    case 'company':M={kind:'company',draft:{companyName:S.settings.general?.companyName||''}};showModal();break;
    case 'close':closeModal();break;
    case 'save':saveModal();break;
    case 'del':deleteModal();break;
    case 'rm-support':M.draft.support_estimator_ids=M.draft.support_estimator_ids.filter(x=>x!==t.dataset.id);renderModal();break;
    case 'rm-client':M.draft.client_ids=M.draft.client_ids.filter(x=>x!==t.dataset.id);delete M.draft.client_contacts[t.dataset.id];renderModal();break;
    case 'rm-quote':M.draft.quotes.splice(+t.dataset.i,1);renderModal();break;
    case 'clear-file':{const q=M.draft.quotes[+t.dataset.i];q.file_path=null;q.file_name=null;renderModal();break}
    case 'rm-file':removeFile(t.dataset.id);break;
    case 'add-fu':M.draft.follow_ups.push({date:todayStr(),note:''});renderModal();setTimeout(()=>{const n=document.querySelectorAll('[data-ff$=".note"]');n[n.length-1]?.focus()},0);break;
    case 'rm-fu':M.draft.follow_ups.splice(+t.dataset.i,1);renderModal();break;
    case 'add-contact':(M.draft.contacts=M.draft.contacts||[]).push({name:'',title:'',phone:'',email:''});renderModal();break;
    case 'rm-contact':M.draft.contacts.splice(+t.dataset.i,1);renderModal();break;
  }
  if(M&&M.arm&&a!=='del'){M.arm=false;renderModal()}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&M)closeModal();
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
  else if(t.dataset.ef){M.draft[t.dataset.ef]=val}
  else if(t.dataset.wf){M.draft[t.dataset.wf]=t.checked}
});
document.addEventListener('change',e=>{
  const t=e.target;const a=t.dataset.act;
  if(t.dataset.upload!=null){uploadQuote(+t.dataset.upload,t.files[0]);return}
  if(t.dataset.docupload!=null){if(t.files.length)uploadDocs([...t.files]);return}
  if(t.dataset.prole){setRole(t.dataset.prole,t.value);return}
  if(t.dataset.plink!=null){linkEstimator(t.dataset.plink,t.value);return}
  if(t.dataset.pname){setProfileName(t.dataset.pname,t.value.trim());return}
  if(M&&t.dataset.bf){if(t.dataset.bf==='status'||t.dataset.bf==='lead_estimator_id')renderModal();return}
  if(M&&t.dataset.qf&&t.dataset.qf.endsWith('.status')){const q=M.draft.quotes[+t.dataset.qf.split('.')[0]];
    if(q.status==='Requested'&&!q.requested_date)q.requested_date=todayStr();if(q.status==='Received'&&!q.received_date)q.received_date=todayStr();renderModal();return}
  if(!a)return;
  switch(a){
    case 'year':S.year=+t.value;render();break;
    case 'estF':S.estF=t.value;render();break;
    case 'clientF':S.clientF=t.value;render();break;
    case 'tradeF':S.q.trade=t.value;render();break;
    case 'add-support':if(t.value){M.draft.support_estimator_ids.push(t.value);renderModal()}break;
    case 'add-client':if(t.value){M.draft.client_ids.push(t.value);const first=byId(S.clients,t.value)?.contacts?.[0]?.name;if(first)M.draft.client_contacts[t.value]=first;renderModal()}break;
    case 'add-quote':if(t.value){addQuote(t.value);renderModal()}break;
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

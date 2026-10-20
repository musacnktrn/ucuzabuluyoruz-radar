// ureten: codex · Yalnız oturum anahtarı sessionStorage'da; özel veri cache'lenmez.
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const preview = new URLSearchParams(location.search).get('preview') === '1';
const TOKEN_KEY = 'ucuz-radar-session-v1';
const EXPIRES_KEY = 'ucuz-radar-session-expires-v1';
const state = { preview, page: 'opportunities', filter: 'new', search: '', brand: '', token: null, expiresAt: null, data: null, connected: false, config: {}, loginError: '', health: null };
let serviceWorkerRegistration, installPrompt, refreshTimer, toastTimer, expiryTimer, loginInteracted=false;

const paths = {
  radar: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m12 12 6-6"/><path d="M12 3v2M3 12h2M12 19v2M19 12h2"/>',
  sources: '<path d="M8 16H6a4 4 0 0 1 0-8h4m4 0h4a4 4 0 0 1 0 8h-4M8 12h8"/>',
  brands: '<path d="m3 12 9-9h7l2 2v7l-9 9-9-9Z"/><circle cx="16.5" cy="7.5" r="1"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="3" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>', right: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>', shield: '<path d="m12 3 7 3v6c0 4-4 7-7 9-3-2-7-5-7-9V6l7-3Z"/><path d="m8 12 3 3 5-5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  leaf: '<path d="M20 3C8 2 2 8 5 15s15 4 15-12Z"/><path d="M4 21 16 8"/>',
  sparkle: '<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3ZM20 2v4M18 4h4"/>',
  whatsapp: '<path d="M20 11.5a8 8 0 0 1-11.9 7L3 20l1.5-5.1A8 8 0 1 1 20 11.5Z"/><path d="M8 7c-2 3 3 8 6 7l1-2-2-1-1 1-2-2 1-1-1-2H8Z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5" fill="currentColor"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7"/>', beauty: '<path d="M8 20V9h8v11H8ZM10 9V5l4-2v6M6 20h12"/>',
  bag: '<path d="M5 8h14l1 13H4L5 8ZM8 8V6a4 4 0 0 1 8 0v2"/>', tech: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  logout: '<path d="M9 4H4v16h5m5-12 4 4-4 4M8 12h12"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  check: '<path d="m5 12 4 4L19 6"/>', lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>', refresh: '<path d="M20 9a8 8 0 0 0-14-4L3 8m0-5v5h5M4 15a8 8 0 0 0 14 4l3-3m0 5v-5h-5"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/>', external: '<path d="M14 3h7v7m0-7-11 11M10 3H3v18h18v-7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
};
const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true" viewBox="0 0 24 24">${paths[name] || paths.globe}</svg>`;
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const statusText = {new:'Yeni',claimed:'Üstlenildi',ready:'Hazır',published:'Yayınlandı',dismissed:'Elenen'};
const sourceKinds = {whatsapp_channel:'WhatsApp kanalı',instagram_channel:'Instagram kanalı',instagram_story:'Instagram story',website:'Web sitesi',manual:'Elle ekleme',telegram:'Telegram'};
const sourceStates = {not_connected:'Bağlı değil',manual_ready:'Elle eklemeye hazır',paused:'Duraklatıldı'};
const platformIcon = platform => String(platform).toLowerCase().includes('whatsapp') ? 'whatsapp' : String(platform).toLowerCase().includes('instagram') ? 'instagram' : 'globe';
const platformCanonical = value => ({whatsapp:'whatsapp',instagram:'instagram',web:'website',website:'website',telegram:'telegram',manual:'manual','diğer':'manual'}[String(value).toLocaleLowerCase('tr')] || 'manual');
const platformLabel = value => ({whatsapp:'WhatsApp',instagram:'Instagram',website:'Web',telegram:'Telegram',manual:'Elle ekleme'}[String(value).toLowerCase()] || value);
function relative(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Zaman bilinmiyor';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? 'Az önce' : minutes < 60 ? `${minutes} dk önce` : minutes < 1440 ? `${Math.floor(minutes / 60)} sa önce` : `${Math.floor(minutes / 1440)} gün önce`;
}
function expiry(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Bitiş belirtilmedi';
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return 'Süresi doldu';
  const hours = Math.ceil(ms / 3600000);
  return hours < 24 ? `${hours} saat kaldı` : `${Math.ceil(hours / 24)} gün kaldı`;
}
const fullDate = value => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat('tr-TR', {dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : 'Belirtilmedi';
const isExpired = o => o.expiresAt && new Date(o.expiresAt).getTime() <= Date.now();
const publishable = o => o.confidence === 'confirmed' && o.audience === 'public' && !isExpired(o) && (state.preview || Boolean(safeUrl(o.sourceUrl)));
function toast(message) { clearTimeout(toastTimer); const t = document.querySelector('#toast'); t.textContent = message; t.hidden = false; toastTimer = setTimeout(() => t.hidden = true, 6500); }
function tokenStorage(value,expiresAt) { try { if (value) {sessionStorage.setItem(TOKEN_KEY, value);sessionStorage.setItem(EXPIRES_KEY, expiresAt);} else {sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(EXPIRES_KEY);} } catch { /* Oturum yalnız bellekte sürer. */ } }
function sessionExpired(){return state.token && (!Number.isFinite(new Date(state.expiresAt).getTime()) || new Date(state.expiresAt).getTime() <= Date.now());}
function scheduleSessionExpiry(){
  clearTimeout(expiryTimer);if(!state.token)return;
  if(sessionExpired()){clearPrivateState('Oturumunuz sona erdi. Yeniden giriş yapın.');return;}
  expiryTimer=setTimeout(()=>{if(sessionExpired())clearPrivateState('Oturumunuz sona erdi. Yeniden giriş yapın.');else scheduleSessionExpiry();},Math.min(new Date(state.expiresAt).getTime()-Date.now(),2147483647));
}

async function api(path, {method = 'GET', body, headers = {}} = {}) {
  if (state.preview) throw new Error('Örnek taslak gerçek API kullanmaz.');
  if(sessionExpired()){clearPrivateState('Oturumunuz sona erdi. Yeniden giriş yapın.');const error=new Error('Oturumunuz sona erdi. Yeniden giriş yapın.');error.status=401;throw error;}
  const requestToken=state.token;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${state.config.apiBase || ''}${path}`, {method, cache:'no-store', credentials:'omit', signal:controller.signal, headers:{'Content-Type':'application/json', ...(state.token ? {Authorization:`Bearer ${state.token}`} : {}), ...headers}, ...(body !== undefined ? {body:JSON.stringify(body)} : {})});
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : {};
    if(requestToken&&(requestToken!==state.token||sessionExpired())){const error=new Error('Bu işlem için oturum artık açık değil.');error.status=401;throw error;}
    if (!res.ok) {
      const error = new Error(data.error?.message || (res.status === 409 ? 'Bu kayıt başka bir yerde değişti. Güncel halini yeniden açın.' : 'İşlem tamamlanamadı. Yeniden deneyin.'));
      error.status = res.status; error.code = data.error?.code;
      if (res.status === 401 && state.token) clearPrivateState('Oturumunuz sona erdi. Yeniden giriş yapın.');
      throw error;
    }
    if (!contentType.includes('application/json')) throw new Error('Yerel bilgisayar servisine ulaşılamadı. Bağlantıyı kontrol edin.');
    state.connected = true; return data;
  } catch (error) {
    if (!error.status) { state.connected = false; throw new Error(navigator.onLine ? 'Yerel bilgisayara bağlanılamıyor. Bilgisayarın açık ve bağlantısının etkin olduğunu kontrol edin.' : 'İnternet bağlantısı yok. Bilgisayara yeniden bağlanınca devam edebilirsiniz.'); }
    throw error;
  } finally { clearTimeout(timeout); }
}

function clearPrivateState(message = '') {
  tokenStorage(null); state.token = null; state.expiresAt=null; state.data = null; state.loginError = message; state.connected = false;
  state.search='';state.brand='';state.filter='new';state.page='opportunities';document.querySelector('#toast').hidden=true;
  clearTimeout(expiryTimer);clearInterval(refreshTimer); refreshTimer = undefined; dialog.close(); dialog.replaceChildren(); renderLogin();
}

function syntheticData() {
  const ago = min => new Date(Date.now() - min * 60000).toISOString();
  const after = hours => new Date(Date.now() + hours * 3600000).toISOString();
  return {
    user:{id:'preview-gizem',name:'Gizem',role:'editor'},
    opportunities:[
      {id:'sample-1',version:1,title:'Ev tekstilinde sepete ek bir fırsat',brandId:'sample-home',brand:'Örnek Ev',platform:'WhatsApp',code:'ORNEK20',discount:'Örnek %20',conditions:'Sentetik örnek: Seçili ev tekstili ürünleri. Gerçek bir kampanya değildir.',category:'Ev',sourceName:'Örnek fırsat kanalı',sourceUrl:'',receivedAt:ago(4),publishedAt:ago(5),expiresAt:after(5),confidence:'confirmed',audience:'public',status:'new',assignee:null,isDemo:true},
      {id:'sample-2',version:1,title:'Bakım rutinine küçük bir yenilik',brandId:'sample-beauty',brand:'Örnek Bakım',platform:'Instagram',code:'DENEME15',discount:'Örnek %15',conditions:'Sentetik örnek: Kodun kapsamı ve paylaşım izni incelenmeyi bekliyor.',category:'Güzellik',sourceName:'Örnek Instagram story',sourceUrl:'',receivedAt:ago(18),publishedAt:ago(20),expiresAt:after(11),confidence:'review',audience:'unknown',status:'new',assignee:null,isDemo:true},
      {id:'sample-3',version:1,title:'Günün kombinleri için bir aday',brandId:'sample-style',brand:'Örnek Giyim',platform:'Instagram',code:'TASLAK10',discount:'Örnek %10',conditions:'Sentetik örnek: Seçili ürünler ve stok koşulu. Kaynaktan doğrulanmalı.',category:'Giyim',sourceName:'Örnek Instagram kanalı',sourceUrl:'',receivedAt:ago(36),publishedAt:ago(40),expiresAt:null,confidence:'review',audience:'public',status:'new',assignee:null,isDemo:true},
      {id:'sample-4',version:1,title:'Mutfak gereçleri için hazırlık',brandId:'sample-home',brand:'Örnek Ev',platform:'Web',code:'ORNEKMUTFAK',discount:'Örnek kampanya',conditions:'Sentetik örnek: Bu kart üstlenilen iş akışını gösterir.',category:'Ev',sourceName:'Elle eklenen örnek',sourceUrl:'',receivedAt:ago(70),expiresAt:after(24),confidence:'confirmed',audience:'public',status:'claimed',assignee:'preview-gizem',isDemo:true},
      {id:'sample-5',version:1,title:'Kontrol edilmiş örnek fırsat',brandId:'sample-style',brand:'Örnek Giyim',platform:'Web',code:'ORNEKHAZIR',discount:'Örnek indirim',conditions:'Sentetik örnek: Hazır olarak işaretlenen fırsat. Yayınlama işlemi yapılmaz.',category:'Giyim',sourceName:'Elle eklenen örnek',sourceUrl:'',receivedAt:ago(95),expiresAt:after(48),confidence:'confirmed',audience:'public',status:'ready',assignee:'preview-gizem',isDemo:true},
    ],
    sources:[{id:'sample-wa',name:'Örnek fırsat kanalı',platform:'WhatsApp',kind:'whatsapp_channel',url:'',method:'Henüz bağlanmadı',state:'not_connected',lastSeenAt:null},{id:'sample-ig',name:'Örnek Instagram story',platform:'Instagram',kind:'instagram_story',url:'',method:'Henüz bağlanmadı',state:'not_connected',lastSeenAt:null},{id:'sample-web',name:'Elle eklenen örnek',platform:'Diğer',kind:'manual',url:'',method:'Elle ekleme',state:'manual_ready',lastSeenAt:null}],
    brands:[{id:'sample-home',name:'Örnek Ev',priority:'high',enabled:true},{id:'sample-beauty',name:'Örnek Bakım',priority:'high',enabled:true},{id:'sample-style',name:'Örnek Giyim',priority:'normal',enabled:true}],
    activity:[{id:'sample-a1',text:'Örnek taslak açıldı. Canlı kaynak bağlı değil.',at:ago(1),type:'info'},{id:'sample-a2',text:'Fırsatları incele, üstlen ve hazırla akışını deneyebilirsin.',at:ago(3),type:'info'}],
    system:{mode:'local',connected:false,computer:'Yerel bilgisayar',collector:{state:'not_connected',lastHeartbeatAt:null},sourceConnectionsReady:false},settings:{urgentOnly:true,quietStart:'23:00',quietEnd:'08:00'},
  };
}

function identity(mobile = false) {
  return `<div class="${mobile ? 'mobile-brand' : 'identity'}"><div class="identity-mark" aria-hidden="true">r<span>·</span></div><div><div class="identity-title">RADAR</div><div class="identity-sub">ucuzabuluyoruz</div></div></div>`;
}
const pageNames = {opportunities:'Fırsatlar',sources:'Kaynaklar',brands:'Markalar',settings:'Ayarlar'};
const pageIcons = {opportunities:'radar',sources:'sources',brands:'brands',settings:'settings'};
function nav(mobile = false) {
  return Object.entries(pageNames).map(([id,name]) => `<button type="button" class="${mobile ? '' : 'nav-button '}${state.page === id ? 'active' : ''}" data-action="navigate" data-page="${id}" ${state.page === id ? 'aria-current="page"' : ''}>${icon(pageIcons[id])}<span>${name}</span>${!mobile && id === 'opportunities' ? `<span class="nav-count">${state.data.opportunities.filter(o=>o.status==='new').length}</span>` : ''}</button>`).join('');
}
function renderLogin() {
  const healthMessage = state.health?.configured === false ? 'Yerel servis açık. İlk kullanıcı kurulumu tamamlanmayı bekliyor.' : state.health?.ok ? 'Yerel bilgisayara bağlantı hazır. Şifrenle güvenle giriş yapabilirsin.' : 'Bilgisayar açık ve bağlantısı etkin olduğunda çalışma masan burada hazır.';
  app.innerHTML = `<main id="main" class="login-shell"><section class="login-intro">${identity()}<div class="login-copy"><div class="eyebrow">Gizem'in fırsat masası</div><h1>Güzel fırsatları<br>gözden kaçırma.</h1><p>Kanallar, kodlar ve hazırlıklar tek bir sakin yerde. Sıradaki iyi fırsata yer aç.</p></div><p class="login-footer">Biraz daha az arama. Biraz daha çok zaman.</p></section><section class="login-main"><div class="login-form-wrap"><div class="eyebrow mb13">Özel çalışma alanı</div><h2>Tekrar merhaba.</h2><p>Çalışma masana ulaşmak için giriş yap.<br>Fırsatların ve kaynakların girişten sonra görünür.</p><form id="login-form" class="login-form"><label>Kullanıcı adı<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="Kullanıcı adın"></label><label>Şifre<input name="password" type="password" autocomplete="current-password" required placeholder="Şifren"></label>${state.loginError ? `<div class="form-error" role="alert">${e(state.loginError)}</div>` : ''}<button class="button wide" type="submit">Çalışma masama gir ${icon('right')}</button></form><div class="login-status">${icon(state.health?.ok ? 'shield' : 'tech')}<span>${e(healthMessage)}</span></div><div class="login-preview">Henüz girişin yoksa taslağı inceleyebilirsin.<a href="?preview=1">Örnek çalışma masasını gör →</a></div></div></section></main>`;
}
function render() {
  if (!state.data) { renderLogin(); return; }
  const user = state.data.user;
  const date = new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',weekday:'long'}).format(new Date());
  app.innerHTML = `${state.preview ? `<div class="preview-banner">${icon('info')} Örnek taslak · Canlı kaynak bağlı değil · Veriler sentetiktir</div>` : !state.connected ? `<div class="connection-banner">${icon('info')} Bilgisayar bağlantısı kesildi. Yeni fırsatlar ve işlemler bağlantı gelince devam eder.</div>` : ''}<div class="app-shell"><aside class="sidebar">${identity()}<div class="eyebrow nav-label">Çalışma masası</div><nav class="main-nav" aria-label="Ana gezinme">${nav()}</nav><div class="sidebar-note">${icon('leaf')}<p>Bul, kontrol et,<br>kendi dilinle paylaş.</p></div><div class="sidebar-bottom"><div class="computer-label"><span class="local-dot ${state.connected && !state.preview ? 'online' : ''}"></span>${state.preview ? 'Örnek çalışma alanı' : state.connected ? 'Yerel bilgisayar açık' : 'Bilgisayara ulaşılamıyor'}</div><div class="user-block"><div class="avatar">${e((user.name || 'G').slice(0,1))}</div><div class="user-copy"><strong>${e(user.name)}</strong><small>${state.preview ? 'Örnek görünüm' : 'Özel çalışma alanı'}</small></div><button class="icon-button" data-action="logout" aria-label="${state.preview ? 'Örnek taslaktan çık' : 'Çıkış yap'}" title="Çıkış">${icon('logout')}</button></div></div></aside><div class="workspace"><header class="topbar"><div class="topbar-breadcrumb">Çalışma masası &nbsp; / &nbsp; <span>${pageNames[state.page]}</span></div>${identity(true)}<div class="topbar-right"><span class="topbar-date">${e(date)}</span><span class="tiny-tag">${state.preview ? 'İLK TASLAK' : 'YEREL SÜRÜM'}</span><button class="icon-button" data-action="navigate" data-page="settings" aria-label="Bildirim ve uygulama ayarları">${icon('bell')}</button><div class="avatar" aria-label="${e(user.name)}">${e((user.name || 'G').slice(0,1))}</div></div></header><main id="main">${pageContent()}</main></div><nav class="mobile-nav" aria-label="Mobil gezinme">${nav(true)}</nav></div>`;
}

function heading(eyebrow, title, description, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}
function pageContent() {
  if (state.page === 'sources') return sourcesPage();
  if (state.page === 'brands') return brandsPage();
  if (state.page === 'settings') return settingsPage();
  return opportunitiesPage();
}
function opportunitiesPage() {
  return `${heading('Fırsat masası', 'İyi fırsatlar, tek yerde.', 'Önce göz at, sonra kendi dokunuşunu ekle.', `<button class="button" data-action="add-opportunity" aria-label="Elle fırsat ekle">${icon('plus')} Fırsat ekle</button>`)}<div class="content-columns"><section class="main-column"><div class="list-toolbar"><label class="searchbar"><span class="skip-link">Fırsatlarda ara</span>${icon('search')}<input id="opportunity-search" type="search" value="${e(state.search)}" placeholder="Marka, fırsat veya kod ara…" aria-label="Fırsatlarda ara"></label><select id="brand-filter" class="brand-filter" aria-label="Markaya göre filtrele"><option value="">Tüm markalar</option>${state.data.brands.map(b=>`<option value="${e(b.id)}" ${state.brand === b.id ? 'selected' : ''}>${e(b.name)}</option>`).join('')}</select></div><div class="tabs" aria-label="Fırsat durumu">${[['new','Yeni'],['claimed','Üstlendiğim'],['ready','Hazır'],['published','Yayınlanan']].map(([id,label])=>`<button class="tab ${state.filter === id ? 'active' : ''}" data-action="filter" data-filter="${id}" aria-pressed="${state.filter === id}">${label}<span class="tab-number">${filterOpportunities(id,false).length}</span></button>`).join('')}</div><div id="opportunity-results">${opportunityResults()}</div><div class="list-footnote">${icon('shield')} <span>Kodlar kaynak ve paylaşım koşulları kontrol edilerek hazırlanır. Yayınlama kararı sende.</span></div></section>${rightColumn()}</div>`;
}
function filterOpportunities(status = state.filter, useSearch = true) {
  const q = state.search.toLocaleLowerCase('tr');
  return state.data.opportunities.filter(o => o.status === status && (status !== 'claimed' || o.assignee === state.data.user.id) && (!state.brand || o.brandId === state.brand) && (!useSearch || !q || `${o.title} ${o.brand} ${o.code} ${o.discount}`.toLocaleLowerCase('tr').includes(q))).sort((a,b)=>new Date(b.receivedAt)-new Date(a.receivedAt));
}
function opportunityResults() {
  const opportunities = filterOpportunities();
  if (!opportunities.length) {
    const filtered = state.search || state.brand;
    return `<div class="empty-state">${icon(filtered ? 'search' : 'radar')}<h2>${filtered ? 'Bu aramada fırsat yok' : state.filter === 'new' ? 'Yeni fırsatlara yer açtık.' : 'Burası şimdilik sakin.'}</h2><p>${filtered ? 'Başka bir marka veya kelimeyle tekrar deneyebilirsin.' : state.filter === 'new' ? 'İlk fırsatını elle ekleyebilirsin. Kanalların otomatik takibi, kaynak bağlantıları doğrulandığında açılacak.' : 'Fırsatın durumunu değiştirdiğinde burada görünür.'}</p><button class="button secondary" data-action="${filtered ? 'clear-search' : 'add-opportunity'}">${icon(filtered ? 'refresh' : 'plus')}${filtered ? 'Filtreleri temizle' : 'Fırsat ekle'}</button></div>`;
  }
  return `<div class="section-line"><h2>${state.filter === 'new' ? 'ŞİMDİ GÖZ AT' : state.filter === 'claimed' ? 'SENİN MASANDA' : state.filter === 'ready' ? 'SON DOKUNUŞ İÇİN' : 'PAYLAŞILDI OLARAK İŞARETLENENLER'}</h2><span>${opportunities.length} ${state.preview ? 'örnek ' : ''}fırsat</span></div><div class="opportunity-list">${opportunities.map(opportunityCard).join('')}</div>`;
}
function opportunityCard(o) {
  const brand = state.data.brands.find(b=>b.id === o.brandId);
  const cat = /ev|mutfak/i.test(o.category) ? 'home' : /güzellik|bakım/i.test(o.category) ? 'beauty' : /teknoloji/i.test(o.category) ? 'tech' : 'bag';
  return `<button class="opportunity-card" data-action="detail" data-id="${e(o.id)}"><span class="category-icon ${cat}">${icon(cat)}</span><span><span class="card-topline"><strong>${e(o.brand || 'Marka belirtilmedi')}</strong>${brand?.priority === 'high' ? `<span class="priority-star" title="Öncelikli marka">${icon('star')}</span>` : ''}<span>·</span><span>${e(platformLabel(o.platform))}</span><span>·</span><span>${relative(o.receivedAt)}</span></span><span class="card-title">${e(o.title)}</span><span class="card-description">${e(o.conditions || 'Kullanım koşulları henüz belirtilmedi.')}</span><span class="card-footer">${o.code ? `<span class="coupon">${e(o.code)}</span>` : ''}<span class="chip ${o.confidence === 'confirmed' ? 'green' : 'gold'}">${icon(o.confidence === 'confirmed' ? 'check' : 'info')}${o.confidence === 'confirmed' ? 'Kontrol edildi' : 'Kontrol bekliyor'}</span>${isExpired(o) ? `<span class="chip rose">Süresi doldu</span>` : o.expiresAt ? `<span class="chip">${icon('clock')}${expiry(o.expiresAt)}</span>` : ''}${o.audience !== 'public' ? `<span class="chip rose">Paylaşım izni belirsiz</span>` : ''}</span></span>${icon('arrow','card-chevron')}</button>`;
}
function rightColumn() {
  const sources = state.data.sources.slice(0,3);
  return `<aside class="right-column" aria-label="Günün notları"><div class="right-label">Küçük bir hatırlatma</div><div class="focus-card">${icon('sparkle','spark')}<h3>Her fırsatın<br>bir hikâyesi var.</h3><p>Kodu yakala, koşulları kontrol et.<br>Gerisini kendi dilinle anlat.</p><a href="#" data-action="navigate" data-page="brands">Öncelikli markalarını düzenle ${icon('right')}</a></div><section class="side-section"><div class="right-label">Kaynakların</div>${sources.length ? sources.map(s=>`<div class="source-mini"><span class="platform-icon ${platformIcon(s.platform)}">${icon(platformIcon(s.platform))}</span><div class="source-mini-text">${e(platformLabel(s.platform))}<small>${e(sourceKinds[s.kind] || s.kind)}</small></div><span class="mini-label">${s.state === 'manual_ready' ? 'Elle' : s.state === 'paused' ? 'Duraklatıldı' : 'Bağlı değil'}</span></div>`).join('') : '<p class="muted text11">Henüz kaynak eklenmedi.</p>'}<button class="text-link" data-action="navigate" data-page="sources">Tüm kaynaklar ${icon('right')}</button></section><section class="side-section"><div class="right-label">Masadaki son hareketler</div>${state.data.activity.length ? state.data.activity.slice(0,4).map(a=>`<div class="activity-item"><span class="activity-dot"></span><div><p>${e(a.text)}</p><time>${relative(a.at)}</time></div></div>`).join('') : '<p class="muted text11">İlk adımın burada görünecek.</p>'}</section><div class="quiet-note">${icon('leaf')}<span>${state.preview ? 'Bu bir örnek taslak. Hiçbir hesap veya kaynak bağlı değil.' : 'Bilgisayar açıkken çalışır. Otomatik kaynak bağlantıları henüz kurulmadı.'}</span></div></aside>`;
}
function sourcesPage() {
  return `${heading('Gözün bu kaynaklarda', 'Fırsatın geldiği yer.', 'Kaynaklarını bir arada tut, bağlantı durumunu gör.', `<button class="button" data-action="add-source" aria-label="Kaynak ekle">${icon('plus')} Kaynak ekle</button>`)}<div class="notice">${icon('info')}<span>Kaynak eklemek hesabı otomatik bağlamaz. WhatsApp kanalı, Instagram kanalı ve story takibi için okuma yöntemi ve erişim ayrıca doğrulanacak. Ana Instagram hesabında otomatik işlem yapılmaz.</span></div>${state.data.sources.length ? `<div class="source-grid">${state.data.sources.map(s=>`<article class="source-card"><div class="source-card-head"><span class="platform-icon ${platformIcon(s.platform)}">${icon(platformIcon(s.platform))}</span><div class="source-card-name"><h3>${e(s.name)}</h3><small>${e(sourceKinds[s.kind] || s.kind)}</small></div><span class="chip ${s.state === 'manual_ready' ? 'green' : ''}">${e(sourceStates[s.state] || 'Bağlı değil')}</span></div><p>${s.state === 'manual_ready' ? 'Bu kaynaktan gördüğün fırsatları elle ekleyebilirsin.' : s.state === 'paused' ? 'Bu kaynak için takip isteği duraklatıldı.' : 'Otomatik okuma kurulmadı. Kaynak, bağlantı pilotu için kayıtlı.'}</p><div class="source-card-footer">${safeUrl(s.url) ? `<a class="text-link" href="${e(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">Kaynağı aç ${icon('external')}</a>` : '<span class="mini-label">Bağlantı belirtilmedi</span>'}<button class="button secondary small" data-action="toggle-source" data-id="${e(s.id)}">${s.state === 'paused' ? 'Takip isteğini aç' : 'Duraklat'}</button></div></article>`).join('')}</div>` : `<div class="empty-state">${icon('sources')}<h2>Kaynak listeni oluşturalım.</h2><p>Takip etmek istediğin kanal veya hesabı ekle. Bağlantı kurulana kadar durumu açıkça görünür.</p><button class="button secondary" data-action="add-source">${icon('plus')} İlk kaynağı ekle</button></div>`}`;
}
function brandsPage() {
  return `${heading('Sana göre bir radar', 'Öncelik senin.', 'Önem verdiğin markalar önce gelsin.')}<div class="content-columns"><section class="panel"><h2>Marka tercihlerin</h2><p class="mt7">Öncelik bildirim tercihinde kullanılır. Anahtar, markayı takibe dahil eder.</p>${state.data.brands.length ? state.data.brands.map(b=>`<div class="brand-row"><span class="brand-initial">${e(b.name.slice(0,1))}</span><div class="brand-name"><strong>${e(b.name)}</strong><small>${b.enabled ? 'Takip listende' : 'Takip dışında'}</small></div><select data-brand-priority="${e(b.id)}" aria-label="${e(b.name)} önceliği"><option value="high" ${b.priority === 'high' ? 'selected' : ''}>★ Öncelikli</option><option value="normal" ${b.priority === 'normal' ? 'selected' : ''}>Normal</option><option value="low" ${b.priority === 'low' ? 'selected' : ''}>Düşük</option></select><button class="switch" role="switch" aria-checked="${Boolean(b.enabled)}" aria-label="${e(b.name)} takibi" data-action="toggle-brand" data-id="${e(b.id)}"></button></div>`).join('') : '<div class="empty-state mt20"><h2>Markalar fırsatlarınla birlikte gelir.</h2><p>İlk fırsatını bir marka adıyla eklediğinde burada önceliğini düzenleyebilirsin.</p><button class="button secondary" data-action="add-opportunity">Fırsat ekle</button></div>'}</section>${rightColumn()}</div>`;
}
function settingsPage() {
  const d = state.data;
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  const permissionLabel = {default:'Henüz izin verilmedi',granted:'Tarayıcı izni açık',denied:'Tarayıcı izni kapalı',unsupported:'Bu tarayıcı desteklemiyor'}[permission];
  return `${heading('Her şey yerli yerinde', 'Sana uysun.', 'Telefon, bildirimler ve bilgisayar bağlantısı.')}<div class="panels-grid"><div class="settings-stack"><section class="panel"><div class="panel-title">${icon('phone')}<h2>Telefonunda RADAR</h2></div><p>Ana ekrana ekle; tarayıcı sekmesi aramadan çalışma masana ulaş.</p><div class="setting-actions"><button class="button secondary" data-action="install">${icon('download')} Telefona yükle</button><button class="button quiet" data-action="install-help">Nasıl eklerim?</button></div></section><section class="panel"><div class="panel-title">${icon('bell')}<h2>Bildirimler</h2></div><p>${e(permissionLabel)}. ${state.preview ? 'Örnek taslak bildirim göndermez.' : 'Bildirim aboneliği aşağıdaki düğmeyle kurulur.'}</p><div class="setting-row"><div class="setting-copy"><strong>Yalnızca öncelikli markalar</strong><p>Sakin bir akış için önemsediğin markalara odaklan.</p></div><button class="switch" role="switch" aria-checked="${Boolean(d.settings.urgentOnly)}" aria-label="Yalnızca öncelikli marka bildirimleri" data-action="toggle-urgent"></button></div><form id="quiet-form"><div class="quiet-fields"><label>Sessizlik başlasın<input name="quietStart" type="time" value="${e(d.settings.quietStart || '23:00')}" required></label><label>Sessizlik bitsin<input name="quietEnd" type="time" value="${e(d.settings.quietEnd || '08:00')}" required></label></div><button class="button secondary small" type="submit">Saatleri kaydet</button></form><div class="setting-actions"><button class="button" data-action="enable-push">${icon('bell')} Bildirimleri aç</button><button class="button secondary" data-action="test-push">Test bildirimi</button></div><p class="text10 mt16">iPhone'da bildirim için Safari'den Ana Ekrana Ekle, ardından uygulamayı ana ekrandan aç. Bilgisayar kapalıyken yeni bildirim oluşmaz.</p></section></div><div class="settings-stack"><section class="panel"><div class="panel-title">${icon('tech')}<h2>Yerel bilgisayar</h2></div><div class="setting-row"><div class="setting-copy"><strong>${e(d.system.computer || 'Yerel bilgisayar')}</strong><p>${state.preview ? 'Örnek görünüm; gerçek bağlantı yok.' : state.connected ? 'Çalışma masası bilgisayara bağlı.' : 'Bağlantı kurulamadı.'}</p></div><span class="chip ${state.connected && !state.preview ? 'green' : 'gold'}">${state.connected && !state.preview ? 'Bağlı' : 'Bağlı değil'}</span></div><div class="setting-row"><div class="setting-copy"><strong>Kaynak okuyucuları</strong><p>WhatsApp ve Instagram bağlantıları henüz kurulmadı. Şimdilik elle eklenen fırsatlar işlenir.</p></div></div><p class="mt14">Bilgisayar ve internet açık kaldığı sürece çalışır. Uykuya geçtiğinde veya bağlantı kesildiğinde yeni fırsat takibi ve bildirim durur.</p><div class="setting-actions"><button class="button secondary" data-action="refresh">${icon('refresh')} Bağlantıyı kontrol et</button></div></section><section class="panel"><div class="panel-title">${icon('shield')}<h2>Özel çalışma alanın</h2></div><p>Giriş sunucuda doğrulanır. Özel fırsat verileri çevrimdışı tarayıcı önbelleğine kaydedilmez. Yayınlar senin kontrolündedir.</p><div class="setting-actions"><button class="button secondary" data-action="logout">${icon('logout')} ${state.preview ? 'Örnek taslaktan çık' : 'Güvenli çıkış'}</button></div><p class="text9 mt16">RADAR · ${e(state.config.build || 'ilk taslak')}</p></section></div></div>`;
}

function openDialog(content) { dialog.innerHTML = content; if (!dialog.open) dialog.showModal(); }
const dialogHeader = (title, sub = '') => `<div class="dialog-heading"><div><h2 id="dialog-title">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="icon-button" data-action="close-dialog" aria-label="Kapat">${icon('close')}</button></div>`;
function dateTimeInput(value) {
  const date=new Date(value);if(!value||!Number.isFinite(date.getTime()))return '';
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function editProof(id) {
  const o=state.data.opportunities.find(item=>item.id===id);if(!o)return;
  openDialog(`${dialogHeader('Bilgileri kontrol et', state.preview ? 'Sentetik örnek üzerinde düzenleme yapıyorsun.' : 'Kaynağı aç, koşulları kontrol et ve kendi değerlendirmeni kaydet.')}<form id="proof-form" class="dialog-form" data-id="${e(o.id)}" data-version="${e(o.version)}"><div class="form-grid"><label class="full">Kaynak bağlantısı<input name="sourceUrl" type="url" required pattern="https://.+" maxlength="2000" value="${e(o.sourceUrl || '')}" placeholder="https://…"><span class="form-help">HTTPS kaynak zorunlu. Kaynağı ve kodun paylaşım iznini kendin kontrol et.</span></label><label class="full">Kullanım koşulları<textarea name="conditions" maxlength="2000" placeholder="Alt limit, ürün kapsamı, stok ve diğer koşullar">${e(o.conditions || '')}</textarea></label><label>Kimin kullanımı için?<select name="audience"><option value="unknown" ${o.audience==='unknown'?'selected':''}>Henüz bilinmiyor</option><option value="public" ${o.audience==='public'?'selected':''}>Genel paylaşıma açık</option><option value="restricted" ${o.audience==='restricted'?'selected':''}>Kısıtlı / kişiye özel</option></select></label><label>Senin kontrol durumun<select name="confidence"><option value="review" ${o.confidence==='review'?'selected':''}>Kontrol edilmeli</option><option value="confirmed" ${o.confidence==='confirmed'?'selected':''}>Koşulları kendim kontrol ettim</option></select></label><label class="full">Bitiş zamanı<input name="expiresAt" type="datetime-local" value="${e(dateTimeInput(o.expiresAt))}"><span class="form-help">Kaynakta belirtilmiyorsa boş bırak.</span></label><label class="full">Kontrol notun<textarea name="note" maxlength="2000" placeholder="Kontrolde dikkat ettiğin bir ayrıntı varsa…">${e(o.note || '')}</textarea></label></div><div class="notice mt20">${icon('info')}<span>Bu kayıt senin değerlendirmeni saklar. RADAR kaynağı, kodun geçerliliğini veya paylaşım iznini otomatik doğrulamaz. Fırsatı kimin üstlendiği değişmez.</span></div><div class="form-error" data-form-error hidden role="alert"></div><div class="dialog-actions"><button type="button" class="button secondary" data-action="detail" data-id="${e(o.id)}">Vazgeç</button><button type="submit" class="button">${icon('check')} Kontrol bilgilerini kaydet</button></div></form>`);
}
function detail(id) {
  const o = state.data.opportunities.find(item=>item.id === id); if (!o) return;
  const url = safeUrl(o.sourceUrl);
  openDialog(`${dialogHeader('Fırsata yakından bak', state.preview ? 'Sentetik örnek · Gerçek kampanya değildir' : 'Kaynak ve koşulları birlikte kontrol et.')}<div class="card-topline mt24"><strong>${e(o.brand)}</strong><span>·</span><span>${e(platformLabel(o.platform))}</span><span>·</span><span>${relative(o.receivedAt)}</span></div><h3 class="detail-heading">${e(o.title)}</h3><div class="card-footer"><span class="chip ${o.confidence === 'confirmed' ? 'green' : 'gold'}">${o.confidence === 'confirmed' ? 'Kontrol edildi' : 'Kontrol bekliyor'}</span><span class="chip">${e(statusText[o.status])}</span><span class="chip ${o.audience === 'public' ? '' : 'rose'}">${{public:'Genel paylaşıma açık',restricted:'Kısıtlı / kişiye özel',unknown:'Paylaşım izni belirsiz'}[o.audience] || 'İzin bilinmiyor'}</span></div>${o.code ? `<div class="detail-code"><strong>${e(o.code)}</strong><button class="button secondary small" data-action="copy-code" data-id="${e(o.id)}">${icon('copy')} Kopyala</button></div>` : ''}<dl class="detail-table"><dt>İndirim</dt><dd>${e(o.discount || 'Belirtilmedi')}</dd><dt>Koşullar</dt><dd>${e(o.conditions || 'Kaynakta kontrol edilmeli.')}</dd><dt>Kaynak</dt><dd>${e(o.sourceName || 'Elle eklendi')}${url ? `<br><a href="${e(url)}" target="_blank" rel="noopener noreferrer">Kaynağı aç ${icon('external')}</a>` : ''}</dd><dt>Alınma zamanı</dt><dd>${fullDate(o.receivedAt)}</dd><dt>Bitiş</dt><dd>${fullDate(o.expiresAt)}${o.expiresAt ? ` · ${expiry(o.expiresAt)}` : ''}</dd><dt>İlgilenen</dt><dd>${o.assignee === state.data.user.id ? 'Sen' : o.assignee ? 'Başka bir editör' : 'Henüz üstlenilmedi'}</dd></dl><button class="button secondary" data-action="edit-proof" data-id="${e(o.id)}">${icon('shield')} Bilgileri kontrol et</button>${!publishable(o) ? '<div class="detail-hint">Hazır veya yayınlandı olarak işaretlemek için kodun doğrulanmış, genel paylaşıma açık, kaynak bağlantısının geçerli ve süresinin geçmemiş olması gerekir.</div>' : ''}<div class="detail-status">${o.status === 'new' ? `<button class="button" data-action="op-status" data-id="${e(o.id)}" data-status="claimed">${icon('user')} Üstlen</button>` : ''}${['new','claimed'].includes(o.status) && publishable(o) ? `<button class="button ${o.status === 'new' ? 'secondary' : ''}" data-action="op-status" data-id="${e(o.id)}" data-status="ready">${icon('check')} Hazır olarak işaretle</button>` : ''}${o.status === 'ready' && publishable(o) ? `<button class="button" data-action="op-status" data-id="${e(o.id)}" data-status="published">${icon('check')} Yayınlandı olarak işaretle</button>` : ''}${!['dismissed','published'].includes(o.status) ? `<button class="button quiet" data-action="op-status" data-id="${e(o.id)}" data-status="dismissed">Ele</button>` : ''}${['dismissed','ready'].includes(o.status) ? `<button class="button secondary" data-action="op-status" data-id="${e(o.id)}" data-status="new">Yeniye geri al</button>` : ''}</div><p class="form-help mt15">“Yayınlandı” yalnızca takip işaretidir. Instagram veya başka bir kanala otomatik paylaşım yapılmaz.</p>`);
}
function addOpportunity() {
  openDialog(`${dialogHeader('Yeni bir fırsat ekle', 'Kaynaktan gördüğün bilgiyi kaydet. Eksik koşulları uydurma.')}<form id="opportunity-form" class="dialog-form" data-key="${crypto.randomUUID()}"><div class="form-grid"><label class="full">Fırsat başlığı<input name="title" required maxlength="200" placeholder="Fırsatı kısaca anlat"></label><label>Marka<input name="brand" required maxlength="100" list="brand-options" placeholder="Marka adı"><datalist id="brand-options">${state.data.brands.map(b=>`<option value="${e(b.name)}">`).join('')}</datalist></label><label>Platform<select name="platform"><option>WhatsApp</option><option>Instagram</option><option>Web</option><option>Telegram</option><option>Diğer</option></select></label><label>İndirim kodu<input name="code" maxlength="120" placeholder="Varsa kod"></label><label>İndirim bilgisi<input name="discount" maxlength="120" placeholder="Kaynakta yazan indirim"></label><label class="full">Kullanım koşulları<textarea name="conditions" maxlength="2000" placeholder="Ürünler, alt limit, stok ve diğer koşullar"></textarea></label><label class="full">Kaynak bağlantısı<input name="sourceUrl" type="url" maxlength="2000" placeholder="https://…"><span class="form-help">Herkese açık kaynak bağlantısı; özel giriş bilgisi ekleme.</span></label><label class="full">Bitiş zamanı<input name="expiresAt" type="datetime-local"><span class="form-help">Kaynakta belirtilmiyorsa boş bırak.</span></label><label>Kimin kullanımı için?<select name="audience"><option value="unknown">Henüz bilinmiyor</option><option value="public">Genel paylaşıma açık</option><option value="restricted">Kısıtlı / kişiye özel</option></select></label><label>Kontrol durumu<select name="confidence"><option value="review">Kontrol edilmeli</option><option value="confirmed">Koşulları kontrol ettim</option></select></label></div><div class="form-error" data-form-error hidden role="alert"></div><div class="dialog-actions"><button type="button" class="button secondary" data-action="close-dialog">Vazgeç</button><button type="submit" class="button">${icon('plus')} Fırsatı kaydet</button></div></form>`);
}
function addSource() {
  openDialog(`${dialogHeader('Bir kaynak ekle', 'Önce listeye alalım. Erişim doğrulanınca takip bağlanır.')}<form id="source-form" class="dialog-form"><div class="form-grid"><label class="full">Kaynak adı<input name="name" required maxlength="120" placeholder="Kanal veya hesap adı"></label><label class="full">Kaynak türü<select name="kind">${Object.entries(sourceKinds).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label class="full">Kaynak bağlantısı<input name="url" type="url" maxlength="2000" placeholder="https://…"></label></div><div class="notice mt20">${icon('info')}<span>Kaynak şu an otomatik bağlanmayacak. Hesap şifresi veya giriş kodu istenmez.</span></div><div class="form-error" data-form-error hidden role="alert"></div><div class="dialog-actions"><button type="button" class="button secondary" data-action="close-dialog">Vazgeç</button><button type="submit" class="button">Kaynağı kaydet</button></div></form>`);
}
function installHelp() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  openDialog(`${dialogHeader('RADAR telefonunda', 'Ana ekrana eklediğinde uygulama gibi açılır.')}<div class="install-icon">${icon('phone')}</div><ol class="install-steps">${ios ? '<li>Bu sayfayı iPhone veya iPad’de <strong>Safari</strong> ile aç.</li><li><strong>Paylaş</strong> düğmesine, ardından <strong>Ana Ekrana Ekle</strong> seçeneğine dokun.</li><li>RADAR’ı ana ekrandaki simgesinden aç ve giriş yap.</li><li>Ayarlar → <strong>Bildirimleri aç</strong> düğmesine dokun, sistem iznini onayla.</li>' : '<li>Bu sayfayı telefonunda Chrome, Safari veya destekleyen bir tarayıcıyla aç.</li><li>Tarayıcı menüsünden <strong>Uygulamayı yükle</strong> veya <strong>Ana ekrana ekle</strong> seçeneğini seç.</li><li>RADAR’ı ana ekran simgesinden aç ve giriş yap.</li><li>Ayarlar sayfasındaki <strong>Bildirimleri aç</strong> düğmesini kullan.</li>'}</ol><div class="detail-hint">Bildirim kurulumu destek ve izin gerektirir. Bilgisayar kapalıyken yeni bildirim oluşturulmaz. Örnek taslak gerçek bildirim göndermez.</div><div class="dialog-actions"><button class="button" data-action="close-dialog">Anladım</button></div>`);
}

function previewActivity(text) {
  state.data.activity.unshift({id:crypto.randomUUID(),text:`Örnek: ${text}`,at:new Date().toISOString(),type:'edit'});
}
async function updateStatus(id,status) {
  const opportunity = state.data.opportunities.find(o=>o.id === id); if (!opportunity) return;
  if (['ready','published'].includes(status) && !publishable(opportunity)) { toast('Paylaşım koşulları veya kod henüz doğrulanmadı.'); return; }
  try {
    if (state.preview) {
      if (opportunity.assignee && opportunity.assignee !== state.data.user.id) throw new Error('Bu fırsatı başka bir editör üstlendi.');
      opportunity.status = status; opportunity.version += 1; opportunity.assignee = status === 'new' ? null : state.data.user.id; previewActivity('Fırsatın durumu güncellendi.');
    } else {
      const {opportunity:updated} = await api(`/api/opportunities/${encodeURIComponent(id)}`,{method:'PATCH',body:{version:opportunity.version,status,assignee:status === 'new' ? null : state.data.user.id}});
      const index=state.data.opportunities.findIndex(o=>o.id===id); state.data.opportunities[index] = updated;
    }
    dialog.close(); render(); toast(status === 'published' ? 'Yayınlandı olarak işaretlendi. Otomatik paylaşım yapılmadı.' : 'Fırsatın durumu güncellendi.');
  } catch (error) {
    if (error.status === 409) { dialog.close(); await refresh(false); toast('Bu fırsat başka bir yerde değişti. Güncel halini yeniden aç.'); }
    else toast(error.message);
  }
}
async function updateResource(type,id,body) {
  try {
    if (state.preview) {
      const item = state.data[type].find(x=>x.id===id); if (type==='sources') item.state = body.paused ? 'paused' : item.kind==='manual' ? 'manual_ready' : 'not_connected'; else Object.assign(item,body);
      previewActivity(type==='sources' ? 'Kaynak tercihi güncellendi; gerçek bağlantı kurulmadı.' : 'Marka tercihi güncellendi.');
    } else {
      const result=await api(`/api/${type}/${encodeURIComponent(id)}`,{method:'PATCH',body});
      const index=state.data[type].findIndex(x=>x.id===id); state.data[type][index] = result[type==='sources' ? 'source' : 'brand'];
    }
    render(); toast('Tercihin kaydedildi.');
  } catch (error) { toast(error.message); render(); }
}
async function updateSettings(body) {
  if (state.preview) { Object.assign(state.data.settings,body); previewActivity('Bildirim tercihi güncellendi.'); }
  else { const {settings}=await api('/api/settings',{method:'PATCH',body}); state.data.settings=settings; }
  render(); toast(state.preview ? 'Örnek tercih güncellendi. Gerçek bildirim gönderilmez.' : 'Bildirim tercihin kaydedildi.');
}

async function refresh(showToast = true) {
  if (state.preview) { if (showToast) toast('Örnek taslak gerçek bilgisayar bağlantısı kullanmaz.'); return; }
  if (!state.token) return;
  try { state.data = await api('/api/bootstrap'); state.connected = true; render(); if (showToast) toast('Bilgisayar bağlantısı güncel.'); }
  catch (error) { if (state.data) render(); if (showToast) toast(error.message); throw error; }
}
async function initializeSession() {
  await refresh(false);
  clearInterval(refreshTimer); refreshTimer=setInterval(()=>{if(!document.hidden && state.token && !dialog.open) refresh(false).catch(()=>{});},30000);
}
function base64Key(value) {
  const padding='='.repeat((4-value.length%4)%4); const bytes=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(bytes,c=>c.charCodeAt(0));
}
async function enablePush() {
  if (state.preview) { toast('Örnek taslak gerçek bildirim izni istemez ve bildirim göndermez.'); return; }
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) { installHelp(); return; }
  // İzin yalnız bu kullanıcı düğmesinin doğrudan tıklama yolundan istenir.
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') { toast('Bildirim izni kapalı. Tarayıcı ayarlarından açabilirsin.'); return; }
  const key = await api('/api/push/key');
  if (!key.available || !key.publicKey) { toast('Bildirim servisi henüz kurulmadı. İzin açık; bilgisayar tarafı kurulumu gerekiyor.'); render(); return; }
  const registration = serviceWorkerRegistration || await navigator.serviceWorker.ready;
  if (!registration.pushManager) throw new Error('Bu tarayıcı push bildirimini desteklemiyor.');
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64Key(key.publicKey)});
  await api('/api/push/subscribe',{method:'POST',body:{subscription:subscription.toJSON()}});
  render(); toast('Bildirim aboneliğin kuruldu. Test bildirimiyle kontrol edebilirsin.');
}

document.addEventListener('click', async event => {
  const button=event.target.closest('[data-action]'); if (!button) return; event.preventDefault();
  const {action,id}=button.dataset;
  try {
    if(action==='navigate'){state.page=button.dataset.page; render(); window.scrollTo({top:0,behavior:'instant'});}
    else if(action==='filter'){state.filter=button.dataset.filter;render();}
    else if(action==='clear-search'){state.search='';state.brand='';render();}
    else if(action==='detail')detail(id);
    else if(action==='edit-proof')editProof(id);
    else if(action==='close-dialog')dialog.close();
    else if(action==='add-opportunity')addOpportunity();
    else if(action==='add-source')addSource();
    else if(action==='op-status'){button.disabled=true;await updateStatus(id,button.dataset.status);}
    else if(action==='copy-code'){const o=state.data.opportunities.find(x=>x.id===id);try{await navigator.clipboard.writeText(o.code);toast('Kod kopyalandı.');}catch{toast('Kod kopyalanamadı. Kodu seçip telefonunun kopyalama menüsünü kullan.');}}
    else if(action==='toggle-brand'){const b=state.data.brands.find(x=>x.id===id);await updateResource('brands',id,{enabled:!b.enabled});}
    else if(action==='toggle-source'){const s=state.data.sources.find(x=>x.id===id);await updateResource('sources',id,{paused:s.state!=='paused'});}
    else if(action==='toggle-urgent')await updateSettings({urgentOnly:!state.data.settings.urgentOnly});
    else if(action==='refresh')await refresh();
    else if(action==='install-help')installHelp();
    else if(action==='install'){if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else installHelp();}
    else if(action==='enable-push'){button.disabled=true;await enablePush();}
    else if(action==='test-push'){if(state.preview){toast('Örnek taslak gerçek bildirim göndermez.');return;}button.disabled=true;const result=await api('/api/push/test',{method:'POST',body:{}});toast(result.sent ? 'Test bildirimi gönderildi. Telefonundan kontrol et.' : 'Test bildirimi gönderilemedi. Önce bu cihazda bildirim aboneliği oluştur.');}
    else if(action==='logout'){
      if(state.preview){location.assign(new URL('./',location.href).href);return;}
      let remoteOk=true;try{await api('/api/auth/logout',{method:'POST',body:{}});}catch{remoteOk=false;}
      clearPrivateState(remoteOk ? '' : 'Bu cihazdan çıkış yapıldı. Bilgisayara ulaşılamadığı için uzak oturum iptali doğrulanamadı.');
    }
  } catch(error){toast(error.message);} finally {if(button.isConnected)button.disabled=false;}
});
document.addEventListener('input',event=>{
  if(event.target.closest('#login-form'))loginInteracted=true;
  if(event.target.id==='opportunity-search'){state.search=event.target.value;document.querySelector('#opportunity-results').innerHTML=opportunityResults();}
});
document.addEventListener('change',async event=>{
  if(event.target.id==='brand-filter'){state.brand=event.target.value;render();}
  if(event.target.dataset.brandPriority){await updateResource('brands',event.target.dataset.brandPriority,{priority:event.target.value});}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!['login-form','opportunity-form','proof-form','source-form','quiet-form'].includes(form.id))return;
  event.preventDefault();const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  const values=Object.fromEntries(new FormData(form));
  const errorBox=form.querySelector('[data-form-error]');if(errorBox)errorBox.hidden=true;
  try{
    if(form.id==='login-form'){
      const result=await api('/api/auth/login',{method:'POST',body:values});state.token=result.token;state.expiresAt=result.expiresAt;tokenStorage(result.token,result.expiresAt);scheduleSessionExpiry();form.reset();if(state.token)await initializeSession();
    }else if(form.id==='opportunity-form'){
      const brand=state.data.brands.find(b=>b.name.toLocaleLowerCase('tr')===values.brand.toLocaleLowerCase('tr'));
      const opportunity={...values,platform:platformCanonical(values.platform),brandId:brand?.id || null,category:'Genel',expiresAt:values.expiresAt ? new Date(values.expiresAt).toISOString() : null};
      if(state.preview){
        if(!brand){const newBrand={id:crypto.randomUUID(),name:values.brand,priority:'normal',enabled:true};state.data.brands.push(newBrand);opportunity.brandId=newBrand.id;}
        state.data.opportunities.unshift({...opportunity,id:crypto.randomUUID(),version:1,status:'new',assignee:null,isDemo:true,sourceName:'Elle eklenen örnek',receivedAt:new Date().toISOString()});previewActivity('Elle bir örnek fırsat eklendi.');
      }else{const result=await api('/api/opportunities',{method:'POST',body:opportunity,headers:{'Idempotency-Key':form.dataset.key}});state.data.opportunities.unshift(result.opportunity);await refresh(false);}
      state.filter='new';state.search='';state.brand='';state.page='opportunities';dialog.close();render();toast(state.preview ? 'Örnek fırsat eklendi. Yenileyince örnekler sıfırlanır.' : 'Fırsat kaydedildi.');
    }else if(form.id==='proof-form'){
      const sourceUrl=new URL(values.sourceUrl);
      if(sourceUrl.protocol!=='https:'||sourceUrl.username||sourceUrl.password)throw new Error('Kaynak için giriş bilgisi içermeyen geçerli bir HTTPS bağlantısı yaz.');
      const proof={version:Number(form.dataset.version),sourceUrl:sourceUrl.href,conditions:values.conditions,audience:values.audience,confidence:values.confidence,expiresAt:values.expiresAt?new Date(values.expiresAt).toISOString():null,note:values.note};
      const id=form.dataset.id;
      if(state.preview){
        const opportunity=state.data.opportunities.find(item=>item.id===id);
        if(!opportunity||opportunity.version!==proof.version){const conflict=new Error('Bu fırsat başka bir yerde değişti.');conflict.status=409;throw conflict;}
        const next={...opportunity,...proof};
        if(['ready','published'].includes(opportunity.status)&&!publishable(next))throw new Error('Hazır veya yayınlanmış fırsatın paylaşım koşulları geçersiz olamaz. Önce durumunu yeniye al.');
        Object.assign(opportunity,proof,{version:opportunity.version+1});previewActivity('Fırsatın kontrol bilgileri elle güncellendi.');
      }else{
        const {opportunity}=await api(`/api/opportunities/${encodeURIComponent(id)}`,{method:'PATCH',body:proof});
        const index=state.data.opportunities.findIndex(item=>item.id===id);state.data.opportunities[index]=opportunity;
      }
      render();detail(id);toast(state.preview?'Örnek kontrol bilgileri güncellendi. Gerçek kaynak doğrulanmadı.':'Kontrol bilgilerin kaydedildi. Otomatik doğrulama yapılmadı.');
    }else if(form.id==='source-form'){
      values.platform=values.kind==='whatsapp_channel' ? 'whatsapp' : values.kind.startsWith('instagram') ? 'instagram' : values.kind==='telegram' ? 'telegram' : values.kind==='website' ? 'website' : 'manual';
      if(state.preview){state.data.sources.push({...values,id:crypto.randomUUID(),state:values.kind==='manual' ? 'manual_ready' : 'not_connected',method:'Henüz bağlanmadı',lastSeenAt:null});previewActivity('Kaynak listeye eklendi; gerçek bağlantı kurulmadı.');}
      else{const {source}=await api('/api/sources',{method:'POST',body:values});state.data.sources.push(source);}
      state.page='sources';dialog.close();render();toast('Kaynak listeye eklendi. Otomatik bağlantı henüz kurulmadı.');
    }else if(form.id==='quiet-form')await updateSettings(values);
  }catch(error){
    if(form.id==='proof-form'&&error.status===409){dialog.close();try{await refresh(false);}catch{}toast('Bu fırsat başka bir yerde değişti. Güncel halini yeniden açıp kontrol et.');}
    else if(form.id==='login-form'){state.loginError=error.message;renderLogin();}
    else if(errorBox){errorBox.textContent=error.message;errorBox.hidden=false;}else toast(error.message);
  }finally{if(submit.isConnected)submit.disabled=false;}
});
dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom)dialog.close();}});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('offline',()=>{state.connected=false;if(sessionExpired())clearPrivateState('Oturumunuz sona erdi. Yeniden giriş yapın.');else if(state.data)render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.token)scheduleSessionExpiry();});
window.addEventListener('online',()=>{if(state.token)refresh(false).catch(()=>{});});
window.addEventListener('pageshow',event=>{if(event.persisted && !state.preview){state.data=null;state.connected=false;renderLogin();if(state.token)initializeSession().catch(error=>{state.loginError=error.message;renderLogin();});}});
async function boot(){
  if(preview){state.config={build:'ilk taslak'};state.data=syntheticData();render();return;}
  try{const response=await fetch('./config.json',{cache:'no-store'});state.config=await response.json();state.config.apiBase=String(state.config.apiBase || '').replace(/\/$/,'');}catch{state.config={};}
  try{state.token=sessionStorage.getItem(TOKEN_KEY);state.expiresAt=sessionStorage.getItem(EXPIRES_KEY);}catch{}
  scheduleSessionExpiry();
  if(state.token){try{await initializeSession();}catch(error){state.loginError=error.message;renderLogin();}}
  else{renderLogin();try{state.health=await api('/api/health');}catch{}if(!state.token&&!state.data&&!loginInteracted)renderLogin();}
  if('serviceWorker' in navigator){try{serviceWorkerRegistration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});}catch{/* İşlevler sürer; bildirim kurulumunda destek açıklanır. */}}
}
boot();

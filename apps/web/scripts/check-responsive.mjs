// Dependency-free browser check. Uses an isolated headless Edge profile and fake API data.
// Run with Vite on 127.0.0.1:5179: node scripts/check-responsive.mjs [verified|forms|headers|keyboard]
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const stage = process.argv[2] ?? 'verified';
if (!['baseline', 'final', 'verified', 'forms', 'headers', 'keyboard', 'typing-light', 'typing-dark'].includes(stage)) throw new Error('Unknown verification stage.');
const typingStage = stage.startsWith('typing-');
const output = path.resolve(typingStage ? 'build/prompt033' : 'build/prompt031', stage);
await mkdir(output, { recursive: true });
// Keep browser caches outside Vite's watched app tree to avoid unrelated HTML reloads.
const profileRoot = path.resolve('../../build/prompt031-browser-profiles');
await mkdir(profileRoot, { recursive: true });
const profile = await mkdtemp(path.join(profileRoot, 'browser-profile-'));
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--disable-component-update',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pending = new Map();
let nextId = 0;
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

// Test fixtures only: no live API, account data or location permission is used.
const fixtureScript = `
  if (location.pathname === '/login' || location.pathname === '/register') localStorage.removeItem('geochat.web.accessToken');
  else localStorage.setItem('geochat.web.accessToken', 'visual-test-token');
  const user = { id:9, username:'mira', displayName:'Mira Nguyễn', status:'ACTIVE', createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-01-01T00:00:00Z' };
  const friend = { userId:22, username:'rowan', displayName:'Rowan Nguyễn — a long display name for responsive verification' };
  const group = { groupId:50, name:'Nhóm bạn GeoChat — planning a very long weekend conversation', owner:{userId:9, username:'mira', displayName:user.displayName}, memberCount:2, createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-10-10T10:00:00Z' };
  const conversations = [{conversationId:41,type:'DIRECT',participant:friend,updatedAt:group.updatedAt,lastMessage:'A long preview that should truncate gracefully without pushing badges or times outside the sidebar',lastMessageAt:group.updatedAt,unreadCount:5,readStateVersion:1}, {conversationId:50,type:'GROUP',participant:friend,groupName:group.name,updatedAt:group.updatedAt,lastMessage:'Hẹn gặp mọi người cuối tuần nhé!',lastMessageAt:group.updatedAt,lastMessageSender:friend.displayName,unreadCount:127,readStateVersion:1}];
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (url, options = {}) => {
    if (!String(url).includes('/api/v1/')) return originalFetch(url, options);
    const pathname = new URL(url, location.href).pathname;
    const mode = new URLSearchParams(location.search).get('visual');
    if (mode === 'loading' && pathname === '/api/v1/friends') return new Promise(() => {});
    if (mode === 'error' && pathname === '/api/v1/friends') return new Response(JSON.stringify({success:false,data:null,message:'Unable to load friends. Please try again.'}), {status:500,headers:{'Content-Type':'application/json'}});
    let data = {};
    if (pathname === '/api/v1/users/me') data = user;
    else if (pathname === '/api/v1/chats') data = {items:conversations};
    else if (pathname === '/api/v1/friends') data = {items:[friend]};
    else if (pathname.includes('/friends/requests/')) data = {items:[{requestId:71,user:friend,createdAt:group.createdAt}]};
    else if (pathname.includes('/groups/') && pathname.endsWith('/members')) data = {items:[{user:friend,role:'MEMBER',joinedAt:group.createdAt},{user:group.owner,role:'OWNER',joinedAt:group.createdAt}]};
    else if (pathname.includes('/groups/')) data = group;
    else if (pathname.endsWith('/messages')) {
      const id = pathname.includes('/50/') ? 50 : 41;
      data = {items:Array.from({length:24},(_,index)=>({messageId:index+1,conversationId:id,senderId:index%3 ? 22 : 9,content:index===23?'Tin nhắn nhiều dòng\\nNội dung tiếng Việt và đường dẫn dài https://example.com/'+ 'abcdefgh'.repeat(12):'Một tin nhắn để kiểm tra bố cục '+index,createdAt:'2026-10-10T10:00:'+String(index).padStart(2,'0')+'Z'})),total:24,page:0,size:20};
    } else if (pathname.endsWith('/presence')) data = {items:[{userId:22,online:true}]};
    else if (pathname.endsWith('/read')) data = {conversationId:pathname.includes('/50/')?50:41,unreadCount:0,readStateVersion:2};
    else if (/\\/chats\\/\\d+$/.test(pathname)) data = {conversationId:pathname.endsWith('/50')?50:41,type:pathname.endsWith('/50')?'GROUP':'DIRECT',participants:[group.owner,friend],createdAt:group.createdAt,updatedAt:group.updatedAt,limitedMessagesRemaining:null};
    else if (pathname === '/api/v1/users/search') data = {items:[{...friend,relationship:'NONE'}]};
    else if (pathname.includes('/notifications/unread-count')) data = {unreadCount:3};
    else if (pathname === '/api/v1/notifications') data = {items:[{id:1,recipientId:9,type:'NEW_MESSAGE',title:'A notification with a long title that should remain readable',message:'Bạn có tin nhắn mới từ Rowan Nguyễn. '+ 'abcdef'.repeat(20),referenceType:'MESSAGE',referenceId:1,conversationId:41,read:false,createdAt:group.updatedAt,readAt:null}],unreadCount:1,total:1,hasMore:false};
    else if (pathname.includes('/location/nearby')) data = {items:[{userId:22,displayName:friend.displayName,distanceMeters:1200}],radiusMeters:5000};
    else if (pathname.includes('/location/')) data = {latitude:0,longitude:0};
    if (mode === 'empty' && data.items) data = {...data,items:[],unreadCount:0,total:0,hasMore:false};
    return new Response(JSON.stringify({success:true,data,message:''}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(success)=>success({coords:{latitude:0,longitude:0}})}});
  window.WebSocket = class { static CONNECTING=0; static OPEN=1; static CLOSING=2; static CLOSED=3; constructor(){this.readyState=3;setTimeout(()=>this.onclose?.({}),0);} close(){this.readyState=3;} send(){} };
`;


const typingSocketScript = `
  window.__typingFrames = [];
  window.WebSocket = class {
    static CONNECTING=0; static OPEN=1; static CLOSING=2; static CLOSED=3;
    constructor(){
      this.readyState=0; this.subscriptions=new Map();
      window.__typingSocket=this;
      setTimeout(()=>{this.readyState=1;this.onopen?.({});},0);
    }
    frame(data){ this.onmessage?.({data}); }
    send(data){
      const text=String(data), lines=text.split('\\n');
      const headers=Object.fromEntries(lines.filter(line=>line.includes(':')).map(line=>[line.slice(0,line.indexOf(':')),line.slice(line.indexOf(':')+1)]));
      if(lines[0]==='CONNECT') setTimeout(()=>this.frame('CONNECTED\\nversion:1.2\\nheart-beat:0,0\\n\\n\\0'),0);
      if(lines[0]==='SUBSCRIBE') this.subscriptions.set(headers.destination,headers.id);
      if(lines[0]==='UNSUBSCRIBE') for(const [destination,id] of this.subscriptions) if(id===headers.id) this.subscriptions.delete(destination);
      if(lines[0]==='SEND' && headers.destination?.endsWith('/typing')) window.__typingFrames.push(JSON.parse(text.split('\\n\\n')[1].replace(/\\0/g,'')));
      if(lines[0]==='DISCONNECT') this.close();
    }
    close(){this.readyState=3; this.onclose?.({code:1000,reason:'fixture'});}
    emit(conversationId,senderId,senderDisplayName,state){
      const id=this.subscriptions.get('/topic/chat/'+conversationId+'/typing');
      if(id) this.frame('MESSAGE\\nsubscription:'+id+'\\nmessage-id:typing-fixture\\n\\n'+JSON.stringify({conversationId,senderId,senderDisplayName,type:'TYPING',state})+'\\0');
    }
  };
`;

try {
  let port;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await delay(100); }
  }
  if (!port) throw new Error('Headless Edge did not expose a debugging port.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((item) => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (request) { clearTimeout(request.timeout); pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
  };
  socket.onclose = () => { for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(new Error('Browser closed')); } pending.clear(); };
  await send('Page.enable');
  await send('Page.bringToFront');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: (typingStage ? `localStorage.setItem('geochat-theme','${stage.endsWith('dark') ? 'dark' : 'light'}');` : '') + fixtureScript + (typingStage ? typingSocketScript : '') });
  const results = [];
  for (const width of (stage === 'keyboard' ? [375] : typingStage ? [375, 768, 1440] : [375, 768, 1024, 1440])) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const route of (stage === 'keyboard' ? ['chat/41?visual=keyboard', 'chat/50?visual=keyboard'] : typingStage ? ['chat/41', 'chat/50'] : stage === 'forms' ? ['public/login', 'public/register', 'chat?visual=create', 'chat/50?visual=info'] : stage === 'headers' ? ['chat/41', 'chat/50'] : ['home', 'chat', 'chat/41', 'chat/50', 'friends', 'nearby', 'search', 'notifications', 'profile', 'settings', ...(width === 375 ? ['friends?visual=empty', 'friends?visual=error', 'friends?visual=loading', 'notifications?visual=empty', 'chat?visual=empty'] : [])])) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: stage === 'keyboard' ? 450 : 900, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: `http://127.0.0.1:5179/${route.startsWith('public/') ? route.slice(7) : 'app/' + route}` });
      for (let attempt = 0; attempt < 50; attempt++) {
        if (await evaluate(`!!document.querySelector('.page-heading h1, .auth-card h2') && !document.querySelector('.chat-message-area .spinner')`)) break;
        await delay(100);
      }
      if (route.includes('visual=create')) await evaluate(`document.querySelector('.sidebar-toolbar button')?.click()`);
      if (route.includes('visual=info')) await evaluate(`[...document.querySelectorAll('.chat-header button')].find(el=>el.textContent==='Group info')?.click()`);
      if (route === 'nearby') await evaluate(`document.querySelector('.nearby-intro button')?.click()`);
      if (route === 'search') await evaluate(`const input=document.querySelector('#user-search'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,'rowan');input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.search-form').requestSubmit();`);
      await delay(250);
      const typingCheck = typingStage ? await evaluate(`(() => {
        const conversationId=Number(location.pathname.split('/').pop());
        const area=document.querySelector('.chat-message-area');
        area.scrollTop=0;
        const composer=document.querySelector('.chat-composer').getBoundingClientRect();
        window.__typingGeometry={top:composer.top,height:composer.height,scroll:area.scrollTop};
        const socket=window.__typingSocket;
        socket.emit(conversationId,9,'My own account','START');
        socket.emit(conversationId,22,'Rowan with a very long display name for typing layout verification','START');
        if(conversationId===50) socket.emit(conversationId,23,'Sam with another long display name','START');
        const input=document.querySelector('#chat-message');
        input.focus();
        const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
        setter.call(input,'typing one');input.dispatchEvent(new Event('input',{bubbles:true}));
        setter.call(input,'typing two');input.dispatchEvent(new Event('input',{bubbles:true}));
        return true;
      })()`) : null;
      if (typingCheck) await delay(100);
      const result = await evaluate(`(() => {
        const rect = element => element?.getBoundingClientRect();
        const composer=rect(document.querySelector('.chat-composer'));
        const nav=rect(document.querySelector('.sidebar'));
        const controls=[...document.querySelectorAll('button,input,select,textarea,.side-nav a,.mobile-account-nav a')].filter(el => el.getBoundingClientRect().width > 0);
        const outside=controls.filter(el=>{const r=rect(el);return r.left < -1 || r.right > innerWidth+1;}).map(el=>el.textContent || el.id);
        const links=[...document.querySelectorAll('.side-nav:first-of-type a')];
        const overlapping=controls.flatMap((a,index)=>controls.slice(index+1).filter(b=>{const x=rect(a),y=rect(b);return !a.contains(b) && !b.contains(a) && Math.min(x.right,y.right)-Math.max(x.left,y.left)>2 && Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2;}).map(b=>[a.textContent.trim()||a.id,b.textContent.trim()||b.id]));
        const indicator=document.querySelector('.typing-indicator');
        const geometry=window.__typingGeometry;
        const typingOk=!geometry || (!!indicator?.textContent && !indicator.textContent.includes('My own account') && Math.abs(composer.top-geometry.top)<1 && areaScroll()===geometry.scroll && window.__typingFrames.filter(frame=>frame.state==='START').length===1);
        function areaScroll(){return document.querySelector('.chat-message-area').scrollTop;}
        return {typingOk,theme:document.documentElement.dataset.theme,typingLabel:indicator?.textContent,navigationUsable:links.every(el=>{const r=rect(el);return r.height>=44 && r.top>=0 && r.bottom<=innerHeight;}),overlapping,height:innerHeight,width:innerWidth,route:location.pathname,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth > innerWidth,controlsOutside:outside,composerVisible:!composer || (composer.top>=0 && composer.bottom<=innerHeight && (innerWidth>680 || composer.bottom<=nav.top)),navLinks:[...document.querySelectorAll('.side-nav:first-of-type a')].map(el=>({label:el.textContent.trim(),height:rect(el).height})),headerHeight:rect(document.querySelector('.chat-header'))?.height,titleWidth:rect(document.querySelector('.chat-person-details'))?.width};
      })()`);
      results.push(result);
      await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      console.log(`${width} ${route}: overflow=${result.overflow}, composerVisible=${result.composerVisible}`);
      if (['chat/50', 'chat', 'friends', 'profile', 'notifications'].includes(route) || route.includes('?visual=') || stage === 'forms' || typingStage) {
        const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(path.join(output, `${width}-${route.replace(/[^a-z0-9-]/gi, '-')}.png`), Buffer.from(screenshot.data, 'base64'));
      }
      if (typingStage) {
        await evaluate(`const id=Number(location.pathname.split('/').pop()); window.__typingSocket.emit(id,22,'Rowan','STOP'); window.__typingSocket.emit(id,23,'Sam','STOP');`);
        await delay(100);
        result.typingStopped = await evaluate(`document.querySelector('.typing-indicator').textContent === ''`);
      }
    }
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  const failures = results.filter(item=>item.overflow || item.controlsOutside.length || !item.composerVisible || !item.navigationUsable || item.overlapping.length || item.typingOk === false || item.typingStopped === false);
  console.log(JSON.stringify({ stage, pages:results.length, failures, output }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  else browser.kill();
}

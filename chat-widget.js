/* Insure With Sunny - chat widget. AI answers via /api/chat (Gemini); rule-based fallback when unavailable. */
(function(){
'use strict';
var APPS_SCRIPT='https://script.google.com/macros/s/AKfycbxEAuVTYPyy_OaRx2GzJv-KdGnxaH4asdpq6gX3IJ3IbWPbHRGHECUtGWiLbSNiaR4S3Q/exec';
var PHONE='416-606-5979';
var PHONE_HREF='tel:+14166065979';

function bizHours(){
  try{
    var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',weekday:'short',hour:'numeric',hour12:false}).formatToParts(new Date());
    var d='',h=0;
    parts.forEach(function(p){if(p.type==='weekday')d=p.value;if(p.type==='hour')h=parseInt(p.value,10);});
    if(h===24)h=0;
    return ['Mon','Tue','Wed','Thu','Fri'].indexOf(d)>-1&&h>=9&&h<17;
  }catch(e){return false;}
}
var IN_HOURS=bizHours();

/* ---------- DOM ---------- */
var root=document.createElement('div');root.id='iws-chat';
root.innerHTML=
 '<div id="iws-chat-panel" hidden>'+
  '<div class="iws-chat-header"><span class="iws-chat-statusdot'+(IN_HOURS?'':' away')+'"></span>'+
  '<div><strong>Insure With Sunny</strong><small>'+(IN_HOURS?'Online now, typically replies in minutes':'Leave a message, replies next business day')+'</small></div>'+
  '<button id="iws-chat-close" aria-label="Close chat">&times;</button></div>'+
  '<div id="iws-chat-msgs"></div><div id="iws-chat-quick"></div>'+
  '<form id="iws-chat-form"><input id="iws-chat-input" placeholder="Type your message..." autocomplete="off" maxlength="500" aria-label="Type your message">'+
  '<button id="iws-chat-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></form>'+
 '<div class="iws-chat-disclaimer">General information only. Coverage is not confirmed or bound unless specifically stated by a RIBO licensed broker.</div>'+
 '</div>'+
 '<button id="iws-chat-bubble" aria-label="Open chat"><span class="iws-dot"></span>'+
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button>';
document.body.appendChild(root);

var panel=root.querySelector('#iws-chat-panel'),
    bubble=root.querySelector('#iws-chat-bubble'),
    msgs=root.querySelector('#iws-chat-msgs'),
    quick=root.querySelector('#iws-chat-quick'),
    form=root.querySelector('#iws-chat-form'),
    input=root.querySelector('#iws-chat-input'),
    sendBtn=root.querySelector('#iws-chat-send');

var history=[];      // {role:'user'|'model', text}
var capture=null;    // lead-capture state
var aiFailed=false;  // switch to rule-based fallback

function scrollDown(){msgs.scrollTop=msgs.scrollHeight;}
function addMsg(text,who){
  var d=document.createElement('div');d.className='iws-msg '+who;d.textContent=text;
  msgs.appendChild(d);scrollDown();return d;
}
function setQuick(items){
  quick.innerHTML='';
  items.forEach(function(t){
    var b=document.createElement('button');b.type='button';b.className='iws-quick';b.textContent=t.label;
    b.onclick=function(){handleUserText(t.label,t.action||null);};
    quick.appendChild(b);
  });
  /* buttons change the panel layout after messages scrolled; re-scroll once laid out */
  requestAnimationFrame(scrollDown);
}
function typing(){var d=document.createElement('div');d.className='iws-msg bot typing';d.id='iws-typing';d.innerHTML='<span></span><span></span><span></span>';msgs.appendChild(d);scrollDown();}
function untype(){var t=document.getElementById('iws-typing');if(t)t.remove();}
function botSay(text){addMsg(text,'bot');history.push({role:'model',text:text});}

/* ---------- lead capture ---------- */
var CAPTURE_STEPS=[
  {key:'type',q:'What do you need insurance for?',opts:['Auto','Home','Business','Travel']},
  {key:'name',q:'What is your name?'},
  {key:'phone',q:'And the best phone number to reach you?'},
  {key:'email',q:'What is your email address?'}
];
function startCapture(contextMsg){
  capture={step:0,data:{message:'Website chat lead'}};
  if(contextMsg)botSay(contextMsg);
  askCaptureStep();
}
function askCaptureStep(){
  var s=CAPTURE_STEPS[capture.step];
  addMsg(s.q,'bot');history.push({role:'model',text:s.q});
  if(s.opts)setQuick(s.opts.map(function(o){return{label:o};}));
  else setQuick([]);
}
function handleCapture(text){
  var s=CAPTURE_STEPS[capture.step];
  if(s.key==='phone'&&text.replace(/\D/g,'').length<7){addMsg('Could you double-check that number? Just digits is fine.','bot');return;}
  if(s.key==='email'&&!/^\S+@\S+\.\S+$/.test(text)){addMsg('That email does not look quite right. Mind trying again?','bot');return;}
  capture.data[s.key]=text;capture.step++;
  if(capture.step<CAPTURE_STEPS.length){askCaptureStep();return;}
  setQuick([]);typing();
  fetch(APPS_SCRIPT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(capture.data)})
  .then(function(){finishCapture(true);}).catch(function(){finishCapture(false);});
}
function finishCapture(ok){
  untype();capture=null;
  if(ok)botSay(IN_HOURS?'Thanks! Your request is in and Sunny will be in touch shortly. Prefer to talk now? Call '+PHONE+'.':'Thanks! Your request is in. Sunny will get back to you next business day. For anything urgent, call '+PHONE+'.');
  else botSay('Something glitched on my end. Please call '+PHONE+' and Sunny will help you directly.');
  setQuick([{label:'Call '+PHONE,action:'call'},{label:'Ask another question',action:'ask'}]);
}

/* ---------- rule-based fallback ---------- */
var SITE_KB=[
 [/cgl|commercial general liability/i,'CGL stands for Commercial General Liability. It is the foundation of every business policy, covering bodily injury, property damage and completed operations, usually at $2M to $5M limits.'],
 [/professional liability|e ?& ?o|errors and omissions/i,'Professional liability (E&O) covers consultants, designers and service businesses against claims arising from their professional advice.'],
 [/business interruption/i,'Business interruption coverage helps with lost income and extra expenses when a claim temporarily shuts your business down.'],
 [/cyber|ransomware|data breach/i,'Cyber liability covers things like breach response, ransomware and privacy liability for businesses that hold client data.'],
 [/cargo/i,'Motor truck cargo insurance covers the freight you haul, with limits matched to what you carry: reefer, dry van, flatbed or specialized.'],
 [/\bfleet\b/i,'Fleet coverage is available for trucking and commercial vehicle fleets, with liability structured for the operation, including US exposure where needed.'],
 [/collision/i,'Collision coverage generally pays to repair or replace your vehicle after a crash, minus your deductible.'],
 [/comprehensive/i,'Comprehensive generally covers theft, vandalism, hail, falling objects and similar non-crash damage to your vehicle.'],
 [/accident benefits/i,'Accident benefits cover medical costs, attendant care and income replacement after an auto accident. Limits can be increased beyond the standard.'],
 [/uninsured motorist/i,'Uninsured motorist coverage protects you if you are hit by an uninsured or unidentified driver.'],
 [/sewer backup|overland water/i,'Water damage options like sewer backup and overland water endorsements cover the kinds of water claims Ontario homeowners actually file.'],
 [/loss assessment/i,'Loss assessment coverage protects condo owners if the condo corporation levies a special assessment after a major claim.'],
 [/trip cancellation|trip interruption/i,'Trip cancellation and interruption coverage reimburses you when illness, weather or emergencies cancel or cut short your trip.'],
 [/super visa/i,'Super Visa insurance provides emergency medical coverage for visiting parents and grandparents, meeting the Super Visa requirements.'],
 [/additional living expense/i,'Additional living expenses coverage pays for hotel and living costs if a claim forces you out of your home or rental.'],
 [/tenant liability/i,'Tenant liability covers you if you accidentally damage the building or a neighbouring unit, like a kitchen fire or an overflow.']
];
function fallbackAnswer(t){
  var lt=t.toLowerCase(),i;
  for(i=0;i<SITE_KB.length;i++){if(SITE_KB[i][0].test(t))return SITE_KB[i][1];}
  t=lt;
  if(/hour|open|close|when.*open|available/.test(t))return 'We are open Monday to Friday, 9:00 AM to 5:00 PM Eastern, and closed on weekends.';
  if(/where|location|address|mississauga|area|serve/.test(t))return 'We are based in Mississauga and serve all of Ontario.';
  if(/phone|call|number|talk|human|person|agent|broker/.test(t))return 'You can reach Sunny directly at '+PHONE+'.';
  if(/claim|accident/.test(t))return 'For claims it is best to talk to Sunny directly so nothing gets lost. Call '+PHONE+'. Want me to have him call you instead?';
  if(/price|cost|how much|cheap|expensive|rate/.test(t))return 'Every quote is different since it depends on your details. The fastest way to get your number is a quick quote. Want to start one?';
  if(/commercial|business|fleet|truck|company/.test(t))return 'Yes, commercial and business insurance is a specialty here, including commercial auto and fleets. Want a quote started?';
  if(/\bdcpd\b|direct compensation/.test(t))return 'DCPD stands for Direct Compensation for Property Damage. In Ontario, it generally means your own insurer pays for damage to your vehicle when another driver is at fault, instead of you claiming against them.';
  if(/deductible/.test(t))return 'A deductible is the amount you pay out of pocket on a claim before insurance covers the rest. Higher deductibles usually mean lower premiums.';
  if(/liability/.test(t))return 'Liability coverage generally protects you if you are found responsible for injuring someone or damaging their property.';
  if(/travel|trip|vacation|super visa/.test(t))return 'We do travel insurance, including multi-trip annual plans and Super Visa medical coverage. Want a quote?';
  if(/home|house|condo|tenant|rent/.test(t))return 'We cover home, condo, and tenant insurance. Want me to start a quote for you?';
  if(/auto|car|vehicle|drive/.test(t))return 'We shop auto insurance across many insurers to find the right fit. Want to start a quote?';
  return null;
}

/* ---------- AI ---------- */
function askAI(cb){
  var payload={messages:history.slice(-10)};
  fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
  .then(function(r){return r.json();})
  .then(function(d){cb(d&&d.reply?d.reply:null);})
  .catch(function(){cb(null);});
}

/* ---------- main flow ---------- */
function greet(){
  if(IN_HOURS)botSay('Hi there! Looking for a quote or have a question? Sunny is in the office right now, or I can take your info here.');
  else botSay('Hi there! Looking for a quote or have a question? Leave your info and Sunny will get back to you next business day.');
  setQuick([{label:'Get a quote',action:'quote'},{label:'Ask a question',action:'ask'},{label:'Call '+PHONE,action:'call'}]);
}
function handleUserText(text,action){
  if(!text)return;
  addMsg(text,'user');history.push({role:'user',text:text});setQuick([]);
  if(action==='call'){window.location.href=PHONE_HREF;botSay('Calling '+PHONE+' now.');setQuick([{label:'Get a quote',action:'quote'},{label:'Ask a question',action:'ask'}]);return;}
  if(action==='quote'){startCapture('Great, let us get that started.');return;}
  if(action==='ask'){botSay('Sure, what would you like to know?');return;}
  if(capture){handleCapture(text);return;}
  typing();
  if(aiFailed){setTimeout(function(){untype();ruleReply(text);},600);return;}
  askAI(function(reply){
    untype();
    if(reply){
      var lead=reply.indexOf('[LEAD]')>-1;
      botSay(reply.replace('[LEAD]','').trim());
      if(lead)setQuick([{label:'Yes, have Sunny contact me',action:'quote'},{label:'Not right now',action:'ask'}]);
      else setQuick([{label:'Get a quote',action:'quote'},{label:'Call '+PHONE,action:'call'}]);
    }else{aiFailed=true;ruleReply(text);}
  });
}
function ruleReply(text){
  var a=fallbackAnswer(text);
  if(a){botSay(a);setQuick([{label:'Get a quote',action:'quote'},{label:'Call '+PHONE,action:'call'}]);}
  else{botSay('I want to make sure you get the right answer, so let me have Sunny take this one personally.');
    setQuick([{label:'Yes, have Sunny contact me',action:'quote'},{label:'Ask something else',action:'ask'}]);}
}

form.addEventListener('submit',function(e){e.preventDefault();var v=input.value.trim();input.value='';if(v)handleUserText(v,null);});

/* ---------- open/close ---------- */
var opened=false;
function open(){panel.hidden=false;opened=true;try{sessionStorage.setItem('iws_chat_seen','1');}catch(e){}if(!history.length)greet();}
function close(){panel.hidden=true;}
bubble.addEventListener('click',function(){panel.hidden?open():close();});
root.querySelector('#iws-chat-close').addEventListener('click',close);
document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});

/* auto-open once per session after 20s */
setTimeout(function(){
  var seen=false;try{seen=!!sessionStorage.getItem('iws_chat_seen');}catch(e){}
  if(!seen&&!opened)open();
},20000);
})();

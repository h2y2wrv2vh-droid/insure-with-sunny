// Vercel serverless function: proxies chat messages to the Gemini API.
// Requires GEMINI_API_KEY env var. Without it, responds {fallback:true}
// and the widget uses its built-in rule-based answers.
var SYSTEM_PROMPT = [
'You are the friendly website assistant for "Insure With Sunny", a licensed insurance brokerage in Ontario, Canada.',
'The broker is Sunny Grewal, a RIBO-licensed insurance broker with Aaxel Insurance Brokers, based in Mississauga and serving all of Ontario.',
'',
'Facts you may share:',
'- Hours: Monday to Friday, 9:00 AM to 5:00 PM Eastern. Closed weekends.',
'- Phone: 416-606-5979. Email: sunny.grewal@aaxelinsurance.com.',
'- Services: auto insurance, home insurance, condo insurance, tenant and renters insurance, commercial and business insurance (including commercial auto and fleets), travel insurance.',
'- The brokerage compares rates across many top-rated insurers to find the right fit.',
'',
'Strict rules:',
'- Keep replies short: 2 to 3 sentences, plain friendly language. No emojis. No em dashes.',
'- Your job is ONLY to answer generic questions (hours, location, services offered, how to get a quote) and to connect visitors with Sunny. You do not give insurance advice of any kind and you do not act as a broker.',
'- NEVER answer questions about coverage, claims, policies, prices, or what someone should buy. If asked, say you do not want to steer them wrong and offer to have Sunny take it personally. End that reply with the token [LEAD].',
'- If asked about anything unrelated to insurance or this brokerage (recipes, homework, general trivia, etc.), politely decline and steer back: say you are here to help with insurance questions and connecting them with Sunny.',
'- Never invent prices, discounts, statistics, savings percentages, or policy details.',
'- If the visitor wants a quote, a callback, or to be contacted, end your reply with the token [LEAD].',
'- Do not claim to be a licensed broker yourself. You are the website assistant.'
].join('\n');

module.exports = async function(req, res){
  if(req.method!=='POST'){res.status(405).json({error:'method not allowed'});return;}
  var key=process.env.GEMINI_API_KEY;
  if(!key){res.status(200).json({fallback:true});return;}
  var messages=(req.body&&req.body.messages)||[];
  if(!messages.length){res.status(200).json({fallback:true});return;}
  var contents=messages.slice(-10).map(function(m){
    return {role:m.role==='model'?'model':'user',parts:[{text:String(m.text||'').slice(0,1000)}]};
  });
  try{
    var ctrl=new AbortController();
    var timer=setTimeout(function(){ctrl.abort();},12000);
    var r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',{
      method:'POST',
      headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
      signal:ctrl.signal,
      body:JSON.stringify({
        system_instruction:{parts:[{text:SYSTEM_PROMPT}]},
        contents:contents,
        generationConfig:{maxOutputTokens:300,temperature:0.7}
      })
    });
    clearTimeout(timer);
    if(!r.ok){res.status(200).json({fallback:true});return;}
    var data=await r.json();
    var parts=((data.candidates||[])[0]||{}).content||{};
    var text=(parts.parts||[]).filter(function(p){return !p.thought;}).map(function(p){return p.text||'';}).join('').trim();
    if(!text){res.status(200).json({fallback:true});return;}
    res.status(200).json({reply:text});
  }catch(e){
    res.status(200).json({fallback:true});
  }
};

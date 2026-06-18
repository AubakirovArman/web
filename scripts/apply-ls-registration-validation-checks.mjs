import pg from 'pg';
import fs from 'fs';
const ROOT='/mnt/models/NDDA_AI/8040';
const APPLY=process.argv.includes('--apply');
const ref=JSON.parse(fs.readFileSync(`${ROOT}/ls_ctd_decision78_requirements_mapping.json`,'utf8'));
const dry=JSON.parse(fs.readFileSync(`${ROOT}/web/output/clean-checks-llm-dryrun.json`,'utf8'));
const url=process.env.VLLM_URL,key=process.env.VLLM_API_KEY,model=process.env.VLLM_MODEL;
const allDocs=[...ref.documents,...(ref.reference_propagation||[]),...(ref.no_conditions||[])];
const byCode={}; for(const d of allDocs){(byCode[d.code]||=[]).push(d);}
const norm=s=>String(s||'').toLowerCase().replace(/[^a-zа-я0-9]+/gi,' ').trim();
const sim=(a,b)=>{const A=new Set(norm(a).split(' ').filter(Boolean)),B=new Set(norm(b).split(' ').filter(Boolean));if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/Math.max(A.size,B.size);};
function pickRef(code,name){const c=byCode[code]||[];if(!c.length)return null;if(c.length===1)return c[0];let b=c[0],bs=-1;for(const x of c){const s=sim(x.document_name,name);if(s>bs){bs=s;b=x;}}return b;}
function propagatedCode(code){const m=code.match(/^2\.3\.(S|P)(\..+)?$/);return m?'3.2.'+m[1]+(m[2]||''):null;}
const SYSTEM='Ты — эксперт по экспертизе регистрационного досье лекарственных средств (ЕАЭС, Решение 78). Возвращай только валидный JSON без Markdown.';
function buildPrompt(code,name,text){return `На вход дано нормативное требование к разделу регистрационного досье.
Код раздела: ${code}
Наименование документа: ${name}

Преобразуй требование в массив атомарных проверок этого документа. Строгие правила:
- каждая проверка — отдельное короткое проверяемое утверждение о СОДЕРЖАНИИ самого документа;
- включай ТОЛЬКО то, что проверяется по содержанию данного документа;
- НЕ включай: проверки других документов, ссылки на поля/разделы заявления, оплату, нотариальное заверение, доверенности, процедурные моменты;
- формулируй утвердительно: «В документе представлено/указано/описано ...»;
- сохраняй смысл и терминологию оригинала; условные оговорки («в случае если...») сохраняй внутри формулировки.
Верни строго JSON: {"checks":["...","..."]}.

Требование (Решение 78):
${String(text).slice(0,7000)}`;}
const cleanJson=t=>{const m=String(t).match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);return (m?m[1]:t).trim();};
async function callGemma(prompt,tries=4){let err='';for(let a=0;a<tries;a++){const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),90000);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:'system',content:SYSTEM},{role:'user',content:prompt}],temperature:0,max_tokens:1500}),signal:ctl.signal});clearTimeout(to);if(!r.ok){err='HTTP '+r.status;continue;}const j=await r.json();const raw=j.choices?.[0]?.message?.content||'';try{const p=JSON.parse(cleanJson(raw));const checks=(p.checks||[]).map(x=>String(x).trim()).filter(Boolean);if(checks.length)return{checks};err='no checks';}catch{err='bad json: '+raw.slice(0,120);}}catch(e){clearTimeout(to);err=e.message;}}return{checks:null,error:err};}

// retry failed
const failed=dry.items.filter(x=>x.source==='llm_failed');
for(const it of failed){
  const lc=propagatedCode(it.code)||it.code;
  const rd=pickRef(lc,it.name)||pickRef(it.code,it.name);
  const text=rd?.final_requirement_text||'';
  console.log('retry',it.code,'textlen',text.length);
  const res=await callGemma(buildPrompt(lc,it.name,text));
  if(res.checks){it.new_checks=res.checks;it.new_count=res.checks.length;it.source='decision78_llm';console.log('  OK',res.checks.length,'checks');}
  else console.log('  STILL FAILED:',res.error);
}
fs.writeFileSync(`${ROOT}/web/output/clean-checks-llm-dryrun.json`,JSON.stringify(dry,null,2));
const stillFailed=dry.items.filter(x=>x.source==='llm_failed').length;
console.log('still failed after retry:',stillFailed);

if(APPLY && stillFailed===0){
  const pool=new pg.Pool({connectionString:'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb'});
  const cl=await pool.connect();
  try{await cl.query('BEGIN');for(const it of dry.items){await cl.query('UPDATE document_requirement_rules SET validation_checks=$1::jsonb,updated_at=now() WHERE id=$2',[JSON.stringify(it.new_checks),it.id]);}await cl.query('COMMIT');console.log('APPLIED to',dry.items.length,'rules');}
  catch(e){await cl.query('ROLLBACK');console.error('ROLLBACK',e.message);}finally{cl.release();await pool.end();}
}

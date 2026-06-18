import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';
const ROOT='/mnt/models/NDDA_AI/8040';
const APPLY=process.argv.includes('--apply');
const LIMIT=(()=>{const i=process.argv.indexOf('--limit');return i>0?parseInt(process.argv[i+1]):0;})();
const ref=JSON.parse(fs.readFileSync(`${ROOT}/ls_ctd_decision78_requirements_mapping.json`,'utf8'));
const url=process.env.VLLM_URL,key=process.env.VLLM_API_KEY,model=process.env.VLLM_MODEL;

const allDocs=[...ref.documents,...(ref.reference_propagation||[]),...(ref.no_conditions||[])];
const byCode={}; for(const d of allDocs){(byCode[d.code]||=[]).push(d);}
const norm=s=>String(s||'').toLowerCase().replace(/[^a-zа-я0-9]+/gi,' ').trim();
const sim=(a,b)=>{const A=new Set(norm(a).split(' ').filter(Boolean)),B=new Set(norm(b).split(' ').filter(Boolean));if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/Math.max(A.size,B.size);};
function pickRef(code,name){const c=byCode[code]||[];if(!c.length)return null;if(c.length===1)return c[0];let b=c[0],bs=-1;for(const x of c){const s=sim(x.document_name,name);if(s>bs){bs=s;b=x;}}return b;}
function propagatedCode(code){const m=code.match(/^2\.3\.(S|P)(\..+)?$/);return m?'3.2.'+m[1]+(m[2]||''):null;}

const SYSTEM='Ты — эксперт по экспертизе регистрационного досье лекарственных средств (ЕАЭС, Решение 78). Возвращай только валидный JSON без Markdown.';
function buildPrompt(code,name,text){
  return `На вход дано нормативное требование к разделу регистрационного досье.
Код раздела: ${code}
Наименование документа: ${name}

Преобразуй требование в массив атомарных проверок этого документа. Строгие правила:
- каждая проверка — отдельное короткое проверяемое утверждение о СОДЕРЖАНИИ самого документа (что в нём должно присутствовать/быть указано/описано);
- включай ТОЛЬКО то, что проверяется по содержанию данного документа;
- НЕ включай: проверки других документов, ссылки на поля/разделы заявления, оплату экспертизы, нотариальное заверение/апостиль, доверенности, сопроводительные письма, процедурные и организационные моменты;
- формулируй утвердительно: «В документе представлено/указано/описано ...»;
- сохраняй смысл и терминологию оригинала, ничего не добавляй от себя;
- если в требовании есть условные части («в случае если...»), сохраняй условие внутри формулировки проверки.
Верни строго JSON: {"checks":["...","..."]}.

Требование (Решение 78):
${String(text).slice(0,7000)}`;
}
function cleanJson(t){const m=String(t).match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);return (m?m[1]:t).trim();}
async function callGemma(prompt,tries=2){
  let err='';
  for(let a=0;a<tries;a++){
    const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),60000);
    try{
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
        body:JSON.stringify({model,messages:[{role:'system',content:SYSTEM},{role:'user',content:prompt}],temperature:0,max_tokens:1200}),signal:ctl.signal});
      clearTimeout(to);
      if(!r.ok){err='HTTP '+r.status;continue;}
      const j=await r.json();const raw=j.choices?.[0]?.message?.content||'';
      try{const p=JSON.parse(cleanJson(raw));const checks=(p.checks||p.проверки||[]).map(x=>String(x).trim()).filter(Boolean);if(checks.length)return{checks,raw};err='no checks';}
      catch{err='bad json';}
    }catch(e){clearTimeout(to);err=e.message;}
  }
  return{checks:null,raw:'',error:err};
}

const pool=new pg.Pool({connectionString:'postgresql://ndda_reference@127.0.0.1:55440/ndda_reference_kb'});
let {rows}=await pool.query(`SELECT id,doc_code,document_name,required_document,validation_checks FROM document_requirement_rules ORDER BY doc_code,id`);
if(LIMIT) rows=rows.slice(0,LIMIT);

// resolve source text per rule
for(const r of rows){
  const lc=propagatedCode(r.doc_code)||r.doc_code;
  r._refDoc=pickRef(lc,r.document_name)||pickRef(r.doc_code,r.document_name);
  r._finalText=r._refDoc?.final_requirement_text||'';
  r._lookup=lc;
  r._cacheKey=crypto.createHash('md5').update(lc+'|'+r._finalText).digest('hex');
}
// unique texts to call
const cache=new Map();
const jobs=[...new Set(rows.filter(r=>r._finalText.trim()).map(r=>r._cacheKey))]
  .map(k=>{const r=rows.find(x=>x._cacheKey===k);return{key:k,code:r._lookup,name:r.document_name,text:r._finalText};});
console.log('rules:',rows.length,'| unique LLM jobs:',jobs.length);

let done=0;const CONC=5;
async function worker(q){while(q.length){const job=q.shift();const res=await callGemma(buildPrompt(job.code,job.name,job.text));cache.set(job.key,res);done++;if(done%15===0||done===jobs.length)console.log('  llm',done+'/'+jobs.length);}}
const queue=[...jobs];
await Promise.all(Array.from({length:CONC},()=>worker(queue)));

// build report+updates
const report=[],updates=[];let llmFail=0,fb=0;
for(const r of rows){
  let checks=null,src='';
  if(r._finalText.trim()){const c=cache.get(r._cacheKey);if(c?.checks){checks=c.checks;src='decision78_llm';}else{llmFail++;src='llm_failed';}}
  if(!checks){
    const rd=(r.required_document||r.document_name||'').replace(/\s+/g,' ').trim();
    checks=[`В документе представлены сведения, соответствующие наименованию раздела: ${rd}`];
    if(src!=='llm_failed'){src='fallback_no_d78';fb++;}
  }
  const old=Array.isArray(r.validation_checks)?r.validation_checks:[];
  report.push({id:r.id,code:r.doc_code,name:r.document_name,propagated_from:(r._lookup!==r.doc_code)?r._lookup:null,ref_used:r._refDoc?.code_instance||null,source:src,old_count:old.length,new_count:checks.length,old_checks:old,new_checks:checks});
  updates.push({id:r.id,checks});
}
fs.writeFileSync(`${ROOT}/web/output/clean-checks-llm-dryrun.json`,JSON.stringify({generated_at:new Date().toISOString(),model,total:report.length,llm_failed:llmFail,fallback:fb,items:report},null,2));
console.log('DONE. llm_failed:',llmFail,'fallback:',fb,'avg checks:',(report.reduce((a,x)=>a+x.new_count,0)/report.length).toFixed(1));

if(APPLY && llmFail===0){
  const cl=await pool.connect();
  try{await cl.query('BEGIN');for(const u of updates){await cl.query('UPDATE document_requirement_rules SET validation_checks=$1::jsonb,updated_at=now() WHERE id=$2',[JSON.stringify(u.checks),u.id]);}await cl.query('COMMIT');console.log('APPLIED',updates.length);}
  catch(e){await cl.query('ROLLBACK');console.error('ROLLBACK',e.message);}finally{cl.release();}
}else if(APPLY){console.log('NOT APPLIED: llm_failed>0, fix first');}
await pool.end();

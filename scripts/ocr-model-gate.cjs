'use strict';
// Fail closed: training completion alone never authorizes production activation.
// This check is read-only; it neither changes the default nor builds an installer.
const fs=require('node:fs'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function evaluate(report,training,manifest,modelBytes,manifestBytes){
 const reasons=[];
 const reject=reason=>{if(!reasons.includes(reason))reasons.push(reason);};
 if(report?.mode!=='paired'||report?.holdoutCount!==100||manifest?.cases?.length!==100)reject('Exactly 100 paired measurement tests are required');
 if(training?.kind!=='Tesseract-LSTM-finetune'||training?.holdoutLinesUsedForTraining!==0)reject('Model training provenance is missing or includes test data');
 // Compare original file bytes: Python and JS serialize floats differently.
 // Re-serializing parsed JSON can falsely report a changed dataset.
 if(!Buffer.isBuffer(manifestBytes)||report?.holdoutSha256!==training?.holdoutManifestSha256||report?.holdoutSha256!==hash(manifestBytes))reject('Training and evaluation use different test revisions');
 try{if(JSON.stringify(JSON.parse(manifestBytes))!==JSON.stringify(manifest))reject('Manifest object does not match the hashed file');}catch{reject('Invalid manifest file');}
 if(!Buffer.isBuffer(modelBytes)||hash(modelBytes)!==report?.modelHashes?.candidate||hash(modelBytes)!==training?.gzipSha256)reject('Evaluated model does not match the trained artifact');
 if(!report?.sourceHashes||Object.keys(report.sourceHashes).length<6)reject('Tested source revision is missing');
 if(!Array.isArray(report?.blockedRequests)||report.blockedRequests.length)reject('Offline-only test failed');
 const rows=report?.rows||[],ids=new Set(),families=new Set();let before=0,after=0,unreviewedBefore=0,unreviewedAfter=0;
 for(const c of manifest?.cases||[]){
  if(ids.has(c.id))reject('Duplicate measurement IDs');ids.add(c.id);families.add(c.family);
  const pair=rows.filter(r=>r.id===c.id),b=pair.filter(r=>r.variant==='baseline'),a=pair.filter(r=>r.variant==='candidate');
  if(b.length!==1||a.length!==1){reject('Incomplete or duplicate paired results');continue;}
  for(const r of [b[0],a[0]])if(!Array.isArray(r.failures)||r.ok!==(r.failures.length===0)||!Number.isFinite(r.ocrMs)||r.ocrMs<=0)reject('Invalid result or timing');
  before+=Number(b[0].ok);after+=Number(a[0].ok);
  unreviewedBefore+=Number(!b[0].ok&&!b[0].needsReview);unreviewedAfter+=Number(!a[0].ok&&!a[0].needsReview);
  if(b[0].ok&&!a[0].ok)reject('Previously correct measurements regressed');
 }
 if(ids.size!==100||rows.length!==200||families.size!==16)reject('Coverage must contain all 16 characteristic types and 200 paired reads');
 if(after<=before)reject('No net exact-measurement improvement');
 if(unreviewedAfter>unreviewedBefore)reject('Unflagged incorrect readings increased');
 for(const key of ['meanMs','medianMs','p95Ms']){
  const b=report?.summaries?.baseline?.[key],a=report?.summaries?.candidate?.[key];
  if(!Number.isFinite(b)||!Number.isFinite(a)||a>b)reject('Reading latency increased or timing is missing');
 }
 if(!Number.isFinite(report?.coldStartMs?.candidate)||!Number.isFinite(report?.coldStartMs?.baseline)||report.coldStartMs.candidate>report.coldStartMs.baseline)reject('Cold-start latency increased or timing is missing');
 return{allowed:!reasons.length,baselineExact:before,candidateExact:after,reasons};
}
module.exports={evaluate};
if(require.main===module){
 try{
  const [r,t,m,model]=process.argv.slice(2);if(!model)throw Error('Usage: node scripts/ocr-model-gate.cjs <report> <training-report> <holdout-manifest> <model.gz>');
  const manifestBytes=fs.readFileSync(m),result=evaluate(JSON.parse(fs.readFileSync(r)),JSON.parse(fs.readFileSync(t)),JSON.parse(manifestBytes),fs.readFileSync(model),manifestBytes);
  console.log(JSON.stringify(result,null,2));if(!result.allowed)process.exitCode=2;
 }catch(error){console.error(error.message);process.exitCode=1;}
}

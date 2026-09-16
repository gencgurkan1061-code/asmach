// One strongly consistent object per license. Caller is the authenticated Worker.
export class LicenseActivation {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){const b=await request.json();return this.ctx.storage.transaction(async tx=>{
  if(b.action==='ack'){
   // Receipt signature and device proof have already been checked by the Worker.
   // Keep this small record separate from the entitlement; never rewrite the grant.
   const old=await tx.get('seen'),s=b.receipt;
   const priority={active:0,inactive:1,revoked:2};
   if(!old||s.issuedAt>old.checkedAt&&(s.status!==old.status||s.appVersion!==old.appVersion||s.issuedAt-old.checkedAt>=300)||s.issuedAt===old.checkedAt&&priority[s.status]>priority[old.status]){
    await tx.put('seen',{checkedAt:s.issuedAt,status:s.status,deviceId:s.deviceId,appVersion:s.appVersion||'',platform:s.platform||'',arch:s.arch||'',updateChannel:s.updateChannel||''});
   }
   return Response.json({ok:true});
  }
  let r=await tx.get('record');
  if(b.action==='detail')return Response.json({record:r||null,lastCheck:await tx.get('seen')||null});
  if(b.action==='publish'){
   if(r?.revoked)return Response.json({error:'Revoked'},{status:409});
   if(r&&(r.keyHash!==b.keyHash||r.revision>b.revision||r.revision===b.revision&&r.envelope.payload!==b.envelope.payload))return Response.json({error:'Revision conflict'},{status:409});
   r={...r,keyHash:b.keyHash,revision:b.revision,envelope:b.envelope,kvRevocationChecked:true};await tx.put('record',r);
  }else if(b.action==='revoke'){r={...r,revoked:true};await tx.put('record',r);}
  else if(b.action==='migrate-revocation'){
   if(!r?.envelope)return Response.json({error:'Missing grant'},{status:409});
   // Old KV-only revocations are imported once; never clear a concurrent revocation.
   r={...r,revoked:!!r.revoked||!!b.revoked,kvRevocationChecked:true};await tx.put('record',r);
  }
  else if(b.action==='claim'){
   const claims=r?.envelope?JSON.parse(atob(r.envelope.payload)):null,now=Math.floor(Date.now()/1000);
   if(!r||r.revoked||r.keyHash!==b.keyHash||!claims||claims.expiresAt<=now||claims.notBefore>now)return Response.json({error:'License unavailable'},{status:403});
   if(r.deviceId&&r.deviceId!==b.deviceId)return Response.json({error:'Already activated on another device'},{status:409});
   if(r.deviceId&&r.binding&&r.binding!==b.binding)return Response.json({error:'Activation binding changed'},{status:409});
   if(r.deviceId&&r.publicKey&&r.publicKey!==b.publicKey)return Response.json({error:'Activation key changed'},{status:409});
   if(!r.deviceId){r.deviceId=b.deviceId;r.binding=b.binding;r.publicKey=b.publicKey;r.activatedAt=now;await tx.put('record',r);}
   else if(!r.binding||!r.publicKey){
    // The previous Worker stored only deviceId. The Worker already verified a
    // signature from the key whose public-key hash equals that same deviceId.
    r={...r,binding:b.binding,publicKey:b.publicKey};await tx.put('record',r);
   }
  }
  else if(b.action==='enable-offline'){
   if(!r?.deviceId||r.deviceId!==b.deviceId||r.binding!=='software-cng-v1'||r.revoked)return Response.json({error:'Activation unavailable'},{status:403});
   if(r.tpmDeviceId&&r.tpmDeviceId!==b.tpmDeviceId)return Response.json({error:'Offline device already bound'},{status:409});
   r={...r,tpmDeviceId:b.tpmDeviceId,tpmPublicKey:b.tpmPublicKey,offlineUntil:b.offlineUntil,lastTpmCheck:b.checkedAt};await tx.put('record',r);
  }
  else if(b.action==='renew-offline'){
   if(!r?.deviceId||r.revoked||r.tpmDeviceId&&r.tpmDeviceId!==b.tpmDeviceId||!r.tpmDeviceId&&(r.binding||'tpm-cng-v1')!=='tpm-cng-v1'||!r.tpmDeviceId&&r.deviceId!==b.tpmDeviceId)return Response.json({error:'Offline device unavailable'},{status:403});
   r={...r,tpmDeviceId:b.tpmDeviceId,offlineUntil:b.offlineUntil,lastTpmCheck:b.checkedAt};await tx.put('record',r);
  }
  return Response.json(r||null);
 });}
}

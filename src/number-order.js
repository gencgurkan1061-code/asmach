/* Balloon labels are hierarchical identifiers, never decimal measurements. */
(function(root){
 'use strict';
 const collator=new Intl.Collator('tr',{numeric:true,sensitivity:'base'});
 function compare(a,b){
  a=String(a??'').trim();b=String(b??'').trim();
  if(!a||!b)return a? -1:b?1:0;
  if(/^\d+(?:\.\d+)*$/.test(a)&&/^\d+(?:\.\d+)*$/.test(b)){
   const left=a.split('.'),right=b.split('.');
   for(let i=0;i<Math.min(left.length,right.length);i++){
    const x=left[i].replace(/^0+(?=\d)/,''),y=right[i].replace(/^0+(?=\d)/,'');
    if(x.length!==y.length)return x.length-y.length;
    if(x!==y)return x<y?-1:1;
   }
   return left.length-right.length;
  }
  return collator.compare(a,b);
 }
 const records=(a,b)=>compare(a.number,b.number)||(Number(a.page)||0)-(Number(b.page)||0);
 root.ASMachNumberOrder={compare,records};
})(window);

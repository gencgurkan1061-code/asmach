const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const dialogs=[];
  function element(tag){return{tag,children:[],style:{},events:{},append(...items){this.children.push(...items);},setAttribute(){},addEventListener(name,fn){this.events[name]=fn;},showModal(){dialogs.push(this);},close(){this.events.close();},remove(){this.removed=true;}};}
  const context={window:{},document:{createElement:element,body:element('body')}};
  vm.runInNewContext(fs.readFileSync('src/balloon-numbering.js','utf8'),context);
  const click=(index)=>dialogs.at(-1).children[1].children[1].children[index].onclick();
  return{api:context.window.ASMachBalloonNumbering,dialogs,click};
}
const records=()=>[{id:'a',number:'1',page:2,nominalValue:'20'},{id:'b',number:'3',page:1,nominalValue:'27.3'},{id:'c',number:'4',page:1}];
test('New labels always fill the first positive gap, including leading-zero labels without confusing custom labels',()=>{
  const {api}=fixture(),rows=records();assert.equal(api.next(rows),'2');rows.push({id:'d',number:api.next(rows)});assert.equal(api.next(rows),'5');
  assert.equal(api.next([{number:'01'},{number:'3'},{number:'2-A'},{number:'0'}]),'2');assert.equal(api.next([]),'1');
  assert.equal(api.next([{number:'1'},{number:'2'},{number:'9007199254740993'}]),'3');
});
test('Rename plans preserve records until applied; swap and relocation change labels only',()=>{
  const {api}=fixture();for(const action of ['swap','relocate']){
    const rows=records(),before=JSON.stringify(rows),p=api.plan(rows,'a','3',action);
    assert.equal(JSON.stringify(rows),before);assert.equal(api.apply(rows,p),true);
    assert.equal(rows[0].number,'3');assert.equal(rows[1].number,action==='swap'?'1':'2');
    assert.equal(rows[0].nominalValue,'20');assert.equal(rows[1].nominalValue,'27.3');assert.equal(rows[2].number,'4');
  }
  const rows=records();assert.equal(api.plan(rows,'a','03').conflict.id,'b');
  assert.ok(api.plan(rows,'a',' ').error);assert.ok(api.plan(rows,'gone','1').error);
  const p=api.plan(rows,'a','8');rows[1].number='8';assert.equal(api.apply(rows,p),false);assert.equal(rows[0].number,'1');
});
test('Conflict prompt supports swap, first-gap relocation and cancel; rejects stale document responses',async()=>{
  for(const [button,expected] of [[0,'1'],[1,'2'],[2,null]]){
    const f=fixture(),state={annotations:records()},before=JSON.stringify(state.annotations);
    const promise=f.api.resolve(state,'a','3');assert.equal(f.dialogs.length,1);f.click(button);const p=await promise;
    assert.equal(JSON.stringify(state.annotations),before);
    if(expected===null)assert.equal(p,null);else{assert.equal(f.api.apply(state.annotations,p),true);assert.equal(state.annotations[1].number,expected);}
  }
  const f=fixture(),state={annotations:records()},promise=f.api.resolve(state,'a','3');state.annotations=records();f.click(0);assert.ok((await promise).error);
  const empty=f.api.afterDelete();f.dialogs.at(-1).close();assert.equal(await empty,null,'Escape / close cancels deletion');
});
test('Compact numbering preserves current numeric order across pages and leaves identity / positions intact',()=>{
  const {api}=fixture(),rows=[{id:'b',number:'10',page:1,anchorX:.3},{id:'a',number:'3',page:2,anchorX:.8}],before=JSON.stringify(rows);
  const changes=api.compact(rows);assert.equal(changes[0].id,'a');assert.equal(changes[0].number,'1');assert.equal(changes[1].number,'2');
  assert.equal(JSON.stringify(rows),before);
});

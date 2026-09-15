(function(root){
  'use strict';
  function attach(panel,controls,doc=document,win=window){
    let opened=false,pinned=false,expanded=false,inside=false,keyboard=false,keyFocus=false,editing=false,suppressed=false,timer;
    const setClass=(name,on)=>panel.classList[on?'add':'remove'](name);
    const contains=node=>Boolean(node&&panel.contains?.(node));
    function render(){
      const workspace=doc.querySelector?.('.workspace');
      if(workspace&&doc.body){
        const target=pinned&&!expanded?workspace:doc.body;
        if(panel.parentElement!==target)target.append(panel);
        workspace.classList.toggle('acui-dashboard',pinned);
        workspace.classList.toggle('acui-dashboard-expanded',false);
      }
      setClass('acui-open',opened||pinned||expanded);setClass('acui-pinned',pinned);setClass('acui-expanded',expanded);
      controls.toggle.setAttribute('aria-expanded',String(opened||pinned||expanded));
      controls.pin.setAttribute('aria-pressed',String(pinned));controls.pin.textContent=pinned?'Sabit ✓':'Sabitle';
      for(const button of controls.expand){button.textContent=expanded?'Küçült ↙':'Genişlet ↗';button.setAttribute('aria-expanded',String(expanded));}
    }
    function close(){clearTimeout(timer);opened=pinned=expanded=keyFocus=editing=false;suppressed=inside;if(contains(doc.activeElement))doc.activeElement.blur?.();render();}
    function leave(){inside=false;suppressed=false;clearTimeout(timer);timer=setTimeout(()=>{if(!inside&&!pinned&&!expanded&&!keyFocus&&!editing){opened=false;render();}},220);}
    panel.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;inside=true;clearTimeout(timer);if(!suppressed){opened=true;render();}});
    panel.addEventListener('pointerleave',leave);
    panel.addEventListener('focusin',e=>{keyFocus=keyboard;editing=e.target.matches?.('input[type=text],input[type=number],input[type=search],input:not([type]),textarea')||false;if(keyFocus){opened=true;render();}});
    panel.addEventListener('focusout',()=>{editing=keyFocus=false;if(!inside)leave();});
    panel.addEventListener('change',()=>{editing=false;if(!inside)leave();});
    controls.toggle.addEventListener('click',()=>{if(opened||pinned||expanded)close();else{suppressed=false;opened=true;render();}});
    controls.pin.addEventListener('click',()=>{pinned=!pinned;opened=true;render();});
    controls.close.addEventListener('click',close);
    for(const button of controls.expand)button.addEventListener('click',()=>{expanded=!expanded;opened=true;render();});
    doc.addEventListener?.('pointerdown',e=>{keyboard=false;keyFocus=false;if(!contains(e.target)){inside=false;if(!pinned)close();}},true);
    doc.addEventListener?.('keydown',e=>{if(e.target.closest?.('.acui-cell-dialog'))return;if(e.key==='Tab')keyboard=true;if(e.key==='Escape'&&(opened||pinned||expanded)&&!e.target.matches?.('.acui-inline-input')&&!doc.querySelector('dialog[open]')){close();e.stopPropagation();}},true);
    // Recover from missed pointerleave events after window switches or layout changes.
    doc.addEventListener?.('pointermove',e=>{if(!inside||!opened||expanded||e.pointerType==='touch')return;const b=panel.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)leave();},true);
    win.addEventListener?.('blur',()=>{inside=false;editing=keyFocus=false;if(!pinned&&!expanded)close();});
    doc.addEventListener?.('visibilitychange',()=>{if(doc.hidden)close();});
    render();return {close,getState:()=>({opened,pinned,expanded})};
  }
  root.ASMachCharacteristicDock={attach};
})(window);

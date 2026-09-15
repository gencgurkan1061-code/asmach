/* Shared viewport and stacking contract for every application dialog. */
(function(root){
  'use strict';
  const css=`
    :is(.modal,.wf-dialog){box-sizing:border-box;padding:12px!important;overflow:auto;overscroll-behavior:contain}
    .modal{z-index:6000!important}.wf-dialog{z-index:5900!important}
    #confirmModal{z-index:6500!important}.busy,.busy-overlay{z-index:6800!important}.toast-stack{z-index:7000!important}
    :is(.modal-card,.wf-card,dialog.asmach-modal){box-sizing:border-box;min-width:0;min-height:0;max-width:calc(100vw - 24px)!important;max-height:calc(100vh - 24px)!important;max-height:calc(100dvh - 24px)!important;overflow:auto}
    :is(.modal-card,.wf-card),dialog.asmach-modal[open]{display:flex;flex-direction:column}
    dialog.asmach-modal{margin:auto}
    :is(.modal-card,.wf-card,dialog.asmach-modal) *{box-sizing:border-box}
    :is(.modal-head,.modal-actions,.wf-head,.wf-foot,.acui-head,.acui-foot){flex-shrink:0!important;min-width:0;overflow-wrap:anywhere}
    :is(.modal-body,.wf-body,.acui-content){flex:1 1 auto;min-height:0!important;min-width:0;max-height:none!important;overflow:auto;overscroll-behavior:contain}
    :is(.modal-actions,.wf-foot,.acui-foot){flex-wrap:wrap!important;gap:8px;max-height:40vh;max-height:40dvh;overflow:auto}
    :is(.wf-head,.acui-head){flex-wrap:wrap}
    :is(.modal,.wf-dialog,dialog.asmach-modal) :is(input,select,textarea){min-width:0;max-width:100%}
    :is(.modal,.wf-dialog,dialog.asmach-modal) .btn{max-width:100%;white-space:normal;overflow-wrap:anywhere;flex-shrink:0}
    :is(.modal,.wf-dialog,dialog.asmach-modal) [hidden]{display:none!important}
    .modal-card>[data-pages]{min-height:0!important;flex:1 1 auto!important;overscroll-behavior:contain}
    .modal-card>[data-pages]+.modal-actions{padding-top:10px}
    dialog.asmach-modal:has(#candidatePreviewCanvas)>div:first-child{flex-shrink:0;min-width:0;max-height:32dvh;overflow:auto}
    #candidatePreviewTitle{min-width:0;overflow-wrap:anywhere}
    #candidatePreviewImage,#candidatePreviewEditing{flex:1 1 auto;min-height:0;max-height:none!important;overscroll-behavior:contain}
    #candidatePreviewHint{flex-shrink:0;max-height:18dvh;overflow:auto;margin-bottom:0}
    .bulk-plan-dialog{padding:16px!important}
    #bulkPlanForm{min-height:0;overflow:auto;overscroll-behavior:contain}
    #bulkPlanForm>div:last-child{position:sticky;bottom:0;background:white;flex-wrap:wrap;padding:10px 0 0}
    @media(max-width:680px){
      :is(.modal-head,.wf-head,.acui-head){padding:10px 12px!important}
      :is(.modal-body,.wf-body,.acui-content){padding:10px!important}
      :is(.modal-actions,.wf-foot,.acui-foot){padding:8px 10px!important}
      .method-grid,.ocr-review-grid,.acui-editor-layout{grid-template-columns:minmax(0,1fr)!important}
      .acui-editor-aside{grid-template-columns:minmax(0,1fr)!important}
      .wf-foot label{flex:1 1 125px;min-width:0}.wf-foot input,.wf-foot select{width:100%}
      .wf-head .btn,.acui-head button{margin-left:auto}
    }
    @media(max-height:500px){
      :is(.modal-head,.wf-head,.acui-head){padding:7px 10px!important}
      :is(.modal-actions,.wf-foot,.acui-foot){padding:7px 10px!important}
      .modal-head small,.acui-eyebrow{margin-bottom:0}
      .snapshot-stage{height:180px!important}
    }
  `;
  function mount(){if(document.getElementById('asmach-modal-layout-style'))return;const style=document.createElement('style');style.id='asmach-modal-layout-style';style.textContent=css;document.head.append(style);}
  root.ASMachModalLayout={mount,css};
})(window);


(() => {
  const get=id=>document.getElementById(id);
  const state={ready:false,failed:false,started:performance.now(),phase:'boot',events:[]};
  document.documentElement.classList.add('js-enabled');
  const note=(phase,detail)=>{state.phase=phase;state.events.push({phase,detail,t:Math.round(performance.now()-state.started)});if(state.events.length>100)state.events.shift();};
  function progress(title,detail,ratio){
    if(state.failed)return;
    get('bootTitle').textContent=title||'Tiles Mother';get('bootDetail').textContent=detail||'';
    if(Number.isFinite(ratio))get('bootBar').style.width=Math.max(2,Math.min(100,ratio*100))+'%';
    get('runStatus').textContent=detail||title;note('progress',title);
  }
  function show(title,detail){
    get('boot').classList.remove('ready');get('boot').classList.add('failed');
    get('bootTitle').textContent=title;get('bootDetail').textContent=detail;
  }
  function fail(error){
    state.ready=false;state.failed=true;note('failed',String(error?.message||error));
    show('三维运行已暂停', '保留参数与静态快照。'+String(error?.message||error||'未知错误').slice(0,240));
    get('runStatus').textContent='三维未运行，请重试或查看诊断';
  }
  function ready(meta={}){
    state.ready=true;state.failed=false;note('ready',meta.detail||'');
    get('boot').classList.remove('failed');get('boot').classList.add('ready');
    get('runStatus').textContent=meta.detail||'三维已运行';
  }
  function recover(){state.failed=false;state.ready=false;get('boot').classList.remove('failed');note('recovering','');}
  window.__tilesBoot={state,progress,fail,ready,recover};
  get('bootRetry').onclick=()=>{if(window.TilesMotherV082Workbench)window.TilesMotherV082Workbench.retry();else location.reload();};
  get('bootAction').onclick=()=>{get('boot').classList.toggle('poster-only');};
  get('bootDiagnostic').onclick=()=>{
    const data=window.TilesMotherV082Workbench?.getHealth?.()||{boot:state,userAgent:navigator.userAgent,protocol:location.protocol};
    get('bootDetails').hidden=!get('bootDetails').hidden;get('bootDetails').textContent=JSON.stringify(data,null,2);
  };
  window.addEventListener('error',e=>fail(e.error||e.message));
  window.addEventListener('unhandledrejection',e=>{if(e.reason?.name!=='AbortError')fail(e.reason);});
  setTimeout(()=>{if(!state.ready&&!state.failed)fail(Error('启动超过20秒。此处显示静态快照；尚未取得可用三维首帧。'));},20000);
})();

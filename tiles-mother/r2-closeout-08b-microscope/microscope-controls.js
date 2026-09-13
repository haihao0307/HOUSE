const MIC_DEFAULTS=Object.freeze({micStrength:1,micScale:1,micColor:.30,micRough:.30});
const micIds=Object.keys(MIC_DEFAULTS);
let lastMicStrength=1;
function refreshMicroscope(){
 for(const key of micIds){const value=settings[key];$('#'+key).value=value;$('#'+key+'Val').textContent=value.toFixed(2)+(key==='micStrength'||key==='micScale'?'×':'');}
 $('#micToggle').textContent=settings.micStrength>0?'起伏：开':'起伏：关';
 $('#micToggle').setAttribute('aria-pressed',String(settings.micStrength>0));
 $('#micValues').textContent=`起伏 ${settings.micStrength.toFixed(2)} / 尺度 ${settings.micScale.toFixed(2)} / 色差 ${settings.micColor.toFixed(2)} / 粗糙 ${settings.micRough.toFixed(2)}`;
}
function initMicroscopeControls(){
 for(const key of micIds){$('#'+key).addEventListener('input',e=>{option(key,Number(e.target.value));refreshMicroscope();});}
 $('#micToggle').onclick=()=>{if(settings.micStrength>0){lastMicStrength=settings.micStrength;option('micStrength',0);}else option('micStrength',lastMicStrength||1);refreshMicroscope();};
 $('#micReset').onclick=()=>{for(const [k,v] of Object.entries(MIC_DEFAULTS))option(k,v);lastMicStrength=1;refreshMicroscope();};
 $('#micCopy').onclick=async()=>{const text=$('#micValues').textContent;try{await navigator.clipboard.writeText('Tiles 08B · '+text);$('#micCopy').textContent='已复制';}catch(e){const s=getSelection(),r=document.createRange();r.selectNodeContents($('#micValues'));s.removeAllRanges();s.addRange(r);$('#micCopy').textContent='数值已选中';}setTimeout(()=>$('#micCopy').textContent='复制数值',1800);};
 refreshMicroscope();
}

const demoSteps=[
{label:'三模型总览',section:'evidenceSection',fn:()=>setSyncView('overview'),ms:4500},
{label:'聚焦屋顶错落',section:'evidenceSection',fn:()=>setSyncView('roof'),ms:4000},
{label:'屋面群分层爆炸',section:'roofRelationSection',fn:()=>{state.roofRelation.mode='explode';syncRoofModeButtons();drawRoofRelation()},ms:4500},
{label:'板瓦、筒瓦与水流',section:'roofToolSection',fn:()=>{state.tile.mode='water';syncTileModeButtons();drawTile()},ms:4500},
{label:'人物入户并上二楼',section:'entrySection',fn:()=>{state.tour.progress=0;state.tour.playing=true},ms:8500},
{label:'墙面返潮、雨蚀、剥落与修补',section:'wallToolSection',fn:()=>{applyWallPreset('wulong');state.wall.values.damp=.78;state.wall.values.rainWash=.72;state.wall.values.peeling=.55;state.wall.values.repair=.35;buildFields($('#wallFields'),wallFieldDefs,state.wall.values,drawWall);drawWall()},ms:5000},
{label:'瓦色、破损与修补变化',section:'roofToolSection',fn:()=>{applyTilePreset('wulong');state.tile.values.damage=.26;state.tile.values.repair=.22;buildFields($('#tileFields'),tileFieldDefs,state.tile.values,drawTile);drawTile()},ms:5000},
{label:'证据到生成规则矩阵',section:'matrixSection',fn:()=>{},ms:6000}
];
function syncRoofModeButtons(){$$('[data-roof-relation-mode]').forEach(b=>b.classList.toggle('active',b.dataset.roofRelationMode===state.roofRelation.mode))}
function syncTileModeButtons(){$$('[data-tile-mode]').forEach(b=>b.classList.toggle('active',b.dataset.tileMode===state.tile.mode))}
function playDemo(){if(state.demo.playing&&!state.demo.paused)return;state.demo.playing=true;state.demo.paused=false;if(state.demo.index>=demoSteps.length)state.demo.index=0;runDemoStep()}
function runDemoStep(){if(!state.demo.playing||state.demo.paused)return;if(state.demo.index>=demoSteps.length){state.demo.playing=false;state.demo.index=0;setText('#demoStage','演示完成');return}const s=demoSteps[state.demo.index];setText('#demoStage',(state.demo.index+1)+'/'+demoSteps.length+' '+s.label);$('#'+s.section).scrollIntoView({behavior:'smooth',block:'start'});s.fn();clearTimeout(state.demo.timer);state.demo.timer=setTimeout(()=>{state.demo.index++;runDemoStep()},s.ms)}
function pauseDemo(){state.demo.paused=true;clearTimeout(state.demo.timer);setText('#demoStage','已暂停')}
function resetDemo(){state.demo.playing=false;state.demo.paused=false;state.demo.index=0;clearTimeout(state.demo.timer);state.tour.progress=0;state.tour.playing=false;state.roofRelation.mode='full';state.tile.mode='full';syncRoofModeButtons();syncTileModeButtons();applyWallPreset('yikeyin');applyTilePreset('liuZhiping');drawRoofRelation();drawEntry();window.scrollTo({top:0,behavior:'smooth'});setText('#demoStage','准备就绪')}
$('#demoPlay').onclick=playDemo;$('#playDemoTop').onclick=playDemo;$('#demoPause').onclick=pauseDemo;$('#demoReset').onclick=resetDemo;
function frame(t){if(!state.tour.last)state.tour.last=t;const dt=Math.min(.05,(t-state.tour.last)/1000);state.tour.last=t;if(state.tour.playing){state.tour.progress+=dt*.055*state.tour.speed;if(state.tour.progress>=1){state.tour.progress=1;state.tour.playing=false}drawEntry()}requestAnimationFrame(frame)}
async function init(){state.contract=await loadContract();updateGlobal();initTools();requestAnimationFrame(frame);loadModels();window.__YN_UNDERSTANDING_LAB__={state,stats:()=>({ready:state.ready,modelsLoaded:state.modelLoaded,modelsFailed:state.modelFailed,roofUnits:roofUnits.length,roofMode:state.roofRelation.mode,tourProgress:state.tour.progress,personFloor:routeAt(state.tour.progress).floor,wallPreset:state.wall.preset,tilePreset:state.tile.preset,unresolved:(state.contract.unresolvedParameters||[]).length}),setTourProgress:v=>{state.tour.progress=clamp(Number(v),0,1);state.tour.playing=false;drawEntry()},setRoofMode:v=>{state.roofRelation.mode=v;syncRoofModeButtons();drawRoofRelation()},setWallPreset:applyWallPreset,setTilePreset:applyTilePreset,playDemo,pauseDemo,resetDemo};}
init();

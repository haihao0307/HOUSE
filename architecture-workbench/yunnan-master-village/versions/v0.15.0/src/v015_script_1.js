
/* Yunnan workshop: source parameters, construction state and presentation are distinct. */
(function(root){'use strict';
const CONFIG=Object.freeze({version:'0.15.0',seed:72419,axesX:[-5.1,-1.7,1.7,5.1],axesZ:[-3.3,-2,2.6],baseTop:.42,floorBeamTop:2.88,joistTop:3.04,floorTop:3.076,columnR:.145,opening:{x0:3.72,x1:5.04,z0:-3.28,z1:-2.02},assemblyBedY:.64,frontEaveOverhang:.78,rearEaveOverhang:1.36,sideEaveOverhang:1.00,stairStrategy:'east_side_wall_to_gallery_candidate',site:{xMin:-16,xMax:18,zMin:-11,zMax:10},ropeCorridors:{frontZ:-4.12,rearZ:3.52},ropeCrewInset:{near:.36,far:.68},pullBackDistance:1.78,braceSetWindow:.08,kitchenExclusionRadius:2.25,feastCenter:{x:0,z:-8.15},sourceScaleStatus:'provisional_not_extracted_SKP_truth',preservedRules:['whole_frame_ground_assembly','one_end_sequential_raising','rope_corridor_avoids_erected_frames','named_bases_share_axes','temporary_braces_retained','gallery_boards_continuous','atmosphere_is_read_only','zero_runtime_image_textures','regional_audio_evidence_separated_from_procedural_sound','tools_meet_hands','debris_multi_direction','two_run_side_stair','ritual_candidate_is_atmosphere','five_dog_varied_routes','pig_and_buffalo_segmented_tail_motion','ritual_visitor_stage_bound','director_wall_occlusion_check','final_feast_non_graphic','continuous_purlins_extend_1_0m','pullers_step_backward_under_tension','push_poles_transition_to_fixed_braces','braces_fixed_fast_and_retained','floor_installers_stand_on_completed_deck','veranda_stone_paving_continuous','column_base_top_normal_up','animal_calls_mobile_audition_available','black_dog_clear_of_kitchen','courtyard_feast_all_join','dogs_fed_after_completion','yunnan_red_soil_enhanced']})
const specs=[
['clear','清理场地','先把施工空地腾出来','工人搬走散石、枯枝，清出作业与运料通道。',12],
['level','平整红土地','铲高填低，土方归堆','工人沿工作区整平；堆土留在作业边界外。土方变化为示意，未作守恒计算。',12],
['stake','打桩定轴','先定轴线和柱位','放样木桩逐个落下，轴网与未来柱础共用坐标。',10],
['chalk','白灰放线','红土上撒出白灰控制线','工人沿线行走，白灰痕迹从脚边向前延伸，保留粉末边缘。',12],
['dig','沿线开槽','顺着基础控制线开挖','沿墙基控制线挖槽，柱基单独开坑。',16],
['masonry','下石脚与砌基础','石料运到槽中再就位','工人运石、下石脚，连续墙基与柱下石基分别砌筑。',24],
['base','安放柱础','逐柱核对落脚中心','柱础底座和鼓座成组运入，逐柱安装；轴距与柱脚控制不变。',18],
['assemble1','地面配好第一榀','通高柱与梁枋组成整片木架','完整构架在垫木上配装，楼层分类不改变整榀装配单元。',12],
['raise1','人力起立第一榀','牵引队使用两侧空地','从左端开始连续推进。绳索走房屋前后两侧作业带，不穿已立木架。',14],
['brace1','落位后迅速定撑','撑杆马上顶住并持续保留','柱脚落位后，推架工迅速把木撑定在柱架上。运动演示没有计算绳力和临撑承载。',8],
['assemble2','地面配好第二榀','下一榀只用未建区域','地面构架放在推进方向的未建空地，已有木架保持不动。',10],
['raise2','第二榀人力起架','先检查牵引通道，再起架','两侧绳索与已立构架分开；演示检测绳段与已立构件包围盒。',14],
['link2','两榀纵向联系','两片木架连接成空间构架','相邻构架落位、有临撑以后安装纵向梁枋及檩条。',12],
['raise3','第三榀配装与起架','同一规则继续向右推进','先完整配装，再整体竖起；禁止榀内构件在起架中伸缩。',18],
['link3','连接第三榀','沿开间逐段联结','连接只依赖已经竖立的相邻构架，不跨过未完成榀。',10],
['raise4','第四榀配装与起架','最后一榀仍需作业净空','末端预留地面试装和牵引范围，场地不足须重新规划工序。',18],
['link4','四榀木架联系完成','三间正房的空间木架形成','四榀和三跨纵向联系齐备；临撑保留，结构安全尚未获验证。',12],
['celebrate','主骨架完成与上梁庆贺','正中悬炮，底部起爆，众人碰碗','庆贺发生在主体木架联系完成之后，并早于楼板、墙体和椽子。题字与仪式仍为地区待核候选。',16],
['joists','安装二楼楼楞','楼面读取已安装承托','先洞口边梁，再安装楼楞；下部承托缺失时禁止安装。',12],
['boards','铺二楼楼板与院侧木廊','内楼面和回廊连续铺板','正房楼面和院侧回廊分别读取承托；东侧保留靠墙木梯接口候选。',12],
['descend','铺板收工，工人依次下楼','沿实楼板、平台和踏步回到院地','三名铺板工按同一实体通道下行，脚步读取各踏步标高；当前围护尚未安装。',62],
['rafters','铺设小圆木椽与前后出檐','后檐加长，形成墙面雨影','小圆木椽按檩位生成，后檐独立加长。实际截面、椽距和出檐量仍是候选。',14],
['enclosure','背墙与木隔扇试装','木架稳定后安装围护','二层隔扇上部收口至横梁下缘。侧墙因临撑占位继续暂缓。',10],
['groundfloor','完成一层夯土地坪与院前石板','脚下空间进入可使用状态','室内使用夯土面，院前铺石板候选；排水坡度和材料规格待具名测绘核准。',12],
['feastsetup','搬桌至前院，摆凳端菜','先搬桌，落稳后上菜','长桌从廊前石板带搬到前院红土地，人员分工抬桌、摆凳和候席。',20],
['feast','完工聚餐与村落庆祝','工序收尾后围桌吃饭、碰碗、唱和','两只鸡退出活动层，以非血腥方式进入完工聚餐；人群、营造歌与村落声景增强。',18]
];
let sum=0;const STAGES=specs.map((a,i)=>{const s={id:i,key:a[0],title:a[1],short:a[2],why:a[3],limit:'数值与动作属于研发候选，未获历史或现实承载批准。',duration:a[4],start:sum};sum+=a[4];s.end=sum;return s;});const TOTAL=sum,I=Object.fromEntries(STAGES.map(s=>[s.key,s.id]));
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);},phase=(t,i)=>clamp((t-STAGES[i].start)/STAGES[i].duration);
function derive(t){t=clamp(Number(t)||0,0,TOTAL);let index=STAGES.findIndex(s=>t<s.end);if(index<0)index=STAGES.length-1;const p=k=>phase(t,I[k]);const fs=[{assembled:p('assemble1'),raised:p('raise1'),brace:clamp(p('brace1')/.28)},{assembled:p('assemble2'),raised:clamp(p('raise2')/.86),brace:clamp((p('raise2')-.86)/CONFIG.braceSetWindow)},{assembled:clamp(p('raise3')/.28),raised:clamp((p('raise3')-.28)/.56),brace:clamp((p('raise3')-.84)/CONFIG.braceSetWindow)},{assembled:clamp(p('raise4')/.28),raised:clamp((p('raise4')-.28)/.56),brace:clamp((p('raise4')-.84)/CONFIG.braceSetWindow)}].map((f,i)=>({...f,id:'BENT-'+(i+1),x:CONFIG.axesX[i],angle:-(1-smooth(f.raised))*Math.PI/2,pivotY:CONFIG.baseTop+(CONFIG.assemblyBedY-CONFIG.baseTop)*(1-smooth(f.raised)),placed:f.raised>=1,braced:f.brace>=1}));return {t,stage:index,stageKey:STAGES[index].key,stageProgress:phase(t,index),cleared:p('clear'),levelled:p('level'),stakes:p('stake'),lines:p('chalk'),excavation:p('dig'),foundation:p('masonry'),bases:p('base'),frames:fs,connections:[p('link2'),p('link3'),p('link4')],celebration:p('celebrate'),joists:p('joists'),boards:p('boards'),gallery:p('boards'),stairs:p('boards'),rafters:p('rafters'),enclosure:p('enclosure'),groundfloor:p('groundfloor'),descent:p('descend'),feastsetup:p('feastsetup'),feast:p('feast'),temporarySupportsRetained:true};}
function validateState(s){const tests=[],add=(id,pass,detail)=>tests.push({id,pass:!!pass,detail});[['CLEAR_BEFORE_LEVEL',s.levelled===0||s.cleared>=1],['LEVEL_BEFORE_STAKES',s.stakes===0||s.levelled>=1],['STAKES_BEFORE_CHALK',s.lines===0||s.stakes>=1],['CHALK_BEFORE_DIG',s.excavation===0||s.lines>=1],['DIG_BEFORE_STONE',s.foundation===0||s.excavation>=1],['STONE_BEFORE_BASES',s.bases===0||s.foundation>=1]].forEach(a=>add(...a,'场地施工前置条件'));s.frames.forEach((f,i)=>{add('B'+i+'_BASE',!f.assembled||s.bases>=1,'柱础已完成');add('B'+i+'_WHOLE',!f.raised||f.assembled>=1,'整榀配好后起架');add('B'+i+'_BRACE',!f.brace||f.placed,'落位后安临撑');if(i>0)add('B'+i+'_ORDER',!f.assembled||s.frames[i-1].placed,'从一端连续推进');});s.connections.forEach((v,i)=>{add('L'+i+'_UP',!v||s.frames[i].placed&&s.frames[i+1].placed,'相邻两榀已竖立');add('L'+i+'_BRACE',!v||s.frames[i].braced&&s.frames[i+1].braced,'联系时保留临撑');});add('CELEBRATE_AFTER_FRAME',!s.celebration||s.connections.every(x=>x>=1),'主骨架联系完成后庆贺');add('JOIST_AFTER_RITUAL',!s.joists||s.celebration>=1,'楼楞晚于主骨架庆贺');add('BOARD',!s.boards||s.joists>=1,'木楼板晚于楼楞');add('GALLERY',!s.gallery||s.joists>=1,'院侧木廊晚于楼楞');add('STAIR',!s.stairs||s.gallery>0,'侧向木梯读取院侧廊面接口');add('RAFTER',!s.rafters||s.celebration>=1&&s.connections.every(x=>x>=1),'圆椽晚于完整木架庆贺');add('ENC',!s.enclosure||s.celebration>=1&&s.connections.every(x=>x>=1),'围护晚于木架庆贺');add('GROUND_FINISH',!s.groundfloor||s.enclosure>=1,'一层地坪晚于围护试装');add('FEAST_AFTER_COMPLETE',!s.feast||s.groundfloor>=1,'完工聚餐晚于一层地坪和施工收尾');add('RITUAL_BEFORE_UPPER_WORK',I.celebrate<I.joists&&I.celebrate<I.boards&&I.celebrate<I.rafters&&I.celebrate<I.enclosure,'庆贺阶段位于上部后续工序之前');add('DESCEND_AFTER_BOARD',!s.descent||s.boards>=1&&s.stairs>=1,'楼面与两跑木梯完成后才下楼');add('FEAST_SETUP_AFTER_FINISH',!s.feastsetup||s.groundfloor>=1,'施工收尾后搬桌到前院');add('MEAL_AFTER_TABLE',!s.feast||s.feastsetup>=1,'长桌落位后上菜入席');add('KEEP_BRACES',s.temporarySupportsRetained,'禁止擅自撤撑');return {pass:tests.every(t=>t.pass),passed:tests.filter(t=>t.pass).length,total:tests.length,tests};}
root.YKYCore={CONFIG,STAGES,TOTAL,I,clamp,smooth,phase,derive,validateState};if(typeof module!=='undefined')module.exports=root.YKYCore;
})(typeof window!=='undefined'?window:globalThis);


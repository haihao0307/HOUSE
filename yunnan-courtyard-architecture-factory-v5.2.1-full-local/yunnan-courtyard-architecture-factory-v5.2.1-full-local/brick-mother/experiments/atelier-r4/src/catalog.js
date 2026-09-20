/* UI identity, geometry family and material model are distinct from version labels. */
const BRICK_CATALOG=Object.freeze([
 {id:'fired',name:'烧结旧砖',group:'砖',note:'长方砖体 · 多尺度孔洞',tone:'#ae613a',shader:0,seed:5045,shape:'long',shapes:['long','sample','half','thin','wedge'],rough:.85,grain:.45,frequency:15},
 {id:'kiln',name:'窑变旧砖',group:'砖',note:'砖体 · 烧结深浅色区',tone:'#784a39',shader:4,seed:6112,shape:'long',shapes:['long','sample','half','thin','wedge'],rough:.85,grain:.43,frequency:15},
 {id:'adobe',name:'纤维土坯',group:'土坯',note:'六面夹杂 · 局部埋露',tone:'#ac8955',shader:3,seed:4517,shape:'long',shapes:['long','sample','half','thin'],rough:.97,grain:.40,frequency:18},
 {id:'dressed',name:'粗凿砌筑石',group:'石',note:'相对方整 · 局部凿切',tone:'#929184',shader:5,seed:10365,shape:'long',shapes:['long','sample','half','thin','wedge'],rough:.88,grain:.43,frequency:15},
 {id:'rubble',name:'不规则毛石',group:'石',note:'非对称块面 · 劈裂缺口',tone:'#6f7774',shader:2,seed:9298,shape:'sample',shapes:['sample','long','half','thin','wedge'],rough:.91,grain:.42,frequency:14},
 {id:'stone',name:'层状毛石',group:'石',note:'层厚差异 · 沿层断边',tone:'#8e9b9a',shader:1,seed:8231,shape:'sample',shapes:['sample','long','half','thin'],rough:.92,grain:.42,frequency:14},
 {id:'pebble',name:'建筑卵石',group:'石',note:'圆润曲面 · 个体差异',tone:'#95978b',shader:6,seed:7179,shape:'sample',shapes:['sample','long','thin','half'],rough:.80,grain:.22,frequency:16}
].map(Object.freeze));
const BRICK_SHAPE_NAMES=Object.freeze({sample:'宽面厚块',long:'长条',half:'半块 / 断端',thin:'薄片',wedge:'楔形'});
const BRICK_PEBBLE_NAMES=Object.freeze({sample:'圆卵石',long:'椭长卵石',thin:'扁卵石',half:'残缺卵石'});
if(typeof module!=='undefined')module.exports={BRICK_CATALOG,BRICK_SHAPE_NAMES,BRICK_PEBBLE_NAMES};

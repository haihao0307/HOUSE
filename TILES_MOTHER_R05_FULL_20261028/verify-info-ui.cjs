'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const TilesRecord=require('./record-compact.cjs');
const nodes=Object.fromEntries(['objectInfoPanel','objectInfoToggle','objectInfoClose','objectInfoText'].map(id=>[id,{hidden:id==='objectInfoPanel',textContent:''}]));
const context={
 document:{getElementById:id=>nodes[id]},
 TilesRecord,
 workshop:{definition:{id:'first'},records:[{id:'first',geometry:{continuous:true}}]},
 STUDY:{id:'first'},
 TILE_RULE_MANIFEST:{ruleBytes:10,assemblyBytes:20,newAdapterBytes:30,libraryBytes:40,sourceBytes:50}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/info-ui.js','utf8'),context);
context.installObjectInfo09N();
nodes.objectInfoToggle.onclick();
assert(!nodes.objectInfoPanel.hidden);
assert(nodes.objectInfoText.textContent.includes('当前场景：1 个对象，1 个瓦对象'));
context.workshop.definition={id:'second'};
context.workshop.records=[{id:'one',geometry:{continuous:true}},{id:'two',geometry:{continuous:true}},{id:'wood',geometry:{type:'wood'}}];
context.STUDY.id='second';
context.refreshObjectInfo09N();
assert(nodes.objectInfoText.textContent.includes('当前场景：3 个对象，2 个瓦对象'));
nodes.objectInfoClose.onclick();
assert(nodes.objectInfoPanel.hidden);
const html=fs.readFileSync('G:/HOUSE/brick-tiles-mother-09n-20261028/START_HERE.html','utf8');
assert(html.includes("studyUpdate();if(!document.getElementById('objectInfoPanel').hidden)refreshObjectInfo09N();"));
const result={version:'09N',pass:true,checks:['open panel for first scene','update record counts for another scene','close panel','successful scene rebuild refreshes visible panel'],scope:'DOM-level logic; actual public-browser interaction is checked separately.'};
fs.writeFileSync(__dirname+'/INFO_UI_VALIDATION.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));

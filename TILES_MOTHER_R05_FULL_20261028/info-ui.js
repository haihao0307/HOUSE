function installObjectInfo09N(){
 const panel=document.getElementById('objectInfoPanel');
 document.getElementById('objectInfoToggle').onclick=()=>{
  const packed=TilesRecord.pack({definition:workshop.definition,records:workshop.records,study:STUDY,ruleManifest:TILE_RULE_MANIFEST}),stats=TilesRecord.stats(packed);
  const range=stats.tiles.count?stats.tiles.min+'–'+stats.tiles.max+' B':'当前场景无瓦对象';
  document.getElementById('objectInfoText').textContent='当前场景：'+stats.all.count+' 个对象，'+stats.tiles.count+' 个瓦对象\n单个瓦实例记录：'+range+'\n共用形状定义：'+stats.templatesCount+' 组，'+stats.templatesBytes.toLocaleString()+' B\n本场景紧凑记录：'+stats.sceneBytes.toLocaleString()+' B\n共享函数：'+TILE_RULE_MANIFEST.ruleBytes.toLocaleString()+' B\n新增连接规则：'+TILE_RULE_MANIFEST.assemblyBytes.toLocaleString()+' B\n新增显示适配器：'+TILE_RULE_MANIFEST.newAdapterBytes.toLocaleString()+' B\n共享配方：'+TILE_RULE_MANIFEST.libraryBytes.toLocaleString()+' B\n六组纹样轮廓：'+TILE_RULE_MANIFEST.sourceBytes.toLocaleString()+' B\n完整工作台 HTML：__HTML_BYTES__ B';
  panel.hidden=false;
 };
 document.getElementById('objectInfoClose').onclick=()=>panel.hidden=true;
}

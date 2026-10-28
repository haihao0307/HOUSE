const FLAT_TILE_CACHE=new Map();
function flatTileMesh09N(width,thickness,length,geometryGain=.25){
 const key=[width,thickness,length,geometryGain,settings.micStrength,settings.micScale].join('/');if(FLAT_TILE_CACHE.has(key))return FLAT_TILE_CACHE.get(key);
 const e=TilesFlat.create({library:SHEET_LIBRARY,width,length,thickness,geometryGain,strength:settings.micStrength,scale:settings.micScale}),g=SheetDisplay.sample(e,96,3);g.definition={kind:'flat tile course',continuous:e.definition()};FLAT_TILE_CACHE.set(key,g);return g;
}

const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..','..'),M=require(root+'/TILES_MOTHER_R03/tlo.cjs'),nodes=new Map(),presets=[0,.45,-.9].map(v=>({dataset:{bend:String(v)},classList:{toggle(){}}}));
function node(id){if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',hidden:false,classList:{toggle(){}},removeAttribute(){},addEventListener(){},setPointerCapture(){}});return nodes.get(id)}
node('instance').textContent=fs.readFileSync(root+'/TILES_MOTHER_R03/instance.json','utf8');let rendered=0;
const scope={TLOMother:M,document:{getElementById:node,querySelectorAll:()=>presets,body:{dataset:{}}},window:{addEventListener(){}},BYTE_MEASURE:require(root+'/TILES_MOTHER_R03/BYTES.json'),TextEncoder,structuredClone,requestAnimationFrame:fn=>{fn();return 0},TileRenderer:class{constructor(){this.frames=0;this.mode='GPU analytic rays'}render(){this.frames++;rendered++}},setTimeout,console};
vm.createContext(scope);vm.runInContext(fs.readFileSync(root+'/TILES_MOTHER_R03/app.js','utf8'),scope);const api=scope.window.TilesTLO;
const result={scope:'JS UI state contract using real core and DOM/renderer stubs; not a browser or ray/render acceptance',checks:{}};
function check(name,fn){try{fn();result.checks[name]=true}catch(e){result.checks[name]=false;(result.errors??=[]).push({name,error:e.message})}}
check('presets_change_only_bend',()=>{const base=JSON.stringify(api.record());for(const p of presets){p.onclick();const current=api.record();current.Object.bend=0;assert.equal(JSON.stringify(current),base)}});
api.setBend(0);
check('invalid_bend_keeps_thick_brick_and_shows_error',()=>{for(const[id,value]of[['length','300'],['width','165'],['thick','90']]){node(id).value=value;node(id).onchange({target:node(id)})}const before=JSON.stringify(api.record()),renders=rendered;assert.equal(api.setBend(-.9),false);assert.equal(JSON.stringify(api.record()),before);assert.equal(rendered,renders);assert(node('error').textContent);assert.equal(+node('bend').value,0);});
check('preset_error_uses_same_transaction',()=>{const before=JSON.stringify(api.record());presets[2].onclick();assert.equal(JSON.stringify(api.record()),before);assert.equal(+node('bend').value,0)});
check('invalid_size_keeps_record_and_recovery_works',()=>{const before=JSON.stringify(api.record());node('width').value='0';node('width').onchange({target:node('width')});assert.equal(JSON.stringify(api.record()),before);assert.equal(+node('width').value,165);node('reset').onclick();assert.equal(api.record().Object.size.join('/'),'0.24/0.21/0.014');assert.equal(api.setBend(-.9),true);assert.equal(node('error').textContent,'')});
check('location_only_preserves_shape_and_creation_date',()=>{const p=JSON.stringify(api.evaluate(.3,.4,.5)),time=api.record().Time;node('place').value='香港';node('place').onchange({target:node('place')});assert.equal(api.record().Location.site,'香港');assert.equal(JSON.stringify(api.evaluate(.3,.4,.5)),p);assert.equal(api.record().Time,time)});
check('blank_location_rolls_back',()=>{node('place').value=' ';node('place').onchange({target:node('place')});assert.equal(api.record().Location.site,'香港');assert.equal(node('place').value,'香港')});
result.pass=Object.values(result.checks).every(Boolean);fs.writeFileSync(__dirname+'/UI_CONTRACT.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

assert.ok(result.pass,"UI contract checks failed; see UI_CONTRACT.json");

(function(){
  'use strict';
  const files=[
    'assets/js/yunnan-understanding-core.js',
    'assets/js/yunnan-understanding-entry.js',
    'assets/js/yunnan-understanding-wall.js',
    'assets/js/yunnan-understanding-tile.js',
    'assets/js/yunnan-understanding-demo.js'
  ];
  let index=0;
  function next(){
    if(index>=files.length)return;
    const script=document.createElement('script');
    script.src=files[index++];
    script.async=false;
    script.onload=next;
    script.onerror=function(){
      const status=document.getElementById('globalStatus');
      if(status)status.textContent='理解实验室脚本载入失败：'+script.src;
      console.error('Script load failed',script.src);
    };
    document.body.appendChild(script);
  }
  next();
})();

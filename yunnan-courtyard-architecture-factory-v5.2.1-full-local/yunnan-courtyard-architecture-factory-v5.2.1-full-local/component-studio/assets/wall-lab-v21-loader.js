(async () => {
  const partUrls = [
    './assets/wall-lab-v21.part00.b64',
    './assets/wall-lab-v21.part01.b64',
    './assets/wall-lab-v21.part02.b64',
    './assets/wall-lab-v21.part03.b64'
  ];
  if (typeof DecompressionStream !== 'function') {
    throw new Error('当前浏览器缺少 DecompressionStream，无法启动墙面 V2.1');
  }
  const parts = await Promise.all(partUrls.map(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`墙面程序分卷读取失败：${response.status} ${url}`);
    return response.text();
  }));
  const binary = atob(parts.join('').replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const source = await new Response(stream).text();
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
})().catch((error) => {
  console.error(error);
  const host = document.getElementById('wallPreview') || document.body;
  const message = document.createElement('div');
  message.style.padding = '18px';
  message.style.color = '#e9aaa1';
  message.style.lineHeight = '1.7';
  message.textContent = `墙面 V2.1 启动失败：${error.message || error}`;
  host.append(message);
});

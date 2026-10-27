function parameters(values) {
  if (!Array.isArray(values) || values.length !== 4 || !values.every(Number.isFinite))
    throw new RangeError('Expected finite [L,W,T,k]');
  const d = values.map(Math.fround), [L,W,T,k] = d;
  if (![L,W,T].every(v => v >= Math.fround(0.0001) && v <= 10) || Math.max(L,W,T)/Math.min(L,W,T) > 1000)
    throw new RangeError('Supported dimensions: 0.1 mm..10 m, aspect <=1000');
  if ((values[3] !== 0 && k === 0) || !Number.isFinite(k) || Math.abs(k)*T/2 > 0.95 || Math.abs(k)*W/2 > 3 || (k !== 0 && Math.abs(k)*W < 1e-8))
    throw new RangeError('Supported curvature: |k|T/2<=.95, |k|W/2<=3; nonzero |k|W>=1e-8');
  return Object.freeze(d);
}
function encode(values) {
  const d = parameters(values), bytes = new Uint8Array(16), view = new DataView(bytes.buffer);
  d.forEach((v,i) => view.setFloat32(i*4,v,true));
  return bytes;
}
function decode(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 16) throw new RangeError('Expected exactly 16 bytes');
  const view = new DataView(bytes.buffer,bytes.byteOffset,16);
  return parameters([0,1,2,3].map(i => view.getFloat32(i*4,true)));
}
module.exports = {parameters,encode,decode};

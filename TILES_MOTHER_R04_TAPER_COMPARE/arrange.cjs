const {parameters} = require('./parameters.cjs');
function arrange(shape, {rows=1,columns=1,gap=0.01,jitter=0,yaw=0,seed=1} = {}) {
  const [L,W,T] = parameters(shape), radius = Math.hypot(L/2,(W+T)/2);
  if (![rows,columns,seed].every(Number.isSafeInteger) || rows < 1 || columns < 1 || rows*columns > 10000 || seed < 0 || seed > 4294967295)
    throw new RangeError('Positive rows/columns; <=10000 tiles; uint32 seed');
  if (![gap,jitter,yaw].every(Number.isFinite) || gap < 1e-6 || gap > 10 || jitter < 0 || jitter > radius/10 || yaw < 0 || yaw > 0.15)
    throw new RangeError('gap 1e-6..10 m; jitter 0..radius/10 m; yaw 0...15 radians');
  const pitch = 2*radius+2*jitter+gap, placements = new Float64Array(rows*columns*4);
  let state = seed;
  const random = () => { state = (Math.imul(state,1664525)+1013904223) >>> 0; return state/4294967296*2-1; };
  for (let row=0;row<rows;row++) for (let col=0;col<columns;col++) {
    const i = 4*(row*columns+col);
    placements[i] = (col-(columns-1)/2)*pitch+jitter*random();
    placements[i+1] = (row-(rows-1)/2)*pitch+jitter*random();
    placements[i+2] = 0;
    placements[i+3] = yaw*random();
  }
  return {radius,pitch,placements};
}
module.exports = {arrange};

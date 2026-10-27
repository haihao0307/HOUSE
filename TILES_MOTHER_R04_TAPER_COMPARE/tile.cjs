function tile(q, d) {
  const x = q[0]*d[0], y = q[1]*d[1], z = q[2]*d[2], k = d[3];
  if (k === 0) return [x,y,z];
  const a = y*k, s = Math.sin(a), h = Math.sin(a/2);
  return [x,s/k-z*s,2*h*h/k+z*Math.cos(a)];
}
module.exports = tile;

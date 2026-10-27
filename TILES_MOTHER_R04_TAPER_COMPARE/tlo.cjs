const {parameters} = require('./parameters.cjs');
function record({id=null,time=null,location=null,shape,placement=null,parent=null} = {}) {
  if (![id,location,parent].every(v => v === null || (typeof v === 'string' && v.length > 0)))
    throw new TypeError('Identity, site and parent are nonempty labels or null (unknown)');
  if (time !== null && (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(time) ||
      !Number.isFinite(Date.parse(time)) || new Date(time).toISOString().slice(0,10) !== time))
    throw new TypeError('Time is creation date YYYY-MM-DD or null (unknown)');
  if (placement !== null && (!Array.isArray(placement) || placement.length !== 4 || !Array.from(placement).every(Number.isFinite)))
    throw new TypeError('Placement is [x,y,z,yawRadians] or null (not placed)');
  return Object.freeze({Time:time,Location:location,Object:Object.freeze({id,mother:'tiles.r04',
    shape:parameters(shape),placement:placement && Object.freeze(placement.slice()),parent})});
}
module.exports = {record};

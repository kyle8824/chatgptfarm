import {campsOf,campLayout} from '../shared/frontier.js';
// Transitional hourly model. Location labels are authoritative until travel
// exposure is integrated; renderer coordinates must not drive world physics.
export function thermalExposure(world, agent) {
  const atCamp = agent.position === 'camp';
  const camps=world.frontier?campsOf(world):null,p=agent.coordinates;
  const sheltered = camps&&p?camps.some(c=>c.structures.shelter&&Math.abs(p.x-c.shelter.x)<1.5&&Math.abs(p.y-c.shelter.y)<1.6):atCamp && !!world.structures.shelter;
  const coldLoss = world.temperature < 50 ? 5 : world.temperature < 58 ? 2 : 0;
  const rainLoss = world.weather === 'rain' && !sheltered ? 3 : 0;
  const shelterProtection = sheltered ? Math.min(coldLoss, 2) : 0;
  const fireGain = camps&&p?Math.max(0,...camps.filter(c=>c.structures.fire).map(c=>10*Math.max(0,Math.min(1,(4-Math.hypot(p.x-c.fire.x,p.y-c.fire.y))/1.8)))):atCamp && world.structures.fire ? 10 : 0;
  return {coldLoss, rainLoss, shelterProtection, fireGain,
    net: fireGain + shelterProtection - coldLoss - rainLoss,
    location: agent.position, sheltered, model: 'hourly-location-v1'};
}

export function applyThermalExposure(world, agent) {
  const exposure = thermalExposure(world, agent);
  const before = agent.needs.warmth;
  agent.needs.warmth = Math.max(0, Math.min(100, before + exposure.net));
  agent.thermalExposure = {...exposure, before, after: agent.needs.warmth,
    appliedDelta: agent.needs.warmth - before, day: world.day, hour: world.hour};
  return agent.thermalExposure;
}

// Uses the legacy shared camp knowledge. Personal observations and travel costs
// will replace that assumption as the spatial model is rebuilt.
export function thermalChoices(world, agent) {
  const here = thermalExposure(world, agent);
  const camp = thermalExposure(world, {...agent, position: 'camp',coordinates:campLayout(world).fire});
  const deficit = Math.max(0, 70 - agent.needs.warmth);
  if (world.structures.fire && deficit > 0) {
    return [{id: 'seek_warmth', label: 'Warm up beside the camp fire',
      score: deficit * 1.8 + Math.max(0, -here.net),
      reasons: [['warmth deficit', deficit], ['camp hourly warmth change', camp.net]]}];
  }
  if (world.structures.shelter && agent.position !== 'camp' && camp.net > here.net && deficit > 0) {
    return [{id: 'seek_cover', label: 'Take cover in the camp shelter',
      score: deficit + (camp.net - here.net) * 4,
      reasons: [['warmth deficit', deficit], ['exposure reduction', camp.net - here.net]]}];
  }
  return [];
}

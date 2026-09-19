// Transitional hourly model. Location labels are authoritative until travel
// exposure is integrated; renderer coordinates must not drive world physics.
export function thermalExposure(world, agent) {
  const atCamp = agent.position === 'camp';
  const sheltered = atCamp && !!world.structures.shelter;
  const coldLoss = world.temperature < 50 ? 5 : world.temperature < 58 ? 2 : 0;
  const rainLoss = world.weather === 'rain' && !sheltered ? 3 : 0;
  const shelterProtection = sheltered ? Math.min(coldLoss, 2) : 0;
  const fireGain = atCamp && world.structures.fire ? 10 : 0;
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

export{WORLD_VERSION,PHYSICS_VERSION,createWorld,migrateWorld,addEvent,remember,recordDiscovery,learnSkill}from'./engine/core.js';
export{PHYSICAL_VERBS,PHYSICAL_CONFIGURATIONS,buildAffordanceView,normalizePhysicalProposal,validatePhysicalProposal}from'./engine/affordances.js';
export{candidateActions,retrieveDecisionContext,tickWithMind,tick}from'./engine/runtime.js';
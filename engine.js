export{WORLD_VERSION,PHYSICS_VERSION,createWorld,migrateWorld,addEvent,remember,recordDiscovery,learnSkill}from'./engine/core.js';
export{WORLD_MODEL_VERSION,ensureWorldModel,findWorldObject,worldObjectForZone,activeWorldObjects,instantiateObjectComponents,detachComponent,objectSnapshot}from'./engine/world-model.js';
export{PHYSICAL_VERBS,PHYSICAL_CONFIGURATIONS,deriveSupports,buildAffordanceView,normalizePhysicalProposal,validatePhysicalProposal}from'./engine/affordances.js';
export{candidateActions,retrieveDecisionContext,tickWithMind,tick}from'./engine/runtime.js';
export{ECOLOGY_VERSION,ensureEcology,advanceEcology,visibleWildlifeForAgent,visibleWildlifeTracesForAgent,wildlifeAIEnabled}from'./engine/ecology.js';

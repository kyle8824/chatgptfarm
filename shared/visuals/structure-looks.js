import {DEFAULT_STRUCTURE_LOOK,readStructureLook} from './structure-appearance.js';
// Reviewed workshop exports go here for release into the world. Browser drafts
// never write to this registry or the authoritative simulation.
export const STRUCTURE_LOOKS={};
export function releasedStructureLook(project){const saved=STRUCTURE_LOOKS[project.id];if(saved)try{return readStructureLook(project,saved);}catch{}return DEFAULT_STRUCTURE_LOOK;}

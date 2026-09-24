export function updateShelterProgress(group,structures){
 const work=structures.shelter?180:structures.shelterConstruction?.workMinutes||0;
 group.visible=work>0;
 for(const child of group.children)child.visible=work>=(child.userData.shelterWorkAt??180);
}

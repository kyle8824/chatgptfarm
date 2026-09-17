from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one patch anchor, found {count}")
    return text.replace(old, new, 1)


p = Path('phaser-world-v1.js')
src = p.read_text()
if "wildlife-coherence-v1" in src:
    print('Wildlife coherence pass already applied.')
    raise SystemExit(0)

old_key = "const p=worldToPx(a.position),key=a.species==='bear'?(this.textures.exists('animal-bear')?'animal-bear':'animal-bear-fallback'):a.species==='rabbit'?(this.textures.exists('animal-rabbit')?'animal-rabbit':'animal-rabbit-fallback'):a.species==='fish'?(this.textures.exists('animal-fish')?'animal-fish':'animal-fish'):'animal-deer';"
new_key = "const p=worldToPx(a.position),key=a.species==='bear'?'animal-bear-fallback':a.species==='rabbit'?'animal-rabbit-fallback':a.species==='fish'?'animal-fish':'animal-deer';"
src = replace_once(src, old_key, new_key, 'terrestrial wildlife art selection')
src = replace_once(src, "const h=a.species==='bear'?48:a.species==='deer'?42:24;", "const h=a.species==='bear'?44:a.species==='deer'?42:20;", 'wildlife scale')
src = replace_once(src, "e.setData('kind','wildlife');e.setData('species',a.species);", "e.setData('kind','wildlife');e.setData('artMode',a.species==='fish'?'fish-pack':'world-procedural');e.setData('species',a.species);", 'wildlife art mode')

old_tracks = "for(let i=-2;i<=2;i++){const x=i*6.8*size,y=(i%2?2:-2)*size;g.fillStyle(col,alpha).fillEllipse(x,y,5.2*size,7.5*size);if(t.species!=='rabbit'){g.fillStyle(col,alpha*.78).fillCircle(x-2.4*size,y-3.5*size,1.1*size).fillCircle(x+2.4*size,y-3.5*size,1.1*size)}}"
new_tracks = "for(let i=-2;i<=2;i++){const x=i*7.2*size,y=(i%2?1.8:-1.8)*size;if(t.species==='deer'){g.fillStyle(col,alpha).fillEllipse(x-1.7*size,y,2.5*size,6.1*size).fillEllipse(x+1.7*size,y,2.5*size,6.1*size)}else if(t.species==='bear'){g.fillStyle(col,alpha).fillEllipse(x,y+1.4*size,6.4*size,5.4*size);g.fillStyle(col,alpha*.82).fillCircle(x-3.2*size,y-2.7*size,1.05*size).fillCircle(x-1.1*size,y-3.8*size,1.05*size).fillCircle(x+1.2*size,y-3.8*size,1.05*size).fillCircle(x+3.3*size,y-2.7*size,1.05*size)}else{g.fillStyle(col,alpha*.92).fillEllipse(x-2.3*size,y-1.2*size,3.2*size,6.2*size).fillEllipse(x+2.3*size,y-1.2*size,3.2*size,6.2*size);g.fillStyle(col,alpha*.58).fillEllipse(x,y+3.8*size,2.4*size,3.1*size)}}"
src = replace_once(src, old_tracks, new_tracks, 'species-specific tracks')
src = replace_once(src, "alpha=.08+.42*clarity", "alpha=.055+.31*clarity", 'track visual weight')
src = replace_once(src, "evidence:{...this.evidenceStats,ids:this.evidence.map(x=>x.getData?.('evidenceId')||x.getData?.('artifactId')).filter(Boolean)},camera:", "evidence:{...this.evidenceStats,ids:this.evidence.map(x=>x.getData?.('evidenceId')||x.getData?.('artifactId')).filter(Boolean)},wildlifeArtModes:[...this.entities.values()].filter(x=>x.getData?.('kind')==='wildlife').map(x=>({species:x.getData('species'),mode:x.getData('artMode')||'unknown'})),wildlifeCoherence:'wildlife-coherence-v1',camera:", 'wildlife coherence snapshot')
p.write_text(src)

q = Path('scripts/phaser-qa.mjs')
qa = q.read_text()
needle = "const expectedTracks=(state.ecologySystem?.traces||[]).filter(x=>x.active!==false&&x.position).length;if(s.evidence?.tracks!==expectedTracks)failures.push(`rendered wildlife evidence drifted from canonical ecology: ${s.evidence?.tracks} != ${expectedTracks}`);"
insert = needle + "if(s.wildlifeCoherence!=='wildlife-coherence-v1')failures.push(`wildlife coherence marker missing: ${s.wildlifeCoherence}`);const badWildlifeArt=(s.wildlifeArtModes||[]).filter(x=>x.species!=='fish'&&x.mode!=='world-procedural');if(badWildlifeArt.length)failures.push(`terrestrial wildlife fell back to mismatched icon art: ${JSON.stringify(badWildlifeArt)}`);"
qa = replace_once(qa, needle, insert, 'wildlife art QA')
q.write_text(qa)
print('Applied grounded terrestrial wildlife art and species-specific track marks.')

from pathlib import Path
p=Path('phaser-world-v1.js')
s=p.read_text()
old="parent:'phaserWorld,width:window.innerWidth"
new="parent:'phaserWorld',width:window.innerWidth"
if old not in s:
    raise SystemExit('bootstrap typo anchor missing')
p.write_text(s.replace(old,new,1))

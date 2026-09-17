from pathlib import Path

path=Path('phaser-world-v1.js')
text=path.read_text()
old="g.beginPath();g.moveTo(q.x-len*.5,q.y+Math.sin(tilt)*dy);g.quadraticCurveTo(q.x,q.y-dy,q.x+len*.5,q.y-Math.sin(tilt)*dy);g.strokePath();"
new="g.strokePoints([{x:q.x-len*.5,y:q.y+Math.sin(tilt)*dy},{x:q.x-len*.24,y:q.y-dy*.55},{x:q.x,y:q.y-dy},{x:q.x+len*.24,y:q.y-dy*.52},{x:q.x+len*.5,y:q.y-Math.sin(tilt)*dy}],False,False);"
# Python booleans would be invalid in JS; insert lowercase literals.
new=new.replace('False','false')
if old in text:
    text=text.replace(old,new,1)
elif 'g.strokePoints([{x:q.x-len*.5' in text:
    print('Phaser-native contour fix already applied.')
    raise SystemExit(0)
else:
    raise SystemExit('Contour patch anchor not found')
path.write_text(text)
print('Replaced unsupported quadraticCurveTo with Phaser-native strokePoints contour.')

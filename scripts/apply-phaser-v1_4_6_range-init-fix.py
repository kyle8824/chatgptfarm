from pathlib import Path

path=Path('engine/ecology.js')
text=path.read_text()
old="active:true,localPresence:true,rangeState:'basin',rangeUntil:0,ageClass:'adult'"
new="active:true,localPresence:true,rangeState:'basin',rangeUntil:null,ageClass:'adult'"
if old in text:
    text=text.replace(old,new,1)
elif new not in text:
    raise SystemExit('range-init fix: expected v1.4.6 animal state anchor not found')
path.write_text(text)
print('Ensured new persistent wildlife receive a species-specific first basin visit window.')

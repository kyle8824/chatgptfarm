// Call only after validated physical work, never on a choice, timer or load.
export function recordPractice(w,a,skill,minutes,reason,success=true){
 if(!(Number.isFinite(minutes)&&minutes>0))return;
 const p=(a.craftPractice??={})[skill]??={minutes:0,attempts:0,successes:0};
 p.minutes=Math.round((p.minutes+Math.min(minutes,60))*1000)/1000;
 p.attempts++;if(success)p.successes++;
 p.last={day:w.day,hour:w.hour,reason:String(reason).slice(0,140),success};
}

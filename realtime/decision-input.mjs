import {retrieveDecisionContext} from '../engine/runtime.js';
import {liveCandidates} from './behavior.mjs';
import {freeTimeContext} from './free-time.mjs';
import {homeContext} from './home-life.mjs';
export function parseDecision(result,choices){
 const response=result?.response;let p=response;
 if(typeof response==='string'){const match=response.match(/\{[\s\S]*\}/);if(!match)throw Error('invalid_json');p=JSON.parse(match[0]);}
 if(!p||typeof p!=='object'||!choices.some(c=>c.id===p.actionId))throw Error('invalid_action');
 for(const key of ['goal','intent','decisionSummary'])if(typeof p[key]!=='string'||!p[key].trim())throw Error('invalid_decision');
 return {actionId:p.actionId,goal:p.goal.slice(0,180),intent:p.intent.slice(0,260),decisionSummary:p.decisionSummary.slice(0,260)};
}
export function actionInput(view,a){
 const context=retrieveDecisionContext(view,a),choices=liveCandidates(view,a,context.candidates).slice(0,8).map(x=>({id:x.id,label:x.label,reason:x.job?.reason||x.explanation||null}));
 const interests=freeTimeContext(view,a);
 const input=JSON.stringify({person:a.name,homeLife:homeContext(view,a),interests:{happiness:interests.happiness,company:interests.company,enjoyment:interests.enjoyment,mastery:interests.mastery,exploration:interests.exploration},needs:context.perception.needs,weather:context.perception.weather,temperature:context.perception.temperature,location:a.position,inventory:a.inventory,relationships:context.perception.knownPeople,memories:context.memories.slice(0,5).map(m=>m.text.slice(0,170)),recentActions:context.agent.recentActions.slice(-4),choices});
 return {input,choices};
}
export function actionPayload(input,choices){return {messages:[{role:'system',content:'You are a person surviving in a physical valley. Choose one currently available action. Prioritize urgent needs, then continue useful steps toward an ongoing improvement goal and consider individual interests and recent satisfaction. Repeating a satisfied activity is less rewarding. Rest restores energy; shelter alone does not raise warmth. Consider homeLife: close relationships and a familiar home matter when choosing where to spend time and improve living conditions. Purposeful travel remains allowed. Learn from memories. Return JSON with actionId from choices, goal (short), intent (one sentence), decisionSummary (one sentence grounded in supplied facts). Never invent completed events or resources.'},{role:'user',content:input}],response_format:{type:'json_schema',json_schema:{type:'object',properties:{actionId:{type:'string',enum:choices.map(c=>c.id)},goal:{type:'string'},intent:{type:'string'},decisionSummary:{type:'string'}},required:['actionId','goal','intent','decisionSummary']}},max_tokens:180,temperature:.65};}

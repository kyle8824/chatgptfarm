import {parse} from '../cloudflare/node_modules/acorn/dist/acorn.mjs';

// Interpret a small, explicit JavaScript subset. The generated source is NEVER
// passed to eval/Function, a browser, or the Worker host. It can only calculate
// geometry and emit part descriptions; physical validation happens afterwards.
export const CONSTRUCTION_CODE_VERSION='construction-js-1';
const forbidden=new Set(['__proto__','prototype','constructor']);
class Scope{
 constructor(parent=null){this.parent=parent;this.values=new Map();}
 define(name,value,constant=false){if(forbidden.has(name)||this.values.has(name))throw Error('Invalid or repeated variable '+name);this.values.set(name,{value,constant});}
 slot(name){if(this.values.has(name))return this.values.get(name);if(this.parent)return this.parent.slot(name);throw Error('Unknown construction variable '+name);}
 get(name){return this.slot(name).value;}
 set(name,value){const slot=this.slot(name);if(slot.constant)throw Error('Cannot assign constant '+name);slot.value=value;return value;}
}
export function runConstructionCode(source,context={}){
 if(typeof source!=='string'||!source.trim()||source.length>14000)throw Error('Construction code must be 1–14000 characters');
 const ast=parse(source,{ecmaVersion:2022,sourceType:'script'}),root=new Scope(),parts=[],localArrays=new WeakSet();let fuel=16000,depth=0;
 const native=fn=>({native:fn}),math=Object.create(null);
 for(const key of ['min','max','abs','floor','ceil','round','sin','cos','sqrt'])math[key]=native((...args)=>Math[key](...args));math.PI=Math.PI;
 root.define('Math',math,true);root.define('site',structuredClone(context.site||{}),true);root.define('materials',structuredClone(context.materials||{}),true);
 root.define('part',native(spec=>{if(!spec||typeof spec!=='object'||Array.isArray(spec))throw Error('part requires an object');if(parts.length>=48)throw Error('Construction program exceeds 48 parts');const encoded=JSON.stringify(spec);if(encoded.length>3000)throw Error('Part description too large');parts.push(JSON.parse(encoded));return spec.id;}),true);
 const tick=()=>{if(--fuel<0)throw Error('Construction program exceeded its instruction budget');};
 function bounded(value){if(typeof value==='number'&&!Number.isFinite(value))throw Error('Nonfinite construction calculation');if(typeof value==='string'&&value.length>300)throw Error('Construction text calculation too long');return value;}
 function expr(n,s){tick();if(!n)return undefined;
  switch(n.type){
   case 'Literal':if(n.regex||n.bigint)throw Error('Unsupported construction literal');return bounded(n.value);
   case 'Identifier':return s.get(n.name);
   case 'ArrayExpression':{if(n.elements.length>128)throw Error('Construction array too large');const a=n.elements.map(x=>expr(x,s));localArrays.add(a);return a;}
   case 'TemplateLiteral':return bounded(n.quasis.map((q,i)=>q.value.cooked+(i<n.expressions.length?String(expr(n.expressions[i],s)):'')).join(''));
   case 'ObjectExpression':{const o=Object.create(null);if(n.properties.length>32)throw Error('Construction object too large');for(const p of n.properties){if(p.type!=='Property'||p.kind!=='init'||p.method||p.computed)throw Error('Only plain construction properties are supported');const key=p.key.name??p.key.value;if(forbidden.has(key))throw Error('Forbidden construction property');o[key]=expr(p.value,s);}return o;}
   case 'MemberExpression':{const o=expr(n.object,s),key=n.computed?expr(n.property,s):n.property.name;if(key==='push'&&Array.isArray(o)&&localArrays.has(o))return native((...v)=>{if(o.length+v.length>128)throw Error('Construction array too large');return o.push(...v);});if(forbidden.has(String(key))||o==null||!Object.hasOwn(o,key))throw Error('Unknown or forbidden construction property');return o[key];}
   case 'BinaryExpression':{const a=expr(n.left,s),b=expr(n.right,s);let v;switch(n.operator){case '+':v=a+b;break;case '-':v=a-b;break;case '*':v=a*b;break;case '/':v=a/b;break;case '%':v=a%b;break;case '<':return a<b;case '<=':return a<=b;case '>':return a>b;case '>=':return a>=b;case '===':case '==':return a===b;case '!==':case '!=':return a!==b;default:throw Error('Unsupported construction operator '+n.operator);}return bounded(v);}
   case 'LogicalExpression':{const a=expr(n.left,s);return n.operator==='&&'?(a&&expr(n.right,s)):n.operator==='||'?(a||expr(n.right,s)):n.operator==='??'?(a??expr(n.right,s)):(()=>{throw Error('Unsupported logical operator');})();}
   case 'UnaryExpression':{const a=expr(n.argument,s);if(n.operator==='!')return !a;if(n.operator==='-')return bounded(-a);if(n.operator==='+')return bounded(+a);throw Error('Unsupported construction unary operator');}
   case 'ConditionalExpression':return expr(expr(n.test,s)?n.consequent:n.alternate,s);
   case 'UpdateExpression':{if(n.argument.type!=='Identifier'||!['++','--'].includes(n.operator))throw Error('Update only local numeric variables');const old=s.get(n.argument.name),v=bounded(old+(n.operator==='++'?1:-1));if(typeof old!=='number')throw Error('Numeric update required');s.set(n.argument.name,v);return n.prefix?v:old;}
   case 'AssignmentExpression':{if(n.left.type!=='Identifier'||!['=','+=','-='].includes(n.operator))throw Error('Assignment only to local variables');const b=expr(n.right,s),v=n.operator==='='?b:n.operator==='+='?s.get(n.left.name)+b:s.get(n.left.name)-b;return s.set(n.left.name,bounded(v));}
   case 'CallExpression':{if(n.arguments.length>12||n.arguments.some(a=>a.type==='SpreadElement'))throw Error('Invalid construction arguments');const fn=expr(n.callee,s),args=n.arguments.map(a=>expr(a,s));if(fn?.native)return bounded(fn.native(...args));if(!fn?.constructionFunction)throw Error('Only construction functions can be called');if(++depth>8)throw Error('Construction function nesting exceeded');const local=new Scope(fn.scope);fn.params.forEach((p,i)=>local.define(p.name,args[i]));try{return stmt(fn.body,local)?.value;}finally{depth--;}}
   default:throw Error('Unsupported construction expression '+n.type);
  }
 }
 function stmt(n,s){tick();if(!n)return null;
  switch(n.type){
   case 'Program':case 'BlockStatement':{const scope=n.type==='Program'?s:new Scope(s);for(const child of n.body){const r=stmt(child,scope);if(r)return r;}return null;}
   case 'VariableDeclaration':for(const d of n.declarations){if(d.id.type!=='Identifier')throw Error('Use named construction variables');s.define(d.id.name,expr(d.init,s),n.kind==='const');}return null;
   case 'ExpressionStatement':expr(n.expression,s);return null;
   case 'FunctionDeclaration':if(!n.id||n.async||n.generator||n.params.some(p=>p.type!=='Identifier'))throw Error('Use plain construction functions');s.define(n.id.name,{constructionFunction:true,body:n.body,params:n.params,scope:s},true);return null;
   case 'ReturnStatement':return {value:expr(n.argument,s)};
   case 'IfStatement':return stmt(expr(n.test,s)?n.consequent:n.alternate,s);
   case 'ForStatement':{const local=new Scope(s);if(n.init?.type==='VariableDeclaration')stmt(n.init,local);else expr(n.init,local);let iterations=0;while(!n.test||expr(n.test,local)){if(++iterations>128)throw Error('Construction loop exceeds 128 iterations');const r=stmt(n.body,local);if(r)return r;expr(n.update,local);}return null;}
   case 'EmptyStatement':return null;
   default:throw Error('Unsupported construction statement '+n.type);
  }
 }
 // Supplied bindings live outside the program's lexical scope, as ordinary
 // JavaScript parameters/globals would. A local `site` is not host mutation;
 // the resulting geometry is still validated against the authoritative site.
 stmt(ast,new Scope(root));return {parts,code:source,codeVersion:CONSTRUCTION_CODE_VERSION,instructions:16000-fuel};
}

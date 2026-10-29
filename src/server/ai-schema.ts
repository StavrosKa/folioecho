// Nested bounded arrays can make Gemini's decoding grammar too complex.
// Keep type/required/enum constraints in the provider schema, describe list
// bounds there, and enforce the original schema on every returned response.
export function geminiSchema(schema:Record<string,any>):Record<string,any> {
  const visit=(value:any):any=>{
    if(Array.isArray(value))return value.map(visit);
    if(!value||typeof value!=='object')return value;
    const result:Record<string,any>=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,visit(item)]));
    if(result.type==='array'){
      const limits=[typeof result.minItems==='number'?`At least ${result.minItems} items.`:'',typeof result.maxItems==='number'?`At most ${result.maxItems} items.`:''].filter(Boolean);
      if(limits.length)result.description=[result.description,...limits].filter(Boolean).join(' ');
      delete result.minItems;delete result.maxItems;
    }
    return result;
  };
  return visit(schema);
}

// The bounded schema subset used by FolioEcho, independent of provider decoding.
export function matchesSchema(value:any,schema:Record<string,any>):boolean {
  if(Array.isArray(schema.enum)&&!schema.enum.includes(value))return false;
  switch(schema.type){
    case 'object': {
      if(value===null||typeof value!=='object'||Array.isArray(value))return false;
      const properties=schema.properties??{};
      if((schema.required??[]).some((key:string)=>!Object.hasOwn(value,key)))return false;
      if(schema.additionalProperties===false&&Object.keys(value).some(key=>!Object.hasOwn(properties,key)))return false;
      return Object.entries(properties).every(([key,child])=>!Object.hasOwn(value,key)||matchesSchema(value[key],child as Record<string,any>));
    }
    case 'array': return Array.isArray(value)&&!(typeof schema.maxItems==='number'&&value.length>schema.maxItems)&&!(typeof schema.minItems==='number'&&value.length<schema.minItems)&&value.every(item=>matchesSchema(item,schema.items??{}));
    case 'string': return typeof value==='string'&&!(typeof schema.maxLength==='number'&&value.length>schema.maxLength)&&!(typeof schema.minLength==='number'&&value.length<schema.minLength);
    case 'integer': return Number.isSafeInteger(value)&&!(typeof schema.minimum==='number'&&value<schema.minimum)&&!(typeof schema.maximum==='number'&&value>schema.maximum);
    case 'number': return typeof value==='number'&&Number.isFinite(value)&&!(typeof schema.minimum==='number'&&value<schema.minimum)&&!(typeof schema.maximum==='number'&&value>schema.maximum);
    case 'boolean': return typeof value==='boolean';
    case 'null': return value===null;
    default: return schema.type===undefined;
  }
}

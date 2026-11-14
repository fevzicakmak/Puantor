const text=value=>typeof value==="string"?value:"";
export const customerKey=id=>"customer:"+encodeURIComponent(id);
const legacyKey=name=>"legacy:"+encodeURIComponent(name);
const namesOf=customer=>[customer.name,...(Array.isArray(customer.previousNames)?customer.previousNames:[])].filter(value=>typeof value==="string"&&value);

// IDs are authoritative. Old name-only records can join a customer only when
// exactly one surviving customer claims that exact name (including old names).
// Ambiguous records remain a separate account; historical documents are not
// rewritten merely to display a combined statement.
export function createCustomerLedger(customers,jobs=[],payments=[]){
 const accounts=new Map(),byName=new Map();
 for(const customer of customers){
  if(!text(customer.id))continue;
  const key=customerKey(customer.id);
  accounts.set(key,{key,name:text(customer.name),customerId:customer.id});
  for(const name of namesOf(customer)){
   if(!byName.has(name))byName.set(name,new Set());
   byName.get(name).add(key);
  }
 }
 const keyFor=record=>{
  if(text(record.customerId))return customerKey(record.customerId);
  const name=text(record.customerName),matches=byName.get(name);
  return matches?.size===1?[...matches][0]:legacyKey(name);
 };
 for(const record of [...jobs,...payments]){
  const key=keyFor(record);
  if(!accounts.has(key))accounts.set(key,{key,name:text(record.customerName)||"Müşteri belirtilmemiş",...(text(record.customerId)?{customerId:record.customerId}:{})});
 }
 const counts=new Map();
 for(const account of accounts.values())counts.set(account.name,(counts.get(account.name)||0)+1);
 for(const account of accounts.values())account.label=account.name+(counts.get(account.name)>1?(account.key.startsWith("legacy:")?" (eski kayıt)":" ("+account.customerId+")"):"");
 return {
  accounts:[...accounts.values()].sort((a,b)=>a.label.localeCompare(b.label,"tr")||a.key.localeCompare(b.key)),
  account:key=>accounts.get(key),
  matches:(record,key)=>keyFor(record)===key,
  keyFor
 };
}

export function customerNameAvailable(name,customers,jobs,payments,exceptId){
 const normalized=text(name).trim().toLocaleLowerCase("tr");
 if(!normalized)return false;
 const same=value=>text(value).trim().toLocaleLowerCase("tr")===normalized;
 if(customers.some(c=>c.id!==exceptId&&namesOf(c).some(same)))return false;
 const ledger=createCustomerLedger(customers,jobs,payments);
 return ![...jobs,...payments].some(record=>same(record.customerName)&&(!exceptId||ledger.keyFor(record)!==customerKey(exceptId)));
}

export function csvCell(value){
 // Spreadsheet applications execute formula prefixes even in quoted cells.
 let string=String(value??"");
 if(typeof value!=="number"&&/^[\s\uFEFF]*[=+\-@\t\r\n]/.test(string))string="'"+string;
 return '"'+string.replaceAll('"','""')+'"';
}

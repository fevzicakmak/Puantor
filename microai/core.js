/* MikroAI Core v0.1 — independent, read-only, no external AI dependency.
   All data must be supplied by an authenticated host application. */
export function normalize(value){
 return String(value??"").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}
export function timestamp(value){
 if(value?.toMillis)return value.toMillis();
 if(typeof value?.seconds==="number")return value.seconds*1000;
 if(typeof value==="number")return value;
 if(typeof value==="string"){const n=Date.parse(value);return Number.isFinite(n)?n:0}
 return 0;
}
export function workingMs(machine,now=Date.now()){
 const elapsed=Math.max(0,Number(machine?.elapsedMs)||0);
 const start=timestamp(machine?.startedAt);
 return elapsed+(machine?.status==="running"&&start?Math.max(0,now-start):0);
}
export function formatDuration(ms){
 const sec=Math.floor(Math.max(0,Number(ms)||0)/1000);
 return [Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(x=>String(x).padStart(2,"0")).join(":");
}
export function amount(ms,rate){
 return Math.round(Math.floor(Math.max(0,Number(ms)||0)/1000)*Math.max(0,Number(rate)||0)/3600*100)/100;
}
const statusNames={running:"çalışıyor",paused:"bekliyor",broken:"arızalı",done:"tamamlandı",idle:"hazır"};
function matches(item,query){
 const keys=[item.machineName,item.plaka,item.plate,item.machineId,item.id,item.operatorName,item.customerName];
 return keys.some(x=>x&&normalize(x).includes(query));
}
function customerMatch(item,customer){return !customer||normalize(item.customerName)===normalize(customer)}
function parseQuery(text){
 const q=normalize(text);
 const date=String(text).match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
 const day=date?`${date[3]}-${date[2].padStart(2,"0")}-${date[1].padStart(2,"0")}`:null;
 return {q,day,kind:/rapor|ozet|dokum|ekstre/.test(q)?"report":/sure|saat|kac saat|ne kadar calis/.test(q)?"duration":/ariza|bozuk/.test(q)?"broken":/bekle|durakla/.test(q)?"paused":/tamamlan|biten/.test(q)?"done":/calis|aktif/.test(q)?"running":"status"};
}
export function createCore({getSnapshot,getRole,limit=100}){
 const memory=[];
 function ask(text,{customer}={}){
  const role=getRole();
  if(!["admin","manager","operator"].includes(role))return {ok:false,text:"Yetkiniz doğrulanamadı."};
  const snapshot=getSnapshot()||{},parsed=parseQuery(text);
  let machines=Array.isArray(snapshot.machines)?snapshot.machines:[];
  let jobs=Array.isArray(snapshot.jobs)?snapshot.jobs:[];
  if(role==="operator"){
   const uid=snapshot.userUid;
   machines=machines.filter(m=>m.operatorUid===uid);
   jobs=jobs.filter(j=>j.operatorUid===uid);
  }
  machines=machines.filter(m=>customerMatch(m,customer));
  jobs=jobs.filter(j=>customerMatch(j,customer));
  const q=parsed.q;
  const tokens=q.split(" ").filter(x=>x.length>2&&!["makine","operator","calisma","suresi","raporu","rapor","goster","gore","listele","toplam","nedir","kadar","kac","saat","olan","hangi","isler","isleri"].includes(x));
  const found=machines.filter(m=>tokens.some(t=>matches(m,t)));
  const foundJobs=jobs.filter(j=>tokens.some(t=>matches(j,t)));
  const named=found.length||foundJobs.length;
  const scope=named?found:machines;
  const historical=named?foundJobs:jobs;
  const dayFilter=j=>!parsed.day||new Date(timestamp(j.completedAt||j.archivedAt)).toISOString().slice(0,10)===parsed.day;
  const records=historical.filter(j=>!parsed.day||(timestamp(j.completedAt||j.archivedAt)&&dayFilter(j)));
  const now=Date.now();
  const totalLive=scope.reduce((s,m)=>s+workingMs(m,now),0);
  const totalHistory=records.reduce((s,j)=>s+Math.max(0,Number(j.elapsedMs)||0),0);
  const sum=records.reduce((s,j)=>s+amount(j.elapsedMs,j.hourlyRate),0);
  const money=new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"});
  let answer;
  if(parsed.kind==="report"){
   answer=`Rapor: ${scope.length} makine, ${records.length} arşivlenmiş iş. Makine üzerindeki net süreler toplamı: ${formatDuration(totalLive)}. Arşivlenen işlerin net süresi: ${formatDuration(totalHistory)}. Bilinen saatlik ücretlere göre hesaplanan arşiv tutarı: ${money.format(sum)}. Bu iki süre farklı kayıt kümelerine aittir; birlikte toplanmadı.`;
  }else if(parsed.kind==="duration"){
   answer=`Makine kayıtlarındaki net çalışma: ${formatDuration(totalLive)}. Arşivlenmiş ${records.length} işin net çalışması: ${formatDuration(totalHistory)}. Bekleme süreleri çalışma süresine dahil değildir.`;
  }else{
   const statuses=parsed.kind==="status"?["running","paused","broken","done","idle"]:[parsed.kind];
   const list=scope.filter(m=>statuses.includes(m.status)).slice(0,limit);
   answer=list.length?list.map(m=>`${m.machineName||m.plaka||m.id||"Makine"} — ${m.operatorName||"Operatör atanmadı"} ${statusNames[m.status]||m.status}; net ${formatDuration(workingMs(m,now))}`).join("\n"):"Bu sorguya uygun makine kaydı bulunamadı.";
  }
  const result={ok:true,text:answer,counts:{machines:scope.length,jobs:records.length},source:"Firebase oturum verileri",at:now};
  memory.push({question:String(text).slice(0,500),answer:answer.slice(0,3000),at:now});
  if(memory.length>12)memory.shift();
  return result;
 }
 return {ask,history:()=>memory.map(x=>({...x})),clearHistory:()=>{memory.length=0}};
}

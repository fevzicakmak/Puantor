// Puantör v1: telefon makineye sabitlenmişken hareket tabanlı otomatik başlangıç.
// Tahmini sinyal: bu modül motor açık/kapalı durumunu kesin olarak ölçmez.
export class MachineMotionDetector {
  constructor(onUpdate, onDetected) {
    this.onUpdate=onUpdate; this.onDetected=onDetected;
    this.running=false; this.samples=[]; this.baseline=[]; this.detectedAt=0;
    this.lastTrigger=0; this.motionListener=this.handleMotion.bind(this);
    this.visibilityListener=()=>{if(document.hidden){this.detectedAt=0;this.report("Sayfa arka planda: otomatik algılama duraklatıldı");}};
    this.lastReport=0;this.lastSample=0;
  }
  report(message, extra={}){this.onUpdate({message,...extra});}
  async start(){
    if(this.running)return true;
    if(!window.isSecureContext || !("DeviceMotionEvent" in window)){
      this.report("Bu cihaz/tarayıcı hareket sensörünü desteklemiyor veya HTTPS gerekli.");return false;
    }
    try {
      if(typeof DeviceMotionEvent.requestPermission==="function"){
        const permission=await DeviceMotionEvent.requestPermission();
        if(permission!=="granted"){this.report("Hareket sensörü izni verilmedi.");return false;}
      }
      this.samples=[];this.baseline=[];this.detectedAt=0;this.running=true;
      window.addEventListener("devicemotion",this.motionListener,{passive:true});
      document.addEventListener("visibilitychange",this.visibilityListener);
      this.report("Kalibrasyon yapılıyor: telefonu sabit bırakın (8 saniye)…");
      return true;
    }catch(e){this.report("Sensör başlatılamadı: "+e.message);return false;}
  }
  stop(){
    this.running=false;this.detectedAt=0;this.samples=[];this.baseline=[];
    window.removeEventListener("devicemotion",this.motionListener);
    document.removeEventListener("visibilitychange",this.visibilityListener);
    this.report("Otomatik algılama kapalı.");
  }
  handleMotion(e){
    if(!this.running||document.hidden)return;
    const now=performance.now();
    if(now-this.lastSample<100)return;this.lastSample=now;
    const a=e.acceleration||e.accelerationIncludingGravity;
    if(!a||![a.x,a.y,a.z].some(Number.isFinite))return;
    const v=[a.x||0,a.y||0,a.z||0];
    const mag=Math.hypot(...v);
    // accelerationIncludingGravity kullanılırsa durağan yerçekimi bileşeni
    // kısa pencereli ortalama ile çıkarılır.
    this.samples.push({t:now,mag});
    this.samples=this.samples.filter(s=>now-s.t<=1500);
    if(this.samples.length<6)return;
    const mean=this.samples.reduce((sum,s)=>sum+s.mag,0)/this.samples.length;
    const rms=Math.sqrt(this.samples.reduce((sum,s)=>sum+(s.mag-mean)**2,0)/this.samples.length);
    if(this.baseline.length<60){
      this.baseline.push(rms);
      if(now-this.lastReport>1000){this.report("Kalibrasyon: "+Math.round(this.baseline.length/60*100)+"%");this.lastReport=now;}
      return;
    }
    const sorted=[...this.baseline].sort((a,b)=>a-b);
    const noise=sorted[Math.floor(sorted.length/2)]||0;
    // Makine tipine göre saha testinde ayarlanacak başlangıç eşiği.
    const threshold=Math.max(0.15,noise*3.5);
    const moving=rms>threshold;
    if(moving){if(!this.detectedAt)this.detectedAt=now;}
    else this.detectedAt=0;
    const sustained=this.detectedAt?now-this.detectedAt:0;
    if(now-this.lastReport>1200){
      this.report(moving?"Titreşim/hareket algılanıyor":"Belirgin hareket yok",
        {rms:Number(rms.toFixed(3)),threshold:Number(threshold.toFixed(3)),seconds:Math.floor(sustained/1000)});
      this.lastReport=now;
    }
    if(sustained>=12000 && now-this.lastTrigger>60000){
      this.lastTrigger=now;this.detectedAt=0;
      this.onDetected();
    }
  }
}

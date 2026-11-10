// Pilot sezgisel skorlayıcı. 0–100 puan olasılık veya doğrulanmış güven değildir.
// Eşikler örnek sahadan kalibre edilene kadar yalnızca gözlem amacıyla kullanılır.
export function classifyMotion({rms,gyro,accelThreshold,gyroThreshold,mode="machine",seconds=0,stale=false,calibrating=false}={}){
 if(stale)return {state:"sensor_lost",label:"Sensör bağlantısı kesildi",score:0,ready:false};
 if(calibrating)return {state:"calibrating",label:"Kalibrasyon",score:0,ready:false};
 if(!Number.isFinite(rms)||!(accelThreshold>0))return {state:"unknown",label:"Ölçüm yetersiz",score:0,ready:false};
 const accelRatio=Math.max(0,rms/accelThreshold);
 const gyroRatio=Number.isFinite(gyro)&&gyroThreshold>0?Math.max(0,gyro/gyroThreshold):null;
 const accelScore=Math.min(1,accelRatio/2);
 const rotationScore=gyroRatio===null?0:Math.min(1,gyroRatio/2);
 // İvme öncelikli, dönüş destekleyici. Jiroskop olmayan cihaz düşük güvenle çalışır.
 let score=Math.round(100*(0.75*accelScore+0.25*rotationScore));
 if(gyroRatio===null)score=Math.min(score,74);
 if(mode==="wrist")score=Math.min(score,79); // elde/kol bandı çalışma kanıtı değil
 let state="still",label="Hareketsiz";
 if(accelRatio>=1|| (gyroRatio!==null&&gyroRatio>=1)){
  state="motion_candidate";label=mode==="wrist"?"Kol hareketi adayı":"Makine hareketi adayı";
 }else if(accelRatio>=0.55){
  state="vibration";label="Hafif titreşim";
 }
 const ready=state==="motion_candidate"&&seconds>=12;
 return {state,label,score,ready,accelRatio:+accelRatio.toFixed(2),gyroRatio:gyroRatio===null?null:+gyroRatio.toFixed(2)};
}

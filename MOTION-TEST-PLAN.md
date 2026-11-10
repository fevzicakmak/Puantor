# Puantör hareket algılama pilotu — saha test planı

## Koruma kuralları
- Ana dal ve canlı uygulama değiştirilmeyecek. Pilot ayrı geliştirme dalında.
- Bilek modu sadece gözlem; asla otomatik çalışma başlatma.
- Makine modu da bilek modu da yalnızca gözlem üretir; otomatik başlatma bu pilotta tamamen kapalıdır.
- Otomatik duraklatma, bitirme veya arıza oluşturma yok.
- Sensörler tek başına motorun açık olduğunu veya gerçek çalışma yapıldığını kanıtlamaz.
- Gerçek faturalama verisi oluşturmayacak ayrı test görevi ve test makinesiyle dene.

## Test matrisi (her biri birkaç kez)
| Koşul | Makineye sabit | Kola/bileğe sabit |
| --- | --- | --- |
| Motor kapalı / operatör hareketsiz | yanlış başlangıç 0 hedefi | hareket kaydı düşük |
| Motor rölanti | titreşim profili kaydı | yürümeye kıyas |
| Kepçe kazı/dönüş | 12 sn eşik davranışı | kol hareket örüntüsü |
| Operatör yürüyüşü | telefon sabit kalmalı | yanlış pozitif analizi |
| Telefon elle oynatıldı | yanlış başlatma riski | gözlem |
| Ekran kilidi / Safari arka plan | ölçüm duraklamalı | ölçüm duraklamalı |
| Yetkili iş yok | otomatik başlatma reddedilmeli | yalnızca gözlem |
| İş bitirildi / makine değişti | ölçüm durmalı | ölçüm durmalı |

## Güvenlik
- Telefon düşmeyecek, görüşü kapatmayacak, pedallara/kumandalara müdahale etmeyecek şekilde sabitlenmeli.
- Hareket halindeki ekipmana telefon takma/çıkarma yapılmamalı. Kol/bilek aparatı kumandalara takılmamalı.
- İşletme ve saha güvenliği sorumlusu aparat yerleşimini onaylamalı.

## Bilinen sınırlamalar / sonraki aşama
- Web devicemotion tarayıcı iznine, HTTPS'e, cihaz sensör desteğine bağlı.
- iPhone Safari arka plan ölçümü güvenilir değil. Kesintisiz takip için native uygulama gerekebilir.
- İvme büyüklüğü pencere varyansını kullanır; GPS veya gerçek CAN/OBD motor telemetrisi henüz yok.
- Sabit titreşim, düşük genlik ve başka kaynaklar yanlış/eksik tespit üretebilir.
- Gerçek saha verileri ile sınıflandırıcı; güven puanı, otomatik başlatma öncesi doğrulama ve merkezi veri şeması sonraki aşamadır.

## Pilot v3 — saha etiketleri ve skor
- Algoritma ivmeölçer/jroskop oranlarını 0–100 **sezgisel sinyal puanına** dönüştürür; bu yüzde olasılığı değildir.
- Operatör, motor kapalı / rölanti / kazı / ilerleme / yürüyüş / telefon oynatma seçeneklerinden gerçeği işaretler.
- CSV artık tahmini sınıfı, sinyal puanını ve operatör etiketini içerir. CSV yalnızca kullanıcı indirirse kalıcı olur.
- Gerçek çalışma zamanı, Firebase kayıtları ve ücretlendirme etkilenmez.
- Skorun güvenirliği gerçek saha verileri olmadan ileri sürülemez. Sınıf ayrımı makine tipine göre doğrulanmalıdır.
- Örnek otomatik testler: `node --test motion-classifier.test.mjs` (Node sürümüne göre .js ES modül algısı gerekebilir).

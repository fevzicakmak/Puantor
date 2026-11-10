# Puantör hareket algılama pilotu — saha test planı

## Koruma kuralları
- Ana dal ve canlı uygulama değiştirilmeyecek. Pilot ayrı geliştirme dalında.
- Bilek modu sadece gözlem; asla otomatik çalışma başlatma.
- Makine modu yalnızca yönetici tarafından atanmış, jobReady=true ve idle/paused görevde otomatik başlatmayı deneyebilir.
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

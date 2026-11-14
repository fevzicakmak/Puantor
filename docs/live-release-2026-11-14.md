# Puantör canlı yayın — 14 Kasım 2026

Kullanıcı staging sürümünü onayladıktan sonra canlı yayın açıkça yetkilendirildi.
Onaylanan ekranların HTML/CSS yapısı ve görev → çalışma → arşiv → tahsilat
akışı korundu. İş kayıtlarına veri taşıma/silme işlemi uygulanmadı.

Canlı giriş: https://fevzicakmak.github.io/Puantor/giris.html

## Uygulanan sıra ve kanıt

1. Yayın izinleri kontrol edildi ve mevcut Firestore release/kural kaynağı
   geri dönüş için kaydedildi:
   https://github.com/fevzicakmak/Puantor/actions/runs/43635835491.
2. Yalnızca altı uygulama Functions'ı yayınlandı, Firebase callable çağrı
   politikaları düzenlendi ve oturumsuz çağrıların handler'ın JSON Auth/input
   hatasını döndürdüğü doğrulandı. Bu aşamada Firestore kuralları değişmedi:
   https://github.com/fevzicakmak/Puantor/actions/runs/43636461027.
3. PR #4 birleştirildi. GitHub Pages ve yayın commit'inin kontrolleri geçti:
   https://github.com/fevzicakmak/Puantor/actions/runs/43636735925
   ve https://github.com/fevzicakmak/Puantor/actions/runs/43636736274.
   Yayın commit'i `76b6a8bba93d5c61db176427b949d5eb4c6cc5a1`.
4. Dört uygulama ekranı, giriş sayfası, iki ortak modül ve Firebase
   yapılandırmasının canlıdan indirilen içeriği, staging'de onaylanan kaynakla
   byte düzeyinde karşılaştırıldı. Tamamı eşleşti.
5. Ekranlar yayımlandıktan sonra onaylanan Firestore kuralları etkinleştirildi:
   https://github.com/fevzicakmak/Puantor/actions/runs/43637076708.
6. Etkin kurallar tekrar salt okunur alınıp onaylanan `firestore.rules`
   dosyasıyla birebir karşılaştırıldı:
   https://github.com/fevzicakmak/Puantor/actions/runs/43637336166.

Onaylanan uygulama kaynağı: `94c7252eebc7937be0763889cc7285c381a685b7`.
Canlı etkin kural SHA256:
`7adfac7453638d886b7adb06da61762959ed6a44c38c6b5e26da3ac995281d71`.

## Geri dönüş hazırlığı

Önceki ruleset:
`projects/puantor-live/rulesets/6a5c7ddf-e94e-458c-8bd7-ba580fc5fcf3`.
GitHub artifact: `live-pre-release-rules-43635835491` (ID `14129942866`).
Çalışma alanı kopyası: `/workspace/puantor-inceleme/live-backup/`.
Önceki uygulama commit'i: `70743be107977001a3256ec504051affff4bf06b`.
Eski ekranlar geri alınırsa eski operatör yazma modeliyle uyumlu kurallar da
birlikte değerlendirilmelidir. Veri geri yüklemesi yapılmadı ve gerekmedi.

## Canlı doğrulamanın kapsamı

Gerçek Chromium mobil görünümünde canlı giriş ve kayıt formları açıldı;
tarayıcı hatası veya veri yazma isteği oluşmadı. Canlıya deneme hesabı,
iş, tahsilat veya müşteri eklenmedi. Oturumlu iş akışları aynı kaynakla
gerçek staging üzerinde ve yerel emülatörlerde daha önce doğrulanmıştı.

Mevcut açık sekmeler yeni sürümü almak için bir kez yenilenmelidir.
Kök `index.html` içindeki eski yerel sürüm ve tarayıcıdaki yerel kayıtlar
değiştirilmedi; Firebase uygulaması mevcut `giris.html` adresinden açılır.

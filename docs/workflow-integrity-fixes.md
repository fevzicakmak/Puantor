# Formları koruyan iş akışı düzeltmeleri

Temel: `70743be107977001a3256ec504051affff4bf06b`.
Dal: `fix/preserve-ui-workflow-integrity`.

## Değişiklikler

- Yönetici ve operatör formlarının görünür HTML'i ve CSS'i korundu. Mevcut
  görev atama → başlat/duraklat/arıza/bitir → yönetici arşivi → yeni görev
  sırası ve ücret/yol ücreti hesabı korunuyor.
- `operatorWorkState` çağrısı kimliği, rolü, firma kapsamını ve makine
  atamasını doğrular. Süre ve geçmiş istemciden kabul edilmez; sunucu saatiyle
  transaction içinde üretilir. Yeni iş için `jobReady == true` gerekir.
- İşlem kimliği, kaybolan yanıt sonrası aynı isteğin iki kez uygulanmasını
  önler. Beklenen makine durumu ve zaman damgası eski ekranlardan gelen
  işlemleri reddeder. Makine ve operatörün aktif işi aynı transaction'da yazılır.
- Yapay 250 hareket sınırı kaldırıldı; önceki hareketler korunarak bitirme
  kaydı eklenir. Mevcut çalışan işlerin nanosaniye hassasiyetindeki eski
  başlangıç zamanları da desteklenir.
- `assignOperatorWork` mevcut görev formundaki aynı alanları alır. Güncel
  atamaları sunucudan sorgular, önceki operatörün atama listelerini temizler,
  yeni operatörün eski liste kalıntılarını güncel atamalarla değiştirir.
  Gerçekte devam eden/arşivlenmemiş başka iş varsa yeni görev engellenir.
- Tek şirketli operatör ekranı da profil atamalarını canlı izler.
- Firma panelinde ad değiştirme doğru firma koleksiyonunu kullanır.
- Operatörün doğrudan süre, geçmiş ve aktif makine yazması kapatıldı. Rolü
  olmayan kullanıcının eski kök iş arşivine kayıt ekleme açığı kapatıldı.
- Firma ve kök tahsilatlarında ortak alan/tür/tutar doğrulaması uygulanır;
  tarihi yedeklerden geri yükleme desteklenir, müşteri ve oluşturma tarihi
  düzenlemeyle değiştirilemez.
- CI artık main/fix/feature push'larında ve PR'larda bütün JavaScript'i,
  Firestore kurallarını ve sunucu iş akışını kontrol eder. Bağımlılık kilit
  dosyaları eklendi; staging yayın paketine ortak operatör modülü dahil edildi.

## Doğrulama

Node 22 ve Java 21 ile:

```sh
npm ci
npm run check
npm test
npm ci --prefix functions
```

Test projesi: `puantor-tenant-rules-test`, yalnızca yerel Firestore emülatörü.
Testlerde firma ayrımı, yetkisiz yazmalar, negatif tahsilat, tekrar gönderim,
eşzamanlı başlatma, eski ekran isteği, eski atamalar, 250 hareket sonrası
bitirme, iki iş modelinde tam görev/arşiv döngüsü ve tutar hesabı kontrol edilir.

Değiştirilen dört ekranın scriptler çıkarıldıktan sonra kalan HTML/CSS
içeriği temel commit ile birebir karşılaştırıldı. Fiziksel iPhone/Android ve
oturumlu tarayıcı uçtan uca testleri henüz yapılmadı.

## Yayın sırası

Bu dal henüz canlıya yayınlanmadı. Veriler taşınmadı veya silinmedi.
Mevcut `firebase-config.js` canlı projeyi gösterdiği için bu dalı olduğu gibi
denemek amacıyla canlı hesaplarla kullanmayın. Ayrı staging yapılandırmasıyla
test edin.

1. Staging'de Functions, güncel HTML/ortak modül ve kuralları birlikte test edin.
2. Üretim yayını ayrıca kararlaştırıldığında önce `operatorWorkState` ve
   `assignOperatorWork` fonksiyonlarını yayınlayın.
3. Ortak `operator-actions.js` dosyasıyla birlikte dört güncel ekranı yayınlayın.
4. Yeni ekranların çalıştığı doğrulandıktan sonra Firestore kurallarını yayınlayın.
   Kurallar sıkılaştırıldığında eski açık operatör sekmeleri yenilenmelidir.

Yalnızca HTML'i yeni fonksiyonlar yayınlanmadan yayınlamak görev işlemlerini
bozar. Yalnızca yeni kuralları eski operatör ekranlarıyla yayınlamak da doğrudan
istemci yazmalarını engeller. Geri dönüşte eski ekranlar ve eski kurallar
uyumlu olarak geri alınmalıdır; yeni fonksiyonları kaldırmak gerekmez.

## Kalan işler ve sınırlar

- Müşteri kimliğine geçiş, eski cari hesapların eşlenmesi, yarım işletme
  kaydını tamamlama, geçmiş sayfalama ve mali değişiklik denetim izi bu
  düzeltme grubunun dışında kaldı. Bunlar ayrı, veri koruyan değişikliklerdir.
- Hareket geçmişi uyumluluk için aynı dokümanın dizisinde kalır. 250 sınırı
  kalkmıştır fakat Firestore'un 1 MiB doküman sınırı devam eder. Çok uzun
  görevler için geçmişin sayfalı alt koleksiyona taşınması ayrıca tasarlanmalı;
  mevcut arşiv, PDF, yedek ve geri yükleme akışları birlikte güncellenmelidir.
- Tekrar gönderim belgeleri `users/{uid}/workRequests/{requestId}` altında
  sunucu tarafından yazılır; istemci erişimi kapalıdır. Bu sürüm otomatik TTL
  silme politikası kurmaz; saklama/maliyet politikası ayrıca belirlenmelidir.
- Firma yöneticisinin mevcut makine/arşiv yönetim yetkileri korunmuştur.
  Bütün koleksiyonlar için yeni, katı bir şema veya değişmez muhasebe defteri
  uygulandığı iddia edilmemektedir.

## Security Rules review note

I've set up prototype Security Rules to keep the data in Firestore safe. They
are designed to be secure for blocking operator-written runtimes and history,
rejecting unauthorized archive creation, and validating payment writes within
the correct company. However, you should review and verify them before broadly
sharing your app. If you'd like, I can help you harden these rules.

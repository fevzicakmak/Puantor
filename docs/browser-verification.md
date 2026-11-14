# Puantör tarayıcı doğrulaması

14 Kasım 2026. Akış: mevcut kayıt/giriş ekranı → Firebase Auth ve callable
Functions → Firestore → yönetici/operatör ekranı → arşiv ve müşteri ekstresi.

## Ortam

- Gerçek Chromium, 390×844 mobil görünüm; fiziksel iPhone/Safari değildir.
- Auth, Functions, Firestore ve Hosting emülatörleri; proje `demo-puantor-e2e`.
- Ekranlar kaynak dosyalardan üretilir. Yalnızca test paketinde SDK getter'ları
  yerel emülatörlere bağlanır. Uygulama fonksiyonları, kimlik doğrulaması ve
  veri erişimi taklit edilmez.
- Üretim yapılandırması test paketine kopyalanmaz. Tarayıcıdan yalnızca yerel
  emülatörler ve statik Firebase SDK modülleri için gstatic erişimine izin
  verilir; diğer ağ hedefleri test tarafından engellenir.

## Doğrulanan sınırlar

| Sınır | Sonuç | Kanıt |
| --- | --- | --- |
| Ekran → Auth | Başarılı | Firma ve operatör gerçek giriş formlarıyla oturum açtı. |
| Ekran → Functions | Başarılı | `completeBusinessRegistration`, `tenantOperatorAdmin`, `assignOperatorWork`, `operatorWorkState` gerçek HTTP çağrılarıyla çalıştı. |
| Functions → Firestore | Başarılı | Sunucu süreleri, durumlar, müşteri kimliği ve hareket sırası veritabanından doğrulandı. |
| Firestore → açık operatör ekranı | Başarılı | Başlangıçta atamasız operatör sayfa yenilenmeden yeni görevi aldı. |
| Çalışma → tamamlanma | Başarılı | Başlat → duraklat → devam → arıza → devam → bitir; ekran da Tamamlandı durumuna geçti. |
| Tamamlanma → arşiv | Başarılı | Müşteri kimliği korundu; çalışma süresi, saatlik ücret ve yol ücreti toplamı doğrulandı. |
| Cari hesap → isim değişimi | Başarılı | Tahsilat müşteri kimliğiyle yazıldı; müşteri yeniden adlandırıldığında seçili hesap ve bakiye korundu. |
| Ekstre → çıktı | Başarılı | Gerçek PDF/yazdırma penceresi açıldı, yeni müşteri başlığı doğrulandı, CSV indirildi. |
| Firma B → Firma A | Erişim reddedildi | B'nin paneli boştu; A'nın mevcut müşteri belgesine doğrudan Firestore okuması permission-denied döndürdü. |

Başarılı denemede beklenmeyen tarayıcı hatası, başarısız ağ isteği ve üretim
hedefine istek sayısı **0** idi. Sayfa değişiminde iptal edilen isteğe bağlı
saat kontrolü ve kapanan Firestore dinleme kanalları ağ arızası sayılmaz.

## Bulunan ve düzeltilen sorunlar

1. Functions emülatöründe `admin.firestore.Timestamp` bağımlılığı undefined
   geldiği için ilk işletme kaydı functions/internal dönüyordu. Timestamp,
   FieldValue ve getFirestore resmî `firebase-admin/firestore` modülünden
   alınacak şekilde düzeltildi. Gerçek callable kayıt/görev/çalışma akışları
   düzeltmeden sonra geçti.
2. Biten işte profil aboneliği makine aboneliğini kaldırdığında eski Çalışıyor
   etiketi ekranda kalabiliyordu. Bitirme yanıtındaki sunucu süresi ve
   Tamamlandı durumu aynı mevcut alanlara yazılır. Tarayıcı testi bu durumu
   ayrıca kontrol eder; görünür HTML/CSS yapısı değişmedi.

## Tekrar çalıştırma

Node 22, Java 21 ve Chromium gerekir:

```sh
npm ci
npm ci --prefix functions
npx playwright install --with-deps chromium
npm run test:e2e
```

Bu ortamın Chromium sertifika deposu gstatic sertifikasını tanımadığı için
yerel denemede `PUANTOR_E2E_IGNORE_HTTPS_ERRORS=1` yalnızca test tarayıcısı
bağlamında kullanıldı. Varsayılan kapalıdır; üretim uygulamasının TLS
ayarları değiştirilmez. Testin ağ hedefi kısıtlaması bu durumda da etkindir.

Ekran görüntüleri ve sonuç: `test-results/browser/operator-mobile.png`,
`manager-mobile.png`, `statement.csv`, `result.json`. CI bunları
`browser-e2e-evidence` adıyla saklar.

## Gerçek staging doğrulaması

Test yayını: https://puantor-staging.web.app

Başarılı dağıtım ve uç nokta kontrolü:
https://github.com/fevzicakmak/Puantor/actions/runs/43632122583

14 Kasım 2026 tarihinde gerçek staging üzerinde Chromium mobil görünümünde
mevcut formlardan ayrı bir deneme işletmesi oluşturularak şu zincir doğrulandı:

- Gerçek Firebase Auth kaydı, firma oluşturma ve yönetici/operatör girişi.
- Makine, müşteri ve operatör oluşturma; SMS taslağı gönderilmedi.
- Açık operatör ekranına sayfa yenilenmeden yeni görev gelmesi.
- Başlat → duraklat → devam → bitir; veritabanındaki süre, durum ve hareket sırası.
- Yönetici arşivi, müşteri kimliğinin korunması, tahsilat ve isim değişimi
  sonrasında aynı hesap bakiyesi.
- Gerçek PDF penceresi ve CSV indirme.

Beklenmeyen tarayıcı hatası ve üretim hedefine istek sayısı 0. Staging
istemci yapılandırmasında projectId ve authDomain ayrıca doğrulandı.
Deneme verileri yalnızca `puantor-staging` içinde, `Codex Staging Test`
ön ekiyle oluşturuldu; canlı veriler değiştirilmedi. Fiziksel cihaz/Safari doğrulaması model tarafından yapılmadı. Kullanıcı
onayından sonra üretim dağıtımı da tamamlandı; canlı kanıtları
`docs/live-release-2026-11-14.md` içinde. İki firma arasındaki negatif erişim
senaryosu yerel demo/emülatör testinde doğrulandı.

Staging ekran görüntüleri ve sonuç, çalışma alanında
`/workspace/puantor-inceleme/staging/` altında tutulur.

### Yayın bağlantısı

- OIDC güven koşulu aynı repository_id, owner_id, staging environment ve
  workflow_dispatch kısıtlarını korur; ref ve workflow_ref mevcut düzeltme
  dalını hedefler.
- Kullanıcı, staging dağıtım hesabına Cloud Functions Admin rolünü ekledi.
  Önceden yarım kalmış fonksiyonların çağrı politikaları yalnızca staging
  projesindeki altı Firebase callable hizmetinde onarıldı.
- Firebase istemci token'larının handler'a ulaşması için Cloud Run invoker
  politikası Firebase callable modeline uygun ayarlanır. Veri değiştiren
  handler'ların uygulama Auth/rol denetimleri korunur. Yayın sonunda
  `scripts/verify-staging-endpoints.cjs` JSON Auth/validasyon cevaplarını
  kontrol eder; altyapıdan gelen HTML 403 başarılı sayılmaz.
- Firebase CLI 15.36.0 sabitlendi. Kullanılmayan Extensions kontrolü nedeniyle
  ek Extensions yönetici izni verilmedi.

`scripts/deploy-staging.sh` yalnızca main veya mevcut düzeltme dalından
`puantor-staging` projesine yayın yapar. Yapılandırmayı yetkili Firebase
API'sinden indirir ve yalnızca açıkça listelenmiş dosyaları paketler.
Kaynaktaki `firebase-config.js` değişmez; sıfırlama aracı pakete alınmaz.
Birden fazla staging Web App varsa `PUANTOR_STAGING_APP_ID` / GitHub
`FIREBASE_STAGING_WEB_APP_ID` seçilmelidir.

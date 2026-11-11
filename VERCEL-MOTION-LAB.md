# Puantör bağımsız laboratuvar — Vercel yayını

Bu yapılandırma yalnızca **Sensör Laboratuvarı** içindir; üretimde kullanılan Puantör sitesinin yerine geçmemelidir.

## Ayrı Vercel projesi oluşturma

1. Vercel üzerinde **yeni** bir proje açın, mevcut Puantör projesini seçmeyin.
2. Git deposu: `fevzicakmak/Puantor`.
3. Production Branch: `feature/otomatik-hareket-algilama`. Vercel projesinin üretim dalını `main` yapmayın.
4. Framework: **Other**. Depo kökündeki `vercel.json` `buildCommand` ve `outputDirectory` ayarlarını kullanır.
5. Çıktıda yalnızca `index.html` ve beş sensör JS modülü bulunur; Firebase dosyaları kopyalanmaz.
6. Vercel URL'sinde HTTPS'i, Safari hareket iznini ve cihaz sensör uyumluluğunu test edin.
7. İlk saha testini motor kapalı cihaz sabitken başlatın; motor kapalı, rölanti ve aktif kazı etiketlerini CSV'ye kaydedin.

**Önemli:** Bu depodaki `vercel.json` sadece pilot geliştirme dalındadır. Ana dal `main` ve mevcut Puantör/Firebase canlı yayınları değişmedi. Bağımsız Vercel projesinin oluşturulduğunu ve URL'nin çalıştığını doğrulamadan "yayınlandı" demeyin.

## Yayın durumu — 11 Kasım 2026
- Ayrı Vercel projesi oluşturuldu: `puantor-sensor-laboratuvari`.
- Resmî proje HTTPS alan adı: https://puantor-sensor-laboratuvari.vercel.app
- Vercel dağıtım ID: `dpl_37guL2k6jVfPqtqKenVj3cxKyUgv`; durum: `READY`.
- `index.html` ve sensör JS modülleri 200 HTTP durumuyla doğrulandı.
- Projenin Vercel Authentication (SSO), parola ve IP erişim kısıtları kapalıdır. Site herkese açıktır; kullanıcı verilerini sunucuya göndermez.
- Kaynak dosyalar GitHub geliştirme dalından doğrudan dağıtıldı; mevcut `main` dalına veya canlı Puantör projesine dokunulmadı.
- Bu oturumda gerçek iPhone sensör erişimi ve cihaz üzerindeki çalışma davranışı **henüz** sınanmadı.

## Otomatik sensör ölçümü güncellemesi (11 Kasım 2026)
- Ölçüm başlat düğmesi kaldırıldı. Destekleyen tarayıcılarda sayfa açılır açılmaz ölçüm başlar.
- iOS Safari `DeviceMotionEvent.requestPermission()` için kullanıcı etkileşimi şart koşabilir. Bu durumda sayfaya ilk dokunuş sensör izin isteğini başlatır; ayrı Başlat düğmesi yoktur.
- Sensör izni verilmezse durum açıklaması görüntülenir. Telefonda ölçüm yapılabilmesi için sayfanın ön planda olması gerekir.
- Yeni Vercel üretim dağıtımı: `dpl_C8F5TCb9UBD8GUg9tYefvGmbN2xi` (`READY`). https://puantor-sensor-laboratuvari.vercel.app HTTP 200 ve otomatik başlatma kodu doğrulandı.
- Bu otomatik **sensör ölçümüdür**; iş makinesinin çalışmasını, Firebase zaman çizelgesini veya ücretlendirmeyi otomatik olarak başlatmaz.

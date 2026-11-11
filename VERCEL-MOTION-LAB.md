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

## Otomatik saha kayıtları — 11 Kasım 2026
- Sensör örnekleri yaklaşık saniyede 1 ölçüm; kayıt kuyruğu her 5 saniyede `IndexedDB` içine kalıcılaştırılır.
- En çok 100.000 ölçüm saklanır; arşiv dolduğunda en eski örnekler silinir. Ayrıca son 1800 ölçümlük `localStorage` kısa yedeği tutulur.
- Kullanıcının elle kayıt yapması gerekmez. Operatörün gerçeği işaretlemesi (`motor_off`, `working` vb.) ise ayrı isteğe bağlı saha etiketi olarak kalır.
- Laboratuvar ekranında son arşiv sayısı ve kayıt zamanı gösterilir. Tüm arşiv CSV olarak dışa aktarılabilir.
- iPhone Safari arka planda veya ekran kilitliyken sensör verisi üretmeyi durdurabilir; o aralıklar otomatik ölçülemez.
- Kayıtlar yalnızca ilgili telefonun tarayıcısındadır, yöneticinin telefonuna veya Firebase'e aktarılmaz. Merkezi raporlama istenirse ayrı, yetkili sunucu aktarımı tasarlanmalıdır.
- Dağıtım ID: `dpl_CVPYZCPAsfCqVCovXpyjoEySyNQL`, Vercel durum: `READY`. Canlı `index.html` ve `motion-field-archive.js` HTTP 200 doğrulandı.
- GitHub Motion Pilot Tests #58: success; Package Independent Motion Lab #7: success.

## Sabit makine montajı ve ekran uyanıklığı (11 Kasım 2026)
- Sahada telefonun makinenin güvenli bir noktasına sabitlenmesi kullanım kuralıdır. Cep/bilek/elde kullanım artık bağımsız laboratuvarın seçenekleri arasında değildir.
- Laboratuvar ölçüm modunu yalnızca `machine` olarak kullanır ve sabit aparat uyarısını ekranda gösterir; yazılımın montajı **kesin şekilde doğruladığı iddia edilmez**.
- Screen Wake Lock API destekleniyorsa açık ekran isteği otomatik yapılır; izin yoksa veya API yoksa operatör uyarılır. Bu API kilitli ekranda veya Safari arka plandayken güvenilir ölçümü garanti etmez.
- Dönüşte ekran kilidi isteği yeniden denenir. Saha sorumlusu telefonu sürüşü ve kumandaları etkilemeyecek şekilde sabitlemelidir.
- Vercel dağıtım: `dpl_BGY9Zh2rBkfr7861UyHEyrNjarJ2`, READY; https://puantor-sensor-laboratuvari.vercel.app HTTP 200. Otomatik arşiv (5 sn) korunmuştur.
- GitHub Motion Pilot Tests #65 ve paketleme #10: success.

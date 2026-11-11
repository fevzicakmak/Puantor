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

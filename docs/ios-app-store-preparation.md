# Puantör iOS hazırlığı

20 Kasım 2026. Bu değişiklik bir App Store yayını değildir. Canlı Firebase
kuralları, Functions ve işletme verileri değiştirilmez.

## Hazırlanan temel

- Capacitor 8.6.2 ile yerel Xcode projesi; Swift Package Manager bağımlılıkları.
- Uygulama adı Puantör, başlangıç bundle ID `com.puantor.app`. Bu kimlik henüz
  Apple hesabında ayrılmış veya sahipliği doğrulanmış değildir; ilk yayın öncesi
  geliştirici hesabındaki App ID ile eşleştirilmelidir.
- Mevcut HTML ekranları ve iş mantığı paketlenir. `index.html` olarak güncel
  giriş ekranı kullanılır; eski localStorage uygulaması ve sıfırlama aracı alınmaz.
- SMS davetlerinde cihaz içi `capacitor://` adresi yerine herkese açık mevcut
  web giriş adresi kullanılır. Bu bağlantı uygulamayı otomatik açan Universal
  Link değildir; firma ve kullanıcı bilgileri web girişinde doldurulur.
- Giriş ekranında gizlilik ve destek bağlantıları. Sorumlu: Fevzi Çakmak;
  destek: fvzckmk35@gmail.com. Bu metinler mevcut davranışı açıklar; hukuki
  uygunluk onayı veya uygulanmış otomatik hesap silme özelliği anlamına gelmez.

## Hazırlama ve Mac'te açma

Node 22 veya üzeri gerekir. Depodaki sabitlenmiş bağımlılıkları kullanın:

```sh
npm ci
npm run test:ios
npm run ios:sync
npm run ios:open
```

Son komut macOS ve Xcode gerektirir. Xcode'da Signing & Capabilities altında
Apple Developer takımını seçin, bundle ID'yi doğrulayın, gerçek iPhone'da çalıştırın.
Archive/TestFlight adımı bu Linux ortamında çalıştırılamaz. iOS projesindeki
dağıtım hedefi 15.0'dır; bu, App Store'un gönderim için istediği Xcode/SDK sürümü
ile aynı şey değildir. Gönderim günündeki Apple gereksinimleri ayrıca kontrol edilir.

`npm run ios:sync` kaynak ekranları yeniden kopyalar; üretilen public dizinini
elle düzenlemeyin. Uygulama canlı Firebase istemci yapılandırmasını kullanır.
Test sırasında gerçek işletme verilerine yazmayın; ayrı test işletmesi/ortamı
kullanın. Firebase web yapılandırması gizli servis hesabı anahtarı değildir.

## Gönderimi engelleyen açık işler

1. Hesap silmenin fiilen tamamlanması ve destek işleyişi. Uygulama içinden
   şifreyle yeniden doğrulanan özel sunucu talebi, durum ve geri çekme akışı
   hazırlandı. Kullanıcı tercihi: işletme kayıtları korunsun, destek incelesin.
   Bu talep hesabı otomatik silmez. Tamamlanma süresi, zorunlu saklanacak
   kayıtlar, kişisel veri temizliği ve firma erişiminin devamı için destek
   prosedürü henüz tamamlanmış değildir. Sadece talep kaydetmek App Store
   hazırlığının tamamlandığı anlamına gelmez. Ayrıntı: account-deletion-requests.md.
2. Gerçek iPhone/WKWebView ve TestFlight doğrulaması. Linux'ta `cap sync` ve
   Chromium başarısı, imzalı iOS derlemesi veya fiziksel cihaz testi değildir.
3. PDF/yazdırma penceresi, Blob dosya indirme, SMS, mailto ve harici bağlantılar
   için iOS davranışının doğrulanması; gerekirse yerel paylaşım/yazdırma uyarlaması.
4. Özel uygulama ikonu ve açılış görselleri. Oluşan Capacitor şablon görselleri
   nihai Puantör marka varlıkları olarak kabul edilmemeli.
5. Geliştirici hesabı, imzalama, App Store Connect kaydı, çalışan yönetici ve
   operatör demo hesapları, örnek işler ve inceleme notları.
6. Yayımlanmış gizlilik/destek URL'leri, App Privacy beyanları, yaş derecelendirmesi,
   ihracat/şifreleme beyanı ve seçilen SDK'ların gizlilik yükümlülükleri.
   Görünen alanları tahminle doldurmayın; gerçek veri kullanımına göre doğrulayın.

## Cihaz kontrol listesi

- Kayıt, firma/yönetici ve operatör girişleri; şifre sıfırlama ve hatalı giriş.
- Görev atama; başlat, duraklat, arıza, devam, bitir; arşiv ve tahsilat.
- Ekran kilidi, arka plan, uygulamanın kapatılıp açılması ve ağ değişimi.
- İki cihazdan eşzamanlı işlem; işlem sırasında internet kesintisi ve yeniden deneme.
- Klavye, çentik/güvenli alan, yatay ekran, VoiceOver ve büyük yazı.
- PDF, CSV ve JSON yedek paylaşımı; SMS davetinin başka telefonda açılması.
- Oturumdan çıkıştan sonra önceki işletmenin bilgilerinin görünmemesi.

Firebase SDK modülleri bu ilk pakette mevcut HTTPS gstatic adreslerinden yüklenir;
ilk açılış dahil internet gerekir. Paket çevrimdışı çalışma sözü vermez. SDK'ların
yerel pakete alınması ve açık bir bağlantı hatası/yeniden deneme deneyimi ayrıca
değerlendirilmelidir. Native izinler veya arka plan çalışma yetkileri gereksiz yere
eklenmemiştir; sesli arama WKWebView'de ayrıca doğrulanmalıdır.

## Kaynaklar

- https://developer.apple.com/app-store/review/guidelines/#minimum-functionality
- https://developer.apple.com/app-store/review/guidelines/#privacy
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
- https://capacitorjs.com/docs/ios

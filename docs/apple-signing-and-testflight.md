# Apple imzalama ve TestFlight hazırlığı

21 Kasım 2026. Kullanıcı aktif Apple Developer üyeliği olduğunu bildirdi.
Team ID ve kayıtlı Bundle ID henüz doğrulanmadı. Bu hazırlık sırasında Apple
hesabına bağlanılmadı, sertifika oluşturulmadı veya TestFlight'a paket yüklenmedi.

## İki farklı derleme

Normal PR kontrolü hem iOS Simulator uygulamasını hem fiziksel iPhone için
imzasız Release `.xcarchive` dosyasını derler. Arşiv kontrolü iPhoneOS platformunu,
beklenen ekranları ve geliştirme araçlarının/özel imzalama anahtarlarının pakete
girmemesini denetler. Raporda SDK, Xcode build numarası ve uygulama kimliği vardır.
Bu kontrol imzayı doğruladığını iddia etmez. İmzasız arşiv iPhone'a kurulamaz.

`Prepare signed iOS package` ayrı ve yalnızca elle çalıştırılan bir iş akışıdır.
Normal doğrudan çalıştırmada yalnızca `main` dalında, `apple-testflight` GitHub ortamıyla çalışır. Apple
kimlikleri ve anahtarı sağlandığında otomatik provisioning ile arşiv ve
App Store Connect dağıtımına uygun `.ipa` dışa aktarmayı dener. Provisioning,
Apple hesabındaki izinlere bağlı olarak sertifika/profil oluşturabilir veya
güncelleyebilir. İş akışı TestFlight'a veya App Store'a yükleme yapmaz.

Arşivleme adımı `CODE_SIGNING_ALLOWED=NO` ile yapılır; iOS App Development
profili veya kayıtlı cihaz istemez. Apple dağıtım imzası, `app-store-connect`
yöntemiyle export sırasında uygulanır. TestFlight dağıtımı için geliştirme
cihazı UDID'si eklemek bu iş akışının gereği değildir.

Mevcut test iş akışında ayrıca kontrollü bir hazırlık yolu vardır: yalnızca elle
başlatılan `prepare_signed_package` seçeneği, `main` veya tam adı
`feat/ios-app-store-foundation` olan hazırlık dalında beş kontrolün tamamını
bekler; sonra aynı imzalama işini aynı şifreli ortamla çağırır. PR/push olayları
Apple anahtarını kullanmaz. Bu yol, canlı Pages yayınını tetiklemek için bütün
hazırlık PR’ını birleştirme zorunluluğu oluşturmaz. GitHub ortamındaki dal
kısıtları ve onay kuralları ayrıca geçerlidir; bu akış onları değiştirmez.

## Apple tarafında gereken bilgiler

1. https://developer.apple.com/account → Membership details bölümünden
   10 karakterli Team ID'yi bul.
2. Certificates, Identifiers & Profiles → Identifiers → App IDs bölümünde
   Puantör için açık bir Bundle ID kaydet. `com.fevzicakmak.puantor` bir
   adaydır; kullanılabilirliği veya sahipliği burada doğrulanmış değildir.
   Kaynak projedeki `com.puantor.app` henüz geçici bir değerdir.
3. App Store Connect → Apps → yeni uygulama kaydında aynı Bundle ID'yi seç.
   Platform iOS, uygulama adı Puantör ve dil Türkçe olabilir. SKU işletmenin
   belirlediği benzersiz bir iç kayıt kodudur.
4. App Store Connect → Users and Access → Integrations → App Store Connect API
   bölümünde bir takım API anahtarı hazırla. İlgili uygulama ile Certificates,
   Identifiers & Profiles işlemlerine gereken erişimi olmalı. İzin eksikse
   Xcode provisioning hata verir; yalnızca biçim kontrolünün geçmesi Apple
   erişiminin doğrulandığı anlamına gelmez.

## GitHub ortamı

Depoda Settings → Environments altında `apple-testflight` ortamını oluştur.
İmzalama için ortamı `main` dalıyla sınırlandır; kurumun inceleme kuralları
varsa bu ortamda uygula. Environment secrets alanına şunları kaydet:

| İsim | Değer |
| --- | --- |
| `APPLE_ASC_KEY_ID` | Apple API anahtarının 10 karakterli Key ID'si |
| `APPLE_ASC_ISSUER_ID` | Takım anahtarının Issuer ID'si (UUID) |
| `APPLE_ASC_PRIVATE_KEY` | İndirilen `.p8` dosyasının orijinal çok satırlı PEM metni |

Environment secrets tercih edilir. Aynı üç ad Repository secrets bölümüne
eklenmişse test iş akışı yalnızca bu üç Apple sırrını açıkça çağrılan imzalama
işine aktarır; bütün depo sırları devralınmaz. Aynı adlı Environment secret
varsa GitHub o ortamın değerini kullanır. Variables özel anahtar saklamak için
kullanılmaz. Eksik alan hataları yalnızca alan adlarını gösterir.

Özel anahtar GitHub'ın şifreli ortam sırrına girilir; kaynak depoya eklenmez.
Base64 dönüşümü gerekmez. İş akışı anahtarı depo dışındaki geçici dizinde 0600
izinli dosyaya yazar, açık anahtar üzerinden P-256 biçimini kontrol eder ve
sonunda geçici anahtarı kaldırır. Anahtar artifact paketine alınmaz. Apple
kimliklerini veya sertifikalarını hazırlamak bu ortamda otomatik yapılmış sayılmaz.

## İmzalı paket oluşturma

Kod incelemesi, staging doğrulaması ve `main` bütünleştirmesi tamamlandıktan sonra:

1. Actions → Prepare signed iOS package → Run workflow.
2. Kayıtlı Team ID ve Bundle ID'yi, uygulama sürümünü gir. Build numarası iş
   akışının run numarasından gelir; aynı koşuyu yeniden çalıştırmak yeni build
   numarası oluşturmaz. Yeni paket için yeni workflow koşusu başlat.
3. Başarılı olursa `ios-signed-package` artifact'ından `.ipa` ve arşiv raporunu al.

Seçilen kimlik üretilen native config ve derleme ayarlarına uygulanır; kaynak
Xcode projesi, Capacitor kimliği ve formlar değiştirilmez. Apple tarafındaki
Bundle ID'nin doğru kaydedildiği ve anahtarın gerçekten yetkili olduğu yalnızca
Apple'a bağlanan gerçek imzalama koşusunda doğrulanabilir.

Bu iş akışı Linux'ta gerçek Apple anahtarıyla çalıştırılmadı. Yerel testler
geçersiz girdileri, anahtar dosyasının konum/izinlerini, geçersiz PEM temizliğini,
export-only ayarlarını ve Simulator arşivinin iPhone arşivi diye kullanılmamasını
doğrular. Mac CI imzasız fiziksel-cihaz arşivini ayrıca derler.

## TestFlight öncesi kalan işler

- Gerçek Apple kimlikleriyle imzalı paket ve provisioning doğrulaması.
- Firebase kuralları/Functions'ın staging ve kontrollü canlı yayın doğrulaması;
  Apple imzalama iş akışı Firebase'i yayınlamaz.
- Son ikon/açılış görselleri, iPhone'da rapor paylaşımı/yazdırma/SMS davranışı.
- Gizlilik/destek URL'lerinin yayını, App Privacy beyanları ve inceleme hesapları.
- Gerçek iPhone ve TestFlight denemesi; imzalı paket üretmek mağaza onayı değildir.

TestFlight'a yükleme, uygulama ve Apple hesabı doğrulandıktan sonra ayrı bir
yayın adımı olarak ele alınmalıdır.

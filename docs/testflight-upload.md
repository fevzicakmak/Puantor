# Onaylı paketi TestFlight'a yükleme

24 Kasım 2026. Kullanıcı Puantör 1.0 (73) imzalı paketinin TestFlight'a
yüklenmesini açıkça onayladı. App Store'da herkese açık yayın veya testçilere
davet gönderme bu onayın kapsamına eklenmez.

Onaylanan paket:

- Kaynak Actions koşusu: `45021319356`.
- Artifact: `14900926812`, `ios-signed-package`.
- IPA SHA-256: `6b2f8c8242a0856ef9443fc2c08c6636f6f6bba8094a29ec0315cd55bd7b12ca`.
- Bundle ID: `com.fevzicakmak.puantor`, Team ID: `T4F4D367KQ`.
- Sürüm/build: `1.0` / `73`.

Mevcut test iş akışının elle başlatılan `upload_testflight` seçeneği, beş
kontrol geçtikten sonra `upload-testflight.yml` işini çağırır. Kaynak run ve
artifact ID, SHA-256, sürüm, build ve Apple kimlikleri açıkça verilir.
İmzalama ve yükleme seçenekleri birlikte çalıştırılmaz.

İş akışı aynı imzalı IPA'yı indirir; yeniden derlemez. Özet, kimlik ve dağıtım
profili kontrolünden önce Apple anahtarı kullanılmaz. Yalnızca tam adı onaylı
hazırlık dalı veya main üzerinde, elle çalıştırılan koşu bu işi açabilir.
Şifreli `apple-testflight` ortamı ve yalnızca gerekli üç Apple sırrı kullanılır.
Artifact indirmek için kendi depomuzda `actions: read` izni vardır.

Apple'da aynı pazarlama sürümü ve build zaten varsa yeniden yüklenmez. Yoksa
önce `altool --validate-app`, sonra `altool --upload-app` çalışır. İşlem sonunda
App Store Connect API yalnızca GET çağrılarıyla sorgulanır. İşlenmenin VALID
olması, testçi erişiminin veya dış beta incelemesinin de tamamlandığı anlamına
gelmez; beta durumu ve şifreleme beyanı ayrı raporlanır.

API anahtarı depo dışında geçici dosyada tutulur; altool'un standart anahtar
arama dizinine geçici bağlantı verilir ve iş sonunda ikisi de kaldırılır.
JWT ve özel anahtar rapora/loglara yazılmaz. Teknik doğrulama/işleme raporları
`testflight-upload-evidence` artifact'ına konur; IPA veya anahtar bu rapor
artifact'ına eklenmez.

Apple işleme hatası verirse aynı build numarasıyla körlemesine tekrar upload
yapılmamalıdır. Önce mevcut build'in durumu kontrol edilmelidir. İşleme beş
dakikadan uzun sürerse rapor bekleyen durumu korur; yükleme yapılmış olduğu
halde yalnızca işleme sürüyor diye yeni bir paket gönderilmez.

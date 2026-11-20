# Hesap silme ve kontrollü işletme kapanışı

20 Kasım 2026. Kullanıcının kararları: ticari kayıtlar korunsun; destek
incelesin; firma sahibi silindiğinde işletme kapansın ve operatör erişimi dursun.
Bu kodun hazırlanması canlı kullanıcı veya işletme silindiği anlamına gelmez.

## Kullanıcı akışı

Mevcut panellerin altındaki Hesap ve gizlilik bağlantısı `hesap.html` sayfasına
gider. Formların ve görev → çalışma → arşiv → tahsilat akışının yapısı korunur.
Kullanıcı mevcut şifresiyle Firebase Auth'ta yeniden doğrulanır. Sunucu imzalı
ID token'ın `auth_time` değerinin en fazla beş dakika önce olmasını ister.
Şifre talep belgesine veya callable gövdesine gönderilmez.

- `request`: oturumdaki kullanıcı için özel talep oluşturur. Kimlik, rol ve
  işletme istemcinin seçtiği değerlerden alınmaz. Eşzamanlı tekrarlar tek kalır.
- `status`: yalnızca oturumdaki kullanıcının durumunu ve işlem tarihlerini verir.
- `cancel`: inceleme başlamadan önce talebi geri çeker; yeniden şifre doğrulanır.
- Firma sahibi ayrıca işletmenin kapanmasını ve operatör erişiminin durmasını
  onaylar. Eski sürümde alınmış, kapanış onayı olmayan taleplerle firma kapatılamaz.

Destek incelemeye alırken önümüzdeki 30 gün içinde bir hedef tamamlanma tarihi
belirler. Bu, otomatik zamanlanmış silme değildir; kullanıcıya gösterilen destek
hedefidir. Açık iş veya saklama incelemesi süreyi etkiliyorsa destek kullanıcıyla
iletişime geçmeli, gerekirse talebi yeniden planlamak üzere beklemeye almalıdır.

## Destek işlemleri

Yalnızca mevcut uygulama destek yöneticisi `hesap.html` içindeki destek listesine
sunucudan erişebilir. Firma yöneticisi bu yetkiye sahip değildir.

- `reviewList`: 50'lik sayfalarla talepleri listeler; takip anahtarını döndürmez.
- `reviewStart`: şifre doğrulaması ve hedef tarih ile talebi incelemeye alır.
- `reviewReopen`: incelemedeki talebi beklemeye geri alır.
- `reviewComplete`: ayrı kalıcı silme düğmesi, hedef hesap onayı, yeniden şifre
  doğrulama, kayıt inceleme onayı ve 12–500 karakterlik saklama gerekçesi/süresi
  notu ister. Hesap kimliğiyle eşleşen sunucu onayı olmadan çalışmaz.
- `reviewCleanup`: şifre doğrulaması sonrasında süresi dolmuş takip belgelerini
  ve 30 günü dolmuş tamamlanmış/geri çekilmiş talepleri 100'erlik gruplarda
  temizler. Devam eden veya silinmekte olan talebi silmez. Ticari kayıt silmez.

Destek, geçmişteki operatör isimleri ve işlem açıklamaları dahil korunacak kişisel
bilgilerin gerçekten saklanmasının gerekip gerekmediğini incelemelidir. Gerekli
olmayan bilgiler tamamlamadan önce silinmeli/anonimleştirilmelidir. Bir onay kutusu
ve not, bütün ticari kayıtların hukuken saklanabileceğinin otomatik kanıtı değildir.
Uygulama tüm şirketler için tek bir yasal saklama süresi varsaymaz.

## Gerçek silme

Operatörde açık, hazırlanmış veya arşivlenmemiş iş varsa işlem durur. İş önce
mevcut akışla tamamlanıp arşivlenir. Ardından profil, operatör ve giriş takma adı
bağlantıları transaction içinde kaldırılır; boşta kalan makine bağları çözülür.
Auth kullanıcısı, kullanıcı altındaki teknik işlem belgeleri ve kişisel arama
tercihleri silinir. İş geçmişi, müşteri ve tahsilat belgeleri değiştirilmez.

Firma sahibinde bütün işletmenin açık işleri kontrol edilir. Kapanış onayı varsa
`businesses/{uid}` belgesi `accountStatus: closed` olur; `closedAt`, `closedBy`
ve `recordCustodianUid` ile korunacak kayıtların destek sorumluluğu belirtilir.
Yönetici adı kişisel hesap bilgisi yerine “Silinmiş hesap” yapılır. Firma sahibinin
Auth/profili ve kendi arama tercihleri silinir. İşletme kimliği korunur; işletme
aktif ve sahipsiz bırakılmaz, kontrollü kapalı kayıt olarak tutulur.

Üyeler `users` koleksiyonundaki doğrulanmış işletme/rol ilişkisiyle 100'lük
sayfalarda seçilir. Operatör Auth hesapları devre dışı bırakılır; başka kişilerin
hesapları bu talep nedeniyle silinmez. Yönetici tarafından düzenlenebilen
`operators.authUid` alanı tek başına başka hesabı durdurmak için kullanılmaz.
Başka firmadaki hesap ve kayıtlar etkilenmez.

Sabit uygulama destek yöneticisi bu yöntemle kendini silemez; o özel hesapta
önce uygulama yöneticisi devri gerekir.

## Kısmi hata, eski token ve yeniden deneme

Auth ve Firestore birlikte atomik silinemez. Transaction talebi `deleting` yapar
ve on dakikalık işlem kilidi alır. Profil/bağ değişiklikleri, eşzamanlı görev ve
çalışma transaction'larının yeniden denenip reddedilmesini sağlar. Yeni
Firestore yardımcıları `deleting`/`completed` hesapları ve kapalı işletmeleri
eski, henüz süresi dolmamış ID token ile de erişimden çıkarır. Kayıt callable'ı
eski token ile profili yeniden oluşturamaz. Kapalı işletmede çalışma, atama ve
operatör yönetimi callable'ları da erişimi reddeder.

Auth veya alt belge temizliği başarısız olursa durum `deleting` kalır; normal
hesap erişimi geri açılmaz. Hata yakalandığında yeniden deneme hemen açılır;
beklenmeyen süreç kapanmasında işlem kilidinin dolması beklenir. İşletme üyelerinde tamamlanan sayfaların imleci saklanır; yeniden deneme baştan başlayıp büyük işletmelerde aynı sayfaya takılmaz. Silinmiş Auth
kullanıcısı ve kısmen temizlenmiş belgeler tekrar denemeyi bozmaz. Eşzamanlı ikinci
silme işlemi engellenir. İşlemler bitmeden `completed` yazılmaz.

## Sonuç takibi ve cihaz bilgileri

Cihaz kriptografik olarak rastgele bir takip anahtarı üretir. Sunucuda yalnızca
SHA-256 özeti tutulur. `receipt` işlemi, giriş gerektirmeden bu anahtarla yalnızca
durum ve tarihleri verir; kullanıcı kimliği, e-posta, işletme veya finans verisi
vermez. Yanlış ya da talep oluşturulduktan 30 gün sonra süresi dolmuş anahtar için
aynı `unknown` sonucu döner. Anahtar URL'ye eklenmez. Koleksiyonlar istemciden
doğrudan okunamaz veya yazılamaz.

Bu, Auth hesabı kaldırıldıktan sonra kullanıcıya aynı cihazdan sonuç gösterebilir.
Anahtar kaybolmuş veya süresi dolmuşsa destek kanalı kullanılır; otomatik e-posta
veya SMS gönderimi eklenmedi. Cihazda sonuç görülünce ilgili giriş önerileri ve
arama öğrenme önbelleği temizlenir; Firebase oturumu kapatılır. Diğer hesaba ait
giriş önerileri korunur. Kullanıcı takip bilgisini ayrıca cihazdan silebilir.
Dışa aktarılmış dosyalar veya başka cihazların yerel kopyaları uzaktan silinmez.

Tamamlanan talepte e-posta kaldırılır; asgari sonuç/saklama incelemesi kaydı 30 gün
sonra bakım temizliğine uygun hale gelir. Fiziksel sunucu temizliği destek bakım
komutuyla yapılır; zamanlanmış otomatik temizlik kurulduğu iddia edilmez.
İşletme kayıtlarının saklama süresi ve gerekçesi ise bu teknik takip kaydından
ayrıdır ve destek incelemesinde uygulanmalıdır.

## Yayın kapısı ve sıralama

Kalıcı silme varsayılan kapalıdır: `PUANTOR_ENABLE_ACCOUNT_DELETION` tam olarak
`true` olmadıkça completion hiçbir veri değiştirmez. Demo ve staging için ayrı,
gizli bilgi içermeyen proje `.env` dosyaları vardır. Staging betiği önce kuralları,
sonra Functions ve Hosting'i yayınlar. Canlıda kaynak depoda etkinleştirilmiş
`.env.puantor-live` bulunmaz.

Canlı yayın iş akışında `enable_account_deletion` varsayılan false'tur. İşlevlerin
kalıcı silme etkin olarak yayınlanması için `prepare-deletion-release.py`,
Google'dan alınan etkin kuralların **aynı yayın revizyonundaki** `firestore.rules`
ile birebir eşleştiğini ve snapshot'ın `puantor-live` projesinden geldiğini
doğrular. Eşleşme yoksa etkin yapılandırma dosyası yazılmaz ve yayın durur.
Mevcut ortam dosyasının üzerine yazılmaz; yeni Cloud IAM izni istenmez.

Sıra: testsiz birleştirme/yayın yapmayın; staging → Functions kapalı → kurallar
→ etkin kuralları doğrulayarak Functions açık → gerçek cihaz ve sonuç kontrolleri.
Bu kod hazırlığı sırasında canlıya yayın veya gerçek müşteri hesabı silme yoktur.

Geri dönüşte yeni kalıcı silmeyi önce kapatın. Daha önce kapatılmış işletmeler
ve yarım/bitmiş silmeler varken erişim kilidi yardımcılarını kurallardan veya
callable'lardan kaldırmayın; eski kuralları körlemesine geri yüklemek, eski
oturumlara tekrar erişim açabilir. Kayıtların korunması ve erişim kapatma durumu
ayrıca doğrulanmalıdır.

## Kanıt ve sınırlar

Emülatör testleri gerçek Firestore transaction'larıyla; Auth hatası, alt belge
hatası, işlem kilidi, rol/sahiplik değişimi, açık işler, 100'den fazla üye,
sahte yabancı üye, kayıtların korunması, takip anahtarı ve bakım temizliğini kapsar.
Tarayıcı testi gerçek demo Auth kullanıcılarının kaldırıldığını, şirket kapandığını,
kalan operatörün durdurulduğunu ve başka firmanın çalıştığını kontrol eder.

Bu kanıtlar bir fiziksel iPhone/TestFlight testi veya bütün ticari kayıtlar için
hukuki uygunluk onayı değildir. Firestore değişiklikleri dar kapsamlı prototip
kural değişiklikleridir; canlı öncesi staging ve uygulama testleri tamamlanmalıdır.

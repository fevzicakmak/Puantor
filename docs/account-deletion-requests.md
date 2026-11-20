# Hesap silme talepleri

20 Kasım 2026. Kullanıcının kararı: işletme kayıtlarını koru; destek
incelemesiyle ilerle. Bu değişiklik üretim verilerine silme uygulamaz.

## Kullanıcı akışı

Yönetici ve operatör panellerinin altındaki Hesap ve gizlilik bağlantısı
`hesap.html` sayfasına gider. Kullanıcı mevcut şifresini Firebase Auth ile
yeniden doğrular; zorunlu açıklama/onay kutusuyla yalnızca kendi hesabı için
talep oluşturur. Şifre callable'a veya Firestore'a gönderilmez. Callable,
imzalı token'ın `auth_time` değerinin en fazla beş dakika önce olmasını ister.

`accountDeletion` şu kullanıcı işlemlerini sunar:

- `status`: yalnızca çağıranın talep durumunu döndürür.
- `request`: kullanıcı/profil kimliğini sunucudan belirler ve özel talebi kaydeder.
- `cancel`: henüz incelemeye alınmamış `pending` talebi geri çeker.

Talep, `accountDeletionRequests/{auth.uid}` belgesindedir. Kimlik, hesap rolü,
varsa işletme kimliği, hesaptaki e-posta, kapsam, durum ve zamanlar saklanır.
Parola, telefon, gerekçe, cihaz/IP bilgisi veya iş kayıtlarının kopyası tutulmaz.
İstemcinin gönderdiği `uid`, rol veya işletme kimliği talep sahibi seçmek için
kullanılmaz. Aynı talebin eşzamanlı tekrarları tek belgede kalır.

Kayıt/silme, durum görme ve geri çekme birbirinden ayrıdır. Talep oluşturmak
hesabı devre dışı bırakmaz, oturumu kapatmaz, operatör atamasını kaldırmaz ve
çalışma/finans kayıtlarını değiştirmez. Arka planda otomatik silme görevi yoktur.

## Destek incelemesi

Mevcut uygulama destek yöneticisi kendi hesabıyla `hesap.html` sayfasına
girdiğinde Destek talepleri bölümünü görür. Yetki sunucuda mevcut sabit
uygulama yönetici UID'siyle kontrol edilir; şirket yöneticisi rolü yetmez.

- `reviewList`: talepleri belge kimliğine göre 50'lik sayfalarda listeler.
- `reviewStart`: mevcut şifreyle yeniden doğrulama sonrası talebi `processing` yapar.
- `reviewReopen`: incelemedeki talebi `pending` durumuna geri alır.

İstemciden doğrudan koleksiyon okuması/yazması mevcut Firestore kurallarıyla
kapalıdır. Destek listesi de yalnızca callable üzerinden açılır. Kullanıcıya
destek içi inceleme alanları değil, kendi durumu/kapsamı/zamanı döner.
Otomatik e-posta veya SMS gönderimi yapılmaz; talepler bu panelden izlenir.

## Henüz tamamlanmamış destek prosedürü

Bu değişiklik bir hesabı gerçekten silen veya talebi `completed` olarak
işaretleyen işlem içermez. Henüz tamamlanmamış bir süreci kullanıcıya bitmiş
gibi göstermemek için destek arayüzüne “Tamamlandı” düğmesi konmadı.

App Store gönderiminden önce aşağıdaki konular tamamlanmalıdır:

1. Talep inceleme sıklığı, tamamlanma süresi ve kullanıcıya sonuç bildirimi.
   Mevcut sayfa süre belirlenmediğini açıkça söyler; gönderim öncesi bu boşluk
   gerçek, uygulanabilir bir süreyle kapatılmalıdır.
2. Hangi ticari kayıtların hangi gerekçe ve süreyle saklanacağı; diğer kişisel
   bilgilerin Auth, kullanıcı profili, operatör kaydı, isim takma adları,
   işlem geçmişi, cihaz giriş geçmişi ve sağlayıcı günlüklerindeki durumu.
3. Firma sahibinin hesabı silinecekse operatörler ile işletme kayıtlarına ne
   olacağı. Mevcut modelde yönetici UID'si işletme kimliğidir. Sadece Auth
   kullanıcısını silmek işletme yönetimini sahipsiz bırakır; yapılmamalıdır.
   Yeni yöneticiye aktarım veya kontrollü kapatma ayrı doğrulanmalıdır.
4. İnceleme sonrası gerçek silme/anonimleştirme işlemi; tekrar deneme,
   başarısız kısmi işlemden kurtarma ve sonuç doğrulaması.
5. Tamamlanan ve geri çekilen talep belgelerinin saklama/temizleme politikası.

İşletme kayıtlarını korumak, bütün kişisel bilgileri süresiz tutmak veya
silme talebini süresiz bekletmek anlamına gelmez. Bu süreç tamamlanmadan
uygulama için “hesap silme şartı tamamen karşılandı” denmemelidir.

## Yayın ve doğrulama

`accountDeletion` yeni callable'dır. İstemciyle birlikte önce staging'de
yayınlanmalıdır. Canlı Functions filtresi, Cloud Run invoker uzlaştırması ve
oturumsuz probe listesine eklendi; bu dosyaları değiştirmek yayın yapmaz.
Oturumsuz çağrı 401 UNAUTHENTICATED dönmelidir. Firestore kuralları değiştirilmedi.

Emülatör testleri yeni işlem için oturum yaşı, kimlik sahteciliği, tekrar,
iptal, destek yetkisi ve mevcut iş/finans kayıtlarının korunmasını doğrular.
Tarayıcı testi gerçek şifre doğrulamasından sonra talep oluşturma, sayfa
yenilemede durumun korunması, farklı hesapların ayrımı ve geri çekmeyi içerir.

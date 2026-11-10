# Puantör çoklu işletme entegrasyonu — çalışma planı

Durum: geliştirme dalı, canlıya alınmadı.

## Doğrulanan mevcut yapı
- `giris.html`: yeni yönetici `users/{uid}` altında `role: tenant_admin`, `tenantId: uid` ile kaydediliyor ve `isletme.html` sayfasına yönleniyor.
- `isletme.html`: yalnızca `businesses/{tenantId}/machines` ve `customers` alt koleksiyonlarını kullanıyor.
- `yonetici.html`: makineler, müşteriler, operatörler, işler ve tahsilatları kök koleksiyonlarda tutuyor; yalnızca eski sabit UID yönetici yetkisine göre tasarlanmış.
- `firestore.rules`: kök koleksiyonlara erişim eski yönetici UID'siyle sınırlı; tenant alt koleksiyonlarına tenant yöneticisi erişebiliyor.

## Değişmez güvenlik koşulları
1. Eski yöneticinin kök koleksiyon kayıtları taşınmadan ve yedeklenmeden değiştirilmez.
2. Her yeni işletme için veri yolu `businesses/{tenantId}/{machines|customers|operators|jobs|payments}/{id}`.
3. Yeni yöneticinin `tenantId` değeri kimliği doğrulanmış kullanıcı profilinden alınır; istemcinin serbestçe gönderdiği işletme kimliğine güvenilmez.
4. Operatörün hesabı ve makine ataması aynı tenant'a bağlı olmalı; operatör başka tenant'ın verisini okuyamaz.
5. Yeni işletme yöneticisi kendi tenant'ının operatör hesaplarını yönetir; başka tenant kullanıcılarının rollerini değiştiremez.
6. Operatörün e-posta/şifre hesabını yöneticinin kendi oturumunu düşürmeden oluşturması için ayrı güvenilir sunucu işlemi gerekir. İstemcide ikinci `createUserWithEmailAndPassword` çağrısı yöneticinin oturumunu değiştirebilir. Parolalar Firestore'da düz metin tutulmaz.
7. Yeni görev atanmadan makine başlatılamaz; biten iş tekrar başlatılamaz.

## Uygulama sırası
- Tenant-aware veri erişim katmanı ve yetki kontrolleri
- Yeni işletmeler için operatör hesap açma ve yetki yönetimi
- Gelişmiş panelin aynı arayüzle tenant koleksiyonlarını kullanması
- Girişte `tenant_admin` yönlendirmesi
- Emülatörde tenant A/B çapraz erişim, görev akışı ve eski yönetici regresyon testleri
- Yalnızca testler geçtikten sonra canlıya dağıtım

## Mevcut durum
Bu belge uygulama ve güvenlik çalışmasının başlangıç kontrol listesidir. Henüz işlevsel entegrasyon veya canlı sürüm güncellemesi değildir.

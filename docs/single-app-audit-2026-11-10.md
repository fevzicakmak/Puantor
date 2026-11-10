# Puantör tek uygulama / çok firma kod denetimi — 2026-11-10

## Onaylanan hedef
App Store/Play Store'dan indirilen TEK Puantör uygulaması. Her firma ilk kullanımda kendi yönetici hesabını açar, ardından kendi operatörlerini, makinelerini, müşterilerini ve görevlerini yönetir. Firma verileri birbirine karışmaz. Firmalar arası bir üst yönetici istenmiyor. Geliştirme/test hesabı ve test verileri ürün gereksinimi değildir.

## Geri dönüş ve kapsam
- Ana dal `main` değiştirilmedi.
- Geliştirme dalı `feature/tenant-admin-integration`.
- Değişiklik öncesi yedek: `backup/tenant-integration-before-cleanup-20261110`.
- Firebase canlı verileri silinmedi; kurallar dağıtılmadı.

## İncelenen farklar
`main` ile geliştirme dalı karşılaştırmasında 37 commit, 9 dosya farkı: `giris.html`, `isletme.html`, `firestore.rules`, `tenant-data.js`, `tenant-jobs.js`, `tenant-operators.js`, `tenant-operator-controls.js`, `tenant-operator.html`, `docs/tenant-integration-plan.md`.

## Ürün için gerekli (silme)
- `businesses/{tenantId}/...` altında firma veri ayrımı ve Firestore yetkilendirmesi.
- Yönetici kendi hesabını açar, operatör/makine/müşteri oluşturur, görev atar.
- Operatör yalnızca atanmış görevi başlatır/duraklatır/bitirir.
- Operatör hesaplarını yönetici oluşturur.

## Geçici/uyumsuz (henüz silinmedi)
1. `giris.html` hâlâ `admin`→`yonetici.html` (kök koleksiyonlar), `tenant_admin`→`isletme.html` (firma koleksiyonları), `operator`→`operator.html`, `tenant_operator`→`tenant-operator.html` yollarını içeriyor. Bu geçici iki veri modeli nihai tek firma-odaklı ürün değildir. Eski yolları şimdi silmek test ekranlarını ve mevcut kodu kırabilir.
2. `isletme.html`, gelişmiş `yonetici.html` ile özellik ve görünüm bakımından eşdeğer değil. İstenen tek yönetici deneyimi için UI işlevleri tenant veri katmanına taşınmalı; sadece yönlendirme değiştirmek güvensizdir.
3. `isletme.html` operatör şifrelerini `prompt()` ile topluyor; parola alanlı güvenli form gerekiyor.
4. `changeTenantOperatorPassword` mevcut parolayı istiyor; yöneticinin eski parolayı bilmeden değiştirmesi için yetkili sunucu işlevi gerekli.
5. `provisionTenantOperator` Auth/Firestore arasında atomik değil. Yarım kalan kayıtlar için idempotent kurtarma ve gerçek emülatör testleri gerekiyor.
6. Operatör iş sorguları, kuralların sorgu uyumluluğu ve eşzamanlı bitirme senaryoları emülatörde test edilmedi.

## Bu denetimde yapılan güvenli düzeltme
İkincil Firebase Auth oturumları `inMemoryPersistence` kullanır; operatör hesabı oluşturma/şifre değişikliği yöneticinin tarayıcıda saklanan oturumunu etkilememeli.

## Silme/değiştirme güvenlik kapısı
Eski sayfaları, eski rol yönlendirmelerini ve kök koleksiyon kurallarını ancak yeni tenant arayüzü işlev eşitliğine ulaştığında, giriş/iş akışları emülatörde test edildiğinde ve yeni dalda doğrulandığında kaldır. Canlı Firebase kayıtlarına otomatik temizlik uygulama.

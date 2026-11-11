# Tek Puantör / çok firma — geçiş kontrol listesi

Temel: `main` commit `e3da8d718cdfebfbc8694eb6f7f2b251432f9ece`. Çalışma dalı: `feature/single-app-multicompany-from-last-single`.

## Tamamlanan izole adımlar
- Bir cihazda yalnızca tek işletme açılmasına neden olan localStorage kilidi kaldırıldı (`giris.html`).
- Mevcut renkli yönetici tasarımının birebir HTML kopyası `tenant-manager-preview.html` olarak alındı. 27 kök koleksiyon başvurusu `businesses/{tenantId}/...` olarak değiştirildi; `tenant_admin` profili zorunlu.
- Mevcut operatör ekranının birebir HTML kopyası `tenant-operator-preview.html` olarak alındı. Dört makine başvurusu firma kapsamına alındı; `tenant_operator` profili zorunlu.
- Önizleme sayfaları giriş yönlendirmesine BAĞLANMADI. `yonetici.html`, `operator.html`, `main` ve canlı Firebase verileri değiştirilmedi.

## Canlıya geçişi engelleyen kritik işler
1. **Şema uyumsuzluğu:** Tekli yönetici `operators/{username}` ve `users/{uid}.role=operator` varsayıyor; firma operatörü `tenant_operator`, `tenantId`, `operatorId` ve firma operatör listesi gerektirir. Operatör oluşturma/onay/şifre yönetimini bütüncül değiştir.
2. **Operatör iş modeli:** Tekli operatör `users/{uid}.machineIds` ve `activeMachineId` kullanıyor. Firma görevi/atama yetkisini sunucu kurallarıyla bağla; yeni görev olmadan yeniden başlatma engellensin.
3. **Kurallar:** Mevcut `firestore.rules` yalnızca tenant yöneticisine firma alt koleksiyon erişimi veriyor; operatörün iş/makine okuma-yazması için sınırlandırılmış kurallar gerekiyor. Sadece istemciye güvenme.
4. **İşlemler:** Yönetici işlemleri (`setDoc`, `updateDoc`, `runTransaction`, tahsilat, geçmiş, toplu işlem) firma veri modeliyle tek tek doğrulanmalı.
5. **Kayıt ve oturum:** `giris.html` içindeki operatör kayıt akışı kök `operators` koleksiyonunu kullanıyor. Firma operatörü oluşturma ve ilk şifre işlemini yöneticinin yetkisine taşı.
6. **Test:** İki firma A/B, her birinde yönetici/operatör, eşzamanlı görev, iptal, bitirme, tahsilat ve negatif çapraz-firma erişim senaryolarını Firebase emülatörde test et. Testten önce yönlendirmeyi değiştirme.

## Güvenlik kuralı
Canlı verileri silme veya taşıma. Eski ekranları kaldırma. Güvenlik testleri ve işlev eşitliği tamamlanmadan önizleme dosyalarını üretim girişine bağlama.

# Puantör yönetici kontrollü operatör hesapları
Firebase Functions (Blaze faturalandırma planı gerekebilir) dağıtımı:
`npm --prefix functions install`
`firebase deploy --only functions --project puantor-live`
Operatör girişinde kullanıcı adı, uygulama içinde `@operators.puantor.invalid` iç adresine çevrilir; operatörden gerçek e-posta istenmez.
Şifreler yalnızca Firebase Authentication'da tutulur; Firestore'a yazılmaz.
Firebase Console > Authentication > Templates altında self-service password reset akışı kapatılmalı / yönetimsel politika ayrıca uygulanmalıdır. Firebase Authentication standart e-posta-şifre API'siyle self-service password reset tamamen güvenilir biçimde devre dışı bırakılamaz. Katı yönetici-only şifre politikası için Identity Platform blocking functions veya özel kimlik sağlayıcısı gerekir.

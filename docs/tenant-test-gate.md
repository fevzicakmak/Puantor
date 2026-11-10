# Puantör – çoklu firma test kapısı

Bu dal **canlı ortama dağıtılmamalıdır**. Mevcut ana sürüm ve Firebase verileri korunur.

## Otomatik testler

GitHub Actions → **Puantor tenant preview syntax checks** → **Run workflow** → `feature/single-app-multicompany-from-last-single`.

İki işin de (**syntax** ve **firestore-rules**) yeşil olması gerekir. `firestore-rules` işi gerçek Firebase hesabına bağlanmadan yerel Firestore emülatörü üzerinde çalışır.

Yerelde (Node 22 ve Java 21 kuruluysa):

```bash
npm install --no-save firebase@^11 @firebase/rules-unit-testing@^4 firebase-tools@^14
npx firebase emulators:exec --only firestore --project puantor-tenant-rules-test "node tests/tenant-firestore-rules.cjs"
```

## Gerçek cihaz test kapısı

1. Yeni firma A kaydı; yöneticinin renkli paneli açılır.
2. Firma B kaydı; A'nın müşterileri, makineleri, operatörleri ve raporları görünmez.
3. A yöneticisi operatör hesabı oluşturur; üretilen **tam giriş e-postası** ve şifreyle operatör giriş yapar.
4. Operatör yeni görev verilmeden başlatamaz; görev atanınca açık ekranda güncellenir.
5. Başlat → duraklat → devam → arıza → devam → bitir akışında durum ve süre tutarlıdır.
6. B operatörü A makinesine erişemez; A'nın atanmamış operatörü de makineye erişemez.
7. Operatör şifresi yönetici tarafından değiştirilebilir. Görevi bağlı operatör silinemez; bağlantısız operatörün hesabı devre dışı bırakılır.
8. iPhone Safari'de ekranlar, giriş ve veri kalıcılığı kontrol edilir.

**Geçiş koşulu:** CI testleri başarılı + iki firma uçtan uca cihaz testleri başarılı + Firebase Functions ve Firestore kuralları test projesinde doğrulanmış olmalı. Bu olmadan `main` birleştirmesi veya üretim dağıtımı yapılmaz.

// Puantör tenant-scoped Firestore data layer.
// This module intentionally does not access legacy root collections.
import { doc, getDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const TYPES = new Set(["machines", "customers", "operators", "jobs", "payments"]);
const NAME_TYPES = new Set(["machines", "customers"]);
function requireType(type) {
  if (!TYPES.has(type)) throw new Error("Desteklenmeyen kayıt türü");
  return type;
}
export async function resolveTenant(db, user) {
  if (!user?.uid) throw new Error("Oturum açılmalı");
  const snapshot = await getDoc(doc(db, "users", user.uid));
  if (!snapshot.exists()) throw new Error("Kullanıcı profili bulunamadı");
  const profile = snapshot.data();
  if (profile.role !== "tenant_admin" || profile.tenantId !== user.uid) {
    throw new Error("İşletme yöneticisi yetkisi bulunamadı");
  }
  return Object.freeze({ uid: user.uid, tenantId: user.uid,
    businessName: profile.businessName || "", managerName: profile.managerName || "" });
}
function scopedCollection(db, session, type) {
  requireType(type);
  if (!session?.uid || session.tenantId !== session.uid) throw new Error("Geçersiz işletme oturumu");
  return collection(db, "businesses", session.tenantId, type);
}
export function watchTenantRecords(db, session, type, onData, onError) {
  return onSnapshot(scopedCollection(db, session, type),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError);
}
export async function addNamedRecord(db, session, type, name) {
  if (!NAME_TYPES.has(type)) throw new Error("Bu işlem yalnızca makine veya müşteri için geçerli");
  const clean = String(name || "").trim();
  if (!clean || clean.length > 100) throw new Error("Ad 1-100 karakter olmalı");
  return addDoc(scopedCollection(db, session, type), { name: clean, createdAt: serverTimestamp() });
}
export async function updateNamedRecord(db, session, type, id, name) {
  if (!NAME_TYPES.has(type)) throw new Error("Desteklenmeyen kayıt türü");
  const clean = String(name || "").trim();
  if (!clean || clean.length > 100 || !id) throw new Error("Geçersiz kayıt");
  return updateDoc(doc(scopedCollection(db, session, type), id), { name: clean });
}
export async function deleteNamedRecord(db, session, type, id) {
  if (!NAME_TYPES.has(type) || !id) throw new Error("Geçersiz kayıt");
  return deleteDoc(doc(scopedCollection(db, session, type), id));
}

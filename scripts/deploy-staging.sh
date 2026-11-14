#!/usr/bin/env bash
set -euo pipefail
PROJECT="puantor-staging"
PUANTOR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PUANTOR_ROOT"
if ! test -x node_modules/.bin/firebase; then
  echo "Firebase CLI bulunamadi. Once npm ci ve npm ci --prefix functions calistirin."
  exit 1
fi
case "$(git branch --show-current)" in
  main|fix/preserve-ui-workflow-integrity) ;;
  *) echo "HATA: staging icin onayli dal secilmedi"; exit 1 ;;
esac
test -f tenant-manager-preview.html && test -f firestore.rules
node scripts/build-staging-public.cjs
echo "Hedef Firebase projesi: $PROJECT (puantor-live'e dagitim yasak)"
./node_modules/.bin/firebase deploy --config firebase.staging.json --project "$PROJECT" --only firestore,functions,hosting --non-interactive
echo "Staging deployment complete."

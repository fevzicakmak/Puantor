#!/usr/bin/env bash
set -euo pipefail
PROJECT="puantor-staging"
BRANCH="feature/single-app-multicompany-from-last-single"
if ! command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI bulunamadi. Cloud Shell'de: npm install -g firebase-tools"
  exit 1
fi
test -f firebase-config.js && test -f tenant-manager-preview.html && test -f firestore.rules
grep -q 'projectId: "puantor-staging"' firebase-config.js || { echo "HATA: Firebase client staging projesine bagli degil"; exit 1; }
test "$(git branch --show-current)" = "$BRANCH" || { echo "HATA: yanlis GitHub dali"; exit 1; }
mkdir -p .puantor-staging-public
cp firebase-config.js giris.html tenant-manager-preview.html tenant-operator-preview.html .puantor-staging-public/
cp giris.html .puantor-staging-public/index.html
echo "Hedef Firebase projesi: $PROJECT (puantor-live'e dagitim yasak)"
firebase deploy --config firebase.staging.json --project "$PROJECT" --only firestore,functions,hosting --non-interactive
echo "Staging deployment complete."

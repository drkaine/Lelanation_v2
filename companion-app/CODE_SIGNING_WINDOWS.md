# Signature de code Windows – éditeur « Darkaine » et SmartScreen

Sous Windows, le nom affiché à l’installation (UAC, SmartScreen, navigateur) vient du **certificat Authenticode** de l’installateur `.exe`, pas du champ `publisher` dans `tauri.conf.json`. Sans signature valide, l’utilisateur voit **« Éditeur inconnu »** et SmartScreen peut bloquer le téléchargement.

## Certificat EV (recommandé)

Pour limiter les alertes SmartScreen dès les premières versions, un certificat **EV Code Signing** (Extended Validation) est fortement recommandé :

| Type | Éditeur affiché | SmartScreen |
|------|-----------------|-------------|
| Non signé | Éditeur inconnu | Blocage / avertissement |
| OV (Organization Validated) | Nom de l’organisation | Réputation à construire (plusieurs milliers de téléchargements) |
| **EV** | Nom vérifié (ex. Darkaine) | Réputation Microsoft plus rapide, expérience la plus fiable |

Fournisseurs courants : DigiCert, Sectigo, SSL.com, GlobalSign. Prévoir **~300–500 €/an** et une vérification d’identité de l’entreprise (KYC).

Le certificat EV est livré sur une **clé USB HSM** (eToken). Pour la CI GitHub Actions, exporter un `.pfx` depuis l’outil du fournisseur (ou utiliser Azure Trusted Signing / un service de signature cloud compatible).

Référence Microsoft : [Code Signing Certificate Management](https://learn.microsoft.com/en-us/windows-hardware/drivers/dashboard/code-signing-cert-manage).

## Secrets GitHub (CI)

Le workflow [`.github/workflows/companion-windows-build.yml`](../.github/workflows/companion-windows-build.yml) signe les binaires **après** `npm run tauri build` avec `signtool`.

| Secret | Description |
|--------|-------------|
| `WINDOWS_CODESIGN_PFX_B64` | Fichier `.pfx` du certificat EV, encodé en base64 |
| `WINDOWS_CODESIGN_PASSWORD` | Mot de passe d’export du `.pfx` |
| `TAURI_SIGNING_PRIVATE_KEY` | Clé minisign pour l’auto-updater (`latest.json`) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Mot de passe optionnel de la clé minisign |

Encoder le PFX en base64 (PowerShell) :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Set-Clipboard
```

Les **releases** (tag `companion-v*`) exigent une signature **Valid** ; un installateur non signé ou auto-signé ne sera pas publié.

## Build local signé

### 1. Exporter le certificat en `.pfx`

```bash
openssl pkcs12 -export -in cert.cer -inkey private-key.key -out certificate.pfx
```

### 2. Importer dans Windows

```powershell
Import-PfxCertificate -FilePath certificate.pfx -CertStoreLocation Cert:\CurrentUser\My `
  -Password (ConvertTo-SecureString -String 'TON_MOT_DE_PASSE' -Force -AsPlainText)
```

### 3. Configurer `tauri.conf.json` (optionnel, build local)

Dans `bundle.windows`, ajouter l’empreinte du certificat pour que Tauri signe au build :

```json
"windows": {
  "certificateThumbprint": "EMPREINTE_SANS_ESPACES",
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.digicert.com",
  "nsis": {
    "displayLanguageSelector": false
  }
}
```

Récupérer l’empreinte : `certmgr.msc` → Certificats personnels → Détails → Empreinte.

### 4. Builder

```bash
cd companion-app
npm run tauri build
```

Vérifier :

```powershell
Get-AuthenticodeSignature .\src-tauri\target\release\bundle\nsis\*-setup.exe
# Status attendu : Valid
```

## Déclencher une release signée

1. Configurer les secrets ci-dessus dans le dépôt GitHub.
2. Pousser un tag `companion-v0.29.0` **ou** lancer le workflow **Companion Windows Signed Build** avec une version et `sign: true`.

L’installateur publié sur GitHub Releases s’appelle `Lelanation.exe` et doit afficher **Darkaine** (ou le sujet du certificat) comme éditeur.

## Résumé

| Symptôme | Cause | Action |
|----------|-------|--------|
| « Éditeur inconnu » | Exe non signé ou auto-signé | Certificat EV + secrets CI |
| SmartScreen bloque le fichier | Pas de réputation / pas EV | Certificat EV + releases signées uniquement |
| Nom d’éditeur incorrect | Sujet du certificat | Commander le certificat au nom légal (ex. Darkaine) |
| `publisher` dans Tauri ignoré | Métadonnée bundle seulement | Authenticode sur l’exe |

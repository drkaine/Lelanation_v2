# Signature de code Windows – afficher « Darkaine » comme éditeur

Sous Windows, l’éditeur affiché à l’installation (UAC, SmartScreen) vient du **certificat de signature de code** de l’exécutable, pas du champ `publisher` dans `tauri.conf.json`. Sans signature, on voit toujours « Éditeur inconnu ».

## Prérequis

- Un **certificat de signature de code** (OV – Organization Validated), pas un certificat SSL.  
  Exemples d’autorités : [liste Microsoft](https://learn.microsoft.com/en-us/windows-hardware/drivers/dashboard/code-signing-cert-manage).
- Le certificat doit être émis au nom sous lequel tu veux apparaître (ex. « Darkaine »).

## Étapes

### 1. Convertir le certificat en .pfx

Avec ton fichier certificat (ex. `cert.cer`) et la clé privée (ex. `private-key.key`) :

```bash
openssl pkcs12 -export -in cert.cer -inkey private-key.key -out certificate.pfx
```

Tu devras définir un mot de passe d’export – à conserver pour l’import et la CI.

### 2. Importer le .pfx dans Windows

Dans PowerShell :

```powershell
$WINDOWS_PFX_PASSWORD = 'TON_MOT_DE_PASSE'
Import-PfxCertificate -FilePath certificate.pfx -CertStoreLocation Cert:\CurrentUser\My -Password (ConvertTo-SecureString -String $WINDOWS_PFX_PASSWORD -Force -AsPlainText)
```

### 3. Récupérer les infos pour Tauri

Ouvre **certmgr.msc** → Certificats personnels → double-clic sur le certificat importé → onglet **Détails**.

- **Algorithme de hachage de signature** → `digestAlgorithm` (souvent `sha256`).
- **Empreinte** (Thumbprint) → `certificateThumbprint` (ex. `A1B2C3...`).
- **URL d’horodatage** : fournie par ton autorité (ex. `http://timestamp.digicert.com`, `http://timestamp.comodoca.com`).

### 4. Configurer `tauri.conf.json`

Dans `src-tauri/tauri.conf.json`, section `bundle.windows`, ajoute (à côté de `nsis`) :

```json
"windows": {
  "certificateThumbprint": "TON_EMPREINTE_ICI",
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.comodoca.com",
  "nsis": {
    "displayLanguageSelector": false
  }
}
```

Remplace `TON_EMPREINTE_ICI` et `timestampUrl` par tes valeurs.

### 5. Builder

```bash
npm run tauri build
```

En cas de succès, la sortie indiquera que l’exécutable a été signé. L’installateur et l’exe afficheront alors « Darkaine » (ou le nom du sujet du certificat) comme éditeur.

## CI (GitHub Actions)

Pour signer en CI, il faut importer le certificat sur le runner Windows. Voir la doc Tauri : [Windows Code Signing](https://v2.tauri.app/distribute/sign/windows) (secrets `WINDOWS_CERTIFICATE` en base64 et `WINDOWS_CERTIFICATE_PASSWORD`, étape d’import du .pfx avant le build).

## Résumé

| Problème              | Cause              | Solution                    |
|-----------------------|--------------------|-----------------------------|
| « Éditeur inconnu »   | Exe non signé      | Certificat OV + config ci-dessus |
| Nom d’éditeur voulu   | Sujet du certificat| Obtenir le cert au nom « Darkaine » (ou ton entité) |

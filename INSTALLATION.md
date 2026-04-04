# Installation — DashboardJeux (AutoCutter Studio Control)

## Prérequis

| Logiciel | Version minimum | Lien |
|---|---|---|
| **Node.js** | 18+ | https://nodejs.org |
| **Bitfocus Companion** | 3.x ou 4.x | https://bitfocus.io/companion |
| **OBS Studio** | Optionnel | https://obsproject.com |

> Vérifier la version Node installée : `node -v`

---

## Installation

### 1. Récupérer les fichiers

Copier le dossier `Automatisateur` fourni par AutoCutter sur le poste client (ex: `C:\DashboardJeux\` sur Windows ou `~/DashboardJeux/` sur Mac).

Le dossier doit contenir :

```
Automatisateur/
├── server.js
├── electron-main.js
├── launcher.html
├── app-config.json        ← configuration principale
├── package.json
├── public/
│   └── index.html         ← interface web
└── runtime/               ← créé automatiquement au premier lancement
```

### 2. Installer les dépendances

Ouvrir un terminal dans le dossier `Automatisateur` et exécuter :

```bash
npm install
```

> Cette opération ne se fait qu'une seule fois.

---

## Lancement

```bash
npm run start:launcher
```

Une fenêtre **launcher** s'ouvre. Le navigateur web s'ouvre automatiquement sur `http://localhost:3000`.

> Si le navigateur ne s'ouvre pas automatiquement, cliquer sur **Ouvrir GUI** dans le launcher.

---

## Activation de la licence

Au premier lancement, l'interface demande une clé de licence.

1. Saisir la clé fournie par AutoCutter (format `AUTOMATIZER-XXXX-XXXX-XXXX`)
2. Cliquer sur **Activer**
3. La licence est vérifiée en ligne puis mise en cache — l'app fonctionne ensuite **7 jours sans connexion internet**

---

## Configuration

### Port du serveur

Par défaut : **3000**. Pour changer :

- Dans le launcher → cliquer sur **⚙** → modifier le port → **Changer**
- Ou éditer directement `app-config.json` :

```json
{
  "server": {
    "port": 3000
  }
}
```

Redémarrer l'app après changement de port.

### URL Companion

Par défaut : `http://127.0.0.1:8000` (Companion sur le même poste).

Si Companion tourne sur une autre machine :

1. Ouvrir l'interface web → onglet **Configuration**
2. Cliquer sur ✏️ à côté de l'URL Companion
3. Saisir la nouvelle URL (ex: `http://192.168.1.50:8000`)
4. Cliquer **OK**

### Studios

Les studios (salles) sont configurables depuis l'onglet **Configuration** de l'interface web :

- **Ajouter** un studio avec son ID, label, variable REC Companion et jeux
- **Modifier** / **Supprimer** un studio existant
- **Réordonner** les studios avec les flèches ▲ ▼

La configuration est sauvegardée automatiquement dans `app-config.json`.

---

## Démarrage automatique (Windows)

Pour que l'app se lance au démarrage de Windows :

1. Créer un raccourci vers `dist/Lancer.bat`
2. Placer le raccourci dans : `C:\Users\[utilisateur]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

---

## Résolution de problèmes

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page web blanche au chargement | Serveur pas encore démarré | Attendre 2-3 secondes, rafraîchir |
| "Companion hors ligne" sur tous les studios | Companion non démarré | Lancer Bitfocus Companion |
| "Licence invalide" | Clé expirée ou mauvaise clé | Contacter AutoCutter |
| Port déjà utilisé | Conflit de port | Changer le port dans `app-config.json` |
| L'app ne s'ouvre pas | Node.js absent | Installer Node.js 18+ |

---

## Contact

**AutoCutter** — support@autocutter.fr

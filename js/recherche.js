// ===============================
// 🔍 Moteur de recherche commun Nono Maps
// ===============================

let lieux = [];
let appareils = [];
let allItems = [];
let fuseMix = null;

// ===============================
// 🌐 URLs des sources JSON
// ===============================
const URL_POSTES = "https://raw.githubusercontent.com/arnaud-upmre/carto3f9b7d1a5c8e4f2b/main/postes.json";
const URL_APPAREILS = "https://raw.githubusercontent.com/arnaud-upmre/carto3f9b7d1a5c8e4f2b/main/appareils.json";

// ===============================
// 🔠 Fonctions utilitaires
// ===============================

function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/gi, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Génère des alias pour améliorer la recherche (TT1 → TT 1 → transformateur, etc.)
function generateAlias(appareil, nom, sat, posteType) {
  const alias = new Set();
  const norm = s => (s || "").toLowerCase().trim();

  const a = norm(appareil);
  const n = norm(nom);
  const s = norm(sat);
  const t = norm(posteType);

  const match = a.match(/^([a-z]+)(\d+)?$/i);
  const letters = match ? match[1].toLowerCase() : a;
  const root = a.split(/[\s\-]/)[0];

  alias.add(a);
  alias.add(a.replace(/([a-z]+)(\d+)/, "$1 $2"));
  alias.add(letters);

  if (n) {
    alias.add(`${a} ${n}`);
    alias.add(`${n} ${a}`);
    alias.add(`${root} ${n}`);
    alias.add(`${n} ${root}`);
  }

  if (/^(i|ia|il|ip|imp)/i.test(a)) {
    alias.add("interrupteur");
    alias.add("inter");
  }

  if (/^(tt|tc|tsa)/i.test(a)) {
    alias.add("transformateur");
    alias.add("transfo");
  }

  if (/^s?\d+$/i.test(a) || /^sm/i.test(a) || /^st/i.test(a)) {
    alias.add("sectionneur");
  }

  if (s) {
    alias.add(`${a} ${s}`);
    alias.add(`${s} ${a}`);
  }

  if (t && n) {
    alias.add(`${n} ${t}`);
    alias.add(`${t} ${n}`);
  }

  return Array.from(alias);
}

// ===============================
// 📦 Chargement global
// ===============================
async function chargerBaseRecherche() {
  if (allItems.length > 0) return allItems; // déjà chargé

  const [postes, apps] = await Promise.all([
    fetch(URL_POSTES).then(r => r.json()),
    fetch(URL_APPAREILS).then(r => r.json())
  ]);

  lieux = postes;
  appareils = apps.map(app => ({
    ...app,
    alias: generateAlias(app.appareil, app.nom, app.SAT, app.type)
  }));

  const postesTagged = postes.map(p => ({ ...p, category: "poste" }));
  const appsTagged = appareils.map(a => ({ ...a, category: "appareil" }));
  allItems = [...postesTagged, ...appsTagged];

  fuseMix = new Fuse(allItems, {
    keys: [
      { name: "nom", weight: 0.8 },
      { name: "type", weight: 0.2 },
      { name: "SAT", weight: 0.2 },
      { name: "appareil", weight: 0.6 },
      { name: "alias", weight: 0.7 },
      { name: "accès", getFn: o => o.accès?.toString?.() || "", weight: 0.2 }
    ],
    includeScore: true,
    threshold: 0.30,
    distance: 50,
    minMatchCharLength: 2,
    ignoreLocation: true
  });

  console.log("✅ Base de recherche chargée :", allItems.length, "éléments");
  return allItems;
}

// ===============================
// 🔍 Recherche unifiée
// ===============================
async function rechercherDansBase(query) {
  if (!fuseMix) await chargerBaseRecherche();
  if (!query || query.trim().length < 2) return [];
  return fuseMix.search(normalize(query)).map(r => r.item);
}
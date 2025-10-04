// ===============================
// 🔍 Moteur de recherche commun Nono Maps
// ===============================

// Déclaration sur window → évite tout conflit entre pages
window.lieux = [];
window.appareils = [];
window.allItems = [];
window.fuseMix = null;

// URLs des sources
const URL_POSTES = "https://raw.githubusercontent.com/arnaud-upmre/carto3f9b7d1a5c8e4f2b/main/postes.json";
const URL_APPAREILS = "https://raw.githubusercontent.com/arnaud-upmre/carto3f9b7d1a5c8e4f2b/main/appareils.json";

// ===============================
// 🔠 Fonctions utilitaires communes
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

function generateAlias(appareil, nom, sat, posteType) {
  const alias = new Set();
  const norm = s => (s || "").toLowerCase().trim();
  const a = norm(appareil);
  const n = norm(nom);
  const s = norm(sat);
  const t = norm(posteType);

  const match = a.match(/^([a-z]+)(\d+)?$/i);
  const letters = match ? match[1].toLowerCase() : a;

  alias.add(a);
  alias.add(a.replace(/([a-z]+)(\d+)/, "$1 $2"));
  alias.add(letters);
  if (n) alias.add(`${a} ${n}`);
  if (s) alias.add(`${a} ${s}`);
  if (t && n) alias.add(`${n} ${t}`);
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

  console.log("✅ Base de recherche Nono Maps chargée :", allItems.length, "éléments");
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

// ===============================
// 🧭 Outils simples pour map.html
// ===============================
function myMapsViewer(lat, lon, z = 19) {
  return `map.html?lat=${lat}&lon=${lon}&z=${z}`;
}

function imajnetLink(lat, lon, zoom = 18) {
  return `https://gecko.imajnet.net/#map=OSM;zoom=${zoom};loc=${lat},${lon};`;
}

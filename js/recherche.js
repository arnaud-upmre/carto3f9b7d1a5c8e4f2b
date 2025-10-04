// ===============================
// 🔍 Moteur de recherche complet – Nono Maps (version corrigée, silencieuse)
// ===============================

let lieux = [];
let appareils = [];
let allItems = [];
let fuseMix = null;
let selectedIndex = -1;

// ===============================
// 📦 URLs des sources JSON
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

function normalizeNomPoste(name) {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\b(?:a|p|sp|ssp|sspa|l|l-a|prci|lgv|ss|sst)\b$/i, "")
    .trim();
}

function formatNomCompletLieu(obj) {
  const base = `${obj.nom || ""} ${obj.type || ""} ${obj.SAT || ""}`.trim();
  return obj["accès"] ? `${base} – accès ${obj["accès"]}` : base;
}

function generateAlias(appareil, nom, sat, posteType) {
  const alias = new Set();
  const norm = str => (str || "").toLowerCase().trim();

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
    alias.add(`${letters} ${n}`);
    alias.add(`${n} ${letters}`);
  }

  if (/^(i|ia|il|ip|imp)/i.test(a)) {
    alias.add("interrupteur");
    alias.add("inter");
    alias.add(`interrupteur ${a}`);
    alias.add(`inter ${a}`);
    if (n) {
      alias.add(`interrupteur ${n}`);
      alias.add(`inter ${n}`);
    }
  }

  if (/^(tt|tc|tsa)/i.test(a)) {
    alias.add("transformateur");
    alias.add("transfo");
    alias.add(`transformateur ${a}`);
    alias.add(`transfo ${a}`);
    if (n) {
      alias.add(`transformateur ${n}`);
      alias.add(`transfo ${n}`);
    }
  }

  if (/^s?\d+$/i.test(a) || /^sm/i.test(a) || /^st/i.test(a)) {
    alias.add("sectionneur");
    alias.add(`sectionneur ${a}`);
    if (n) alias.add(`sectionneur ${n}`);
  }

  if (n) {
    const mots = n.split(/\s+/);
    mots.forEach(m => {
      alias.add(`${letters} ${m}`);
      alias.add(`${m} ${letters}`);
      alias.add(`${letters.toUpperCase()} ${m}`);
      alias.add(`${m} ${letters.toUpperCase()}`);
    });
  }

  if (s) {
    alias.add(`${a} ${s}`);
    alias.add(`${s} ${a}`);
    if (n) {
      alias.add(`${a} ${n} ${s}`);
      alias.add(`${n} ${s} ${a}`);
      alias.add(`${letters} ${n} ${s}`);
      alias.add(`${n} ${s} ${letters}`);
    }
  }

  if (t && n) {
    alias.add(`${n} ${t}`);
    alias.add(`${t} ${n}`);
  }

  return Array.from(alias);
}

// ===============================
// 📦 Chargement global + Fuse.js
// ===============================
async function chargerBaseRecherche() {
  if (allItems.length > 0) return allItems;

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

  return allItems;
}

// ===============================
// 🔍 Tri complet
// ===============================
function trierResultats(results, qId, qNorm) {
  const qDigits = qId.replace(/\D/g, "");

  results.sort((a, b) => {
    const id = x => (x.appareil || "").toString().replace(/\s+/g, "").toLowerCase();
    const idDigits = x => id(x).replace(/\D/g, "");

    const aExactId = a.category === "appareil" && (id(a) === qId || (qDigits && idDigits(a) === qDigits));
    const bExactId = b.category === "appareil" && (id(b) === qId || (qDigits && idDigits(b) === qDigits));
    if (aExactId && !bExactId) return -1;
    if (bExactId && !aExactId) return 1;

    const aliasHit = (x) => Array.isArray(x.alias) && x.alias
      .map(s => s.replace(/\s+/g, "").toLowerCase())
      .some(s => s === qId || (qDigits && s.replace(/\D/g, "") === qDigits));
    const aAlias = a.category === "appareil" && aliasHit(a);
    const bAlias = b.category === "appareil" && aliasHit(b);
    if (aAlias && !bAlias) return -1;
    if (bAlias && !aAlias) return 1;

    const norm = s => (s || "").toString().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ");
    const aNom = norm(a.nom || "");
    const bNom = norm(b.nom || "");
    const aStarts = aNom.startsWith(qNorm);
    const bStarts = bNom.startsWith(qNorm);
    if (aStarts && !bStarts) return -1;
    if (bStarts && !aStarts) return 1;

    const aExact = aNom === qNorm;
    const bExact = bNom === qNorm;
    if (aExact && !bExact) return -1;
    if (bExact && !aExact) return 1;

    const aIsPoste = a.category === "poste" && !a.accès;
    const bIsPoste = b.category === "poste" && !b.accès;
    if (aIsPoste && !bIsPoste) return -1;
    if (bIsPoste && !aIsPoste) return 1;

    const aIsAcces = a.category === "poste" && !!a.accès;
    const bIsAcces = b.category === "poste" && !!b.accès;
    if (aIsAcces && !bIsAcces) return -1;
    if (bIsAcces && !aIsAcces) return 1;

    if (a.category === "appareil" && b.category !== "appareil") return 1;
    if (b.category === "appareil" && a.category !== "appareil") return -1;

    const label = x =>
      x.category === "poste"
        ? `${x.nom || ""} ${x.type || ""} ${x.SAT || ""}`.trim()
        : `${x.appareil} (${x.nom}${x.type ? " " + x.type : ""}${x.SAT ? " / " + x.SAT : ""})`;

    return label(a).localeCompare(label(b), "fr", { sensitivity: "base" });
  });

  return results;
}

// ===============================
// 🚀 Initialisation recherche
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  await chargerBaseRecherche();
  const input = document.getElementById("search");
  const suggestionsEl = document.getElementById("suggestions");
  const resultEl = document.getElementById("result");

  if (!input) return;

  input.addEventListener("input", e => {
    const query = normalize(e.target.value.trim());
    suggestionsEl.innerHTML = "";
    if (!query || query.length < 2 || !fuseMix) return;

    let results = fuseMix.search(query).map(r => r.item);
    results = trierResultats(results, query, query.toLowerCase());

    results.forEach(item => {
      const li = document.createElement("li");
      li.innerHTML = (item.category === "poste")
        ? `🚉 ${formatNomCompletLieu(item)}`
        : `💡 ${item.appareil} (${item.nom})`;
      li.onclick = () => {
        if (item.category === "poste") showLieu(item);
        else showAppareil(item);
      };
      suggestionsEl.appendChild(li);
    });
  });
});

// ===============================
// 🌍 Fonctions locales pour map1
// ===============================
window.showLieu = function (item) {
  if (!window.map || !window.allMarkers) return;

  const target = allMarkers.find(m => {
    const cid = (m.options.customId || "").toLowerCase().trim();
    return cid.includes((item.nom || "").toLowerCase().trim());
  });

  if (target) {
    map.setView(target.getLatLng(), 18, { animate: true });
    target.openPopup();

    // 👇 ferme la barre de recherche après sélection
    document.getElementById("search-container")?.classList.remove("open");
  } else if (item.latitude && item.longitude) {
    map.setView([item.latitude, item.longitude], 18, { animate: true });
  }
};

window.showAppareil = function (item) {
  if (!window.map || !window.allMarkers) return;

  const target = allMarkers.find(m => {
    const cid = (m.options.customId || "").toLowerCase().trim();
    return cid.includes((item.appareil || "").toLowerCase().trim());
  });

  if (target) {
    map.setView(target.getLatLng(), 19, { animate: true });
    target.openPopup();

    // 👇 ferme la barre de recherche après sélection
    document.getElementById("search-container")?.classList.remove("open");
  } else if (item.latitude && item.longitude) {
    map.setView([item.latitude, item.longitude], 19, { animate: true });
  }
};

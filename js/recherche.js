// ===============================
// 🔍 Moteur de recherche complet – Nono Maps (silencieux)
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
// 🔠 Utilitaires (identiques à index pour la recherche)
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
  const base = `${obj.nom || ''} ${obj.type || ''} ${obj.SAT || ''}`.trim();
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
// 📦 Chargement global & Fuse
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
// 🔍 Tri (identique à index)
// ===============================
function trierResultats(results, q) {
  const qDigits = q.replace(/\D/g, "");

  results.sort((a, b) => {
    const id = x => (x.appareil || "").toString().replace(/\s+/g, "").toLowerCase();
    const idDigits = x => id(x).replace(/\D/g, "");
    const qId = q;

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

    const norm = s => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ");
    const aNom = norm(a.nom || "");
    const bNom = norm(b.nom || "");
    const aStarts = aNom.startsWith(q);
    const bStarts = bNom.startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (bStarts && !aStarts) return 1;

    const aExact = aNom === q;
    const bExact = bNom === q;
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
// 🎯 Sélection au clavier (identique à index)
// ===============================
function updateSelection(items) {
  items.forEach((li, i) => {
    if (i === selectedIndex) {
      li.classList.add("best");
      li.scrollIntoView({ block: "nearest" });
    } else {
      li.classList.remove("best");
    }
  });
}

// ===============================
// 🚀 Initialisation champ de recherche
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  await chargerBaseRecherche();

  const input = document.getElementById("search");
  const suggestionsEl = document.getElementById("suggestions");
  const resultEl = document.getElementById("result");

  input.addEventListener("input", e => {
    const rawQuery = e.target.value.trim();
    const query = normalize(rawQuery);
    suggestionsEl.innerHTML = "";
    resultEl.innerHTML = "";
    resultEl.style.display = "none";
    selectedIndex = -1;

    if (!query || query.length < 2 || !fuseMix) return;

    // ► Recherche brute
    let results = fuseMix.search(query).map(r => r.item);

    // ► Filtre "préfixe" (tt/i/tc/tsa/il/ip/imp/s) + autres mots = nom de poste
    const queryWords = query.split(/\s+/);
    const prefixes = ["tt","i","tc","tsa","il","ip","imp","s"];
    const lowerWords = queryWords.map(w => w.toLowerCase());
    const prefixWord = lowerWords.find(w => prefixes.includes(w));

    if (prefixWord) {
      const otherWords = lowerWords.filter(w => w !== prefixWord);
      results = results.filter(item => {
        const appareilOk = item.appareil && item.appareil.toLowerCase().startsWith(prefixWord);
        const nomOk = otherWords.every(w => normalize(item.nom || "").includes(w));
        return appareilOk && nomOk;
      });
    }

    // ► Marqueurs alias directs (même si non utilisés, on garde comme dans index)
    results.forEach(it => {
      const aliases = Array.isArray(it.alias) ? it.alias : [];
      it.__directAliasHit = aliases.some(a => normalize(a) === query);
    });

    // ► Tri personnalisé (identique à index)
    const q = query.toLowerCase();
    results = trierResultats(results, q);

    // ► Rendu
    const labelFor = (item) =>
      (item.category === "poste")
        ? formatNomCompletLieu(item)
        : `${item.appareil} (${item.nom}${item.type ? ' ' + item.type : ''}${item.SAT ? ' / ' + item.SAT : ''})`;

    results.forEach((item, i) => {
      const li = document.createElement("li");
      const icon = (item.category === "poste")
        ? `🚙${item.poste_latitude && item.poste_longitude ? " 📍" : ""}`
        : "💡";
      li.innerHTML = `${icon} ${labelFor(item)}`;
      if (i === 0) li.classList.add("best");
      li.onclick = () => {
        if (item.category === "poste") showLieu(item);
        else showAppareil(item);
      };
      suggestionsEl.appendChild(li);
    });

    // ► (Optionnel comme dans index) détection d'égalité normalisée sur >=3 caractères
    if (rawQuery.length >= 3) {
      const queryNorm = normalizeNomPoste(rawQuery);
      const exactMatch = results.some(item => {
        if (item.category === "poste") {
          return normalizeNomPoste(item.nom) === queryNorm;
        } else {
          return normalize(item.appareil || "") === normalize(rawQuery);
        }
      });
      void exactMatch;
    }
  });

  // ► Navigation clavier
  input.addEventListener("keydown", (e) => {
    const items = suggestionsEl.querySelectorAll("li");

    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateSelection(items);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateSelection(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && items[selectedIndex]) {
        items[selectedIndex].click();
      } else if (items[0]) {
        items[0].click();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      resultEl.style.display = "none";
      resultEl.innerHTML = "";
      suggestionsEl.innerHTML = "";
      selectedIndex = -1;
    }
  });
});
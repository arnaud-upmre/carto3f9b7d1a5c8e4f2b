let lieux = [];
let appareils = [];
let allItems = [];
let fuseMix = null;
let selectedIndex = -1;

const URL_POSTES = "https://raw.githubusercontent.com/arnaud-upmre/carto3f9b7d1a5c8e4f2b/main/postes.json";
const URL_APPAREILS = "https://raw.githubusercontent.com/arnaud-upmre/carto3f9b7d1a5c8e4f2b/main/appareils.json";

const compteurURL = "https://script.google.com/macros/s/AKfycbzUFaek89LYosR0FSw9gyxn2IZXlFlWXA_dIFIDwox-szE3DgH-l8IVbGfaoIgGK04h/exec";
const compteurAppareilURL = "https://script.google.com/macros/s/AKfycbwJIlvcfNYREJn1oPiVAhQqHACXXar8ZbRl6aChwYw4TFSAaMTFEHTT5X2T7BKLJ3gsJw/exec";

const isMap = window.location.href.includes("map.html");
console.log("📍 Page détectée :", window.location.href, "| isMap =", isMap);

function incrementCounter() {
  console.log("🧮 incrementCounter() appelé !");
  fetch(compteurURL + "?increment=true")
    .then(r => console.log("✅ Réponse poste :", r.status))
    .catch(err => console.error("❌ Erreur compteur poste :", err));
}

function incrementCounterAppareil() {
  console.log("🧮 incrementCounterAppareil() appelé !");
  fetch(compteurAppareilURL + "?increment=true")
    .then(r => console.log("✅ Réponse appareil :", r.status))
    .catch(err => console.error("❌ Erreur compteur appareil :", err));
}

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


document.addEventListener("DOMContentLoaded", async () => {
  await chargerBaseRecherche();

  const input = document.getElementById("search");
  const suggestionsEl = document.getElementById("suggestions");
  const resultEl = document.getElementById("result");


  if (!input) {
    console.warn("🔎 Aucun champ de recherche (#search) sur cette page — recherche désactivée");
    return;
  }

  input.addEventListener("input", e => {
    const rawQuery = e.target.value.trim();
    const query = normalize(rawQuery);
    const cleanedQuery = query.replace(/\s+/g, ""); 
    suggestionsEl.innerHTML = "";
    resultEl.innerHTML = "";
    resultEl.style.display = "none";
    selectedIndex = -1;

    if (!query || query.length < 2 || !fuseMix) return;

    // ► Recherche brute
    let results = fuseMix.search(query).map(r => r.item);

    // ► Filtre préfixe (tt, i, tc, tsa, il, ip, imp, s)
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

    // ► Tri complet
    results = trierResultats(results, cleanedQuery, query.toLowerCase());

    // ► Affichage des suggestions
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


li.onclick = (e) => {
  e.preventDefault();

if (
  isMap &&
  item.category === "poste" &&
  item.poste_latitude && item.poste_longitude &&
  (item.latitude || item.acces_latitude || item.accesLongitude || item.longitude)
) {

  
    // Vérifie s'il y a déjà un menu ouvert → on le ferme si on reclique
    const existing = li.querySelector(".submenu");
    if (existing) {
      existing.remove();
      return;
    }

    // Crée le menu déplié
    const submenu = document.createElement("div");
    submenu.className = "submenu";
    submenu.innerHTML = `
      <div class="submenu-inner">
        <p>Aller à :</p>
        <button class="btn-poste">📍 Poste</button>
        <button class="btn-acces">🚙 Accès</button>
      </div>
    `;

    li.appendChild(submenu);

    // 📍 Clic sur "Poste"
    submenu.querySelector(".btn-poste").addEventListener("click", (ev) => {
      ev.stopPropagation();
      showLieu({ ...item, force: "poste" });
      closeSearchBar();
    });

    // 🚙 Clic sur "Accès"
    submenu.querySelector(".btn-acces").addEventListener("click", (ev) => {
      ev.stopPropagation();
      showLieu({ ...item, force: "acces" });
      closeSearchBar();
    });

// return; // ⛔ retiré pour permettre au compteur de s’incrémenter sur map
  }

  // ⚙️ Sinon (index ou autre cas), comportement normal
  if (item.category === "poste") showLieu(item);
  else showAppareil(item);
  closeSearchBar();
};


      
      suggestionsEl.appendChild(li);
    });
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
}); // ✅ ferme le DOMContentLoaded



window.initSearch = function(map, allMarkers) {
  console.log("🔍 [recherche.js] initSearch appelée depuis map");

  // on s’assure que les variables globales existent bien
  window.map = map;
  window.allMarkers = allMarkers;

  // on charge la base sans bloquer la définition
  chargerBaseRecherche()
    .then(() => {
      console.log("✅ Base de recherche prête (map)");
    })
    .catch(err => {
      console.error("❌ Erreur lors du chargement de la base de recherche :", err);
    });

  // log de contrôle pour confirmer la présence
  console.log("✅ window.initSearch définie et opérationnelle");
};



// 🔧 Helper : ouvre la popup d’un marker même s’il est encore dans un cluster
function openMarkerPopup(marker, targetZoom = 20) {
  const ll = marker.getLatLng();
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    map.flyTo(ll, targetZoom, { animate: true, duration: 0.6 });
    // ouvre après l’animation / la déclusterisation
    setTimeout(() => { if (marker.getPopup) marker.openPopup(); }, 300);
  };

  const tryGroup = (grp) => {
    if (grp && typeof grp.hasLayer === "function" && grp.hasLayer(marker) && typeof grp.zoomToShowLayer === "function") {
      grp.zoomToShowLayer(marker, finish);
      return true;
    }
    return false;
  };

  // on essaye dans chaque cluster group (selon le type, un seul matchera)
  if (!tryGroup(postesLayer) && !tryGroup(accesLayer) && !tryGroup(appareilsLayer)) {
    // pas dans un cluster group (ou déjà visible) → fallback
    finish();
  }
}


function iconForMarker(m) {
  let id = (m.options.customId || "").toUpperCase();
  id = id.replace(/[^A-Z0-9]/g, ""); // 🔧 nettoyage

  if (m.options.isAcces) return "acces.png";
  if (id.includes("POSTE")) return "poste.png";
  if (id.startsWith("I") || id.startsWith("SI") || id.startsWith("D")) return "int.png";
  if (id.startsWith("TT") || id.startsWith("TSA") || id.startsWith("TC") || id.startsWith("TRA")) return "TT.png";
  if (/^[0-9]/.test(id) || id.startsWith("S") || id.startsWith("ST") || id.startsWith("F") || id.startsWith("P") || id.startsWith("FB") || id.startsWith("B")) return "sect.png";
  if (id.startsWith("ALIM")) return "alim.png";
  if (id.startsWith("DU")) return "stop.png";
  return null;
}


// ===============================
// ✅ showLieu (version finale : postes OK + accès groupés comme showAppareil)
// ===============================
window.showLieu = function (item) {
  console.log("✅ showLieu appelé !", item);
  if (!window.map || !window.allMarkers) return;

  // 🔍 Helper : cherche un marker proche de coordonnées données
  function findMarkerByCoords(lat, lng) {
    const tol = 0.00001; // ≈ 1 mètre
    return window.allMarkers.find(m => {
      const ll = m.getLatLng();
      return Math.abs(ll.lat - lat) < tol && Math.abs(ll.lng - lng) < tol;
    });
  }

  // 🧭 Cas appel direct (force = poste ou acces)
  if (item.force === "poste" && item.poste_latitude && item.poste_longitude) {
    const lat = parseFloat(item.poste_latitude);
    const lng = parseFloat(item.poste_longitude);
    const marker = findMarkerByCoords(lat, lng);
    if (marker) openMarkerPopup(marker, 19);
    else map.flyTo([lat, lng], 19, { animate: true, duration: 0.6 });
    closeSearchBar();
    return;
  }

  if (item.force === "acces" && item.latitude && item.longitude) {
    const lat = parseFloat(item.latitude);
    const lng = parseFloat(item.longitude);

    // ✅ Cherche tous les accès au même endroit (groupement)
    const sameAcces = window.allMarkers.filter(m => {
      const ll = m.getLatLng();
      return (
        Math.abs(ll.lat - lat) < 0.00001 &&
        Math.abs(ll.lng - lng) < 0.00001
      );
    });

    if (sameAcces.length > 1) {
      // Popup groupée comme showAppareil
      const html = `
        <div style="min-width:220px;display:flex;flex-direction:column;gap:6px">
          ${sameAcces.map((m, i) => {
            const id = (m.options.customId || "").toUpperCase();
            const iconFile = iconForMarker(m);
            return `
              <a href="#" class="cluster-link" data-idx="${i}"
                 style="display:flex;align-items:center;gap:6px;padding:4px 6px;
                        border-radius:8px;background:#fff2;">
                ${iconFile ? `<img src="ico/${iconFile}" style="width:16px;height:16px;">` : ""}
                <span>${id}</span>
              </a>`;
          }).join("")}
        </div>
      `;

      L.popup({ maxWidth: 260 })
        .setLatLng([lat, lng])
        .setContent(html)
        .openOn(map);

      setTimeout(() => {
        document.querySelectorAll(".leaflet-popup-content a.cluster-link").forEach(link => {
          link.addEventListener("click", ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const idx = +ev.currentTarget.dataset.idx;
            const target = sameAcces[idx];
            const content = target.getPopup()?.getContent() || "";
            const popupEl = document.querySelector(".leaflet-popup-content");
            if (popupEl) popupEl.innerHTML = content;
          });
        });
      }, 0);

      closeSearchBar();
      return;
    }

    // Sinon, ouvre normalement
    const marker = findMarkerByCoords(lat, lng);
    if (marker) openMarkerPopup(marker, 19);
    else map.flyTo([lat, lng], 19, { animate: true, duration: 0.6 });
    closeSearchBar();
    return;
  }

  // 🧱 Identifiant textuel complet
  const targetId = [
    item.nom || "",
    item.type || "",
    item.SAT || "",
    item["accès"] || item.acces || ""
  ].filter(Boolean).join(" ").toLowerCase().trim();

  // 🔎 Recherche du marker
  let matches = window.allMarkers.filter(m =>
    (m.options.customId || "").toLowerCase().trim() === targetId
  );

  if (!matches.length && item.latitude && item.longitude) {
    const marker = findMarkerByCoords(parseFloat(item.latitude), parseFloat(item.longitude));
    if (marker) matches = [marker];
  }

  if (!matches.length) return;

  const latlng = matches[0].getLatLng();

// --- Incrémentation compteur (carte) ---
if (isMap) {
  if (typeof incrementCounter === "function") incrementCounter();
  console.log("📈 +1 poste/acces (recherche validée sur la carte)");
  console.log("DEBUG isMap dans showLieu =", isMap);
}

  // ✅ Poste seul → popup directe
  openMarkerPopup(matches[0], 19);
  closeSearchBar();
};



// ===============================
// ✅ showAppareil
// ===============================
window.showAppareil = function (item) {
    console.log("✅ showAppareil appelé !", item);
  if (!window.map || !window.allMarkers) return;

  const targetId = [
    item.appareil || "",
    item.nom || "",
    item.type || "",
    item.SAT || ""
  ].filter(Boolean).join(" ").toLowerCase().trim();

  const matches = window.allMarkers.filter(m =>
    (m.options.customId || "").toLowerCase().trim() === targetId
  );
  if (!matches.length) return;

  const latlng = matches[0].getLatLng();

  const sameCoords = window.allMarkers.filter(m => {
    const ll = m.getLatLng();
    return ll.lat === latlng.lat && ll.lng === latlng.lng;
  });

  if (sameCoords.length === 1) {
    openMarkerPopup(sameCoords[0], 21);
    closeSearchBar();
    return;
  }

  const html = `
    <div style="min-width:220px;display:flex;flex-direction:column;gap:6px">
      ${sameCoords.map((m, i) => {
        const id = (m.options.customId || "").toUpperCase();
        const iconFile = iconForMarker(m);
        return `
          <a href="#" class="cluster-link" data-idx="${i}" 
             style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:8px;background:#fff2;">
            ${iconFile ? `<img src="ico/${iconFile}" style="width:16px;height:16px;">` : ""}
            <span>${id}</span>
          </a>`;
      }).join("")}
    </div>
  `;

  const popup = L.popup({ maxWidth: 260 })
    .setLatLng(latlng)
    .setContent(html)
    .openOn(map);

setTimeout(() => {
  document.querySelectorAll(".leaflet-popup-content a.cluster-link").forEach((link) => {
    link.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation(); // ✅ empêche Leaflet de fermer la popup
      const idx = +ev.currentTarget.dataset.idx;
      const target = sameCoords[idx];
      const content = target.getPopup()?.getContent() || "";

      // ✅ remplace le contenu sans fermer la popup
      const popup = document.querySelector(".leaflet-popup-content");
      if (popup) popup.innerHTML = content;
    });
  });
}, 0);


// --- Incrémentation compteur (carte) ---
if (isMap) {
  if (typeof incrementCounterAppareil === "function") incrementCounterAppareil();
  console.log("📈 +1 appareil (recherche validée sur la carte)");
  console.log("DEBUG isMap dans showAppareil =", isMap);
}
  
  map.flyTo(latlng, 20, { animate: true, duration: 0.6 });
  closeSearchBar();
};



function closeSearchBar() {
  const searchWrapper = document.getElementById("searchWrapper");
  const searchInput = document.getElementById("search");
  if (searchWrapper && searchWrapper.classList.contains("open")) {
    searchWrapper.classList.remove("open");
    searchInput.blur();
  }
}

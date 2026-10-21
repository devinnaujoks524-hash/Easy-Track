import {
  MEALS,
  KEYS,
  EXAMPLES,
  initial,
  clone,
  uid,
  today,
  shiftDate,
  number,
  nutrients,
  snapshot,
  recipeFood,
  sum,
  goalAt,
  weekStats,
  validateData,
  validDate,
} from "./model.js";
const $ = (s, root = document) => root.querySelector(s),
  app = $("#app"),
  modal = $("#modal"),
  STORAGE = "easy-track.v1";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (n, d = 0) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: d }).format(n);
const dateText = (
  d,
  options = { weekday: "long", day: "numeric", month: "long" },
) =>
  new Intl.DateTimeFormat("de-DE", options).format(new Date(d + "T12:00:00"));
const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{ home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>', chart: '<path d="M4 3v17h17M8 16v-5m5 5V6m5 10V9"/>', food: '<path d="M8 3v7M5 3v5a3 3 0 0 0 6 0V3M8 11v10M19 21V3c-4 3-4 10 0 10"/>', book: '<path d="M4 4h6l2 2 2-2h6v16h-6l-2 1-2-1H4Z M12 6v15"/>', settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--surface)"/><circle cx="16" cy="17" r="3" fill="var(--surface)"/>', plus: '<path d="M12 5v14M5 12h14"/>', left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', check: '<path d="m5 12 4 4L19 6"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>', leaf: '<path d="M20 3C8 2 2 7 5 15s16 5 15-12ZM4 21 15 10"/>', copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/>', edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>', trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>', moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>' }[name] || '<circle cx="12" cy="12" r="8"/>'}</svg>`;
const btn = (label, action, extra = "", cls = "button secondary") =>
  `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
let data = initial(),
  loadError = "",
  readOnly = false;
try {
  const raw = localStorage.getItem(STORAGE);
  if (raw) data = validateData(JSON.parse(raw));
} catch (e) {
  loadError =
    "Die gespeicherten Daten konnten nicht gelesen werden. Sie werden nicht überschrieben. Exportiere die Originaldaten zur Sicherung oder importiere ein gültiges Backup.";
  readOnly = true;
}
let page = "today",
  date = today(),
  foodFilter = "all",
  foodQuery = "",
  pickerFilter = "all",
  pickerQuery = "",
  context = {},
  draft = null,
  restoreFocus = null,
  undoTimer,
  toastTimer;
const allFoods = () => [...data.foods, ...EXAMPLES];
const findFood = (id) => allFoods().find((f) => f.id === id);
function save(next) {
  try {
    if (readOnly)
      throw Error(
        "Bitte sichere die Originaldaten und importiere ein gültiges Backup oder setze die Daten zurück.",
      );
    localStorage.setItem(STORAGE, JSON.stringify(next));
    data = next;
    return true;
  } catch (e) {
    toast("Speichern nicht möglich: " + e.message);
    return false;
  }
}
function change(fn, message) {
  const next = clone(data);
  fn(next);
  if (!save(next)) return false;
  render();
  if (message) toast(message);
  return true;
}
function toast(message, undo) {
  clearTimeout(toastTimer);
  clearTimeout(undoTimer);
  const el = $("#toast");
  el.innerHTML = `<span>${esc(message)}</span>${undo ? '<button type="button" id="undo">Rückgängig</button>' : ""}`;
  el.classList.add("show");
  if (undo)
    $("#undo").onclick = () => {
      undo();
      el.classList.remove("show");
    };
  toastTimer = setTimeout(
    () => el.classList.remove("show"),
    undo ? 10000 : 5000,
  );
}
function openDialog(title, body, wide = false) {
  if (!modal.open) restoreFocus = document.activeElement;
  modal.className = wide ? "wide" : "";
  modal.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${title}</h2>${btn(icon("close"), "close", 'aria-label="Dialog schließen"', "icon-button")}</div><div class="dialog-body">${body}</div>`;
  if (!modal.open) modal.showModal();
  requestAnimationFrame(() => {
    (
      modal.querySelector("[autofocus]") ||
      modal.querySelector("input,select,textarea") ||
      modal.querySelector("button")
    ).focus();
  });
}
function closeDialog() {
  modal.close();
}
modal.addEventListener("close", () => {
  if (restoreFocus?.isConnected) restoreFocus.focus();
  else $("#page-title")?.focus();
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeDialog();
  }
});
const mealSelect = (value) =>
  `<label>Mahlzeit<select name="meal">${MEALS.map((m) => `<option ${m === value ? "selected" : ""}>${m}</option>`).join("")}</select></label>`;
const dateInput = (value, name = "date", label = "Datum") =>
  `<label>${label}<input name="${name}" type="date" min="1900-01-01" max="2200-12-31" value="${value}" required></label>`;
const numInput = (name, label, value = "", optional = false) =>
  `<label>${label}<input name="${name}" inputmode="decimal" value="${esc(value === null ? "" : String(value).replace(".", ","))}" ${optional ? "" : "required"} autocomplete="off"><small class="field-error" data-error="${name}"></small></label>`;
const macros = (n) =>
  `<span class="macro-text"><b class="p">E</b> ${fmt(n.protein, 1)} g <b class="c">K</b> ${fmt(n.carbs, 1)} g <b class="f">F</b> ${fmt(n.fat, 1)} g</span>`;
function preview(n) {
  return `<div class="nutrition-preview"><div><strong>${fmt(n.kcal)}</strong><span>kcal</span></div>${[
    ["protein", "Eiweiß"],
    ["carbs", "Kohlenhydrate"],
    ["fat", "Fett"],
  ]
    .map(
      ([k, l]) =>
        `<div><strong>${fmt(n[k], 1)} <small>g</small></strong><span>${l}</span></div>`,
    )
    .join("")}</div>`;
}
let lastViewKey;
function render() {
  document.documentElement.dataset.theme = data.theme;
  const nav = [
    ["today", "home", "Heute"],
    ["history", "chart", "Verlauf"],
    ["foods", "food", "Lebensmittel"],
    ["recipes", "book", "Rezepte"],
    ["settings", "settings", "Einstellungen"],
  ];
  app.innerHTML = `<aside class="sidebar"><a href="#" class="brand" data-action="nav" data-page="today"><span class="brand-symbol">${icon("leaf", 26)}</span><span>easy<span class="brand-light">track</span><small>DEIN ERNÄHRUNGSTAGEBUCH</small></span></a><div class="nav-label">DEIN ALLTAG, IM BLICK</div><nav aria-label="Hauptnavigation">${nav.map(([id, ic, l]) => `<button type="button" data-action="nav" data-page="${id}" class="nav-item ${page === id ? "active" : ""}" ${page === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${l}</span></button>`).join("")}</nav><div class="sidebar-note">${icon("lock")}<strong>Deine Daten bleiben bei dir.</strong><p>Lokal gespeichert.<br>Ohne Konto. Ganz entspannt.</p></div><div class="sidebar-footer">Easy Track <span>Version 1.0</span></div></aside><main id="main"><div class="topline"><span>Ein bisschen Überblick. Mehr Alltag.</span><span class="local-badge">${icon("lock", 14)} Nur auf diesem Gerät</span></div>${loadError ? `<div class="error-banner" role="alert">${loadError}${btn("Originaldaten sichern", "raw-export")}</div>` : ""}${{ today: todayView, history: historyView, foods: foodsView, recipes: recipesView, settings: settingsView }[page]()}</main>`;
  const viewKey = page + (page === "today" ? "|" + date : "");
  app.classList.toggle("entering", viewKey !== lastViewKey);
  lastViewKey = viewKey;
}
function pageHead(eyebrow, title, desc, action = "") {
  return `<header class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1 id="page-title" tabindex="-1">${title}</h1><p>${desc}</p></div>${action}</header>`;
}
function dateControls() {
  return `<div class="date-controls">${btn(icon("left"), "day", 'data-delta="-1" aria-label="Vorheriger Tag"', "icon-button")}<label class="date-picker"><span>${dateText(date)}</span><input type="date" aria-label="Tag auswählen" min="1900-01-01" max="2200-12-31" id="selected-date" value="${date}"></label>${btn(icon("right"), "day", 'data-delta="1" aria-label="Nächster Tag"', "icon-button")}${btn("Heute", "today", "", "button small secondary")}</div>`;
}
let waterAnim = null;
const GLASS_PATH = "M5 3H35L31 53Q30.6 57 27 57H13Q9.4 57 9 53Z";
const WAVE_PATH = "M0 0Q5 -3 10 0T20 0T30 0T40 0T50 0T60 0T70 0T80 0V70H0Z";
function glassSvg(i, anim) {
  const cls = anim ? ` ${anim.type}` : "";
  const delay = anim ? ` style="--delay:${anim.delay}ms"` : "";
  return `<svg class="glass-svg${cls}"${delay} viewBox="0 0 40 60" aria-hidden="true" focusable="false"><defs><clipPath id="wc${i}"><path d="${GLASS_PATH}"/></clipPath></defs><path class="glass-body" d="${GLASS_PATH}"/><g clip-path="url(#wc${i})"><g class="lvl"><path class="wave wave-b" d="${WAVE_PATH}"/><path class="wave wave-a" d="${WAVE_PATH}"/></g><path class="shine" d="M12 9L14.6 47"/></g><path class="glass-outline" d="${GLASS_PATH}"/></svg>`;
}
function waterView() {
  const count = data.water?.[date] ?? 0;
  const slots = Math.max(4, count);
  const anim = waterAnim;
  waterAnim = null;
  const animFor = (i) => {
    if (!anim) return null;
    if (anim.to > anim.from && i >= anim.from && i < anim.to) return { type: "rise", delay: (i - anim.from) * 110 };
    if (anim.to < anim.from && i >= anim.to && i < anim.from) return { type: "drain", delay: (anim.from - 1 - i) * 70 };
    return null;
  };
  return `<section class="water-card" aria-labelledby="water-title"><div class="water-heading"><div><h2 id="water-title">Wasser <small>· 250 ml je Glas</small></h2><p>Tippe auf ein Glas zum Füllen oder Zurücknehmen.</p></div><strong>${fmt(count * 250)} <small>ml</small></strong></div><div class="water-glasses" aria-label="Getrunkene Gläser">${Array.from({ length: slots }, (_, i) => `<button type="button" class="water-glass ${i < count ? "filled" : ""}${animFor(i) ? " " + animFor(i).type + "-btn" : ""}" style="--delay:${animFor(i)?.delay ?? 0}ms" data-action="water-set" data-count="${i + 1}" aria-label="${i + 1} ${i === 0 ? "Glas" : "Gläser"} · ${(i + 1) * 250} ml${i < count ? " · gefüllt" : ""}" aria-pressed="${i < count}">${glassSvg(i, animFor(i))}<span class="water-number">${i + 1}</span></button>`).join("")}${btn(icon("plus", 16), "water-add", 'aria-label="Ein Glas Wasser hinzufügen, 250 ml"', "water-add-button")}</div></section>`;
}function todayView() {
  const entries = data.entries.filter((e) => e.date === date),
    n = sum(entries),
    goal = goalAt(data.goals, date),
    hasCalorieGoal = goal?.kcal != null,
    remaining = hasCalorieGoal ? goal.kcal - n.kcal : null,
    progress = hasCalorieGoal ? Math.min(100, (n.kcal / goal.kcal) * 100) : 0;
  return `<h1 id="page-title" class="sr-only" tabindex="-1">Tagesübersicht</h1>${dateControls()}<section class="overview" aria-label="Tageswerte"><div class="calorie-card"><div class="card-label">KALORIEN ${date === today() ? "HEUTE" : "AN DIESEM TAG"} <span class="goal-tools">kcal ${btn(icon("edit", 14) + " Bearbeiten", "edit-goal", 'data-focus="kcal" aria-label="Kalorienziel bearbeiten"', "goal-edit")}</span></div><div class="calorie-main"><div class="ring${hasCalorieGoal && remaining < 0 ? " over" : ""}" style="--progress:${progress}%" role="img" aria-label="${hasCalorieGoal ? (remaining >= 0 ? fmt(remaining) + " Kilokalorien übrig" : fmt(-remaining) + " Kilokalorien zu viel") : fmt(n.kcal) + " Kilokalorien aufgenommen"}"><div><strong>${hasCalorieGoal ? fmt(Math.abs(remaining)) : fmt(n.kcal)}</strong><span>${hasCalorieGoal ? (remaining >= 0 ? "kcal übrig" : "kcal zu viel") : "aufgenommen"}</span></div></div>${hasCalorieGoal ? "" : `<div class="goal-info"><span>Dein Tagesziel</span><strong>—</strong><p>Du bestimmst, was zu dir passt.</p>${btn("Ziel festlegen →", "edit-goal", 'data-focus="kcal"', "text-button")}</div>`}</div></div><div class="macro-card"><div class="card-label">DEINE MAKRONÄHRSTOFFE <span class="goal-tools">in Gramm ${btn(icon("edit", 14) + " Bearbeiten", "edit-goal", 'data-focus="protein" aria-label="Makronährstoffziele bearbeiten"', "goal-edit")}</span></div>${[
    ["protein", "Eiweiß", "p"],
    ["carbs", "Kohlenhydrate", "c"],
    ["fat", "Fett", "f"],
  ]
    .map(
      ([k, l, c]) =>
        `<div class="macro-row"><div><span class="dot ${c}"></span>${l}<strong>${fmt(n[k], 1)} <small>g${goal?.[k] != null ? " / " + fmt(goal[k], 1) + " g" : ""}</small></strong></div><div class="track"><span class="${c}" style="width:${goal?.[k] > 0 ? Math.min(100, (n[k] / goal[k]) * 100) : 0}%"></span></div></div>`,
    )
    .join(
      "",
    )}<p class="micro">${goal && ["protein", "carbs", "fat"].some((k) => goal[k] != null) ? "Deine individuell eingestellten Makroziele." : "Makroziele sind optional – du kannst sie in den Einstellungen ergänzen."}</p></div></section>${waterView()}<div class="meal-section-heading"><div class="section-title"><h2>Deine Mahlzeiten</h2><span>${entries.length} ${entries.length === 1 ? "Eintrag" : "Einträge"}</span></div>${btn(icon("plus") + " Mahlzeit hinzufügen", "choose-meal", "", "button primary")}</div><div class="meal-grid">${MEALS.map(
    (meal, i) =>
      mealCard(
        meal,
        i,
        entries.filter((e) => e.meal === meal),
      ),
  ).join(
    "",
  )}</div><div class="daily-note">${icon("leaf", 18)} Kleine Schritte, ein guter Überblick. Ganz in deinem Tempo.</div>`;
}
function mealCard(meal, i, entries) {
  const n = sum(entries);
  return `<section class="meal-card"><div class="meal-head"><span class="meal-symbol m${i}">${icon(["sun", "food", "moon", "leaf"][i], 22)}</span><h3>${meal}<small>${entries.length ? entries.length + " " + (entries.length === 1 ? "Eintrag" : "Einträge") : ["Ein guter Start in den Tag", "Zeit für eine kleine Pause", "Den Tag entspannt ausklingen lassen", "Für den Hunger zwischendurch"][i]}</small></h3><strong>${fmt(n.kcal)} <small>kcal</small></strong>${entries.length ? btn(icon("copy"), "copy-meal", `data-meal="${meal}" aria-label="${meal} kopieren"`, "icon-button") : ""}</div>${entries.length ? `<div class="entries">${entries.map((e) => `<div class="entry"><button type="button" class="entry-main" data-action="edit-entry" data-id="${e.id}"><strong>${esc(e.name)}</strong><span>${fmt(e.amount, 2)} ${e.unit === "portion" ? "Portionen" : e.unit}${e.unit === "portion" && e.food.source !== "recipe" ? " · je " + fmt(e.food.portionSize, 2) + " " + e.food.basis : ""}</span></button><strong>${fmt(e.nutrients.kcal)} <small>kcal</small></strong>${btn(icon("edit", 16), "edit-entry", `data-id="${e.id}" aria-label="${esc(e.name)} bearbeiten"`, "icon-button")}</div>`).join("")}</div><details><summary>Makronährstoffe anzeigen</summary><div class="meal-macros">${macros(n)}</div></details>` : `<div class="meal-empty">Noch nichts eingetragen.</div>`}${btn(icon("plus", 18) + " Lebensmittel hinzufügen", "add", `data-meal="${meal}"`, "add-food")}</section>`;
}
function historyView() {
  const w = weekStats(data.entries, date),
    max = Math.max(...w.days.map((d) => d.kcal), 1);
  return `${pageHead("DEINE ENTWICKLUNG", "Ein Blick zurück.", "Deine Woche – ohne Bewertung, mit Überblick.")}${dateControls()}<section class="panel"><div class="section-title"><h2>${dateText(w.days[0].date, { day: "numeric", month: "short" })} – ${dateText(w.days[6].date, { day: "numeric", month: "short", year: "numeric" })}</h2><div>${btn("← Woche", "week", 'data-delta="-7"', "button small secondary")}${btn("Woche →", "week", 'data-delta="7"', "button small secondary")}</div></div><div class="week-stats"><div><strong>${fmt(w.total)} <small>kcal</small></strong><span>Gesamte Woche</span></div><div><strong>${fmt(w.average)} <small>kcal</small></strong><span>Ø pro erfasstem Tag</span></div><div><strong>${w.count} <small>/ 7</small></strong><span>Tage mit Einträgen</span></div></div><div class="chart">${w.days.map((d) => `<button type="button" class="chart-day ${d.date === today() ? "current" : ""}" data-action="open-day" data-date="${d.date}" aria-label="${dateText(d.date)}: ${d.count ? fmt(d.kcal) + " kcal" : "keine Einträge"}"><span class="bar-value">${d.count ? fmt(d.kcal) : "—"}</span><span class="bar-zone"><span class="bar ${d.count ? "" : "empty"}" style="height:${d.count ? Math.max(2, (d.kcal / max) * 100) : 3}%"></span></span><strong>${dateText(d.date, { weekday: "short" })}</strong><small>${dateText(d.date, { day: "numeric", month: "numeric" })}</small></button>`).join("")}</div><p class="micro">Der Durchschnitt berücksichtigt nur Tage mit mindestens einem Eintrag. Einträge bedeuten nicht zwingend, dass ein Tag vollständig erfasst ist. „—“ bedeutet: keine Einträge.</p></section><div class="section-title"><h2>Die Tage im Detail</h2></div><div class="history-list">${[
    ...w.days,
  ]
    .reverse()
    .map((d) => {
      const g = goalAt(data.goals, d.date);
      const meals = MEALS.filter((m) =>
        data.entries.some((e) => e.date === d.date && e.meal === m),
      );
      return `<button type="button" class="history-day" data-action="open-day" data-date="${d.date}"><div><strong>${dateText(d.date)}</strong><span>${d.count ? meals.join(" · ") : "Keine Lebensmittel eingetragen"}</span></div><div><strong>${d.count ? fmt(d.kcal) + " kcal" : "—"}</strong><span>${g?.kcal != null ? "Ziel: " + fmt(g.kcal) + " kcal" : "Kein Kalorienziel festgelegt"}</span>${d.count ? macros(d) : ""}</div>${icon("right")}</button>`;
    })
    .join("")}</div>`;
}
function filterFoods(query, filter) {
  let list = allFoods();
  if (filter === "favorites")
    list = list.filter((f) => data.favorites.includes(f.id));
  if (filter === "custom") list = list.filter((f) => f.source === "custom");
  if (filter === "recent") {
    const ids = [
      ...new Set(
        [...data.entries]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((e) => e.foodId),
      ),
    ];
    list = ids.map((id) => findFood(id)).filter(Boolean);
  }
  const q = query.toLocaleLowerCase("de").trim();
  return list.filter((f) =>
    (f.name + " " + f.brand).toLocaleLowerCase("de").includes(q),
  );
}
function searchBox(id, value) {
  return `<div class="search-box">${icon("search")}<input type="search" id="${id}" value="${esc(value)}" placeholder="Lebensmittel oder Marke suchen …" aria-label="Lebensmittel oder Marke suchen" autocomplete="off"></div>`;
}
function filters(active, picker = false) {
  return `<div class="filters" role="group" aria-label="Lebensmittel filtern">${[
    ["all", "Alle"],
    ["favorites", "Favoriten"],
    ["recent", "Zuletzt verwendet"],
    ["custom", "Eigene"],
  ]
    .map(([id, l]) =>
      btn(
        l,
        picker ? "picker-filter" : "food-filter",
        `data-filter="${id}" aria-pressed="${active === id}"`,
        "filter " + (active === id ? "active" : ""),
      ),
    )
    .join("")}</div>`;
}
function foodRows(list, picker = false) {
  return list.length
    ? list
        .map(
          (f) =>
            `<div class="food-row">${btn(icon("star", 19), "favorite", `data-id="${f.id}" aria-label="${data.favorites.includes(f.id) ? "Favorit entfernen" : "Als Favorit markieren"}: ${esc(f.name)}" aria-pressed="${data.favorites.includes(f.id)}"`, "icon-button favorite " + (data.favorites.includes(f.id) ? "selected" : ""))}<button type="button" class="food-main" data-action="${picker ? "pick-food" : "food-add"}" data-id="${f.id}"><strong>${esc(f.name)}</strong><span>${f.brand ? esc(f.brand) + " · " : ""}${f.source === "custom" ? "Eigenes Lebensmittel" : "Beispieldaten"} · pro 100 ${f.basis}</span></button><span class="food-kcal"><strong>${fmt(f.kcal)}</strong> kcal</span>${!picker && f.source === "custom" ? btn(icon("edit", 18), "edit-food", `data-id="${f.id}" aria-label="${esc(f.name)} bearbeiten"`, "icon-button") : ""}${btn(icon("plus", 18), picker ? "pick-food" : "food-add", `data-id="${f.id}" aria-label="${esc(f.name)} auswählen"`, "icon-button plus")}</div>`,
        )
        .join("")
    : `<div class="empty"><span class="empty-icon">${icon("search", 30)}</span><h3>${(picker ? pickerFilter : foodFilter) === "favorites" ? "Du hast noch keine Favoriten." : "Keine Lebensmittel gefunden."}</h3><p>${(picker ? pickerFilter : foodFilter) === "favorites" ? "Markiere Lebensmittel mit dem Stern, um sie hier schnell wiederzufinden." : "Lege ein eigenes Lebensmittel mit den Angaben auf der Verpackung an."}</p>${btn("Eigenes Lebensmittel anlegen", "new-food", "", "button primary")}</div>`;
}
function foodsView() {
  return `${pageHead("DEINE SAMMLUNG", "Gutes Essen, schnell gefunden.", "Deine Lebensmittel. Immer griffbereit.", btn(icon("plus") + " Lebensmittel anlegen", "new-food", "", "button primary"))}<section class="panel">${searchBox("food-search", foodQuery)}${filters(foodFilter)}<p class="data-note">${icon("leaf", 16)} Die Beispieldaten dienen zur Orientierung. Sie sind nicht verifiziert und keine vollständige Lebensmitteldatenbank.</p><div id="food-results">${foodRows(filterFoods(foodQuery, foodFilter))}</div></section>`;
}
function chooseMeal(foodId) {
  context = { date, foodId };
  openDialog(
    "Was möchtest du eintragen?",
    `<p class="muted">Wähle eine Mahlzeit für ${dateText(date)}.</p><div class="meal-choices">${MEALS.map((m, i) => btn(`<span class="meal-symbol m${i}">${icon(["sun", "food", "moon", "leaf"][i])}</span><span>${m}</span>${icon("right")}`, "choose", `data-meal="${m}"`, "meal-choice")).join("")}</div>`,
  );
}
function picker() {
  openDialog(
    context.ingredient ? "Zutat auswählen" : "Lebensmittel hinzufügen",
    `${context.ingredient ? "" : `<p class="muted">${context.meal} · ${dateText(context.date)}</p>`}${searchBox("picker-search", pickerQuery)}${filters(pickerFilter, true)}<p class="micro">Beispieldaten sind nicht verifiziert. Prüfe bei Bedarf die Verpackungsangaben.</p><div id="picker-results">${foodRows(filterFoods(pickerQuery, pickerFilter), true)}</div><div class="dialog-footer">${btn("Eigenes Lebensmittel anlegen", "new-food", "", "button secondary")}${context.ingredient ? btn("Zurück zum Rezept", "back-recipe", "", "text-button") : ""}</div>`,
    true,
  );
}
function amountDialog(food, entry = null) {
  context.food = clone(food);
  context.entry = entry;
  let last = [...data.entries]
    .sort((a, b) => b.createdAt - a.createdAt)
    .find((e) => e.foodId === food.id);
  if (last && last.food.basis !== food.basis) last = null;
  const amount = entry?.amount ?? last?.amount ?? (food.portionSize ? 1 : 100),
    unit =
      entry?.unit ??
      (last?.unit === "portion" && !food.portionSize ? null : last?.unit) ??
      (food.portionSize ? "portion" : food.basis);
  openDialog(
    entry
      ? "Eintrag bearbeiten"
      : context.ingredient
        ? "Zutat hinzufügen"
        : esc(food.name),
    `<form id="amount-form" novalidate><p class="muted">${entry ? esc(entry.name) : esc(food.brand || (food.source === "recipe" ? "Eigenes Rezept" : food.source === "custom" ? "Eigenes Lebensmittel" : "Beispieldaten · nicht verifiziert"))}</p><div class="form-grid">${numInput("amount", "Menge", amount)}<label>Einheit<select name="unit">${food.source !== "recipe" ? `<option value="${food.basis}" ${unit === food.basis ? "selected" : ""}>${food.basis === "g" ? "Gramm (g)" : "Milliliter (ml)"}</option>` : ""}${food.portionSize ? `<option value="portion" ${unit === "portion" ? "selected" : ""}>Portionen${food.source === "recipe" ? "" : " · " + esc(food.portionName || "Portion")}</option>` : ""}</select></label></div>${food.portionSize ? `<p class="micro">1 Portion = ${food.source === "recipe" ? "ein Anteil von " + fmt(food.recipeServings ?? 1, 2) + " Portionen des gesamten Rezepts" : fmt(food.portionSize, 2) + " " + food.basis}.</p>` : ""}<div id="amount-preview"></div>${context.ingredient ? "" : `<div class="form-grid">${mealSelect(entry?.meal ?? context.meal ?? MEALS[0])}${dateInput(entry?.date ?? context.date ?? date)}</div>`}<p class="form-error" role="alert"></p><div class="dialog-footer">${entry ? btn(icon("trash", 17) + " Löschen", "delete-entry", `data-id="${entry.id}"`, "button danger") + btn(icon("copy", 17) + " Kopieren", "copy-entry", `data-id="${entry.id}"`, "button secondary") : btn("Zurück", context.ingredient ? "back-recipe" : "back-picker", "", "button secondary")}<button class="button primary" type="submit">${entry ? "Änderungen speichern" : context.ingredient ? "Zutat übernehmen" : "Hinzufügen"}</button></div></form>`,
  );
  updateAmount();
}
function error(form, name, msg) {
  const el = form.querySelector(`[data-error="${name}"]`);
  if (el) el.textContent = msg;
  const input = form.elements[name];
  if (el) {
    el.id = "error-" + name;
    input?.setAttribute("aria-describedby", el.id);
  }
  input?.setAttribute("aria-invalid", String(!!msg));
  return !msg;
}
function getNumber(
  form,
  name,
  { optional = false, positive = false, max = 1e6 } = {},
) {
  const text = form.elements[name].value.trim();
  if (optional && !text) {
    error(form, name, "");
    return null;
  }
  const n = number(text);
  const msg = !Number.isFinite(n)
    ? "Bitte gib eine gültige Zahl ein, zum Beispiel 1,5."
    : n < 0 || (positive && n < 0.000001)
      ? "Bitte gib eine Zahl größer als " +
        (positive ? "0 (mindestens 0,000001)" : "oder gleich 0") +
        " ein."
      : n > max
        ? "Bitte gib eine kleinere Zahl ein."
        : "";
  error(form, name, msg);
  return msg ? undefined : n;
}
function updateAmount() {
  const form = $("#amount-form");
  if (!form) return;
  const n = getNumber(form, "amount", { positive: true });
  $("#amount-preview").innerHTML =
    n === undefined
      ? '<div class="nutrition-preview muted">Gib eine gültige Menge für die Vorschau ein.</div>'
      : preview(nutrients(context.food, n, form.elements.unit.value));
}
function submitAmount(form) {
  const amount = getNumber(form, "amount", { positive: true });
  if (amount === undefined) return form.elements.amount.focus();
  const unit = form.elements.unit.value;
  if (context.ingredient) {
    draft.ingredients.push({ food: clone(context.food), amount, unit });
    recipeEditor();
    return;
  }
  const dt = form.elements.date.value,
    meal = form.elements.meal.value;
  if (!validDate(dt)) {
    form.querySelector(".form-error").textContent =
      "Bitte wähle ein gültiges Datum zwischen 1900 und 2200.";
    return;
  }
  const e = snapshot(context.food, amount, unit, dt, meal);
  if (context.entry) e.id = context.entry.id;
  const editing = !!context.entry;
  if (
    change(
      (d) => {
        if (editing) d.entries[d.entries.findIndex((x) => x.id === e.id)] = e;
        else d.entries.push(e);
      },
      editing ? "Eintrag aktualisiert." : "Lebensmittel hinzugefügt.",
    )
  ) {
    date = dt;
    page = "today";
    render();
    closeDialog();
  }
}
function foodEditor(food) {
  context.returnToPicker = modal.open && !!$("#picker-results");
  context.editFoodId = food?.id;
  const f = food ?? {
    name: context.returnToPicker ? pickerQuery : foodQuery,
    brand: "",
    basis: "g",
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
    portionName: "",
    portionSize: "",
  };
  openDialog(
    food ? "Lebensmittel bearbeiten" : "Eigenes Lebensmittel anlegen",
    `<form id="food-form" novalidate><label>Name<input name="name" value="${esc(f.name)}" required maxlength="200" autofocus></label><label>Marke <span class="optional">optional</span><input name="brand" value="${esc(f.brand)}" maxlength="200"></label><label>Nährwerte beziehen sich auf<select name="basis"><option value="g" ${f.basis === "g" ? "selected" : ""}>100 Gramm (g)</option><option value="ml" ${f.basis === "ml" ? "selected" : ""}>100 Milliliter (ml)</option></select></label><div class="form-grid">${numInput("kcal", "Kalorien (kcal)", f.kcal)}${numInput("protein", "Eiweiß (g)", f.protein)}${numInput("carbs", "Kohlenhydrate (g)", f.carbs)}${numInput("fat", "Fett (g)", f.fat)}</div><div class="subsection"><h3>Portion <span class="optional">optional</span></h3><div class="form-grid"><label>Bezeichnung<input name="portionName" placeholder="z. B. Becher" value="${esc(f.portionName)}" maxlength="100"></label>${numInput("portionSize", "Größe in g bzw. ml", f.portionSize, true)}</div><p class="micro">Die Portionsgröße verwendet dieselbe Einheit wie die Nährwertbasis. Es erfolgt keine Umrechnung zwischen ml und g.</p></div><p class="form-error" role="alert"></p><div class="dialog-footer">${food ? btn("Lebensmittel löschen", "delete-food", `data-id="${food.id}"`, "button danger") : btn("Abbrechen", "cancel-food", "", "button secondary")}<button type="submit" class="button primary">Speichern</button></div></form>`,
  );
}
function submitFood(form) {
  const name = form.elements.name.value.trim(),
    vals = Object.fromEntries(KEYS.map((k) => [k, getNumber(form, k)])),
    size = getNumber(form, "portionSize", { optional: true, positive: true }),
    pn = form.elements.portionName.value.trim();
  if (
    !name ||
    Object.values(vals).includes(undefined) ||
    size === undefined ||
    (pn && !size)
  ) {
    form.querySelector(".form-error").textContent = !name
      ? "Bitte gib dem Lebensmittel einen Namen."
      : pn && !size
        ? "Bitte ergänze eine Portionsgröße oder entferne die Portionsbezeichnung."
        : "Bitte prüfe die markierten Nährwerte.";
    return;
  }
  const f = {
    id: context.editFoodId ?? uid(),
    name,
    brand: form.elements.brand.value.trim(),
    basis: form.elements.basis.value,
    ...vals,
    portionSize: size,
    portionName: pn || "Portion",
    source: "custom",
  };
  if (
    change((d) => {
      const i = d.foods.findIndex((x) => x.id === f.id);
      if (i >= 0) d.foods[i] = f;
      else d.foods.push(f);
    }, "Lebensmittel gespeichert.")
  ) {
    if (context.returnToPicker) {
      context.entry = null;
      amountDialog(f);
    } else closeDialog();
  }
}
function confirmDialog(title, body, action) {
  openDialog(
    title,
    `<p>${esc(body)}</p><div class="dialog-footer">${btn("Abbrechen", "close", "", "button secondary")}${btn("Bestätigen", action, "", "button danger")}</div>`,
  );
}
function deleteEntry(id) {
  const entry = clone(data.entries.find((x) => x.id === id));
  if (change((d) => (d.entries = d.entries.filter((e) => e.id !== id)))) {
    closeDialog();
    toast("Eintrag gelöscht.", () =>
      change((d) => {
        if (!d.entries.some((e) => e.id === entry.id)) d.entries.push(entry);
      }, "Eintrag wiederhergestellt."),
    );
  }
}
function copyDialog(entries) {
  context.copy = clone(entries);
  openDialog(
    entries.length === 1 ? "Eintrag kopieren" : "Mahlzeit kopieren",
    `<p class="muted">${entries.length} ${entries.length === 1 ? "Eintrag wird" : "Einträge werden"} als neue Einträge übernommen. Das Original bleibt erhalten.</p><form id="copy-form"><div class="form-grid">${dateInput(shiftDate(date, 1))}${mealSelect(entries[0].meal)}</div><p class="form-error" role="alert"></p><div class="dialog-footer">${btn("Abbrechen", "close", "", "button secondary")}<button class="button primary" type="submit">Kopieren</button></div></form>`,
  );
}
function recipesView() {
  return `${pageHead("DEINE LIEBLINGSGERICHTE", "Einmal kochen. Einfach eintragen.", "Rezepte sammeln und portionsweise in deinen Tag übernehmen.", btn(icon("plus") + " Rezept erstellen", "new-recipe", "", "button primary"))}${
    data.recipes.length
      ? `<div class="recipe-grid">${data.recipes
          .map((r) => {
            const f = recipeFood(r);
            return `<article class="recipe-card"><div class="recipe-art">${icon("book", 40)}<span>${fmt(r.servings, 2)} Portionen</span></div><div class="recipe-content"><h2>${esc(r.name)}</h2><p>${esc(r.description) || r.ingredients.length + " Zutaten · Dein eigenes Rezept"}</p><strong class="recipe-cal">${fmt(f.kcal)} <small>kcal / Portion</small></strong><div>${macros(f)}</div><div class="recipe-actions">${btn(icon("plus", 17) + " Eintragen", "log-recipe", `data-id="${r.id}"`, "button primary")}${btn(icon("edit", 17), "edit-recipe", `data-id="${r.id}" aria-label="${esc(r.name)} bearbeiten"`, "icon-button")}${btn(icon("copy", 17), "duplicate-recipe", `data-id="${r.id}" aria-label="${esc(r.name)} duplizieren"`, "icon-button")}${btn(icon("trash", 17), "delete-recipe", `data-id="${r.id}" aria-label="${esc(r.name)} löschen"`, "icon-button")}</div></div></article>`;
          })
          .join("")}</div>`
      : `<section class="panel empty large"><span class="empty-icon">${icon("book", 40)}</span><h2>Erstelle dein erstes Rezept.</h2><p>Dein Lieblingsfrühstück oder die Pasta vom Wochenende:<br>Speichere die Zutaten und trage später nur die Portionen ein.</p>${btn(icon("plus") + " Rezept erstellen", "new-recipe", "", "button primary")}</section>`
  }`;
}
function syncDraft() {
  const f = $("#recipe-form");
  if (f) {
    draft.name = f.elements.name.value;
    draft.description = f.elements.description.value;
    draft.servingsInput = f.elements.servings.value;
    draft.ingredients.forEach((i, index) => {
      const el = f.elements["ingredient-" + index];
      if (el) i.amountInput = el.value;
    });
  }
}
function recipeEditor() {
  context.ingredient = false;
  const total = sum(
    draft.ingredients.map((i) =>
      nutrients(
        i.food,
        number(i.amountInput ?? i.amount) > 0
          ? number(i.amountInput ?? i.amount)
          : i.amount,
        i.unit,
      ),
    ),
  );
  const servings = number(draft.servingsInput ?? draft.servings);
  openDialog(
    draft.existing ? "Rezept bearbeiten" : "Rezept erstellen",
    `<form id="recipe-form" novalidate><label>Rezeptname<input name="name" maxlength="200" value="${esc(draft.name)}" required></label><label>Beschreibung <span class="optional">optional</span><textarea name="description" maxlength="3000" rows="2">${esc(draft.description)}</textarea></label>${numInput("servings", "Anzahl der Portionen", draft.servingsInput ?? draft.servings)}<div class="section-title"><h3>Zutaten</h3>${btn(icon("plus", 16) + " Zutat", "add-ingredient", "", "button small secondary")}</div>${draft.ingredients.length ? draft.ingredients.map((i, index) => `<div class="ingredient"><div><strong>${esc(i.food.name)}</strong><small>${i.unit === "portion" ? "Portionen · je " + fmt(i.food.portionSize, 2) + " " + i.food.basis : i.unit}</small></div>${numInput("ingredient-" + index, "Menge", i.amountInput ?? i.amount)}${btn(icon("trash", 17), "remove-ingredient", `data-index="${index}" aria-label="Zutat ${esc(i.food.name)} entfernen"`, "icon-button")}</div>`).join("") : '<p class="muted">Füge die erste Zutat hinzu.</p>'}<div id="recipe-preview"><h3>Gesamtes Rezept</h3>${preview(total)}${servings > 0 ? `<h3>Pro Portion</h3>${preview(Object.fromEntries(KEYS.map((k) => [k, total[k] / servings])))}` : ""}</div><p class="form-error" role="alert"></p><div class="dialog-footer">${btn("Abbrechen", "close", "", "button secondary")}<button class="button primary" type="submit">Rezept speichern</button></div></form>`,
    true,
  );
}
function updateRecipePreview() {
  syncDraft();
  const valid = draft.ingredients.every(
    (i) =>
      number(i.amountInput ?? i.amount) > 0 &&
      number(i.amountInput ?? i.amount) <= 1e6,
  );
  const portions = number(draft.servingsInput);
  if (!valid || !(portions > 0) || portions > 1e6) {
    $("#recipe-preview").innerHTML =
      '<p class="muted">Gib gültige Mengen und eine Portionsanzahl größer als 0 ein.</p>';
    return;
  }
  const total = sum(
    draft.ingredients.map((i) =>
      nutrients(i.food, number(i.amountInput ?? i.amount), i.unit),
    ),
  );
  $("#recipe-preview").innerHTML =
    `<h3>Gesamtes Rezept</h3>${preview(total)}<h3>Pro Portion</h3>${preview(Object.fromEntries(KEYS.map((k) => [k, total[k] / portions])))}`;
}
function submitRecipe(form) {
  syncDraft();
  const servings = getNumber(form, "servings", { positive: true });
  let valid = true;
  draft.ingredients.forEach((i, index) => {
    const n = getNumber(form, "ingredient-" + index, { positive: true });
    if (n === undefined) valid = false;
    else i.amount = n;
  });
  if (
    !draft.name.trim() ||
    !draft.ingredients.length ||
    servings === undefined ||
    !valid
  ) {
    form.querySelector(".form-error").textContent =
      "Bitte ergänze einen Namen, mindestens eine Zutat und gültige Mengen sowie eine Portionsanzahl größer als 0.";
    return;
  }
  const r = {
    id: draft.id,
    name: draft.name.trim(),
    description: draft.description,
    servings,
    ingredients: draft.ingredients.map(({ food, amount, unit }) => ({
      food,
      amount,
      unit,
    })),
  };
  if (
    change((d) => {
      const i = d.recipes.findIndex((x) => x.id === r.id);
      if (i >= 0) d.recipes[i] = r;
      else d.recipes.push(r);
    }, "Rezept gespeichert.")
  )
    closeDialog();
}
function settingsView() {
  const g = goalAt(data.goals, today());
  return `${pageHead("GANZ NACH DEINEM ALLTAG", "Deine Einstellungen.", "Du setzt deine Ziele. Easy Track hält den Überblick.")}<div class="settings-grid"><section class="panel"><h2>Deine Tagesziele</h2><p class="muted">Trage selbst gewählte Ziele ein. Wir berechnen keine Empfehlungen aus Körperdaten.</p><form id="goal-form" novalidate>${dateInput(today(), "date", "Gültig ab")}${numInput("kcal", "Kalorienziel (kcal)", g?.kcal ?? "", true)}<h3>Makroziele <span class="optional">optional</span></h3><div class="form-grid">${numInput("protein", "Eiweiß (g)", g?.protein ?? "", true)}${numInput("carbs", "Kohlenhydrate (g)", g?.carbs ?? "", true)}${numInput("fat", "Fett (g)", g?.fat ?? "", true)}</div><p class="micro">Ein neues Ziel gilt ab dem gewählten Datum bis zur nächsten Zieländerung. Frühere Tage bleiben unverändert. Ein Ziel mit demselben Startdatum wird ersetzt.</p><p class="form-error" role="alert"></p><button class="button primary" type="submit">Ziele speichern</button></form>${
    data.goals.length
      ? `<details class="goal-history"><summary>Gespeicherte Zieländerungen (${data.goals.length})</summary>${[
          ...data.goals,
        ]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map(
            (g) =>
              `<p>Ab ${dateText(g.date, { day: "numeric", month: "numeric", year: "numeric" })}: <strong>${g.kcal == null ? "Kein Kalorienziel" : fmt(g.kcal) + " kcal"}</strong></p>`,
          )
          .join("")}</details>`
      : ""
  }</section><div class="settings-stack"><section class="panel"><h2>Darstellung</h2><p class="muted">So, wie es sich für dich gut anfühlt.</p><div class="theme-options">${btn(icon("sun") + " Hell", "theme", 'data-theme="light" aria-pressed="' + (data.theme === "light") + '"', "button " + (data.theme === "light" ? "primary" : "secondary"))}${btn(icon("moon") + " Dunkel", "theme", 'data-theme="dark" aria-pressed="' + (data.theme === "dark") + '"', "button " + (data.theme === "dark" ? "primary" : "secondary"))}</div><p class="micro">Zahlen und Datumsangaben werden im deutschen Format angezeigt.</p></section><section class="panel"><h2>Deine Daten gehören dir.</h2><p class="muted">Lebensmittel, Einträge, Rezepte und Ziele werden lokal in diesem Browser auf diesem Gerät gespeichert. Ohne Anmeldung und ohne Cloud-Synchronisierung.</p><p class="micro">Beim Löschen von Browserdaten können sie verloren gehen. Sichere deine Daten regelmäßig als JSON-Datei. Die Datei enthält dein vollständiges Ernährungstagebuch.</p><div class="data-actions">${btn(icon("download") + " Daten exportieren", "export", "", "button secondary")}<label class="button secondary file-label">${icon("plus")} Daten importieren<input type="file" id="import-file" accept="application/json,.json"></label></div><hr>${btn("Alle gespeicherten Daten löschen", "reset", "", "text-button danger")}</section></div></div>`;
}
function goalDialog(focus) {
  const g = goalAt(data.goals, date);
  const kcalMode = focus === "kcal";
  const fields = kcalMode
    ? `<div class="goal-kcal"><span class="goal-kcal-icon">${icon("leaf", 26)}</span>${numInput("kcal", "Kalorienziel (kcal)", g?.kcal ?? "", true)}</div>`
    : `<div class="goal-macros">${[
        ["protein", "Eiweiß", "p"],
        ["carbs", "Kohlenhydrate", "c"],
        ["fat", "Fett", "f"],
      ]
        .map(
          ([k, l, c]) =>
            `<div class="macro-field ${c}-field"><span class="macro-field-dot ${c}"></span>${numInput(k, `${l} <small>in Gramm</small>`, g?.[k] ?? "", true)}</div>`,
        )
        .join("")}</div>`;
  openDialog(
    kcalMode ? "Kalorienziel bearbeiten" : "Makronährstoffziele bearbeiten",
    `<form id="goal-dialog-form" data-mode="${kcalMode ? "kcal" : "macros"}" novalidate>${dateInput(date, "date", "Gültig ab")}${fields}<p class="micro">${kcalMode ? "Das Kalorienziel gilt ab dem gewählten Datum. Frühere Tage behalten ihr bisheriges Ziel." : "Die Makroziele gelten ab dem gewählten Datum. Frühere Tage behalten ihr bisheriges Ziel. Du kannst Felder leer lassen."}</p><p class="form-error" role="alert"></p><div class="dialog-footer">${btn("Abbrechen", "close", "", "button secondary")}<button class="button primary" type="submit">Ziele speichern</button></div></form>`,
  );
  requestAnimationFrame(() =>
    modal.querySelector(`[name="${kcalMode ? "kcal" : focus}"]`)?.focus(),
  );
}
function exportData(raw = false) {
  const content = raw
    ? localStorage.getItem(STORAGE)
    : JSON.stringify(data, null, 2);
  const url = URL.createObjectURL(
    new Blob([content ?? ""], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `easy-track-${raw ? "original-" : ""}${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Dein Export wurde zum Download bereitgestellt.");
}
let pendingImport = null,
  pendingDelete = null;
async function importFile(file) {
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024)
      throw Error("Die Datei ist zu groß. Maximal 20 MB sind möglich.");
    pendingImport = validateData(JSON.parse(await file.text()));
    confirmDialog(
      "Daten aus Backup übernehmen?",
      `Die Datei enthält ${pendingImport.entries.length} Einträge, ${pendingImport.foods.length} eigene Lebensmittel, ${pendingImport.recipes.length} Rezepte und ${pendingImport.goals.length} Ziele. Alle bisherigen App-Daten werden ersetzt. Sichere sie bei Bedarf zuerst per Export.`,
      "confirm-import",
    );
  } catch (e) {
    toast(
      e instanceof SyntaxError
        ? "Die Datei enthält kein gültiges JSON. Deine bisherigen Daten bleiben erhalten."
        : e.message,
    );
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action,
    id = b.dataset.id;
  if (a === "nav") {
    e.preventDefault();
    page = b.dataset.page;
    render();
    $("#page-title").focus();
  } else if (a === "day" || a === "week") {
    const next = shiftDate(date, Number(b.dataset.delta));
    if (validDate(next)) {
      date = next;
      render();
    }
  } else if (a === "today") {
    date = today();
    render();
  } else if (a === "water-set" || a === "water-add") {
    const current = data.water?.[date] ?? 0;
    const selected = a === "water-add" ? current + 1 : Number(b.dataset.count);
    const count = a === "water-set" && selected === current ? current - 1 : selected;
    waterAnim = { from: current, to: count };
    if (Number.isInteger(count) && count >= 0 && count <= 100 && change((d) => {
      d.water ??= {};
      if (count) d.water[date] = count;
      else delete d.water[date];
    })) {
      (a === "water-add" ? app.querySelector('[data-action="water-add"]') : app.querySelector(`[data-action="water-set"][data-count="${selected}"]`))?.focus();
    }
    waterAnim = null;
  } else if (a === "open-day") {
    date = b.dataset.date;
    page = "today";
    render();
    $("#page-title").focus();
  } else if (a === "close") closeDialog();
  else if (a === "choose-meal") chooseMeal();
  else if (a === "choose") {
    context.meal = b.dataset.meal;
    if (context.foodId)
      amountDialog(context.recipe ?? findFood(context.foodId));
    else {
      pickerQuery = "";
      pickerFilter = "all";
      picker();
    }
  } else if (a === "add") {
    context = { meal: b.dataset.meal, date };
    pickerQuery = "";
    pickerFilter = "all";
    picker();
  } else if (a === "food-add") chooseMeal(id);
  else if (a === "pick-food") amountDialog(findFood(id));
  else if (a === "back-picker") picker();
  else if (a === "food-filter") {
    foodFilter = b.dataset.filter;
    render();
  } else if (a === "picker-filter") {
    pickerFilter = b.dataset.filter;
    picker();
  } else if (a === "favorite") {
    change(
      (d) =>
        (d.favorites = d.favorites.includes(id)
          ? d.favorites.filter((x) => x !== id)
          : [...d.favorites, id]),
    );
    if ($("#picker-results")) {
      $("#picker-results").innerHTML = foodRows(
        filterFoods(pickerQuery, pickerFilter),
        true,
      );
      modal.querySelector(`[data-action="favorite"][data-id="${id}"]`)?.focus();
    } else
      app.querySelector(`[data-action="favorite"][data-id="${id}"]`)?.focus();
  } else if (a === "edit-goal") goalDialog(b.dataset.focus);
  else if (a === "new-food") foodEditor();
  else if (a === "edit-food") foodEditor(findFood(id));
  else if (a === "cancel-food") {
    if (context.returnToPicker) picker();
    else closeDialog();
  } else if (a === "delete-food") {
    pendingDelete = id;
    confirmDialog(
      "Lebensmittel löschen?",
      "Das Lebensmittel wird aus deiner Sammlung und deinen Favoriten entfernt. Gespeicherte Einträge und Rezeptzutaten bleiben unverändert.",
      "confirm-delete-food",
    );
  } else if (a === "confirm-delete-food") {
    if (
      change((d) => {
        d.foods = d.foods.filter((f) => f.id !== pendingDelete);
        d.favorites = d.favorites.filter((x) => x !== pendingDelete);
      }, "Lebensmittel gelöscht.")
    )
      closeDialog();
  } else if (a === "edit-entry") {
    const entry = data.entries.find((x) => x.id === id);
    context = {};
    amountDialog(entry.food, entry);
  } else if (a === "delete-entry") deleteEntry(id);
  else if (a === "copy-entry")
    copyDialog([data.entries.find((x) => x.id === id)]);
  else if (a === "copy-meal")
    copyDialog(
      data.entries.filter((x) => x.date === date && x.meal === b.dataset.meal),
    );
  else if (a === "new-recipe") {
    draft = {
      id: uid(),
      name: "",
      description: "",
      servings: 2,
      ingredients: [],
    };
    recipeEditor();
  } else if (a === "edit-recipe") {
    draft = { ...clone(data.recipes.find((x) => x.id === id)), existing: true };
    recipeEditor();
  } else if (a === "add-ingredient") {
    syncDraft();
    context = { ingredient: true };
    pickerQuery = "";
    pickerFilter = "all";
    picker();
  } else if (a === "back-recipe") recipeEditor();
  else if (a === "remove-ingredient") {
    syncDraft();
    draft.ingredients.splice(Number(b.dataset.index), 1);
    recipeEditor();
  } else if (a === "duplicate-recipe") {
    change((d) => {
      const r = clone(d.recipes.find((x) => x.id === id));
      r.id = uid();
      r.name = r.name.slice(0, 190) + " (Kopie)";
      d.recipes.push(r);
    }, "Rezept dupliziert.");
  } else if (a === "delete-recipe") {
    pendingDelete = id;
    confirmDialog(
      "Rezept löschen?",
      "Das Rezept wird entfernt. Bereits gespeicherte Ernährungseinträge bleiben erhalten.",
      "confirm-delete-recipe",
    );
  } else if (a === "confirm-delete-recipe") {
    if (
      change(
        (d) => (d.recipes = d.recipes.filter((r) => r.id !== pendingDelete)),
        "Rezept gelöscht.",
      )
    )
      closeDialog();
  } else if (a === "log-recipe") {
    const f = recipeFood(data.recipes.find((x) => x.id === id));
    chooseMeal(f.id);
    context.recipe = f;
  } else if (a === "theme") change((d) => (d.theme = b.dataset.theme));
  else if (a === "export") exportData();
  else if (a === "raw-export") exportData(true);
  else if (a === "reset")
    confirmDialog(
      "Alle Daten löschen?",
      "Alle Einträge, eigenen Lebensmittel, Favoriten, Rezepte und Ziele werden unwiderruflich gelöscht. Exportiere vorher ein Backup, wenn du sie behalten möchtest.",
      "confirm-reset",
    );
  else if (a === "confirm-reset") {
    const oldReadOnly = readOnly;
    readOnly = false;
    if (save(initial())) {
      loadError = "";
      date = today();
      render();
      closeDialog();
      toast("Deine App-Daten wurden gelöscht.");
    } else readOnly = oldReadOnly;
  } else if (a === "confirm-import") {
    const oldReadOnly = readOnly;
    readOnly = false;
    if (save(pendingImport)) {
      loadError = "";
      pendingImport = null;
      render();
      closeDialog();
      toast("Deine Daten wurden erfolgreich importiert.");
    } else readOnly = oldReadOnly;
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "food-search") {
    foodQuery = e.target.value;
    $("#food-results").innerHTML = foodRows(filterFoods(foodQuery, foodFilter));
  } else if (e.target.id === "picker-search") {
    pickerQuery = e.target.value;
    $("#picker-results").innerHTML = foodRows(
      filterFoods(pickerQuery, pickerFilter),
      true,
    );
  } else if (e.target.closest("#amount-form")) updateAmount();
  else if (e.target.closest("#recipe-form")) updateRecipePreview();
});
document.addEventListener("change", (e) => {
  if (e.target.id === "selected-date" && validDate(e.target.value)) {
    date = e.target.value;
    render();
  }
  if (e.target.id === "import-file") {
    importFile(e.target.files[0]);
    e.target.value = "";
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.id === "amount-form") submitAmount(form);
  else if (form.id === "food-form") submitFood(form);
  else if (form.id === "recipe-form") submitRecipe(form);
  else if (form.id === "copy-form") {
    const dt = form.elements.date.value;
    if (!validDate(dt)) {
      form.querySelector(".form-error").textContent =
        "Bitte wähle ein gültiges Datum.";
      return;
    }
    if (
      change(
        (d) =>
          context.copy.forEach((entry) =>
            d.entries.push({
              ...clone(entry),
              id: uid(),
              date: dt,
              meal: form.elements.meal.value,
              createdAt: Date.now(),
            }),
          ),
        "Kopie gespeichert.",
      )
    )
      closeDialog();
  } else if (form.id === "goal-form" || form.id === "goal-dialog-form") {
    const mode = form.dataset.mode,
      dt = form.elements.date.value,
      base = (validDate(dt) && goalAt(data.goals, dt)) || {},
      kcal =
        mode === "macros"
          ? (base.kcal ?? null)
          : getNumber(form, "kcal", { optional: true, positive: true }),
      vals = Object.fromEntries(
        ["protein", "carbs", "fat"].map((k) => [
          k,
          mode === "kcal"
            ? (base[k] ?? null)
            : getNumber(form, k, { optional: true }),
        ]),
      );
    if (
      kcal === undefined ||
      Object.values(vals).includes(undefined) ||
      !validDate(dt) ||
      (kcal === null && Object.values(vals).every((value) => value === null))
    ) {
      form.querySelector(".form-error").textContent =
        "Bitte gib mindestens ein Kalorien- oder Makroziel ein und prüfe die markierten Werte.";
      return;
    }
    if (
      change((d) => {
        d.goals = d.goals.filter((g) => g.date !== dt);
        d.goals.push({ date: dt, kcal, ...vals });
      }, "Deine Ziele wurden gespeichert.") &&
      form.id === "goal-dialog-form"
    ) {
      date = dt;
      render();
      closeDialog();
    }
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE) {
    try {
      data = e.newValue ? validateData(JSON.parse(e.newValue)) : initial();
      if (modal.open) closeDialog();
      render();
      toast("Daten aus einem anderen Tab aktualisiert.");
    } catch {
      toast("Änderungen aus einem anderen Tab konnten nicht geladen werden.");
    }
  }
});
render();


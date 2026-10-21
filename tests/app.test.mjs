import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import * as model from "../dist/model.js";
const source = (
  await readFile(new URL("../dist/app.js", import.meta.url), "utf8")
).replace(/^import[\s\S]*?from "\.\/model\.js";\r?\n/, "");
function setup(saved) {
  const dom = new JSDOM(
    '<div id="app"></div><dialog id="modal"></dialog><div id="toast"></div>',
    {
      url: "http://localhost:4173",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const w = dom.window;
  Object.assign(w, model);
  w.structuredClone = structuredClone;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  if (saved) w.localStorage.setItem("easy-track.v1", saved);
  w.eval(source);
  const q = (s) => w.document.querySelector(s),
    click = (s) => {
      assert.ok(q(s), "Missing: " + s);
      q(s).click();
    },
    fill = (name, v, form = "form") => {
      const el = q(`${form} [name="${name}"]`);
      assert.ok(el, "Field: " + name);
      el.value = String(v);
      el.dispatchEvent(new w.Event("input", { bubbles: true }));
    },
    submit = (s = "form") =>
      q(s).dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      ),
    data = () => JSON.parse(w.localStorage.getItem("easy-track.v1"));
  return { dom, w, q, click, fill, submit, data };
}
test("Tageswerte stehen vor den Mahlzeiten und der Eintrag-Button bleibt erreichbar", () => {
  const t = setup();
  try {
    const main = t.q("#main");
    const overview = t.q(".overview");
    const meals = t.q(".meal-section-heading");
    assert.ok(main.contains(overview));
    assert.ok(
      overview.compareDocumentPosition(meals) &
        t.w.Node.DOCUMENT_POSITION_FOLLOWING,
    );
    assert.ok(
      t.q(".date-controls").compareDocumentPosition(overview) &
        t.w.Node.DOCUMENT_POSITION_FOLLOWING,
    );
    assert.equal(
      t.q(".meal-section-heading [data-action='choose-meal']") !== null,
      true,
    );
    t.click(".meal-section-heading [data-action='choose-meal']");
    assert.match(t.q("#dialog-title").textContent, /eintragen/);
  } finally {
    t.dom.window.close();
  }
});
test("Ziele direkt an Kalorien- und Makrokarten bearbeiten", () => {
  const t = setup();
  try {
    const day = model.today();
    t.click('[data-action="edit-goal"][data-focus="kcal"]');
    assert.match(t.q("#dialog-title").textContent, /Kalorienziel/);
    t.fill("kcal", "2000", "#goal-dialog-form");
    t.submit("#goal-dialog-form");
    assert.equal(t.data().goals.length, 1);
    assert.equal(t.data().goals[0].kcal, 2000);
    assert.equal(t.data().goals[0].date, day);
    assert.match(t.q(".calorie-card").textContent, /2\.000/);
    t.click('[data-action="edit-goal"][data-focus="protein"]');
    assert.equal(t.q('#goal-dialog-form [name="kcal"]').value, "2000");
    t.fill("protein", "120,5", "#goal-dialog-form");
    t.fill("carbs", "250", "#goal-dialog-form");
    t.fill("fat", "70", "#goal-dialog-form");
    t.submit("#goal-dialog-form");
    assert.equal(t.data().goals.length, 1);
    assert.equal(t.data().goals[0].protein, 120.5);
    assert.equal(t.data().goals[0].carbs, 250);
    assert.equal(t.data().goals[0].fat, 70);
    assert.match(t.q(".macro-card").textContent, /120,5 g/);
    assert.equal(model.goalAt(t.data().goals, model.shiftDate(day, -1)), null);
  } finally {
    t.dom.window.close();
  }
});
test("Makroziele ohne Kalorienziel direkt speichern und später ergänzen", () => {
  const t = setup();
  try {
    t.click('[data-action="edit-goal"][data-focus="protein"]');
    t.fill("protein", "110,5", "#goal-dialog-form");
    t.submit("#goal-dialog-form");
    assert.equal(t.data().goals[0].kcal, null);
    assert.equal(t.data().goals[0].protein, 110.5);
    assert.match(t.q(".calorie-card").textContent, /Dein Tagesziel/);
    assert.match(t.q(".macro-card").textContent, /110,5 g/);
    assert.doesNotThrow(() => model.validateData(t.data()));
    t.click('[data-action="edit-goal"][data-focus="kcal"]');
    t.fill("kcal", "1900", "#goal-dialog-form");
    t.submit("#goal-dialog-form");
    assert.equal(t.data().goals[0].kcal, 1900);
    assert.equal(t.data().goals[0].protein, 110.5);
  } finally {
    t.dom.window.close();
  }
});
test("Lebensmittel → Eintrag → Menge ändern → Löschen/Rückgängig → Kopieren → Reload", () => {
  const t = setup();
  try {
    t.click('[data-page="foods"]');
    t.click('[data-action="new-food"]');
    for (const [k, v] of Object.entries({
      name: "Test-Skyr",
      brand: "Testmarke",
      kcal: "60",
      protein: "10",
      carbs: "4",
      fat: "0,2",
      portionName: "Becher",
      portionSize: "150",
    }))
      t.fill(k, v);
    t.submit("#food-form");
    let d = t.data();
    assert.equal(d.foods[0].fat, 0.2);
    t.click('[data-action="food-add"]');
    t.click('[data-action="choose"][data-meal="Frühstück"]');
    t.fill("amount", "1,5");
    assert.match(t.q("#amount-preview").textContent, /135/);
    t.submit("#amount-form");
    d = t.data();
    assert.equal(d.entries[0].nutrients.kcal, 135);
    t.click('[data-action="edit-entry"]');
    t.fill("amount", "2");
    t.submit("#amount-form");
    assert.equal(t.data().entries[0].nutrients.kcal, 180);
    t.click('[data-action="edit-entry"]');
    t.click('[data-action="delete-entry"]');
    assert.equal(t.data().entries.length, 0);
    t.click("#undo");
    assert.equal(t.data().entries.length, 1);
    t.click('[data-action="copy-meal"]');
    t.fill("date", "2026-10-22");
    t.fill("meal", "Mittagessen");
    t.submit("#copy-form");
    d = t.data();
    assert.equal(d.entries.length, 2);
    assert.equal(d.entries[1].date, "2026-10-22");
    assert.equal(d.entries[1].meal, "Mittagessen");
    assert.notEqual(d.entries[0].id, d.entries[1].id);
    const re = setup(JSON.stringify(d));
    assert.equal(re.data().entries[0].nutrients.kcal, 180);
    assert.match(re.q("#app").textContent, /Test-Skyr/);
    re.dom.window.close();
  } finally {
    t.dom.window.close();
  }
});
test("Ungültige Eingaben verhindern Speichern, Favoriten und Suche", () => {
  const t = setup();
  try {
    t.click('[data-action="add"]');
    t.click('[data-action="favorite"][data-id="oats"]');
    assert.deepEqual(t.data().favorites, ["oats"]);
    t.click('[data-action="pick-food"][data-id="oats"]');
    for (const v of ["", "-1", "0", "abc"]) {
      t.fill("amount", v);
      t.submit("#amount-form");
      assert.equal(t.data().entries.length, 0);
      assert.ok(t.q('[data-error="amount"]').textContent.length);
    }
    t.fill("amount", "0,5");
    t.submit("#amount-form");
    assert.equal(t.data().entries[0].nutrients.kcal, 93);
  } finally {
    t.dom.window.close();
  }
});
test("Rezept mit Zutaten bearbeiten, Teilportionen, Duplizieren und Snapshots", () => {
  const t = setup();
  try {
    t.click('[data-page="recipes"]');
    t.click('[data-action="new-recipe"]');
    t.fill("name", "Frühstücksbowl");
    t.fill("servings", "0");
    t.submit("#recipe-form");
    assert.match(t.q(".form-error").textContent, /Zutat/);
    t.fill("servings", "2");
    t.click('[data-action="add-ingredient"]');
    t.click('[data-action="pick-food"][data-id="oats"]');
    t.fill("amount", "100");
    t.fill("unit", "g");
    t.submit("#amount-form");
    t.click('[data-action="add-ingredient"]');
    t.click('[data-action="pick-food"][data-id="milk"]');
    t.fill("amount", "200");
    t.fill("unit", "ml");
    t.submit("#amount-form");
    assert.match(t.q("#recipe-preview").textContent, /466/);
    t.submit("#recipe-form");
    assert.equal(t.data().recipes.length, 1);
    t.click('[data-action="log-recipe"]');
    t.click('[data-action="choose"][data-meal="Frühstück"]');
    t.fill("amount", "0,5");
    t.submit("#amount-form");
    assert.equal(t.data().entries[0].nutrients.kcal, 116.5);
    t.click('[data-page="recipes"]');
    t.click('[data-action="edit-recipe"]');
    t.fill("ingredient-0", "50");
    t.submit("#recipe-form");
    assert.equal(t.data().entries[0].nutrients.kcal, 116.5);
    t.click('[data-action="duplicate-recipe"]');
    assert.equal(t.data().recipes.length, 2);
    assert.notEqual(t.data().recipes[0].id, t.data().recipes[1].id);
    assert.doesNotThrow(() => model.validateData(t.data()));
  } finally {
    t.dom.window.close();
  }
});
test("Ziele ändern ohne frühere Tagesziele zu überschreiben und Dunkelmodus speichern", () => {
  const t = setup();
  try {
    t.click('[data-page="settings"]');
    t.fill("date", "2026-10-01");
    t.fill("kcal", "2000");
    t.submit("#goal-form");
    t.fill("date", "2026-10-21");
    t.fill("kcal", "1800");
    t.fill("protein", "120");
    t.submit("#goal-form");
    assert.equal(model.goalAt(t.data().goals, "2026-10-20").kcal, 2000);
    assert.equal(model.goalAt(t.data().goals, "2026-10-21").kcal, 1800);
    t.click('[data-theme="dark"]');
    assert.equal(t.data().theme, "dark");
    assert.equal(t.w.document.documentElement.dataset.theme, "dark");
  } finally {
    t.dom.window.close();
  }
});
test("Lebensmitteländerungen verändern gespeicherte Einträge nicht", () => {
  const d = model.initial(),
    f = { ...model.clone(model.EXAMPLES[0]), id: "custom", source: "custom" };
  d.foods.push(f);
  d.entries.push(model.snapshot(f, 100, "g", model.today(), "Frühstück"));
  const t = setup(JSON.stringify(d));
  try {
    t.click('[data-page="foods"]');
    t.click('[data-action="edit-food"]');
    t.fill("kcal", "500");
    t.submit("#food-form");
    assert.equal(t.data().foods[0].kcal, 500);
    assert.equal(t.data().entries[0].nutrients.kcal, 372);
  } finally {
    t.dom.window.close();
  }
});
test("JSON-Datei exportieren, importieren und fehlerhafte Datei unverändert abweisen", async () => {
  const d = model.initial();
  d.entries.push(
    model.snapshot(model.EXAMPLES[0], 100, "g", model.today(), "Frühstück"),
  );
  const t = setup(JSON.stringify(d));
  try {
    let blob;
    t.w.URL.createObjectURL = (b) => {
      blob = b;
      return "blob:test";
    };
    t.w.URL.revokeObjectURL = () => {};
    t.w.HTMLAnchorElement.prototype.click = function () {};
    t.click('[data-page="settings"]');
    t.click('[data-action="export"]');
    const text = await new Promise((res, rej) => {
      const r = new t.w.FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsText(blob);
    });
    assert.deepEqual(JSON.parse(text), d);
    const imported = JSON.parse(text);
    imported.theme = "dark";
    async function file(content) {
      const el = t.q("#import-file");
      Object.defineProperty(el, "files", {
        configurable: true,
        value: [{ size: content.length, text: async () => content }],
      });
      el.dispatchEvent(new t.w.Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 5));
    }
    await file(JSON.stringify(imported));
    assert.equal(t.data().theme, "light");
    assert.ok(t.q('[data-action="confirm-import"]'));
    t.click('[data-action="confirm-import"]');
    assert.equal(t.data().theme, "dark");
    assert.equal(t.data().entries.length, 1);
    const before = JSON.stringify(t.data());
    await file("{broken");
    assert.equal(JSON.stringify(t.data()), before);
    assert.match(t.q("#toast").textContent, /kein gültiges JSON/);
    await file('{"version":1}');
    assert.equal(JSON.stringify(t.data()), before);
    assert.match(t.q("#toast").textContent, /kein gültiger/);
  } finally {
    t.dom.window.close();
  }
});
test("Speicherfehler melden und defekte lokale Daten nicht überschreiben", () => {
  const t = setup("{invalid");
  try {
    t.click('[data-page="settings"]');
    t.fill("kcal", "2000");
    t.submit("#goal-form");
    assert.equal(t.w.localStorage.getItem("easy-track.v1"), "{invalid");
    assert.match(t.q("#toast").textContent, /Speichern nicht möglich/);
  } finally {
    t.dom.window.close();
  }
});

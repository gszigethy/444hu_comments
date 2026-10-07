# Fejlesztői dokumentáció

## Felépítés

Manifest V3 bővítmény, build lépés nélkül (nincs csomagoló vagy transpiler).

| Fájl | Szerep |
| --- | --- |
| `manifest.json` | Nincs kötelező hosztengedély és nincs statikus content script: minden támogatott oldal `optional_host_permissions` (a tesztek ellenőrzik, hogy egyezik a `sites.json`-nal) |
| `sites.json` | A 444hsz.com támogatott oldallistájának másolata (a `check_sites.py` és a napi `sites-sync` workflow figyeli) |
| `444hsz_sites.js` | Közös oldalillesztő: hoszt/útvonal illesztés, szál-URL, cím, origin minta |
| `background.js` | Service worker (Chrome) / event page (Firefox): a megadott engedélyek alapján regisztrálja a content scripteket, telepítéskor/frissítéskor megnyitja a beállításokat |
| `options.html`, `options.js`, `options.css` | Beállítások oldal: oldalankénti kapcsoló (`permissions.request/remove`), „Mind be/ki”, magyarázó súgó |
| `444hsz_multisite.js` | A 444.hu-n kívüli oldalak content scriptje (egyelőre csak jelez a konzolon) |
| `444hu_comments.js` | Content script: `DOMContentLoaded` után a hoszt alapján kiválasztja a frontendet, és `<script type=module>`/`<link>` elemekkel beinjektálja az erőforrásokat; meta-elemekben átadja a bővítmény URL-jét és verzióját |
| `444hu_comments_inject.js` | Az új (Ember alapú) 444.hu frontend modulja: megvárja a `n3/app` útválasztót, minden cikkoldalnál beszúrja a komment blokkot és a felső gombot, kezeli a beállításokat és a Disqus betöltését |
| `444hu_comments_inject_legacy.js` | A régi blogmotor (aldomainek, pl. `jo.`, `geekz.`) támogatása |
| `backburner.js` | Beágyazott Backburner.js ütemező (az Ember `afterRender` sorához) |
| `444hu_comments.css`, `444hu_comments_legacy.css` | Megjelenés, sötét/világos téma, oldalsáv |
| `images/` | Ikonok, logók |

Az injektált kód a **lap saját JS-kontextusában** fut (nem izolált világban),
mert az Ember privát konténerét (`requirejs("n3/app")`, `router:main`) éri el.
Ezért a `web_accessible_resources` bejegyzés szükséges.

### Engedélyek és regisztráció

- Az engedély maga a kapcsoló: a beállítások oldal `permissions.contains`-szel
  olvas, nincs külön mentett állapot. A `permissions.request` csak közvetlenül a
  kattintásból hívható, ezért a „Mind be” egyetlen hívás az összes még nem
  engedélyezett origin-nel (egyetlen böngészőablak); a „Mind ki” egyetlen
  `permissions.remove`, ablak nélkül.
- A `background.js` minden indításkor és minden engedélyváltozáskor (`onAdded`,
  `onRemoved`) újraépíti a regisztrációt: törli a sajátjait, majd a megadott
  oldalakra regisztrálja a 444.hu bootstrapet (`kor.`/`membership.` kizárással)
  vagy az általános scriptet. Ismert kockázat: a Chrome/Firefox
  engedély-átvitele 1.4.x-ről **nem ellenőrzött**; a worker mindkét esetet kezeli
  (`#frissites` figyelmeztetés).
- A csomagoló (`package_extension.py`) a manifestben nem szereplő fájlokat is
  felveszi: az options HTML hivatkozásait, a `background.scripts` fájlokat, a
  worker `js: [...]` listáiban regisztrált content scripteket és a `sites.json`-t.
- Új oldal esetén: `python .github/ci/check_sites.py --update`, majd a
  `manifest.json` két listájának (`optional_host_permissions`,
  `web_accessible_resources.matches`) frissítése; a `manifest.test.mjs` hibája
  kiírja a várt listát.

### Működés röviden (modern frontend)

1. `waitForRouter()` 200 ms-onként próbálkozik, amíg az útválasztónak van
   `currentRouteName` értéke.
2. Első rendereléskor (`backburner afterRender`) és minden `currentURL`
   változáskor `startInit()` ütemezi az `init()`-et (1 s késleltetés,
   legfeljebb 10 újrapróbálkozás, 500 ms-onként).
3. `pageIsArticle()` az útvonalnév (`…--reader.post`) alapján dönt.
4. `reset()` kiválasztja a beszúrási módot (0–5, −1) a lap DOM-ja alapján,
   `initCommentsSection()` beszúrja a blokkot, `initButtons()` bekötéseket
   végez, `applySettings()` visszatölti a mentett beállításokat.
5. A Disqus az `https://<shortname>.disqus.com/embed.js` betöltésével indul;
   fórumváltáskor `unloadDisqus()` törli a globálisokat és a scripteket.

### Mentett beállítások (`localStorage`)

`_444hsz_sidebar`, `_444hsz_user_forum_enabled`, `_444hsz_user_forum_shortname`,
`_444hsz_announcement_read`, `_444hsz_autoload_comments`,
`_444hsz_show_disqus_recommendations`.

## Tesztelés

Előfeltétel: Node 24, Python 3.13.

```sh
npm ci --prefix .github/ci/node-tools --ignore-scripts --no-audit --no-fund
.github/ci/node-tools/node_modules/.bin/c8 --all --include='444hu_comments*.js' \
  --check-coverage --per-file --lines=85 --functions=80 --branches=75 \
  node --experimental-vm-modules --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py' -v
.github/ci/node-tools/node_modules/.bin/eslint .
.github/ci/node-tools/node_modules/.bin/prettier --check '*.js' '*.css' manifest.json
python3 .github/ci/package_extension.py
```

A tesztek jsdom-ban, izolált VM-kontextusban futtatják a valódi forrásokat;
nem töltenek le Disqust és nem érnek el élő oldalt. A valódi böngészőben, a
444.hu-n végzett kézi próbát nem helyettesítik.

## CI

A `.github/workflows/quality.yml` ESLint-összehasonlítást (új hibák buktatnak),
szintaxisellenőrzést, egység- és DOM-teszteket lefedettségi küszöbbel,
Prettier-ellenőrzést, manifest-validálást, csomagolást és SonarQube Cloud
minőségkaput futtat. Részletek: [`.github/QUALITY.md`](../.github/QUALITY.md) (angol).

## Kiadás

1. Emeld a `manifest.json` `version` mezőjét (négy tagú, pl. `1.4.0.27`).
2. PR a `master`-be (a `quality` ellenőrzés kötelező).
3. A CI által feltöltött `chrome-extension` artefaktum a bolti feltöltés alapja;
   a bolti publikálás kézi lépés.

## Ismert hiányosságok és kockázatok

Az alábbiakat a kódolvasás és a 2026-10-07-i angol audit alapján gyűjtöttük;
ezek nem mind hibák, hanem javítandó/figyelendő pontok.

- **Nincs `LICENSE` fájl**, miközben a Firefox-bolt MPL-2.0-t jelöl meg.
- **Privát Ember-API-ra épül** (`requirejs("n3/app")`, `router:main`, DOM
  szelektorok): egy 444-es oldalfrissítés eltörheti. A `waitForRouter()` ha az
  API eltűnik, a végtelenségig, 200 ms-onként újrapróbál.
- A hosztválasztás a pontos `444.hu` névre illeszt; egy esetleges `www.444.hu`
  a **régi frontendet** kapná. Érdemes ellenőrizni, hogy a `www` mindig átirányít-e.
- A `pageIsArticle()` 10 sikertelen várakozás után `undefined`-ot ad, ami
  csendben „nem cikk”-ként értelmeződik.
- A régi frontend (`444hu_comments_inject_legacy.js`) fixen `444hsz` fórumot
  használ, a saját fórum beállítást **nem** veszi figyelembe.
- A régi CSS az új frontendnél is betöltődik (a `444hu_comments.js` mindig
  injektálja); ez szándékos lehet, de nincs dokumentálva.
- A komment blokk a `/assets/logo-444.svg#logo` útvonalat hivatkozza a 444
  oldaláról; ha a logó helye változik, a fül ikon eltűnik.
- A `localStorage` kulcsok a 444.hu eredetben vannak, ezért az oldal saját
  scriptjei is olvashatják őket (érzékeny adat nincs köztük).
- A `web_accessible_resources` miatt az oldalak észlelhetik a bővítmény
  jelenlétét (ujjlenyomat-kockázat, alacsony).
- Nincs `browser_specific_settings` (Gecko-azonosító) a manifestben; a
  Firefox-bolti kiadás jelenleg 1.4.0.23, a repó 1.4.0.26.
- A `backburner.js` verziója nincs dokumentálva.
- A szolgálati közlemény szövege (2023-as állapot) naprakészítésre szorul.

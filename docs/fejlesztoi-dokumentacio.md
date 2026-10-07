# Fejlesztői dokumentáció

## Felépítés

Manifest V3 bővítmény, build lépés nélkül (nincs csomagoló vagy transpiler).

| Fájl | Szerep |
| --- | --- |
| `manifest.json` | Content script a `*.444.hu` oldalakra (`document_start`), kivéve `kor.` és `membership.` |
| `444hu_comments.js` | Content script: `DOMContentLoaded` után a hoszt alapján kiválasztja a frontendet, és `<script type=module>`/`<link>` elemekkel beinjektálja az erőforrásokat; meta-elemekben átadja a bővítmény URL-jét és verzióját |
| `444hu_comments_inject.js` | Az új (Ember alapú) 444.hu frontend modulja: megvárja a `n3/app` útválasztót, minden cikkoldalnál beszúrja a komment blokkot és a felső gombot, kezeli a beállításokat és a Disqus betöltését |
| `444hu_comments_inject_legacy.js` | A régi blogmotor (aldomainek, pl. `jo.`, `geekz.`) támogatása |
| `backburner.js` | Beágyazott Backburner.js ütemező (az Ember `afterRender` sorához) |
| `444hu_comments.css`, `444hu_comments_legacy.css` | Megjelenés, sötét/világos téma, oldalsáv |
| `images/` | Ikonok, logók |

Az injektált kód a **lap saját JS-kontextusában** fut (nem izolált világban),
mert az Ember privát konténerét (`requirejs("n3/app")`, `router:main`) éri el.
Ezért a `web_accessible_resources` bejegyzés szükséges.

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

# Támogatott oldalak felderítése (2026-10-07)

Ez a lap azt rögzíti, mit találtunk a 444hsz.com által támogatott oldalakon, és
ebből milyen szabályokat követ az általános (nem 444.hu) komment blokk. A
felderítés **csak olvasott**: oldalanként egy főoldal- és egy cikklekérés
(`GET`), semmi sem lett elküldve vagy kommentelve. Újrafuttatható:

```sh
python3 .github/ci/site_recon.py --fixtures tests/fixtures/sites --out tests/fixtures/sites/report.json
```

A teljes eredmény a `tests/fixtures/sites/report.json` fájlban van, a
`tests/fixtures/sites/*.html` pedig a cikkoldalak **leegyszerűsített
vázai**: csak a tájékozódási elemek (`main`, `article`, `footer`, `h1`, …
azonosítóval/osztállyal) és az `og:type`/`canonical` jelölés maradt meg, szöveg
és szkript nélkül. Ezekre épülnek az általános frontend tesztjei; a valódi oldalak
viselkedését a kézi teszt ellenőrzi.

## Eredmények

Jelölések: **cikk-jel** = amiből az oldal cikknek ismerhető fel; **beszúrás** =
hova kerül a blokk (a szabályokat lásd lent); **CSP** = a `script-src` engedi-e a
`*.disqus.com` betöltését.

| Oldal | Cikk-jel | Szerkezet | CSP | Megjegyzés |
| --- | --- | --- | --- | --- |
| 444.hu | `og:type=article`, NewsArticle | (meglévő Ember frontend) | nincs | változatlan |
| Qubit | `og:type=article`, NewsArticle | 5 `article` (listák is) → a `h1`-et tartalmazó | nincs | |
| Telex, Transtelex | `og:type=article`, NewsArticle | `main`, benne `footer` | nincs | Nuxt (SPA): lapozás közben nincs újratöltés |
| 24.hu | `og:type=article`, NewsArticle | 1 `article` | nincs | `ng.24.hu` stb. is |
| Szabad Európa | `og:type=article`, NewsArticle | `main`, `footer` | nincs | |
| RTL | NewsArticle (az `og:type` itt `video.other`!) | `main`, `footer` | nincs | az `og:type` önmagában nem elég |
| Mérce | `og:type=article` | `main`, `footer` | nincs | |
| Forbes | `og:type=article`, NewsArticle | `main`, `footer` | nincs | Cookiebot |
| Media1 | `og:type=article` | 9 `article` → a `h1`-et tartalmazó | nincs | |
| The Guardian | `og:type=article`, NewsArticle | 1 `article` | `https:` | engedi |
| Magyar Hang | `og:type=article`, Article | `main`, `footer` | nincs | |
| Magyar Narancs | `og:type=article` | 21 `article` → a `h1`-et tartalmazó | nincs | |
| Rakéta | `og:type=article`, NewsArticle | csak `footer` | nincs | a cikk-URL gyökér szintű, hosszú slug |
| Válasz Online | `og:type=article` | 1 `article`, nincs `footer` | nincs | a `canonical` relatív |
| Klubrádió | csak az útvonal (`regexPath`) | a lekért oldal üres váz (~11 KB) | nincs | feltehetően kliensoldali render: várni kell a tartalomra |
| Népszava | `og:type=article`, NewsArticle | nincs `main`/`article`/`footer` | `*` | engedi; kézi teszt kell a beszúrási pontra |
| Menedzsment Fórum | `og:type=article`, NewsArticle | 1 `article`, `footer` | nincs | |
| Átlátszó | `og:type=article`, Article | 22 `article` → a `h1`-et tartalmazó | nincs | |
| Kontroll | `og:type=article` | `main`, `footer` | nincs | Cookiebot |
| Amerikai Népszava | **nem ellenőrizhető** | a cikkek belépési oldalra irányítanak | `script-src 'self'` | a belépési oldal tiltaná a Disqust; nincs fixture |

## Szabályok az általános frontendhez

1. **Cikkoldal:** `og:type=article`, vagy JSON-LD `NewsArticle`/`Article`/`BlogPosting`,
   vagy olyan oldal, amelyre a `regexPath` illeszkedik (Klubrádió). Főoldalakon és
   szekcióoldalakon nem jelenik meg semmi.
2. **Beszúrás:** a *h1-et tartalmazó* `article` végére; ennek híján a `main`
   végére; ennek híján a `footer` elé; végső esetben a `body` végére. A blokk
   mindig a `body`-n belül van, és ha a konténerben van `footer`, az elé kerül.
3. **A szál URL-je** a böngésző címe (`location`), a `transforms` és a `?`/`#`
   levágása után, ahogy a 444hsz.com is csinálja. A `canonical`-t nem használjuk
   (Válasz Online relatív `canonical`-je is ezért nem gond).
4. **SPA:** Telex/Transtelex (Nuxt) és feltehetően Klubrádió: a cím
   változását figyelni kell, és `DISQUS.reset`-tel vagy újrabeszúrással kell
   reagálni.

## Amit a felderítés mutatott, és érdemes jelezni a 444hsz.com üzemeltetőjének

- **Lakmusz** (`www\.lakmusz\.hu`): a `www.lakmusz.hu` átirányít a
  `lakmusz.hu` címre, amelyre a 444hsz.com szabálya (`^www\.lakmusz\.hu$`)
  **nem illeszkedik**. A bővítmény a 444hsz.com szabályait követi, így itt
  jelenleg nem tud futni. A szabály módosítása a 444hsz.com oldalán kell, a
  napi szinkron utána magától jelez.
- **G7** (`(\w+\.)?g7\.hu`): a `g7.hu` átirányít a `telex.hu/g7` címre. A cikkek a
  Telex szabályára illeszkednek (a Telex szerepel előbb a listában), a G7
  bejegyzés gyakorlatilag nem használt.
- **Amerikai Népszava**: nem derült ki, hogy a cikkek belépés nélkül
  megnyithatók-e; ezt a kézi teszt dönti el.

## Nem ellenőrzött

- A Disqus **trusted domains** beállítása (csak a 444hsz fórum üzemeltetői látják).
- Cookie-/paywall-falak mögötti oldalak tényleges DOM-ja (a felderítés
  bejelentkezés és süti nélkül, a nyers HTML-t nézte, nem a futtatott lapot).
- Hogy a mintaoldalak a többi cikksablonra is jellemzőek-e.

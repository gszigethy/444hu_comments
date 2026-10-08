# 444hsz – böngészőbővítmény a 444.hu és más oldalak kommentjeihez

A **444hsz** egy nem hivatalos böngészőbővítmény, amely a [444.hu](https://444.hu)
és a [444hsz.com](https://444hsz.com) által támogatott további oldalak (Telex,
Qubit, 24.hu stb., lásd a [listát](docs/tamogatott-oldalak.md)) cikkei alá
visszahozza a kommentelés lehetőségét egy [Disqus](https://disqus.com) fórum
beágyazásával. A bővítmény eredeti szerzője **nerblock**; ez a repó az
eredeti projekt továbbfejlesztett forkja ([lásd lent](#eredet-és-ez-a-fork)).

> **Szolgálati közlemény (a bővítmény saját szövege alapján):** a 444 2023
> márciusától teljesen megszüntette a cikkek kommentelését. A hivatalos,
> csak előfizetők számára elérhető Disqus fórum egyelőre még betölthető a
> bővítménnyel, de a bővítmény ezen támogatása később kikerülhet.

## Mit tud?

- Szabad kommentelés a cikkek alatt egy nem hivatalos Disqus fórumban
  (alapértelmezés: `444hsz`).
- Menet közbeni váltás a **hivatalos (444)** és a **nem hivatalos (444hsz)**
  kommentfolyam között; a bővítmény megjegyzi a kiválasztott fület.
- Kommentek automatikus betöltése (opcionális).
- Oldalsáv (dokkolt) nézet, átméretezhető szélességgel.
- Saját Disqus fórum megadása a beállításokban.
- Sötét/világos téma követése (a 444 `jeti-theme` sütije, ennek hiányában a
  rendszerbeállítás szerint).
- Külön „Kommentek” gomb a cikk tetején, `#comment…` hivatkozások támogatása.
- Működik a 444.hu aldomainjein (blogok, pl. `jo.444.hu`, `geekz.444.hu`) is.
  A `membership.444.hu` és a `kor.444.hu` oldalakon a bővítmény **nem fut**.
- **Oldalankénti bekapcsolás:** a bővítmény telepítés után sehol sem fut. A
  beállítások oldalon (az eszköztár-ikonra kattintva) kapcsolhatod be azokat az
  oldalakat, ahol kommentelni szeretnél. Bekapcsoláskor a böngésző egy
  felugró ablakban engedélyt kér; ha véletlenül elutasítod, a
  [használati útmutatóban](docs/hasznalat.md)
  megtalálod a helyreállítás lépéseit.

## Telepítés

| Böngésző | Forrás |
| --- | --- |
| Firefox (asztali és Android) | [addons.mozilla.org/firefox/addon/444hsz](https://addons.mozilla.org/firefox/addon/444hsz/) |
| Opera | [addons.opera.com – 444hsz](https://addons.opera.com/hu/extensions/details/444hsz) |
| Chrome / Chromium / Edge | kicsomagolt bővítményként, lásd lent |

A hivatalos bővítményoldal: <https://444hsz.com/kiegeszitok/bongeszo-bovitmeny>.
Hibabejelentés és támogatás: bovitmeny@444hsz.com, illetve a GitHub Issues.

> Megjegyzés: a Chrome Web Store-ban létezik egy *„444hu Disqus embed”* nevű,
> **más szerzőtől származó** bővítmény is. Ez nem azonos a 444hsz-szel, és nem
> ennek a repónak a terméke.

### Telepítés fejlesztői módban (Chrome / Chromium / Edge)

1. `git clone https://github.com/gszigethy/444hu_comments.git`
2. Nyisd meg a `chrome://extensions` oldalt, kapcsold be a **Fejlesztői módot**.
3. **Kicsomagolt bővítmény betöltése** → válaszd ki a repó mappáját.

Telepíthető ZIP is készíthető: `python3 .github/ci/package_extension.py`
(kimenet: `dist/444hu_comments.zip`).

## Adatvédelem

A bővítmény csak azokhoz az oldalakhoz fér hozzá, amelyeket te bekapcsolsz a
beállítások oldalon (telepítés után egyik sem), **nem gyűjt adatot és nem
tartalmaz telemetriát**. A hozzáférést bármikor visszavonhatod.
A beállításokat a böngésző `localStorage`-ában tárolja. A kommentek betöltésekor
viszont a böngésződ a Disqus szervereivel (`*.disqus.com`) kommunikál, amelyre
a Disqus saját adatkezelési szabályai vonatkoznak.

## Dokumentáció

- [Használati útmutató](docs/hasznalat.md)
- [Támogatott oldalak](docs/tamogatott-oldalak.md) – a lista, a kizárt oldalak és az adatvédelem oldalanként
- [Kézi tesztlista](docs/kezi-teszt.md) – kiadás előtti ellenőrzés böngészőkben
- [Fejlesztői dokumentáció](docs/fejlesztoi-dokumentacio.md) – felépítés,
  tesztelés, CI, ismert korlátok
- [Auditjelentés (2026-10-07, angol)](.github/AUDIT-2026-10-07.md) és a
  [CI leírása (angol)](.github/QUALITY.md)

## Gyors fejlesztői parancsok

```sh
npm ci --prefix .github/ci/node-tools --ignore-scripts --no-audit --no-fund
.github/ci/node-tools/node_modules/.bin/c8 --all --include='444hu_comments*.js' --include='444hsz_*.js' \
  --include='background.js' --include='options.js' \
  --check-coverage --per-file --lines=85 --functions=80 --branches=75 \
  node --experimental-vm-modules --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

## Eredet és ez a fork

A bővítményt **nerblock** készítette és tette közzé a
[444hsz/444hu_comments](https://github.com/444hsz/444hu_comments) tárolóban
(létrehozva 2019 decemberében). **Az alapötlet, az eredeti kód és a
bővítmény működése az ő munkája**; ez a fork arra épül, a teljes eredeti
történet a commitokban megőrződött.

**Miért készült ez a fork?** Az eredeti tároló utolsó változtatása 2025.
szeptember 1-jén történt („added dark mode support”), azóta nem érkezett
újabb commit, és egy nyitott pull request vár válaszra. Közben a 444hsz.com már sok más oldal kommentszálait is
kezeli, amelyeket a bővítmény nem ismert, és a kód karbantartása (függőségek,
tesztek, ellenőrzések, kiadások) is elmaradt. Ezért ez a fork folytatja a
karbantartást, hogy a bővítmény használható és javítható maradjon. Ez nem
az eredeti projekt hivatalos folytatása: a fork karbantartója külön, és nem
az eredeti szerző.

**Mi változott az eredetihez képest?** (részletek a
[kiadásokban](https://github.com/gszigethy/444hu_comments/releases))

- minden támogatott oldal, a 444.hu is, oldalankénti bekapcsolással és a
  böngésző engedélykérésével működik (opcionális hosztengedélyek, beállítások
  oldal), a 444hsz.com oldallistáját követve;
- komment blokk a 444.hu-n kívüli oldalakon is, oldalankénti beszúrási szabályokkal;
- automatizált tesztek, minőségellenőrzés, csomagolás és kiadási folyamat;
- magyar nyelvű dokumentáció és kézi tesztlista;
- a 444.hu-hoz készült, eredeti megjelenítés és működés megmaradt.

Ha az eredeti szerző újra aktív lesz, szívesen egyeztetünk az
összeolvasztásról; hibát és ötletet ide, a fork GitHub-oldalára lehet küldeni.

## Licenc

A Firefox-bővítményoldal a *Mozilla Public License 2.0* licencet tünteti fel.
Sem az eredeti tárolóban, sem ebben a forkban nincs `LICENSE` fájl; ezt az
eredeti szerzővel kellene tisztázni, és pótolni (lásd a fejlesztői
dokumentáció „Ismert hiányosságok és kockázatok” részét). Az eredeti kód
szerzői jogai nerblockot illetik, a fork saját módosításai ezen alapulnak.
A mellékelt `backburner.js` a [Backburner.js](https://github.com/BackburnerJS/backburner.js)
(az Ember.js ütemezője) beágyazott változata.

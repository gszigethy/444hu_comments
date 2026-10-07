# Használati útmutató

## Első lépések

### 1. Oldalak bekapcsolása

A bővítmény **telepítés után egyetlen oldalon sem fut**: te döntöd el, hol
szeretnéd látni a kommenteket. Az első telepítéskor magától megnyílik a
**beállítások oldal** (később a böngésző eszköztárában a 444hsz ikonra
kattintva nyithatod meg újra).

1. Kapcsold be a kívánt oldalt a kapcsolójával – kezdésnek a **444.hu** ajánlott.
2. A böngésző **felugró ablakban engedélyt kér**: a bővítmény ilyenkor olvashatja
   az adott oldal tartalmát, és betölti rá a 444hsz Disqus-szálat. Válaszd az
   **engedélyezést**.
3. Nyiss meg egy cikket az adott oldalon.

A **Mind be** gombra *egyetlen* felugró ablak jelenik meg, amely az összes
oldalt felsorolja (Chrome hosszú lista esetén összefoglalhatja). A **Mind ki**
gomb nem kérdez semmit, és azonnal visszavonja a hozzáférést. Egy oldal
kikapcsolása után a már megnyitott fülek a lap újratöltéséig megtartják a blokkot.

A beállítások oldal soha nem tárol külön „be/ki” jelölőt: a kapcsoló a böngésző
tényleges engedélyét mutatja, ezért ha a böngésző saját beállításaiban vonod
vissza a hozzáférést, az itt is kikapcsoltként jelenik meg.

### Kiinduló kijelölés importálása a 444hsz.com-ról

Ha a 444hsz.com oldalon már beállítottad az oldalszűrőt (a hírfolyam
hárompontos menüjében), azt kiinduló kijelölésnek átveheted:

1. A beállítások oldalon kattints az **Importálás a 444hsz.com-ról** gombra.
2. A böngésző engedélyt kér a `444hsz.com` eléréséhez. Ez csak a beállítás
   kiolvasásához kell: a bővítmény kiolvassa, majd **azonnal visszavonja** a
   hozzáférést. Ha nincs nyitva 444hsz.com fül, átmenetileg a háttérben nyit egyet.
3. Az importált oldalak **csak ki lesznek jelölve** („kijelölve” jelzés), még nincs
   bekapcsolva semmi. A **Kiválasztottak bekapcsolása** gombbal kérheted az
   engedélyeket (ismét egyetlen felugró ablak), vagy az **Elvetés** gombbal
   eldobhatod a kijelölést.

Tudnivalók: a 444hsz.com szűrője azt jelöli, mely oldalak cikkei jelenjenek meg
a hírfolyamban, nem azt, hogy hol akarsz kommentelni, ezért ez csak
kiindulópont. Az üres szűrő „minden oldalt” jelent. Ha a 444hsz.com-on még nem
jártál ebben a böngészőben, vagy a beállítás nem olvasható, a „Nincs
importálható beállítás.” üzenetet kapod, és semmi sem változik. Ha elutasítod
a 444hsz.com-hoz kért engedélyt, az importálás nem fut le; ez nem érinti a
bővítmény többi részét.

### Mi van, ha véletlenül a „Mégse” / „Tiltás” gombra kattintottam?

Ez nem rontja el a bővítményt, csak az adott oldal marad kikapcsolva.
A bővítmény a többi, már engedélyezett oldalon változatlanul működik.

1. Nyisd meg a beállítások oldalt (kattints a 444hsz ikonra az eszköztáron;
   Chrome-ban ha nem látod, a puzzle ikon alatt tűzd ki).
2. Az oldal kapcsolója kikapcsolva marad, és egy sárga figyelmeztetés jelenik meg.
3. **Kapcsold be újra** ugyanazt a kapcsolót: a böngésző újra felteszi a kérdést,
   most válaszd az engedélyezést.

Ha a böngésző nem kérdez újra, vagy a kapcsoló nem tart:

- **Chrome / Edge / Opera:** `chrome://extensions` (Edge-ben `edge://extensions`)
  → 444hsz → **Részletek** → **Webhelyhozzáférés**: itt állítható, mely oldalakon
  fér hozzá a bővítmény.
- **Firefox:** `about:addons` → 444hsz → **Engedélyek** fül: a választható
  webhelyhozzáférések itt kapcsolhatók.
- Ha semmi sem segít: tiltsd le, majd engedélyezd újra a bővítményt a
  bővítménykezelőben, vagy telepítsd újra. Beállításaid (fogaskerék ikon) nem
  vesznek el, mert a lapok `localStorage`-ában vannak.

> A felugró ablak és a bővítménykezelő pontos szövege böngészőnként és
> verziónként eltérhet.

### 2. A komment blokk

Cikk megnyitásakor a cikk alján (illetve a sablontól függően a tartalom után)
megjelenik a **Kommentek** blokk. A 444.hu-n a cikk tetején egy **Kommentek**
gomb is megjelenik, amely a blokkhoz görget.

A blokk tetején lévő fülekkel lehet választani:

- **444 logó** – a hivatalos Disqus fórum (`444hu`);
- **444hsz logó** – a nem hivatalos, bárki által használható fórum.

A **Kommentek mutatása** gombra kattintva töltődik be a Disqus. Az utoljára
használt fület a bővítmény megjegyzi.

### A komment blokk a 444.hu-n kívüli oldalakon

A többi támogatott oldalon (Telex, 24.hu, Népszava stb.) a cikk szövege alatt
egy egyszerű **Hozzászólások** blokk jelenik meg, a **444hsz** fórummal. A
**Kommentek mutatása** gombra töltődik be a Disqus; a **Kommentek automatikus
betöltése** jelölőnégyzettel ez minden cikknél magától megtörténik (a választás
oldalanként megmarad). Főoldalakon, rovatoldalakon nem jelenik meg a blokk.

Ha egy oldal a cikkek között lapozás közben nem tölt újra (Telex,
Transtelex), a bővítmény a címváltozást követi, és az új cikkhez újra beteszi
a blokkot.

Korlátok: ezeken az oldalakon nincs oldalsáv és nincs külön „hivatalos
fórum” fül, és a saját Disqus fórum megadása sem érhető el; csak a 444hsz fórum
használható. Ha a blokk nem jelenik meg, ellenőrizd a beállítások oldalon, hogy
az oldal be van-e kapcsolva, és lásd a Hibaelhárítást.

### 3. Frissítés régebbi verzióról

Az 1.4.x verziókról frissítve a 444.hu hozzáférése általában megmarad, és a
kommentek változatlanul működnek. Ha a böngésző nem vitte át az engedélyt, a
frissítés után megnyílik a beállítások oldal egy figyelmeztetéssel: kapcsold be
újra a 444.hu-t.

## Beállítások (fogaskerék ikon)

| Beállítás | Hatás |
| --- | --- |
| Kommentek auto betöltése | A cikk megnyitásakor magától betölti a kommenteket. |
| Szolgálati közlemény | A közlemény megjelenítése/elrejtése („Ne jelenjen meg többet” gombbal is eltüntethető). |
| Disqus ajánlások | A Disqus „ajánlott cikkek” blokkja; alapból rejtett. |
| Nem hivatalos Disqus fórum | Saját fórum shortname-je. Csak kisbetű, szám és kötőjel fogadható el; üresen az alapértelmezett `444hsz` használatos. |

A beállítások böngészőnként, az adott oldal `localStorage`-ában tárolódnak
(`_444hsz_*` kulcsok), ezért böngészőprofilok között nem szinkronizálódnak.

## Oldalsáv

Az oldalsáv ikonnal a kommentek jobb oldali, dokkolt panelbe kerülnek. A panel
bal szélénél húzva átméretezhető (legalább 335 px). A választás megmarad.

## Közvetlen hivatkozás kommentre

Az `#comment…` kezdetű horgonyt tartalmazó linkek megnyitásakor a bővítmény
automatikusan betölti a kommenteket és a blokkhoz görget.

## Hibaelhárítás

- **Nem jelenik meg a komment blokk:** először ellenőrizd a beállítások oldalon,
  hogy az oldal be van-e kapcsolva. A 444 sablonja változhat; a bővítmény
  ilyenkor többször újrapróbálkozik, majd feladja. Frissíts az oldalra, és
  nézd meg a böngésző konzolját (`[444hsz]` előtagú üzenetek).
- **Üres vagy hibás Disqus (nem 444.hu oldalon):** a 444hsz fórum üzemeltetőinek is
  engedélyeznie kell az adott oldalt a Disqus „trusted domains” beállításában;
  ha csak egy oldalon marad üres a blokk, jelezd a hibabejelentőben.
- **Üres vagy hibás Disqus:** ellenőrizd, hogy a tartalomblokkoló nem tiltja-e a
  `*.disqus.com` címeket, és hogy a saját fórum neve helyes-e.
- **Régi cikkek:** a 2021. június 9. előtti foci cikkek a régi
  `foci.444.hu` címen lévő szálat használják.
- Hibát a GitHub Issues-ban vagy a bovitmeny@444hsz.com címen jelezhetsz,
  a böngésző, a bővítmény verziója (beállítások panel) és a cikk címe megadásával.

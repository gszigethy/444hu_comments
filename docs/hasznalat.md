# Használati útmutató

## Első lépések

Telepítés után nyiss meg egy cikket a 444.hu-n. A cikk alján (illetve a
sablontól függően a tartalom után) megjelenik a **Kommentek** blokk, a cikk
tetején pedig egy **Kommentek** gomb, amely a blokkhoz görget.

A blokk tetején lévő fülekkel lehet választani:

- **444 logó** – a hivatalos Disqus fórum (`444hu`);
- **444hsz logó** – a nem hivatalos, bárki által használható fórum.

A **Kommentek mutatása** gombra kattintva töltődik be a Disqus. Az utoljára
használt fület a bővítmény megjegyzi.

## Beállítások (fogaskerék ikon)

| Beállítás | Hatás |
| --- | --- |
| Kommentek auto betöltése | A cikk megnyitásakor magától betölti a kommenteket. |
| Szolgálati közlemény | A közlemény megjelenítése/elrejtése („Ne jelenjen meg többet” gombbal is eltüntethető). |
| Disqus ajánlások | A Disqus „ajánlott cikkek” blokkja; alapból rejtett. |
| Nem hivatalos Disqus fórum | Saját fórum shortname-je. Csak kisbetű, szám és kötőjel fogadható el; üresen az alapértelmezett `444hsz` használatos. |

A beállítások böngészőnként, a `444.hu` oldal `localStorage`-ában tárolódnak
(`_444hsz_*` kulcsok), ezért böngészőprofilok között nem szinkronizálódnak.

## Oldalsáv

Az oldalsáv ikonnal a kommentek jobb oldali, dokkolt panelbe kerülnek. A panel
bal szélénél húzva átméretezhető (legalább 335 px). A választás megmarad.

## Közvetlen hivatkozás kommentre

Az `#comment…` kezdetű horgonyt tartalmazó linkek megnyitásakor a bővítmény
automatikusan betölti a kommenteket és a blokkhoz görget.

## Hibaelhárítás

- **Nem jelenik meg a komment blokk:** a 444 sablonja változhat; a bővítmény
  ilyenkor többször újrapróbálkozik, majd feladja. Frissíts az oldalra, és
  nézd meg a böngésző konzolját (`[444hsz]` előtagú üzenetek).
- **Üres vagy hibás Disqus:** ellenőrizd, hogy a tartalomblokkoló nem tiltja-e a
  `*.disqus.com` címeket, és hogy a saját fórum neve helyes-e.
- **Régi cikkek:** a 2021. június 9. előtti foci cikkek a régi
  `foci.444.hu` címen lévő szálat használják.
- Hibát a GitHub Issues-ban vagy a bovitmeny@444hsz.com címen jelezhetsz,
  a böngésző, a bővítmény verziója (beállítások panel) és a cikk címe megadásával.

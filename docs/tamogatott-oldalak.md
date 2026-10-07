# Támogatott oldalak

A bővítmény ugyanazokon az oldalakon használható, mint a 444hsz.com. A lista a
`sites.json` fájlban van (a 444hsz.com beállításának másolata, napi
ellenőrzéssel). **Minden oldal ki van kapcsolva, amíg a beállítások oldalon be
nem kapcsolod** (lásd a [használati útmutatót](hasznalat.md)).

| Oldal | Domain | Megjegyzés |
| --- | --- | --- |
| 24 | `24.hu` |  |
| 444.hu és blogjai | `444.hu` | saját, részletes felület (oldalsáv, hivatalos fül) |
| Forbes | `forbes.hu` |  |
| G7 | `g7.hu` | a `g7.hu` átirányít a `telex.hu/g7` címre, ezért a cikkekre a Telex szabálya illeszkedik |
| Klubrádió | `www.klubradio.hu` | csak a cikk-útvonalak (`/adasok/`, `/hirek/`, `/szabadsag-klub/`) |
| Kontroll | `kontroll.hu` |  |
| Lakmusz | `lakmusz.hu` | **jelenleg nem működik**: a `www.lakmusz.hu` átirányít a `lakmusz.hu`-ra, amit a 444hsz.com szabálya nem fed le |
| Magyar Hang | `hang.hu` |  |
| Magyar Narancs | `magyarnarancs.hu` |  |
| Media1 | `media1.hu` |  |
| Menedzsment Fórum | `mfor.hu` |  |
| Mérce | `merce.hu` |  |
| Népszava | `nepszava.hu` |  |
| Amerikai Népszava | `nepszava.us` | nem ellenőrizhető belépés nélkül |
| Qubit | `qubit.hu` |  |
| Rakéta | `raketa.hu` |  |
| RTL | `rtl.hu` |  |
| Szabad Európa | `szabadeuropa.hu` |  |
| Telex | `telex.hu` |  |
| The Guardian | `theguardian.com` |  |
| Transtelex | `transtelex.ro` |  |
| Válasz Online | `www.valaszonline.hu` |  |
| Átlátszó | `atlatszo.hu` |  |

Az aldomaineket is engedő szabályok (a `sites.json`-ban `(\w+\.)?…` alakúak) (például `ng.24.hu`,
`jo.444.hu`). A `kor.444.hu` és a `membership.444.hu` oldalon a bővítmény nem fut.

## Nem támogatott oldalak

- **hvg.hu** és **eduline.hu**: a 444hsz.com beállítása szerint itt nem hozható létre új
  kommentszál (a bővítmény a 444hsz.com leírása szerint szerzői jogi panasz miatt zárta ki őket), ezért a bővítmény sem kínálja fel
  őket. A beállítások oldalon szürkítve, indoklással látszanak.
- **444hsz.com**: maga a központ, nincs rajta cikk.
- Ha a 444hsz.com listája változik, a repóban egy automatikus ellenőrzés
  (`sites-sync`) jelzést nyit, és a frissítés új kiadással érkezik.

## Adatvédelem oldalanként

A bővítmény csak a bekapcsolt oldalakhoz fér hozzá. Ezeken az oldalakon a Disqus
(`*.disqus.com`) csak a komment blokk betöltésekor, a **Kommentek mutatása**
gombra (vagy bekapcsolt automatikus betöltésnél a cikk megnyitásakor) töltődik be.
A kikapcsolt oldalakon nem fut semmi. A hozzáférés bármikor visszavonható a
beállítások oldalon vagy a böngésző bővítménykezelőjében.

A részletes felderítési eredményeket lásd az
[oldalak-felderites.md](oldalak-felderites.md) fájlban.

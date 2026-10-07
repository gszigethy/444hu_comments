# Kézi tesztlista (kiadás előtt)

A CI csak kódot és jsdom-os szimulációt ellenőriz; a böngészők engedélykérését,
az oldalak valódi szerkezetét és a Disqus működését nem. Ezt a listát a CI által
készített `chrome-extension` ZIP-pel kell végigmenni **Chrome-ban és
Firefoxban**, mielőtt kiadás készül. **Teszthozzászólást ne küldj** valódi vagy
éles fórumba; a megjelenést és a számokat nézd.

Jegyezd fel böngészőnként: verzió, mi történt, és ha eltér a várttól, a
böngészőkonzol `[444hsz]` üzenetei.

## A. Telepítés és frissítés

1. **Tiszta telepítés** (új profil): megnyílik a beállítások oldal, a
   „Üdv!” üzenettel, és **egyetlen oldal sincs bekapcsolva** (0 / 23).
2. **Frissítés helyben 1.4.0.27-ről** (telepítsd a régit, nyiss meg egy 444.hu
   cikket, hogy lásd a kommenteket, majd frissíts az új ZIP-re):
   - megmarad-e a 444.hu hozzáférés, és működnek-e a kommentek, vagy
   - megnyílik-e a beállítások oldal a „kapcsold be újra” üzenettel.
   Jegyezd fel, melyik történt; ez a legfontosabb nyitott kérdés.
3. A bővítmény ikonjára kattintva megnyílik a beállítások oldal.

## B. Engedélykérés

1. Kapcsold be a **Telex**-et: a böngésző engedélyt kér *csak a telex.hu-ra*.
   Jegyezd fel a felugró ablak szövegét.
2. **Mégse / tiltás:** a kapcsoló kikapcsolva marad, sárga figyelmeztetés és
   megnyílt súgó látszik. Kapcsold be újra: újra megkérdezi-e a böngésző?
   (A [használati útmutató](hasznalat.md) helyreállítási lépései egyeznek-e a
   böngésző valódi felületével?)
3. **Mind be:** egyetlen felugró ablak? Mit ír ki a 23 oldalról (Chrome
   összefoglalhatja)? **Mind ki:** nincs kérdés, minden kikapcsol.
4. Vond vissza egy oldal hozzáférését a böngésző bővítménykezelőjében: a
   beállítások oldal kikapcsoltként mutatja-e (újratöltés nélkül is)?
5. **Importálás a 444hsz.com-ról:** (a) nyitott 444hsz.com füllel, (b) nyitott
   fül nélkül (a háttérfül bezáródik-e), (c) olyan profilban, ahol még nem jártál
   a 444hsz.com-on („Nincs importálható beállítás.”). Utána: a 444hsz.com
   hozzáférés visszavonódott-e, és a kijelölés külön kattintással kapcsol-e be?

## C. Oldalanként (23 oldal, kapcsold be őket egyenként)

Minden oldalon egy **cikkoldalon** és a **főoldalon**:

- [ ] a blokk a cikk szövege alatt jelenik meg, nem takar semmit, nem lóg ki;
- [ ] a főoldalon és a rovatoldalon **nincs** blokk;
- [ ] a **Kommentek mutatása** betölti a Disqust;
- [ ] a hozzászólások száma egyezik a 444hsz.com hírfolyamában látottal
      (ugyanaz a szál töltődik be, nem üres új);
- [ ] a lap tartalomblokkoló nélkül és vele is rendben van;
- [ ] kikapcsolás után, újratöltve a blokk eltűnik.

Külön figyelendő: Telex/Transtelex (cikkek közti lapozás újratöltés nélkül),
Klubrádió (kliensoldali render, csak a `/hirek/`, `/adasok/`, `/szabadsag-klub/`
útvonalak), Népszava (nincs `main`/`article`: hova kerül a blokk?), Amerikai
Népszava (belépés nélkül megnyílnak-e a cikkek?), Lakmusz (nem várható működés),
RTL (`og:type` = `video.other`), és ahol a Disqus üres marad: a 444hsz fórum
„trusted domains” listája nem tartalmazza az oldalt.

**Új szál:** egy olyan cikknél, amelynek még nincs szála, a Disqus üres szálat
mutat. Itt *ne* kommentelj kipróbálásként; azt, hogy az első komment a helyes
szálat hozza-e létre (és nincs-e duplikátum a 444hsz.com-on), a fórum
üzemeltetőjével egyeztetve, szándékos kommenttel lehet ellenőrizni.

## D. 444.hu (változatlan viselkedés)

- [ ] kommentek, fülek (hivatalos/444hsz), oldalsáv, beállítások, `#comment…`
      hivatkozás ugyanúgy működnek, mint az 1.4.0.27-ben;
- [ ] `kor.444.hu` és `membership.444.hu`: a bővítmény nem fut;
- [ ] egy blog aldomain (`jo.444.hu`) is működik.

## E. Firefox külön

- [ ] a manifest `background` két kulcsot tartalmaz (`service_worker` és
      `scripts`): betölti-e a Firefox figyelmeztetés nélkül;
- [ ] a bővítmény ikonja megnyitja-e a beállításokat;
- [ ] `about:addons` → Engedélyek: a választható hozzáférések látszanak és
      kapcsolhatók-e;
- [ ] a bővítmény azonosítója (nincs a manifestben): a kiadott AMO-listával
      nem ütközik-e.

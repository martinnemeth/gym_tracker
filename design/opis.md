Redesign UI fitness PWA – Performance Minimalism
Pracujeme na existujúcej PWA aplikácii na sledovanie silových tréningov v posilňovni.
Chcem modernizovať jej používateľské rozhranie podľa priloženého vizuálneho mockupu.
Dôležité: Nejde o vytvorenie novej aplikácie. Ide o vizuálny redesign existujúceho projektu pri zachovaní jeho funkčnosti, dát a architektúry.
1. Vizuálny smer
Design direction: Performance Minimalism.
Aplikácia má pôsobiť:
moderne a prémiovo,
minimalisticky a funkčne,
ako kvalitná fitness aplikácia navrhnutá primárne pre iPhone,
s výraznou typografickou hierarchiou,
s tmavým pozadím a limetkovými akcentmi.
Inšpirácia: moderné fitness aplikácie s dôrazom na tréningové dáta, jednoduchosť a rýchlu interakciu.
Nepoužívaj zbytočné dekorácie, výrazné gradienty, neónový glow na každom komponente ani nadmerné animácie.
2. Farebný systém
Vytvor centralizované dizajnové tokeny:
Background: #0B0D10
Surface: #15181D
Elevated card: #1C2128
Primary accent: #C7F36B
Accent hover / pressed: #B6E45C
Primary text: #F5F7FA
Secondary text: #97A0AA
Borders: rgba(255,255,255,0.06)
Zabezpeč dostatočný kontrast a čitateľnosť. Limetkovú používaj na aktívne prvky, hlavné tlačidlá, vybrané filtre a pozitívne hodnoty. Nie na všetok text.
3. Typografia a rozostupy
Použi natívny systémový font (SF Pro na iOS).
Typografická hierarchia:
H1: 34 px, bold
H2: 24 px, semibold
Section heading: 18 px, semibold
Body: 16 px, regular
Secondary body: 14 px
Caption: 12–13 px
Spacing systém: 4 / 8 / 12 / 16 / 20 / 24 / 32 px.
Zjednoť zaoblenia a rozmery tlačidiel, kariet, filtrov a vstupných polí.
4. Redesign obrazoviek
A. Plány
Výrazný nadpis.
Moderný empty state.
Hlavná karta s vysvetlením účelu plánov.
Pripravený dizajn CTA „Vytvoriť plán“.
V budúcnosti miesto pre zoznam tréningových plánov a progres.
Neimplementuj funkcionalitu plánov, ak zatiaľ neexistuje.
B. Cviky
Výrazný nadpis „Cviky“.
Moderné vyhľadávacie pole.
Horizontálne posúvateľné filtre svalových partií a vybavenia.
Aktívne filtre zvýrazni limetkovou.
Zoznam cvikov zobraz ako kompaktné karty.
Názov cviku vizuálne odlíš od sekundárnych metadát.
Zabezpeč rýchle prehľadávanie a dobrú čitateľnosť.
Zachovaj existujúce filtrovanie, vyhľadávanie, kategórie a navigáciu.
C. Detail cviku
Výrazný názov.
Tagy svalových partií a vybavenia.
Priestor pre budúcu fotografiu alebo ilustráciu cviku.
Samostatná sekcia „Technika“ s očíslovanými krokmi.
Samostatná sekcia „Použitie a štatistiky“.
Vizuálne oddeľ počet sérií, počet plánov a alternatívne názvy.
Zachovaj možnosť úpravy a zmazania cviku.
Zatiaľ nepridávaj fiktívne štatistiky a nefunkčné ovládacie prvky.
D. Viac / Nastavenia
Prepracuj do moderných skupín nastavení.
Zjednoť riadky a ikony.
Zachovaj existujúce informácie o úložisku, knižnici a verzii.
Neaktívne funkcie zostanú označené ako pripravované.
Názov obrazovky môže zostať „Viac“, pokiaľ jeho zmena vyžaduje zásahy mimo UI.
5. Spoločné komponenty
Podľa existujúceho technologického stacku vytvor alebo uprav znovupoužiteľné komponenty:
AppHeader
PrimaryButton
SecondaryButton
FilterChip
SearchField
ExerciseListItem
StatCard
SectionCard
SettingsRow
BottomTabBar
Nevytváraj nové komponenty, ak už existujú vhodné znovupoužiteľné ekvivalenty.
6. PWA a iPhone požiadavky
Aplikácia musí:
správne fungovať v iPhone Safari aj po pridaní na plochu,
rešpektovať safe-area insets,
používať komfortné dotykové plochy,
mať fixnú spodnú navigáciu bez prekrývania obsahu,
správne reagovať na rôzne rozmery displejov,
podporovať Reduced Motion,
zachovať offline fungovanie a existujúce úložisko.
7. Obrázky
Vizuálny mockup obsahuje ilustračné fotografie cvikov.
Nepridávaj automaticky náhodné externé obrázky ani závislosť na vzdialenom obrazovom API.
Ak neexistujú obrázky cvikov, priprav komponent na ich budúce doplnenie a použi konzistentný grafický placeholder.
8. Bezpečnosť zmien
Nemeň:
databázový model,
existujúce cviky a ich údaje,
localStorage / IndexedDB,
pravidlá filtrovania,
business logiku,
funkčné procesy aplikácie,
PWA cache a service worker bez nutného dôvodu.
Redesign nesmie spôsobiť stratu používateľských dát.
9. Postup práce
Najskôr:
Preskúmaj štruktúru projektu.
Identifikuj UI komponenty, CSS a používané knižnice.
Navrhni nový systém dizajnových tokenov.
Vypíš konkrétne súbory, ktoré bude potrebné upraviť.
Upozorni na riziká a technické obmedzenia.
Navrhni implementáciu v menších samostatných etapách.
Zatiaľ nič neimplementuj. Počkajú na moje schválenie.
Po schválení postupuj po jednej obrazovke a po každej etape skontroluj, že zostali funkčné existujúce interakcie, navigácia a ukladanie dát.

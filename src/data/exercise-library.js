// Predvolená knižnica cvikov. ID sú stabilné ("lib-…"), aby sa dala knižnica
// doplniť / obnoviť bez prepísania používateľových úprav.
// ex(id, názov, aliasy, partie (prvá = hlavná), vybavenie, typ sledovania, technika)

const ex = (id, name, aliases, muscleGroups, equipment, trackingType, technique) => ({
  id: `lib-${id}`, name, aliases, muscleGroups, equipment, trackingType, technique,
});

export const EXERCISE_LIBRARY = [
  // ── Hrudník ─────────────────────────────────────────────
  ex('bench-press', 'Tlak na rovnej lavičke', ['bench press', 'benč'], ['chest', 'triceps', 'shoulders'], 'barbell', 'weight_reps', [
    'Lopatky stiahnuté k sebe a dole, mierny oblúk v hrudnej chrbtici',
    'Chodidlá pevne na zemi, zadok a hlava na lavičke',
    'Činku spúšťaj kontrolovane na spodnú časť hrudníka',
    'Lakte cca 45–70° od trupu, nie do strán',
    'Zápästia rovné, tyč nad lakťami',
  ]),
  ex('incline-bench-press', 'Tlak na šikmej lavičke', ['incline bench press'], ['chest', 'shoulders', 'triceps'], 'barbell', 'weight_reps', [
    'Sklon lavičky 30–45°',
    'Lopatky stiahnuté, hrudník vystrčený',
    'Činku spúšťaj na hornú časť hrudníka pod kľúčne kosti',
    'Lakte mierne pod úrovňou tyče, nie do strán',
  ]),
  ex('decline-bench-press', 'Tlak na lavičke hlavou dole', ['decline bench press'], ['chest', 'triceps'], 'barbell', 'weight_reps', [
    'Nohy zaistené v opierkach',
    'Spúšťaj na spodnú hranu hrudníka',
    'Kontrolovaný pohyb, bez odrazu od hrudníka',
    'Pracuj s dopomocou alebo v stojane s poistkami',
  ]),
  ex('db-bench-press', 'Tlak s jednoručkami na rovnej lavičke', ['dumbbell bench press'], ['chest', 'triceps', 'shoulders'], 'dumbbell', 'weight_reps', [
    'Jednoručky dostaň do pozície cez kolená',
    'Lopatky stiahnuté, chodidlá pevne na zemi',
    'Spúšťaj do hĺbky, kým cítiš natiahnutie hrudníka',
    'Tlač nahor a mierne k sebe, bez cvaknutia činiek',
  ]),
  ex('db-incline-press', 'Tlak s jednoručkami na šikmej lavičke', ['incline dumbbell press'], ['chest', 'shoulders', 'triceps'], 'dumbbell', 'weight_reps', [
    'Sklon lavičky 30–45°',
    'Lakte cca 45–60° od trupu',
    'Plný rozsah, kontrolované spúšťanie (2–3 s)',
    'Lopatky ostávajú stiahnuté počas celej série',
  ]),
  ex('db-fly', 'Rozpažovanie s jednoručkami', ['dumbbell fly', 'flyes'], ['chest'], 'dumbbell', 'weight_reps', [
    'Lakte mierne pokrčené a zamknuté počas celého pohybu',
    'Spúšťaj do strán po oblúku, kým cítiš natiahnutie',
    'Nespúšťaj pod úroveň ramien',
    'Hore stláčaj hrudník, nie tlač rukami',
  ]),
  ex('cable-crossover', 'Krížové sťahovanie kladiek', ['cable crossover', 'cable fly'], ['chest'], 'cable', 'weight_reps', [
    'Stabilný postoj, mierny predklon trupu',
    'Lakte mierne pokrčené, uhol sa nemení',
    'Ruky veď po oblúku pred telo',
    'Na konci stlač hrudník, pomaly späť',
  ]),
  ex('pec-deck', 'Butterfly na stroji', ['pec deck', 'chest fly machine'], ['chest'], 'machine', 'weight_reps', [
    'Sedadlo nastav tak, aby rukoväte boli v úrovni hrudníka',
    'Chrbát a hlava opreté, lopatky stiahnuté',
    'Ramená nepredsúvaj dopredu',
    'Pomalý návrat do natiahnutia',
  ]),
  ex('machine-chest-press', 'Tlak na hrudník na stroji', ['chest press machine'], ['chest', 'triceps', 'shoulders'], 'machine', 'weight_reps', [
    'Rukoväte v úrovni stredu hrudníka',
    'Chrbát opretý, lopatky stiahnuté',
    'Nezamykaj lakte úplne v hornej pozícii',
    'Kontrolované spúšťanie',
  ]),
  ex('smith-incline-press', 'Tlak na šikmej lavičke v multipresse', ['smith incline press'], ['chest', 'shoulders', 'triceps'], 'smith', 'weight_reps', [
    'Lavičku umiestni tak, aby tyč dopadala na hornú časť hrudníka',
    'Sklon 30–45°',
    'Nastav poistky tesne pod najnižší bod',
    'Lopatky stiahnuté, zápästia rovné',
  ]),
  ex('push-up', 'Kliky', ['push-up', 'push up'], ['chest', 'triceps', 'shoulders'], 'bodyweight', 'bodyweight_reps', [
    'Telo v jednej línii od hlavy po päty',
    'Dlane mierne širšie ako ramená',
    'Lakte cca 45° od trupu',
    'Hrudník takmer k zemi, plný rozsah',
    'Brucho a zadok spevnené',
  ]),
  ex('dips-chest', 'Bradlá – hrudník', ['dips', 'chest dips'], ['chest', 'triceps', 'shoulders'], 'bodyweight', 'bodyweight_reps', [
    'Trup v predklone, lakte mierne od tela',
    'Spúšťaj, kým sú ramená mierne pod úrovňou lakťov',
    'Ramená ťahaj dole od uší',
    'Bez hojdania nohami',
  ]),

  // ── Chrbát ──────────────────────────────────────────────
  ex('deadlift', 'Mŕtvy ťah', ['deadlift', 'mrtvy tah'], ['back', 'hamstrings', 'glutes', 'lowerBack'], 'barbell', 'weight_reps', [
    'Tyč nad stredom chodidla, holene takmer pri tyči',
    'Neutrálny chrbát, hrudník hore, nádych do brucha (bracing)',
    'Pred ťahom „vyber vôľu“ z tyče a napni lats',
    'Tyč veď tesne pri nohách',
    'Hore vystri boky, nezakláňaj sa',
  ]),
  ex('barbell-row', 'Prítahy veľkej činky v predklone', ['barbell row', 'bent over row'], ['back', 'biceps', 'lowerBack'], 'barbell', 'weight_reps', [
    'Predklon cca 30–45°, neutrálny chrbát',
    'Kolená mierne pokrčené',
    'Ťahaj k spodnej časti brucha, lakte popri tele',
    'Na vrchu stiahni lopatky',
    'Bez trhania trupom',
  ]),
  ex('t-bar-row', 'Prítahy T-osi', ['t-bar row'], ['back', 'biceps'], 'barbell', 'weight_reps', [
    'Neutrálny chrbát, hrudník vystrčený',
    'Ťahaj k hrudníku/bruchu, lakte dozadu',
    'Stiahni lopatky na vrchu',
    'Kontrolované spúšťanie do natiahnutia',
  ]),
  ex('db-row', 'Prítah jednoručky v predklone', ['dumbbell row', 'one arm row'], ['back', 'biceps'], 'dumbbell', 'weight_reps', [
    'Opora ruky a kolena o lavičku, chrbát rovný',
    'Ťahaj lakťom k boku (smerom k bedru)',
    'Trup sa nerotuje',
    'Dole nechaj lopatku natiahnuť',
  ]),
  ex('pull-up', 'Zhyby nadhmatom', ['pull-up', 'pull up', 'zhyby'], ['back', 'biceps'], 'bodyweight', 'bodyweight_reps', [
    'Úchop mierne širší ako ramená',
    'Začni stiahnutím lopatiek dole',
    'Brada nad hrazdu, hrudník k hrazde',
    'Plný rozsah – dole vystreté ruky',
    'Bez kopania a hojdania',
  ]),
  ex('chin-up', 'Zhyby podhmatom', ['chin-up', 'chin up'], ['back', 'biceps'], 'bodyweight', 'bodyweight_reps', [
    'Úchop na šírku ramien, dlane k sebe',
    'Lakte ťahaj dole k bokom',
    'Brada nad hrazdu',
    'Kontrolované spúšťanie do plného visu',
  ]),
  ex('lat-pulldown', 'Sťahovanie hornej kladky k hrudníku', ['lat pulldown', 'stahovanie kladky'], ['back', 'biceps'], 'cable', 'weight_reps', [
    'Stehná zaistené pod opierkou',
    'Mierny záklon trupu (cca 10–20°)',
    'Ťahaj tyč k hornej časti hrudníka, lakte dole a dozadu',
    'Nepomáhaj si švihom trupu',
    'Hore nechaj lopatky natiahnuť',
  ]),
  ex('close-grip-pulldown', 'Sťahovanie hornej kladky úzkym úchopom', ['close grip pulldown', 'v-bar pulldown'], ['back', 'biceps'], 'cable', 'weight_reps', [
    'V-rukoväť, neutrálny úchop',
    'Hrudník hore, mierny záklon',
    'Lakte ťahaj tesne popri tele',
    'Kontrolovaný návrat',
  ]),
  ex('seated-cable-row', 'Prítahy spodnej kladky v sede', ['seated cable row'], ['back', 'biceps'], 'cable', 'weight_reps', [
    'Kolená mierne pokrčené, chrbát vzpriamený',
    'Ťahaj k bruchu, lakte popri tele',
    'Stiahni lopatky, hrudník vpred',
    'Trup sa nehojdá dopredu a dozadu',
  ]),
  ex('machine-row', 'Prítahy na stroji (veslovanie)', ['machine row', 'chest supported row'], ['back', 'biceps'], 'machine', 'weight_reps', [
    'Hrudník opretý o opierku',
    'Ťahaj lakťami dozadu, nie rukami',
    'Na konci stiahni lopatky',
    'Plný rozsah do natiahnutia',
  ]),
  ex('straight-arm-pulldown', 'Sťahovanie kladky s vystretými rukami', ['straight arm pulldown'], ['back'], 'cable', 'weight_reps', [
    'Mierny predklon, ruky takmer vystreté',
    'Ťahaj tyč po oblúku k stehnám',
    'Pohyb vychádza z ramien, lakte sa neohýbajú',
    'Ramená dole od uší',
  ]),
  ex('inverted-row', 'Austrálske zhyby', ['inverted row', 'australian pull-up'], ['back', 'biceps'], 'bodyweight', 'bodyweight_reps', [
    'Telo v jednej línii, zadok nepadá',
    'Hrudník ťahaj k tyči',
    'Stiahni lopatky na vrchu',
    'Čím vodorovnejšie telo, tým ťažšie',
  ]),
  ex('back-extension', 'Hyperextenzie', ['back extension', 'hyperextension'], ['lowerBack', 'glutes', 'hamstrings'], 'bodyweight', 'bodyweight_reps', [
    'Opierka tesne pod bedrovými kĺbmi',
    'Pohyb z bedier, chrbát neutrálny',
    'Hore len do línie s nohami, nezakláňaj sa',
    'Záťaž (kotúč) drž pri hrudníku',
  ]),
  ex('barbell-shrug', 'Krčenie ramien s veľkou činkou', ['barbell shrug', 'shrugy'], ['traps'], 'barbell', 'weight_reps', [
    'Ramená ťahaj priamo hore k ušiam',
    'Nerotuj ramenami',
    'Na vrchu krátka pauza',
    'Ruky ostávajú vystreté',
  ]),
  ex('db-shrug', 'Krčenie ramien s jednoručkami', ['dumbbell shrug'], ['traps'], 'dumbbell', 'weight_reps', [
    'Jednoručky po bokoch, ruky vystreté',
    'Ramená hore k ušiam, pauza',
    'Pomaly dole do natiahnutia',
    'Hlava v neutrálnej polohe',
  ]),

  // ── Ramená ──────────────────────────────────────────────
  ex('ohp', 'Tlak nad hlavu v stoji', ['overhead press', 'military press', 'ohp'], ['shoulders', 'triceps'], 'barbell', 'weight_reps', [
    'Úchop tesne širší ako ramená, tyč na predných deltách',
    'Spevnený zadok a brucho, nezakláňaj sa',
    'Tyč veď vertikálne, hlavu uhni dozadu',
    'Hore hlava „prestrčí“ pod tyč',
  ]),
  ex('db-shoulder-press', 'Tlak s jednoručkami nad hlavu v sede', ['dumbbell shoulder press'], ['shoulders', 'triceps'], 'dumbbell', 'weight_reps', [
    'Opierka takmer kolmo, chrbát opretý',
    'Lakte mierne pred telom',
    'Spúšťaj k úrovni uší',
    'Tlač nahor, bez úplného zamknutia',
  ]),
  ex('arnold-press', 'Arnoldov tlak', ['arnold press'], ['shoulders', 'triceps'], 'dumbbell', 'weight_reps', [
    'Začni s dlaňami k sebe pred tvárou',
    'Počas tlaku rotuj dlane dopredu',
    'Plynulý pohyb bez švihu',
    'Pri spúšťaní opačná rotácia',
  ]),
  ex('machine-shoulder-press', 'Tlak nad hlavu na stroji', ['shoulder press machine'], ['shoulders', 'triceps'], 'machine', 'weight_reps', [
    'Sedadlo tak, aby rukoväte boli v úrovni ramien',
    'Chrbát opretý',
    'Kontrolované spúšťanie',
    'Nezamykaj lakte',
  ]),
  ex('lateral-raise', 'Upažovanie s jednoručkami', ['lateral raise', 'side raise'], ['shoulders'], 'dumbbell', 'weight_reps', [
    'Mierne pokrčené lakte',
    'Dvíhaj do strán po úroveň ramien',
    'Vedie loket, nie dlaň',
    'Bez švihu trupom, pomalé spúšťanie',
  ]),
  ex('cable-lateral-raise', 'Upažovanie na kladke', ['cable lateral raise'], ['shoulders'], 'cable', 'weight_reps', [
    'Kladka nízko, lano ide spredu alebo spoza tela',
    'Dvíhaj do úrovne ramien',
    'Trup stabilný, druhá ruka sa drží opory',
    'Konštantné napätie – nespúšťaj úplne dole',
  ]),
  ex('machine-lateral-raise', 'Upažovanie na stroji', ['lateral raise machine'], ['shoulders'], 'machine', 'weight_reps', [
    'Os otáčania v úrovni ramien',
    'Tlač lakťami, nie dlaňami',
    'Po úroveň ramien',
    'Pomalý návrat',
  ]),
  ex('front-raise', 'Predpažovanie s jednoručkami', ['front raise'], ['shoulders'], 'dumbbell', 'weight_reps', [
    'Ruky takmer vystreté',
    'Dvíhaj pred seba do úrovne ramien',
    'Bez záklonu trupu',
    'Kontrolované spúšťanie',
  ]),
  ex('rear-delt-fly', 'Rozpažovanie v predklone', ['rear delt fly', 'reverse fly'], ['shoulders', 'back'], 'dumbbell', 'weight_reps', [
    'Predklon takmer do vodorovnej polohy, chrbát rovný',
    'Lakte mierne pokrčené',
    'Dvíhaj do strán, nie dozadu',
    'Nestiahni lopatky úplne – pracujú zadné delty',
  ]),
  ex('reverse-pec-deck', 'Reverzný butterfly', ['reverse pec deck', 'rear delt machine'], ['shoulders', 'back'], 'machine', 'weight_reps', [
    'Hrudník opretý o opierku',
    'Rukoväte v úrovni ramien',
    'Ťahaj do strán po oblúku',
    'Pomalý návrat',
  ]),
  ex('face-pull', 'Face pull na kladke', ['face pull'], ['shoulders', 'traps', 'back'], 'cable', 'weight_reps', [
    'Kladka v úrovni tváre, lano',
    'Ťahaj k tvári a rozťahuj lano',
    'Lakte vysoko, na konci vonkajšia rotácia',
    'Pauza v zadnej pozícii',
  ]),
  ex('upright-row', 'Príťahy k brade', ['upright row'], ['shoulders', 'traps'], 'barbell', 'weight_reps', [
    'Úchop na šírku ramien alebo širší',
    'Ťahaj lakťami nahor po úroveň ramien',
    'Tyč tesne pri tele',
    'Pri bolesti ramena vynechaj alebo zníž rozsah',
  ]),
  ex('pike-push-up', 'Pike kliky', ['pike push-up'], ['shoulders', 'triceps'], 'bodyweight', 'bodyweight_reps', [
    'Boky vysoko, telo v tvare obráteného V',
    'Hlavu spúšťaj pred dlane',
    'Lakte mierne vpred',
    'Pre ťažšiu verziu zvýš nohy',
  ]),

  // ── Biceps ──────────────────────────────────────────────
  ex('barbell-curl', 'Bicepsový zdvih s veľkou činkou', ['barbell curl'], ['biceps', 'forearms'], 'barbell', 'weight_reps', [
    'Lakte pri tele a nehýbu sa dopredu',
    'Bez švihu trupom',
    'Hore stlač biceps',
    'Pomalé spúšťanie do vystretia',
  ]),
  ex('ez-curl', 'Bicepsový zdvih s EZ činkou', ['ez bar curl'], ['biceps', 'forearms'], 'barbell', 'weight_reps', [
    'Úchop na zalomení EZ tyče',
    'Lakte pri tele',
    'Plný rozsah pohybu',
    'Kontrolované spúšťanie',
  ]),
  ex('db-curl', 'Bicepsový zdvih s jednoručkami', ['dumbbell curl'], ['biceps', 'forearms'], 'dumbbell', 'weight_reps', [
    'Počas zdvihu supinuj (otoč dlaň nahor)',
    'Lakte pri tele',
    'Striedavo alebo naraz, bez švihu',
    'Pomalé spúšťanie',
  ]),
  ex('hammer-curl', 'Kladivový zdvih', ['hammer curl'], ['biceps', 'forearms'], 'dumbbell', 'weight_reps', [
    'Neutrálny úchop (palec hore)',
    'Lakte pri tele',
    'Bez švihu trupom',
    'Kontrolované spúšťanie',
  ]),
  ex('incline-db-curl', 'Bicepsový zdvih na šikmej lavičke', ['incline dumbbell curl'], ['biceps'], 'dumbbell', 'weight_reps', [
    'Lavička cca 45–60°, ruky visia za telom',
    'Lakte ostávajú vzadu, nehýbu sa dopredu',
    'Plné natiahnutie dole',
    'Pomalé spúšťanie',
  ]),
  ex('preacher-curl', 'Bicepsový zdvih na Scottovej lavičke', ['preacher curl', 'scott curl'], ['biceps'], 'barbell', 'weight_reps', [
    'Podpazušie na hrane opierky',
    'Nespúšťaj do úplne zamknutého lakťa nárazom',
    'Kontrolovaný pohyb v spodnej časti',
    'Zadok ostáva na sedadle',
  ]),
  ex('cable-curl', 'Bicepsový zdvih na kladke', ['cable curl'], ['biceps'], 'cable', 'weight_reps', [
    'Kladka nízko, rovná tyč alebo lano',
    'Lakte pri tele',
    'Konštantné napätie počas celého rozsahu',
    'Bez záklonu trupu',
  ]),
  ex('concentration-curl', 'Koncentrovaný zdvih', ['concentration curl'], ['biceps'], 'dumbbell', 'weight_reps', [
    'V sede, loket opretý o vnútornú stranu stehna',
    'Zdvíhaj len predlaktím',
    'Hore stlač a supinuj',
    'Pomaly dole',
  ]),

  // ── Triceps ─────────────────────────────────────────────
  ex('close-grip-bench', 'Tlak na lavičke úzkym úchopom', ['close grip bench press'], ['triceps', 'chest'], 'barbell', 'weight_reps', [
    'Úchop na šírku ramien (nie užšie)',
    'Lakte tesne pri tele',
    'Spúšťaj na spodnú časť hrudníka',
    'Zápästia rovné',
  ]),
  ex('skull-crusher', 'Francúzsky tlak v ľahu', ['skull crusher', 'lying triceps extension'], ['triceps'], 'barbell', 'weight_reps', [
    'Ramená mierne naklonené k hlave',
    'Lakte smerujú k stropu, neroztvárajú sa',
    'Spúšťaj tyč za hlavu / k čelu',
    'Pohyb len v lakťoch',
  ]),
  ex('triceps-pushdown', 'Tricepsové sťahovanie kladky', ['triceps pushdown', 'rope pushdown'], ['triceps'], 'cable', 'weight_reps', [
    'Lakte pri tele a nehýbu sa',
    'Dole úplne vystri ruky (s lanom roztiahni)',
    'Trup stabilný, mierny predklon',
    'Kontrolovaný návrat po 90°',
  ]),
  ex('overhead-cable-ext', 'Tricepsové predlaženie nad hlavou na kladke', ['overhead cable extension'], ['triceps'], 'cable', 'weight_reps', [
    'Chrbtom ku kladke, lano za hlavou',
    'Lakte smerujú dopredu, blízko hlavy',
    'Vystri ruky dopredu nad hlavu',
    'Plné natiahnutie za hlavou',
  ]),
  ex('db-overhead-ext', 'Francúzsky tlak s jednoručkou nad hlavou', ['overhead dumbbell extension'], ['triceps'], 'dumbbell', 'weight_reps', [
    'Jednoručku drž oboma rukami za hlavou',
    'Lakte blízko hlavy',
    'Spevnené brucho, bez záklonu',
    'Plný rozsah pohybu',
  ]),
  ex('dips-triceps', 'Bradlá – triceps', ['triceps dips'], ['triceps', 'chest'], 'bodyweight', 'bodyweight_reps', [
    'Trup vzpriamený',
    'Lakte smerujú dozadu, tesne pri tele',
    'Spúšťaj po cca 90° v lakťoch',
    'Hore úplne vystri ruky',
  ]),
  ex('bench-dip', 'Dipy o lavičku', ['bench dips'], ['triceps'], 'bodyweight', 'bodyweight_reps', [
    'Dlane na hrane lavičky, prsty dopredu',
    'Zadok tesne pri lavičke',
    'Spúšťaj po cca 90° v lakťoch',
    'Ramená dole od uší',
  ]),
  ex('db-kickback', 'Tricepsový kickback s jednoručkou', ['triceps kickback'], ['triceps'], 'dumbbell', 'weight_reps', [
    'Predklon, nadlaktie rovnobežne s trupom',
    'Pohyb len v lakti',
    'Vzadu úplne vystri ruku a stlač',
    'Bez švihu',
  ]),

  // ── Predlaktia / úchop ─────────────────────────────────
  ex('wrist-curl', 'Zápästné zdvihy s činkou', ['wrist curl'], ['forearms'], 'barbell', 'weight_reps', [
    'Predlaktia opreté o stehná alebo lavičku',
    'Pohyb len v zápästí',
    'Plný rozsah, pomaly',
  ]),
  ex('farmers-walk', 'Farmárska chôdza', ['farmers walk', 'farmer carry'], ['forearms', 'traps', 'core'], 'dumbbell', 'time', [
    'Vzpriamený postoj, ramená dole a vzad',
    'Krátke, rýchle kroky',
    'Spevnený trup, činky sa nehojdajú',
    'Pevný úchop počas celého času',
  ]),
  ex('dead-hang', 'Vis na hrazde', ['dead hang'], ['forearms', 'back'], 'bodyweight', 'time', [
    'Úchop na šírku ramien',
    'Ramená aktívne (mierne stiahnuté dole)',
    'Nohy pokojne, bez hojdania',
  ]),

  // ── Nohy ────────────────────────────────────────────────
  ex('back-squat', 'Drep s činkou na chrbte', ['back squat', 'squat', 'drep'], ['quads', 'glutes', 'hamstrings'], 'barbell', 'weight_reps', [
    'Tyč na trapézoch, lopatky stiahnuté',
    'Nádych do brucha a spevnenie pred každým opakovaním',
    'Kolená idú v smere špičiek',
    'Hĺbka aspoň po rovnobežku, neutrálny chrbát',
    'Váha na celom chodidle, päty na zemi',
  ]),
  ex('front-squat', 'Predný drep', ['front squat'], ['quads', 'glutes', 'core'], 'barbell', 'weight_reps', [
    'Tyč na predných deltách, lakte vysoko',
    'Trup vzpriamený',
    'Kolená v smere špičiek',
    'Hĺbka aspoň po rovnobežku',
  ]),
  ex('goblet-squat', 'Goblet drep', ['goblet squat'], ['quads', 'glutes'], 'dumbbell', 'weight_reps', [
    'Jednoručku drž pri hrudníku',
    'Lakte medzi kolená v spodnej pozícii',
    'Trup vzpriamený, päty na zemi',
    'Plná hĺbka',
  ]),
  ex('hack-squat', 'Hack drep na stroji', ['hack squat'], ['quads', 'glutes'], 'machine', 'weight_reps', [
    'Chrbát celý opretý',
    'Chodidlá na šírku bokov v strede platformy',
    'Hlboký rozsah bez odlepenia pät',
    'Nezamykaj kolená hore',
  ]),
  ex('smith-squat', 'Drep v multipresse', ['smith squat'], ['quads', 'glutes'], 'smith', 'weight_reps', [
    'Chodidlá mierne pred tyčou',
    'Nastav poistky',
    'Kolená v smere špičiek',
    'Neutrálny chrbát, kontrolovaná hĺbka',
  ]),
  ex('leg-press', 'Legpress', ['leg press', 'nozny lis'], ['quads', 'glutes'], 'machine', 'weight_reps', [
    'Zadok a spodný chrbát ostávajú na sedadle',
    'Chodidlá na šírku bokov',
    'Spúšťaj, kým sa panva neodlepí',
    'Nezamykaj kolená v hornej pozícii',
  ]),
  ex('bulgarian-split-squat', 'Bulharský drep', ['bulgarian split squat'], ['quads', 'glutes'], 'dumbbell', 'weight_reps', [
    'Zadná noha nártom na lavičke',
    'Predná noha dosť ďaleko, päta na zemi',
    'Spúšťaj zadné koleno k zemi',
    'Mierny predklon = viac zadok, vzpriamene = viac stehná',
    'Zapíš opakovania na jednu nohu',
  ]),
  ex('lunges', 'Výpady s jednoručkami', ['lunges', 'walking lunges'], ['quads', 'glutes'], 'dumbbell', 'weight_reps', [
    'Dlhý krok, obe kolená cca 90°',
    'Predné koleno nad chodidlom',
    'Trup vzpriamený',
    'Odraz z päty prednej nohy',
  ]),
  ex('step-up', 'Výstupy na lavičku', ['step up'], ['quads', 'glutes'], 'dumbbell', 'weight_reps', [
    'Celé chodidlo na lavičke',
    'Tlač cez pätu pracujúcej nohy',
    'Neodrážaj sa zadnou nohou',
    'Kontrolovaný zostup',
  ]),
  ex('leg-extension', 'Predkopávanie na stroji', ['leg extension'], ['quads'], 'machine', 'weight_reps', [
    'Os stroja v úrovni kolena',
    'Opierka nad členkami',
    'Hore krátka pauza a stlačenie',
    'Pomalý návrat',
  ]),
  ex('rdl', 'Rumunský mŕtvy ťah', ['romanian deadlift', 'rdl'], ['hamstrings', 'glutes', 'lowerBack'], 'barbell', 'weight_reps', [
    'Kolená mierne pokrčené, uhol sa nemení',
    'Pohyb z bedier – zadok ide dozadu',
    'Tyč tesne pri nohách',
    'Spúšťaj do natiahnutia hamstringov, chrbát neutrálny',
  ]),
  ex('db-rdl', 'Rumunský mŕtvy ťah s jednoručkami', ['dumbbell rdl'], ['hamstrings', 'glutes'], 'dumbbell', 'weight_reps', [
    'Jednoručky pred stehnami',
    'Zadok dozadu, kolená mierne pokrčené',
    'Chrbát neutrálny',
    'Spúšťaj do natiahnutia hamstringov',
  ]),
  ex('lying-leg-curl', 'Zakopávanie v ľahu na stroji', ['lying leg curl'], ['hamstrings'], 'machine', 'weight_reps', [
    'Kolená tesne za hranou lavice',
    'Boky pritlačené k lavici',
    'Plný rozsah, pauza hore',
    'Pomalé spúšťanie',
  ]),
  ex('seated-leg-curl', 'Zakopávanie v sede na stroji', ['seated leg curl'], ['hamstrings'], 'machine', 'weight_reps', [
    'Os stroja v úrovni kolena',
    'Stehná zaistené opierkou',
    'Trup mierne v predklone pre väčšie natiahnutie',
    'Kontrolovaný návrat',
  ]),
  ex('nordic-curl', 'Nordický zhyb', ['nordic curl', 'nordic hamstring'], ['hamstrings'], 'bodyweight', 'bodyweight_reps', [
    'Päty zaistené, kolená na podložke',
    'Telo rovné od kolien po hlavu',
    'Spúšťaj čo najpomalšie',
    'Zachyť sa rukami a odraz sa späť',
  ]),
  ex('hip-thrust', 'Hip thrust s veľkou činkou', ['hip thrust'], ['glutes', 'hamstrings'], 'barbell', 'weight_reps', [
    'Lopatky na hrane lavičky, tyč na bokoch (s podložkou)',
    'Holene kolmo k zemi v hornej pozícii',
    'Brada mierne k hrudníku',
    'Hore stlač zadok, neprehýbaj sa v krížoch',
  ]),
  ex('glute-bridge', 'Mostík (glute bridge)', ['glute bridge'], ['glutes', 'hamstrings'], 'bodyweight', 'bodyweight_reps', [
    'Chrbát na zemi, chodidlá blízko zadku',
    'Tlač cez päty',
    'Hore stlač zadok, pauza',
    'Neprehýbaj sa v krížoch',
  ]),
  ex('cable-kickback', 'Zanožovanie na kladke', ['cable kickback', 'glute kickback'], ['glutes'], 'cable', 'weight_reps', [
    'Manžeta na členku, mierny predklon',
    'Noha ide dozadu a mierne nahor',
    'Nekompenzuj prehnutím v krížoch',
    'Pauza a stlačenie zadku',
  ]),
  ex('hip-abduction', 'Unožovanie na stroji', ['hip abduction', 'abduktor'], ['glutes'], 'machine', 'weight_reps', [
    'Chrbát opretý alebo mierny predklon',
    'Tlač kolenami von',
    'Pauza vo vonkajšej pozícii',
    'Kontrolovaný návrat',
  ]),
  ex('hip-adduction', 'Prinožovanie na stroji', ['hip adduction', 'adduktor'], ['adductors'], 'machine', 'weight_reps', [
    'Rozsah nastav podľa flexibility',
    'Sťahuj stehná k sebe',
    'Pauza vo vnútornej pozícii',
    'Pomalý návrat',
  ]),
  ex('standing-calf-raise', 'Výpony v stoji', ['standing calf raise'], ['calves'], 'machine', 'weight_reps', [
    'Špičky na hrane, päty voľne',
    'Dole plné natiahnutie',
    'Hore pauza na špičkách',
    'Kolená takmer vystreté, bez pruženia',
  ]),
  ex('seated-calf-raise', 'Výpony v sede', ['seated calf raise'], ['calves'], 'machine', 'weight_reps', [
    'Opierka nad kolenami',
    'Plný rozsah – dole natiahnutie, hore pauza',
    'Pomalé tempo',
  ]),
  ex('bw-squat', 'Drep s vlastnou váhou', ['air squat', 'bodyweight squat'], ['quads', 'glutes'], 'bodyweight', 'bodyweight_reps', [
    'Chodidlá na šírku ramien',
    'Kolená v smere špičiek',
    'Plná hĺbka, päty na zemi',
    'Trup vzpriamený',
  ]),
  ex('pistol-squat', 'Pištoľový drep', ['pistol squat'], ['quads', 'glutes'], 'bodyweight', 'bodyweight_reps', [
    'Voľná noha vpredu',
    'Ruky pred telom na rovnováhu',
    'Pomalé spúšťanie, päta na zemi',
    'Zapíš opakovania na jednu nohu',
  ]),
  ex('kb-swing', 'Kettlebell swing', ['kettlebell swing'], ['glutes', 'hamstrings', 'core'], 'kettlebell', 'weight_reps', [
    'Pohyb z bedier (hinge), nie drep',
    'Silný výstrel bokov dopredu',
    'Ruky iba vedú kettlebell, nedvíhajú ho',
    'Hore spevnený zadok a brucho',
  ]),

  // ── Brucho / core ──────────────────────────────────────
  ex('plank', 'Plank', ['plank', 'doska'], ['core'], 'bodyweight', 'time', [
    'Lakte pod ramenami',
    'Telo v jednej línii',
    'Zadok a brucho spevnené',
    'Dýchaj plynulo',
  ]),
  ex('side-plank', 'Bočný plank', ['side plank'], ['core'], 'bodyweight', 'time', [
    'Loket pod ramenom',
    'Boky hore, telo v línii',
    'Zapíš čas na jednu stranu',
  ]),
  ex('crunch', 'Skracovačky (crunch)', ['crunch', 'brusaky'], ['core'], 'bodyweight', 'bodyweight_reps', [
    'Spodný chrbát na zemi',
    'Dvíhaj lopatky, nie krk',
    'Výdych pri zdvíhaní',
    'Pomalý návrat',
  ]),
  ex('hanging-leg-raise', 'Zdvíhanie nôh vo vise', ['hanging leg raise'], ['core'], 'bodyweight', 'bodyweight_reps', [
    'Bez hojdania',
    'Podsuň panvu na vrchu',
    'Pomaly spúšťaj',
    'Ľahšia verzia: pokrčené kolená',
  ]),
  ex('cable-crunch', 'Skracovačky na kladke', ['cable crunch'], ['core'], 'cable', 'weight_reps', [
    'V kľaku, lano pri hlave',
    'Skracuj trup – lakte ku kolenám',
    'Boky sa nehýbu',
    'Pomalý návrat',
  ]),
  ex('ab-wheel', 'Ab wheel (koliesko)', ['ab wheel', 'ab roller'], ['core'], 'bodyweight', 'bodyweight_reps', [
    'Začni z kľaku',
    'Podsunutá panva, neprehýbaj sa v krížoch',
    'Choď len tak ďaleko, ako udržíš rovný chrbát',
    'Návrat silou brucha',
  ]),
  ex('russian-twist', 'Ruské twisty', ['russian twist'], ['core'], 'bodyweight', 'bodyweight_reps', [
    'Trup v záklone cca 45°, chrbát rovný',
    'Rotuj trupom, nie len rukami',
    'Ťažšia verzia: nohy hore, záťaž v rukách',
  ]),
  ex('pallof-press', 'Pallof press', ['pallof press'], ['core'], 'cable', 'weight_reps', [
    'Bokom ku kladke, rukoväť pri hrudníku',
    'Vytlač ruky pred seba a drž',
    'Trup sa nesmie natočiť ku kladke',
    'Zapíš opakovania na jednu stranu',
  ]),
  ex('dead-bug', 'Dead bug', ['dead bug'], ['core'], 'bodyweight', 'bodyweight_reps', [
    'Spodný chrbát pritlačený k zemi',
    'Protiľahlá ruka a noha sa vystierajú',
    'Pomalé tempo, výdych pri vystieraní',
  ]),
];

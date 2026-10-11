'use strict';
/* MindButter — инструкция: 7 шагов с простыми картинками и озвучкой.
   Озвучка: если рядом лежит guide/<номер шага>.mp3 (например, записанный в ElevenLabs) — играет файл,
   иначе читает голос самого браузера (speechSynthesis). */

const GA = (label, body) => '<svg viewBox="0 0 360 200" role="img" aria-label="' + label + '">' + body + '</svg>';
const WIN = '<rect class="ga-win" x="8" y="8" width="344" height="184" rx="12"/>';

const GUIDE_STEPS = () => [
  {
    title: 'Заметки — это файлы',
    text: 'Слева — список заметок и папок. Жёлтая кнопка «Новая заметка» создаёт файл. Название меняется прямо в заголовке сверху.',
    say: 'Слева — список заметок и папок. Жёлтая кнопка «Новая заметка» создаёт файл. Название меняется прямо в заголовке сверху.',
    art: GA('Список заметок и кнопка «Новая заметка»', WIN +
      '<rect class="ga-side" x="9" y="9" width="104" height="182" rx="11"/><rect class="ga-side" x="100" y="9" width="13" height="182"/>' +
      '<g class="ga-pulse"><rect class="ga-butter" x="20" y="22" width="82" height="26" rx="8"/><text class="ga-on-butter" x="61" y="39" text-anchor="middle">+ Новая заметка</text></g>' +
      '<rect class="ga-butter-soft" x="18" y="62" width="86" height="22" rx="6"/>' +
      '<text class="ga-text" x="28" y="77">План</text><text class="ga-small" x="28" y="102">Идеи</text>' +
      '<text class="ga-small" x="28" y="124">Встречи</text><text class="ga-small" x="28" y="146">Книги</text>' +
      '<text class="ga-text" x="136" y="46" style="font-size:17px;font-weight:700">План</text>' +
      '<line class="ga-line" x1="136" y1="70" x2="322" y2="70"/><line class="ga-line" x1="136" y1="90" x2="300" y2="90"/>' +
      '<line class="ga-line" x1="136" y1="110" x2="314" y2="110"/><line class="ga-line" x1="136" y1="130" x2="252" y2="130"/>'),
  },
  {
    title: 'Связывай мысли ссылками',
    text: 'Набери [[ — появится список заметок. Выбери нужную, и получится ссылка. Если такой заметки ещё нет, она создастся.',
    say: 'Набери две открывающие квадратные скобки — появится список заметок. Выбери нужную, и получится ссылка. Если такой заметки ещё нет, она создастся.',
    art: GA('Подсказка названий после двух квадратных скобок', WIN +
      '<text class="ga-mono" x="28" y="50" style="font-size:13px">Созвон с [[Ан</text><rect class="ga-caret" x="131" y="37" width="2" height="17"/>' +
      '<rect class="ga-win" x="100" y="64" width="190" height="84" rx="10"/>' +
      '<rect class="ga-butter-soft" x="106" y="70" width="178" height="24" rx="6"/>' +
      '<text class="ga-text" x="116" y="86">Анна Петрова</text><text class="ga-small" x="116" y="111">Анализ рынка</text>' +
      '<text class="ga-acc-t" x="116" y="136">+ Новая заметка «Ан»</text>' +
      '<text class="ga-small" x="28" y="176">Enter — и ссылка готова: [[Анна Петрова]]</text>'),
  },
  {
    title: 'Правка и чтение',
    text: 'В «Правке» пишешь текст. В «Чтении» видишь оформление, отмечаешь задачи и переходишь по ссылкам. Переключатель — вверху справа.',
    say: 'В режиме «Правка» пишешь текст. В режиме «Чтение» видишь оформление, отмечаешь задачи и переходишь по ссылкам. Переключатель — вверху справа.',
    art: GA('Один текст в режимах правки и чтения', WIN +
      '<rect class="ga-side" x="118" y="18" width="124" height="26" rx="8"/><rect class="ga-win" x="180" y="21" width="59" height="20" rx="6"/>' +
      '<text class="ga-small" x="149" y="35" text-anchor="middle">Правка</text><text class="ga-text" x="209" y="35" text-anchor="middle">Чтение</text>' +
      '<rect class="ga-side" x="22" y="58" width="140" height="118" rx="8"/>' +
      '<text class="ga-mono" x="32" y="84">## План</text><text class="ga-mono" x="32" y="108">- [ ] позвонить</text><text class="ga-mono" x="32" y="132">[[Идея]] #работа</text>' +
      '<path class="ga-acc-line" d="M170 117h18m-6-6 6 6-6 6"/>' +
      '<text class="ga-text" x="200" y="86" style="font-size:15px;font-weight:700">План</text>' +
      '<rect x="200" y="98" width="12" height="12" rx="3" class="ga-stroke"/><text class="ga-text" x="220" y="108">позвонить</text>' +
      '<text class="ga-acc-t" x="200" y="134">Идея</text><line class="ga-acc-line" x1="200" y1="138" x2="226" y2="138"/>' +
      '<rect class="ga-tag" x="234" y="123" width="52" height="16" rx="8"/><text class="ga-tag-t" x="260" y="135" text-anchor="middle">#работа</text>'),
  },
  {
    title: 'Кто ссылается сюда',
    text: 'Кнопка «Связи» вверху показывает, какие заметки ссылаются на открытую. Так находятся связи, о которых легко забыть.',
    say: 'Кнопка «Связи» вверху показывает, какие заметки ссылаются на открытую. Так находятся связи, о которых легко забыть.',
    art: GA('Две заметки ссылаются на третью', WIN +
      '<rect class="ga-side" x="24" y="30" width="80" height="38" rx="8"/><text class="ga-text" x="64" y="53" text-anchor="middle">План</text>' +
      '<rect class="ga-side" x="24" y="128" width="80" height="38" rx="8"/><text class="ga-text" x="64" y="151" text-anchor="middle">Встреча</text>' +
      '<g class="ga-pulse"><rect class="ga-butter-soft" x="132" y="78" width="90" height="42" rx="9"/><text class="ga-text" x="177" y="103" text-anchor="middle" style="font-weight:700">Идея</text></g>' +
      '<path class="ga-acc-line" d="M106 52 128 88m-9-2 9 2 1-9M106 146l22-30m-9 2 9-2 1 9"/>' +
      '<rect class="ga-side" x="240" y="22" width="102" height="156" rx="9"/>' +
      '<text class="ga-small" x="250" y="44">Ссылаются сюда · 2</text>' +
      '<text class="ga-acc-t" x="250" y="70">План</text><line class="ga-line" x1="250" y1="82" x2="326" y2="82" style="stroke-width:4"/>' +
      '<text class="ga-acc-t" x="250" y="108">Встреча</text><line class="ga-line" x1="250" y1="120" x2="316" y2="120" style="stroke-width:4"/>'),
  },
  {
    title: 'Теги и поиск',
    text: 'Пометь заметку словом с решёткой, например #идея. Во вкладке «Теги» видно все метки, а «Поиск» находит любые слова.',
    say: 'Пометь заметку словом с решёткой, например «решётка идея». Во вкладке «Теги» видно все метки, а «Поиск» находит любые слова.',
    art: GA('Поиск по тегу', WIN +
      '<rect class="ga-side" x="28" y="22" width="304" height="34" rx="10"/>' +
      '<circle class="ga-stroke" cx="48" cy="39" r="7"/><path class="ga-stroke" d="m53 44 5 5"/>' +
      '<rect class="ga-tag" x="66" y="29" width="54" height="20" rx="10"/><text class="ga-tag-t" x="93" y="43" text-anchor="middle">#идея</text>' +
      '<rect class="ga-side" x="28" y="70" width="304" height="46" rx="10"/><text class="ga-acc-t" x="42" y="90">Подкаст про сон</text>' +
      '<line class="ga-line" x1="42" y1="104" x2="230" y2="104" style="stroke-width:4"/>' +
      '<rect class="ga-tag" x="262" y="80" width="54" height="18" rx="9"/><text class="ga-tag-t" x="289" y="93" text-anchor="middle">#идея</text>' +
      '<rect class="ga-side" x="28" y="126" width="304" height="46" rx="10"/><text class="ga-acc-t" x="42" y="146">Приложение для заметок</text>' +
      '<line class="ga-line" x1="42" y1="160" x2="206" y2="160" style="stroke-width:4"/>' +
      '<rect class="ga-tag" x="262" y="136" width="54" height="18" rx="9"/><text class="ga-tag-t" x="289" y="149" text-anchor="middle">#идея</text>'),
  },
  {
    title: 'Граф связей',
    text: 'Граф показывает заметки точками, а ссылки — линиями. Клик по точке открывает заметку. Кнопка «Граф» — в ленте слева.',
    say: 'Граф показывает заметки точками, а ссылки — линиями. Клик по точке открывает заметку. Кнопка «Граф» — в ленте слева.',
    art: GA('Заметки точками, ссылки линиями', WIN +
      '<g>' +
      '<line class="ga-edge" x1="180" y1="100" x2="110" y2="58"/><line class="ga-edge" x1="180" y1="100" x2="96" y2="138"/>' +
      '<line class="ga-edge" x1="180" y1="100" x2="258" y2="54"/><line class="ga-edge" x1="180" y1="100" x2="272" y2="132"/>' +
      '<line class="ga-edge" x1="258" y1="54" x2="314" y2="86"/><line class="ga-edge" x1="110" y1="58" x2="58" y2="84"/>' +
      '<line class="ga-edge" x1="272" y1="132" x2="226" y2="168"/><line class="ga-edge" x1="96" y1="138" x2="150" y2="168"/>' +
      '<circle class="ga-node" cx="110" cy="58" r="7"/><circle class="ga-node" cx="96" cy="138" r="6"/>' +
      '<circle class="ga-node" cx="258" cy="54" r="8"/><circle class="ga-node" cx="272" cy="132" r="6"/>' +
      '<circle class="ga-node" cx="314" cy="86" r="4.5"/><circle class="ga-node" cx="58" cy="84" r="4.5"/>' +
      '<circle class="ga-ghost" cx="226" cy="168" r="4.5"/><circle class="ga-node" cx="150" cy="168" r="4.5"/>' +
      '<circle class="ga-butter ga-pulse" cx="180" cy="100" r="12"/>' +
      '<text class="ga-text" x="180" y="128" text-anchor="middle">Идея</text>' +
      '<text class="ga-small" x="258" y="38" text-anchor="middle">План</text>' +
      '</g>'),
  },
  {
    title: 'Где хранятся заметки',
    text: window.SLUDA_DEMO
      ? 'В демо заметки живут только в этом браузере. В полной версии можно работать с обычной папкой файлов на компьютере и скачивать всё архивом.'
      : 'Заметки живут в этом браузере или в папке на компьютере. Иногда скачивай архив: «Хранилище» → «Скачать всё в zip» — так их не потерять.',
    say: window.SLUDA_DEMO
      ? 'В демо заметки живут только в этом браузере. В полной версии можно работать с обычной папкой файлов на компьютере и скачивать всё архивом.'
      : 'Заметки живут в этом браузере или в папке на компьютере. Иногда скачивай архив через меню «Хранилище» — так их не потерять.',
    art: GA('Браузер, папка на диске и архив', WIN +
      '<rect class="ga-side" x="28" y="40" width="88" height="70" rx="9"/><line class="ga-edge" x1="28" y1="58" x2="116" y2="58"/>' +
      '<circle class="ga-node" cx="40" cy="49" r="3"/><circle class="ga-node" cx="50" cy="49" r="3"/><circle class="ga-node" cx="60" cy="49" r="3"/>' +
      '<line class="ga-line" x1="42" y1="76" x2="100" y2="76" style="stroke-width:4"/><line class="ga-line" x1="42" y1="90" x2="86" y2="90" style="stroke-width:4"/>' +
      '<text class="ga-text" x="72" y="134" text-anchor="middle">В браузере</text>' +
      '<path class="ga-butter-soft" d="M136 50a6 6 0 0 1 6-6h22l8 9h34a6 6 0 0 1 6 6v45a6 6 0 0 1-6 6h-64a6 6 0 0 1-6-6z"/>' +
      '<path class="ga-stroke" d="M136 50a6 6 0 0 1 6-6h22l8 9h34a6 6 0 0 1 6 6v45a6 6 0 0 1-6 6h-64a6 6 0 0 1-6-6z"/>' +
      '<text class="ga-small" x="174" y="88" text-anchor="middle">.md</text>' +
      '<text class="ga-text" x="174" y="134" text-anchor="middle">Папка на диске</text>' +
      '<rect class="ga-side" x="248" y="42" width="66" height="68" rx="9"/>' +
      '<path class="ga-acc-line" d="M281 54v34m-12-12 12 12 12-12M266 98h30"/>' +
      '<text class="ga-text" x="281" y="134" text-anchor="middle">Архив .zip</text>' +
      '<text class="ga-small" x="180" y="170" text-anchor="middle">Файлы остаются у тебя — никуда не отправляются</text>'),
  },
];

/* ---------- голос ---------- */
const Voice = {
  audio: null, utter: null, playing: false, voice: null, onstate: null, fileOk: {},
  init(){
    if(!('speechSynthesis' in window)) return;
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      const ru = vs.filter(v => /^ru/i.test(v.lang));
      this.voice = ru.find(v => /(google|natural|online|neural|milena|svetlana|dariya|irina)/i.test(v.name)) || ru[0] || null;
    };
    pick();
    if(speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', pick);
  },
  set(v){ this.playing = v; if(this.onstate) this.onstate(v); },
  play(step, text){
    this.stop();
    const tts = () => {
      if(!('speechSynthesis' in window)){ this.set(false); toast('Этот браузер не умеет читать вслух'); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      if(this.voice) u.voice = this.voice;
      u.rate = 1;
      u.onend = u.onerror = () => { if(this.utter === u){ this.utter = null; this.set(false); } };
      this.utter = u;
      this.set(true);
      speechSynthesis.speak(u);
    };
    if(this.fileOk[step] === false) return tts();
    const a = new Audio('guide/' + step + '.mp3');
    this.audio = a;
    this.set(true);
    const fail = () => { if(this.audio !== a) return; this.audio = null; this.fileOk[step] = false; tts(); };
    a.onended = () => { if(this.audio === a){ this.audio = null; this.set(false); } };
    a.onerror = fail;
    a.play().then(() => { this.fileOk[step] = true; }).catch(fail);
  },
  stop(){
    if(this.audio){ const a = this.audio; this.audio = null; a.pause(); }
    if('speechSynthesis' in window && (this.utter || speechSynthesis.speaking)){ this.utter = null; try { speechSynthesis.cancel(); } catch(e){} }
    if(this.playing) this.set(false);
  },
};

/* ---------- окно инструкции ---------- */
const Guide = {
  i: 0, steps: null,
  isOpen(){ return !$('#guide').hidden; },
  open(at){
    this.steps = GUIDE_STEPS();
    hideMenu(); closeDrawers();
    $('#guide').hidden = false;
    $('#guide-auto').checked = !!LS.get('guideAuto', false);
    this.go(at || 0);
    setTimeout(() => $('#guide-next').focus(), 0);
  },
  close(){
    Voice.stop();
    $('#guide').hidden = true;
    LS.set('guideSeen', true);
  },
  go(i){
    const n = this.steps.length;
    this.i = Math.max(0, Math.min(n - 1, i));
    const s = this.steps[this.i];
    Voice.stop();
    $('#guide-art').innerHTML = s.art;
    $('#guide-step').textContent = 'Шаг ' + (this.i + 1) + ' из ' + n;
    $('#guide-title').textContent = s.title;
    $('#guide-text').textContent = s.text;
    $('#guide-prev').disabled = this.i === 0;
    $('#guide-prev').style.visibility = this.i === 0 ? 'hidden' : '';
    $('#guide-next').textContent = this.i === n - 1 ? 'Начать' : 'Дальше';
    $('#guide-dots').innerHTML = this.steps.map((x, k) =>
      '<button class="dot' + (k === this.i ? ' on' : '') + '" data-k="' + k + '" aria-label="Шаг ' + (k + 1) + '"></button>').join('');
    if($('#guide-auto').checked) this.listen();
  },
  listen(){
    const s = this.steps[this.i];
    if(Voice.playing){ Voice.stop(); return; }
    Voice.play(this.i + 1, s.say || s.text);
  },
  next(){ if(this.i === this.steps.length - 1) this.close(); else this.go(this.i + 1); },
  bind(){
    Voice.init();
    Voice.onstate = playing => {
      const b = $('#guide-listen');
      b.classList.toggle('playing', playing);
      setIcon(b, playing ? 'stop' : 'play');
      b.lastChild.nodeType === 3 ? (b.lastChild.nodeValue = playing ? 'Стоп' : 'Послушать') : b.append(playing ? 'Стоп' : 'Послушать');
    };
    $('#guide-listen').addEventListener('click', () => this.listen());
    $('#guide-auto').addEventListener('change', e => { LS.set('guideAuto', e.target.checked); if(e.target.checked && !Voice.playing) this.listen(); if(!e.target.checked) Voice.stop(); });
    $('#guide-next').addEventListener('click', () => this.next());
    $('#guide-prev').addEventListener('click', () => this.go(this.i - 1));
    $('#guide-close').addEventListener('click', () => this.close());
    $('#guide-dots').addEventListener('click', e => { const d = e.target.closest('.dot'); if(d) this.go(+d.dataset.k); });
    $('#guide').addEventListener('click', e => { if(e.target.id === 'guide') this.close(); });
  },
  key(e){
    if(e.key === 'Escape'){ e.preventDefault(); this.close(); return; }
    if(e.key === 'ArrowRight'){ e.preventDefault(); this.next(); return; }
    if(e.key === 'ArrowLeft'){ e.preventDefault(); this.go(this.i - 1); }
  },
};

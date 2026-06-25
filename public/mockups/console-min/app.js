// NDDA AI прототип — каркас (сайдбар + топбар + переключатель акцента). SVG-иконки (Lucide).
(function(){
  function ico(paths){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
  }
  var I = {
    clipboard: ico('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M8 11h.01"/><path d="M12 11h4"/><path d="M8 16h.01"/><path d="M12 16h4"/>'),
    plus: ico('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M12 11v6"/><path d="M9 14h6"/>'),
    expert: ico('<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M15 9a6 6 0 0 0-6-6"/><path d="M9 3H7v6a2 2 0 0 0 2 2h.5"/>'),
    book: ico('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'),
    chat: ico('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    admin: ico('<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>'),
    logout: ico('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>')
  };
  // публичный набор иконок для страниц
  window.NDDA_ICONS = I;
  window.ndIcon = ico;

  var NAV = [
    {group:'Работа', items:[
      {id:'applicant', href:'applicant.html', ic:I.clipboard, label:'Мои заявки'},
      {id:'wizard',    href:'wizard.html',    ic:I.plus,      label:'Создать заявку'},
      {id:'expert',    href:'expert.html',    ic:I.expert,    label:'Эксперт'},
      {id:'reference', href:'reference.html', ic:I.book,      label:'Справочник'},
      {id:'chat',      href:'chat.html',      ic:I.chat,      label:'Чат'},
    ]},
    {group:'Система', items:[
      {id:'admin', href:'admin.html', ic:I.admin, label:'Админ'},
    ]},
  ];
  var ACCENTS=['blue','indigo','teal','violet','slate'];
  var COLORS={indigo:'#4f46e5',blue:'#2563eb',teal:'#0d7d72',violet:'#6d28d9',slate:'#334155'};

  var page = document.body.getAttribute('data-page')||'';
  var title = document.body.getAttribute('data-title')||'';
  var crumbs = document.body.getAttribute('data-crumbs')||'';

  try{var a=localStorage.getItem('ndda-accent'); if(a) document.documentElement.setAttribute('data-accent',a);}catch(e){}

  var sb = '<aside class="sb"><div class="brand">NDDA <b>AI</b></div><nav>';
  NAV.forEach(function(g){
    sb += '<div class="navlabel">'+g.group+'</div>';
    g.items.forEach(function(it){
      var on = (it.id===page)?' active':'';
      sb += '<a class="item'+on+'" href="'+it.href+'">'+it.ic+'<span>'+it.label+'</span></a>';
    });
  });
  sb += '</nav><div class="who"><div class="ava">Э</div><div><div style="font-weight:600;font-size:12px">Эксперт (демо)</div><div class="xs muted">expert</div></div></div></aside>';

  var picker = '<div class="accent-pick">'+ACCENTS.map(function(c){return '<button title="'+c+'" data-a="'+c+'" style="background:'+COLORS[c]+'"></button>';}).join('')+'</div>';
  var tb = '<div class="topbar"><div class="crumbs">'+(crumbs||'<b>'+title+'</b>')+'</div><div class="actions">'+picker+'<button class="btn btn-sm">'+I.logout+'Выйти</button></div></div>';

  var main = document.querySelector('main');
  var wrap = document.createElement('div'); wrap.className='layout';
  wrap.innerHTML = sb + '<div class="main">'+tb+'</div>';
  document.body.insertBefore(wrap, main);
  wrap.querySelector('.main').appendChild(main);

  document.querySelectorAll('.accent-pick button').forEach(function(b){
    b.addEventListener('click',function(){
      var c=b.getAttribute('data-a');
      document.documentElement.setAttribute('data-accent',c);
      try{localStorage.setItem('ndda-accent',c);}catch(e){}
    });
  });

  // Кликабельные строки таблиц: клик/Enter по строке → переход по первой ссылке внутри
  document.querySelectorAll('table.tbl.clickable tbody tr').forEach(function(tr){
    var a = tr.querySelector('a[href]');
    if(!a) return;
    tr.tabIndex = 0;
    tr.setAttribute('role','link');
    tr.addEventListener('click', function(e){ if(e.target.closest('a,button')) return; a.click(); });
    tr.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); a.click(); } });
  });
})();

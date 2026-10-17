'use strict';
(() => {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const cfg = window.BIRUZA_CONFIG, data = window.BIRUZA_DATA;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const dialog = $('#dialog');
  let opener = null, flowerFilter = 'all', balloonFilter = 'all';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  function toast(message) { $('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3200); }
  function open(html) {
    if(!dialog.open)opener=document.activeElement;
    $('#dialog-content').innerHTML=html;
    if(!dialog.open)dialog.showModal();
    dialog.scrollTop=0;
    ($('input:not([type=hidden]), select, textarea',dialog)||$('.dialog-close')).focus({preventScroll:true});
  }
  $('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('close',()=>opener?.isConnected&&opener.focus({preventScroll:true}));
  function filterButtons(items,current,type){return items.map(([id,label])=>`<button data-filter-${type}="${id}" aria-pressed="${id===current}">${esc(label)}</button>`).join('');}
  function renderFlowers(){
    $('#flower-filters').innerHTML=filterButtons(data.flowerFilters,flowerFilter,'flower');
    const list=data.flowers.filter(p=>flowerFilter==='all'||p.group===flowerFilter);
    $('#flower-count').textContent=`Направлений: ${list.length}`;
    $('#flower-grid').innerHTML=list.map(p=>card(p,false)).join('');
  }
  function card(p,balloon){return `<article class="product-card"><div class="product-art tone-${p.tone}"><span class="product-kind">${esc(p.madeToOrder?'Под заказ':p.kind||'Подберём для вас')}</span>${icon(p.icon)}<span>Фотографии добавим позже</span></div><div class="product-copy"><h3>${esc(p.name)}</h3><p>${esc(p.note)}</p><div class="product-action"><span>${esc(p.price||'Стоимость уточним')}</span><button data-product="${p.id}" data-domain="${balloon?'balloons':'flowers'}">Обсудить ${balloon?'заказ':'подбор'} ${icon('up')}</button></div></div></article>`;}
  function renderBalloons(){const groups=[['all','Все шары'],['latex','Латексные'],['foil','Фольгированные'],['numbers','Цифры'],['sets','Композиции']];$('#balloon-filters').innerHTML=filterButtons(groups,balloonFilter,'balloon');$('#balloon-grid').innerHTML=data.balloons.filter(p=>balloonFilter==='all'||p.group===balloonFilter).map(p=>card(p,true)).join('');}
  $('#category-grid').innerHTML=data.categories.map(p=>`<a class="category" href="#${p.target}" ${p.filter?`data-category="${p.filter}"`:''}><span class="category-art">${icon(p.icon)}</span><strong>${esc(p.name)}</strong><small>${esc(p.note)}</small></a>`).join('');
  $('#gift-grid').innerHTML=data.gifts.map(p=>`<button class="gift-card" data-product="${p.id}" data-domain="gifts"><span class="gift-art">${icon(p.icon)}</span><strong>${esc(p.name)} ${icon('up')}</strong></button>`).join('');
  $('#faq-list').innerHTML=data.faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  renderFlowers();renderBalloons();
  function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function socialLinks(){
    const icons={max:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H6l-4 2 1.6-5.2A8 8 0 1 1 20 11.5Z"/><path d="M8 14V9l3 3 3-3v5"/></svg>',vk:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7c1 6 4 10 9 10V7m0 6c2-1 4-3 6-6m-6 6c3 0 5 2 7 4"/></svg>',telegram:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 18-7-4 18-6-7-4 3 1-6 9-5-6 8"/></svg>'};
    return `<div class="social-links">${[['max','MAX',cfg.maxUrl],['vk','ВКонтакте',cfg.vkUrl],['telegram','Telegram',cfg.telegramUrl]].map(([key,label,url])=>safeUrl(url)?`<a class="social-icon" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${icons[key]}</a>`:`<button class="social-icon pending" type="button" data-social-pending="${label}" aria-label="${label} – ссылка появится позже" title="${label} – ссылка появится позже">${icons[key]}<span class="social-tooltip">Ссылка появится позже</span></button>`).join('')}</div>`;
  }
  $('#store-location').textContent=`${cfg.address}. ${cfg.hours}.`;
  $('#contact-links').innerHTML=`<a class="phone-link" href="tel:${cfg.phone}">${esc(cfg.phoneLabel)}</a>${socialLinks()}`;
  $('#map-panel').innerHTML=`<div class="map-pin" aria-hidden="true"><span></span></div><h3>Владимир, Мира, 53</h3><p>Ждём вас каждый день<br>с 9:00 до 20:00</p><a class="text-link" href="${esc(safeUrl(cfg.mapsUrl))}" target="_blank" rel="noopener noreferrer">Открыть адрес на карте ${icon('up')}</a>`;
  $('.topline span').textContent='Владимир · Мира, 53 · Ежедневно 9:00–20:00';
  $('.header-contact').outerHTML=`<a class="button small outline header-contact" href="tel:${cfg.phone}">${esc(cfg.phoneLabel)}</a>`;
  $('.desktop-nav').insertAdjacentHTML('afterend',`<div class="header-socials">${socialLinks()}</div>`);
  $('.footer-top>p').innerHTML=`<a href="tel:${cfg.phone}">${esc(cfg.phoneLabel)}</a><br>${esc(cfg.hours)}<br>Владимир, ул. Мира, 53${socialLinks()}`;
  $('#year').textContent=new Date().getFullYear();
  const toggle=$('.menu-toggle');
  function closeMenu(){toggle.setAttribute('aria-expanded','false');$('#mobile-menu').hidden=true;}
  toggle.addEventListener('click',()=>{const expanded=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!expanded));$('#mobile-menu').hidden=expanded;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#mobile-menu').hidden){closeMenu();toggle.focus();}});
  document.addEventListener('click',e=>{
    const pending=e.target.closest('[data-social-pending]');if(pending)toast(`${pending.dataset.socialPending}: ссылку добавим позже`);
    const category=e.target.closest('[data-category]');if(category){flowerFilter=category.dataset.category;renderFlowers();}
    const ff=e.target.closest('[data-filter-flower]');if(ff){flowerFilter=ff.dataset.filterFlower;renderFlowers();$(`[data-filter-flower="${flowerFilter}"]`).focus({preventScroll:true});}
    const bf=e.target.closest('[data-filter-balloon]');if(bf){balloonFilter=bf.dataset.filterBalloon;renderBalloons();$(`[data-filter-balloon="${balloonFilter}"]`).focus({preventScroll:true});}
    const link=e.target.closest('a[href^="#"]');
    if(link&&!link.classList.contains('skip')){const target=$(link.getAttribute('href'));if(target){e.preventDefault();closeMenu();target.scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'start'});history.replaceState(null,'',link.getAttribute('href'));target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}
    const inquiry=e.target.closest('[data-inquiry]');if(inquiry)showForm(inquiry.dataset.inquiry);
    const product=e.target.closest('[data-product]');if(product){const item=data[product.dataset.domain].find(p=>p.id===product.dataset.product);if(item)showForm('product',item);}
  });
  const topics={bouquet:'Подберём букет под ваш бюджет',event:'Обсудим оформление шарами',inflate:'Надувание ваших шаров',delivery:'Вопрос о доставке',rare:'Необычные цветы под заказ',question:'Спросить флориста',product:'Обсудить заказ'};
  function localDate(){return new Intl.DateTimeFormat('sv-SE',{timeZone:cfg.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function showForm(type,product=null){
    const live=Boolean(cfg.inquiryEndpoint&&cfg.privacyUrl&&cfg.consentVersion),bouquet=type==='bouquet',event=type==='event';
    open(`<h2 id="dialog-title">${topics[type]||topics.question}</h2><p class="dialog-description">${product?`${esc(product.name)}. ${esc(product.price||'Стоимость уточним')}. `:''}${live?'Оставьте пожелания и контакт. Детали согласуем лично.':'Запишите пожелания и подготовьте текст обращения. Вы сможете скопировать его или позвонить нам.'}</p>${!live?'<div class="dialog-notice">Пока эта форма не отправляет данные в магазин. Подготовленный текст останется у вас.</div>':''}<form class="form" id="inquiry-form">${event?'<label>Какое событие?<select name="eventType"><option>Открытие магазина</option><option>День рождения</option><option>Другое мероприятие</option></select></label>':''}${bouquet||product||event?`<div class="form-row"><label>Бюджет, ₽${bouquet?' *':''}<input name="budget" type="number" min="${bouquet?1500:1}" max="10000000" step="1" inputmode="numeric" ${bouquet?'required':''} placeholder="${bouquet?'От 1 500':'По желанию'}"></label><label>Желаемая дата<input name="date" type="date" min="${localDate()}"></label></div>`:''}${event?'<label>Где планируется событие?<input name="location" maxlength="250" placeholder="Адрес или район, если уже известен"></label>':''}<label>${['question','inflate','delivery','rare'].includes(type)?'Ваш вопрос *':'Пожелания'}<textarea name="comment" maxlength="1500" ${['question','inflate','delivery','rare'].includes(type)?'required':''} placeholder="${type==='inflate'?'Тип и количество шаров':'Расскажите, что для вас важно'}"></textarea></label>${live?'<label>Телефон *<input name="phone" type="tel" autocomplete="tel" required maxlength="24" placeholder="+7 910 000-00-00"></label><label class="checkbox"><input type="checkbox" name="consent" required><span>Согласен с обработкой данных для ответа на обращение. <a href="'+esc(safeUrl(cfg.privacyUrl)||cfg.privacyUrl)+'" target="_blank" rel="noopener">Документы</a></span></label>':''}<button class="button" type="submit">${live?'Отправить заявку':'Подготовить обращение'} ${icon('up')}</button><p class="form-status" role="status"></p><small>Состав, стоимость и получение подтвердим при личном согласовании.</small></form>`);
    const f=$('#inquiry-form');
    const requestId=window.crypto?.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    f.addEventListener('submit',async e=>{
      e.preventDefault();const budget=f.elements.budget;
      if(budget)budget.setCustomValidity(bouquet&&Number(budget.value)<1500?'Для подбора букета укажите сумму от 1 500 ₽.':'');
      const phone=f.elements.phone;
      if(phone){let digits=phone.value.replace(/\D/g,'');if(digits.startsWith('8')&&digits.length===11)digits='7'+digits.slice(1);phone.setCustomValidity(/^7\d{10}$/.test(digits)?'':'Укажите телефон полностью, например +7 910 000-00-00.');}
      if(!f.reportValidity())return;
      const fd=new FormData(f),payload={requestId,type,productId:product?.id||null,budget:fd.get('budget')?Number(fd.get('budget')):null,desiredDate:fd.get('date')||null,eventType:fd.get('eventType')||null,locationNote:fd.get('location')||null,comment:String(fd.get('comment')||'').trim()};
      if(!live){showPrepared(payload,product);return;}
      const button=$('button[type=submit]',f),status=$('.form-status',f);if(button.disabled)return;
      button.disabled=true;button.textContent='Отправляем…';status.textContent='';
      const control=new AbortController(),timer=setTimeout(()=>control.abort(),15000);
      try{
        let digits=phone.value.replace(/\D/g,'');if(digits[0]==='8')digits='7'+digits.slice(1);
        const res=await fetch(cfg.inquiryEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,phone:'+'+digits,consentVersion:cfg.consentVersion}),signal:control.signal});
        const result=await res.json();if(!res.ok||result.accepted!==true||!result.id)throw new Error('Not accepted');
        open(`<h2 id="dialog-title">Заявка получена</h2><p class="dialog-description">Обсудим детали по указанному телефону. Состав, стоимость и получение ещё нужно согласовать.</p><p class="dialog-description">Номер обращения: ${esc(result.id)}</p><a class="button" href="tel:${cfg.phone}">Позвонить в магазин</a>`);
      }catch{status.classList.add('error');status.textContent='Не удалось подтвердить приём заявки. Попробуйте ещё раз или позвоните в магазин.';}
      finally{clearTimeout(timer);if(button.isConnected){button.disabled=false;button.textContent='Отправить заявку';}}
    });
    f.addEventListener('input',e=>{if(e.target.setCustomValidity)e.target.setCustomValidity('');});
  }
  function showPrepared(p,product){
    const text=['Здравствуйте! Магазин «Бирюза».',`Тема: ${topics[p.type]||topics.question}`,product?`Выбранное направление: ${product.name}`:'',p.budget?`Бюджет: ${new Intl.NumberFormat('ru-RU').format(p.budget)} ₽`:'',p.desiredDate?`Желаемая дата: ${p.desiredDate.split('-').reverse().join('.')}`:'',p.eventType?`Событие: ${p.eventType}`:'',p.locationNote?`Место: ${p.locationNote}`:'',p.comment?`Пожелания: ${p.comment}`:'','Прошу согласовать доступные варианты, стоимость и получение.'].filter(Boolean).join('\n');
    open(`<h2 id="dialog-title">Ваше обращение готово</h2><p class="dialog-description">Оно ещё не отправлено в магазин. Скопируйте текст для сообщения или позвоните нам, чтобы обсудить заказ.</p><label class="sr-label" for="prepared-text">Текст обращения</label><textarea class="prepared-text" id="prepared-text" readonly></textarea><div class="dialog-actions"><button class="button" id="copy-text">Скопировать текст ${icon('up')}</button><a class="button outline" href="tel:${cfg.phone}">Позвонить</a></div><p class="dialog-description" style="margin-top:20px">Ссылки MAX, ВК и Telegram добавим позже.</p>${socialLinks()}`);
    $('#prepared-text').value=text;
    $('#copy-text').addEventListener('click',async()=>{try{if(!navigator.clipboard)throw new Error('No clipboard');await navigator.clipboard.writeText(text);toast('Текст скопирован. Теперь его можно отправить магазину.');}catch{$('#prepared-text').select();toast('Выделили текст. Скопируйте его обычным способом.');}});
  }
  const revealElements=$$('.reveal');let observer;
  function configureMotion(){observer?.disconnect();if(motion.matches||!('IntersectionObserver'in window)){revealElements.forEach(el=>{el.classList.remove('reveal-pending');el.classList.add('is-visible');});return;}observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.remove('reveal-pending');entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.06});revealElements.forEach(el=>{if(el.getBoundingClientRect().top<innerHeight){el.classList.add('is-visible');}else if(!el.classList.contains('is-visible')){el.classList.add('reveal-pending');observer.observe(el);}});}
  let ticking=false;
  function parallax(){ticking=false;$$('[data-parallax]').forEach(el=>{const r=$('.hero-art').getBoundingClientRect();el.style.transform=motion.matches||innerWidth<600?'':`translateY(${Math.max(-100,Math.min(100,-r.top*Number(el.dataset.parallax)))}px)`;});}
  addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(parallax);}},{passive:true});
  motion.addEventListener('change',()=>{configureMotion();parallax();});addEventListener('resize',parallax);configureMotion();parallax();
})();

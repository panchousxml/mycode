const TRACKED_EVENTS = [
  {
    event_name: 'click_header_callback',
    type: 'ui_click',
    page_match: '*',
    selector:
      'body > div#allrecords.t-records.t-records__overflow-hidden:nth-child(1) > div#rec1348261531.r.t-rec.uc-block-1:nth-child(1) > div.t396:nth-child(2) > div.t396__artboard.rendered > div.t396__elem.tn-elem.tn-elem__1348261531175879184340112880:nth-child(16) > a.tn-atom'
  },
  {
    event_name: 'click_header_whatsapp',
    type: 'ui_click',
    page_match: '*',
    selector:
      'body > div#allrecords.t-records.t-records__overflow-hidden:nth-child(1) > div#rec1348261531.r.t-rec.uc-block-1:nth-child(1) > div.t396:nth-child(2) > div.t396__artboard.rendered > div.t396__elem.tn-elem.no-lazy.tn-elem__1348261531176320563325032190:nth-child(27) > a.tn-atom'
  },
  {
    event_name: 'click_header_telegram',
    type: 'ui_click',
    page_match: '*',
    selector:
      'body > div#allrecords.t-records.t-records__overflow-hidden:nth-child(1) > div#rec1348261531.r.t-rec.uc-block-1:nth-child(1) > div.t396:nth-child(2) > div.t396__artboard.rendered > div.t396__elem.tn-elem.no-lazy.tn-elem__13482615311763203328767:nth-child(26) > a.tn-atom'
  },
  {
    event_name: 'click_header_phone',
    type: 'ui_click',
    page_match: '*',
    selector:
      'body > div#allrecords.t-records.t-records__overflow-hidden:nth-child(1) > div#rec1348261531.r.t-rec.uc-block-1:nth-child(1) > div.t396:nth-child(2) > div.t396__artboard.rendered > div.t396__elem.tn-elem.tn-elem__1348261531175879184335147490:nth-child(19) > div.tn-atom > a'
  },
  {
    event_name: 'click_header_calculator',
    type: 'ui_click',
    page_match: '*',
    selector: '#rec1348261531 > div > div > div.t396__elem.tn-elem.no-lazy.jump.tn-elem__13482615311763645182507000001'
  },
  {
    event_name: 'click_header_logo',
    type: 'ui_click',
    page_match: '*',
    selector:
      'body > div#allrecords.t-records.t-records__overflow-hidden:nth-child(1) > div#rec1348261531.r.t-rec.uc-block-1:nth-child(1) > div.t396:nth-child(2) > div.t396__artboard.rendered > div.t396__elem.tn-elem.no-lazy.tn-elem__13482615311763205875702:nth-child(28) > a.tn-atom'
  },
  {
    event_name: 'click_header_email',
    type: 'ui_click',
    page_match: '*',
    selector:
      'body > div#allrecords.t-records.t-records__overflow-hidden:nth-child(1) > div#rec1348261531.r.t-rec.uc-block-1:nth-child(1) > div.t396:nth-child(2) > div.t396__artboard.rendered > div.t396__elem.tn-elem.tn-elem__1348261531175879184339494540:nth-child(15) > div.tn-atom > span'
  },
  {
    event_name: 'click_header_menu_portfolio',
    type: 'ui_click',
    page_match: '*',
    selector:
      'body > div#allrecords.t-records.t-records__overflow-hidden:nth-child(1) > div#rec1348261531.r.t-rec.uc-block-1:nth-child(1) > div.t396:nth-child(2) > div.t396__artboard.rendered > div.t396__elem.tn-elem.menu.tn-elem__1348261531175879184343288560:nth-child(18) > div.tn-atom > a'
  },
  {
    event_name: 'click_header_menu_calc_price',
    type: 'ui_click',
    page_match: '*',
    selector:
      'body > div#allrecords.t-records.t-records__overflow-hidden:nth-child(1) > div#rec1348261531.r.t-rec.uc-block-1:nth-child(1) > div.t396:nth-child(2) > div.t396__artboard.rendered > div.t396__elem.tn-elem.menu.tn-elem__1348261531175879184342551140:nth-child(17) > div.tn-atom > a'
  }
];

function sendUiEvent(data) {
  fetch('/log_event.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(() => {});
}

document.addEventListener('click', function (e) {
  const path = window.location.pathname;

  for (const cfg of TRACKED_EVENTS) {
    if (cfg.page_match !== '*' && cfg.page_match !== path) continue;

    const el = e.target.closest(cfg.selector);
    if (!el) continue;

    sendUiEvent({
      type: cfg.type,
      name: cfg.event_name,
      page: path + window.location.search,
      selector: cfg.selector,
      text: el.textContent.trim()
    });

    break;
  }
});

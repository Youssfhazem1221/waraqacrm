/**
 * Waraqa mailer: the only job left for Apps Script.
 *
 * The Sheet is now read and written by the waraqa-data Worker (Sheets API).
 * Apps Script stays only because it sends email from your Gmail for free.
 * The data Worker POSTs each new order here with a shared secret, and this
 * script sends the owner alert and the customer receipt. It never opens the
 * Sheet.
 *
 * INSTALL
 * 1. script.google.com ▸ New project (signed in as youssf.hazem1221@gmail.com).
 *    Paste this whole file into Code.gs and Save.
 * 2. ⚙ Project Settings ▸ Script Properties:
 *      MAILER_SECRET = a long random string (same value as the Worker secret)
 *      NOTIFY_EMAILS = optional, extra addresses for new-order alerts, comma-separated
 * 3. Run `sendTestEmail` once from the editor to approve Gmail permission.
 * 4. Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Who has access: Anyone.
 *    Put the /exec URL in the Worker secret MAILER_URL.
 *    To update later: Deploy ▸ Manage deployments ▸ ✏ ▸ New version (keeps the URL).
 *
 * AS DEPLOYED (2026-11-10): project "Waraqa mailer", pushed with clasp from
 * this folder (.clasp.json, git-ignored). The secret is in secret.gs, also
 * git-ignored, which `clasp push` uploads with this file. Keep secret.gs when
 * pushing again: a push replaces every file in the project, so pushing
 * without it leaves the mailer refusing every order unless MAILER_SECRET is
 * set as a Script Property. To update: npx @google/clasp login, then
 * npx @google/clasp push, then npx @google/clasp update-deployment <id>
 * (list ids with npx @google/clasp list-deployments), then clasp logout.
 */

const OWNER_EMAIL = 'youssf.hazem1221@gmail.com';
const STORE_NAME  = 'Waraqa';
const REPLY_TO    = 'youssf.hazem1221@gmail.com';
const CURRENCY    = 'EGP';
const SUPPORT_WA  = '201069237525';
const DELIVERY_DAYS_MIN = 3;
const DELIVERY_DAYS_MAX = 7;
/* Receipts stop when the daily quota (100/day on a free account) drops to
 * this; owner alerts keep going. */
const EMAIL_QUOTA_RESERVE = 15;

function doPost(e){
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return json({ ok: false, error: 'bad json' }); }

  // The script property wins; secret.gs (written by `npm run push` from the
  // git-ignored MAILER_SECRET.local, never committed) is the fallback.
  var expected = PropertiesService.getScriptProperties().getProperty('MAILER_SECRET')
    || (typeof MAILER_SECRET_VALUE === 'string' ? MAILER_SECRET_VALUE : '');
  if (expected.length < 16 || !body || typeof body.secret !== 'string' || !safeEqual(body.secret, expected)) {
    return json({ ok: false, error: 'unauthorized' });
  }
  var o = body.order;
  if (!o || !o.orderId || !o.c) return json({ ok: false, error: 'missing order' });

  var sent = { owner: false, receipt: false };
  try { sendOwnerEmail(o); sent.owner = true; } catch (err) { Logger.log('Owner email error: ' + err); }
  if (o.to && MailApp.getRemainingDailyQuota() > EMAIL_QUOTA_RESERVE) {
    try { sendCustomerReceipt(o); sent.receipt = true; } catch (err) { Logger.log('Receipt error: ' + err); }
  }
  return json({ ok: true, sent: sent });
}

function doGet(){ return json({ ok: true, service: 'waraqa-mailer' }); }

function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeEqual(a, b){
  var h = function(s){
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
      .map(function(x){ return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
  };
  var x = h(a), y = h(b), d = 0;
  for (var i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

/* ===================== Email templates (unchanged from the old backend) ===================== */

function esc(v){
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Readex Pro where the mail app loads web fonts (the receipt links it), then
 * system fonts that cover both scripts. */
const EMAIL_FONT = "'Readex Pro','Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif";
/* The logo as published on the site: white on espresso, one of the approved
 * colourways. Never the name typed in a font (BRAND_GUIDELINES.md §2). */
const LOGO_URL = 'https://waraqa.art/logos/waraqa-1x1-dark-1024.png';

/* The checkout sends a governorate's English name. The Arabic half shows the
 * name the /ar dropdown showed: GOVERNORATES_AR in the storefront's
 * src/lib/translations.ts. Anything else is shown as sent. */
const GOVERNORATES_AR = {
  'Cairo': 'القاهرة', 'Giza': 'الجيزة', 'Alexandria': 'الإسكندرية', 'Qalyubia': 'القليوبية',
  'Dakahlia': 'الدقهلية', 'Sharqia': 'الشرقية', 'Gharbia': 'الغربية', 'Monufia': 'المنوفية',
  'Beheira': 'البحيرة', 'Kafr El Sheikh': 'كفر الشيخ', 'Damietta': 'دمياط', 'Port Said': 'بورسعيد',
  'Ismailia': 'الإسماعيلية', 'Suez': 'السويس', 'North Sinai': 'شمال سيناء', 'South Sinai': 'جنوب سيناء',
  'Beni Suef': 'بني سويف', 'Fayoum': 'الفيوم', 'Minya': 'المنيا', 'Asyut': 'أسيوط', 'Sohag': 'سوهاج',
  'Qena': 'قنا', 'Luxor': 'الأقصر', 'Aswan': 'أسوان', 'Red Sea': 'البحر الأحمر',
  'New Valley': 'الوادي الجديد', 'Matrouh': 'مطروح'
};

function governorateName(g, lang){
  var name = String(g || '').trim();
  return lang === 'ar' ? (GOVERNORATES_AR[name] || name) : name;
}

/* Arabic copy takes Arabic-Indic digits: 380 → ٣٨٠, 10.5 → ١٠٫٥. The same
 * swap as the storefront's src/lib/format.ts. */
function toArabicDigits(v){
  return String(v).replace(/[0-9.]/g, function(ch){
    return ch === '.' ? '٫' : '٠١٢٣٤٥٦٧٨٩'.charAt(Number(ch));
  });
}

/* "EGP 220" in English and «٢٢٠ ج.م» in Arabic, as the storefront writes
 * prices, joined by a no-break space. Rounded to piastres so a line total
 * can't print float dust. */
function money(n, lang){
  var v = Math.round(Number(n || 0) * 100) / 100;
  var amount = v % 1 === 0 ? String(v) : v.toFixed(2);
  return lang === 'ar' ? toArabicDigits(amount) + '\u00A0ج.م' : CURRENCY + '\u00A0' + amount;
}

/* Identifiers (order number, phone, email) always run left to right. The
 * U+200E in front keeps a leading "+" on the left even where a mail app drops
 * the dir attribute: without it the Arabic half printed "201…+". */
function ltrHtml(v){ return '<span dir="ltr">\u200E' + esc(v) + '</span>'; }

/* What the shopper typed keeps the direction it was typed in, so an Arabic
 * name can't trade places with the number next to it. */
function typedHtml(v){ return '<span dir="auto">' + esc(v) + '</span>'; }

/* What the receipt says in one language. In a paragraph, every second part is
 * set in bold; a no-break space keeps the last word off a line of its own. The
 * HTML and the plain-text bodies are both built from this. */
function receiptCopy(lang){
  if (lang === 'ar') return {
    heading: 'شكراً لطلبك من ورقة!',
    orderRef: 'رقم الطلب',
    paragraphs: [
      ['ده إيصال طلبك. هنأكد الطلب معاك على ', 'واتساب والإيميل', ' عشان نراجع معاك التفاصيل وميعاد التسليم، عادةً خلال ' + toArabicDigits(SLA_HOURS) + '\u00A0ساعة.'],
      ['التوصيل بياخد ', 'من ' + toArabicDigits(DELIVERY_DAYS_MIN) + ' لـ ' + toArabicDigits(DELIVERY_DAYS_MAX) + ' أيام عمل', ' بعد التأكيد. والدفع كاش للمندوب عند\u00A0الاستلام.']
    ],
    delivery: 'الشحن',
    free: 'ببلاش',
    total: 'الإجمالي (الدفع عند الاستلام)',
    deliverTo: 'التوصيل إلى',
    notes: 'ملاحظات:',
    listSep: '، ',
    question: 'عندك سؤال عن طلبك؟ كلمنا واتساب على',
    waMessage: 'أهلاً ورقة، لسه عامل طلب رقم'
  };
  return {
    heading: 'Thank you for your order!',
    orderRef: 'Order reference',
    paragraphs: [
      ['This is your receipt. We will confirm your order shortly by ', 'WhatsApp and email', ' to go over your delivery timing, usually within ' + SLA_HOURS + '\u00A0hours.'],
      ['Delivery takes ', DELIVERY_DAYS_MIN + '–' + DELIVERY_DAYS_MAX + ' working days', ' once confirmed. You pay the courier in cash on\u00A0arrival.']
    ],
    delivery: 'Delivery',
    free: 'Free',
    total: 'Total (cash on delivery)',
    deliverTo: 'Delivery to',
    notes: 'Notes:',
    listSep: ', ',
    question: 'Questions about your order? WhatsApp us at',
    waMessage: 'Hi Waraqa, I just placed order'
  };
}

function itemRowsHtml(items, lang){
  var ar = lang === 'ar';
  var cell = 'padding:10px 0;border-bottom:1px solid #C0A286;color:#241C1B;vertical-align:top;';
  return items.map(function(i){
    var line = Number(i.qty) * Number(i.price);
    return '<tr>'
      + '<td style="' + cell + 'text-align:' + (ar ? 'right' : 'left') + ';">' + esc(ar ? (i.nameAr || i.name) : i.name)
        + '\u00A0<strong>×' + esc(ar ? toArabicDigits(i.qty) : i.qty) + '</strong></td>'
      + '<td style="' + cell + 'padding-' + (ar ? 'right' : 'left') + ':12px;text-align:' + (ar ? 'left' : 'right') + ';white-space:nowrap;font-variant-numeric:tabular-nums;">'
        + esc(money(line, lang)) + '</td>'
      + '</tr>';
  }).join('');
}

/* The lines, delivery, total and address in one language. The owner alert
 * shows the English one; the receipt one per language. */
function orderTablesHtml(o, lang){
  var ar = lang === 'ar';
  var t = receiptCopy(lang);
  var c = o.c;
  var start = 'text-align:' + (ar ? 'right' : 'left') + ';';
  var amount = 'padding-' + (ar ? 'right' : 'left') + ':12px;text-align:' + (ar ? 'left' : 'right') + ';white-space:nowrap;font-variant-numeric:tabular-nums;';
  var gov = esc(governorateName(c.governorate, lang));
  var langAttrs = ar ? ' dir="rtl" lang="ar"' : '';
  return ''
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"' + langAttrs + ' style="border-collapse:collapse;font-size:15px;line-height:' + (ar ? '1.7' : '1.5') + ';">'
    +   itemRowsHtml(o.items, lang)
    +   '<tr><td style="padding:10px 0;border-bottom:1px solid #C0A286;color:#241C1B;' + start + '">' + t.delivery + ' (' + gov + ')</td>'
    +     '<td style="padding:10px 0;border-bottom:1px solid #C0A286;color:#241C1B;' + amount + '">' + (o.shipping === 0 ? t.free : esc(money(o.shipping, lang))) + '</td></tr>'
    +   '<tr><td style="padding:12px 0 0;font-weight:bold;color:#4C2224;font-size:17px;' + start + '">' + t.total + '</td>'
    +     '<td style="padding:12px 0 0;font-weight:bold;color:#4C2224;font-size:17px;' + amount + '">' + esc(money(o.total, lang)) + '</td></tr>'
    + '</table>'
    + '<div' + langAttrs + ' style="margin-top:20px;padding:14px 16px;background:#F4ECE0;border:1px solid #C0A286;font-size:15px;line-height:' + (ar ? '1.8' : '1.6') + ';color:#241C1B;' + start + '">'
    +   '<div style="font-weight:bold;color:#4C2224;">' + t.deliverTo + '</div>'
    +   '<div>' + typedHtml(c.name) + '</div>'
    +   '<div>' + ltrHtml(c.phone) + '</div>'
    +   (c.email ? '<div>' + ltrHtml(c.email) + '</div>' : '')
    +   '<div>' + gov + (c.city ? t.listSep + typedHtml(c.city) : '') + '</div>'
    +   '<div>' + typedHtml(c.address) + '</div>'
    +   (o.notes ? '<div style="margin-top:6px;">' + t.notes + ' ' + typedHtml(o.notes) + '</div>' : '')
    + '</div>';
}

/* OWNER_EMAIL plus every valid, distinct address in the NOTIFY_EMAILS script
 * property. */
function ownerRecipients(){
  var fromProperty = String(PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAILS') || '').split(',');
  var seen = {};
  return [OWNER_EMAIL].concat(fromProperty)
    .map(function(e){ return String(e).trim(); })
    .filter(function(e){
      var key = e.toLowerCase();
      if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/.test(e) || seen[key]) return false;
      seen[key] = true;
      return true;
    })
    .join(',');
}

function sendOwnerEmail(o){
  var subject = 'New order ' + o.orderId + ' — ' + o.c.name + ' — ' + money(o.total);
  var html = ''
    + '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#241C1B;">'
    +   '<h2 style="color:#4C2224;margin:0 0 4px;">New order ' + esc(o.orderId) + '</h2>'
    +   '<p style="margin:0 0 16px;color:#241C1B;font-size:13px;">' + esc(o.now) + ' · ' + esc(o.payment) + '</p>'
    +   orderTablesHtml(o, 'en')
    +   '<p style="margin:18px 0 0;font-size:13px;color:#241C1B;">Confirm with the customer by WhatsApp or Phone within 24h.</p>'
    + '</div>';
  MailApp.sendEmail({
    to: ownerRecipients(),
    replyTo: o.to || REPLY_TO,
    name: STORE_NAME,
    subject: subject,
    htmlBody: html
  });
}

/* Run from the editor (function dropdown ▸ sendTestEmail ▸ Run) to check the
 * order alert reaches OWNER_EMAIL and every address in the NOTIFY_EMAILS script
 * property. Sends one sample alert through the real sendOwnerEmail path;
 * nothing touches the sheet. */
function sendTestEmail(){
  var to = ownerRecipients();
  var order = {
    orderId: 'TEST',
    now: Utilities.formatDate(new Date(), 'GMT+2', 'yyyy-MM-dd HH:mm'),
    c: { name: 'Test customer (ignore)', phone: '01000000000', email: '', governorate: 'Cairo', city: 'Nasr City', address: 'Test address' },
    to: '',
    items: [{ name: 'Sample notebook', qty: 1, price: 100 }],
    subtotal: 100,
    shipping: 60,
    total: 160,
    payment: 'Cash on delivery',
    notes: 'This is a test email from sendTestEmail. No order was created.'
  };
  sendOwnerEmail(order);
  Logger.log('Test order alert sent to: ' + to);
  return to;
}

/* One language's half of the receipt: thanks, the order number, what happens
 * next, then the order itself. */
function receiptHalfHtml(o, lang){
  var ar = lang === 'ar';
  var t = receiptCopy(lang);
  var p = 'margin:0 0 12px;font-size:15px;line-height:' + (ar ? '1.8' : '1.6') + ';color:#241C1B;';
  var heading = ar
    ? "font-family:'Reem Kufi'," + EMAIL_FONT + ';font-size:24px;line-height:1.25;'
    : 'font-size:22px;line-height:1.2;letter-spacing:-0.3px;';
  return '<div dir="' + (ar ? 'rtl' : 'ltr') + '" lang="' + lang + '" style="text-align:' + (ar ? 'right' : 'left') + ';">'
    + '<h2 style="margin:0 0 8px;font-weight:bold;color:#4C2224;' + heading + '">' + t.heading + '</h2>'
    + '<p style="' + p + '">' + t.orderRef + ' <strong>' + ltrHtml(o.orderId) + '</strong></p>'
    + t.paragraphs.map(function(parts){
        return '<p style="' + p + '">' + parts.map(function(s, k){
          return k % 2 ? '<strong style="white-space:nowrap;">' + esc(s) + '</strong>' : esc(s);
        }).join('') + '</p>';
      }).join('')
    + '<div style="padding-top:8px;">' + orderTablesHtml(o, lang) + '</div>'
    + '</div>';
}

function receiptHtml(o, langs, subject){
  var cell = 'font-family:' + EMAIL_FONT + ';color:#241C1B;';
  var footer = langs.map(function(lang){
    var ar = lang === 'ar';
    var t = receiptCopy(lang);
    var wa = 'https://wa.me/' + SUPPORT_WA + '?text=' + encodeURIComponent(t.waMessage + ' ' + o.orderId);
    return '<p dir="' + (ar ? 'rtl' : 'ltr') + '" lang="' + lang + '" style="margin:0 0 6px;text-align:center;font-size:15px;line-height:1.7;color:#241C1B;">'
      + t.question + '\u00A0<a href="' + esc(wa) + '" style="color:#4C2224;text-decoration:underline;">' + ltrHtml('+' + SUPPORT_WA) + '</a>'
      + '</p>';
  }).join('');
  return '<!DOCTYPE html>'
    + '<html lang="' + langs[0] + '"><head>'
    +   '<meta charset="utf-8">'
    +   '<meta name="viewport" content="width=device-width, initial-scale=1">'
    +   '<meta name="color-scheme" content="light">'
    +   '<title>' + esc(subject) + '</title>'
    // Outlook on Windows can't load web fonts and may drop to Times New Roman
    // when it sees one, so it gets the system fonts instead.
    +   '<!--[if !mso]><!--><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;600;700&amp;family=Reem+Kufi:wght@600&amp;display=swap"><!--<![endif]-->'
    +   "<!--[if mso]><style>table,td,div,p,h2,a,span{font-family:'Segoe UI',Tahoma,Arial,sans-serif !important;}</style><![endif]-->"
    + '</head>'
    + '<body style="margin:0;padding:0;background:#F4ECE0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4ECE0;">'
    + '<tr><td align="center" style="padding:24px 12px;">'
    +   '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#FFFFFF;border:1px solid #C0A286;">'
    +     '<tr><td align="center" style="padding:28px 24px 0;' + cell + '">'
    +       '<img src="' + LOGO_URL + '" width="64" height="64" alt="ورقة · Waraqa" style="display:block;width:64px;height:64px;border:0;' + cell + 'font-size:15px;">'
    +     '</td></tr>'
    +     '<tr><td style="padding:24px 24px 0;' + cell + '">' + receiptHalfHtml(o, langs[0]) + '</td></tr>'
    +     '<tr><td style="padding:28px 24px 0;"><hr style="border:none;border-top:1px solid #C0A286;margin:0;"></td></tr>'
    +     '<tr><td style="padding:28px 24px 0;' + cell + '">' + receiptHalfHtml(o, langs[1]) + '</td></tr>'
    +     '<tr><td style="padding:28px 24px 26px;' + cell + '">' + footer + '</td></tr>'
    +   '</table>'
    + '</td></tr>'
    + '</table>'
    + '</body></html>';
}

/* The same receipt as plain text, for mail apps that show no HTML. */
function receiptText(o, langs){
  return langs.map(function(lang){
    var ar = lang === 'ar';
    var t = receiptCopy(lang);
    var c = o.c;
    var lines = [t.heading, t.orderRef + ': ' + o.orderId, ''];
    t.paragraphs.forEach(function(parts){ lines.push(parts.join('')); });
    lines.push('');
    o.items.forEach(function(i){
      lines.push((ar ? (i.nameAr || i.name) : i.name) + '\u00A0×' + (ar ? toArabicDigits(i.qty) : i.qty)
        + ': ' + money(Number(i.qty) * Number(i.price), lang));
    });
    lines.push(t.delivery + ' (' + governorateName(c.governorate, lang) + '): ' + (o.shipping === 0 ? t.free : money(o.shipping, lang)));
    lines.push(t.total + ': ' + money(o.total, lang));
    lines.push('', t.deliverTo + ':', c.name, '\u200E' + c.phone);
    if (c.email) lines.push(c.email);
    lines.push(governorateName(c.governorate, lang) + (c.city ? t.listSep + c.city : ''), c.address);
    if (o.notes) lines.push(t.notes + ' ' + o.notes);
    lines.push('', t.question + ' \u200E+' + SUPPORT_WA);
    return lines.join('\n');
  }).join('\n\n--------\n\n');
}

function sendCustomerReceipt(o){
  if (!o.to) return;
  // The shopper's language first (checkout sends it); English when missing.
  var langs = o.lang === 'ar' ? ['ar', 'en'] : ['en', 'ar'];
  var subjects = { en: 'Your Waraqa order ' + o.orderId, ar: 'إيصال طلبك من ورقة' };
  var subject = subjects[langs[0]] + ' · ' + subjects[langs[1]];

  MailApp.sendEmail({
    to: o.to,
    replyTo: REPLY_TO,
    name: STORE_NAME,
    subject: subject,
    body: receiptText(o, langs),
    htmlBody: receiptHtml(o, langs, subject)
  });
}


/**
 * 시뮬라티오 랩 방문 기록 (구글 시트 + Apps Script)
 * - 사이트가 페이지를 볼 때마다 POST로 한 줄을 보낸다 → 'visits' 시트에 추가
 * - 관리자 화면이 비밀번호와 함께 GET으로 요청하면 기간 안의 기록을 JSON으로 돌려준다
 * - 버전 2: 'view'(페이지를 연 순간)와 'leave'(떠날 때 머문 시간·실험을 돌렸는지)를 구분해 기록한다
 * - 비밀번호: 프로젝트 설정 → 스크립트 속성에 ADMIN_PW 를 넣으면 그 값, 없으면 '0001'
 * - IP 주소는 저장하지 않는다 (나라 코드만)
 */
var SHEET = 'visits';
var HEAD = ['time', 'country', 'page', 'lang', 'device', 'first_today', 'referrer', 'type', 'secs', 'ran', 'returning'];
var VERSION = 4;   // 4: 새 실험 알림 이메일 신청(subscribers 시트) / 2: 머문 시간(leave)·실험 실행 여부·다시 온 방문자 기록 / 3: '먼저 예상해 보세요' 투표(predictions 시트)
var PSHEET = 'predictions';
var SSHEET = 'subscribers';
function ssheet_() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(SSHEET);
  if (!sh) { sh = ss.insertSheet(SSHEET); sh.appendRow(['time', 'email', 'lang', 'last_notified']); sh.setFrozenRows(1); }
  return sh;
}
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function psheet_() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(PSHEET);
  if (!sh) { sh = ss.insertSheet(PSHEET); sh.appendRow(['time', 'slug', 'choice', 'country', 'device']); sh.setFrozenRows(1); }
  return sh;
}
// 실험별 선택지 집계 {slug: [a, b, c]} (1분 동안 캐시)
function predCounts_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('pc');
  if (hit) return JSON.parse(hit);
  var v = psheet_().getDataRange().getValues(), out = {};
  for (var i = 1; i < v.length; i++) { var s = String(v[i][1]), c = Number(v[i][2]) || 0; if (!out[s]) out[s] = [0, 0, 0, 0, 0]; if (c >= 0 && c < 5) out[s][c]++; }
  cache.put('pc', JSON.stringify(out), 60);
  return out;
}

function sheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  if (sh.getLastColumn() < HEAD.length) sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);   // 예전 시트에 새 칸 머리글 추가
  return sh;
}
function pw_() { return PropertiesService.getScriptProperties().getProperty('ADMIN_PW') || '0001'; }
function clean_(v, n) { return String(v == null ? '' : v).replace(/[\r\n\t]/g, ' ').slice(0, n); }

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var cc = clean_(d.country, 2).toUpperCase().replace(/[^A-Z]/g, '') || 'ZZ';
    if (d.type === 'subscribe') {   // 새 실험 알림 신청: 이메일 형식을 확인하고, 이미 있으면 다시 넣지 않는다
      var em = String(d.email || '').trim().toLowerCase().slice(0, 120);
      if (EMAIL_RE.test(em) && d.consent) {
        var sh = ssheet_(), last = sh.getLastRow(), have = last > 1 ? sh.getRange(2, 2, last - 1, 1).getValues().map(function (r) { return String(r[0]).toLowerCase(); }) : [];
        if (have.indexOf(em) < 0) sh.appendRow([new Date(), em, clean_(d.lang, 5), '']);
      }
      return ContentService.createTextOutput('ok');
    }
    if (d.type === 'predict') {   // 예상 투표: 한 줄 추가
      CacheService.getScriptCache().remove('pc');   // 집계 캐시를 비워 방금 한 투표가 바로 보이게 한다
      var ps = psheet_(); ps.appendRow([new Date(), clean_(d.page, 60), Math.max(0, Math.min(4, Number(d.choice) || 0)), cc, clean_(d.device, 10)]);
      return ContentService.createTextOutput('ok');
    }
    var lock = LockService.getScriptLock(); lock.waitLock(5000);
    var leave = d.type === 'leave';
    sheet_().appendRow([new Date(), cc, clean_(d.page, 120), clean_(d.lang, 5), clean_(d.device, 10), (!leave && d.first) ? 1 : 0, clean_(d.ref, 80),
      leave ? 'leave' : 'view', leave ? Math.min(1800, Number(d.secs) || 0) : '', leave ? (d.ran ? 1 : 0) : '', d.returning ? 1 : 0]);
    lock.releaseLock();
  } catch (err) {}
  return ContentService.createTextOutput('ok');
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var out = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  if (p.a === 'v') return out({ v: VERSION });
  if (p.a === 'pred') {   // 한 실험의 예상 분포 (집계만, 비밀번호 없이)
    var all = predCounts_(), c = all[String(p.slug || '')] || [0, 0, 0, 0, 0];
    return out({ counts: c.slice(0, Math.max(2, Number(p.n) || 3)) });
  }   // 사이트가 어떤 버전인지 묻는다 (비밀번호 필요 없음)
  if (p.pw !== pw_()) return out({ ok: false });
  if (p.a === 'check') return out({ ok: true, v: VERSION });
  if (p.a === 'subs') return out({ ok: true, count: Math.max(0, ssheet_().getLastRow() - 1) });   // 관리자: 알림 신청자 수 (이메일은 시트에서만 본다)
  if (p.a === 'preds') return out({ ok: true, preds: predCounts_() });   // 관리자: 모든 실험의 예상 분포
  var days = Math.min(400, Number(p.days) || 30);
  var since = new Date(Date.now() - days * 864e5);
  var v = sheet_().getDataRange().getValues(), rows = [];
  for (var i = 1; i < v.length; i++) {
    var t = v[i][0] instanceof Date ? v[i][0] : new Date(v[i][0]);
    if (t >= since) rows.push([t.toISOString(), v[i][1], v[i][2], v[i][3], v[i][4], Number(v[i][5]) || 0, v[i][6], v[i][7] || 'view', Number(v[i][8]) || 0, Number(v[i][9]) || 0, Number(v[i][10]) || 0]);
  }
  return out({ ok: true, rows: rows, total: v.length - 1, since: since.toISOString() });
}


/**
 * 새 실험 알림 메일 보내기 — Apps Script에서 이 함수를 골라 ▶ 실행하면 subscribers 시트의 모든 신청자에게 보낸다.
 * 보내기 전에 아래 NOTICE_SUBJECT / NOTICE_BODY를 새 실험에 맞게 고친다. (일반 Gmail 계정은 하루 약 100통까지)
 * 같은 사람에게 같은 날 두 번 보내지 않도록 last_notified 칸에 날짜를 적는다.
 */
var NOTICE_SUBJECT = '[시뮬라티오 랩] 새 실험이 나왔어요';
var NOTICE_BODY = '안녕하세요, 시뮬라티오 랩입니다.\n\n새 실험이 올라왔어요. 직접 돌려 보세요:\nhttps://heekeunlee.github.io/simulatiolab/\n\n이 메일을 더 받고 싶지 않으시면 이 메일에 "수신거부"라고 회신해 주세요. 바로 삭제해 드립니다.';
function sendNotice() {
  var sh = ssheet_(), last = sh.getLastRow();
  if (last < 2) return;
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var rows = sh.getRange(2, 1, last - 1, 4).getValues(), sent = 0;
  for (var i = 0; i < rows.length && sent < 90; i++) {
    var em = String(rows[i][1]).trim();
    if (!em || String(rows[i][3]).indexOf(today) === 0) continue;
    try { MailApp.sendEmail(em, NOTICE_SUBJECT, NOTICE_BODY, { name: '시뮬라티오 랩' }); sh.getRange(i + 2, 4).setValue(today); sent++; } catch (err) {}
  }
  Logger.log('보냈어요: ' + sent + '명');
}

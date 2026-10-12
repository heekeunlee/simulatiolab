/**
 * 시뮬라티오 랩 방문 기록 (구글 시트 + Apps Script)
 * - 사이트가 페이지를 볼 때마다 POST로 한 줄을 보낸다 → 'visits' 시트에 추가
 * - 관리자 화면이 비밀번호와 함께 GET으로 요청하면 기간 안의 기록을 JSON으로 돌려준다
 * - 비밀번호: 프로젝트 설정 → 스크립트 속성에 ADMIN_PW 를 넣으면 그 값, 없으면 '0001'
 * - IP 주소는 저장하지 않는다 (나라 코드만)
 */
var SHEET = 'visits';
var HEAD = ['time', 'country', 'page', 'lang', 'device', 'first_today', 'referrer'];

function sheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}
function pw_() { return PropertiesService.getScriptProperties().getProperty('ADMIN_PW') || '0001'; }
function clean_(v, n) { return String(v == null ? '' : v).replace(/[\r\n\t]/g, ' ').slice(0, n); }

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var cc = clean_(d.country, 2).toUpperCase().replace(/[^A-Z]/g, '') || 'ZZ';
    var lock = LockService.getScriptLock(); lock.waitLock(5000);
    sheet_().appendRow([new Date(), cc, clean_(d.page, 120), clean_(d.lang, 5), clean_(d.device, 10), d.first ? 1 : 0, clean_(d.ref, 80)]);
    lock.releaseLock();
  } catch (err) {}
  return ContentService.createTextOutput('ok');
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var out = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  if (p.pw !== pw_()) return out({ ok: false });
  if (p.a === 'check') return out({ ok: true });
  var days = Math.min(400, Number(p.days) || 30);
  var since = new Date(Date.now() - days * 864e5);
  var v = sheet_().getDataRange().getValues(), rows = [];
  for (var i = 1; i < v.length; i++) {
    var t = v[i][0] instanceof Date ? v[i][0] : new Date(v[i][0]);
    if (t >= since) rows.push([t.toISOString(), v[i][1], v[i][2], v[i][3], v[i][4], Number(v[i][5]) || 0, v[i][6]]);
  }
  return out({ ok: true, rows: rows, total: v.length - 1, since: since.toISOString() });
}

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
var VERSION = 3;   // 2: 머문 시간(leave)·실험 실행 여부·다시 온 방문자 기록 / 3: '먼저 예상해 보세요' 투표(predictions 시트)
var PSHEET = 'predictions';
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
    if (d.type === 'predict') {   // 예상 투표: 한 줄 추가
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

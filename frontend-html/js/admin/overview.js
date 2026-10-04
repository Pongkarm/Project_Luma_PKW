/*
 * admin/overview.js — หน้าภาพรวม (GET /admin/stats)
 *
 * ฟังก์ชันในไฟล์นี้:
 *   drawOverview()     ตัวเลขสรุป 6 ช่อง + สาเหตุที่ล้มเหลว + กราฟจำนวนงานต่อวัน
 *
 * เชื่อมกับ:
 *   ใช้ของ     main.js (main, header, skeleton, unavailable), api.js (apiRequest), ui.js (escapeHtml)
 *   backend    GET /admin/stats?days=14
 */

/* ตัวเลขสรุป 6 ช่อง (กดเพื่อดูรายละเอียดได้) + สาเหตุที่ล้มเหลว + กราฟจำนวนงานต่อวัน */
async function drawOverview() {
  const days = 14;
  main(header('Overview', 'Last ' + days + ' days unless stated otherwise') + skeleton(3, 72));
  let s;
  try {
    s = await apiRequest('/admin/stats?days=' + days);
  } catch (error) {
    return main(header('Overview') + unavailable(error));
  }

  const figure = (label, value, link, tone) => {
    const body = '<span class="adm-fig__v' + (tone ? ' adm-fig__v--' + tone : '') + '">' + value + '</span><span class="adm-fig__l">' + label + '</span>';
    return link ? '<a class="adm-fig adm-fig--link" href="' + link + '">' + body + '</a>' : '<div class="adm-fig">' + body + '</div>';
  };
  const failures = s.failures.length
    ? '<ul class="adm-fails">' + s.failures.map((f) => '<li><span class="adm-fails__n">' + f.count + '</span><span class="adm-fails__msg" title="' + escapeHtml(f.message) + '">' + escapeHtml(f.message) + '</span></li>').join('') + '</ul>'
    : '<p class="adm-panel__empty">No failed runs in ' + days + ' days.</p>';
  // กราฟแท่งจำนวนงานต่อวัน — สูงสุด = 100%
  const max = Math.max(1, ...s.per_day.map((p) => p.total));
  const bars = '<div class="adm-bars" role="img" aria-label="Runs per day">' +
    s.per_day.map((p) => '<span class="adm-bars__b" style="height: ' + Math.max(4, (p.total / max) * 100) + '%" title="' + p.day.slice(0, 10) + ' — ' + p.total + '"></span>').join('') + '</div>';

  main(
    header('Overview', 'Last ' + days + ' days unless stated otherwise') +
    '<div class="adm-figs">' +
    figure('Users', s.total_users, '#users') +
    figure('Generated in ' + days + 'd', s.active_users, '#users?active_within=14') +
    figure('Disabled', s.disabled_users, '#users?status=disabled', s.disabled_users > 0 ? 'warn' : '') +
    figure('Runs 24h', s.generations_24h, '#activity') +
    figure('Success', Math.round(s.success_rate * 100) + '%', '#activity', s.success_rate < 0.9 ? 'warn' : 'ok') +
    figure('Median time', s.median_duration_seconds === null ? '—' : s.median_duration_seconds + 's') +
    '</div>' +
    '<div class="adm-panels">' +
    '<section class="adm-panel"><h2>Failures</h2>' + failures + '</section>' +
    '<section class="adm-panel"><h2>Usage</h2>' + bars +
    '<ul class="adm-mix">' + s.by_task.map((t) => '<li><span>' + escapeHtml(t.name) + '</span><span class="mono">' + t.count + '</span></li>').join('') + '</ul></section>' +
    '</div>',
  );
}

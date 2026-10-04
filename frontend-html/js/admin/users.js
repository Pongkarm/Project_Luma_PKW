/*
 * admin/users.js — รายชื่อผู้ใช้ ค้นหา/กรอง และแผงรายละเอียดของแต่ละคน
 *
 * ปิด/เปิดบัญชีต้องพิมพ์เหตุผล ซึ่ง backend เก็บลง audit log ทุกครั้ง
 */

let usersOnPage = [];

/* วาดช่องค้นหา/ตัวกรอง (ค่าเก็บไว้ใน # ของที่อยู่เว็บ ลิงก์ส่งต่อได้) แล้วโหลดตาราง */
async function drawUsers() {
  const params = hashParams();
  const filters =
    '<div class="adm-filters">' +
    '<label class="adm-search">' + icon('sliders', 14) +
    '<input class="input" type="search" id="user-q" placeholder="Search username or email" aria-label="Search users" value="' + escapeHtml(params.get('q') || '') + '" /></label>' +
    '<select class="input select" id="user-status" aria-label="Account status">' +
    '<option value="">Any status</option><option value="active">Active</option><option value="disabled">Disabled</option></select>' +
    '<select class="input select" id="user-active" aria-label="Recent activity">' +
    '<option value="">Any activity</option><option value="7">Generated in 7 days</option><option value="14">Generated in 14 days</option><option value="30">Generated in 30 days</option><option value="0">Never generated</option></select>' +
    '</div>';
  main(header('Users', '&nbsp;') + filters + '<div id="users-body">' + skeleton(8) + '</div>');
  $('user-status').value = params.get('status') || '';
  $('user-active').value = params.get('active_within') || '';

  // เปลี่ยนตัวกรอง → เขียนลงที่อยู่เว็บ แล้ววาดใหม่ (ช่องค้นหารอพิมพ์เสร็จ 0.3 วินาที)
  const apply = () => {
    const next = new URLSearchParams();
    if ($('user-q').value.trim()) next.set('q', $('user-q').value.trim());
    if ($('user-status').value) next.set('status', $('user-status').value);
    if ($('user-active').value) next.set('active_within', $('user-active').value);
    history.replaceState(null, '', '#users' + (next.toString() ? '?' + next : ''));
    loadUsers();
  };
  let timer;
  $('user-q').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 300);
  });
  $('user-status').addEventListener('change', apply);
  $('user-active').addEventListener('change', apply);
  loadUsers();
}

/* GET /admin/users ตามตัวกรองปัจจุบัน แล้ววาดตาราง (คลิกแถว = เปิดแผงรายละเอียด) */
async function loadUsers() {
  const params = hashParams();
  params.set('page_size', '100');
  let data;
  try {
    data = await apiRequest('/admin/users?' + params);
  } catch (error) {
    $('users-body').innerHTML = unavailable(error);
    return;
  }
  usersOnPage = data.items;
  document.querySelector('.adm__sub').textContent = data.total + ' total' + (me.role === 'reviewer' ? ' · emails partly hidden at your access level' : '');

  if (data.items.length === 0) {
    const filtered = [...hashParams().keys()].length > 0;
    $('users-body').innerHTML = notice('info',
      filtered ? 'No users match these filters' : 'No users have registered yet',
      filtered ? 'Clearing the filters will show everyone.' : 'People who sign up will appear here.',
      filtered ? '<a class="btn btn--secondary" href="#users">' + icon('refresh', 14) + 'Clear filters</a>' : '');
    return;
  }

  $('users-body').innerHTML =
    '<div class="adm-tablewrap"><table class="adm-table"><thead><tr>' +
    '<th>User</th><th>Email</th><th>Status</th><th>Last generated</th><th class="num">Runs</th><th class="num">Failed</th>' +
    '</tr></thead><tbody>' +
    data.items.map((u, index) =>
      '<tr data-index="' + index + '" tabindex="0"><td>' + escapeHtml(u.username) + (u.admin_role ? '<span class="adm-tag">' + u.admin_role + '</span>' : '') + '</td>' +
      '<td class="mono">' + escapeHtml(u.email) + '</td>' +
      '<td><span class="adm-st adm-st--' + (u.is_active ? 'on' : 'off') + '">' + (u.is_active ? 'active' : 'disabled') + '</span></td>' +
      '<td>' + formatDate(u.last_generated_at) + '</td><td class="num">' + u.generation_count + '</td><td class="num">' + (u.failure_count || '') + '</td></tr>',
    ).join('') +
    '</tbody></table></div>';

  const open = (event) => {
    const row = event.target.closest('tr[data-index]');
    if (row) openDrawer(usersOnPage[Number(row.dataset.index)]);
  };
  $('users-body').querySelector('tbody').addEventListener('click', open);
  $('users-body').querySelector('tbody').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') open(event);
  });
}

/* แผงด้านขวาของผู้ใช้หนึ่งคน: ข้อมูล งานล่าสุด และปุ่มปิด/เปิดบัญชี */
async function openDrawer(user) {
  const scrim = document.createElement('div');
  scrim.className = 'adm-scrim';
  const drawer = document.createElement('aside');
  drawer.className = 'adm-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');

  const close = () => {
    document.removeEventListener('keydown', onKey);
    scrim.remove();
    drawer.remove();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', close);

  const facts = [
    ['Email', '<span class="mono">' + escapeHtml(user.email) + '</span>'],
    ['Status', user.is_active ? 'Active' : 'Disabled'],
    ['Joined', formatDate(user.created_at)],
    ['Last sign-in', user.last_login_at ? formatDate(user.last_login_at) : 'Not since recording began'],
    ['Runs', user.generation_count + ' total · ' + user.failure_count + ' failed'],
  ];
  drawer.innerHTML =
    '<header><h2>' + escapeHtml(user.username) + '</h2>' +
    '<button type="button" class="btn btn--sm btn--ghost" data-close>' + icon('close', 14) + 'Close</button></header>' +
    '<dl class="adm-facts">' + facts.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('') + '</dl>' +
    '<h3>Recent runs</h3><div id="drawer-runs">' + skeleton(4, 28) + '</div>' +
    '<div class="adm-act" id="drawer-act"></div>';
  document.body.append(scrim, drawer);
  drawer.querySelector('[data-close]').addEventListener('click', close);
  drawer.querySelector('[data-close]').focus();

  drawStatusControl(user, close);

  try {
    const detail = await apiRequest('/admin/users/' + user.id);
    $('drawer-runs').innerHTML = detail.recent_runs.length
      ? '<ul class="adm-runs">' + detail.recent_runs.map((r) =>
          '<li><span class="adm-st adm-st--' + (r.status === 'failed' ? 'off' : 'on') + '">' + r.status + '</span>' +
          '<span class="adm-runs__meta mono">' + r.task_type + ' · ' + r.width + '×' + r.height + '</span>' +
          '<span class="adm-runs__when">' + formatDate(r.created_at) + '</span></li>').join('') + '</ul>'
      : '<p class="adm-panel__empty">This user has not generated anything.</p>';
  } catch (error) {
    $('drawer-runs').innerHTML = '<p class="adm-panel__empty">' + escapeHtml(error.message) + '</p>';
  }
}

/* ปุ่มปิด/เปิดบัญชี — ต้องพิมพ์เหตุผลอย่างน้อย 3 ตัวอักษร (บันทึกลง audit log) */
function drawStatusControl(user, closeDrawer) {
  const box = $('drawer-act');
  if (!me.can_manage_users) {
    box.innerHTML = '<p class="adm-soon">Your access level can view accounts but not change them.</p>';
    return;
  }
  const disabling = user.is_active;
  const blocked = user.id === me.user_id ? 'You cannot disable your own account.' : user.admin_role === 'owner' ? 'An owner account cannot be disabled.' : null;

  box.innerHTML =
    '<div id="act-alert" hidden></div>' +
    '<button type="button" class="btn ' + (disabling ? 'btn--danger' : 'btn--secondary') + '" id="act-open"' + (blocked ? ' disabled title="' + blocked + '"' : '') + '>' +
    icon(disabling ? 'lock' : 'lockOpen', 14) + (disabling ? 'Disable account' : 'Enable account') + '</button>' +
    '<div id="act-form" class="contents" hidden>' +
    '<p class="adm-act__ask">' + escapeHtml(disabling
      ? user.username + ' will not be able to sign in until an admin enables the account again. Their images are kept.'
      : user.username + ' will be able to sign in again.') + '</p>' +
    '<label class="adm-act__reason"><span>Reason (recorded in the audit log)</span>' +
    '<input class="input" id="act-reason" placeholder="' + (disabling ? 'repeated failed generations' : 'issue resolved') + '" /></label>' +
    '<div class="adm-act__row"><button type="button" class="btn ' + (disabling ? 'btn--danger' : 'btn--primary') + '" id="act-confirm" disabled>' + (disabling ? 'Disable' : 'Enable') + '</button>' +
    '<button type="button" class="btn btn--ghost" id="act-cancel">Cancel</button></div></div>' +
    (blocked ? '<p class="adm-soon">' + blocked + '</p>' : '');

  $('act-open').addEventListener('click', () => {
    $('act-open').hidden = true;
    $('act-form').hidden = false;
    $('act-reason').focus();
  });
  $('act-cancel').addEventListener('click', () => {
    $('act-open').hidden = false;
    $('act-form').hidden = true;
  });
  $('act-reason').addEventListener('input', () => {
    $('act-confirm').disabled = $('act-reason').value.trim().length < 3;
  });
  $('act-confirm').addEventListener('click', async () => {
    $('act-confirm').disabled = true;
    try {
      await apiRequest('/admin/users/' + user.id + '/status', {
        method: 'PATCH',
        json: { is_active: !user.is_active, reason: $('act-reason').value.trim() },
      });
      closeDrawer();
      loadUsers();
    } catch (error) {
      showAlert($('act-alert'), error.message || 'The change was refused.');
      $('act-confirm').disabled = false;
    }
  });
}

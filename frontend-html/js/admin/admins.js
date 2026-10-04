/*
 * admin/admins.js — ผู้มีสิทธิ์ดูแลระบบ: เปลี่ยน/ถอน/ให้สิทธิ์ (เฉพาะ owner)
 */

/* ตารางผู้มีสิทธิ์ + ฟอร์มให้สิทธิ์ใหม่ (โหลดรายชื่อสิทธิ์และผู้ใช้พร้อมกัน) */
async function drawAdmins() {
  main(header('Admins', '&nbsp;') + skeleton(3));
  let roles;
  let users;
  try {
    [roles, users] = await Promise.all([apiRequest('/admin/roles'), apiRequest('/admin/users?page_size=100')]);
  } catch (error) {
    return main(header('Admins') + unavailable(error));
  }
  const owners = roles.filter((r) => r.role === 'owner').length;
  const holders = new Set(roles.map((r) => r.user_id));
  const free = users.items.filter((u) => !holders.has(u.id));
  const options = (selected) => ROLES.map((r) => '<option value="' + r + '"' + (r === selected ? ' selected' : '') + '>' + r + '</option>').join('');

  const rows = roles.map((r) => {
    const self = r.user_id === me.user_id;
    // ห้ามถอน owner คนสุดท้าย (จะไม่มีใครให้สิทธิ์คืนได้) และห้ามลดสิทธิ์ตัวเอง
    const locked = r.role === 'owner' && owners <= 1 ? 'The last owner cannot be removed — nobody could grant the role back.' : self ? 'You cannot lower your own role.' : '';
    const lock = locked ? ' disabled title="' + locked + '"' : '';
    return '<tr><td>' + escapeHtml(r.username) + (self ? '<span class="adm-tag">you</span>' : '') + '</td>' +
      '<td><select class="input select" data-role-for="' + r.user_id + '" aria-label="Role for ' + escapeHtml(r.username) + '"' + lock + '>' + options(r.role) + '</select></td>' +
      '<td>' + escapeHtml(r.granted_by_username || 'set up at install') + '</td><td>' + formatDate(r.granted_at) + '</td>' +
      '<td><button type="button" class="btn btn--sm btn--ghost" data-revoke="' + r.user_id + '"' + lock + '>Revoke</button></td></tr>';
  });

  main(
    header('Admins', roles.length + ' people hold a role · only an owner can change this') +
    '<div id="admins-alert" hidden></div>' +
    '<p class="adm-desktoponly">Granting and revoking roles is a desktop task. On a narrow screen the table scrolls sideways and the controls end up out of reach, so open this page on a computer.</p>' +
    '<div class="adm-tablewrap"><table class="adm-table"><thead><tr><th>Person</th><th>Role</th><th>Granted by</th><th>Since</th><th aria-label="Actions"></th></tr></thead>' +
    '<tbody id="roles-body">' + rows.join('') + '</tbody></table></div>' +
    '<div class="adm-act">' +
    '<button type="button" class="btn btn--secondary" id="grant-open">' + icon('user', 14) + 'Grant a role</button>' +
    '<div id="grant-form" class="contents" hidden>' +
    '<p class="adm-act__ask">Roles are granted to people who already have a LUMA account.</p>' +
    '<div class="adm-act__row">' +
    '<select class="input select" id="grant-user" aria-label="Person"><option value="">Choose a person…</option>' +
    free.map((u) => '<option value="' + u.id + '">' + escapeHtml(u.username) + '</option>').join('') + '</select>' +
    '<select class="input select" id="grant-role" aria-label="Role">' + options('reviewer') + '</select>' +
    '<button type="button" class="btn btn--primary" id="grant-confirm" disabled>Grant</button>' +
    '<button type="button" class="btn btn--ghost" id="grant-cancel">Cancel</button>' +
    '</div></div></div>',
  );

  const change = async (userId, role) => {
    showAlert($('admins-alert'), '');
    try {
      if (role) await apiRequest('/admin/roles', { method: 'POST', json: { user_id: userId, role } });
      else await apiRequest('/admin/roles/' + userId, { method: 'DELETE' });
      drawAdmins();
    } catch (error) {
      showAlert($('admins-alert'), error.message || 'The change was refused.');
    }
  };
  $('roles-body').addEventListener('change', (event) => {
    if (event.target.dataset.roleFor) change(event.target.dataset.roleFor, event.target.value);
  });
  $('roles-body').addEventListener('click', (event) => {
    const button = event.target.closest('[data-revoke]');
    if (button && !button.disabled) change(button.dataset.revoke, null);
  });
  $('grant-open').addEventListener('click', () => {
    $('grant-open').hidden = true;
    $('grant-form').hidden = false;
  });
  $('grant-cancel').addEventListener('click', () => {
    $('grant-open').hidden = false;
    $('grant-form').hidden = true;
  });
  $('grant-user').addEventListener('change', () => {
    $('grant-confirm').disabled = !$('grant-user').value;
  });
  $('grant-confirm').addEventListener('click', () => change($('grant-user').value, $('grant-role').value));
}

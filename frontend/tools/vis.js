(() => {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const bad = [];
  for (const el of document.querySelectorAll('button, a, input, select, textarea, [role="button"]')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('[hidden]')) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24);
    // หลุดขอบซ้าย/ขวา หรือจางจนมองไม่เห็น
    const offX = b.right < 0 || b.left > vw;
    const clipped = b.left < -2 || b.right > vw + 2;
    const invisible = Number(cs.opacity) < 0.15;
    const tiny = b.width < 8 || b.height < 8;
    if (offX || clipped || invisible || tiny) {
      bad.push({
        label, cls: (el.className || '').toString().slice(0, 26),
        why: offX ? 'นอกจอ' : clipped ? 'ถูกตัดขอบ' : invisible ? `opacity ${cs.opacity}` : 'เล็กเกินไป',
        box: `${Math.round(b.left)}..${Math.round(b.right)} / ${Math.round(b.width)}x${Math.round(b.height)}`,
      });
    }
  }
  return { vw, vh, bad: bad.slice(0, 8), total: document.querySelectorAll('button,a,input,select,textarea').length };
})()

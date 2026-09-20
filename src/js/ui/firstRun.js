/**
 * FirstRun — a short, skippable first-launch flow (spec 55).
 * Welcome → Theme → Folder(s) → Scan → Done. No walls of onboarding.
 */
import { icon } from './icons.js';
import { esc, statPill } from './primitives.js';
import { isDesktop, api } from '../bridge.js';
import { themeManager } from '../services/theme/ThemeManager.js';

const THEMES = [
  { id: 'midnight-neon', name: 'ليل ميدناي', hint: 'الافتراضية — نيلي مُتحكَّم به' },
  { id: 'neon-lime', name: 'لايم النيون', hint: 'فحمي + نيون لايم' },
  { id: 'amoled', name: 'أسود نقي', hint: 'OLED — تباين مطلق' },
  { id: 'cinema-noir', name: 'نوار سينمائي', hint: 'كلاسيكي داكن' },
  { id: 'aurora', name: 'شفق', hint: 'لمسة سماوية' },
];

export async function maybeFirstRun(router) {
  if (localStorage.getItem('zpopcorn-first-run') === '1') return;
  let count = 0;
  try { count = (await api?.library?.stats?.()) ? ((await api.library.stats()).movies || 0) : 0; } catch { /* fallback */ }
  try {
    if (!isDesktop) {
      const { db } = await import('../services/storage/Database.js');
      count = ((await db.count('movies').catch(() => 0)) + (await db.count('tvshows').catch(() => 0)));
    }
  } catch { /* ok */ }
  if (count > 0) { localStorage.setItem('zpopcorn-first-run', '1'); return; }
  openFirstRun(router);
}

function openFirstRun(router) {
  const overlay = document.createElement('div');
  overlay.className = 'z-onb';
  overlay.id = 'z-firstrun';
  let step = 0;
  const chosen = { theme: 'midnight-neon', paths: [], scan: null };

  const steps = 4;
  const render = () => {
    overlay.querySelector('.card').innerHTML = `
      <div class="steps">${Array.from({ length: steps }, (_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
      ${[stepWelcome, stepTheme, stepFolders, stepDone][step](chosen, overlay, next)}
    `;
    bind(overlay);
  };
  const next = () => { step = Math.min(steps - 1, step + 1); render(); };
  const finish = async () => {
    localStorage.setItem('zpopcorn-first-run', '1');
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity var(--dur-3)';
    setTimeout(() => overlay.remove(), 320);
    if (isDesktop && chosen.paths.length) {
      router?.navigate('/inbox');
      window.dispatchEvent(new CustomEvent('zpopcorn:run-scan'));
    }
  };

  function bind(root) {
    root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const a = b.dataset.act;
      if (a === 'skip' || a === 'finish') return finish();
      if (a === 'next') return next();
      if (a === 'theme') {
        chosen.theme = b.dataset.v;
        themeManager.applyTheme?.(chosen.theme) || document.documentElement.setAttribute('data-theme', chosen.theme);
        localStorage.setItem('zpopcorn-theme', JSON.stringify(chosen.theme));
        root.querySelectorAll('.z-themecard').forEach((c) => c.classList.toggle('on', c.dataset.v === chosen.theme));
        return;
      }
      if (a === 'pick') {
        try {
          const p = await api.system.pickFolder();
          if (p && !chosen.paths.includes(p)) {
            chosen.paths.push(p);
            await api.library.addSource(p);
            const nx = root.querySelector('[data-act="next"]'); if (nx) nx.disabled = false;
            const l = root.querySelector('#fr-paths');
            if (l) l.innerHTML = chosen.paths.map((x) => `<div class="z-pill" style="max-width:100%"><span dir="ltr" style="overflow:hidden;text-overflow:ellipsis">${esc(x)}</span><span style="color:var(--color-success)">${icon('check', 12)}</span></div>`).join('');
          }
        } catch (e) {
          root.querySelector('#fr-err')?.replaceChildren(document.createTextNode(String(e.message || e)));
        }
        return;
      }
    }));
  }

  overlay.innerHTML = `<div class="card" style="position:relative"></div>`;
  document.body.appendChild(overlay);
  render();

  function stepWelcome(c, root, goNext) {
    return `
      <div class="mark">${icon('logo', 28)}</div>
      <h1>أهلاً بك في zPopcorn</h1>
      <p>مكتبتك تبقى حيث هي — نقرأ الملفات في مكانها، ننظّمها، ونطابقها مع TMDB. كل شيء محلي أولاً، والإنترنت اختياري.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:24px">
        ${[['shield', 'خصوصية كاملة', 'لا تُرفع ملفاتك لأي مكان'], ['database', 'قاعدة SQLite', 'بحث فوري وتاريخ موثوق'], ['bolt', 'مطابقة ذكية', 'مع مراجعة بشرية عند الشك']]
      .map(([i, t, d]) => `<div class="z-fact" style="gap:6px"><span style="color:var(--accent)">${icon(i, 18)}</span><b style="font-size:13px">${t}</b><span style="font-size:11.5px;color:var(--color-text-muted)">${d}</span></div>`).join('')}
      </div>
      <div class="foot">
        <button class="btn btn-ghost btn-sm" data-act="skip">تخطي الإعداد</button>
        <button class="btn btn-primary" data-act="next">لنبدأ ${icon('chevL', 15)}</button>
      </div>`;
  }

  function stepTheme(c) {
    return `
      <h1 style="font-size:22px">اختر مزاجك</h1>
      <p style="margin-bottom:18px">يمكن تغيير السمة والكثافة لاحقاً من الإعدادات في أي وقت.</p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
        ${THEMES.map((t) => {
          const accent = { 'neon-lime': '#c9f24d', 'midnight-neon': '#7b6cf6', amoled: '#8f83ff', 'cinema-noir': '#d24a5f', aurora: '#4cc9f0' }[t.id];
          const bg = { 'neon-lime': '#121212', 'midnight-neon': '#0a0a0a', amoled: '#000', 'cinema-noir': '#0b0a0a', aurora: '#070b12' }[t.id];
          return `
          <button class="z-themecard ${c.theme === t.id ? 'on' : ''}" data-act="theme" data-v="${t.id}" style="text-align:start">
            <div class="prev" style="background:${bg}">
              <div class="sbw" style="background:color-mix(in srgb, #fff 4%, ${bg})"></div>
              <div class="main">
                <div class="bar" style="background:linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 35%, transparent));height:34px;border-radius:5px"></div>
                <div style="display:flex;gap:5px">
                  <div class="bar" style="flex:1;height:34px;background:#161616;border:1px solid rgba(255,255,255,.07)"></div>
                  <div class="bar" style="flex:1;height:34px;background:#161616;border:1px solid rgba(255,255,255,.07)"></div>
                  <div class="bar" style="flex:1;height:34px;background:#161616;border:1px solid rgba(255,255,255,.07)"></div>
                </div>
              </div>
            </div>
            <div class="info"><b>${t.name}</b><span>${t.hint}</span><span class="pick">${icon('check', 12)} مفعّلة</span></div>
          </button>`;
        }).join('')}
      </div>
      <div class="foot">
        <button class="btn btn-ghost btn-sm" data-act="skip">تخطي</button>
        <button class="btn btn-primary" data-act="next">متابعة ${icon('chevL', 15)}</button>
      </div>`;
  }

  function stepFolders(c) {
    if (!isDesktop) {
      return `
        <h1 style="font-size:22px">مجلدات المكتبة</h1>
        <p>تحديد مجلدات الوسائط متاح داخل نسخة سطح المكتب (نافذة اختيار مجلد أصلية). هنا في وضع المعاينة يمكنك استعراض الواجهة فقط.</p>
        <div class="foot"><span></span><button class="btn btn-primary" data-act="next">حسنًا ${icon('chevL', 15)}</button></div>`;
    }
    return `
      <h1 style="font-size:22px">أين تعيش وسائطك؟</h1>
      <p>أضِف مجلداً واحداً أو أكثر. تبقى الملفات في مكانها تماماً — zPopcorn يقرأها ولا ينقلها.</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin:16px 0 4px">
        <button class="btn btn-secondary" data-act="pick">${icon('folderOpen', 16)} اختيار مجلد…</button>
        <div id="fr-paths" style="display:flex;flex-direction:column;gap:6px;align-items:flex-start"></div>
        <div id="fr-err" style="font-size:12px;color:var(--color-danger)"></div>
      </div>
      <div class="foot">
        <button class="btn btn-ghost btn-sm" data-act="skip">سأضيفها لاحقاً</button>
        <button class="btn btn-primary" data-act="next" ${c.paths.length ? '' : 'disabled'}>ابدأ الفحص ${icon('scan', 15)}</button>
      </div>`;
  }

  function stepDone(c) {
    return `
      <div class="mark">${icon('check', 26)}</div>
      <h1 style="font-size:22px">كل شيء جاهز</h1>
      <p>${c.paths.length ? `سنفحص <b class="num">${c.paths.length}</b> مجلداً، ثم تراجع النتائج في صندوق الوارد قبل إضافتها.` : 'يمكنك إضافة المجلدات لاحقاً من «صندوق الوارد» أو الإعدادات.'}</p>
      <div class="foot"><span></span><button class="btn btn-primary" data-act="finish">افتح zPopcorn ${icon('chevL', 15)}</button></div>`;
  }
}

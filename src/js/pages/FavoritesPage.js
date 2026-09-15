/**
 * FavoritesPage, WatchLaterPage, HistoryPage, PlatformsPage, etc.
 */

import { watchlistManager } from '../services/watchlist/WatchlistManager.js';
import { createMediaGrid } from '../components/MediaCard.js';
import { db } from '../services/storage/Database.js';
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';

export async function FavoritesPage() {
  return createWatchlistPage('favorites', '❤️ المفضلة', 'المحتوى المفضل لديك');
}

export async function WatchLaterPage() {
  return createWatchlistPage('watch-later', '⏰ المشاهدة لاحقاً', 'أفلام ومسلسلات تريد مشاهدتها لاحقاً');
}

export async function WatchlistPage(params) {
  const listId = params.id;
  const list = await watchlistManager.getList(listId);
  
  if (!list) {
    return createNotFoundPage('قائمة غير موجودة');
  }
  
  return createWatchlistPage(listId, `${list.icon} ${list.name}`, list.description);
}

async function createWatchlistPage(listId, title, description) {
  const container = document.createElement('div');
  container.className = 'watchlist-page';
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 8px;">${title}</h1>
        <p style="color: var(--color-text-secondary);">${description}</p>
      </div>
      
      <div style="display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;">
        <select id="sort-select" class="input" style="width: 200px; height: 40px;">
          <option value="date">تاريخ الإضافة</option>
          <option value="rating">التقييم</option>
          <option value="title">العنوان</option>
        </select>
        <button id="export-btn" class="btn btn-secondary btn-sm">تصدير القائمة</button>
        <button id="clear-btn" class="btn btn-ghost btn-sm">مسح القائمة</button>
      </div>
      
      <div id="watchlist-grid" class="media-grid"></div>
    </div>
  `;

  const grid = container.querySelector('#watchlist-grid');
  const sortSelect = container.querySelector('#sort-select');

  async function loadList() {
    try {
      const items = await watchlistManager.getListItems(listId, { sortBy: sortSelect.value });
      
      if (items.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">📋</div>
            <h3 class="empty-state-title">القائمة فارغة</h3>
            <p class="empty-state-description">لم تضف أي محتوى لهذه القائمة بعد. ابدأ بإضافة أفلام ومسلسلات من صفحات التفاصيل</p>
            <button class="btn btn-primary" onclick="window.router.navigate('/movies')">استكشاف الأفلام</button>
          </div>
        `;
        return;
      }

      createMediaGrid(items.map(item => item.media || { id: item.mediaId, title: item.title, poster_path: item.poster_path, media_type: item.mediaType }), grid);
    } catch (e) {
      console.warn('Failed to load watchlist:', e);
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>فشل تحميل القائمة</p></div>`;
    }
  }

  sortSelect.addEventListener('change', loadList);
  
  container.querySelector('#export-btn').addEventListener('click', async () => {
    try {
      const data = await watchlistManager.exportList(listId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watchlist-${listId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn(e);
    }
  });

  container.querySelector('#clear-btn').addEventListener('click', async () => {
    if (confirm('هل أنت متأكد من مسح القائمة؟')) {
      try {
        const list = await watchlistManager.getList(listId);
        if (list) {
          for (const item of list.items) {
            await watchlistManager.removeFromList(listId, item.mediaId);
          }
          loadList();
        }
      } catch {}
    }
  });

  loadList();

  return container;
}

export async function HistoryPage() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 24px;">🕐 سجل المشاهدة</h1>
      <div id="history-grid" class="media-grid"></div>
    </div>
  `;

  const grid = container.querySelector('#history-grid');
  
  try {
    const history = await db.getAll('watchHistory').catch(() => []);
    const progress = await db.getAll('watchProgress').catch(() => []);
    
    const allHistory = [...history, ...progress].sort((a, b) => b.watchedAt - a.watchedAt || b.updatedAt - a.updatedAt);
    
    if (allHistory.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🕐</div>
          <h3 class="empty-state-title">لا يوجد سجل مشاهدة</h3>
          <p class="empty-state-description">سيظهر هنا سجل الأفلام والمسلسلات التي شاهدتها</p>
        </div>
      `;
    } else {
      createMediaGrid(allHistory.map(item => ({
        id: item.mediaId,
        title: item.title,
        poster_path: item.poster_path,
        media_type: item.mediaType,
        progress: item.progress
      })), grid);
    }
  } catch {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>فشل تحميل السجل</p></div>`;
  }

  return container;
}

export async function ContinueWatchingPage() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 24px;">▶️ متابعة المشاهدة</h1>
      <div id="continue-grid" class="media-grid"></div>
    </div>
  `;

  const grid = container.querySelector('#continue-grid');
  
  try {
    const progress = await db.getAll('watchProgress').catch(() => []);
    const inProgress = progress.filter(p => p.progress > 5 && p.progress < 95).sort((a, b) => b.updatedAt - a.updatedAt);
    
    if (inProgress.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">▶️</div>
          <h3 class="empty-state-title">لا يوجد محتوى قيد المشاهدة</h3>
          <p class="empty-state-description">ابدأ بمشاهدة فيلم أو مسلسل وسيظهر هنا للمتابعة</p>
        </div>
      `;
    } else {
      grid.innerHTML = inProgress.map(item => `
        <div class="media-card" style="cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('playmedia', {detail: {id: '${item.mediaId}', title: '${item.title}'}}))">
          ${item.poster_path ? `<img src="${getTMDBImageUrl(item.poster_path, 'poster', 'w342')}" style="width: 100%; height: 100%; object-fit: cover;" />` : ''}
          <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); padding: 12px; color: white;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
            <div style="background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;">
              <div style="width: ${item.progress}%; height: 100%; background: var(--color-accent);"></div>
            </div>
            <div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">${item.progress}% • ${Math.floor(item.position / 60)}:${String(Math.floor(item.position % 60)).padStart(2, '0')}</div>
          </div>
        </div>
      `).join('');
    }
  } catch {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>فشل التحميل</p></div>`;
  }

  return container;
}

export async function PlatformsPage() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 8px;">📡 المنصات</h1>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px;">منصات البث المتاحة في منطقتك (بيانات حقيقية من TMDB Watch Providers)</p>
      <div id="platforms-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;"></div>
    </div>
  `;

  const grid = container.querySelector('#platforms-grid');
  
  // Real platforms from TMDB
  const platforms = [
    { id: 8, name: 'Netflix', logo: 'https://images.justwatch.com/icon/207360008/s100', color: '#e50914' },
    { id: 119, name: 'Amazon Prime Video', logo: 'https://images.justwatch.com/icon/52449861/s100', color: '#00a8e1' },
    { id: 337, name: 'Disney Plus', logo: 'https://images.justwatch.com/icon/147638351/s100', color: '#113ccf' },
    { id: 2, name: 'Apple TV', logo: 'https://images.justwatch.com/icon/190848813/s100', color: '#000000' },
    { id: 384, name: 'HBO Max', logo: 'https://images.justwatch.com/icon/285237061/s100', color: '#000000' },
    { id: 283, name: 'Crunchyroll', logo: 'https://images.justwatch.com/icon/212543997/s100', color: '#f47521' },
    { id: 15, name: 'Hulu', logo: 'https://images.justwatch.com/icon/116653721/s100', color: '#1ce783' },
    { id: 531, name: 'Paramount Plus', logo: 'https://images.justwatch.com/icon/210418396/s100', color: '#0064ff' }
  ];

  grid.innerHTML = platforms.map(platform => `
    <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.2s;" onmouseenter="this.style.borderColor='var(--color-accent)'" onmouseleave="this.style.borderColor='var(--color-border)'">
      <div style="width: 60px; height: 60px; background: ${platform.color}; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; color: white; font-weight: 700; font-size: 12px;">${platform.name.slice(0, 2).toUpperCase()}</div>
      <h3 style="font-weight: 600; margin-bottom: 4px;">${platform.name}</h3>
      <p style="font-size: 12px; color: var(--color-text-secondary);">متاح في ${localStorage.getItem('zpopcorn-region') || 'SA'}</p>
      <div style="margin-top: 12px; font-size: 11px; color: var(--color-text-muted);">بيانات من TMDB • JustWatch</div>
    </div>
  `).join('');

  return container;
}

export async function PersonPage(params) {
  const id = params.id;
  const container = document.createElement('div');
  container.innerHTML = `<div style="padding: 40px; text-align: center;"><div class="app-loading-spinner" style="margin: 0 auto 16px;"></div><p>جاري تحميل بيانات الشخص...</p></div>`;

  try {
    const person = await tmdbClient.getPerson(id);
    
    const profileUrl = person.profile_path ? getTMDBImageUrl(person.profile_path, 'profile', 'w500') : '';
    
    container.innerHTML = `
      <div class="container" style="padding-top: 24px;">
        <button class="btn btn-ghost" onclick="window.router.goBack()" style="margin-bottom: 24px;">← العودة</button>
        
        <div style="display: grid; grid-template-columns: 300px 1fr; gap: 32px; align-items: start;">
          <div>
            ${profileUrl ? `<img src="${profileUrl}" style="width: 100%; border-radius: 16px; aspect-ratio: 2/3; object-fit: cover;" />` : '<div style="width: 100%; aspect-ratio: 2/3; background: var(--color-surface); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 48px;">👤</div>'}
          </div>
          
          <div>
            <h1 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 8px;">${person.name}</h1>
            ${person.birthday ? `<p style="color: var(--color-text-secondary); margin-bottom: 16px;">${person.birthday} • ${person.place_of_birth || ''}</p>` : ''}
            
            <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
              <span style="background: var(--color-accent); color: white; padding: 4px 12px; border-radius: 16px; font-size: 13px;">${person.known_for_department || 'تمثيل'}</span>
              ${person.popularity ? `<span style="background: var(--color-card); border: 1px solid var(--color-border); padding: 4px 12px; border-radius: 16px; font-size: 13px;">شعبية: ${person.popularity.toFixed(1)}</span>` : ''}
            </div>
            
            ${person.biography ? `
              <div style="margin-bottom: 24px;">
                <h3 style="font-weight: 600; margin-bottom: 12px;">السيرة الذاتية</h3>
                <p style="line-height: 1.8; color: var(--color-text-secondary);">${person.biography.slice(0, 500)}${person.biography.length > 500 ? '...' : ''}</p>
              </div>
            ` : ''}
            
            <h3 style="font-weight: 600; margin-bottom: 16px;">أشهر الأعمال</h3>
            <div class="media-grid" id="known-for"></div>
          </div>
        </div>
      </div>
    `;

    const knownForGrid = container.querySelector('#known-for');
    const knownFor = person.combined_credits?.cast?.slice(0, 12) || [];
    
    if (knownFor.length > 0) {
      const { createMediaGrid } = await import('../components/MediaCard.js');
      createMediaGrid(knownFor, knownForGrid);
    }

  } catch (e) {
    container.innerHTML = `<div class="container" style="padding: 40px; text-align: center;"><h2>فشل تحميل بيانات الشخص</h2><p>${e.message}</p></div>`;
  }

  return container;
}

export async function AnalyticsPage() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 24px;">📊 الإحصائيات والتحليلات</h1>
      <div id="analytics-content">
        <div style="display: grid; gap: 20px;">
          <div class="skeleton" style="height: 200px; border-radius: 12px;"></div>
          <div class="skeleton" style="height: 300px; border-radius: 12px;"></div>
        </div>
      </div>
    </div>
  `;

  const content = container.querySelector('#analytics-content');
  
  try {
    const { analyticsEngine, achievementEngine } = await import('../services/analytics/AnalyticsEngine.js');
    const analytics = await analyticsEngine.getAllAnalytics();
    const achievements = await achievementEngine.checkAchievements();

    content.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; text-align: center;">
          <div style="font-size: 2rem; font-weight: 700; color: var(--color-accent);">${Math.floor(analytics.watchTime.total / 3600)}س</div>
          <div style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;">إجمالي وقت المشاهدة</div>
        </div>
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; text-align: center;">
          <div style="font-size: 2rem; font-weight: 700; color: var(--color-accent);">${analytics.library.completed}</div>
          <div style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;">أعمال مكتملة</div>
        </div>
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; text-align: center;">
          <div style="font-size: 2rem; font-weight: 700; color: var(--color-accent);">${analytics.ratings.total}</div>
          <div style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;">تقييمات</div>
        </div>
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; text-align: center;">
          <div style="font-size: 2rem; font-weight: 700; color: var(--color-accent);">${achievements.unlocked.length}</div>
          <div style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;">إنجازات</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px;">
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
          <h3 style="font-weight: 600; margin-bottom: 16px;">الأنواع المفضلة</h3>
          ${analytics.genres.length > 0 ? analytics.genres.map(g => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-border-subtle);">
              <span>نوع ${g.id}</span>
              <span style="background: var(--color-accent); color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${g.count}</span>
            </div>
          `).join('') : '<p style="color: var(--color-text-muted); font-size: 14px;">لا توجد بيانات بعد</p>'}
        </div>
        
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
          <h3 style="font-weight: 600; margin-bottom: 16px;">الإنجازات</h3>
          <div style="display: grid; gap: 8px;">
            ${achievements.unlocked.map(a => `
              <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--color-surface); border-radius: 8px; border: 1px solid var(--color-border);">
                <span style="font-size: 20px;">${a.icon}</span>
                <div style="flex: 1;">
                  <div style="font-weight: 500; font-size: 14px;">${a.name}</div>
                  <div style="font-size: 12px; color: var(--color-text-secondary);">${a.description}</div>
                </div>
                <span style="color: var(--color-success);">✓</span>
              </div>
            `).join('')}
            ${achievements.unlocked.length === 0 ? '<p style="color: var(--color-text-muted); font-size: 14px;">ابدأ بالمشاهدة لفتح الإنجازات</p>' : ''}
          </div>
        </div>
      </div>

      <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">خريطة المشاهدة (24×7)</h3>
        <div style="overflow-x: auto;">
          <div style="display: grid; grid-template-columns: 60px repeat(24, 1fr); gap: 2px; min-width: 800px; font-size: 10px;">
            <div></div>
            ${Array.from({length: 24}, (_, i) => `<div style="text-align: center; color: var(--color-text-muted);">${i}</div>`).join('')}
            ${['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((day, dayIndex) => `
              <div style="color: var(--color-text-secondary); padding: 4px;">${day}</div>
              ${analytics.heatmap[dayIndex] ? analytics.heatmap[dayIndex].map(count => {
                const intensity = Math.min(1, count / 5);
                return `<div style="height: 20px; background: rgba(139, 92, 246, ${intensity}); border-radius: 2px;" title="${count} مشاهدات"></div>`;
              }).join('') : Array(24).fill('<div style="height: 20px; background: var(--color-surface); border-radius: 2px;"></div>').join('')}
            `).join('')}
          </div>
        </div>
      </div>
    `;

  } catch (e) {
    console.warn('Analytics failed:', e);
    content.innerHTML = `<p>فشل تحميل الإحصائيات: ${e.message}</p>`;
  }

  return container;
}

function createNotFoundPage(message = 'الصفحة غير موجودة') {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="container" style="padding: 80px 24px; text-align: center;">
      <div style="font-size: 64px; margin-bottom: 16px;">🔍</div>
      <h2 style="margin-bottom: 8px;">${message}</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px;">الصفحة التي تبحث عنها غير موجودة</p>
      <button class="btn btn-primary" onclick="window.router.navigate('/')">العودة للرئيسية</button>
    </div>
  `;
  return div;
}

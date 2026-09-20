/**
 * AnalyticsEngine - Watch analytics and insights
 */

import { behaviorEngine } from '../behavior/UserBehaviorEngine.js';
import { ratingManager } from '../rating/RatingManager.js';
import { db } from '../storage/Database.js';

export class AnalyticsEngine {
  async getWatchTimeStats() {
    return behaviorEngine.getWatchTimeStats();
  }

  async getMostWatchedGenres(limit = 5) {
    await behaviorEngine.init();
    const aggregated = behaviorEngine.getAggregated();
    
    return Object.entries(aggregated.genres)
      .map(([id, count]) => ({ id: parseInt(id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getWatchHeatmap() {
    await behaviorEngine.init();
    const events = behaviorEngine.getEvents({ type: 'PLAY_STARTED' });
    
    // 24x7 heatmap
    const heatmap = Array(7).fill(null).map(() => Array(24).fill(0));
    
    events.forEach(event => {
      const date = new Date(event.timestamp);
      const day = date.getDay(); // 0 = Sunday
      const hour = date.getHours();
      heatmap[day][hour]++;
    });

    return heatmap;
  }

  async getCinematicJourney() {
    await behaviorEngine.init();
    const completed = behaviorEngine.getEvents({ type: 'PLAY_COMPLETED' });
    
    // Group by year and month
    const journey = {};
    
    completed.forEach(event => {
      const date = new Date(event.timestamp);
      const year = date.getFullYear();
      const month = date.getMonth();
      
      if (!journey[year]) journey[year] = {};
      if (!journey[year][month]) journey[year][month] = [];
      
      journey[year][month].push(event);
    });

    return journey;
  }

  async getMonthlyComparison() {
    await behaviorEngine.init();
    const now = Date.now();
    const month = 30 * 24 * 60 * 60 * 1000;
    
    const thisMonth = behaviorEngine.getEvents({ since: now - month });
    const lastMonth = behaviorEngine.getEvents({ since: now - 2 * month })
      .filter(e => e.timestamp < now - month);

    const countThis = thisMonth.filter(e => e.type === 'PLAY_COMPLETED').length;
    const countLast = lastMonth.filter(e => e.type === 'PLAY_COMPLETED').length;
    
    const timeThis = thisMonth
      .filter(e => e.type === 'PLAY_COMPLETED')
      .reduce((sum, e) => sum + (e.metadata.duration || 0), 0);
    
    const timeLast = lastMonth
      .filter(e => e.type === 'PLAY_COMPLETED')
      .reduce((sum, e) => sum + (e.metadata.duration || 0), 0);

    return {
      thisMonth: { count: countThis, watchTime: timeThis },
      lastMonth: { count: countLast, watchTime: timeLast },
      countChange: countLast ? ((countThis - countLast) / countLast) * 100 : 0,
      timeChange: timeLast ? ((timeThis - timeLast) / timeLast) * 100 : 0
    };
  }

  async getPredictions() {
    const stats = await this.getWatchTimeStats();
    const avgPerDay = stats.averagePerDay || 0;
    
    // Predict completions this month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();
    const daysRemaining = daysInMonth - daysPassed;
    
    const completedThisMonth = behaviorEngine.getEvents({ 
      type: 'PLAY_COMPLETED',
      since: new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    }).length;

    const predictedTotal = completedThisMonth + (avgPerDay * daysRemaining / (2 * 60 * 60)); // Assume 2h per item
    
    return {
      predictedCompletions: Math.round(predictedTotal),
      daysRemaining,
      averagePerDay: avgPerDay,
      completedThisMonth
    };
  }

  async getLibraryStats() {
    try {
      const [movies, tvshows, ratings, watchProgress] = await Promise.all([
        db.getAll('movies').catch(() => []),
        db.getAll('tvshows').catch(() => []),
        db.getAll('ratings').catch(() => []),
        db.getAll('watchProgress').catch(() => [])
      ]);

      return {
        totalMovies: movies.length,
        totalTVShows: tvshows.length,
        totalRatings: ratings.length,
        inProgress: watchProgress.filter(p => p.progress > 5 && p.progress < 95).length,
        completed: watchProgress.filter(p => p.progress >= 95).length
      };
    } catch {
      return {
        totalMovies: 0,
        totalTVShows: 0,
        totalRatings: 0,
        inProgress: 0,
        completed: 0
      };
    }
  }

  async getAllAnalytics() {
    const [watchTime, genres, heatmap, journey, monthly, predictions, library] = await Promise.all([
      this.getWatchTimeStats(),
      this.getMostWatchedGenres(),
      this.getWatchHeatmap(),
      this.getCinematicJourney(),
      this.getMonthlyComparison(),
      this.getPredictions(),
      this.getLibraryStats()
    ]);

    return {
      watchTime,
      genres,
      heatmap,
      journey,
      monthly,
      predictions,
      library,
      ratings: ratingManager.getStats(),
      generatedAt: Date.now()
    };
  }
}

export class AchievementEngine {
  constructor() {
    this.achievements = [
      { id: 'first-movie', name: 'أول فيلم', description: 'شاهدت أول فيلم', icon: '🎬', condition: (stats) => stats.library.totalMovies >= 1 },
      { id: '10-movies', name: '10 أفلام', description: 'شاهدت 10 أفلام', icon: '🍿', condition: (stats) => stats.library.completed >= 10 },
      { id: '50-movies', name: '50 فيلم', description: 'شاهدت 50 فيلم', icon: '🎥', condition: (stats) => stats.library.completed >= 50 },
      { id: '100-movies', name: '100 فيلم', description: 'شاهدت 100 فيلم', icon: '🏆', condition: (stats) => stats.library.completed >= 100 },
      { id: 'night-owl', name: 'بومة الليل', description: 'تشاهد كثيراً في الليل', icon: '🦉', condition: (stats) => this.isNightOwl(stats.heatmap) },
      { id: 'weekend-binger', name: 'مشاهد نهاية الأسبوع', description: 'تشاهد كثيراً في نهاية الأسبوع', icon: '📅', condition: (stats) => this.isWeekendBinger(stats.heatmap) },
      { id: 'genre-explorer', name: 'مستكشف الأنواع', description: 'شاهدت 5 أنواع مختلفة', icon: '🗺️', condition: (stats) => stats.genres.length >= 5 },
      { id: 'critic', name: 'الناقد', description: 'قيمت 10 أعمال', icon: '⭐', condition: (stats) => stats.ratings.total >= 10 },
      { id: 'rewatcher', name: 'إعادة المشاهدة', description: 'أعدت مشاهدة 5 أعمال', icon: '🔄', condition: (stats) => stats.ratings.totalRewatches >= 5 }
    ];
  }

  isNightOwl(heatmap) {
    if (!heatmap) return false;
    // Check if most watching is between 10pm-4am
    let nightCount = 0;
    let total = 0;
    
    heatmap.forEach(day => {
      day.forEach((count, hour) => {
        total += count;
        if (hour >= 22 || hour <= 4) nightCount += count;
      });
    });

    return total > 0 && (nightCount / total) > 0.4;
  }

  isWeekendBinger(heatmap) {
    if (!heatmap) return false;
    let weekendCount = 0;
    let total = 0;
    
    heatmap.forEach((day, dayIndex) => {
      const dayTotal = day.reduce((a, b) => a + b, 0);
      total += dayTotal;
      if (dayIndex === 5 || dayIndex === 6) weekendCount += dayTotal; // Fri, Sat
    });

    return total > 0 && (weekendCount / total) > 0.4;
  }

  async checkAchievements() {
    const analyticsEngine = new AnalyticsEngine();
    const stats = await analyticsEngine.getAllAnalytics();
    
    const unlocked = [];
    const locked = [];

    for (const achievement of this.achievements) {
      try {
        if (achievement.condition(stats)) {
          unlocked.push(achievement);
        } else {
          locked.push(achievement);
        }
      } catch {}
    }

    return { unlocked, locked, stats };
  }
}

export const analyticsEngine = new AnalyticsEngine();
export const achievementEngine = new AchievementEngine();
export default analyticsEngine;

/**
 * §07 shared ranked-collection mount — fetches a ranked TMDB list and renders
 * it through THE one compact top10 builder. Every "Top 10 ___" surface on
 * every page uses this; no page may hand-roll ranks again.
 */
import { section } from './primitives.js';
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { createTop10 } from '../components/MediaCard.js';

export async function rankedTop10({ mount, endpoint, params = {}, title, subtitle = '' }) {
  const s = section({ title, subtitle, wide: true });
  mount.appendChild(s.root);
  try {
    const res = await tmdbClient.request(endpoint, params);
    const rows = (res?.results || []).filter((m) => m.poster_path).slice(0, 10);
    if (rows.length < 4) { s.root.remove(); return; }   // never a half-empty rank row
    s.body.appendChild(createTop10(rows));
  } catch { s.root.remove(); }                          // offline + no cache → honest absence
}

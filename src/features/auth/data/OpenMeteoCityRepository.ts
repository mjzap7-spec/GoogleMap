import type { City, CityRepository } from '../models/city';

/** Key-free development geocoder; replace this adapter for commercial deployments. */
export class OpenMeteoCityRepository implements CityRepository {
  private cache = new Map<string, { expires: number; cities: City[] }>();
  constructor(
    private request: typeof fetch = fetch,
    private now: () => number = Date.now,
  ) {}

  async search(query: string, signal?: AbortSignal): Promise<City[]> {
    if (signal?.aborted) throw new Error('City search cancelled');
    const normalized = query.trim().replace(/\s+/g, ' ');
    const key = normalized.toLowerCase();
    const cached = this.cache.get(key);
    if (cached && cached.expires > this.now()) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.cities.map((city) => ({ ...city }));
    }
    this.cache.delete(key);
    const response = await this.request(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalized)}&count=8&language=en&format=json`,
      { signal },
    );
    if (!response.ok) throw new Error('City search unavailable');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('results' in data) || !Array.isArray(data.results))
      return [];
    const cities = data.results.flatMap((row: unknown) => {
      if (!row || typeof row !== 'object') return [];
      const r = row as Record<string, unknown>;
      if (
        typeof r.name !== 'string' ||
        typeof r.country !== 'string' ||
        typeof r.id !== 'number' ||
        typeof r.feature_code !== 'string' ||
        !r.feature_code.startsWith('PPL')
      )
        return [];
      const state = typeof r.admin1 === 'string' ? r.admin1 : '';
      return [
        {
          id: String(r.id),
          name: r.name,
          state,
          country: r.country,
          label: [...new Set([r.name, state, r.country].filter(Boolean))].join(', '),
          ...(typeof r.latitude === 'number' &&
          Number.isFinite(r.latitude) &&
          Math.abs(r.latitude) <= 90 &&
          typeof r.longitude === 'number' &&
          Number.isFinite(r.longitude) &&
          Math.abs(r.longitude) <= 180
            ? { latitude: r.latitude, longitude: r.longitude }
            : {}),
        },
      ];
    });
    this.cache.set(key, { expires: this.now() + 5 * 60 * 1000, cities });
    if (this.cache.size > 32) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return cities.map((city) => ({ ...city }));
  }
}

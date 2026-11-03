export interface City {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly country: string;
  readonly label: string;
  readonly latitude?: number;
  readonly longitude?: number;
}
export interface CityRepository {
  search(query: string, signal?: AbortSignal): Promise<City[]>;
}

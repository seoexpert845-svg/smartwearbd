import { districts_en, upazilas_en, type LocationItem } from 'bangladesh-location-data';
import { districts_bn, upazilas_bn } from 'bangladesh-location-data/bangla';

export type BangladeshLocation = {
  id: string;
  english: string;
  bangla: string;
};

const englishDistricts = Object.values(districts_en).flat();
const banglaDistricts = Object.values(districts_bn).flat();
const banglaUpazilas = upazilas_bn as Record<string, LocationItem[]>;

export const bangladeshDistricts: BangladeshLocation[] = englishDistricts
  .map((district) => ({
    id: String(district.value),
    english: district.title,
    bangla: banglaDistricts.find((item) => String(item.value) === String(district.value))?.title || district.title,
  }))
  .sort((left, right) => left.english.localeCompare(right.english));

export function findBangladeshDistrict(value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  return bangladeshDistricts.find((district) =>
    district.english.toLocaleLowerCase() === normalized || district.bangla === value.trim()
  );
}

export function getBangladeshUpazilas(districtValue: string): BangladeshLocation[] {
  const district = findBangladeshDistrict(districtValue);
  if (!district) return [];

  const englishUpazilas = upazilas_en[district.id] || [];
  const banglaDistrictUpazilas = banglaUpazilas[district.id] || [];
  return englishUpazilas.map((upazila) => ({
    id: String(upazila.value),
    english: upazila.title,
    bangla: banglaDistrictUpazilas.find((item) => String(item.value) === String(upazila.value))?.title || upazila.title,
  }));
}

export function isKhulnaDistrict(value: string) {
  const district = findBangladeshDistrict(value);
  return district?.english.toLocaleLowerCase() === 'khulna' || district?.bangla === 'খুলনা';
}
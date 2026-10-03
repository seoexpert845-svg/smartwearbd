import SiteSetting from '@/models/SiteSetting';

export const DEFAULT_BANNERS: { imageUrl: string; link: string }[] = [
  {
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=2000&q=88',
    link: '#products',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=2000&q=88',
    link: '#products',
  },
];

export async function getStoreSettings() {
  let settings = await SiteSetting.findOneAndUpdate(
    { key: 'store' },
    { $setOnInsert: { key: 'store', banners: DEFAULT_BANNERS, bannersInitialized: true } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).select('+bannersInitialized +courierSettings').lean();

  if (!settings) throw new Error('স্টোর সেটিংস পাওয়া যায়নি।');

  if (!settings.bannersInitialized) {
    const banners = Array.isArray(settings.banners) && settings.banners.length ? settings.banners : DEFAULT_BANNERS;
    settings = await SiteSetting.findOneAndUpdate(
      { key: 'store', bannersInitialized: { $ne: true } },
      { $set: { banners, bannersInitialized: true } },
      { new: true }
    ).select('+bannersInitialized +courierSettings').lean() || settings;
  }

  const publicSettings = { ...settings };
  const legacyAnnouncementText = Reflect.get(publicSettings, 'announcement_text');
  if (!publicSettings.marqueeText && typeof legacyAnnouncementText === 'string') {
    publicSettings.marqueeText = legacyAnnouncementText;
  }
  Reflect.deleteProperty(publicSettings, 'bannersInitialized');
  Reflect.deleteProperty(publicSettings, 'courierSettings');
  Reflect.deleteProperty(publicSettings, 'announcement_text');
  if (!Array.isArray(publicSettings.deliveryZones)) publicSettings.deliveryZones = [];
  return publicSettings;
}

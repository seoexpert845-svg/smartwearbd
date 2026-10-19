'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { normalizeImageUrl } from '@/lib/image-url';
import { ArrowLeft, ArrowRight, ChevronRight, Heart, House, LoaderCircle, LockKeyhole, Menu, PackageCheck, Search, ShieldCheck, ShoppingBag, ShoppingCart, Trash2, Truck, UserRound, X, Zap } from 'lucide-react';
import { findBangladeshDistrict, getBangladeshUpazilas, isKhulnaDistrict } from '@/lib/bangladesh-locations';
import { getDiscountPercent, getRegularPrice, getSalePrice } from '@/lib/product-pricing';
import SearchableDistrictSelect from '@/components/searchable-district-select';

type Product = {
  _id: string;
  name: string;
  price: number;
  regularPrice?: number;
  salePrice?: number;
  description?: string;
  imageUrl?: string;
  images?: string[];
  category?: string;
  discountPercent?: number;
  stock?: number;
  inStock?: boolean;
  featured?: boolean;
  freeShipping?: boolean;
  maxOrderQuantity?: number;
  sectionIds?: string[];
  subCategory?: string;
  productType?: 'single' | 'variant';
  variants?: { stock: number }[];
};

type CartLine = { product: Product; quantity: number; variant?: string };
type Category = { _id: string; name: string; description?: string; imageUrl?: string };
type StoreSection = { _id: string; name: string; description?: string; sortOrder: number };
type StoreSettings = {
  storeName: string;
  logoUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  promotionLabel: string;
  promotionText: string;
  slogan: string;
  description: string;
  banners: { imageUrl: string; link: string }[];
  deliveryZones: { name: string; fee: number }[];
  primaryColor: string;
  backgroundColor: string;
  phone1: string;
  phone2: string;
  whatsapp1: string;
  whatsapp2: string;
  contactEmail: string;
  address: string;
  marqueeText: string;
  orderNote: string;
  socialLinks: Record<string, string>;
};
type GuestProfile = { customerName: string; customerPhone: string; district: string; thana: string; customerAddress: string };
type OrderReceipt = { id: string; totalAmount: number; submittedAt: string };

const defaultSettings: StoreSettings = {
  storeName: 'My Store',
  logoUrl: '',
  heroTitle: 'প্রতিদিনের পছন্দ, এবার আরও সাশ্রয়ে',
  heroSubtitle: 'বিশ্বস্ত ব্র্যান্ড, ন্যায্য দাম আর দ্রুত ডেলিভারি—আপনার দরজায় পৌঁছে দিচ্ছি আমরা।',
  heroImageUrl: '',
  promotionLabel: 'সাপ্তাহিক শপিং ফেস্ট · ২০২৬',
  promotionText: '৩০% পর্যন্ত ছাড়',
  slogan: '',
  description: '',
  banners: [],
  deliveryZones: [],
  primaryColor: '#8c6d3f',
  backgroundColor: '#fdfbf7',
  phone1: '',
  phone2: '',
  whatsapp1: '',
  whatsapp2: '',
  contactEmail: '',
  address: '',
  marqueeText: '',
  orderNote: '',
  socialLinks: {},
};
const storePolicyLinks = [
  ['privacy-policy', 'Privacy Policy'],
  ['terms-and-conditions', 'Terms & Conditions'],
  ['return-policy', 'Return Policy'],
  ['refund-policy', 'Refund Policy'],
  ['delivery-policy', 'Delivery Policy'],
  ['about-us', 'About Us'],
] as const;
const money = (amount: number) => `৳${new Intl.NumberFormat('bn-BD').format(amount)}`;
function LocationFields({ district, thana, onDistrictChange, onThanaChange }: {
  district: string;
  thana: string;
  onDistrictChange: (value: string) => void;
  onThanaChange: (value: string) => void;
}) {
  const selectedDistrict = findBangladeshDistrict(district);
  const upazilas = getBangladeshUpazilas(district);
  const selectedUpazila = upazilas.find((upazila) => upazila.english.toLocaleLowerCase() === thana.toLocaleLowerCase() || upazila.bangla === thana);

  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <label className="block text-xs font-bold text-stone-600">জেলা *<SearchableDistrictSelect required value={selectedDistrict?.english || ''} onChange={onDistrictChange} className="mt-1.5 rounded-lg" /><span className="mt-1 block text-[10px] font-normal text-stone-500">বাংলা বা ইংরেজিতে জেলার নাম লিখে খুঁজুন</span></label>
    <label className="block text-xs font-bold text-stone-600">উপজেলা / থানা *<select required disabled={!selectedDistrict} value={selectedUpazila?.english || ''} onChange={(event) => onThanaChange(event.target.value)} className="mt-1.5 h-11 w-full border border-stone-300 px-3 text-sm font-normal text-stone-900 outline-none focus:border-[#8c6d3f] disabled:cursor-not-allowed disabled:opacity-55">
      <option value="" disabled>{selectedDistrict ? 'উপজেলা / থানা নির্বাচন করুন' : 'আগে জেলা নির্বাচন করুন'}</option>
      {upazilas.map((item) => <option key={item.id} value={item.english}>{item.bangla} ({item.english})</option>)}
    </select><span className="mt-1 block text-[10px] font-normal text-stone-500">জেলা অনুযায়ী উপজেলা দেখানো হবে</span></label>
  </div>;
}
function ProductCard({ product, saved, onToggleWishlist, onAddToCart, onBuyNow }: {
  product: Product;
  saved: boolean;
  onToggleWishlist: (id: string) => void;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
}) {
  const productImages = (product.images?.length ? product.images : [product.imageUrl || ''])
    .map((image) => normalizeImageUrl(image))
    .filter(Boolean);
  const [imageIndex, setImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<'cart' | 'buy' | null>(null);
  const discountPercent = getDiscountPercent(product);
  const unavailable = product.inStock === false || (product.productType === 'variant'
    ? !product.variants?.some((variant) => variant.stock > 0)
    : product.stock !== undefined && product.stock < 1);
  const activeImage = productImages[imageIndex] || '';
  const hoverImage = productImages.length > 1 ? productImages[(imageIndex + 1) % productImages.length] : '';
  const showImage = (index: number) => setImageIndex((index + productImages.length) % productImages.length);
  const runAction = (action: 'cart' | 'buy') => {
    setActionLoading(action);
    if (action === 'cart') onAddToCart(product);
    else window.setTimeout(() => onBuyNow(product), 120);
    window.setTimeout(() => setActionLoading(null), 700);
  };

  return <article className="product-card group flex h-full flex-col">
    <div className="product-card-image relative aspect-[3/4] overflow-hidden bg-[#eee8df]" onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)} onTouchEnd={(event) => {
      const touchEnd = event.changedTouches[0]?.clientX;
      if (touchStart !== null && touchEnd !== undefined && Math.abs(touchEnd - touchStart) > 40 && productImages.length > 1) showImage(imageIndex + (touchEnd < touchStart ? 1 : -1));
      setTouchStart(null);
    }}>
      {activeImage ? <>
        <Image src={activeImage} alt={product.name} fill sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw" quality={75} loading="lazy" unoptimized={activeImage.startsWith('http')} className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105" />
        {hoverImage && <Image src={hoverImage} alt="" aria-hidden="true" fill sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw" quality={75} loading="lazy" unoptimized={hoverImage.startsWith('http')} className="pointer-events-none h-full w-full object-cover object-center opacity-0 transition-opacity duration-300 group-hover:opacity-100" />}
      </> : <div className="grid size-full place-items-center text-4xl text-[#b9ab95]">◇</div>}
      {productImages.length > 1 && <>
        <button type="button" onClick={() => showImage(imageIndex - 1)} aria-label="আগের ছবি" className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-stone-900 shadow transition hover:scale-105"><ArrowLeft className="size-4" /></button>
        <button type="button" onClick={() => showImage(imageIndex + 1)} aria-label="পরের ছবি" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-stone-900 shadow transition hover:scale-105"><ArrowRight className="size-4" /></button>
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5" aria-label="ছবি নির্বাচন">
          {productImages.map((_, index) => <button key={index} type="button" onClick={() => showImage(index)} aria-label={`${index + 1} নম্বর ছবি`} aria-current={imageIndex === index} className={`size-2 rounded-full transition ${imageIndex === index ? 'bg-white' : 'bg-white/55'}`} />)}
        </div>
      </>}
      {discountPercent > 0 && <span className="product-discount absolute left-2.5 top-2.5 sm:left-3 sm:top-3">{discountPercent}% ছাড়</span>}
      <button type="button" onClick={() => onToggleWishlist(product._id)} aria-label={saved ? 'ইচ্ছেতালিকা থেকে সরান' : 'ইচ্ছেতালিকায় যোগ করুন'} aria-pressed={saved} className={`product-heart absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full transition duration-200 hover:scale-110 sm:right-3 sm:top-3 sm:size-10 ${saved ? 'is-saved' : ''}`}><Heart className="size-4 sm:size-[18px]" fill={saved ? 'currentColor' : 'none'} strokeWidth={1.7} /></button>
    </div>
    <div className="product-card-copy flex min-w-0 flex-1 flex-col px-2 pb-2.5 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
      <p className="product-category mb-1 min-h-[13px] truncate text-[9px] font-semibold uppercase tracking-wide sm:mb-1.5 sm:min-h-4 sm:text-[11px]">{product.category || '\u00a0'}</p>
      <h3 className="line-clamp-2 min-h-9 text-[11px] font-semibold leading-[1.15rem] text-stone-900 sm:min-h-10 sm:text-sm sm:leading-5">{product.name}</h3>
      <p className="product-price mt-1 flex min-h-8 min-w-0 flex-wrap items-baseline gap-x-1.5 text-[13px] font-bold sm:mt-1.5 sm:min-h-10 sm:gap-x-2 sm:text-base">{discountPercent > 0 && <del className="text-[10px] font-medium text-stone-500 sm:text-xs">{money(getRegularPrice(product))}</del>}<span>{money(getSalePrice(product))}</span></p>
      <div className="product-actions mt-auto grid grid-cols-2 gap-1 pt-2.5 sm:gap-2 sm:pt-4">
        <button type="button" onClick={() => runAction('cart')} disabled={actionLoading !== null || unavailable} aria-label={`${product.name} কার্টে যোগ করুন`} title="কার্টে যোগ করুন" className={`product-add-cart inline-flex min-h-9 min-w-0 items-center justify-center gap-0.5 rounded-md px-0.5 text-[8px] font-bold transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:gap-1.5 sm:rounded-lg sm:px-2 sm:text-[11px] ${actionLoading === 'cart' ? 'animate-pulse' : ''}`}>{actionLoading === 'cart' ? <LoaderCircle className="size-3 shrink-0 animate-spin sm:size-3.5" /> : <ShoppingCart className="size-3 shrink-0 sm:size-3.5" />}<span className="truncate">{unavailable ? 'স্টক শেষ' : 'কার্টে যোগ'}</span></button>
        <button type="button" onClick={() => runAction('buy')} disabled={actionLoading !== null || unavailable} aria-label={`${product.name} অর্ডার করুন`} className={`product-buy-now inline-flex min-h-9 min-w-0 items-center justify-center gap-0.5 rounded-md px-0.5 text-[8px] font-bold transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:gap-1.5 sm:rounded-lg sm:px-2 sm:text-[11px] ${actionLoading === 'buy' ? 'animate-pulse' : ''}`}>{actionLoading === 'buy' ? <LoaderCircle className="size-3 shrink-0 animate-spin sm:size-3.5" /> : <Zap className="size-3 shrink-0 sm:size-3.5" />}<span className="truncate">{unavailable ? 'স্টক শেষ' : 'অর্ডার করুন'}</span></button>
      </div>
    </div>
  </article>;
}

export default function Storefront() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeSections, setStoreSections] = useState<StoreSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [category, setCategory] = useState('সব ক্যাটাগরি');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartSessionId, setCartSessionId] = useState('');
  const [cartToast, setCartToast] = useState('');
  const [checkout, setCheckout] = useState<CartLine[] | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [thana, setThana] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [failedLogoSrc, setFailedLogoSrc] = useState('');
  const [bannerSlide, setBannerSlide] = useState(0);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [productView, setProductView] = useState<'all' | 'wishlist'>('all');
  const [mobileNavActive, setMobileNavActive] = useState<'home' | 'categories' | 'wishlist' | 'orders' | 'account'>('home');
  const [quickPanel, setQuickPanel] = useState<'orders' | 'account' | null>(null);
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState<GuestProfile>({ customerName: '', customerPhone: '', district: '', thana: '', customerAddress: '' });
  const [orderReceipts, setOrderReceipts] = useState<OrderReceipt[]>([]);
  const logoSrc = normalizeImageUrl(settings.logoUrl);

  useEffect(() => {
    let mounted = true;
    fetch('/api/products')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'পণ্য লোড করা যায়নি।');
        if (mounted) setProducts(result.data);
      })
      .catch(() => { if (mounted) setLoadError('পণ্য দেখাতে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/product-sections').then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'হোমপেজ সেকশন লোড করা যায়নি।');
      if (mounted) setStoreSections(result.data);
    }).catch(() => { if (mounted) setStoreSections([]); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/categories')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error('ক্যাটাগরি লোড করা যায়নি।');
        if (mounted && Array.isArray(result.data)) setCategories(result.data);
      })
      .catch(() => { if (mounted) setCategories([]); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/settings')
      .then((response) => response.json())
      .then((result) => { if (mounted && result.success) setSettings({ ...defaultSettings, ...result.data }); })
      .catch(() => undefined);

    const hydrationTimer = window.setTimeout(() => {
      if (!mounted) return;
      try {
        const storedProfile = localStorage.getItem('ghorbazar-profile');
        const storedReceipts = localStorage.getItem('ghorbazar-orders');
        const storedCart = localStorage.getItem('smartwearbd-cart');
        let storedSessionId = localStorage.getItem('smartwearbd-cart-session');
        if (!storedSessionId) {
          storedSessionId = crypto.randomUUID();
          localStorage.setItem('smartwearbd-cart-session', storedSessionId);
        }
        setCartSessionId(storedSessionId);
        if (storedProfile) setGuestProfile(JSON.parse(storedProfile));
        if (storedReceipts) setOrderReceipts(JSON.parse(storedReceipts));
        if (storedCart) {
          const parsedCart = JSON.parse(storedCart);
          if (Array.isArray(parsedCart)) setCart(parsedCart);
        }
      } catch {
        localStorage.removeItem('ghorbazar-profile');
        localStorage.removeItem('ghorbazar-orders');
        localStorage.removeItem('smartwearbd-cart');
      } finally {
        setCartHydrated(true);
      }
    }, 0);

    return () => { mounted = false; window.clearTimeout(hydrationTimer); };
  }, []);

  useEffect(() => {
    if (cartHydrated) localStorage.setItem('smartwearbd-cart', JSON.stringify(cart));
  }, [cart, cartHydrated]);

  useEffect(() => {
    if (!cartHydrated || !cartSessionId || !cart.length) return;
    const timer = window.setTimeout(() => {
      void fetch('/api/abandoned-carts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: cartSessionId, stage: checkout ? 'checkout' : 'cart', customerName, customerPhone, district, thana, customerAddress, items: cart.map(({ product, quantity, variant }) => ({ productId: product._id, name: product.name, price: getSalePrice(product), quantity, variant, imageUrl: product.images?.[0] || product.imageUrl || '' })) }),
      }).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [cart, cartHydrated, cartSessionId, checkout, customerName, customerPhone, district, thana, customerAddress]);

  useEffect(() => {
    const bannerCount = settings.banners.filter((banner) => banner.imageUrl).length || 1;
    const timer = window.setInterval(() => setBannerSlide((current) => (current + 1) % bannerCount), 6500);
    return () => window.clearInterval(timer);
  }, [settings.banners]);

  const shownProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category.startsWith('সব ') || category === 'হট ডিলস' || product.category === category || product.subCategory === category;
    const term = search.trim().toLocaleLowerCase();
    const matchesView = productView === 'all' || wishlist.includes(product._id);
    return matchesCategory && matchesView && (!term || `${product.name} ${product.category || ''} ${product.description || ''}`.toLocaleLowerCase().includes(term));
  }), [category, productView, products, search, wishlist]);
  const fallbackSlides = [{
    label: settings.storeName,
    title: settings.heroTitle,
    subtitle: settings.slogan || settings.heroSubtitle,
    offer: settings.promotionText,
    image: normalizeImageUrl(settings.heroImageUrl),
  }];
  const configuredBanners = settings.banners.filter((banner) => banner.imageUrl);
  const slides = configuredBanners.length ? configuredBanners.map((banner) => ({
    label: settings.storeName,
    title: settings.heroTitle,
    subtitle: settings.slogan || settings.heroSubtitle,
    offer: settings.promotionText,
    image: normalizeImageUrl(banner.imageUrl),
    link: banner.link || '#products',
  })) : fallbackSlides.map((slide) => ({ ...slide, link: '#products' }));
  const currentSlide = slides[bannerSlide % slides.length];
  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);
  const checkoutSubtotal = checkout?.reduce((total, line) => total + getSalePrice(line.product) * line.quantity, 0) || 0;
  const matchedDeliveryZone = settings.deliveryZones.find((zone) => zone.name.trim().toLocaleLowerCase() === district.trim().toLocaleLowerCase());
  const zoneLabel = district.toLocaleLowerCase() === 'dhaka' ? 'inside city' : 'outside city';
  const regionalDeliveryZone = settings.deliveryZones.find((zone) => zone.name.trim().toLocaleLowerCase() === zoneLabel);
  const shippingFee = checkout?.length && checkout.every((line) => line.product.freeShipping) ? 0
    : matchedDeliveryZone?.fee ?? regionalDeliveryZone?.fee ?? (district ? (isKhulnaDistrict(district) ? 80 : 150) : 0);
  const checkoutTotal = Math.max(0, checkoutSubtotal + shippingFee - (appliedCoupon?.discount || 0));
  const popularProducts = (products.some((product) => product.featured) ? products.filter((product) => product.featured) : products).slice(0, 4);

  const addToCart = (product: Product) => {
    if (product.productType === 'variant') {
      router.push(`/products/${product._id}`);
      return;
    }
    const existing = cart.find((line) => line.product._id === product._id);
    const nextQuantity = (existing?.quantity || 0) + 1;
    if (product.maxOrderQuantity && nextQuantity > product.maxOrderQuantity || product.stock !== undefined && nextQuantity > product.stock) {
      setCartToast(`“${product.name}”-এর সর্বোচ্চ অর্ডার পরিমাণ/স্টক অতিক্রম হয়েছে`);
      window.setTimeout(() => setCartToast(''), 2400);
      return;
    }
    const updatedCart = existing
      ? cart.map((line) => line.product._id === product._id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...cart, { product, quantity: 1 }];
    setCart(updatedCart);
    localStorage.setItem('smartwearbd-cart', JSON.stringify(updatedCart));
    setCartToast(`${product.name} কার্টে যোগ হয়েছে`);
    window.setTimeout(() => setCartToast(''), 2400);
    return updatedCart;
  };

  const buyNow = (product: Product) => {
    if (product.productType === 'variant') {
      router.push(`/products/${product._id}`);
      return;
    }
    addToCart(product);
    localStorage.setItem('smartwearbd-checkout', JSON.stringify([{ product, quantity: 1 }]));
    router.push('/checkout');
  };

  const changeQuantity = (id: string, delta: number, variant?: string) => {
    setAppliedCoupon(null);
    setCouponMessage('');
    setCheckout((current) => current?.map((line) => {
      const matches = line.product._id === id && line.variant === variant;
      if (!matches) return line;
      const limit = Math.min(line.product.stock ?? Number.MAX_SAFE_INTEGER, line.product.maxOrderQuantity || Number.MAX_SAFE_INTEGER);
      return { ...line, quantity: Math.min(limit, Math.max(1, line.quantity + delta)) };
    }) ?? null);
  };
  const removeCheckoutItem = (id: string, variant?: string) => {
    setAppliedCoupon(null);
    setCouponMessage('');
    setCheckout((current) => current?.filter((line) => !(line.product._id === id && line.variant === variant)) ?? null);
    setCart((current) => current.filter((line) => !(line.product._id === id && line.variant === variant)));
  };

  const startCheckout = (items: CartLine[]) => {
    setCheckout(items);
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponMessage('');
    setMessage(null);
    if (guestProfile) {
      setCustomerName(guestProfile.customerName);
      setCustomerPhone(guestProfile.customerPhone);
      setDistrict(guestProfile.district);
      setThana(guestProfile.thana);
      setCustomerAddress(guestProfile.customerAddress);
    }
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  };

  const saveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^01[3-9]\d{8}$/.test(profileDraft.customerPhone)) return;
    setGuestProfile(profileDraft);
    setCustomerName(profileDraft.customerName);
    setCustomerPhone(profileDraft.customerPhone);
    setDistrict(profileDraft.district);
    setThana(profileDraft.thana);
    setCustomerAddress(profileDraft.customerAddress);
    localStorage.setItem('ghorbazar-profile', JSON.stringify(profileDraft));
    setQuickPanel(null);
  };

  const closeCheckout = () => { setCheckout(null); setMessage(null); };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return setCouponMessage('কুপন কোড লিখুন।');
    setCouponBusy(true);
    setCouponMessage('');
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, subtotal: checkoutSubtotal }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'কুপন যাচাই করা যায়নি।');
      setAppliedCoupon({ code: result.data.code, discount: result.data.discount });
      setCouponCode(result.data.code);
      setCouponMessage('কুপন প্রয়োগ হয়েছে।');
    } catch (reason) {
      setAppliedCoupon(null);
      setCouponMessage(reason instanceof Error ? reason.message : 'কুপন যাচাই করা যায়নি।');
    } finally {
      setCouponBusy(false);
    }
  };

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkout?.length) return;
    if (!/^01[3-9]\d{8}$/.test(customerPhone)) {
      setMessage({ success: false, text: 'সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন।' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          district,
          thana,
          customerAddress: `জেলা: ${district}, থানা: ${thana}, ঠিকানা: ${customerAddress}`,
          shippingAddress: `জেলা: ${district}, থানা: ${thana}, ঠিকানা: ${customerAddress}`,
          userEmail: userEmail.trim() || 'guest@example.com',
          cartSessionId: localStorage.getItem('smartwearbd-cart-session') || '',
          couponCode: appliedCoupon?.code || '',
          items: checkout.map(({ product, quantity, variant }) => ({ productId: product._id, name: product.name, price: product.price, quantity, variant, imageUrl: product.images?.[0] || product.imageUrl || '' })),
          shippingFee,
          totalAmount: checkoutTotal,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'অর্ডার জমা দেওয়া যায়নি।');
      setMessage({ success: true, text: 'আপনার অর্ডারটি সফলভাবে জমা হয়েছে। আমরা শিগগিরই যোগাযোগ করব।' });
      const receipt: OrderReceipt = { id: String(result.data?._id || result.data?.id || ''), totalAmount: Number(result.data?.totalAmount ?? checkoutTotal), submittedAt: new Date().toISOString() };
      if (receipt.id) {
        const nextReceipts = [receipt, ...orderReceipts].slice(0, 10);
        setOrderReceipts(nextReceipts);
        localStorage.setItem('ghorbazar-orders', JSON.stringify(nextReceipts));
      }
      const profile = { customerName, customerPhone, district, thana, customerAddress };
      setGuestProfile(profile);
      localStorage.setItem('ghorbazar-profile', JSON.stringify(profile));
      setCart((current) => current
        .map((line) => {
          const orderedItem = checkout.find((item) => item.product._id === line.product._id);
          return orderedItem ? { ...line, quantity: Math.max(0, line.quantity - orderedItem.quantity) } : line;
        })
        .filter((line) => line.quantity > 0));
      setCustomerName(''); setCustomerPhone(''); setDistrict(''); setThana(''); setCustomerAddress(''); setUserEmail('');
    } catch (error) {
      setMessage({ success: false, text: error instanceof Error ? error.message : 'একটি সমস্যা হয়েছে, আবার চেষ্টা করুন।' });
    } finally { setSubmitting(false); }
  };

  return (
    <main id="top" style={{ '--store-bronze': settings.primaryColor, '--store-cream': settings.backgroundColor } as CSSProperties} className="storefront-theme min-h-screen overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom))] text-[#1a1a1a] sm:pb-0">
      {(settings.marqueeText || '').trim() && <div className="store-announcement px-4 py-2 text-center text-[10px] font-semibold sm:text-[11px]"><div className="store-announcement-track"><span className="store-announcement-copy">{settings.marqueeText}</span></div></div>}
      <header className="store-header sticky top-0 z-40">
        <div className="store-header-main relative mx-auto grid min-h-[72px] max-w-7xl grid-cols-[minmax(42px,1fr)_minmax(0,auto)_minmax(42px,1fr)] items-center gap-1 px-3 sm:min-h-[88px] sm:gap-3 sm:px-8">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="মেনু খুলুন" className="store-icon-button justify-self-start"><Menu className="size-[21px]" strokeWidth={1.6} /></button>
          <Link href="/" aria-label={`${settings.storeName || 'SmartWearBD'} হোম`} className="store-brand flex min-w-0 max-w-[52vw] flex-col items-center text-center sm:max-w-none">
            {logoSrc && failedLogoSrc !== logoSrc ? <Image src={logoSrc} alt="" width={160} height={40} quality={80} unoptimized={logoSrc.startsWith('http')} onError={() => setFailedLogoSrc(logoSrc)} className="mb-1 h-8 w-auto max-w-36 object-contain sm:h-9 sm:max-w-40" /> : <span className="store-brand-wordmark max-w-[48vw] truncate">SmartWearBD</span>}
            {settings.slogan.trim() && <span className="store-brand-sub mt-1 max-w-full text-[7px] font-semibold leading-tight tracking-[0.08em] sm:mt-1.5 sm:text-[9px]">{settings.slogan}</span>}
          </Link>
          <div className="flex items-center justify-self-end gap-1 sm:gap-2">
            <button type="button" onClick={() => setSearchOpen((open) => !open)} aria-label="পণ্য খুঁজুন" aria-expanded={searchOpen} className="store-icon-button"><Search className="size-[19px]" strokeWidth={1.6} /></button>
            <button type="button" onClick={() => startCheckout(cart)} aria-label={`কার্ট, ${cartCount}টি পণ্য`} className="store-icon-button relative"><ShoppingBag className="size-[19px]" strokeWidth={1.6} /><span className="store-cart-count">{cartCount}</span></button>
          </div>
        </div>
        {searchOpen && <div className="store-search-row px-4 py-3 sm:px-8"><label className="mx-auto flex max-w-3xl items-center gap-3" role="search"><Search className="size-4 shrink-0" /><span className="sr-only">পণ্য খুঁজুন</span><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }} placeholder="পণ্য, কালেকশন বা ক্যাটাগরি খুঁজুন" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /><button type="button" onClick={() => { setSearch(''); setSearchOpen(false); }} aria-label="অনুসন্ধান বন্ধ করুন" className="store-icon-button"><X className="size-4" /></button></label></div>}
      </header>

      <div className="mx-auto max-w-[1440px] px-3 pb-16 sm:px-7 lg:px-10">
        <section aria-roledescription="carousel" aria-label="নতুন কালেকশন" className="store-hero relative mt-3 min-h-[420px] overflow-hidden rounded-2xl sm:mt-6 sm:min-h-[520px] lg:min-h-[600px]">
          {currentSlide.image && <Image src={currentSlide.image} alt="ঐতিহ্যবাহী পোশাকে ফ্যাশন কালেকশন" fill sizes="100vw" quality={80} fetchPriority="high" unoptimized={currentSlide.image.startsWith('http')} className="store-hero-image object-cover" />}
          <div className="store-hero-shade absolute inset-0" />
          <div className="relative z-10 flex min-h-[420px] max-w-2xl flex-col items-start justify-center px-5 py-10 text-white sm:min-h-[520px] sm:px-14 sm:py-12 lg:min-h-[600px] lg:px-20">
            <span className="store-hero-label mb-5 inline-flex items-center gap-2 text-[10px] font-semibold uppercase sm:text-xs"><span className="size-1.5 rounded-full bg-[#d6b879]" />{currentSlide.label}</span>
            <h1 className="max-w-xl text-[clamp(2rem,8vw,3rem)] font-medium leading-[1.12] sm:text-6xl">{currentSlide.title}</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/85 sm:mt-5 sm:text-base sm:leading-7">{currentSlide.subtitle}</p>
            <a href={currentSlide.link} className="store-hero-cta mt-8 inline-flex min-h-12 items-center gap-3 rounded-lg px-6 text-[11px] font-bold uppercase">SHOP NOW <ArrowRight className="size-4" /></a>
          </div>
          <div className="store-hero-controls absolute bottom-5 right-5 z-10 flex items-center gap-4 sm:bottom-7 sm:right-8"><span className="hidden text-[10px] font-semibold uppercase sm:inline">{settings.promotionLabel} <span className="mx-1 text-[#d6b879]">/</span> {currentSlide.offer}</span><div className="flex gap-2" aria-label="ব্যানার নির্বাচন">{slides.map((slide, index) => <button key={slide.label} type="button" onClick={() => setBannerSlide(index)} aria-label={`${index + 1} নম্বর ব্যানার`} aria-current={bannerSlide === index} className={`size-2 rounded-full transition ${bannerSlide === index ? 'bg-white' : 'bg-white/45'}`} />)}</div></div>
        </section>

        <section aria-label="সেবার সুবিধা" className="store-values grid grid-cols-1 gap-4 border-b py-6 sm:grid-cols-3 sm:gap-0 sm:py-8">
          <div className="store-value-item"><ShieldCheck className="size-5" strokeWidth={1.5} /><span><strong>Premium quality</strong><small>যত্নে বেছে নেওয়া কাপড় ও কারুকাজ</small></span></div>
          <div className="store-value-item"><Truck className="size-5" strokeWidth={1.5} /><span><strong>Fast delivery</strong><small>সারা দেশে নির্ভরযোগ্য ডেলিভারি</small></span></div>
          <div className="store-value-item"><LockKeyhole className="size-5" strokeWidth={1.5} /><span><strong>Secure payments</strong><small>নিরাপদ পেমেন্ট, নিশ্চিন্ত কেনাকাটা</small></span></div>
        </section>

        <section id="categories" aria-label="ক্যাটাগরি" className="store-section scroll-mt-36 py-9 sm:py-12">
          <div className="store-section-heading"><div><p className="store-eyebrow">FIND YOUR LOOK</p><h2>আপনার পছন্দের বিভাগ</h2></div><button type="button" onClick={() => { setCategory('সব ক্যাটাগরি'); setProductView('all'); setMobileNavActive('categories'); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }} className="store-text-link">সব দেখুন <ChevronRight className="size-4" /></button></div>
          <div className="store-category-grid">{categories.map((item) => { const categoryProduct = products.find((product) => product.category === item.name); const imageUrl = normalizeImageUrl(item.imageUrl || categoryProduct?.images?.[0] || categoryProduct?.imageUrl || ''); return imageUrl ? <button key={item._id} type="button" onClick={() => { setCategory(item.name); setProductView('all'); setMobileNavActive('categories'); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }} className="store-category group">
            <span className="store-category-image"><Image src={imageUrl} alt={item.name} fill sizes="104px" quality={75} loading="lazy" unoptimized={imageUrl.startsWith('http')} className="object-cover transition duration-700 group-hover:scale-105" /></span><span className="store-category-name">{item.name}</span>{item.description && <span className="mt-1 block text-center text-[10px] leading-4 text-stone-500">{item.description}</span>}
          </button> : null; })}</div>
        </section>

        <section id="products" className="store-section scroll-mt-36 pb-10 pt-3 sm:pb-14 sm:pt-5">
          <div className="store-section-heading"><div><p className="store-eyebrow">THE NEW EDIT</p><h2>{productView === 'wishlist' ? 'আপনার ইচ্ছেতালিকা' : category === 'সব ক্যাটাগরি' ? 'নতুন কালেকশন' : category}</h2></div><span className="store-product-count">{new Intl.NumberFormat('bn-BD').format(shownProducts.length)}টি পণ্য</span></div>
          {loading ? <div className="store-product-grid grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">{[1, 2, 3, 4].map((item) => <div key={item} className="aspect-[3/4] animate-pulse rounded-xl bg-[#eee8df]" />)}</div> : loadError ? <p role="alert" className="store-message">{loadError}</p> : shownProducts.length ? <div className="store-product-grid grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">{shownProducts.slice(0, 8).map((product) => <ProductCard key={product._id} product={product} saved={wishlist.includes(product._id)} onToggleWishlist={toggleWishlist} onAddToCart={addToCart} onBuyNow={buyNow} />)}</div> : <div className="store-empty-state"><span className="grid size-14 place-items-center rounded-full bg-[#f2eee7] text-2xl text-[#9c8866]">⌕</span><h3 className="mt-4 text-lg font-semibold">এখনো কোনো পণ্য পাওয়া যায়নি</h3><p className="mt-2 text-sm">অন্য ক্যাটাগরি বেছে নিন অথবা পরে আবার দেখুন।</p><button type="button" onClick={() => { setCategory('সব ক্যাটাগরি'); setProductView('all'); setSearch(''); }} className="store-text-link mt-4">সব পণ্য দেখুন <ChevronRight className="size-4" /></button></div>}
        </section>

        {productView !== 'wishlist' && popularProducts.length > 0 && <section className="store-popular-section store-section border-t py-9 sm:py-12">
          <div className="store-section-heading"><div><p className="store-eyebrow">MOST LOVED</p><h2>জনপ্রিয় পছন্দ</h2></div><span className="store-section-note">আপনার পরের প্রিয়টি খুঁজে নিন</span></div>
          <div className="store-product-grid grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">{popularProducts.map((product) => <ProductCard key={`popular-${product._id}`} product={product} saved={wishlist.includes(product._id)} onToggleWishlist={toggleWishlist} onAddToCart={addToCart} onBuyNow={buyNow} />)}</div>
        </section>}
        {productView !== 'wishlist' && storeSections.map((section) => {
          const sectionProducts = products.filter((product) => product.sectionIds?.includes(section._id)).slice(0, 8);
          if (!sectionProducts.length) return null;
          return <section key={section._id} className="store-section border-t py-9 sm:py-12">
            <div className="store-section-heading"><div><p className="store-eyebrow">CURATED FOR YOU</p><h2>{section.name}</h2></div><span className="store-section-note">{section.description}</span></div>
            <div className="store-product-grid grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">{sectionProducts.map((product) => <ProductCard key={`${section._id}-${product._id}`} product={product} saved={wishlist.includes(product._id)} onToggleWishlist={toggleWishlist} onAddToCart={addToCart} onBuyNow={buyNow} />)}</div>
          </section>;
        })}
      </div>

      <footer className="store-footer px-5 py-10 sm:px-8 sm:py-12">
        <div className="mx-auto grid max-w-7xl gap-9 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div><div className="store-footer-brand">{settings.storeName || 'My Store'}</div><p className="mt-3 max-w-xs text-sm leading-6">{settings.description || 'বাংলাদেশের ঐতিহ্য, আধুনিক নকশা আর যত্নে তৈরি পোশাকের এক সুন্দর ঠিকানা।'}</p>{settings.address && <p className="mt-3 text-sm">{settings.address}</p>}{[settings.phone1, settings.phone2, settings.contactEmail].filter(Boolean).map((contact) => <p key={contact} className="mt-1 text-sm">{contact}</p>)}<div className="mt-3 flex flex-wrap gap-3 text-sm">{Object.entries(settings.socialLinks || {}).filter(([, url]) => url).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer" className="capitalize underline">{name}</a>)}</div></div>
          <div><h2 className="store-footer-heading">SHOP</h2><div className="mt-4 grid gap-3 text-sm">{categories.map((item) => <button key={item._id} type="button" onClick={() => { setCategory(item.name); setProductView('all'); setMobileNavActive('categories'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{item.name}</button>)}</div></div>
          <div><h2 className="store-footer-heading">HELP</h2><div className="mt-4 grid gap-3 text-sm"><button type="button" onClick={() => setQuickPanel('orders')}>অর্ডার ট্র্যাক করুন</button><Link href="/contact">যোগাযোগ করুন</Link><Link href="/account">অ্যাকাউন্ট</Link><span>সারা বাংলাদেশে ডেলিভারি</span></div></div>
          <div><h2 className="store-footer-heading">WE ACCEPT</h2><div className="mt-4 flex items-center gap-2"><span className="store-payment-mark">COD</span><span className="store-payment-mark">৳</span><span className="store-payment-mark">✓</span></div></div>
        </div>
        <nav aria-label="Store policies" className="mx-auto mt-8 flex max-w-7xl flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-xs">
          {storePolicyLinks.map(([slug, label]) => <Link key={slug} href={`/policies/${slug}`} className="transition hover:underline">{label}</Link>)}
        </nav>
        <div className="mx-auto mt-9 flex max-w-7xl flex-col gap-2 border-t pt-5 text-xs sm:flex-row sm:items-center sm:justify-between"><span>© ২০২৬ {settings.storeName || 'My Store'} · ঢাকা, বাংলাদেশ</span><span>Crafted with care in Bangladesh</span></div>
      </footer>

      {cartToast && <p role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#132e20] px-4 py-3 text-sm font-semibold text-white shadow-xl sm:bottom-6">{cartToast}</p>}

      {menuOpen && <div className="store-drawer-backdrop fixed inset-0 z-50" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}><aside role="dialog" aria-modal="true" aria-label="দোকানের মেনু" className="store-drawer h-full w-[min(86vw,360px)] overflow-y-auto px-6 py-6"><div className="flex items-center justify-between border-b pb-5"><span className="store-footer-brand">{settings.storeName || 'My Store'}</span><button type="button" onClick={() => setMenuOpen(false)} aria-label="মেনু বন্ধ করুন" className="store-icon-button"><X className="size-5" /></button></div><div className="grid gap-1 py-5"><p className="store-eyebrow mb-2">SHOP BY CATEGORY</p>{categories.map((item) => <button key={item._id} type="button" onClick={() => { setCategory(item.name); setProductView('all'); setMenuOpen(false); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }} className="store-drawer-link">{normalizeImageUrl(item.imageUrl || '') && <span className="size-10 overflow-hidden rounded-full"><img src={normalizeImageUrl(item.imageUrl || '')} alt={item.name} className="size-full object-cover" /></span>}<span>{item.name}</span><ChevronRight className="ml-auto size-4" /></button>)}</div></aside></div>}

      <nav aria-label="মোবাইল নেভিগেশন" className="store-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 pb-[env(safe-area-inset-bottom)] sm:hidden">
        <a href="#top" onClick={() => { setProductView('all'); setCategory('সব ক্যাটাগরি'); setMobileNavActive('home'); }} aria-current={mobileNavActive === 'home' ? 'page' : undefined} className={`store-mobile-nav-item ${mobileNavActive === 'home' ? 'is-active' : ''}`}><House className="size-[19px]" strokeWidth={1.7} /><span>হোম</span></a>
        <button type="button" onClick={() => { setCategory('সব ক্যাটাগরি'); setProductView('all'); setMobileNavActive('categories'); document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' }); }} aria-current={mobileNavActive === 'categories' ? 'page' : undefined} className={`store-mobile-nav-item ${mobileNavActive === 'categories' ? 'is-active' : ''}`}><Menu className="size-[19px]" strokeWidth={1.7} /><span>ক্যাটাগরি</span></button>
        <button type="button" onClick={() => { setProductView('wishlist'); setMobileNavActive('wishlist'); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }} aria-current={mobileNavActive === 'wishlist' ? 'page' : undefined} className={`store-mobile-nav-item ${mobileNavActive === 'wishlist' ? 'is-active' : ''}`}><Heart className="size-[19px]" strokeWidth={1.7} /><span>ইচ্ছেতালিকা</span></button>
        <button type="button" onClick={() => { setMobileNavActive('orders'); setQuickPanel('orders'); }} aria-current={mobileNavActive === 'orders' ? 'page' : undefined} className={`store-mobile-nav-item ${mobileNavActive === 'orders' ? 'is-active' : ''}`}><PackageCheck className="size-[19px]" strokeWidth={1.7} /><span>অর্ডার</span></button>
        <Link href="/account" aria-current={mobileNavActive === 'account' ? 'page' : undefined} className={`store-mobile-nav-item ${mobileNavActive === 'account' ? 'is-active' : ''}`}><UserRound className="size-[19px]" strokeWidth={1.7} /><span>অ্যাকাউন্ট</span></Link>
      </nav>

      {quickPanel && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickPanel(null); }}><section role="dialog" aria-modal="true" aria-labelledby="quick-panel-title" className="max-h-[88vh] w-full max-w-lg overflow-y-auto bg-white shadow-2xl sm:max-h-[80vh]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4"><h2 id="quick-panel-title" className="text-lg font-black">{quickPanel === 'orders' ? 'সাম্প্রতিক অর্ডার' : 'ডেলিভারি প্রোফাইল'}</h2><button type="button" onClick={() => setQuickPanel(null)} aria-label="বন্ধ করুন" className="grid size-9 place-items-center border border-stone-200 text-xl text-stone-500">×</button></div>
        {quickPanel === 'orders' ? <div className="p-5">{orderReceipts.length ? <ul className="divide-y divide-stone-200">{orderReceipts.map((receipt) => <li key={receipt.id} className="flex items-center justify-between gap-4 py-3"><span><strong className="block text-sm">অর্ডার #{receipt.id.slice(-8).toUpperCase()}</strong><time className="mt-1 block text-xs text-stone-500">{new Date(receipt.submittedAt).toLocaleDateString('bn-BD')}</time></span><span className="font-bold text-[#dc2626]">{money(receipt.totalAmount)}</span></li>)}</ul> : <div className="py-8 text-center"><p className="font-bold">এখনো কোনো অর্ডার নেই</p><p className="mt-1 text-sm text-stone-500">আপনার অর্ডার এখানে দেখা যাবে।</p></div>}</div> : <form onSubmit={saveProfile} className="space-y-3 p-5">
          <label className="block text-xs font-bold text-stone-600">আপনার নাম *<input required value={profileDraft.customerName} onChange={(event) => setProfileDraft({ ...profileDraft, customerName: event.target.value })} className="mt-1.5 h-10 w-full border border-stone-300 px-3 text-sm font-normal text-stone-900 outline-none focus:border-[#dc2626]" /></label>
          <label className="block text-xs font-bold text-stone-600">মোবাইল নম্বর *<input required pattern="01[3-9][0-9]{8}" maxLength={11} inputMode="numeric" value={profileDraft.customerPhone} onChange={(event) => setProfileDraft({ ...profileDraft, customerPhone: event.target.value.replace(/\D/g, '').slice(0, 11) })} className="mt-1.5 h-10 w-full border border-stone-300 px-3 text-sm font-normal text-stone-900 outline-none focus:border-[#dc2626]" placeholder="017XXXXXXXX" /></label>
          <LocationFields district={profileDraft.district} thana={profileDraft.thana} onDistrictChange={(value) => setProfileDraft((current) => ({ ...current, district: value, thana: '' }))} onThanaChange={(value) => setProfileDraft((current) => ({ ...current, thana: value }))} />
          <label className="block text-xs font-bold text-stone-600">সম্পূর্ণ ঠিকানা *<textarea required rows={2} value={profileDraft.customerAddress} onChange={(event) => setProfileDraft({ ...profileDraft, customerAddress: event.target.value })} className="mt-1.5 w-full border border-stone-300 px-3 py-2 text-sm font-normal text-stone-900 outline-none focus:border-[#dc2626]" /></label>
          <button type="submit" className="min-h-11 w-full bg-[#dc2626] px-4 text-sm font-bold text-white hover:bg-[#b91c1c]">প্রোফাইল সেভ করুন</button>
        </form>}
      </section></div>}

      <AnimatePresence>{checkout && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCheckout(); }}><motion.section role="dialog" aria-modal="true" aria-labelledby="checkout-title" initial={{ opacity: 0, y: 22, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.985 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#dc2626]">ক্যাশ অন ডেলিভারি</p><h2 id="checkout-title" className="mt-1 text-xl font-black">অর্ডার নিশ্চিত করুন</h2></div><button type="button" onClick={closeCheckout} aria-label="চেকআউট বন্ধ করুন" className="grid size-9 place-items-center border border-stone-200 text-xl text-stone-500 hover:bg-stone-100">×</button></div>
        {message?.success ? <div className="px-6 py-14 text-center sm:px-10"><span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">✓</span><h3 className="mt-4 text-xl font-black">ধন্যবাদ!</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-600">{message.text}</p><button type="button" onClick={closeCheckout} className="mt-6 bg-[#dc2626] px-6 py-3 text-sm font-bold text-white hover:bg-[#b91c1c]">কেনাকাটায় ফিরুন</button></div> : !checkout.length ? <div className="px-6 py-12 text-center"><div className="text-4xl">🛒</div><h3 className="mt-3 font-bold">আপনার কার্ট এখনো খালি</h3><p className="mt-1 text-sm text-stone-500">পছন্দের পণ্য কার্টে যোগ করুন।</p><button type="button" onClick={closeCheckout} className="mt-5 bg-[#dc2626] px-5 py-3 text-sm font-bold text-white">পণ্য দেখুন</button></div> : <form onSubmit={submitOrder} className="grid gap-6 px-5 py-5 sm:grid-cols-[0.9fr_1.1fr] sm:px-7 sm:py-7">
          <div><h3 className="mb-3 text-sm font-extrabold">আপনার অর্ডার</h3><div className="divide-y divide-stone-200 border-y border-stone-200">{checkout.map(({ product, quantity, variant }) => { const previewImages = (product.images?.length ? product.images : [product.imageUrl || '']).map((image) => normalizeImageUrl(image)).filter(Boolean); return <div key={`${product._id}-${variant || ''}`} className="py-3"><div className="flex gap-3">{previewImages[0] ? <img src={previewImages[0]} alt="" className="size-16 shrink-0 object-cover" /> : <div className="grid size-16 shrink-0 place-items-center bg-stone-100 text-stone-400">◇</div>}<div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-bold">{product.name}</p>{variant && <p className="text-xs text-stone-600">{Object.entries(JSON.parse(variant) as Record<string, string>).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>}<p className="mt-1 text-sm font-bold text-[#dc2626]">{money(getSalePrice(product))}</p><div className="mt-2 inline-flex items-center border border-stone-200"><button type="button" onClick={() => changeQuantity(product._id, -1, variant)} aria-label="পরিমাণ কমান" className="grid size-7 place-items-center hover:bg-stone-100">−</button><span className="min-w-7 text-center text-xs font-bold">{quantity}</span><button type="button" onClick={() => changeQuantity(product._id, 1, variant)} aria-label="পরিমাণ বাড়ান" className="grid size-7 place-items-center hover:bg-stone-100">+</button></div></div><button type="button" onClick={() => removeCheckoutItem(product._id, variant)} aria-label={`${product.name} কার্ট থেকে সরান`} title="পণ্য সরান" className="grid size-9 shrink-0 place-items-center text-red-700 transition hover:scale-105 hover:bg-red-50 active:scale-95"><Trash2 className="size-4" /></button></div>{previewImages.length > 1 && <div className="mt-2 flex gap-1.5">{previewImages.slice(1, 5).map((image, index) => <img key={`${image}-${index}`} src={image} alt="" className="size-9 border border-stone-200 object-cover" />)}</div>}</div>; })}</div><div className="checkout-totals mt-4"><div><span>পণ্যের মূল্য</span><strong>{money(checkoutSubtotal)}</strong></div><div><span>ডেলিভারি চার্জ</span><strong>{district ? money(shippingFee) : 'জেলা নির্বাচন করুন'}</strong></div><div className="checkout-grand-total"><span>সর্বমোট</span><strong>{money(checkoutTotal)}</strong></div></div></div>
          <div className="space-y-3"><h3 className="text-sm font-extrabold">ডেলিভারির তথ্য</h3>{settings.orderNote && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{settings.orderNote}</p>}
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3"><label className="block text-xs font-bold text-stone-700">কুপন কোড<input value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setAppliedCoupon(null); }} className="mt-1.5 h-10 w-full border border-stone-300 bg-white px-3 text-sm font-normal uppercase text-stone-900 outline-none focus:border-[#dc2626]" /></label><button type="button" disabled={couponBusy} onClick={() => void applyCoupon()} className="mt-2 min-h-9 rounded-md bg-stone-800 px-4 text-xs font-bold text-white disabled:opacity-60">{couponBusy ? 'যাচাই হচ্ছে...' : 'কুপন প্রয়োগ করুন'}</button>{couponMessage && <p role="status" className="mt-2 text-xs font-medium text-stone-700">{couponMessage}</p>}{appliedCoupon && <p className="mt-1 text-xs font-semibold text-emerald-700">ছাড়: {money(appliedCoupon.discount)}</p>}</div>
            <label className="block text-xs font-bold text-stone-600">আপনার নাম *<input required value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" className="mt-1.5 h-10 w-full border border-stone-300 px-3 text-sm font-normal text-stone-900 outline-none focus:border-[#dc2626]" placeholder="পূর্ণ নাম" /></label>
            <label className="block text-xs font-bold text-stone-600">মোবাইল নম্বর *<input required type="tel" inputMode="numeric" pattern="01[3-9][0-9]{8}" maxLength={11} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} autoComplete="tel" className="mt-1.5 h-10 w-full border border-stone-300 px-3 text-sm font-normal text-stone-900 outline-none focus:border-[#dc2626]" placeholder="017XXXXXXXX" /></label>
            <label className="block text-xs font-bold text-stone-600">ইমেইল (ঐচ্ছিক)<input type="email" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} autoComplete="email" className="mt-1.5 h-10 w-full border border-stone-300 px-3 text-sm font-normal text-stone-900 outline-none focus:border-[#dc2626]" placeholder="name@example.com" /></label>
            <LocationFields district={district} thana={thana} onDistrictChange={(value) => { setDistrict(value); setThana(''); }} onThanaChange={setThana} />
            <label className="block text-xs font-bold text-stone-600">সম্পূর্ণ ঠিকানা *<textarea required rows={2} value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} autoComplete="street-address" className="mt-1.5 w-full resize-y border border-stone-300 px-3 py-2 text-sm font-normal text-stone-900 outline-none focus:border-[#dc2626]" placeholder="বাসা, রোড, এলাকা" /></label>
            {message && <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">{message.text}</p>}
            <button type="submit" disabled={submitting} className="min-h-12 w-full bg-[#dc2626] px-4 text-sm font-extrabold text-white hover:bg-[#b91c1c] disabled:cursor-wait disabled:bg-red-300">{submitting ? 'অর্ডার জমা হচ্ছে…' : `অর্ডার কনফার্ম করুন · ${money(checkoutTotal)}`}</button>
            <p className="text-center text-[10px] text-stone-500">আপনার তথ্য নিরাপদে রাখা হবে।</p>
          </div>
        </form>}
      </motion.section></motion.div>}</AnimatePresence>
    </main>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ShoppingCart, Zap } from 'lucide-react';
import { findBangladeshDistrict, getBangladeshUpazilas, isKhulnaDistrict } from '@/lib/bangladesh-locations';
import { normalizeImageUrl } from '@/lib/image-url';
import { getDiscountPercent, getRegularPrice, getSalePrice } from '@/lib/product-pricing';
import SearchableDistrictSelect from '@/components/searchable-district-select';
import ProductReviews from '@/components/product-reviews';
import ProductDescription from '@/components/product-description';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  regularPrice?: number;
  salePrice?: number;
  category: string;
  imageUrl: string;
  images?: string[];
  stock: number;
  productType?: 'single' | 'variant';
  variants?: { attributes: Record<string, string>; stock: number; price?: number }[];
  maxOrderQuantity?: number;
  freeShipping?: boolean;
}

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // অর্ডার ফর্মের স্টেট
  const [showModal, setShowModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [districtValue, setDistrictValue] = useState('');
  const [thana, setThana] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');

  useEffect(() => {
    if (!id) return;

    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products/${id}`);
        const data = await res.json();
        if (data.success) {
          setProduct(data.data as Product);
          setSelectedVariant('');
          setSelectedImageIndex(0);
        }
      } catch (error) {
        console.error('প্রোডাক্ট লোড করতে ব্যর্থ হয়েছে:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!/^01[3-9]\d{8}$/.test(customerPhone)) return;

    setIsSubmitting(true);

    const district = findBangladeshDistrict(districtValue);
    const deliveryFee = product.freeShipping ? 0 : districtValue ? (isKhulnaDistrict(districtValue) ? 80 : 150) : 0;
    const deliveryAddress = `জেলা: ${district?.english || districtValue}, থানা: ${thana}, ঠিকানা: ${customerAddress}`;

    try {
      const orderData = {
        customerName,
        customerPhone,
        district: district?.english || districtValue,
        thana,
        customerAddress: deliveryAddress,
        shippingAddress: deliveryAddress,
        userEmail: userEmail || 'guest@example.com',
        items: [
          {
            productId: product._id,
            name: product.name,
            price: salePrice,
            quantity: quantity,
            variant: selectedVariant || undefined,
            imageUrl: productImages[selectedImageIndex] || product.imageUrl || '',
          },
        ],
        shippingFee: deliveryFee,
        totalAmount: salePrice * quantity + deliveryFee,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await res.json();

      if (data.success) {
        setOrderSuccess(true);
        setTimeout(() => {
          setShowModal(false);
          setOrderSuccess(false);
          setCustomerName('');
          setCustomerPhone('');
          setCustomerAddress('');
          setUserEmail('');
          setDistrictValue('');
          setThana('');
        }, 2000);
      } else {
        alert(data.error || 'অর্ডার করতে ব্যর্থ হয়েছে');
      }
    } catch (error) {
      console.error('অর্ডার দিতে সমস্যা হয়েছে:', error);
      alert('অর্ডার সাবমিট করতে সমস্যা হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-600">প্রোডাক্টের বিস্তারিত লোড হচ্ছে...</div>;
  }

  if (!product) {
    return <div className="text-center py-20 text-red-500">প্রোডাক্টটি পাওয়া যায়নি!</div>;
  }

  const productImages = product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : [];
  const discountPercent = getDiscountPercent(product);
  const variant = product.variants?.find((item) => JSON.stringify(item.attributes) === selectedVariant);
  const salePrice = Number(variant?.price ?? getSalePrice(product));
  const availableStock = variant ? Math.min(variant.stock, product.stock) : product.stock;
  const maxQuantity = Math.min(availableStock, product.maxOrderQuantity || availableStock);
  const imageUrls = productImages.map((image) => normalizeImageUrl(image)).filter(Boolean);
  const activeImage = imageUrls[selectedImageIndex] || imageUrls[0] || '';
  const district = findBangladeshDistrict(districtValue);
  const upazilas = getBangladeshUpazilas(districtValue);
  const addProductToCart = () => {
    if (product.productType === 'variant' && !variant) return;
    try {
      const cart = JSON.parse(localStorage.getItem('smartwearbd-cart') || '[]') as { product: Product; quantity: number; variant?: string }[];
      const existing = cart.find((line) => line.product._id === product._id && line.variant === selectedVariant);
      if (existing && (product.maxOrderQuantity && existing.quantity >= product.maxOrderQuantity || existing.quantity >= availableStock)) return;
      const selectedProduct = { ...product, price: salePrice, salePrice, stock: availableStock };
      const updated = existing
        ? cart.map((line) => line.product._id === product._id && line.variant === selectedVariant ? { ...line, quantity: line.quantity + 1 } : line)
        : [...cart, { product: selectedProduct, quantity: 1, variant: selectedVariant || undefined }];
      localStorage.setItem('smartwearbd-cart', JSON.stringify(updated));
      setCartAdded(true);
      window.setTimeout(() => setCartAdded(false), 1800);
    } catch {
      setCartAdded(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto my-12 p-6 bg-white rounded-lg shadow-md">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="relative" onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)} onTouchEnd={(event) => {
            const touchEnd = event.changedTouches[0]?.clientX;
            if (touchStart !== null && touchEnd !== undefined && Math.abs(touchEnd - touchStart) > 40 && imageUrls.length > 1) setSelectedImageIndex((current) => (current + (touchEnd < touchStart ? 1 : -1) + imageUrls.length) % imageUrls.length);
            setTouchStart(null);
          }}>
            <img src={activeImage} alt={product.name} className="h-96 w-full rounded-lg border object-cover" />
            {imageUrls.length > 1 && <><button type="button" onClick={() => setSelectedImageIndex((current) => (current - 1 + imageUrls.length) % imageUrls.length)} aria-label="আগের ছবি" className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow transition hover:scale-105"><ArrowLeft className="size-5" /></button><button type="button" onClick={() => setSelectedImageIndex((current) => (current + 1) % imageUrls.length)} aria-label="পরের ছবি" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow transition hover:scale-105"><ArrowRight className="size-5" /></button></>}
          </div>
          {imageUrls.length > 1 && <div className="mt-3 flex items-center justify-center gap-2" aria-label="ছবি নির্বাচন">{imageUrls.map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => setSelectedImageIndex(index)} aria-label={`${product.name} ছবি ${index + 1} দেখুন`} aria-current={selectedImageIndex === index} className={`size-2.5 rounded-full transition ${selectedImageIndex === index ? 'bg-[#1b3b2b] scale-110' : 'bg-stone-300 hover:bg-stone-500'}`} />)}</div>}
          {imageUrls.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2">{imageUrls.slice(0, 10).map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => setSelectedImageIndex(index)} aria-label={`${product.name} ছবি ${index + 1} দেখুন`} aria-pressed={selectedImageIndex === index} className={`aspect-square overflow-hidden rounded-md border transition ${selectedImageIndex === index ? 'border-[#1b3b2b]' : 'border-stone-200 hover:border-[#1b3b2b]'}`}><img src={image} alt="" className="size-full object-cover" /></button>)}</div>}
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <span className="text-sm font-semibold text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded">
              {product.category}
            </span>
            <h1 className="text-3xl font-bold text-gray-800 mt-3">{product.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">{discountPercent > 0 && <del className="text-lg text-stone-500">৳{new Intl.NumberFormat('bn-BD').format(getRegularPrice(product))}</del>}<p className="text-2xl font-bold text-green-700">৳{new Intl.NumberFormat('bn-BD').format(salePrice)}</p>{discountPercent > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">{discountPercent}% ছাড়</span>}</div>
            
            <p className="text-sm text-gray-500 mt-1">
              স্টক: {availableStock > 0 ? `${availableStock} টি এভেলেবল` : 'স্টক আউট'}
            </p>

            {product.productType === 'variant' && <label className="mt-4 block text-sm font-semibold text-stone-800">ভ্যারিয়েন্ট বেছে নিন<select required value={selectedVariant} onChange={(event) => { setSelectedVariant(event.target.value); setQuantity(1); }} className="mt-1.5 h-11 w-full rounded border border-stone-300 bg-white px-3 font-normal"><option value="">একটি অপশন নির্বাচন করুন</option>{(product.variants || []).map((item) => { const key = JSON.stringify(item.attributes); return <option key={key} value={key} disabled={item.stock < 1}>{Object.entries(item.attributes).map(([name, value]) => `${name}: ${value}`).join(' · ')} — {item.stock > 0 ? `${item.stock}টি স্টক` : 'স্টক নেই'}</option>; })}</select></label>}

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">বিবরণ:</h3>
              <ProductDescription value={product.description} />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <button type="button" onClick={addProductToCart} disabled={product.stock <= 0} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#cbd5d0] bg-white px-3 text-sm font-bold text-[#33453d] transition hover:scale-[1.02] hover:bg-[#f0f4f1] active:scale-95 disabled:opacity-50">{cartAdded ? <Check className="size-4 animate-pulse" /> : <ShoppingCart className="size-4" />}{cartAdded ? 'কার্টে যোগ হয়েছে' : 'কার্টে যোগ করুন'}</button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={availableStock <= 0 || product.productType === 'variant' && !variant}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-white transition hover:scale-[1.02] active:scale-95 ${
                availableStock > 0 && (product.productType !== 'variant' || Boolean(variant))
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              <Zap className="size-4" />{availableStock > 0 ? 'এখনই কিনুন' : 'স্টক আউট'}
            </button>
          </div>
        </div>
      </div>

      {/* অর্ডার ফর্ম Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">অর্ডার নিশ্চিত করুন</h2>

            {orderSuccess ? (
              <div className="bg-green-100 text-green-700 p-4 rounded text-center font-bold my-4">
                🎉 আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে!
              </div>
            ) : (
              <form onSubmit={handleOrderSubmit} className="space-y-4">
                <div className="flex items-center gap-3 border-b pb-3"><img src={activeImage} alt="" className="size-16 shrink-0 object-cover" /><div><strong className="block text-sm">{product.name}</strong><span className="text-sm font-bold text-[#1b3b2b]">৳{new Intl.NumberFormat('bn-BD').format(salePrice)}</span></div></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">আপনার নাম</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border p-2 rounded mt-1 text-black"
                    placeholder="আপনার নাম লিখুন"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">ইমেইল (ঐচ্ছিক)</label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full border p-2 rounded mt-1 text-black"
                    placeholder="example@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">মোবাইল নম্বর</label>
                  <input
                    type="tel"
                    required
                    inputMode="numeric"
                    pattern="01[3-9][0-9]{8}"
                    maxLength={11}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    className="w-full border p-2 rounded mt-1 text-black"
                    placeholder="017XXXXXXXX"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium text-gray-700">জেলা<SearchableDistrictSelect required value={district?.english || ''} onChange={(value) => { setDistrictValue(value); setThana(''); }} className="mt-1 rounded-md" /></label>
                  <label className="block text-sm font-medium text-gray-700">থানা<select required disabled={!district} value={upazilas.find((item) => item.english === thana || item.bangla === thana)?.english || ''} onChange={(event) => setThana(event.target.value)} className="mt-1 w-full border p-2 text-sm text-black disabled:opacity-50"><option value="" disabled>থানা বাছুন</option>{upazilas.map((item) => <option key={item.id} value={item.english}>{item.bangla}</option>)}</select></label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">সম্পূর্ণ ঠিকানা</label>
                  <textarea
                    required
                    rows={3}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full border p-2 rounded mt-1 text-black"
                    placeholder="বাসা নম্বর, রোড নম্বর, এলাকা, জেলা..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">পরিমাণ (Quantity)</label>
                  <input
                    type="number"
                    min={1}
                    max={maxQuantity}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(maxQuantity, Math.max(1, Number(e.target.value))))}
                    className="w-full border p-2 rounded mt-1 text-black"
                  />
                </div>

                <div className="text-right font-bold text-gray-800">
                  মোট মূল্য: ৳{new Intl.NumberFormat('bn-BD').format(salePrice * quantity + (product.freeShipping ? 0 : districtValue ? (isKhulnaDistrict(districtValue) ? 80 : 150) : 0))}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-[#1B3B2B] text-white rounded font-semibold transition hover:scale-[1.02] hover:bg-[#142c20] active:scale-95 disabled:bg-gray-400"
                  >
                    {isSubmitting ? 'অর্ডার হচ্ছে...' : 'অর্ডার কনফার্ম করুন'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      <ProductReviews productId={product._id} />
    </div>
  );
}
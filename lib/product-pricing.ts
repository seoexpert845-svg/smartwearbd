type ProductPriceFields = { price?: number; salePrice?: number; regularPrice?: number };

export function getSalePrice(product: ProductPriceFields) {
  return Number(product.salePrice ?? product.price ?? 0);
}

export function getRegularPrice(product: ProductPriceFields) {
  return Number(product.regularPrice ?? getSalePrice(product));
}

export function getDiscountPercent(product: ProductPriceFields) {
  const regularPrice = getRegularPrice(product);
  const salePrice = getSalePrice(product);
  return regularPrice > salePrice && regularPrice > 0
    ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
    : 0;
}

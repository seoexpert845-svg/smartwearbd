type OrderContact = {
  customerName?: string;
  name?: string;
  customerPhone?: string;
  phone?: string;
  customerAddress?: string;
  address?: string;
  shippingAddress?: string;
  district?: string;
  thana?: string;
};

const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯';

function toAsciiDigits(value: string) {
  return value.replace(/[০-৯]/g, (digit) => String(BENGALI_DIGITS.indexOf(digit)));
}

export function getCustomerName(order: OrderContact) {
  const directName = [order.customerName, order.name].find((value) => value && value !== 'N/A');
  if (directName) return directName.trim();

  const legacyAddress = order.customerAddress || order.shippingAddress || order.address || '';
  return legacyAddress.match(/নাম:\s*([^📱📍🏘🏡\n]+)/)?.[1]?.trim() || '';
}

export function getCustomerPhone(order: OrderContact) {
  const directPhone = [order.customerPhone, order.phone].find((value) => value && value !== 'N/A');
  const directMatch = directPhone && toAsciiDigits(directPhone).match(/(01[3-9]\d{8})/);
  if (directMatch) return directMatch[0];

  const fullText = toAsciiDigits(JSON.stringify(order));
  return fullText.match(/(01[3-9]\d{8})/)?.[0] || '';
}

export function getUniqueCustomerCount(orders: OrderContact[]) {
  const phoneByName = new Map<string, string>();
  for (const order of orders) {
    const name = getCustomerName(order).toLocaleLowerCase();
    const phone = getCustomerPhone(order);
    if (name && phone) phoneByName.set(name, phone);
  }

  return new Set(orders.map((order) => {
    const phone = getCustomerPhone(order);
    const name = getCustomerName(order).toLocaleLowerCase();
    return phone || phoneByName.get(name) || name;
  }).filter(Boolean)).size;
}

export function getOrderAddress(order: OrderContact) {
  return (order.customerAddress || order.shippingAddress || order.address || '')
    .replace(/নাম:\s*.*?(?=📱|📍|🏘|🏡|$)/g, '')
    .replace(/📱?\s*মোবাইল(?:\s*নম্বর)?:\s*[0-9০-৯+ -]+/g, '')
    .replace(/[📍🏘🏡]/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/\s*সম্পূর্ণ ঠিকানা:\s*/g, ', ')
    .replace(/\s*ঠিকানা:\s*/g, ', ')
    .replace(/\s+(জেলা|থানা):\s*/g, ', $1: ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(/,\s*,/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/(?:^|,\s*)নাম:\s*[^,]+(?:,\s*|$)/g, '')
    .trim();
}

export function getOrderShippingDetails(order: OrderContact) {
  const formattedAddress = getOrderAddress(order);
  const district = order.district?.trim() || formattedAddress.match(/(?:^|,\s*)জেলা:\s*([^,]+)/)?.[1]?.trim() || '';
  const thana = order.thana?.trim() || formattedAddress.match(/(?:^|,\s*)থানা:\s*([^,]+)/)?.[1]?.trim() || '';
  const address = formattedAddress
    .replace(/(?:^|,\s*)জেলা:\s*[^,]*/g, '')
    .replace(/(?:^|,\s*)থানা:\s*[^,]*/g, '')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

  return { district, thana, address };
}
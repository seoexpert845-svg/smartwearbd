'use client';

import { useParams } from 'next/navigation';
import AdminProductForm from '@/components/admin-product-form';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminProductForm productId={id} />;
}
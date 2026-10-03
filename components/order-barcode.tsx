'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function OrderBarcode({ value, className = '' }: { value: string; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    JsBarcode(svgRef.current, value, { format: 'CODE128', displayValue: false, margin: 0, height: 38, width: 1.5 });
  }, [value]);

  return <svg ref={svgRef} role="img" aria-label={`Barcode ${value}`} className={className} />;
}
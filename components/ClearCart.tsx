'use client';
import { useEffect } from 'react';
// After a verified payment the cart is emptied so the customer does not buy twice by accident.
export default function ClearCart() {
  useEffect(() => { try { localStorage.removeItem('loft_cart'); sessionStorage.removeItem('loft_refresh'); } catch {} }, []);
  return null;
}

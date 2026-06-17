"use client";

import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);

const DELIVERY_FEE = 80;
const FREE_DELIVERY_OVER = 3000;

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [shop, setShop] = useState({ id: null, name: null });
  const [loaded, setLoaded] = useState(false);

  // Load saved cart once on mount (client only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("tl_cart") || "[]");
      if (Array.isArray(saved) && saved.length > 0) {
        setCart(saved);
        setShop({ id: saved[0].shopId, name: saved[0].shopName || null });
      }
    } catch {
      // ignore bad data
    }
    setLoaded(true);
  }, []);

  // Persist whenever the cart changes (after initial load).
  useEffect(() => {
    if (loaded) localStorage.setItem("tl_cart", JSON.stringify(cart));
  }, [cart, loaded]);

  function addToCart(product, shopId, shopName) {
    // product = { productId, name, price }
    if (cart.length > 0 && shop.id && shop.id !== shopId) {
      const ok = window.confirm(
        `Tu carrito tiene productos de ${shop.name}. ¿Vaciarlo y agregar de ${shopName}?`
      );
      if (!ok) return;
      setShop({ id: shopId, name: shopName });
      setCart([{ ...product, shopId, shopName, quantity: 1 }]);
      return;
    }

    setShop({ id: shopId, name: shopName });
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...product, shopId, shopName, quantity: 1 }];
    });
  }

  function changeQty(productId, delta) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function clearCart() {
    setCart([]);
    setShop({ id: null, name: null });
  }

  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const delivery = subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;

  return (
    <CartContext.Provider
      value={{ cart, shop, addToCart, changeQty, clearCart, count, subtotal, delivery, total }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}

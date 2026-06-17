"use client";

import { useEffect, useState } from "react";
import { getShops, getShop } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import Checkout from "@/components/Checkout";

const CATEGORIES = [
  { label: "Todas", value: "all", emoji: "🏪" },
  { label: "Electrónica", value: "Electrónica", emoji: "📱" },
  { label: "Moda", value: "Moda", emoji: "👗" },
  { label: "Hogar", value: "Hogar", emoji: "🏠" },
  { label: "Belleza", value: "Belleza", emoji: "💄" },
  { label: "Deportes", value: "Deportes", emoji: "⚽" },
  { label: "Niños y Juguetes", value: "Niños y Juguetes", emoji: "🧸" },
  { label: "Mascotas", value: "Mascotas", emoji: "🐾" },
];

function categoryEmoji(cat) {
  const map = {
    "Electrónica": "📱",
    "Moda": "👗",
    "Hogar": "🏠",
    "Hogar y Decoración": "🏠",
    "Belleza": "💄",
    "Deportes": "⚽",
    "Niños y Juguetes": "🧸",
    "Mascotas": "🐾",
  };
  return map[cat] || "🏪";
}

function rd(n) {
  return "RD$" + Number(n || 0).toLocaleString();
}

export default function Home() {
  const { cart, addToCart, changeQty, count, subtotal, delivery, total } = useCart();

  const [shops, setShops] = useState([]);
  const [shopsState, setShopsState] = useState("loading");
  const [activeCat, setActiveCat] = useState("all");

  const [user, setUser] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalShop, setModalShop] = useState(null);
  const [products, setProducts] = useState(null);
  const [modalRating, setModalRating] = useState("-");

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem("tl_user") || "null"));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setShopsState("loading");
    getShops(activeCat)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setShops(list);
        setShopsState(list.length ? "ok" : "empty");
      })
      .catch(() => {
        if (!cancelled) setShopsState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [activeCat]);

  function handleAuth() {
    if (user) {
      localStorage.clear();
      window.location.reload();
    } else {
      window.location.href = "/login";
    }
  }

  async function openShop(shop) {
    setModalShop({ id: shop.id, name: shop.name, emoji: categoryEmoji(shop.category) });
    setModalRating(shop.rating ? parseFloat(shop.rating).toFixed(1) : "Nuevo");
    setProducts(null);
    setModalOpen(true);
    try {
      const full = await getShop(shop.id);
      setModalRating(full.rating ? parseFloat(full.rating).toFixed(1) : "Nuevo");
      const visible = (full.products || []).filter((p) => p.status !== "HIDDEN");
      setProducts(visible);
    } catch {
      setProducts([]);
    }
  }

  function handleCheckout() {
    const token = typeof window !== "undefined" ? localStorage.getItem("tl_token") : null;
    if (!token) {
      window.location.href = "/login";
      return;
    }
    if (cart.length === 0) {
      alert("Tu carrito está vacío");
      return;
    }
    setCartOpen(false);
    setCheckoutOpen(true);
  }

  return (
    <>
      {/* NAV */}
      <nav>
        <div className="logo">
          Traeme<span>Loo</span>
        </div>
        <div className="search-bar">
          <span style={{ color: "var(--text3)" }}>🔍</span>
          <input type="text" placeholder="Buscar tiendas, productos..." />
        </div>
        <div className="nav-right">
          <div className="nav-location">📍 <span>Santiago</span></div>
          <button className="nav-btn" onClick={handleAuth}>
            {user ? "👤 " + String(user.name || "").split(" ")[0] : "Iniciar Sesión"}
          </button>
          <button className="cart-btn" onClick={() => setCartOpen(true)}>
            🛒 Carrito
            <div className="cart-badge">{count}</div>
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-badge">🚀 Ahora entregando en 30 minutos o menos</div>
          <h1>
            Compra Local,<br />Recíbelo <span className="accent">Ya.</span>
          </h1>
          <p>
            Tus tiendas favoritas, entregadas directo a tu puerta.
            <br />
            Miles de productos de negocios cerca de ti.
          </p>
          <div className="hero-actions">
            <button
              className="btn-primary"
              onClick={() =>
                document.getElementById("tiendas")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Ver Tiendas
            </button>
            <button className="btn-secondary" onClick={() => (window.location.href = "/login")}>
              Abre Tu Tienda →
            </button>
          </div>
          <div className="hero-stats">
            <div className="stat"><div className="stat-num">250<span>+</span></div><div className="stat-label">Tiendas Activas</div></div>
            <div className="stat"><div className="stat-num">30<span>min</span></div><div className="stat-label">Entrega Promedio</div></div>
            <div className="stat"><div className="stat-num">4.8<span>★</span></div><div className="stat-label">Calificación</div></div>
            <div className="stat"><div className="stat-num">15<span>k+</span></div><div className="stat-label">Clientes Felices</div></div>
          </div>
        </div>
      </section>

      {/* PROMO */}
      <div className="promo-banner">
        <div className="promo-bg-circle" />
        <div className="promo-content">
          <h2>Primer Pedido con Envío Gratis</h2>
          <p>
            Usa el código <strong>TRAEMELOO1</strong> al pagar — válido para nuevos clientes
          </p>
          <button className="nav-btn" style={{ padding: "12px 28px", fontSize: "15px" }}>
            Reclamar Oferta
          </button>
        </div>
        <div className="promo-emoji">🎁</div>
      </div>

      {/* CATEGORIES */}
      <div className="section" style={{ paddingBottom: 0 }}>
        <div className="section-header">
          <div className="section-title">Explorar Categorías</div>
        </div>
        <div className="categories-scroll">
          {CATEGORIES.map((c) => (
            <div
              key={c.value}
              className={"cat-chip" + (activeCat === c.value ? " active" : "")}
              onClick={() => setActiveCat(c.value)}
            >
              {c.emoji} {c.label}
            </div>
          ))}
        </div>
      </div>

      {/* SHOPS */}
      <div className="section" id="tiendas">
        <div className="section-header">
          <div className="section-title">Tiendas Cerca de Ti</div>
          <a className="see-all">Ver todas →</a>
        </div>
        <div className="shops-grid">
          {shopsState === "loading" && <div className="muted">Cargando tiendas...</div>}
          {shopsState === "error" && (
            <div className="muted">Error cargando tiendas. Intenta de nuevo.</div>
          )}
          {shopsState === "empty" && <div className="muted">No hay tiendas disponibles.</div>}
          {shopsState === "ok" &&
            shops.map((shop) => {
              const rating = shop.rating ? parseFloat(shop.rating).toFixed(1) : "Nuevo";
              return (
                <div key={shop.id} className="shop-card" onClick={() => openShop(shop)}>
                  <div className="shop-img">{categoryEmoji(shop.category)}</div>
                  <div
                    className="shop-badge"
                    style={{
                      background: shop.isOpen ? "var(--green)" : "var(--text3)",
                      color: shop.isOpen ? "#000" : "#fff",
                    }}
                  >
                    {shop.isOpen ? "Abierto" : "Cerrado"}
                  </div>
                  <div className="shop-info">
                    <div className="shop-name">{shop.name}</div>
                    <div className="shop-meta">
                      <span><span className="shop-rating">★</span> {rating}</span>
                      <span>🕐 20-35 min</span>
                      <span>🛵 RD$80</span>
                    </div>
                    <div className="shop-tags">
                      <div className="tag">{shop.category}</div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">TraemeLoo</div>
        <div className="footer-links">
          <a href="#">Nosotros</a>
          <a href="#">Vende con nosotros</a>
          <a href="#">Entrega con nosotros</a>
          <a href="#">Ayuda</a>
          <a href="#">Términos</a>
        </div>
        <div className="footer-copy">© 2026 TraemeLoo. República Dominicana.</div>
      </footer>

      {/* CART */}
      <div
        className={"cart-overlay" + (cartOpen ? " open" : "")}
        onClick={() => setCartOpen(false)}
      />
      <div className={"cart-sidebar" + (cartOpen ? " open" : "")}>
        <div className="cart-header">
          <h3>🛒 Tu Carrito</h3>
          <button className="close-btn" onClick={() => setCartOpen(false)}>
            ×
          </button>
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text3)", padding: "40px 0", fontSize: 14 }}>
              🛒
              <br />
              <br />
              Tu carrito está vacío
            </div>
          ) : (
            cart.map((item) => (
              <div className="cart-item" key={item.productId}>
                <div className="cart-item-img">📦</div>
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">{rd(item.price)}</div>
                </div>
                <div className="cart-qty">
                  <button className="qty-btn" onClick={() => changeQty(item.productId, -1)}>−</button>
                  <span className="qty-num">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => changeQty(item.productId, 1)}>+</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="cart-footer">
          <div className="cart-total"><span>Subtotal</span><span>{rd(subtotal)}</span></div>
          <div className="cart-total">
            <span>Envío</span>
            <span>{delivery === 0 ? "¡Gratis!" : rd(delivery)}</span>
          </div>
          <div className="cart-total grand"><span>Total</span><span>{rd(total)}</span></div>
          <button className="checkout-btn" onClick={handleCheckout}>
            Proceder al Pago →
          </button>
        </div>
      </div>

      {/* SHOP MODAL */}
      <div
        className={"modal-overlay" + (modalOpen ? " open" : "")}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false);
        }}
      >
        <div className={"shop-modal" + (modalOpen ? " open" : "")}>
          <div className="modal-hero">
            <span>{modalShop?.emoji || "🏪"}</span>
            <div className="modal-hero-overlay" />
          </div>
          <div className="modal-body">
            <div className="modal-shop-name">{modalShop?.name || ""}</div>
            <div className="modal-meta">
              <span>★ {modalRating}</span>
              <span>🕐 20-35 min</span>
              <span>🛵 RD$80</span>
              <span>📍 0.8 km</span>
            </div>
            <div className="products-section">
              <h4>Productos</h4>
              <div className="products-grid">
                {products === null && (
                  <div style={{ color: "var(--text3)", textAlign: "center", padding: 20 }}>
                    Cargando productos...
                  </div>
                )}
                {products !== null && products.length === 0 && (
                  <div style={{ color: "var(--text3)" }}>
                    Esta tienda no tiene productos disponibles.
                  </div>
                )}
                {products !== null &&
                  products.map((p) => {
                    const available = p.status === "ACTIVE" && p.stock > 0;
                    return (
                      <div className="product-card" key={p.id}>
                        <div className="product-img">{categoryEmoji(p.category)}</div>
                        <div className="product-info">
                          <div className="product-name">{p.name}</div>
                          <div className="product-bottom">
                            <span className="product-price">{rd(p.price)}</span>
                            {available ? (
                              <button
                                className="add-btn"
                                onClick={() =>
                                  addToCart(
                                    { productId: p.id, name: p.name, price: p.price },
                                    modalShop.id,
                                    modalShop.name
                                  )
                                }
                              >
                                +
                              </button>
                            ) : (
                              <span style={{ fontSize: 10, color: "var(--text3)" }}>Agotado</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CHECKOUT */}
      <Checkout open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </>
  );
}

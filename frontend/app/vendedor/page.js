"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
import "./vendedor.css";

function rd(n) {
  return "RD$" + Number(n || 0).toLocaleString();
}

const STATUS_MAP = {
  PENDING: { label: "Nuevo", cls: "status-new" },
  ACCEPTED: { label: "Aceptado", cls: "status-preparing" },
  PREPARING: { label: "Preparando", cls: "status-preparing" },
  READY: { label: "Listo", cls: "status-ready" },
  ASSIGNED: { label: "Asignado", cls: "status-ready" },
  PICKED_UP: { label: "Recogido", cls: "status-ready" },
  EN_ROUTE: { label: "En Camino", cls: "status-delivered" },
  DELIVERED: { label: "Entregado ✓", cls: "status-delivered" },
  CANCELLED: { label: "Cancelado", cls: "status-new" },
  REJECTED: { label: "Rechazado", cls: "status-new" },
};

const STATUS_MSG = {
  ACCEPTED: "¡Pedido aceptado! Empieza a preparar.",
  PREPARING: "Pedido en preparación.",
  READY: "¡Pedido listo! Notificando motorista.",
  REJECTED: "Pedido rechazado.",
};

const NAV = [
  { group: "Principal", items: [
    { key: "dashboard", icon: "📊", label: "Panel Principal" },
    { key: "orders", icon: "📦", label: "Pedidos", badge: true },
    { key: "products", icon: "🏷️", label: "Productos" },
  ]},
  { group: "Finanzas", items: [
    { key: "earnings", icon: "💰", label: "Ganancias" },
    { key: "payouts", icon: "🏦", label: "Pagos" },
  ]},
  { group: "Configuración", items: [
    { key: "profile", icon: "🏪", label: "Perfil de Tienda" },
  ]},
];

const TITLES = {
  dashboard: "Panel Principal", orders: "Pedidos", products: "Productos",
  earnings: "Ganancias", payouts: "Pagos", profile: "Perfil de Tienda",
};

export default function SellerPortal() {
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState("dashboard");
  const [stats, setStats] = useState({});
  const [shopName, setShopName] = useState("Mi Tienda");
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("all");
  const [products, setProducts] = useState(null);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ category: "Electrónica" });
  const [saving, setSaving] = useState(false);
  const toastTimer = useRef(null);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("tl_token") : null);
  const headers = useCallback(() => ({ "Content-Type": "application/json", Authorization: "Bearer " + token() }), []);

  // Auth guard
  useEffect(() => {
    try {
      const t = localStorage.getItem("tl_token");
      const u = JSON.parse(localStorage.getItem("tl_user") || "null");
      if (!t || !u) { window.location.href = "/login"; return; }
      if (u.role !== "SELLER") { alert("Acceso no autorizado. Redirigiendo..."); window.location.href = "/login"; return; }
      setReady(true);
    } catch {
      window.location.href = "/login";
    }
  }, []);

  function showToast(msg, color) {
    setToast({ msg, color: color || "var(--green)" });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch(API + "/shops/my/dashboard", { headers: headers() });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {}
  }, [headers]);

  const loadOrders = useCallback(async (statusFilter) => {
    setOrders(null);
    try {
      let url = API + "/orders?limit=100";
      if (statusFilter && statusFilter !== "all") url += "&status=" + statusFilter;
      const res = await fetch(url, { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    }
  }, [headers]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(API + "/sellers/me", { headers: headers() });
      const data = await res.json();
      if (res.ok && data.shop) {
        setProducts(data.shop.products || []);
        if (data.shop.name) setShopName(data.shop.name);
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    }
  }, [headers]);

  // Initial load + auto-refresh
  useEffect(() => {
    if (!ready) return;
    loadDashboard();
    loadOrders("all");
    loadProducts();
    const id = setInterval(() => {
      loadDashboard();
      loadOrders(filter);
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function pickFilter(s) {
    setFilter(s);
    loadOrders(s);
  }

  async function updateStatus(orderId, status) {
    try {
      const res = await fetch(API + "/orders/" + orderId + "/status", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ status, message: STATUS_MSG[status] || status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      showToast(STATUS_MSG[status] || "Estado actualizado", status === "REJECTED" ? "var(--brand)" : "var(--green)");
      setOrders((prev) => (prev || []).map((o) => (o.id === orderId ? data : o)));
      loadDashboard();
    } catch (e) {
      showToast("Error: " + e.message, "var(--brand)");
    }
  }

  async function toggleProduct(p) {
    const newStatus = p.status === "ACTIVE" ? "HIDDEN" : "ACTIVE";
    try {
      const res = await fetch(API + "/products/" + p.id, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Error");
      setProducts((prev) => (prev || []).map((x) => (x.id === p.id ? { ...x, status: newStatus } : x)));
      showToast(newStatus === "HIDDEN" ? "Producto oculto de la tienda" : "Producto visible en la tienda");
    } catch {
      showToast("Error actualizando producto", "var(--brand)");
    }
  }

  async function saveProduct() {
    const name = (form.name || "").trim();
    if (!name || !form.price || !form.stock) {
      showToast("Completa nombre, precio y cantidad", "var(--brand)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(API + "/products", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          name,
          price: Number(form.price),
          stock: Number(form.stock),
          category: form.category || "Electrónica",
          description: (form.description || "").trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setModalOpen(false);
      setForm({ category: "Electrónica" });
      showToast("✅ ¡Producto agregado exitosamente!");
      loadProducts();
    } catch (e) {
      showToast("Error: " + e.message, "var(--brand)");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.clear();
    window.location.href = "/login";
  }

  if (!ready) return null;

  const pending = stats.pendingOrders || 0;
  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const ORDER_FILTERS = [
    ["all", "Todos"], ["PENDING", "Nuevos"], ["PREPARING", "Preparando"],
    ["READY", "Listos"], ["DELIVERED", "Entregados"],
  ];

  function OrderRow({ o }) {
    const s = STATUS_MAP[o.status] || { label: o.status, cls: "status-new" };
    const customerName = o.customer?.user?.name || "Cliente";
    const itemCount = o.items ? o.items.length : "?";
    const itemNames = o.items ? o.items.map((i) => i.name).join(", ") : "";
    const pay = o.paymentMethod === "CASH" ? "💵 Efectivo" : "💳 Tarjeta";
    const time = o.createdAt ? new Date(o.createdAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }) : "";
    return (
      <div className="order-row">
        <div className="order-id">#{o.orderNumber}</div>
        <div className="order-customer">
          <div className="order-name">{customerName}</div>
          <div className="order-items-count">
            {itemCount} artículo(s) · {itemNames.substring(0, 40)}{itemNames.length > 40 ? "..." : ""}
          </div>
          <div className="order-items-count" style={{ marginTop: 2 }}>{pay} · {time}</div>
        </div>
        <div className="order-total">{rd(o.total)}</div>
        <div className={"order-status " + s.cls}>{s.label}</div>
        <div className="order-actions">
          {o.status === "PENDING" && (
            <>
              <button className="action-btn" onClick={() => updateStatus(o.id, "ACCEPTED")}>Aceptar</button>
              <button className="action-btn danger" onClick={() => updateStatus(o.id, "REJECTED")}>✕</button>
            </>
          )}
          {o.status === "ACCEPTED" && (
            <button className="action-btn" style={{ background: "rgba(74,158,255,0.15)", borderColor: "var(--blue)", color: "var(--blue)" }} onClick={() => updateStatus(o.id, "PREPARING")}>Preparando</button>
          )}
          {o.status === "PREPARING" && (
            <button className="action-btn" style={{ background: "rgba(255,140,66,0.15)", borderColor: "var(--orange)", color: "var(--orange)" }} onClick={() => updateStatus(o.id, "READY")}>Marcar Listo</button>
          )}
          {o.status === "READY" && <span style={{ fontSize: 12, color: "var(--green)" }}>Esperando motorista...</span>}
          {o.status === "DELIVERED" && <button className="action-btn" onClick={() => showToast("¡Recibo enviado!")}>Recibo</button>}
        </div>
      </div>
    );
  }

  function OrdersPanel() {
    if (orders === null) return <div className="muted-pad">Cargando pedidos...</div>;
    if (orders.length === 0) return <div className="muted-pad">No hay pedidos con este filtro.<br /><br />Cuando un cliente haga un pedido aparecerá aquí.</div>;
    return orders.map((o) => <OrderRow key={o.id} o={o} />);
  }

  function ProductRows() {
    if (products === null) return <div className="muted-pad">Cargando productos...</div>;
    if (products.length === 0) return <div className="muted-pad">No tienes productos. ¡Agrega uno!</div>;
    return products.map((p) => (
      <div className="product-row" key={p.id}>
        <div className="product-row-img">📦</div>
        <div className="product-row-info">
          <div className="product-row-name">{p.name}</div>
          <div className={"product-row-stock" + (p.stock <= 3 ? " stock-low" : "")}>
            Existencia: {p.stock} unidades{p.stock === 0 ? " — Agotado ⚠️" : p.stock <= 3 ? " ⚠️" : ""}
          </div>
        </div>
        <div className="product-row-price">{rd(p.price)}</div>
        <button className={"stock-toggle" + (p.status === "ACTIVE" ? "" : " off")} onClick={() => toggleProduct(p)} aria-label="toggle" />
      </div>
    ));
  }

  return (
    <div className="seller-app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ cursor: "pointer" }} onClick={() => setSection("dashboard")}>
          Traeme<span>Loo</span>
          <small>Portal del Vendedor</small>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((grp) => (
            <div key={grp.group}>
              <div className="nav-group-label">{grp.group}</div>
              {grp.items.map((it) => (
                <div
                  key={it.key}
                  className={"nav-item" + (section === it.key ? " active" : "")}
                  onClick={() => setSection(it.key)}
                >
                  <span className="icon">{it.icon}</span>
                  {it.label}
                  {it.badge && <span className="badge">{pending}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="shop-profile" style={{ cursor: "pointer" }} onClick={logout} title="Cerrar sesión">
            <div className="shop-avatar">🏪</div>
            <div className="shop-profile-info">
              <div className="shop-profile-name">{shopName}</div>
              <div className="shop-profile-status"><div className="status-dot" />Abierto para pedidos</div>
            </div>
            <span style={{ fontSize: 16, color: "var(--text2)" }}>⏻</span>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div className="topbar-title">{TITLES[section]}</div>
          <div className="topbar-actions">
            <button className="topbar-btn secondary" onClick={() => showToast("Reporte exportado")}>📤 Exportar Reporte</button>
            <button className="topbar-btn" onClick={() => setModalOpen(true)}>+ Agregar Producto</button>
            <button className="topbar-btn secondary" onClick={logout}>Salir</button>
          </div>
        </div>

        <div className="content">
          {/* DASHBOARD */}
          {section === "dashboard" && (
            <>
              <div className="stats-grid">
                <div className="stat-card green">
                  <div className="stat-icon">💰</div>
                  <div className="stat-val green">{rd(stats.todayRevenue)}</div>
                  <div className="stat-label">Ventas de Hoy</div>
                </div>
                <div className="stat-card red">
                  <div className="stat-icon">📦</div>
                  <div className="stat-val red">{stats.todayOrders || 0}</div>
                  <div className="stat-label">Pedidos Hoy</div>
                </div>
                <div className="stat-card yellow">
                  <div className="stat-icon">⏳</div>
                  <div className="stat-val yellow">{pending}</div>
                  <div className="stat-label">Pedidos Pendientes</div>
                  <div className="stat-change neg">Requiere atención</div>
                </div>
                <div className="stat-card blue">
                  <div className="stat-icon">⭐</div>
                  <div className="stat-val blue">{stats.rating ? parseFloat(stats.rating).toFixed(1) : "-"}</div>
                  <div className="stat-label">Calificación</div>
                </div>
              </div>

              <div className="main-grid">
                <div>
                  <div className="panel">
                    <div className="panel-header">
                      <div className="panel-title">Pedidos en Vivo</div>
                      <div className="order-filters">
                        {ORDER_FILTERS.slice(0, 4).map(([v, l]) => (
                          <button key={v} className={"filter-btn" + (filter === v ? " active" : "")} onClick={() => pickFilter(v)}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div><OrdersPanel /></div>
                  </div>

                  <div className="panel" style={{ marginTop: 20 }}>
                    <div className="panel-header">
                      <div className="panel-title">Ventas Semanales</div>
                      <div style={{ fontSize: 13, color: "var(--text2)" }}>Esta semana</div>
                    </div>
                    <div className="chart-area">
                      <div className="revenue-num">{rd(248500)}</div>
                      <div style={{ fontSize: 13, color: "var(--green)", marginTop: -4 }}>↑ 22% vs semana pasada</div>
                      <div className="mini-chart">
                        {[40, 65, 50, 80, 55, 90, 75].map((h, i) => (
                          <div key={i} className={"bar" + (i === 6 ? " today" : "")} style={{ height: h + "%" }} />
                        ))}
                      </div>
                      <div className="chart-labels">
                        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="chart-label">{d}</div>)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="right-col">
                  <div className="panel">
                    <div className="panel-header">
                      <div className="panel-title">Productos</div>
                      <button className="action-btn" onClick={() => setModalOpen(true)}>+ Agregar</button>
                    </div>
                    <div><ProductRows /></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ORDERS */}
          {section === "orders" && (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Todos los Pedidos</div>
                <div className="order-filters">
                  {ORDER_FILTERS.map(([v, l]) => (
                    <button key={v} className={"filter-btn" + (filter === v ? " active" : "")} onClick={() => pickFilter(v)}>{l}</button>
                  ))}
                </div>
              </div>
              <div><OrdersPanel /></div>
            </div>
          )}

          {/* PRODUCTS */}
          {section === "products" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div className="panel-title" style={{ fontSize: 16 }}>Mis Productos</div>
                <button className="topbar-btn" onClick={() => setModalOpen(true)}>+ Agregar Producto</button>
              </div>
              <div className="panel"><div><ProductRows /></div></div>
            </>
          )}

          {/* PLACEHOLDERS */}
          {section === "earnings" && (
            <div className="panel placeholder-panel"><div className="big">💰</div><div className="t">Ganancias</div><div className="d">Próximamente — reportes detallados de ingresos y comisiones.</div></div>
          )}
          {section === "payouts" && (
            <div className="panel placeholder-panel"><div className="big">🏦</div><div className="t">Pagos</div><div className="d">Próximamente — historial de pagos y solicitudes de retiro.</div></div>
          )}
          {section === "profile" && (
            <div className="panel placeholder-panel"><div className="big">🏪</div><div className="t">Perfil de Tienda</div><div className="d">Próximamente — edita el nombre, horario y zona de entrega de tu tienda.</div></div>
          )}
        </div>
      </main>

      {/* ADD PRODUCT MODAL */}
      {modalOpen && (
        <div className="seller-modal-bg" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="seller-modal-box">
            <h3>+ Agregar Nuevo Producto</h3>
            <div className="form-group">
              <label>Nombre del Producto</label>
              <input type="text" placeholder="ej. Funda iPhone 15" value={form.name || ""} onChange={setField("name")} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Precio (RD$)</label>
                <input type="number" placeholder="850" value={form.price || ""} onChange={setField("price")} />
              </div>
              <div className="form-group">
                <label>Cantidad en Existencia</label>
                <input type="number" placeholder="50" value={form.stock || ""} onChange={setField("stock")} />
              </div>
            </div>
            <div className="form-group">
              <label>Categoría</label>
              <select value={form.category || "Electrónica"} onChange={setField("category")}>
                {["Electrónica", "Moda", "Hogar y Decoración", "Belleza", "Deportes", "Niños y Juguetes"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <textarea placeholder="Breve descripción del producto..." value={form.description || ""} onChange={setField("description")} />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-save" onClick={saveProduct} disabled={saving}>{saving ? "Guardando..." : "Guardar Producto"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="seller-toast" style={{ background: toast.color }}>{toast.msg}</div>}
    </div>
  );
}

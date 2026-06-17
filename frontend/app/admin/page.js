"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
import "./admin.css";

function rd(n) {
  return "RD$" + Number(n || 0).toLocaleString();
}

const NAV = [
  { group: "General", items: [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "orders", icon: "📦", label: "Pedidos" },
  ]},
  { group: "Gestión", items: [
    { key: "sellers", icon: "🏪", label: "Tiendas" },
    { key: "drivers", icon: "🛵", label: "Motoristas" },
  ]},
  { group: "Plataforma", items: [
    { key: "config", icon: "⚙️", label: "Configuración" },
    { key: "payouts", icon: "🏦", label: "Pagos" },
    { key: "zones", icon: "🗺️", label: "Zonas" },
  ]},
];

const TITLES = {
  dashboard: "Dashboard", orders: "Pedidos", sellers: "Tiendas", drivers: "Motoristas",
  config: "Configuración", payouts: "Pagos", zones: "Zonas",
};

const SHOP_PILL = {
  ACTIVE: ["pill-active", "Activa"],
  PENDING_REVIEW: ["pill-review", "En Revisión"],
  PENDING: ["pill-pending", "Pendiente"],
  SUSPENDED: ["pill-suspended", "Suspendida"],
};

const ORDER_PILL = {
  PENDING: ["pill-pending", "Nuevo"], ACCEPTED: ["pill-review", "Aceptado"],
  PREPARING: ["pill-review", "Preparando"], READY: ["pill-pending", "Listo"],
  ASSIGNED: ["pill-review", "Asignado"], PICKED_UP: ["pill-review", "Recogido"],
  EN_ROUTE: ["pill-review", "En Camino"], DELIVERED: ["pill-active", "Entregado"],
  CANCELLED: ["pill-suspended", "Cancelado"], REJECTED: ["pill-suspended", "Rechazado"],
};

export default function AdminPanel() {
  const [ready, setReady] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [section, setSection] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [sellers, setSellers] = useState(null);
  const [drivers, setDrivers] = useState(null);
  const [orders, setOrders] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null); // id being acted on
  const toastTimer = useRef(null);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("tl_token") : null);
  const headers = useCallback(() => ({ "Content-Type": "application/json", Authorization: "Bearer " + token() }), []);

  useEffect(() => {
    try {
      const t = localStorage.getItem("tl_token");
      const u = JSON.parse(localStorage.getItem("tl_user") || "null");
      if (!t || !u) { window.location.href = "/login"; return; }
      if (u.role !== "ADMIN") { alert("Acceso no autorizado. Redirigiendo..."); window.location.href = "/login"; return; }
      setAdminName((u.name || "Admin").split(" ")[0]);
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

  const get = useCallback(async (path) => {
    const res = await fetch(API + path, { headers: headers() });
    if (!res.ok) throw new Error("Error " + res.status);
    return res.json();
  }, [headers]);

  const loadDashboard = useCallback(() => get("/admin/dashboard").then(setStats).catch(() => setStats({})), [get]);
  const loadSellers = useCallback(() => { setSellers(null); get("/admin/sellers").then((d) => setSellers(Array.isArray(d) ? d : [])).catch(() => setSellers([])); }, [get]);
  const loadDrivers = useCallback(() => { setDrivers(null); get("/admin/drivers").then((d) => setDrivers(Array.isArray(d) ? d : [])).catch(() => setDrivers([])); }, [get]);
  const loadOrders = useCallback(() => { setOrders(null); get("/admin/orders").then((d) => setOrders(Array.isArray(d) ? d : [])).catch(() => setOrders([])); }, [get]);

  useEffect(() => {
    if (!ready) return;
    loadDashboard();
  }, [ready, loadDashboard]);

  // Load section data on demand
  useEffect(() => {
    if (!ready) return;
    if (section === "sellers" && sellers === null) loadSellers();
    if (section === "drivers" && drivers === null) loadDrivers();
    if (section === "orders" && orders === null) loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, ready]);

  async function patch(path, body, okMsg) {
    try {
      const res = await fetch(API + path, { method: "PATCH", headers: headers(), body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error");
      showToast(okMsg);
      return true;
    } catch (e) {
      showToast("Error: " + e.message, "var(--brand)");
      return false;
    }
  }

  async function approveShop(shop) {
    setBusy(shop.id);
    const ok = await patch(`/admin/sellers/${shop.id}/approve`, null, "✅ Tienda aprobada");
    if (ok) { loadSellers(); loadDashboard(); }
    setBusy(null);
  }
  async function suspendShop(shop) {
    setBusy(shop.id);
    const ok = await patch(`/admin/sellers/${shop.id}/suspend`, { reason: "Suspendida por admin" }, "Tienda suspendida");
    if (ok) { loadSellers(); loadDashboard(); }
    setBusy(null);
  }
  async function approveDriver(driver) {
    setBusy(driver.id);
    const ok = await patch(`/admin/drivers/${driver.id}/approve`, null, "✅ Motorista aprobado");
    if (ok) { loadDrivers(); loadDashboard(); }
    setBusy(null);
  }

  function logout() {
    localStorage.clear();
    window.location.href = "/login";
  }

  if (!ready) return null;

  const pending = stats?.pendingSellers || 0;

  function Pill({ map, status }) {
    const [cls, label] = (map[status] || ["pill-offline", status || "—"]);
    return <span className={"status-pill " + cls}><span className="pill-dot" />{label}</span>;
  }

  return (
    <div className="admin-app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-logo" onClick={() => setSection("dashboard")}>Traeme<span>Loo</span></div>
          <div className="admin-badge">Admin</div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((grp) => (
            <div key={grp.group}>
              <div className="nav-group">{grp.group}</div>
              {grp.items.map((it) => (
                <div key={it.key} className={"nav-item" + (section === it.key ? " active" : "")} onClick={() => setSection(it.key)}>
                  <span className="icon">{it.icon}</span>
                  {it.label}
                  {it.key === "sellers" && pending > 0 && <span className="nav-badge yellow">{pending}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-user" onClick={logout} title="Cerrar sesión">
          <div className="user-av">👤</div>
          <div className="user-info">
            <div className="user-name">{adminName}</div>
            <div className="user-role">Administrador</div>
          </div>
          <span className="logout-ic">⏻</span>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">{TITLES[section]}</div>
          </div>
          <div className="topbar-right">
            <button className="tb-btn" onClick={() => { loadDashboard(); if (section === "sellers") loadSellers(); if (section === "drivers") loadDrivers(); if (section === "orders") loadOrders(); showToast("Actualizado"); }}>↻ Actualizar</button>
            <button className="tb-btn" onClick={logout}>Salir</button>
          </div>
        </div>

        <div className="content">
          {/* DASHBOARD */}
          {section === "dashboard" && (
            <>
              <div className="kpi-grid">
                <div className="kpi"><div className="kpi-icon">💰</div><div className="kpi-val green">{rd(stats?.revenue)}</div><div className="kpi-label">Ingresos (mes)</div></div>
                <div className="kpi"><div className="kpi-icon">📦</div><div className="kpi-val red">{stats?.todayOrders ?? "—"}</div><div className="kpi-label">Pedidos Hoy</div></div>
                <div className="kpi"><div className="kpi-icon">🏪</div><div className="kpi-val blue">{stats?.activeShops ?? "—"}</div><div className="kpi-label">Tiendas Activas</div></div>
                <div className="kpi"><div className="kpi-icon">🛵</div><div className="kpi-val purple">{stats?.onlineDrivers ?? "—"}</div><div className="kpi-label">Motoristas Online</div></div>
                <div className="kpi"><div className="kpi-icon">👥</div><div className="kpi-val">{stats?.totalCustomers ?? "—"}</div><div className="kpi-label">Clientes</div></div>
                <div className="kpi"><div className="kpi-icon">⏳</div><div className="kpi-val yellow">{stats?.pendingSellers ?? "—"}</div><div className="kpi-label">Tiendas por revisar</div></div>
                <div className="kpi"><div className="kpi-icon">⭐</div><div className="kpi-val yellow">{stats?.platformRating ? parseFloat(stats.platformRating).toFixed(2) : "—"}</div><div className="kpi-label">Rating Plataforma</div></div>
              </div>

              <div className="table-container">
                <div className="table-header"><div className="table-title">Pedidos en Vivo</div></div>
                {!stats ? (
                  <div className="muted-pad">Cargando...</div>
                ) : (stats.liveOrders || []).length === 0 ? (
                  <div className="muted-pad">No hay pedidos activos en este momento.</div>
                ) : (
                  stats.liveOrders.map((o) => (
                    <div className="live-order-row" key={o.id}>
                      <div className="lo-id">#{o.orderNumber}</div>
                      <div className="lo-info">
                        <div className="lo-name">{o.shop?.name || "Tienda"} → {o.customer?.user?.name || "Cliente"}</div>
                        <div className="lo-meta">{o.driver?.user?.name ? "🛵 " + o.driver.user.name : "Sin motorista"}</div>
                      </div>
                      <div className="lo-amount">{rd(o.total)}</div>
                      <div className="lo-status"><Pill map={ORDER_PILL} status={o.status} /></div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* SELLERS */}
          {section === "sellers" && (
            <div className="table-container">
              <div className="table-header"><div className="table-title">Tiendas</div></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Tienda</th><th>Dueño</th><th>Categoría</th><th>Pedidos</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {sellers === null && <tr><td colSpan={6}><div className="muted-pad">Cargando tiendas...</div></td></tr>}
                    {sellers && sellers.length === 0 && <tr><td colSpan={6}><div className="muted-pad">No hay tiendas registradas.</div></td></tr>}
                    {sellers && sellers.map((s) => (
                      <tr key={s.id}>
                        <td><div className="td-name">{s.name}</div><div className="td-sub">{s.address || ""}</div></td>
                        <td><div className="td-name">{s.seller?.user?.name || "—"}</div><div className="td-sub">{s.seller?.user?.phone || ""}</div></td>
                        <td>{s.category || "—"}</td>
                        <td>{s._count?.orders ?? 0}</td>
                        <td><Pill map={SHOP_PILL} status={s.status} /></td>
                        <td>
                          <div className="action-group">
                            {(s.status === "PENDING_REVIEW" || s.status === "SUSPENDED") && (
                              <button className="act-btn approve" disabled={busy === s.id} onClick={() => approveShop(s)}>Aprobar</button>
                            )}
                            {s.status === "ACTIVE" && (
                              <button className="act-btn suspend" disabled={busy === s.id} onClick={() => suspendShop(s)}>Suspender</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DRIVERS */}
          {section === "drivers" && (
            <div className="table-container">
              <div className="table-header"><div className="table-title">Motoristas</div></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Motorista</th><th>Teléfono</th><th>Vehículo</th><th>Entregas</th><th>Disponibilidad</th><th>Cuenta</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {drivers === null && <tr><td colSpan={7}><div className="muted-pad">Cargando motoristas...</div></td></tr>}
                    {drivers && drivers.length === 0 && <tr><td colSpan={7}><div className="muted-pad">No hay motoristas registrados.</div></td></tr>}
                    {drivers && drivers.map((d) => {
                      const acct = d.user?.status === "ACTIVE" ? "ACTIVE" : "PENDING";
                      return (
                        <tr key={d.id}>
                          <td><div className="td-name">{d.user?.name || "—"}</div></td>
                          <td>{d.user?.phone || "—"}</td>
                          <td>{d.vehicleType || "—"}</td>
                          <td>{d._count?.orders ?? 0}</td>
                          <td><Pill map={{ ONLINE: ["pill-online", "En línea"], OFFLINE: ["pill-offline", "Desconectado"], BUSY: ["pill-review", "Ocupado"] }} status={d.status} /></td>
                          <td><Pill map={{ ACTIVE: ["pill-active", "Activo"], PENDING: ["pill-pending", "Pendiente"] }} status={acct} /></td>
                          <td>
                            <div className="action-group">
                              {acct !== "ACTIVE" && <button className="act-btn approve" disabled={busy === d.id} onClick={() => approveDriver(d)}>Aprobar</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ORDERS */}
          {section === "orders" && (
            <div className="table-container">
              <div className="table-header"><div className="table-title">Todos los Pedidos</div></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Pedido</th><th>Tienda</th><th>Cliente</th><th>Motorista</th><th>Total</th><th>Estado</th></tr></thead>
                  <tbody>
                    {orders === null && <tr><td colSpan={6}><div className="muted-pad">Cargando pedidos...</div></td></tr>}
                    {orders && orders.length === 0 && <tr><td colSpan={6}><div className="muted-pad">No hay pedidos.</div></td></tr>}
                    {orders && orders.map((o) => (
                      <tr key={o.id}>
                        <td><div className="td-name">#{o.orderNumber}</div></td>
                        <td>{o.shop?.name || "—"}</td>
                        <td>{o.customer?.user?.name || "—"}</td>
                        <td>{o.driver?.user?.name || "—"}</td>
                        <td>{rd(o.total)}</td>
                        <td><Pill map={ORDER_PILL} status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PLACEHOLDERS */}
          {section === "config" && <div className="table-container placeholder-panel"><div className="big">⚙️</div><div className="t">Configuración</div><div className="d">Próximamente — comisión, tarifa de envío y ajustes de la plataforma.</div></div>}
          {section === "payouts" && <div className="table-container placeholder-panel"><div className="big">🏦</div><div className="t">Pagos</div><div className="d">Próximamente — pagos a tiendas y motoristas.</div></div>}
          {section === "zones" && <div className="table-container placeholder-panel"><div className="big">🗺️</div><div className="t">Zonas</div><div className="d">Próximamente — gestión de zonas de entrega.</div></div>}
        </div>
      </main>

      {toast && <div className="admin-toast" style={{ background: toast.color }}>{toast.msg}</div>}
    </div>
  );
}

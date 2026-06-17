"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import OrderDetail from "@/components/OrderDetail";
import "./perfil.css";

function rd(n) {
  return "RD$" + Number(n || 0).toLocaleString();
}

const STATUS = {
  PENDING: ["st-yellow", "Pendiente"],
  ACCEPTED: ["st-blue", "Aceptado"],
  PREPARING: ["st-blue", "Preparando"],
  READY: ["st-orange", "Listo"],
  ASSIGNED: ["st-blue", "Motorista asignado"],
  PICKED_UP: ["st-blue", "Recogido"],
  EN_ROUTE: ["st-green", "En camino"],
  DELIVERED: ["st-green", "Entregado ✓"],
  CANCELLED: ["st-red", "Cancelado"],
  REJECTED: ["st-red", "Rechazado"],
};

export default function Perfil() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState(null);
  const [addr, setAddr] = useState("");
  const [saved, setSaved] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem("tl_token");
      const u = JSON.parse(localStorage.getItem("tl_user") || "null");
      if (!t || !u) { window.location.href = "/login"; return; }
      setUser(u);
      try {
        const a = JSON.parse(localStorage.getItem("tl_address") || "null");
        setAddr((a && a.addr) || u.defaultAddress || "");
      } catch {}
      setReady(true);
    } catch {
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    fetch(API + "/orders?limit=50", {
      headers: { Authorization: "Bearer " + localStorage.getItem("tl_token") },
    })
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => setOrders([]));
  }, [ready]);

  function saveAddr() {
    try {
      localStorage.setItem("tl_address", JSON.stringify({ addr: addr.trim(), ref: "" }));
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function logout() {
    localStorage.clear();
    window.location.href = "/login";
  }

  if (!ready) return null;

  return (
    <div className="perfil-page">
      <header className="perfil-nav">
        <div className="logo" onClick={() => (window.location.href = "/")}>
          Traeme<span>Loo</span>
        </div>
        <a className="back-link" href="/">← Volver a la tienda</a>
      </header>

      <main className="perfil-main">
        <div className="profile-card">
          <div className="avatar">{(user.name || "?").charAt(0).toUpperCase()}</div>
          <div>
            <div className="p-name">{user.name}</div>
            <div className="p-sub">{user.phone}{user.email ? " · " + user.email : ""}</div>
          </div>
          <button className="logout-btn" onClick={logout}>Cerrar sesión</button>
        </div>

        <section className="block">
          <h3 className="block-title">Dirección de entrega predeterminada</h3>
          <textarea
            className="addr-field"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Calle, número, sector, ciudad"
          />
          <button className="save-btn" onClick={saveAddr}>
            {saved ? "✓ Guardada" : "Guardar dirección"}
          </button>
          <div className="hint">Se usará automáticamente al momento de pagar.</div>
        </section>

        <section className="block">
          <h3 className="block-title">Mis Pedidos</h3>
          {orders === null && <div className="muted">Cargando pedidos...</div>}
          {orders && orders.length === 0 && (
            <div className="muted">Aún no tienes pedidos. ¡Haz tu primer pedido!</div>
          )}
          {orders &&
            orders.map((o) => {
              const [cls, label] = STATUS[o.status] || ["st-yellow", o.status];
              const date = o.createdAt
                ? new Date(o.createdAt).toLocaleDateString("es-DO", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })
                : "";
              const items = o.items || [];
              return (
                <div className="order-card" key={o.id} style={{ cursor: "pointer" }} onClick={() => setSelectedId(o.id)}>
                  <div className="oc-top">
                    <span className="oc-id">#{o.orderNumber}</span>
                    <span className={"oc-status " + cls}>{label}</span>
                  </div>
                  <div className="oc-shop">{o.shop?.name || "Tienda"}</div>
                  <div className="oc-items">
                    {items.length
                      ? items.map((i) => `${i.quantity}× ${i.name}`).join(", ")
                      : "—"}
                  </div>
                  {o.deliveryAddress && <div className="oc-addr">📍 {o.deliveryAddress}</div>}
                  <div className="oc-bottom">
                    <span className="oc-date">{date}</span>
                    <span className="oc-total">{rd(o.total)}</span>
                  </div>
                </div>
              );
            })}
        </section>
      </main>

      <OrderDetail orderId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

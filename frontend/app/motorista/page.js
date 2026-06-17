"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
import "./motorista.css";

function rd(n) {
  return "RD$" + Number(n || 0).toLocaleString();
}

const ACTIVE_STATUSES = ["ASSIGNED", "PICKED_UP", "EN_ROUTE"];
const PROGRESS = {
  ASSIGNED: [true, false, false, false],
  PICKED_UP: [true, true, false, false],
  EN_ROUTE: [true, true, true, false],
  DELIVERED: [true, true, true, true],
};
const STEP_MSG = {
  PICKED_UP: "Paquete recogido, en camino al cliente",
  EN_ROUTE: "Motorista en camino al cliente",
  DELIVERED: "¡Pedido entregado exitosamente!",
};
const DRIVER_PAY = 120;

export default function DriverApp() {
  const [ready, setReady] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [earnings, setEarnings] = useState({});
  const [orders, setOrders] = useState([]);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const acceptingRef = useRef(false);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("tl_token") : null);
  const authHeaders = useCallback(() => ({ "Content-Type": "application/json", Authorization: "Bearer " + token() }), []);

  useEffect(() => {
    try {
      const t = localStorage.getItem("tl_token");
      const u = JSON.parse(localStorage.getItem("tl_user") || "null");
      if (!t || !u) { window.location.href = "/login"; return; }
      if (u.role !== "DRIVER") { alert("Acceso no autorizado. Redirigiendo..."); window.location.href = "/login"; return; }
      setDriverName((u.name || "").split(" ")[0]);
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

  const loadEarnings = useCallback(async () => {
    try {
      const res = await fetch(API + "/drivers/earnings", { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setEarnings(data);
    } catch {}
  }, [authHeaders]);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch(API + "/orders?limit=50", { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setOrders(data.orders || []);
    } catch {}
  }, [authHeaders]);

  useEffect(() => {
    if (!ready) return;
    loadEarnings();
    loadOrders();
    const id = setInterval(loadOrders, 20000);
    return () => clearInterval(id);
  }, [ready, loadEarnings, loadOrders]);

  async function toggleOnline() {
    const next = !isOnline;
    setIsOnline(next);
    showToast(next ? "✅ ¡Estás en línea!" : "⏸ Ahora estás desconectado");
    try {
      await fetch(API + "/drivers/status", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: next ? "ONLINE" : "OFFLINE" }),
      });
    } catch {}
  }

  const active = orders.find((o) => ACTIVE_STATUSES.includes(o.status)) || null;
  const available = orders.filter((o) => o.status === "READY");
  const completed = orders.filter((o) => o.status === "DELIVERED");

  async function acceptOrder(orderId) {
    if (active) { showToast("Ya tienes una entrega activa", "var(--brand)"); return; }
    if (acceptingRef.current) return;
    acceptingRef.current = true;
    try {
      const res = await fetch(API + "/orders/" + orderId + "/status", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: "ASSIGNED", message: "Motorista en camino a la tienda" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      showToast("✅ ¡Pedido aceptado! Ve a la tienda.");
      loadOrders();
    } catch (e) {
      showToast("Error: " + e.message, "var(--brand)");
    } finally {
      acceptingRef.current = false;
    }
  }

  async function updateStatus(status) {
    if (!active) return;
    try {
      const res = await fetch(API + "/orders/" + active.id + "/status", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status, message: STEP_MSG[status] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (status === "DELIVERED") {
        showToast("🎉 ¡Entrega completada! Bien hecho.");
        loadEarnings();
      } else {
        showToast(STEP_MSG[status]);
      }
      loadOrders();
    } catch (e) {
      showToast("Error: " + e.message, "var(--brand)");
    }
  }

  function openMaps(address) {
    const url = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address + ", Santiago, República Dominicana");
    window.open(url, "_blank");
  }

  if (!ready) return null;

  const now = new Date().toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });

  function StepDot({ done, current, label, icon }) {
    const cls = done ? "done" : current ? "current" : "pending";
    return (
      <div className="step">
        <div className={"step-dot " + cls}>{done ? "✓" : current ? icon : ""}</div>
        <div className="step-label">{label}</div>
      </div>
    );
  }

  function ActiveDelivery() {
    const o = active;
    const p = PROGRESS[o.status] || PROGRESS.ASSIGNED;
    const shopName = o.shop ? o.shop.name : "Tienda";
    const shopAddr = o.shop ? o.shop.address : "";
    const customerName = o.customer?.user?.name || "Cliente";
    const customerPhone = o.customer?.user?.phone || "";
    const deliveryAddr = o.deliveryAddress || "Dirección del cliente";
    const itemCount = o.items ? o.items.length : 0;
    return (
      <>
        <div className="section-label">Entrega Activa</div>
        <div className="active-delivery">
          <div className="delivery-order-id">PEDIDO #{o.orderNumber}</div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <StepDot done={p[0]} current={false} label="Asignado" icon="" />
            <div className={"step-connector" + (p[1] ? " done" : "")} />
            <StepDot done={p[1]} current={!p[1] && p[0]} label="En Tienda" icon="🏪" />
            <div className={"step-connector" + (p[2] ? " done" : "")} />
            <StepDot done={p[2]} current={!p[2] && p[1]} label="En Camino" icon="🛵" />
            <div className={"step-connector" + (p[3] ? " done" : "")} />
            <StepDot done={p[3]} current={!p[3] && p[2]} label="Entregado" icon="📦" />
          </div>
          <div className="delivery-route">
            <div className="route-point">
              <div className="route-dot pickup" />
              <div>
                <div className="route-text-label">Recoger en</div>
                <div className="route-text-addr">{shopName}{shopAddr ? " · " + shopAddr : ""}</div>
              </div>
            </div>
            <div style={{ marginLeft: 4 }}><div className="route-line" /></div>
            <div className="route-point">
              <div className="route-dot dropoff" />
              <div>
                <div className="route-text-label">Entregar a</div>
                <div className="route-text-addr">{customerName} · {deliveryAddr}</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
            <span>📦 {itemCount} artículo(s)</span>
            <span>💰 {rd(o.total)}</span>
            <span>💳 {o.paymentMethod === "CASH" ? "Efectivo" : "Tarjeta"}</span>
          </div>
          <div className="delivery-actions">
            {customerPhone && (
              <button className="del-btn secondary" onClick={() => (window.location.href = "tel:" + customerPhone)}>📞 Llamar</button>
            )}
            <button className="del-btn secondary" onClick={() => openMaps(deliveryAddr)}>🗺 Navegar</button>
            {o.status === "ASSIGNED" && <button className="del-btn primary" onClick={() => updateStatus("PICKED_UP")}>Llegué a la tienda ✓</button>}
            {o.status === "PICKED_UP" && <button className="del-btn primary" onClick={() => updateStatus("EN_ROUTE")}>Recogido — En Camino 🛵</button>}
            {o.status === "EN_ROUTE" && <button className="del-btn primary" onClick={() => updateStatus("DELIVERED")}>Marcar Entregado ✓</button>}
          </div>
        </div>
        <div className="map-placeholder">
          <div className="map-grid" />
          <div className="map-pin">📍</div>
          <div className="map-label">Navegando a {o.status === "ASSIGNED" ? shopName : customerName}</div>
        </div>
      </>
    );
  }

  return (
    <div className="driver-app">
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="status-bar">
            <span>{now}</span>
            <span>🛵 📶 🔋</span>
          </div>

          <div className="driver-header">
            <div className="driver-greeting">¡Hola de nuevo,</div>
            <div className="driver-name">{driverName || "Motorista"} 👋</div>
            <div className="online-toggle-row">
              <div className="online-label">
                Estado
                <small style={{ color: isOnline ? "var(--green)" : "var(--text3)" }}>
                  {isOnline ? "✓ Estás recibiendo pedidos" : "⏸ No estás recibiendo pedidos"}
                </small>
              </div>
              <button className={"big-toggle" + (isOnline ? "" : " off")} onClick={toggleOnline} aria-label="online toggle" />
            </div>
          </div>

          <div className="today-stats">
            <div className="today-stat">
              <div className="today-stat-val green" style={{ fontSize: 16 }}>{rd(earnings.today)}</div>
              <div className="today-stat-label">Hoy</div>
            </div>
            <div className="today-stat">
              <div className="today-stat-val blue">{earnings.totalDeliveries || 0}</div>
              <div className="today-stat-label">Entregas</div>
            </div>
            <div className="today-stat">
              <div className="today-stat-val yellow">{earnings.rating ? parseFloat(earnings.rating).toFixed(1) + "★" : "-★"}</div>
              <div className="today-stat-label">Rating</div>
            </div>
          </div>

          <div className="earnings-pill">
            <div>
              <div className="ep-label">Ganancias esta semana</div>
              <div className="ep-val">{rd(earnings.week)}</div>
            </div>
            <div className="ep-icon">💸</div>
          </div>

          {active ? (
            <ActiveDelivery />
          ) : (
            <>
              <div className="section-label">Pedidos Disponibles</div>
              <div className="order-queue">
                {available.length === 0 ? (
                  <div style={{ padding: 20, color: "var(--text3)", textAlign: "center" }}>
                    No hay pedidos disponibles ahora.<br />Se actualizará automáticamente.
                  </div>
                ) : (
                  available.map((o) => {
                    const shopName = o.shop ? o.shop.name : "Tienda";
                    const deliveryAddr = o.deliveryAddress || "Dirección del cliente";
                    const itemCount = o.items ? o.items.length : 0;
                    return (
                      <div className="queue-card" key={o.id}>
                        <div className="queue-top">
                          <div className="queue-id">#{o.orderNumber}</div>
                          <div className="queue-pay">{rd(DRIVER_PAY)}</div>
                        </div>
                        <div className="queue-route">📦 {shopName} → {deliveryAddr.substring(0, 40)}</div>
                        <div className="queue-meta">
                          <span>📦 {itemCount} artículo(s)</span>
                          <span>{o.paymentMethod === "CASH" ? "💵 Efectivo" : "💳 Tarjeta"}</span>
                        </div>
                        <button className="accept-btn" onClick={() => acceptOrder(o.id)}>Aceptar Pedido ↗</button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {completed.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 8 }}>Entregas Completadas</div>
              <div className="order-queue">
                {completed.map((o) => (
                  <div className="queue-card" key={o.id} style={{ borderColor: "rgba(0,229,160,0.2)" }}>
                    <div className="queue-top">
                      <div className="queue-id">#{o.orderNumber}</div>
                      <div style={{ color: "var(--green)", fontSize: 13, fontWeight: 700 }}>✓ Entregado</div>
                    </div>
                    <div className="queue-route">📦 {o.shop ? o.shop.name : "Tienda"} · {rd(o.total)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bottom-nav">
          <div className="bottom-nav-item active"><div className="bottom-nav-icon">🏠</div><div className="bottom-nav-label">Inicio</div></div>
          <div className="bottom-nav-item"><div className="bottom-nav-icon">📦</div><div className="bottom-nav-label">Pedidos</div></div>
          <div className="bottom-nav-item"><div className="bottom-nav-icon">💰</div><div className="bottom-nav-label">Ganancias</div></div>
          <div className="bottom-nav-item" onClick={() => { localStorage.clear(); window.location.href = "/login"; }}><div className="bottom-nav-icon">👤</div><div className="bottom-nav-label">Salir</div></div>
        </div>
      </div>

      {toast && <div className="driver-toast" style={{ background: toast.color }}>{toast.msg}</div>}
    </div>
  );
}

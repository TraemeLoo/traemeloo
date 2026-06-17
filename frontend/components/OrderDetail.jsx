"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";

function rd(n) {
  return "RD$" + Number(n || 0).toLocaleString();
}

const STATUS = {
  PENDING: ["#FFD94A", "Pendiente"],
  ACCEPTED: ["#5B9BFF", "Aceptado"],
  PREPARING: ["#5B9BFF", "Preparando"],
  READY: ["#FF8C42", "Listo"],
  ASSIGNED: ["#5B9BFF", "Motorista asignado"],
  PICKED_UP: ["#5B9BFF", "Recogido"],
  EN_ROUTE: ["#1DDB8B", "En camino"],
  DELIVERED: ["#1DDB8B", "Entregado"],
  CANCELLED: ["#FF3C2F", "Cancelado"],
  REJECTED: ["#FF3C2F", "Rechazado"],
};

const PAY_STATUS = {
  PENDING: "Pendiente", PAID: "Pagado", FAILED: "Fallido", REFUNDED: "Reembolsado",
};

const C = {
  border: "#2E2E2E", text: "#F5F5F0", text2: "#A0A0A0", text3: "#6A6A6A",
  brand: "#FF3C2F", panel: "#1E1E1E", bg: "#161620",
};

function fmt(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("es-DO", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}

export default function OrderDetail({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    setOrder(null);
    setErr(null);
    fetch(API + "/orders/" + orderId, {
      headers: { Authorization: "Bearer " + localStorage.getItem("tl_token") },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error cargando el pedido");
        return d;
      })
      .then(setOrder)
      .catch((e) => setErr(e.message));
  }, [orderId]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!orderId) return null;

  const [stColor, stLabel] = order ? (STATUS[order.status] || ["#A0A0A0", order.status]) : ["#A0A0A0", ""];

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={box}>
        <div style={header}>
          <div>
            <div style={{ fontFamily: "var(--font-unbounded), sans-serif", fontSize: 18, fontWeight: 700 }}>
              {order ? "Pedido #" + order.orderNumber : "Cargando..."}
            </div>
            {order && <div style={{ color: C.text3, fontSize: 12, marginTop: 3 }}>{fmt(order.createdAt)}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {order && (
              <span style={{ ...pill, color: stColor, background: stColor + "22" }}>{stLabel}</span>
            )}
            <button style={closeBtn} onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        </div>

        <div style={body}>
          {err && <div style={{ color: "#FF6B61", padding: "20px 0" }}>⚠ {err}</div>}
          {!order && !err && <div style={{ color: C.text3, padding: "20px 0" }}>Cargando detalles...</div>}

          {order && (
            <>
              {/* TIMELINE */}
              {Array.isArray(order.tracking) && order.tracking.length > 0 && (
                <section style={section}>
                  <div style={sectionTitle}>Seguimiento</div>
                  <div style={{ position: "relative", paddingLeft: 18 }}>
                    {order.tracking.map((t, i) => {
                      const [col] = STATUS[t.status] || ["#A0A0A0"];
                      const last = i === order.tracking.length - 1;
                      return (
                        <div key={i} style={{ position: "relative", paddingBottom: last ? 0 : 16 }}>
                          <div style={{ position: "absolute", left: -18, top: 3, width: 9, height: 9, borderRadius: "50%", background: col }} />
                          {!last && <div style={{ position: "absolute", left: -14, top: 12, width: 1, bottom: 0, background: C.border }} />}
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{(STATUS[t.status] || ["", t.status])[1]}</div>
                          {t.message && <div style={{ fontSize: 12, color: C.text2, marginTop: 1 }}>{t.message}</div>}
                          <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{fmt(t.createdAt)}</div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ITEMS */}
              <section style={section}>
                <div style={sectionTitle}>Artículos</div>
                {(order.items || []).map((it, i) => (
                  <div key={i} style={rowLine}>
                    <span>{it.quantity}× {it.name}</span>
                    <span style={{ color: C.text2 }}>{rd((it.price || 0) * (it.quantity || 1))}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid " + C.border, marginTop: 8, paddingTop: 8 }}>
                  {order.subtotal != null && <div style={rowLine}><span style={{ color: C.text2 }}>Subtotal</span><span style={{ color: C.text2 }}>{rd(order.subtotal)}</span></div>}
                  {order.deliveryFee != null && <div style={rowLine}><span style={{ color: C.text2 }}>Envío</span><span style={{ color: C.text2 }}>{rd(order.deliveryFee)}</span></div>}
                  {order.discount ? <div style={rowLine}><span style={{ color: C.text2 }}>Descuento</span><span style={{ color: "#1DDB8B" }}>-{rd(order.discount)}</span></div> : null}
                  <div style={{ ...rowLine, fontWeight: 700, fontSize: 16, marginTop: 4 }}><span>Total</span><span>{rd(order.total)}</span></div>
                </div>
              </section>

              {/* DELIVERY */}
              <section style={section}>
                <div style={sectionTitle}>Entrega</div>
                <div style={kv}><span style={k}>Dirección</span><span style={v}>{order.deliveryAddress || "—"}</span></div>
                {order.shop && <div style={kv}><span style={k}>Tienda</span><span style={v}>{order.shop.name}{order.shop.address ? " · " + order.shop.address : ""}</span></div>}
                {order.customer?.user && <div style={kv}><span style={k}>Cliente</span><span style={v}>{order.customer.user.name}{order.customer.user.phone ? " · " + order.customer.user.phone : ""}</span></div>}
                <div style={kv}><span style={k}>Motorista</span><span style={v}>{order.driver?.user ? order.driver.user.name + (order.driver.user.phone ? " · " + order.driver.user.phone : "") : "Sin asignar"}</span></div>
              </section>

              {/* PAYMENT */}
              <section style={{ ...section, borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
                <div style={sectionTitle}>Pago</div>
                <div style={kv}><span style={k}>Método</span><span style={v}>{order.paymentMethod === "CASH" ? "Efectivo" : "Tarjeta"}</span></div>
                {order.payment && <div style={kv}><span style={k}>Estado</span><span style={v}>{PAY_STATUS[order.payment.status] || order.payment.status}</span></div>}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const box = {
  width: "100%", maxWidth: 460, maxHeight: "88vh", background: C.bg, color: C.text,
  border: "1px solid " + C.border, borderRadius: 18, overflow: "hidden",
  display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
  fontFamily: "var(--font-dm-sans), sans-serif",
};
const header = {
  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
  padding: "18px 20px", borderBottom: "1px solid " + C.border, flexShrink: 0,
};
const body = { padding: "18px 20px", overflowY: "auto" };
const pill = { fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 50, whiteSpace: "nowrap" };
const closeBtn = {
  background: C.panel, border: "1px solid " + C.border, color: C.text2,
  width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 13, lineHeight: 1,
};
const section = { borderBottom: "1px solid " + C.border, paddingBottom: 16, marginBottom: 16 };
const sectionTitle = { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: C.text3, marginBottom: 10, fontWeight: 700 };
const rowLine = { display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0" };
const kv = { display: "flex", gap: 12, fontSize: 14, padding: "4px 0" };
const k = { color: C.text3, width: 84, flexShrink: 0 };
const v = { flex: 1 };

"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { API } from "@/lib/api";
import { useCart } from "@/context/CartContext";

function rd(n) {
  return "RD$" + Number(n || 0).toLocaleString();
}

const overlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
};
const box = {
  background: "#141414", border: "1px solid #2E2E2E", borderRadius: 16,
  padding: 32, width: "100%", maxWidth: 420,
};
const methodBtn = {
  width: "100%", background: "#1E1E1E", border: "1.5px solid #2E2E2E",
  borderRadius: 12, padding: "16px 20px", marginBottom: 10, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 14, color: "#F5F5F0", textAlign: "left",
};
const cancelBtn = {
  width: "100%", background: "none", border: "none", color: "#5A5A5A",
  padding: 10, cursor: "pointer", fontSize: 13, marginTop: 4,
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("tl_token") : null;
  return { "Content-Type": "application/json", Authorization: "Bearer " + token };
}

function userAddress() {
  try {
    const u = JSON.parse(localStorage.getItem("tl_user") || "null");
    return u && u.defaultAddress ? u.defaultAddress : "Dirección del cliente";
  } catch {
    return "Dirección del cliente";
  }
}

// ---- Stripe card form (inner; must live inside <Elements>) ----
function CardForm({ clientSecret, order, total, onPaid, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [err, setErr] = useState(null);
  const [paying, setPaying] = useState(false);

  async function pay() {
    if (!stripe || !elements) return;
    setPaying(true);
    setErr(null);
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: elements.getElement(CardElement) },
    });
    if (result.error) {
      setErr(result.error.message);
      setPaying(false);
      return;
    }
    try {
      await fetch(API + "/payments/confirm", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ paymentIntentId: result.paymentIntent.id, orderId: order.id }),
      });
    } catch {
      /* order is paid in Stripe; backend confirm is best-effort */
    }
    onPaid();
  }

  return (
    <div style={box}>
      <h3 style={{ fontFamily: "var(--font-unbounded), sans-serif", fontSize: 18, marginBottom: 4 }}>
        Pagar Pedido
      </h3>
      <p style={{ color: "#A0A0A0", fontSize: 13, marginBottom: 24 }}>
        Pedido {order.orderNumber} · {rd(total)}
      </p>
      <div style={{ background: "#1E1E1E", border: "1.5px solid #2E2E2E", borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: {
                color: "#F5F5F0",
                fontFamily: "DM Sans, sans-serif",
                fontSize: "15px",
                "::placeholder": { color: "#5A5A5A" },
              },
            },
          }}
        />
      </div>
      <div style={{ color: "#FF6B61", fontSize: 13, marginBottom: 12, minHeight: 18 }}>{err}</div>
      <button
        onClick={pay}
        disabled={paying || !stripe}
        style={{
          width: "100%", background: "#FF3C2F", color: "#fff", border: "none",
          padding: 14, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer",
          fontFamily: "var(--font-dm-sans), sans-serif", marginBottom: 8,
          opacity: paying ? 0.7 : 1,
        }}
      >
        {paying ? "Procesando..." : "Pagar " + rd(total)}
      </button>
      <button onClick={onCancel} style={cancelBtn}>Cancelar</button>
    </div>
  );
}

export default function Checkout({ open, onClose }) {
  const { cart, shop, total, clearCart } = useCart();
  const [step, setStep] = useState("method"); // method | card | done
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);

  useEffect(() => {
    if (open) {
      setStep("method");
      setProcessing(false);
      setError(null);
      setOrder(null);
      setClientSecret(null);
    }
  }, [open]);

  if (!open) return null;

  async function createOrder(method) {
    if (!shop.id) {
      setError("Selecciona una tienda primero");
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      const res = await fetch(API + "/orders", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          shopId: shop.id,
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          deliveryAddress: userAddress(),
          deliveryLat: 19.4517,
          deliveryLng: -70.697,
          paymentMethod: method,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error creando pedido");
      setOrder(data);

      if (method === "CASH") {
        clearCart();
        setStep("done");
        setProcessing(false);
        return;
      }

      // CARD: create payment intent + load Stripe
      const intentRes = await fetch(API + "/payments/create-intent", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ orderId: data.id }),
      });
      const intent = await intentRes.json();
      if (!intentRes.ok) throw new Error(intent.error || "Error creando pago");
      setClientSecret(intent.clientSecret);

      const keyRes = await fetch(API + "/payments/publishable-key");
      const keyData = await keyRes.json();
      setStripePromise(loadStripe(keyData.publishableKey));

      setStep("card");
      setProcessing(false);
    } catch (e) {
      setError(e.message);
      setProcessing(false);
    }
  }

  // ---- METHOD PICKER ----
  if (step === "method") {
    return (
      <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={box}>
          <h3 style={{ fontFamily: "var(--font-unbounded), sans-serif", fontSize: 18, marginBottom: 6 }}>
            ¿Cómo quieres pagar?
          </h3>
          <p style={{ color: "#A0A0A0", fontSize: 13, marginBottom: 24 }}>
            Total: <strong style={{ color: "#F5F5F0" }}>{rd(total)}</strong>
          </p>
          {error && <div style={{ color: "#FF6B61", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button style={methodBtn} disabled={processing} onClick={() => createOrder("CARD")}>
            <span style={{ fontSize: 28 }}>💳</span>
            <span>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Tarjeta de crédito/débito</div>
              <div style={{ color: "#A0A0A0", fontSize: 12 }}>Pago seguro con Stripe</div>
            </span>
          </button>
          <button style={methodBtn} disabled={processing} onClick={() => createOrder("CASH")}>
            <span style={{ fontSize: 28 }}>💵</span>
            <span>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Efectivo al recibir</div>
              <div style={{ color: "#A0A0A0", fontSize: 12 }}>Paga cuando llegue tu pedido</div>
            </span>
          </button>
          <button style={cancelBtn} disabled={processing} onClick={onClose}>
            {processing ? "Procesando..." : "Cancelar"}
          </button>
        </div>
      </div>
    );
  }

  // ---- STRIPE CARD ----
  if (step === "card" && stripePromise && clientSecret) {
    return (
      <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <Elements stripe={stripePromise}>
          <CardForm
            clientSecret={clientSecret}
            order={order}
            total={total}
            onPaid={() => { clearCart(); setStep("done"); }}
            onCancel={onClose}
          />
        </Elements>
      </div>
    );
  }

  // ---- CONFIRMED ----
  if (step === "done") {
    return (
      <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={{ ...box, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h3 style={{ fontFamily: "var(--font-unbounded), sans-serif", fontSize: 20, marginBottom: 8 }}>
            ¡Pedido Confirmado!
          </h3>
          <p style={{ color: "#A0A0A0", fontSize: 14, marginBottom: 8 }}>
            Pedido <strong style={{ color: "#1DDB8B" }}>{order?.orderNumber}</strong>
          </p>
          <p style={{ color: "#A0A0A0", fontSize: 13, marginBottom: 24 }}>
            El vendedor fue notificado y preparará tu pedido pronto.
          </p>
          <button
            onClick={onClose}
            style={{
              background: "#FF3C2F", color: "#fff", border: "none", padding: "12px 28px",
              borderRadius: 50, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Continuar Comprando
          </button>
        </div>
      </div>
    );
  }

  return null;
}

"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import "./auth.css";

const ROLES = [
  { value: "CUSTOMER", icon: "🛍️", name: "Cliente" },
  { value: "SELLER", icon: "🏪", name: "Vendedor" },
  { value: "DRIVER", icon: "🛵", name: "Motorista" },
  { value: "ADMIN", icon: "⚙️", name: "Admin" },
];

const LOGIN_TITLES = {
  CUSTOMER: ["Bienvenido de vuelta", "Inicia sesión en tu cuenta de cliente"],
  SELLER: ["Portal del Vendedor", "Inicia sesión para gestionar tu tienda"],
  DRIVER: ["App del Motorista", "Inicia sesión para ver tus entregas"],
  ADMIN: ["Panel de Administración", "Acceso restringido al equipo TraemeLoo"],
};

const REDIRECTS = {
  CUSTOMER: "/",
  SELLER: "/vendedor",
  DRIVER: "/motorista",
  ADMIN: "/admin",
};

const CATEGORIES = [
  "Electrónica", "Moda", "Hogar y Decoración", "Belleza", "Deportes",
  "Niños y Juguetes", "Repuestos", "Jardín", "Libros", "Mascotas", "Otro",
];

export default function LoginPage() {
  const [role, setRole] = useState("CUSTOMER");
  const [tab, setTab] = useState("login");
  const [alert, setAlert] = useState(null); // { msg, type }
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null); // 'vendedor' | 'motorista'
  const [show, setShow] = useState({});
  const [f, setF] = useState({ dVehicle: "moto" });

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (k) => setShow((p) => ({ ...p, [k]: !p[k] }));

  // If already logged in, bounce to the right place.
  useEffect(() => {
    try {
      const token = localStorage.getItem("tl_token");
      const user = JSON.parse(localStorage.getItem("tl_user") || "null");
      if (token && user) window.location.href = REDIRECTS[user.role] || "/";
    } catch {}
  }, []);

  function redirect(role) {
    setTimeout(() => {
      window.location.href = REDIRECTS[role] || "/";
    }, 800);
  }

  function saveSession(data) {
    localStorage.setItem("tl_token", data.accessToken);
    localStorage.setItem("tl_refresh", data.refreshToken);
    localStorage.setItem("tl_user", JSON.stringify(data.user));
  }

  async function post(path, body) {
    const res = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function handleLogin() {
    setAlert(null);
    const phone = (f.loginPhone || "").trim();
    const password = f.loginPassword || "";
    if (!phone || !password) return setAlert({ msg: "Completa todos los campos", type: "error" });
    setLoading(true);
    try {
      const { ok, data } = await post("/auth/login", { phone, password });
      if (!ok) return setAlert({ msg: data.error || "Error al iniciar sesión", type: "error" });
      saveSession(data);
      setAlert({ msg: "¡Bienvenido! Redirigiendo...", type: "success" });
      redirect(data.user.role);
    } catch {
      setAlert({ msg: "No se pudo conectar al servidor. ¿Está corriendo el backend?", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterCustomer() {
    setAlert(null);
    const name = ((f.cName || "") + " " + (f.cLastname || "")).trim();
    const phone = (f.cPhone || "").trim();
    const email = (f.cEmail || "").trim();
    const password = f.cPassword || "";
    if (!name || !phone || !password) return setAlert({ msg: "Completa todos los campos obligatorios", type: "error" });
    if (password.length < 6) return setAlert({ msg: "La contraseña debe tener al menos 6 caracteres", type: "error" });
    setLoading(true);
    try {
      const { ok, data } = await post("/auth/register/customer", { name, phone, email, password });
      if (!ok) return setAlert({ msg: data.error || data.errors?.[0]?.msg || "Error al registrarse", type: "error" });
      saveSession(data);
      setAlert({ msg: "¡Cuenta creada! Redirigiendo...", type: "success" });
      redirect("CUSTOMER");
    } catch {
      setAlert({ msg: "No se pudo conectar al servidor.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSeller() {
    setAlert(null);
    const name = (f.sName || "").trim();
    const phone = (f.sPhone || "").trim();
    const password = f.sPassword || "";
    const shopName = (f.sShopName || "").trim();
    const shopCategory = f.sCategory || "";
    const shopAddress = (f.sAddress || "").trim();
    const shopDescription = (f.sDescription || "").trim();
    if (!name || !phone || !password || !shopName || !shopCategory || !shopAddress) {
      return setAlert({ msg: "Completa todos los campos obligatorios", type: "error" });
    }
    setLoading(true);
    try {
      const { ok, data } = await post("/auth/register/seller", { name, phone, password, shopName, shopCategory, shopAddress, shopDescription });
      if (!ok) return setAlert({ msg: data.error || "Error al enviar solicitud", type: "error" });
      setPending("vendedor");
    } catch {
      setAlert({ msg: "No se pudo conectar al servidor.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterDriver() {
    setAlert(null);
    const name = (f.dName || "").trim();
    const phone = (f.dPhone || "").trim();
    const password = f.dPassword || "";
    const vehicleType = f.dVehicle || "moto";
    const vehiclePlate = (f.dPlate || "").trim();
    const licenseNum = (f.dLicense || "").trim();
    if (!name || !phone || !password) return setAlert({ msg: "Completa todos los campos obligatorios", type: "error" });
    setLoading(true);
    try {
      const { ok, data } = await post("/auth/register/driver", { name, phone, password, vehicleType, vehiclePlate, licenseNum });
      if (!ok) return setAlert({ msg: data.error || "Error al enviar solicitud", type: "error" });
      setPending("motorista");
    } catch {
      setAlert({ msg: "No se pudo conectar al servidor.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function pickRole(r) {
    setRole(r);
    setAlert(null);
    setPending(null);
    if (r === "ADMIN") setTab("login");
  }

  function pickTab(t) {
    setTab(t);
    setAlert(null);
    setPending(null);
  }

  const onLoginKey = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  const Spinner = () => <div className="btn-spinner" />;

  return (
    <div className="auth-screen">
      {/* LEFT PANEL */}
      <div className="left-panel">
        <div className="left-bg" />
        <div className="left-grid" />
        <div className="left-content">
          <div className="brand-logo">Traeme<span>Loo</span></div>
          <div className="brand-tagline">Plataforma de entrega · República Dominicana</div>
          <div className="feature-list">
            <div className="feature">
              <div className="feature-icon">🛍️</div>
              <div className="feature-text">
                <h4>Compra en tiendas locales</h4>
                <p>Cientos de tiendas cerca de ti, entregadas en 30 minutos.</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">🏪</div>
              <div className="feature-text">
                <h4>Vende en nuestra plataforma</h4>
                <p>Abre tu tienda y llega a miles de clientes sin esfuerzo.</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">🛵</div>
              <div className="feature-text">
                <h4>Genera ingresos entregando</h4>
                <p>Trabaja cuando quieras y gana dinero en tu zona.</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">⚡</div>
              <div className="feature-text">
                <h4>Seguro y confiable</h4>
                <p>Pagos protegidos, seguimiento en tiempo real.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="left-bottom">© 2026 TraemeLoo · República Dominicana</div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel">
        <div className="auth-box">
          {/* ROLE SELECTOR */}
          <div className="role-selector">
            {ROLES.map((r) => (
              <button
                key={r.value}
                className={"role-btn" + (role === r.value ? " active" : "")}
                onClick={() => pickRole(r.value)}
              >
                <span className="role-icon">{r.icon}</span>
                <span className="role-name">{r.name}</span>
              </button>
            ))}
          </div>

          {/* TABS */}
          <div className="auth-tabs">
            <div className={"auth-tab" + (tab === "login" ? " active" : "")} onClick={() => pickTab("login")}>
              Iniciar Sesión
            </div>
            {role !== "ADMIN" && (
              <div className={"auth-tab" + (tab === "register" ? " active" : "")} onClick={() => pickTab("register")}>
                Registrarse
              </div>
            )}
          </div>

          {/* ALERT */}
          {alert && (
            <div className={"alert " + alert.type}>
              <span>{alert.type === "success" ? "✓" : "✕"}</span>
              <span>{alert.msg}</span>
            </div>
          )}

          {/* PENDING */}
          {pending && (
            <div className="pending-box">
              <div className="pending-icon">⏳</div>
              <div className="pending-title">Solicitud Enviada</div>
              <div className="pending-text">
                Tu solicitud como <strong>{pending}</strong> fue enviada exitosamente.
                <br /><br />
                Nuestro equipo la revisará en las próximas <strong>24-48 horas</strong> y te
                contactaremos al número que registraste.
              </div>
              <button className="submit-btn" style={{ marginTop: 24 }} onClick={() => { setPending(null); setTab("login"); }}>
                Volver al Inicio de Sesión
              </button>
            </div>
          )}

          {/* LOGIN */}
          {!pending && tab === "login" && (
            <div className="fade-in">
              <div className="auth-title">{LOGIN_TITLES[role][0]}</div>
              <div className="auth-subtitle">{LOGIN_TITLES[role][1]}</div>
              <div className="form-group">
                <label>Teléfono</label>
                <div className="input-with-icon">
                  <span className="input-icon">📱</span>
                  <input type="tel" placeholder="809-000-0000" value={f.loginPhone || ""} onChange={set("loginPhone")} onKeyDown={onLoginKey} />
                </div>
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <div className="input-with-icon">
                  <span className="input-icon">🔒</span>
                  <input type={show.login ? "text" : "password"} placeholder="Tu contraseña" value={f.loginPassword || ""} onChange={set("loginPassword")} onKeyDown={onLoginKey} />
                  <button className="toggle-password" onClick={() => toggle("login")}>{show.login ? "🙈" : "👁"}</button>
                </div>
              </div>
              <button className="submit-btn" onClick={handleLogin} disabled={loading}>
                {loading ? <Spinner /> : "Iniciar Sesión"}
              </button>
              <div className="terms">
                ¿No tienes cuenta? <a onClick={() => pickTab("register")}>Regístrate gratis</a>
              </div>
            </div>
          )}

          {/* REGISTER — CUSTOMER */}
          {!pending && tab === "register" && role === "CUSTOMER" && (
            <div className="fade-in">
              <div className="auth-title">Crea tu cuenta</div>
              <div className="auth-subtitle">Regístrate como cliente y empieza a comprar</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre</label>
                  <input type="text" placeholder="Juan" value={f.cName || ""} onChange={set("cName")} />
                </div>
                <div className="form-group">
                  <label>Apellido</label>
                  <input type="text" placeholder="Pérez" value={f.cLastname || ""} onChange={set("cLastname")} />
                </div>
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <div className="input-with-icon">
                  <span className="input-icon">📱</span>
                  <input type="tel" placeholder="809-000-0000" value={f.cPhone || ""} onChange={set("cPhone")} />
                </div>
              </div>
              <div className="form-group">
                <label>Correo electrónico <span style={{ color: "var(--text3)" }}>(opcional)</span></label>
                <div className="input-with-icon">
                  <span className="input-icon">✉️</span>
                  <input type="email" placeholder="juan@correo.com" value={f.cEmail || ""} onChange={set("cEmail")} />
                </div>
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <div className="input-with-icon">
                  <span className="input-icon">🔒</span>
                  <input type={show.c ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={f.cPassword || ""} onChange={set("cPassword")} />
                  <button className="toggle-password" onClick={() => toggle("c")}>{show.c ? "🙈" : "👁"}</button>
                </div>
                <div className="form-hint">Mínimo 6 caracteres</div>
              </div>
              <button className="submit-btn" onClick={handleRegisterCustomer} disabled={loading}>
                {loading ? <Spinner /> : "Crear Cuenta"}
              </button>
              <div className="terms">Al registrarte aceptas nuestros <a>Términos de Uso</a> y <a>Política de Privacidad</a></div>
            </div>
          )}

          {/* REGISTER — SELLER */}
          {!pending && tab === "register" && role === "SELLER" && (
            <div className="fade-in">
              <div className="auth-title">Abre tu tienda</div>
              <div className="auth-subtitle">Vende en TraemeLoo y llega a más clientes</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tu nombre</label>
                  <input type="text" placeholder="Juan Pérez" value={f.sName || ""} onChange={set("sName")} />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input type="tel" placeholder="809-000-0000" value={f.sPhone || ""} onChange={set("sPhone")} />
                </div>
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <div className="input-with-icon">
                  <span className="input-icon">🔒</span>
                  <input type={show.s ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={f.sPassword || ""} onChange={set("sPassword")} />
                  <button className="toggle-password" onClick={() => toggle("s")}>{show.s ? "🙈" : "👁"}</button>
                </div>
              </div>
              <div className="divider"><div className="divider-line" /><span className="divider-text">Datos de tu tienda</span><div className="divider-line" /></div>
              <div className="form-group">
                <label>Nombre de la tienda</label>
                <div className="input-with-icon">
                  <span className="input-icon">🏪</span>
                  <input type="text" placeholder="ej. TechZone Santiago" value={f.sShopName || ""} onChange={set("sShopName")} />
                </div>
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select value={f.sCategory || ""} onChange={set("sCategory")}>
                  <option value="">Selecciona una categoría</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Dirección de la tienda</label>
                <div className="input-with-icon">
                  <span className="input-icon">📍</span>
                  <input type="text" placeholder="C/ del Sol #42, Santiago" value={f.sAddress || ""} onChange={set("sAddress")} />
                </div>
              </div>
              <div className="form-group">
                <label>Descripción <span style={{ color: "var(--text3)" }}>(opcional)</span></label>
                <input type="text" placeholder="¿Qué vende tu tienda?" value={f.sDescription || ""} onChange={set("sDescription")} />
              </div>
              <button className="submit-btn" onClick={handleRegisterSeller} disabled={loading}>
                {loading ? <Spinner /> : "Enviar Solicitud"}
              </button>
              <div className="terms">Tu tienda será revisada por nuestro equipo en 24-48 horas.</div>
            </div>
          )}

          {/* REGISTER — DRIVER */}
          {!pending && tab === "register" && role === "DRIVER" && (
            <div className="fade-in">
              <div className="auth-title">Únete como motorista</div>
              <div className="auth-subtitle">Genera ingresos entregando en tu zona</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre completo</label>
                  <input type="text" placeholder="Carlos Díaz" value={f.dName || ""} onChange={set("dName")} />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input type="tel" placeholder="809-000-0000" value={f.dPhone || ""} onChange={set("dPhone")} />
                </div>
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <div className="input-with-icon">
                  <span className="input-icon">🔒</span>
                  <input type={show.d ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={f.dPassword || ""} onChange={set("dPassword")} />
                  <button className="toggle-password" onClick={() => toggle("d")}>{show.d ? "🙈" : "👁"}</button>
                </div>
              </div>
              <div className="divider"><div className="divider-line" /><span className="divider-text">Datos del vehículo</span><div className="divider-line" /></div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo de vehículo</label>
                  <select value={f.dVehicle || "moto"} onChange={set("dVehicle")}>
                    <option value="moto">🛵 Moto</option>
                    <option value="carro">🚗 Carro</option>
                    <option value="bicicleta">🚲 Bicicleta</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Placa</label>
                  <input type="text" placeholder="A123456" value={f.dPlate || ""} onChange={set("dPlate")} />
                </div>
              </div>
              <div className="form-group">
                <label>No. Licencia de conducir</label>
                <input type="text" placeholder="Número de licencia" value={f.dLicense || ""} onChange={set("dLicense")} />
              </div>
              <button className="submit-btn" onClick={handleRegisterDriver} disabled={loading}>
                {loading ? <Spinner /> : "Enviar Solicitud"}
              </button>
              <div className="terms">Tu solicitud será revisada por nuestro equipo. Te contactaremos al teléfono indicado.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

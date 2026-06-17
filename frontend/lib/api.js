// Central place for talking to the TraemeLoo backend.
// The base URL comes from .env.local (NEXT_PUBLIC_API_URL).

export const API = (process.env.NEXT_PUBLIC_API_URL || "") + "/api";

export async function getShops(category) {
  let url = API + "/shops";
  if (category && category !== "all") {
    url += "?category=" + encodeURIComponent(category);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudieron cargar las tiendas");
  return res.json();
}

export async function getShop(shopId) {
  const res = await fetch(API + "/shops/" + shopId);
  if (!res.ok) throw new Error("No se pudo cargar la tienda");
  return res.json();
}

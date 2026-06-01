import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3333);
const PLUGAR_API_TOKEN = "plugarme-test-token";
const CLIENT_ID = "amzn1.application-oa2-client.mock-plugarme";
const CLIENT_SECRET = "mock-client-secret";
const REFRESH_TOKEN = "Atzr|mock-refresh-token-plugarme";
const EXPIRED_TOKEN = "Atza|expired-token";
const MARKETPLACE_ID = "A2Q3Y263D00KWC";
const SELLER_ID = "A1PLUGARMESELLERBR";
const productsSeed = JSON.parse(readFileSync(join(__dirname, "data/products.json"), "utf8"));
const clone = v => JSON.parse(JSON.stringify(v));
let state;

function reset() {
  state = {
    products: clone(productsSeed),
    currentAccessToken: EXPIRED_TOKEN,
    tokenRefreshCount: 0,
    listings: {},
    submissions: [],
    failNextListing: false
  };
}
reset();

function reply(res, status, data, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(data, null, 2));
}
function rawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => data += c);
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
function plugarAuth(req, res) {
  if (req.headers.authorization !== `Bearer ${PLUGAR_API_TOKEN}`) {
    reply(res, 401, { error: "Unauthorized" }); return false;
  }
  return true;
}
function amazonAuth(req, res) {
  const token = req.headers["x-amz-access-token"];
  if (!token || token === EXPIRED_TOKEN || token !== state.currentAccessToken) {
    reply(res, 401, { errors: [{ code: "InvalidInput", message: "The access token is expired or invalid." }] });
    return false;
  }
  return true;
}
function extractOffer(payload) {
  const p = payload?.patches?.find(v => v.path === "/attributes/purchasable_offer");
  const q = payload?.patches?.find(v => v.path === "/attributes/fulfillment_availability");
  return {
    price: p?.value?.[0]?.our_price?.[0]?.schedule?.[0]?.value_with_tax,
    quantity: q?.value?.[0]?.quantity
  };
}

const app = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;
  const method = req.method || "GET";
  try {
    if (method === "GET" && path === "/health")
      return reply(res, 200, { ok: true, marketplaceId: MARKETPLACE_ID });

    if (method === "GET" && path === "/plugarme/v1/produtos") {
      if (!plugarAuth(req, res)) return;
      const clienteId = url.searchParams.get("cliente_id");
      const filialId = url.searchParams.get("filial_id");
      const data = state.products.filter(product => {
        if (clienteId && String(product.cliente_id) !== clienteId) return false;
        if (!filialId) return true;
        return [...(product.preco || []), ...(product.estoque || [])]
          .some(row => String(row.filial_id) === filialId);
      });
      return reply(res, 200, { data, meta: { total: data.length } });
    }

    if (method === "GET" && path === "/plugarme/v1/integracoes/amazon/credenciais") {
      if (!plugarAuth(req, res)) return;
      return reply(res, 200, { data: {
        cliente_id: 1, filial_id: 6, seller_id: SELLER_ID, marketplace_id: MARKETPLACE_ID,
        lwa_client_id: CLIENT_ID, lwa_client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN, access_token: EXPIRED_TOKEN,
        access_token_expires_at: "2026-05-29T12:00:00.000Z"
      }});
    }

    if (method === "POST" && path === "/amazon/auth/o2/token") {
      const form = new URLSearchParams(await rawBody(req));
      if (form.get("grant_type") !== "refresh_token" ||
          form.get("refresh_token") !== REFRESH_TOKEN ||
          form.get("client_id") !== CLIENT_ID ||
          form.get("client_secret") !== CLIENT_SECRET) {
        return reply(res, 400, { error: "invalid_grant" });
      }
      state.tokenRefreshCount += 1;
      state.currentAccessToken = `Atza|valid-refreshed-token-${state.tokenRefreshCount}`;
      return reply(res, 200, {
        access_token: state.currentAccessToken, token_type: "bearer",
        expires_in: 3600, refresh_token: REFRESH_TOKEN
      });
    }

    const listing = path.match(/^\/amazon\/listings\/2021-08-01\/items\/([^/]+)\/([^/]+)$/);
    if (method === "PATCH" && listing) {
      if (!amazonAuth(req, res)) return;
      if (state.failNextListing) {
        state.failNextListing = false;
        return reply(res, 429, { errors: [{ code: "QuotaExceeded", message: "Rate limit exceeded." }] },
          { "x-amzn-RateLimit-Limit": "5" });
      }
      const sellerId = decodeURIComponent(listing[1]);
      const sku = decodeURIComponent(listing[2]);
      if (sellerId !== SELLER_ID || url.searchParams.get("marketplaceIds") !== MARKETPLACE_ID)
        return reply(res, 422, { errors: [{ code: "InvalidSellerOrMarketplace" }] });
      const payload = JSON.parse((await rawBody(req)) || "{}");
      const offer = extractOffer(payload);
      if (!payload.productType || !Number.isFinite(Number(offer.price)) ||
          !Number.isInteger(offer.quantity) || offer.quantity < 0)
        return reply(res, 422, { errors: [{ code: "InvalidOffer" }] });
      const record = { sku, sellerId, marketplaceId: MARKETPLACE_ID, productType: payload.productType,
        price: Number(offer.price), quantity: offer.quantity, submittedAt: new Date().toISOString(), payload };
      state.listings[sku] = record;
      state.submissions.push(record);
      return reply(res, 202, { sku, status: "ACCEPTED", submissionId: `SUB-${state.submissions.length}`, issues: [] },
        { "x-amzn-RateLimit-Limit": "5" });
    }

    if (method === "POST" && path === "/admin/reset") { reset(); return reply(res, 200, { ok: true }); }
    if (method === "GET" && path === "/admin/state") return reply(res, 200, state);

    const prod = path.match(/^\/admin\/plugarme\/produtos\/([^/]+)$/);
    if (method === "PATCH" && prod) {
      const id = decodeURIComponent(prod[1]);
      const changes = JSON.parse((await rawBody(req)) || "{}");
      const product = state.products.find(p => String(p.id) === id || p.erp_id === id);
      if (!product) return reply(res, 404, { error: "ProductNotFound" });
      const now = new Date().toISOString();
      if (changes.preco !== undefined) {
        if (!product.preco.length) product.preco.push({ produto_id: product.id, filial_id: "6", erp_id: product.erp_id });
        product.preco[0].preco = Number(changes.preco);
        product.preco[0].updated_at = now;
      }
      if (changes.quantidade !== undefined) {
        product.estoque[0].quantidade = Number(changes.quantidade);
        product.estoque[0].updated_at = now;
      }
      product.updated_at = now;
      return reply(res, 200, { data: product });
    }

    if (method === "POST" && path === "/admin/expire-token") {
      state.currentAccessToken = EXPIRED_TOKEN;
      return reply(res, 200, { ok: true });
    }
    if (method === "POST" && path === "/admin/fail-next-listing") {
      state.failNextListing = true;
      return reply(res, 200, { ok: true });
    }
    return reply(res, 404, { error: "NotFound", method, path });
  } catch (e) {
    return reply(res, 400, { error: "BadRequest", message: e.message });
  }
});
app.listen(PORT, () => console.log(`Mock disponível em http://localhost:${PORT}`));

/**
 * Costco stock-check proxy.
 *
 * A browser can't fully replicate the original curl request -- JS is not
 * allowed to set Origin, Referer, or User-Agent (the browser controls those
 * unconditionally), and Costco's API likely checks them server-side. This
 * Worker makes the real request server-side (where those headers ARE
 * controllable) and hands the JSON back to the static page with permissive
 * CORS headers so the browser is allowed to read the response.
 *
 * Deploy: Cloudflare dashboard -> Workers & Pages -> Create -> paste this in
 * the online editor -> Deploy. Free tier covers this easily (100k req/day).
 */

const ALLOWED_ORIGIN = "*"; // tighten to "https://<you>.github.io" once deployed, if you want

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const itemId = url.searchParams.get("itemId");
    const warehouse = url.searchParams.get("warehouse");
    const quantity = url.searchParams.get("quantity") || "1";
    const shippingCodes = url.searchParams.get("shippingCodes") || "UP2";
    const action = url.searchParams.get("action") || "EDD";

    if (!itemId || !warehouse) {
      return jsonResponse({ error: "itemId and warehouse query params are required" }, 400);
    }

    const costcoUrl =
      `https://ecom-api.costco.com/ebusiness/inventory/v1/inventorylevels/availability/pickup/` +
      `${encodeURIComponent(itemId)}?quantity=${encodeURIComponent(quantity)}` +
      `&selectedWarehouse=${encodeURIComponent(warehouse)}` +
      `&shippingCodes=${encodeURIComponent(shippingCodes)}` +
      `&action=${encodeURIComponent(action)}`;

    let costcoResp;
    try {
      costcoResp = await fetch(costcoUrl, {
        headers: {
          "accept": "*/*",
          "accept-language": "en-US,en;q=0.8",
          "client-identifier": "481b1aec-aa3b-454b-b81b-48187e28f205",
          "origin": "https://www.costco.com",
          "referer": "https://www.costco.com/",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        },
      });
    } catch (err) {
      return jsonResponse({ error: `upstream fetch failed: ${err}` }, 502);
    }

    const bodyText = await costcoResp.text();
    return new Response(bodyText, {
      status: costcoResp.status,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

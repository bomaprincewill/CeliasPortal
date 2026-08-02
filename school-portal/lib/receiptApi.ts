export type ReceiptPayload = Record<string, unknown>;

async function request(method: string, body?: ReceiptPayload, query = "") {
  const response = await fetch(`/api/finance/receipts${query}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Receipt request failed");
  return result;
}

export const receiptApi = {
  list: (search = "") => request("GET", undefined, search ? `?search=${encodeURIComponent(search)}` : ""),
  create: (payload: ReceiptPayload) => request("POST", payload),
  update: (id: number, payload: ReceiptPayload) => request("PATCH", { ...payload, id }),
  remove: (id: number) => request("DELETE", { id }),
};

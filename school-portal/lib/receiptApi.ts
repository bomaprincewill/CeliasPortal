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

async function listPage(search = "", cursor?: number) {
  const query = new URLSearchParams({ search });
  if (cursor) query.set("cursor", String(cursor));
  return request("GET", undefined, `?${query}`);
}

export const receiptApi = {
  listPage,
  // Aggregate screens need every record: fetch bounded pages, never silently truncate balances.
  list: async (search = "") => {
    const items = [];
    let cursor: number | undefined;
    do {
      const page = await listPage(search, cursor);
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items;
  },
  create: (payload: ReceiptPayload) => request("POST", payload),
  update: (id: number, payload: ReceiptPayload) => request("PATCH", { ...payload, id }),
  remove: (id: number) => request("DELETE", { id }),
};

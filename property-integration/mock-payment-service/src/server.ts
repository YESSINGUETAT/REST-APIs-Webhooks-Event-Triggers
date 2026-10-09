import express from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());
// Environment variables configured in docker-compose.yml
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY || "test_api_key_12345";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "whsec_mock_secret_abcdef";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://next-app:3000/api/webhooks/payments";

// In-memory invoice store (simulates a database)
const invoices: Map<string, { id: string; amount: number; status: string; lease_id: string; tenant_email: string; created_at: string }> = new Map();
// Middleware: verify API key from Authorization header
function authenticateRequest(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header. Expected: Bearer <API_KEY>" });
    return;
  }
  const token = authHeader.split(" ")[1];
  if (token !== API_KEY) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }
  next();
}
// Helper: compute HMAC-SHA256 signature
function computeSignature(payload: string): string {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
}

// Helper: send webhook with signature
async function sendWebhook(eventType: string, data: object): Promise<void> {
  const event = {
    id: `evt_${uuidv4()}`,
    type: eventType,
    created_at: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(event);
  const signature = computeSignature(body);
  console.log(`[Webhook] Sending ${eventType} to ${WEBHOOK_URL}`);
  console.log(`[Webhook] Signature: ${signature}`);
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event-Id": event.id,
      },
      body,
    });
    console.log(`[Webhook] Response status: ${response.status}`);
  } catch (error) {
    console.error(`[Webhook] Failed to deliver:`, error);
  }
}
// POST /api/invoices - Create a new invoice
app.post("/api/invoices", authenticateRequest, (req, res) => {
  const { amount, lease_id, tenant_email, simulate_error } = req.body;

  // Simulate external service being down
  if (simulate_error) {
    res.status(503).json({ error: "Service temporarily unavailable. Please retry later." });
    return;
  }

  // Validate required fields
  if (!amount || !lease_id || !tenant_email) {
    res.status(400).json({
      error: "Missing required fields",
      required: ["amount", "lease_id", "tenant_email"],
    });
    return;
  }

  // Create the invoice
  const invoice = {
    id: `inv_${uuidv4()}`,
    amount,
    status: "pending",
    lease_id,
    tenant_email,
    created_at: new Date().toISOString(),
  };

  invoices.set(invoice.id, invoice);
   console.log(`[API] Created invoice ${invoice.id} for $${amount / 100}`);

  // Simulate payment processing (5 second delay, then send webhook)
  setTimeout(async () => {
    invoice.status = "paid";
    invoices.set(invoice.id, invoice);
    console.log(`[Payment] Invoice ${invoice.id} marked as paid`);
    await sendWebhook("invoice.paid", {
      invoice_id: invoice.id,
      lease_id: invoice.lease_id,
      amount: invoice.amount,
      status: "paid",
      paid_at: new Date().toISOString(),
    });
  }, 5000);
  // Return immediately (don't wait for payment)
  res.status(201).json({
    id: invoice.id,
    amount: invoice.amount,
    status: invoice.status,
    lease_id: invoice.lease_id,
    tenant_email: invoice.tenant_email,
    created_at: invoice.created_at,
  });
});
// GET /api/invoices/:id - Retrieve invoice status
app.get("/api/invoices/:id", authenticateRequest, (req, res) => {
  const invoiceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const invoice = invoices.get(invoiceId);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(invoice);
});

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "mock-payment-service" });
});

app.listen(PORT, () => {
  console.log(`Mock Payment Service running on port ${PORT}`);
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
});


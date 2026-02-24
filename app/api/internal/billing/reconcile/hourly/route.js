import { createBillingReconcileCronGetHandler } from "../_shared.js";

export const runtime = "nodejs";
export const GET = createBillingReconcileCronGetHandler("problem");

const crypto = require("crypto");

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const initializeTransaction = async ({
  email,
  amountNaira,
  reference,
  callbackUrl,
  metadata,
}) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amountNaira * 100), // Paystack expects amount in Kobo
      reference,
      callback_url: callbackUrl,
      metadata,
    }),
  });

  const result = await response.json();
  if (!result.status) {
    throw new Error(result.message || "Paystack initialization failed");
  }
  return result.data; // Contains authorization_url, access_code, reference
};

const verifyTransaction = async (reference) => {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    },
  );

  const result = await response.json();
  if (!result.status) {
    throw new Error(result.message || "Paystack verification failed");
  }
  return result.data;
};

const verifyWebhookSignature = (rawBody, signature) => {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(rawBody))
    .digest("hex");
  return hash === signature;
};

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
};

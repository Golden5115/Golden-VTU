export async function initializePayment(email: string, amount: number) {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amount * 100, // Paystack expects amount in kobo/lowest denomination
      callback_url: `${process.env.NEXTAUTH_URL}/dashboard`,
    }),
  });
  
  const data = await response.json();
  if (!data.status) {
    throw new Error(data.message);
  }
  
  return data.data as {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export async function verifyPayment(reference: string) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(data.message);
  }

  return data.data; // Includes status, amount, metadata etc
}

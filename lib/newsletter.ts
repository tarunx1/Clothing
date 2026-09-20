export type NewsletterSubmission = (email: string) => Promise<void>;

export const submitNewsletter: NewsletterSubmission = async (email) => {
  const response = await fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
  if (!response.ok) throw new Error("Unable to subscribe right now. Please try again later.");
};

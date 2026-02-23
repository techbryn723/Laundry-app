import { createClient } from "@libsql/client";

export default async function handler(req, res) {
  const client = createClient({
    url: process.env.VITE_TURSO_DATABASE_URL,
    authToken: process.env.VITE_TURSO_AUTH_TOKEN,
  });

  if (req.method === 'GET') {
    const result = await client.execute("SELECT * FROM users");
    return res.status(200).json(result.rows);
  }
}
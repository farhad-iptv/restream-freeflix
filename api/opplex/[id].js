export default async function handler(req, res) {
  try {
    const r = await fetch("http://opplex.to:8080", {
      method: "GET",
    });

    return res.status(200).send("OK " + r.status);
  } catch (e) {
    return res.status(500).send("FAILED: " + e.message);
  }
}

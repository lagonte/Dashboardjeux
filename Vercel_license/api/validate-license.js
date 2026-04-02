export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      valid: false,
      error: "Method not allowed"
    });
  }

  try {
    const { licenseKey } = req.body || {};

    if (!licenseKey) {
      return res.status(400).json({
        valid: false,
        error: "licenseKey manquante"
      });
    }

    const raw = process.env.LICENSES;

    if (!raw) {
      return res.status(500).json({
        valid: false,
        error: "LICENSES non définie"
      });
    }

    let licenses;
    try {
      licenses = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({
        valid: false,
        error: "LICENSES invalide"
      });
    }

    const match = licenses.find(
      (l) => l.key === licenseKey && l.active === true
    );

    if (!match) {
      return res.status(403).json({
        valid: false,
        error: "Licence invalide ou inactive"
      });
    }

    return res.status(200).json({
      valid: true,
      client: match.client,
      key: match.key
    });

  } catch (err) {
    return res.status(500).json({
      valid: false,
      error: err.message
    });
  }
}

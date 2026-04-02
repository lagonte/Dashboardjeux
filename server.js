const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const axios = require("axios");
const os = require("os");
const ROOT = __dirname;
const LOGS_PATH = path.resolve(ROOT, "./logs.json");
const RUNTIME_DIR = path.resolve(ROOT, "./runtime");

const app = express();


const CONFIG_PATH = path.join(ROOT, "app-config.json");
const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

const PORT = fileConfig.server?.port || 3000;
const CONTACTS_PATH = path.resolve(ROOT, fileConfig.contactsJsonPath || "./contacts.json");
const LICENSE_STORE_PATH = path.resolve(ROOT, fileConfig.licenseStorePath || "./license-store.json");
const LICENSE_VALIDATION_URL = fileConfig.license?.validationUrl || "";
const LICENSE_GRACE_HOURS = Number(fileConfig.license?.gracePeriodHours || 168);



const CONFIG = {
  companionUrl: fileConfig.companion?.baseUrl || "http://127.0.0.1:8000",
  studios: [
    {
      id: "ST1",
      label: "1",
      gameName: "Le premier qui rit sort",
      recVar: "REC_ST1",
      launchButton: { page: 2, row: 0, column: 0 },
      contactVariables: {
        name: "contact_ST1_name",
        phone: "contact_ST1_phone",
        email: "contact_ST1_email"
      }
    },
    {
      id: "ST2",
      label: "2",
      gameName: "Patisserie Arrosée",
      recVar: "REC_ST2",
      launchButton: { page: 2, row: 0, column: 2 },
      contactVariables: {
        name: "contact_ST2_name",
        phone: "contact_ST2_phone",
        email: "contact_ST2_email"
      }
    },
    
    {
      id: "ST3",
      label: "3",
      gameName: "Meilleur Bluffeur",
      recVar: "REC_ST3",
      launchButton: { page: 2, row: 0, column: 4 },
      contactVariables: {
        name: "contact_ST3_name",
        phone: "contact_ST3_phone",
        email: "contact_ST3_email"
      }
    },
    {
      id: "ST4",
      label: "4",
      gameName: "Alibi 1",
      recVar: "REC_ST4",
      launchButton: { page: 2, row: 0, column: 6 },
      contactVariables: {
        name: "contact_ST4_name",
        phone: "contact_ST4_phone",
        email: "contact_ST4_email"
      }
    },
    {
      id: "ST4B",
      label: "4b",
      gameName: "Alibi 2",
      recVar: "REC_ST4b",
      launchButton: { page: 2, row: 0, column: 8 },
      contactVariables: {
        name: "contact_ST4B_name",
        phone: "contact_ST4B_phone",
        email: "contact_ST4B_email"
      }
    }
  ]
};

app.use(express.json());
app.use(express.static(path.join(ROOT, "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

/* -------------------- Utils -------------------- */

function getStudioById(id) {
  return CONFIG.studios.find((s) => s.id === id);
}

function nowIso() {
  return new Date().toISOString();
}


function normalizePhone(phone, countryCode = "+33") {
    let p = String(phone || "").replace(/[^\d+]/g, "").trim();
  
    if (!p) return "";
  
    if (p.startsWith("+")) return p;
    if (p.startsWith("00")) return "+" + p.slice(2);
    if (p.startsWith("0")) return countryCode + p.slice(1);
  
    return countryCode + p;
}
  
function validatePhone(phone, countryCode = "+33") {
    const normalized = normalizePhone(phone, countryCode);
    return /^\+\d{8,15}$/.test(normalized);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}



async function ensureJsonFile(filePath, fallbackData) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(filePath, JSON.stringify(fallbackData, null, 2), "utf8");
  }
}

function defaultContacts() {
  const result = {};
  for (const studio of CONFIG.studios) {
    result[studio.id] = {
      name: "",
      phone: "",
      email: "",
      saved_at: "",
      used: true
    };
  }
  return result;
}

async function readContacts() {
  await ensureJsonFile(CONTACTS_PATH, defaultContacts());
  const raw = await fsp.readFile(CONTACTS_PATH, "utf8");
  return { ...defaultContacts(), ...JSON.parse(raw || "{}") };
}

async function writeContacts(data) {
  await fsp.writeFile(CONTACTS_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function readLicenseStore() {
  const fallback = {
    licenseKey: "",
    activatedAt: "",
    lastValidatedAt: "",
    lastValidationStatus: "unknown"
  };
  await ensureJsonFile(LICENSE_STORE_PATH, fallback);
  const raw = await fsp.readFile(LICENSE_STORE_PATH, "utf8");
  return { ...fallback, ...JSON.parse(raw || "{}") };
}

async function writeLicenseStore(data) {
  await fsp.writeFile(LICENSE_STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function isWithinGracePeriod(lastValidatedAt) {
  if (!lastValidatedAt) return false;
  const last = new Date(lastValidatedAt).getTime();
  if (Number.isNaN(last)) return false;
  const elapsedHours = (Date.now() - last) / 1000 / 60 / 60;
  return elapsedHours <= LICENSE_GRACE_HOURS;
}

async function companionGetCustomVariable(name) {
    const res = await axios.get(
      `${CONFIG.companionUrl}/api/custom-variable/${encodeURIComponent(name)}/value`
    );
    return String(res.data?.value ?? res.data ?? "").trim();
  }

async function companionSetCustomVariable(name, value) {
    await axios.post(
      `${CONFIG.companionUrl}/api/custom-variable/${encodeURIComponent(name)}/value?value=${encodeURIComponent(String(value ?? ""))}`
    );
}

async function companionPressButton(page, row, column) {
    await axios.post(`${CONFIG.companionUrl}/api/location/${page}/${row}/${column}/press`);
}

async function getStudioRuntimeState(studio, contact) {
    let recValue = null;
  
    try {
      recValue = await companionGetCustomVariable(studio.recVar);
      console.log("REC READ", studio.id, studio.recVar, recValue);
    } catch (e) {
      console.error("Companion read error:", studio.recVar, e.message);
    }
  
    const isBusy = recValue === "1";
  
    return {
      id: studio.id,
      label: studio.label,
      gameName: studio.gameName,
      status: isBusy ? "busy" : "free",
      recValue,
      contact: {
        name: contact?.name || "",
        phone: contact?.phone || "",
        email: contact?.email || "",
        saved_at: contact?.saved_at || "",
        used: contact?.used ?? true
      }
    };
  }

  function generateSessionId(studioId) {
    const now = new Date();
    const pad = (n, l = 2) => String(n).padStart(l, "0");
  
    return [
      studioId,
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      "_",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
      "_",
      pad(now.getMilliseconds(), 3)
    ].join("");
  }
/* -------------------- Licence -------------------- */

async function validateLicenseWithCloud(licenseKey) {
  if (!LICENSE_VALIDATION_URL) {
    throw new Error("validationUrl manquante dans app-config.json");
  }

  const res = await axios.post(
    LICENSE_VALIDATION_URL,
    {
      licenseKey,
      app: "studio-control-local",
      hostname: os.hostname()
    },
    {
      headers: { "Content-Type": "application/json" }
    }
  );

  return res.data;
}

async function getLicenseStatus() {
  const store = await readLicenseStore();

  if (!store.licenseKey) {
    return {
      activated: false,
      valid: false,
      requiresActivation: true,
      graceActive: false
    };
  }

  try {
    const result = await validateLicenseWithCloud(store.licenseKey);

    const newStore = {
      ...store,
      lastValidatedAt: nowIso(),
      lastValidationStatus: result.valid ? "valid" : "invalid"
    };
    await writeLicenseStore(newStore);

    return {
      activated: true,
      valid: Boolean(result.valid),
      requiresActivation: false,
      graceActive: false,
      licenseMeta: result
    };
  } catch (error) {
    const grace = isWithinGracePeriod(store.lastValidatedAt);
    return {
      activated: true,
      valid: grace,
      requiresActivation: false,
      graceActive: grace,
      offlineReason: error.message
    };
  }
}

async function requireLicense(req, res, next) {
  try {
    const status = await getLicenseStatus();
    if (!status.valid) {
      return res.status(403).json({
        error: "Licence invalide ou non activée",
        license: status
      });
    }
    req.licenseStatus = status;
    next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function appendLog(entry) {
  try {
    await fsp.access(LOGS_PATH, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(LOGS_PATH, "", "utf8");
  }

  await fsp.appendFile(LOGS_PATH, JSON.stringify(entry) + "\n", "utf8");
}

async function writeCurrentStudioSession(studioId, payload) {
  await fsp.mkdir(RUNTIME_DIR, { recursive: true });
  const filePath = path.join(RUNTIME_DIR, `${studioId}-current-session.json`);
  await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

/* -------------------- API -------------------- */


app.get("/api/license/status", async (_req, res) => {
  try {
    const status = await getLicenseStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/license/activate", async (req, res) => {
  try {
    const licenseKey = String(req.body.licenseKey || "").trim();
    if (!licenseKey) {
      return res.status(400).json({ error: "Clé licence requise" });
    }

    const result = await validateLicenseWithCloud(licenseKey);
    if (!result.valid) {
      return res.status(403).json({ error: "Licence invalide" });
    }

    await writeLicenseStore({
      licenseKey,
      activatedAt: nowIso(),
      lastValidatedAt: nowIso(),
      lastValidationStatus: "valid"
    });

    res.json({ ok: true, valid: true, licenseMeta: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/config", requireLicense, async (_req, res) => {
  res.json({
    studios: CONFIG.studios.map((s) => ({
      id: s.id,
      label: s.label,
      gameName: s.gameName
    }))
  });
});

app.get("/api/studios", requireLicense, async (_req, res) => {
  try {
    const contacts = await readContacts();
    const studios = [];

    for (const studio of CONFIG.studios) {
      studios.push(await getStudioRuntimeState(studio, contacts[studio.id]));
    }

    res.json({ studios });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/studios/:id/launch", requireLicense, async (req, res) => {
    try {
      const studio = getStudioById(req.params.id);
      if (!studio) {
        return res.status(404).json({ error: "Studio introuvable" });
      }
  
      const name = String(req.body.name || "").trim();
      const rawPhone = String(req.body.phone || "").trim();
      const countryCode = String(req.body.countryCode || "+33").trim();
      const phone = normalizePhone(rawPhone, countryCode);
      const email = String(req.body.email || "").trim().toLowerCase();
      const sessionId = generateSessionId(studio.id);
  
      if (!name || !rawPhone || !email) {
        return res.status(400).json({ error: "Nom, téléphone et email requis" });
      }
      if (!validatePhone(rawPhone, countryCode)) {
        return res.status(400).json({ error: "Téléphone invalide" });
      }
      if (!validateEmail(email)) {
        return res.status(400).json({ error: "Email invalide" });
      }
  
      const contacts = await readContacts();
      const currentState = await getStudioRuntimeState(studio, contacts[studio.id]);
  
      if (currentState.status === "busy") {
        return res.status(409).json({ error: "Studio déjà indisponible" });
      }
  
      const createdAt = nowIso();
  
      const contact = {
        name,
        phone,
        email,
        saved_at: createdAt,
        used: false,
        sessionId
      };
  
      contacts[studio.id] = contact;
      await writeContacts(contacts);
  
      await appendLog({
        studioId: studio.id,
        sessionId,
        name,
        phone,
        email,
        createdAt
      });
  
      await writeCurrentStudioSession(studio.id, {
        studioId: studio.id,
        sessionId,
        name,
        phone,
        email,
        createdAt
      });
  
      await companionSetCustomVariable(studio.contactVariables.name, name);
      await companionSetCustomVariable(studio.contactVariables.phone, phone);
      await companionSetCustomVariable(studio.contactVariables.email, email);
  
      await companionPressButton(
        studio.launchButton.page,
        studio.launchButton.row,
        studio.launchButton.column
      );
  
      res.json({ ok: true, sessionId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

app.post("/api/studios/:id/reset", requireLicense, async (req, res) => {
  try {
    const studio = getStudioById(req.params.id);
    if (!studio) {
      return res.status(404).json({ error: "Studio introuvable" });
    }
  try {
    await fsp.unlink(path.join(RUNTIME_DIR, `${studio.id}-current-session.json`));
  } catch {}

    const contacts = await readContacts();
    await writeContacts(contacts);

    await companionSetCustomVariable(studio.contactVariables.name, "");
    await companionSetCustomVariable(studio.contactVariables.phone, "");
    await companionSetCustomVariable(studio.contactVariables.email, "");

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* -------------------- Start -------------------- */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Studio Control local: http://0.0.0.0:${PORT}`);
});
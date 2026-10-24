const SPREADSHEET_ID = "1QKofdxJ-gq2jkQRnk6ZeqCzByzoirQ8j0xQ1brW6EQ8";
const SHEET_GID = 0;

const FIELDS = [
  {
    key: "tanggal",
    label: "Tanggal",
    aliases: ["tanggal", "timestamp", "waktu", "waktu kirim"],
  },
  {
    key: "nama",
    label: "Nama",
    aliases: ["nama", "nama lengkap"],
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    aliases: ["whatsapp", "nomor whatsapp", "no whatsapp", "nomor wa", "no wa"],
  },
  {
    key: "doa",
    label: "Doa / Hajat",
    aliases: [
      "doa",
      "isi doa",
      "doa hajat",
      "doa hajat yang ingin dititipkan",
    ],
  },
  {
    key: "untuk",
    label: "Untuk Siapa",
    aliases: ["untuk", "untuk siapa", "untuk siapa doa tersebut"],
  },
  {
    key: "kategori",
    label: "Kategori",
    aliases: ["kategori", "kategori doa"],
  },
  {
    key: "persetujuan",
    label: "Persetujuan",
    aliases: ["persetujuan", "persetujuan titip doa"],
  },
];

const ALLOWED_CATEGORIES = [
  "Doa untuk Orang Tua",
  "Doa untuk Orang Tersayang",
  "Doa Jodoh",
  "Doa Rezeki & Pekerjaan",
  "Doa Keturunan",
  "Doa Ketenangan Hati",
  "Lainnya",
];

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    const params = e && e.parameter ? e.parameter : {};
    const expectedToken = PropertiesService
      .getScriptProperties()
      .getProperty("GOOGLE_SCRIPT_TOKEN");

    if (!expectedToken || params.token !== expectedToken) {
      return jsonResponse_(false, "Token tidak valid.");
    }

    const record = validateRecord_(params);
    lock.waitLock(10000);

    try {
      const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = spreadsheet.getSheetById(SHEET_GID);

      if (!sheet) {
        throw new Error("Tab dengan gid 0 tidak ditemukan.");
      }

      let lastColumn = sheet.getLastColumn();

      if (lastColumn === 0) {
        sheet.getRange(1, 1, 1, FIELDS.length).setValues([
          FIELDS.map((field) => field.label),
        ]);
        lastColumn = FIELDS.length;
      }

      const headers = sheet
        .getRange(1, 1, 1, lastColumn)
        .getDisplayValues()[0];
      const columnByField = mapColumns_(headers);
      const nextRow = sheet.getLastRow() + 1;
      const values = Array(lastColumn).fill("");

      values[columnByField.tanggal] = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyy-MM-dd HH:mm:ss"
      );
      values[columnByField.nama] = record.nama;
      values[columnByField.whatsapp] = record.whatsapp;
      values[columnByField.doa] = record.doa;
      values[columnByField.untuk] = record.untuk;
      values[columnByField.kategori] = record.kategori;
      values[columnByField.persetujuan] = "Ya";

      const rowRange = sheet.getRange(nextRow, 1, 1, lastColumn);
      rowRange.setNumberFormat("@");
      rowRange.setValues([values.map(asPlainText_)]);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_(true, "Doa berhasil disimpan.");
  } catch (error) {
    Logger.log("Gagal menyimpan titipan doa: " + error);
    return jsonResponse_(false, "Doa gagal disimpan. Periksa konfigurasi sheet.");
  }
}

function validateRecord_(params) {
  const record = {
    nama: String(params.nama || "").trim(),
    whatsapp: String(params.whatsapp || "").trim(),
    doa: String(params.doa || "").trim(),
    untuk: String(params.untuk || "").trim(),
    kategori: String(params.kategori || "").trim(),
  };

  if (
    !record.nama ||
    !record.whatsapp ||
    !record.doa ||
    !record.untuk ||
    !record.kategori ||
    params.persetujuan !== "true"
  ) {
    throw new Error("Data formulir belum lengkap.");
  }

  if (
    record.nama.length > 120 ||
    record.whatsapp.length > 25 ||
    record.doa.length > 5000 ||
    record.untuk.length > 150
  ) {
    throw new Error("Ada isian yang terlalu panjang.");
  }

  if (!/^\+?[0-9\s()-]{8,25}$/.test(record.whatsapp)) {
    throw new Error("Nomor WhatsApp tidak valid.");
  }

  if (!ALLOWED_CATEGORIES.includes(record.kategori)) {
    throw new Error("Kategori doa tidak valid.");
  }

  return record;
}

function mapColumns_(headers) {
  const normalizedHeaders = headers.map(normalizeHeader_);
  const columnByField = {};
  const missingFields = [];

  FIELDS.forEach((field) => {
    const aliases = field.aliases.map(normalizeHeader_);
    const index = normalizedHeaders.findIndex((header) =>
      aliases.includes(header)
    );

    if (index === -1) {
      missingFields.push(field.label);
    } else {
      columnByField[field.key] = index;
    }
  });

  if (missingFields.length > 0) {
    throw new Error(
      "Header sheet belum cocok. Kolom yang diperlukan: " +
        missingFields.join(", ")
    );
  }

  return columnByField;
}

function normalizeHeader_(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asPlainText_(value) {
  const text = String(value);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function jsonResponse_(success, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: success, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
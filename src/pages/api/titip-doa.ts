
import type { APIRoute } from "astro";

// API ini dijalankan di server, bukan di browser
export const prerender = false;

// =====================================
// KATEGORI DOA YANG DIIZINKAN
// =====================================

const allowedCategories = [
  "Doa untuk Orang Tua",
  "Doa untuk Orang Tersayang",
  "Doa Jodoh",
  "Doa Rezeki & Pekerjaan",
  "Doa Keturunan",
  "Doa Ketenangan Hati",
  "Lainnya",
];

// =====================================
// HELPER RESPONSE JSON
// =====================================

function jsonResponse(
  data: {
    success: boolean;
    message: string;
  },
  status = 200
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// =====================================
// API POST TITIP DOA
// =====================================

export const POST: APIRoute = async ({ request }) => {
  try {
    // =====================================
    // BACA KONFIGURASI DARI FILE .env
    // =====================================
    const scriptUrl = String(
  import.meta.env.GOOGLE_SCRIPT_URL ??
  process.env.GOOGLE_SCRIPT_URL ??
  ""
).trim();

const secretToken = String(
  import.meta.env.GOOGLE_SCRIPT_TOKEN ??
  process.env.GOOGLE_SCRIPT_TOKEN ??
  ""
).trim();

console.log("CEK ASTRO URL:", Boolean(import.meta.env.GOOGLE_SCRIPT_URL));
console.log("CEK ASTRO TOKEN:", Boolean(import.meta.env.GOOGLE_SCRIPT_TOKEN));
console.log("CEK SERVER URL:", Boolean(process.env.GOOGLE_SCRIPT_URL));
console.log("CEK SERVER TOKEN:", Boolean(process.env.GOOGLE_SCRIPT_TOKEN));


    if (!scriptUrl || !secretToken) {
      console.error(
        "Konfigurasi Google Apps Script belum lengkap."
      );

      return jsonResponse(
        {
          success: false,
          message:
            "Konfigurasi server belum lengkap.",
        },
        500
      );
    }

    // =====================================
    // BACA DATA FORM
    // =====================================

    let body: Record<string, unknown>;

    try {
      body = await request.json();

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return jsonResponse(
          {
            success: false,
            message: "Format data tidak valid.",
          },
          400
        );
      }
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Format JSON tidak valid.",
        },
        400
      );
    }

    const nama = String(body.nama ?? "").trim();

    const whatsapp = String(
      body.whatsapp ?? ""
    ).trim();

    const doa = String(body.doa ?? "").trim();

    const untuk = String(
      body.untuk ?? ""
    ).trim();

    const kategori = String(
      body.kategori ?? ""
    ).trim();

    const persetujuan =
      body.persetujuan === true;

    // =====================================
    // VALIDASI KOLOM WAJIB
    // =====================================

    if (
      !nama ||
      !whatsapp ||
      !doa ||
      !untuk ||
      !kategori ||
      !persetujuan
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Mohon lengkapi semua kolom formulir.",
        },
        400
      );
    }

    // =====================================
    // VALIDASI PANJANG INPUT
    // =====================================

    if (
      nama.length > 120 ||
      whatsapp.length > 25 ||
      doa.length > 5000 ||
      untuk.length > 150
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Ada isian yang terlalu panjang.",
        },
        400
      );
    }

    // =====================================
    // VALIDASI NOMOR WHATSAPP
    // =====================================

    const whatsappRegex =
      /^\+?[0-9\s()-]{8,25}$/;

    if (!whatsappRegex.test(whatsapp)) {
      return jsonResponse(
        {
          success: false,
          message:
            "Nomor WhatsApp tidak valid.",
        },
        400
      );
    }

    // =====================================
    // VALIDASI KATEGORI DOA
    // =====================================

    if (!allowedCategories.includes(kategori)) {
      return jsonResponse(
        {
          success: false,
          message:
            "Kategori doa tidak valid.",
        },
        400
      );
    }

    // =====================================
    // SIAPKAN DATA GOOGLE APPS SCRIPT
    // =====================================

    const params = new URLSearchParams({
      token: secretToken,
      nama: nama,
      whatsapp: whatsapp,
      doa: doa,
      untuk: untuk,
      kategori: kategori,
      persetujuan: "true",
    });

    // =====================================
    // KIRIM DATA KE GOOGLE APPS SCRIPT
    // =====================================

    console.log(
      "Mengirim data doa ke Google Apps Script..."
    );

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params.toString(),
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });

    // =====================================
    // CEK RESPONSE GOOGLE APPS SCRIPT
    // =====================================

    if (!response.ok) {
      console.error(
        "HTTP Google Apps Script:",
        response.status
      );

      return jsonResponse(
        {
          success: false,
          message:
            "Google Apps Script tidak dapat menerima permintaan.",
        },
        502
      );
    }

    let result: {
      success?: boolean;
      message?: string;
    };

    try {
      result = await response.json();
    } catch {
      console.error(
        "Google Apps Script tidak mengembalikan JSON."
      );

      return jsonResponse(
        {
          success: false,
          message:
            "Respons Google Apps Script tidak valid.",
        },
        502
      );
    }

    // =====================================
    // JIKA GOOGLE APPS SCRIPT MENOLAK
    // =====================================

    if (result.success !== true) {
      console.error(
        "Google Apps Script menolak data:",
        result.message
      );

      return jsonResponse(
        {
          success: false,
          message:
            "Doa belum berhasil disimpan. Silakan coba lagi.",
        },
        502
      );
    }

    // =====================================
    // BERHASIL DISIMPAN DI GOOGLE SHEETS
    // =====================================

    console.log(
      "Google Apps Script mengonfirmasi doa berhasil disimpan."
    );

    return jsonResponse({
      success: true,
      message:
        "Alhamdulillah, doa berhasil dikirim!",
    });

  } catch (error) {
    // =====================================
    // PENANGANAN ERROR
    // =====================================

    console.error(
      "API Titip Doa error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        message:
          "Terjadi gangguan saat mengirim doa. Periksa Google Sheets sebelum mencoba lagi.",
      },
      500
    );
  }
};


import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// API ini dijalankan di server
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
    // BACA ENV CLOUDFLARE - ASTRO V6
    // =====================================

    const scriptUrl = String(
      env.GOOGLE_SCRIPT_URL ?? ""
    ).trim();

    const secretToken = String(
      env.GOOGLE_SCRIPT_TOKEN ?? ""
    ).trim();

    // =====================================
    // DEBUG KONFIGURASI (TANPA BOCORKAN TOKEN)
    // =====================================

    console.log("DEBUG KONFIGURASI:", {
      scriptUrlAda: Boolean(scriptUrl),
      secretTokenAda: Boolean(secretToken),
    });

    if (!scriptUrl || !secretToken) {
      console.error(
        "Konfigurasi Google Apps Script belum lengkap.",
        {
          scriptUrlAda: Boolean(scriptUrl),
          secretTokenAda: Boolean(secretToken),
        }
      );

      return jsonResponse(
        {
          success: false,
          message: "Konfigurasi server belum lengkap.",
        },
        500
      );
    }

    // =====================================
    // VALIDASI URL GOOGLE APPS SCRIPT
    // =====================================

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(scriptUrl);
    } catch {
      console.error("GOOGLE_SCRIPT_URL tidak valid.");

      return jsonResponse(
        {
          success: false,
          message: "Konfigurasi URL server tidak valid.",
        },
        500
      );
    }

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "script.google.com" ||
      !parsedUrl.pathname.endsWith("/exec")
    ) {
      console.error(
        "GOOGLE_SCRIPT_URL bukan URL Web App Google Apps Script."
      );

      return jsonResponse(
        {
          success: false,
          message: "Konfigurasi Google Apps Script tidak valid.",
        },
        500
      );
    }

    // =====================================
    // BACA DATA FORM
    // =====================================

    let body: Record<string, unknown>;

    try {
      const parsedBody: unknown = await request.json();

      if (
        !parsedBody ||
        typeof parsedBody !== "object" ||
        Array.isArray(parsedBody)
      ) {
        return jsonResponse(
          {
            success: false,
            message: "Format data tidak valid.",
          },
          400
        );
      }

      body = parsedBody as Record<string, unknown>;
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Format JSON tidak valid.",
        },
        400
      );
    }

    // =====================================
    // AMBIL DATA FORM
    // =====================================

    const nama = String(body.nama ?? "").trim();
    const whatsapp = String(body.whatsapp ?? "").trim();
    const doa = String(body.doa ?? "").trim();
    const untuk = String(body.untuk ?? "").trim();
    const kategori = String(body.kategori ?? "").trim();

    const persetujuan = body.persetujuan === true;

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
          message: "Mohon lengkapi semua kolom formulir.",
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
          message: "Ada isian yang terlalu panjang.",
        },
        400
      );
    }

    // =====================================
    // VALIDASI NOMOR WHATSAPP
    // =====================================

    const whatsappRegex = /^\+?[0-9\s()-]{8,25}$/;

    if (!whatsappRegex.test(whatsapp)) {
      return jsonResponse(
        {
          success: false,
          message: "Nomor WhatsApp tidak valid.",
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
          message: "Kategori doa tidak valid.",
        },
        400
      );
    }

    // =====================================
    // SIAPKAN DATA GOOGLE APPS SCRIPT
    // =====================================

    const params = new URLSearchParams({
      token: secretToken,
      nama,
      whatsapp,
      doa,
      untuk,
      kategori,
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
    // CEK STATUS HTTP
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

    // =====================================
    // BACA RESPONS JSON
    // =====================================

    let result: {
      success?: boolean;
      message?: string;
    };

    try {
      result = await response.json();
    } catch {
      console.error(
        "Google Apps Script tidak mengembalikan JSON.",
        "HTTP status:",
        response.status
      );

      return jsonResponse(
        {
          success: false,
          message: "Respons Google Apps Script tidak valid.",
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
        result.message ?? "Alasan tidak diketahui."
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
    // BERHASIL DISIMPAN
    // =====================================

    console.log(
      "Google Apps Script mengonfirmasi doa berhasil disimpan."
    );

    return jsonResponse({
      success: true,
      message: "Alhamdulillah, doa berhasil dikirim!",
    });
  } catch (error) {
    // =====================================
    // PENANGANAN ERROR
    // =====================================

    console.error("API Titip Doa error:", error);

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

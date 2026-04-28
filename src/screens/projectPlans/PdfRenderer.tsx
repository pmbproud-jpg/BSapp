/**
 * Renderer PDF dla podgladu planow budowy.
 * - Web: pdf.js z CDN, canvas + nawigacja stron
 * - Mobile: WebView z embedded HTML i pdf.js (jesli WebView dostepny),
 *           fallback do "Otwórz w przegladarce"
 * Wydzielony z ProjectPlans.tsx (Faza 2 step 1).
 */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Linking, Platform, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/src/providers/ThemeProvider";

// WebView z react-native-webview (platform-specific require). Brak typow.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WebView: any = null;
if (Platform.OS !== "web") {
  try { WebView = require("react-native-webview").default; } catch (e) {}
}

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

// pdf.js loaded from CDN — brak @types/pdfjs-dist, API lib traktujemy
// jako any (external unmanaged lib). Callers uzywaja tylko kilku metod.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadPdfJs(): Promise<any> {
  if (Platform.OS !== "web") return Promise.reject("Not web");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      const lib = w.pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
        resolve(lib);
      } else {
        reject("pdfjsLib not found");
      }
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// style akceptuje rozne shape'y na web/native; zostawiamy szeroko.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PdfRenderer({ url, style }: { url: string; style?: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvasRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { colors: tc } = useTheme();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setLoading(false);
      } catch (e) {
        console.error("PDF load error:", e);
        setError(true);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!pdfDoc || Platform.OS !== "web") return;
    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        console.error("PDF render error:", e);
      }
    })();
  }, [pdfDoc, currentPage]);

  if (Platform.OS !== "web") {
    const screenW = Dimensions.get("window").width;
    const pdfH = screenW * 1.414;
    if (WebView) {
      const pdfHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0}body{background:#f1f5f9}canvas{width:100%!important;height:auto!important;display:block}.loading{position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#64748b;font-size:14px;flex-direction:column;gap:8px}.error{color:#ef4444}</style></head><body><div class="loading" id="loader"><div>⏳</div><div>Ładowanie PDF...</div></div><canvas id="cv"></canvas><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script><script>pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";pdfjsLib.getDocument("${url}").promise.then(function(pdf){pdf.getPage(1).then(function(page){var vp=page.getViewport({scale:2});var cv=document.getElementById("cv");cv.width=vp.width;cv.height=vp.height;page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise.then(function(){document.getElementById("loader").style.display="none"})})}).catch(function(e){document.getElementById("loader").innerHTML='<div class="error">❌ PDF Fehler</div>'});<\/script></body></html>`;
      return (
        <View style={[{ width: screenW, height: pdfH }, style]}>
          <WebView
            source={{ html: pdfHtml }}
            style={{ flex: 1, backgroundColor: "#f1f5f9" }}
            scrollEnabled={false}
            scalesPageToFit={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={["*"]}
            mixedContentMode="always"
            allowFileAccess={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" }}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: "#64748b", marginTop: 8, fontSize: 13 }}>Ładowanie PDF...</Text>
              </View>
            )}
          />
        </View>
      );
    }
    return (
      <View style={[{ width: screenW, height: pdfH, backgroundColor: "#dfe6ed", justifyContent: "center", alignItems: "center" }, style]}>
        <Ionicons name="document-text-outline" size={40} color="#94a3b8" />
        <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "600", marginTop: 4 }}>PDF Plan</Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(url)}
          style={{ position: "absolute", bottom: 10, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 5 }}
        >
          <Ionicons name="open-outline" size={13} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 11 }}>PDF öffnen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[{ width: "100%", aspectRatio: 1.414, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, style]}>
        <ActivityIndicator size="large" color={tc.primary} />
        <Text style={{ color: tc.textMuted, marginTop: 8 }}>Ładowanie PDF...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[{ width: "100%", aspectRatio: 1.414, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, style]}>
        <Ionicons name="document-text" size={64} color="#ef4444" />
        <Text style={{ color: "#ef4444", fontSize: 16, fontWeight: "700", marginTop: 8 }}>PDF</Text>
        <Text style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Nie udało się załadować PDF</Text>
      </View>
    );
  }

  return (
    <View style={[{ width: "100%" }, style]}>
      {/* @ts-ignore - canvas is web-only */}
      <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
      {totalPages > 1 && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 8, marginTop: 4 }}>
          <TouchableOpacity
            onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            style={{ padding: 6 }}
          >
            <Ionicons name="chevron-back" size={20} color={currentPage <= 1 ? "#ccc" : tc.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 13, fontWeight: "600", color: tc.text }}>{currentPage} / {totalPages}</Text>
          <TouchableOpacity
            onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            style={{ padding: 6 }}
          >
            <Ionicons name="chevron-forward" size={20} color={currentPage >= totalPages ? "#ccc" : tc.primary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

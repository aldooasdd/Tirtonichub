package com.tirtonic.pos;

import android.app.Activity;
import android.app.Presentation;
import android.content.Context;
import android.hardware.display.DisplayManager;
import android.os.Bundle;
import android.print.PrintManager;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Pembungkus kasir iMin: layar utama = /pos, layar pembeli (display kedua) = /pos/layar.
 * Isi tetap dari server → update cukup deploy web; APK diganti hanya kalau bagian native berubah.
 */
public class MainActivity extends Activity {
    static final String BASE = "https://tirtonichub.com";

    private WebView web;
    private Presentation layar;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        CookieManager.getInstance().setAcceptCookie(true);

        web = makeWebView(this);
        // window.print() diabaikan WebView → arahkan ke print Android (printer bawaan iMin via print service).
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void print() {
                runOnUiThread(() -> ((PrintManager) getSystemService(Context.PRINT_SERVICE))
                        .print("Struk", web.createPrintDocumentAdapter("Struk"), null));
            }
        }, "TirtonicPos");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) {
                v.evaluateJavascript("window.print=function(){TirtonicPos.print()}", null);
            }
        });
        setContentView(web);
        web.loadUrl(BASE + "/pos");
        showLayar();
    }

    /** Layar pembeli. Satu proses & profil WebView → BroadcastChannel dari /pos sampai ke sini. */
    private void showLayar() {
        Display[] ds = ((DisplayManager) getSystemService(Context.DISPLAY_SERVICE))
                .getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION);
        if (ds.length == 0) return;
        layar = new Presentation(this, ds[0]);
        WebView w = makeWebView(layar.getContext());
        w.setWebViewClient(new WebViewClient());
        w.loadUrl(BASE + "/pos/layar");
        layar.setContentView(w);
        layar.show();
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private static WebView makeWebView(Context c) {
        WebView w = new WebView(c);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // video campaign autoplay
        return w;
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        // Layar penuh: sembunyikan status & navigation bar (geser dari tepi untuk memunculkan).
        if (focus) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush(); // sesi kasir tetap login setelah restart
    }

    @Override
    protected void onDestroy() {
        if (layar != null) layar.dismiss();
        super.onDestroy();
    }
}

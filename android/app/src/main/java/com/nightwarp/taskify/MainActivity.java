package com.nightwarp.taskify;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Exposed to JavaScript as window.AndroidInsets.
     * getStatusBarHeight() is synchronous — JS can call it before React mounts
     * and receive the correct value immediately, avoiding any layout flash.
     */
    public class InsetsInterface {
        @JavascriptInterface
        public int getStatusBarHeight() {
            // Android resources give physical pixels; divide by density to get CSS px (= dp).
            float density = getResources().getDisplayMetrics().density;
            int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
            int px = id > 0 ? getResources().getDimensionPixelSize(id) : 0;
            return Math.round(px / density);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Expose synchronous insets interface to JS. Added before page load so it
        // is available at the very first line of entry.tsx.
        getBridge().getWebView().addJavascriptInterface(new InsetsInterface(), "AndroidInsets");

        // Also push live updates once the actual window layout is known. This
        // handles cutouts, orientation changes, and gesture nav bar height.
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            float density = getResources().getDisplayMetrics().density;
            int statusPx = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int navPx    = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            int statusDp = Math.round(statusPx / density);
            int navDp    = Math.round(navPx / density);
            String js =
                "document.documentElement.style.setProperty('--status-bar-height','" + statusDp + "px');" +
                "document.documentElement.style.setProperty('--nav-bar-height','" + navDp + "px');";
            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript(js, null)
            );
            return ViewCompat.onApplyWindowInsets(v, insets);
        });
    }
}

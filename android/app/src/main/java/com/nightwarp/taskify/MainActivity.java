package com.nightwarp.taskify;

import android.os.Bundle;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Forward system bar insets to the WebView as CSS custom properties so
        // the web layer can apply appropriate padding without fighting edge-to-edge.
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            int statusBar = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int navBar    = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript(
                    "document.documentElement.style.setProperty('--status-bar-height','" + statusBar + "px');" +
                    "document.documentElement.style.setProperty('--nav-bar-height','"    + navBar    + "px');",
                    null
                )
            );
            return ViewCompat.onApplyWindowInsets(v, insets);
        });
    }
}

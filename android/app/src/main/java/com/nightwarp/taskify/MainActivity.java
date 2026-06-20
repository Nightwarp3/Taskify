package com.nightwarp.taskify;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Let the WebView draw edge-to-edge. CSS env(safe-area-inset-*) in the
        // renderer then provides the correct padding without any JS bridge.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}

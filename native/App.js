// Open Edition — native shell for Expo Go.
// Loads the live app (openedition.vercel.app/app) full screen. The web app does the work;
// this shell adds: a real status bar that follows Light/Black, the native share sheet
// (photos go to iMessage/WhatsApp as files), outside links opening in their own apps,
// Android back, pull to refresh, and a calm screen when there's no signal.
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const HOST = 'https://openedition.vercel.app';
const START = HOST + '/app';

// Runs inside the page before it loads: tells the shell when the theme changes,
// and gives the page a share() that hands photos to the phone's share sheet.
const BRIDGE = `
(function () {
  function post(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function theme() { post({ type: 'theme', value: document.documentElement.getAttribute('data-theme') || 'gallery' }); }
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('DOMContentLoaded', theme);
  navigator.canShare = function (d) { return !!d; };
  navigator.share = function (d) {
    d = d || {};
    var f = d.files && d.files[0];
    if (!f) { post({ type: 'share', text: d.text || '', url: d.url || '' }); return Promise.resolve(); }
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { post({ type: 'share', text: d.text || '', file: { name: f.name, type: f.type, data: String(r.result).split(',')[1] } }); res(); };
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  };
})();
true;
`;

const isOurs = (url) => url.startsWith(HOST) || url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:');

function Shell() {
  const web = useRef(null);
  const [dark, setDark] = useState(false);
  const [offline, setOffline] = useState(false);
  const [canBack, setCanBack] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canBack && web.current) { web.current.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canBack]);

  const onMessage = async (e) => {
    let m; try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'theme') setDark(m.value === 'night');
    if (m.type === 'share') {
      try {
        if (m.file && (await Sharing.isAvailableAsync())) {
          const out = new File(Paths.cache, m.file.name || 'open-edition.jpg');
          if (out.exists) out.delete();
          out.create();
          out.write(m.file.data, { encoding: 'base64' });
          await Sharing.shareAsync(out.uri, { mimeType: m.file.type || 'image/jpeg', dialogTitle: m.text || 'Open Edition' });
        } else {
          await Share.share({ message: [m.text, m.url].filter(Boolean).join('\n') });
        }
      } catch {}
    }
  };

  const bg = dark ? '#0E0E0D' : '#FFFFFF';
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: bg }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {offline ? (
        <View style={[styles.fill, styles.center, { backgroundColor: bg }]}>
          <Text style={[styles.mono, { color: dark ? '#8E8B85' : '#6F6C67' }]}>NO SIGNAL</Text>
          <Text style={[styles.title, { color: dark ? '#F2F2EE' : '#1C1C1A' }]}>Open Edition needs a connection to open.</Text>
          <Text style={[styles.body, { color: dark ? '#8E8B85' : '#6F6C67' }]}>Photos you already took are safe on your phone and post once you’re back online.</Text>
          <Pressable onPress={() => { setOffline(false); web.current && web.current.reload(); }} style={[styles.btn, { backgroundColor: dark ? '#F2F2EE' : '#1C1C1A' }]}>
            <Text style={{ color: bg, fontSize: 16, fontWeight: '600' }}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={web}
        source={{ uri: START }}
        style={[styles.fill, { backgroundColor: bg, display: offline ? 'none' : 'flex' }]}
        injectedJavaScriptBeforeContentLoaded={BRIDGE}
        onMessage={onMessage}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        allowFileAccess
        setSupportMultipleWindows={false}
        bounces={false}
        overScrollMode="never"
        decelerationRate="normal"
        onNavigationStateChange={(s) => setCanBack(s.canGoBack)}
        onShouldStartLoadWithRequest={(req) => {
          if (isOurs(req.url) || req.url.includes('.blob.vercel-storage.com')) return true;
          Linking.openURL(req.url).catch(() => {}); // wa.me, sms:, Instagram, Spotify, Maps
          return false;
        }}
        onError={() => setOffline(true)}
        onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setOffline(true); }}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'flex-start', justifyContent: 'center', padding: 28, gap: 12 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 11, letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: '600', letterSpacing: -0.6, lineHeight: 34 },
  body: { fontSize: 15, lineHeight: 21 },
  btn: { marginTop: 12, height: 52, paddingHorizontal: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
});

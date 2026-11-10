import { MapPeoplePicker } from './MapPeoplePicker';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type RefAttributes,
} from 'react';
import { AppState, Linking, StyleSheet, TurboModuleRegistry, View } from 'react-native';
import type WebView from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';
import { colors } from '../../../shared/theme/colors';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { isMapAttributionLink, isMapDocument, mapDocumentBaseUrl } from '../models/mapSource';
import { mapDocument } from '../models/mapDocument';
import { mapConnectionError, mapResourceFailure } from '../models/mapFailure';
import type { MapCanvasProps, MapCommand } from '../models/map';
import { MapStatus } from './MapStatus';
import { MapControls } from './MapControls';
const source = { html: mapDocument, baseUrl: mapDocumentBaseUrl };
function openAttribution(url: string) {
  if (isMapAttributionLink(url)) void Linking.openURL(url).catch(() => {});
}
export const MapCanvas = memo(function MapCanvas(props: MapCanvasProps) {
  const { t } = useTranslation();
  const [cluster, setCluster] = useState<string[]>([]);

  const [Renderer, setRenderer] = useState<ComponentType<
    WebViewProps & RefAttributes<WebView>
  > | null>(null);
  const view = useRef<WebView>(null);
  const sequence = useRef(0);
  const sentTrail = useRef<MapCanvasProps['state']['trail'] | undefined>(undefined);
  const sentSharedTrail = useRef<MapCanvasProps['sharedTrail']>(undefined);
  const sentUsers = useRef<MapCanvasProps['users']>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState('');
  const positionLabel = t('Your GPS position');
  const reducedMotion = useReducedMotion() !== false;
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!TurboModuleRegistry.get('RNCWebViewModule')) throw new Error('WebView unavailable');
        return import('react-native-webview');
      })
      .then((module) => {
        if (active) setRenderer(() => module.WebView);
      })
      .catch(() => {
        if (active)
          setError(
            'Rebuild the installed app with npx expo run:android (or run:ios) to enable the map. No map API key is needed.',
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!Renderer || ready || error) return;
    const timer = setTimeout(
      () => setError('The map could not load. Check your internet connection and retry.'),
      25000,
    );
    return () => clearTimeout(timer);
  }, [Renderer, ready, error, attempt]);
  useEffect(() => {
    if (initialized && props.active !== false) {
      view.current?.postMessage(
        JSON.stringify({
          id: ++sequence.current,
          type: 'state',
          language: props.state.language,
          testUserCount: props.state.testUserCount,
          positionLabel,
          reducedMotion,
          live: props.state.live,
          ...(sentSharedTrail.current !== props.sharedTrail
            ? { sharedTrail: props.sharedTrail ?? [] }
            : {}),
          ...(sentTrail.current !== props.state.trail ? { trail: props.state.trail } : {}),
          ...(sentUsers.current !== props.users ? { users: props.users ?? [] } : {}),
          focus: props.focus ?? null,
        }),
      );
      sentTrail.current = props.state.trail;
      sentUsers.current = props.users;
      sentSharedTrail.current = props.sharedTrail;
    }
  }, [
    props.active,
    initialized,
    positionLabel,
    props.state.language,
    props.state.testUserCount,
    props.state.live,
    props.state.trail,
    props.users,
    props.sharedTrail,
    props.focus,
    reducedMotion,
  ]);
  const fail = () => {
    setReady(false);
    // A later generic renderer error must not hide the actionable certificate error.
    setError((current) => current || mapConnectionError);
  };
  const retry = useCallback(() => {
    setReady(false);
    sentTrail.current = undefined;
    sentSharedTrail.current = undefined;
    sentUsers.current = undefined;
    setInitialized(false);
    setError('');
    setAttempt((value) => value + 1);
  }, []);
  useEffect(() => {
    if (!error || !Renderer) return;
    // Retry after the user returns from fixing connectivity or date/time in Settings.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retry();
    });
    return () => subscription.remove();
  }, [error, Renderer, retry]);
  const send = (command: MapCommand) => {
    if (initialized && !error)
      view.current?.postMessage(
        JSON.stringify({ id: ++sequence.current, type: 'command', command }),
      );
  };
  return (
    <View style={styles.container}>
      {Renderer && (
        <Renderer
          key={attempt}
          ref={view}
          source={source}
          style={styles.map}
          originWhitelist={['*']}
          javaScriptEnabled
          geolocationEnabled={false}
          allowFileAccess={false}
          mixedContentMode="never"
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          cacheEnabled
          applicationNameForUserAgent="GoogleMap-OpenStreetMap/1.0"
          scrollEnabled={false}
          bounces={false}
          onError={fail}
          onLoadSubResourceError={({ nativeEvent }) => {
            const failure = mapResourceFailure(nativeEvent.url, nativeEvent.code);
            if (failure) {
              setReady(false);
              setError(failure);
            }
          }}
          onRenderProcessGone={fail}
          onContentProcessDidTerminate={fail}
          onShouldStartLoadWithRequest={(request) => {
            if (isMapDocument(request.url)) return true;
            openAttribution(request.url);
            return false;
          }}
          onOpenWindow={(event) => openAttribution(event.nativeEvent.targetUrl)}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data);
              if (
                message.type === 'select-users' &&
                Array.isArray(message.userIds) &&
                message.userIds.length <= 500 &&
                message.userIds.every((id: unknown) => typeof id === 'string')
              ) {
                setCluster(message.userIds);
              } else if (message.type === 'select-user' && typeof message.userId === 'string') {
                props.onSelectUser?.(message.userId);
              } else if (message.type === 'initialized') {
                setInitialized(true);
              } else if (message.type === 'ready') {
                setInitialized(true);
                setError('');
                setReady(true);
              } else if (message.type === 'fatal') fail();
            } catch {
              /* Ignore unrelated messages. */
            }
          }}
        />
      )}
      {(!ready || error) && <MapStatus error={error} retry={error ? retry : undefined} />}
      <MapPeoplePicker
        users={
          cluster.length ? (props.users ?? []).filter((user) => cluster.includes(user.id)) : []
        }
        open={cluster.length > 0}
        onClose={() => setCluster([])}
        onSelect={(id) => {
          setCluster([]);
          props.onSelectUser?.(id);
        }}
      />
      <MapControls {...props} ready={initialized && !error} send={send} />
    </View>
  );
});
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1, backgroundColor: colors.background },
});

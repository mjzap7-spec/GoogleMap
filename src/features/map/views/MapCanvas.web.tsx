import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { mapDocument } from '../models/mapDocument';
import type { MapCanvasProps, MapCommand } from '../models/map';
import { MapControls } from './MapControls';
import { MapStatus } from './MapStatus';
export const MapCanvas = memo(function MapCanvas(props: MapCanvasProps) {
  const { t } = useTranslation();

  const onSelectUser = useRef(props.onSelectUser);
  useEffect(() => {
    onSelectUser.current = props.onSelectUser;
  }, [props.onSelectUser]);
  const frame = useRef<HTMLIFrameElement>(null);
  const sequence = useRef(0);
  const sentTrail = useRef<MapCanvasProps['state']['trail'] | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const positionLabel = t('Your GPS position');
  const reducedMotion = useReducedMotion() !== false;
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'select-user' && typeof message.userId === 'string') {
          onSelectUser.current?.(message.userId);
        } else if (message.type === 'initialized') {
          setInitialized(true);
        } else if (message.type === 'ready') {
          setInitialized(true);
          setReady(true);
          setError('');
        } else if (message.type === 'fatal')
          setError('Could not load the map. Check your connection and retry.');
      } catch {
        /* Ignore unrelated messages. */
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  useEffect(() => {
    if (ready || error) return;
    const timer = setTimeout(
      () => setError('The map could not load. Check your connection and retry.'),
      25000,
    );
    return () => clearTimeout(timer);
  }, [ready, error, attempt]);
  useEffect(() => {
    if (initialized) {
      frame.current?.contentWindow?.postMessage(
        JSON.stringify({
          id: ++sequence.current,
          type: 'state',
          language: props.state.language,
          positionLabel,
          reducedMotion,
          live: props.state.live,
          ...(sentTrail.current !== props.state.trail ? { trail: props.state.trail } : {}),
          users: props.users ?? [],
          focus: props.focus ?? null,
        }),
        '*',
      );
      sentTrail.current = props.state.trail;
    }
  }, [
    initialized,
    positionLabel,
    props.state.language,
    props.state.live,
    props.state.trail,
    props.users,
    props.focus,
    reducedMotion,
  ]);
  const send = (command: MapCommand) => {
    if (ready)
      frame.current?.contentWindow?.postMessage(
        JSON.stringify({ id: ++sequence.current, type: 'command', command }),
        '*',
      );
  };
  return (
    <View style={styles.container}>
      <iframe
        key={attempt}
        ref={frame}
        title={t('Interactive OpenStreetMap profile map')}
        srcDoc={mapDocument}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        style={{ width: '100%', height: '100%', border: 0 }}
      />
      {(!ready || error) && (
        <MapStatus
          error={error}
          retry={
            error
              ? () => {
                  setReady(false);
                  sentTrail.current = undefined;
                  setInitialized(false);
                  setError('');
                  setAttempt((value) => value + 1);
                }
              : undefined
          }
        />
      )}
      <MapControls {...props} ready={ready && !error} send={send} />
    </View>
  );
});
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background } });

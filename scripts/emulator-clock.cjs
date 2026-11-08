const MAX_CLOCK_DRIFT_MS = 120000;

/** AVD clocks can fall behind after the computer sleeps or a snapshot is resumed. */
function refreshEmulatorClock(adb, serial, { now = Date.now, log = console.log } = {}) {
  if (!/^emulator-\d+$/.test(serial)) return;
  const shell = (...args) => adb(['-s', serial, 'shell', ...args], { timeout: 8000 }).trim();
  const drift = () => {
    const seconds = shell('date', '+%s');
    if (!/^\d+$/.test(seconds)) throw new Error('Unrecognized emulator clock');
    return Math.abs(Number(seconds) * 1000 - now());
  };
  try {
    if (drift() <= MAX_CLOCK_DRIFT_MS) return;
    if (shell('settings', 'get', 'global', 'auto_time') !== '1') {
      log(`${serial}: enable automatic date and time in Android Settings to load secure maps.`);
      return;
    }
    shell('cmd', 'network_time_update_service', 'force_refresh');
    if (drift() > MAX_CLOCK_DRIFT_MS) throw new Error('Network time is still out of sync');
    log(`${serial}: refreshed automatic date and time.`);
  } catch {
    // Older system images or an offline emulator must still be able to open the app.
    log(
      `${serial}: could not verify clock sync. If maps fail, check Android date/time and network.`,
    );
  }
}

module.exports = { refreshEmulatorClock };

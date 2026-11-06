const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const {
  GuardContextProvider,
  useGuardRedirect,
} = require('expo-router/build/layouts/GuardContext');

// Exercise the app's stack declarations and the installed router's guard resolver without a device.
const source = ts.transpileModule(
  fs.readFileSync(require.resolve('../src/navigation/AuthNavigator.tsx'), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  },
).outputText;
function destination(user, route) {
  function Probe() {
    return useGuardRedirect(route) ?? route;
  }
  function Stack({ children }) {
    const guardedRedirects = new Map();
    const routes = [];
    React.Children.forEach(children, (entry) => {
      const group = entry.type === Stack.Protected;
      React.Children.forEach(group ? entry.props.children : entry, (screen) => {
        const name = screen.props.name;
        routes.push({ route: name, contextKey: './' + name + '.tsx' });
        if (group && !entry.props.guard) guardedRedirects.set(name, entry.props.redirectTo);
      });
    });
    const node = {
      type: 'layout',
      children: routes,
      loadRoute: () => ({ unstable_settings: { anchor: 'index' } }),
    };
    return React.createElement(
      GuardContextProvider,
      { node, guardedRedirects },
      React.createElement(Probe),
    );
  }
  Stack.Protected = 'protected-group';
  Stack.Screen = 'screen';
  const imports = {
    'react-native': { Platform: { OS: 'android' } },
    'expo-router': { Stack },
    '../features/auth/bindings/useSession': {
      useSession: () => ({ state: { user, loading: false } }),
    },
    '../features/auth/views/SessionLoadingView': { SessionLoadingView: () => null },
    '../shared/motion/useReducedMotion': { useReducedMotion: () => true },
    '../shared/motion/tokens': { motion: {} },
    '../shared/theme/colors': { colors: {} },
    './AuthenticatedShell': { AuthenticatedShell: ({ children }) => children },
    '../bootstrap/splash': { hideLaunchScreen() {} },
  };
  const context = { exports: {}, require: (name) => imports[name] ?? require(name) };
  vm.runInNewContext(source, context);
  return renderToStaticMarkup(React.createElement(context.exports.AuthNavigator));
}

test('signed-out launches and sign-out from Settings resolve to Sign in with Help present', () => {
  assert.equal(destination(null, 'index'), '/sign-in');
  assert.equal(destination(null, 'profile'), '/sign-in');
  assert.equal(destination(null, 'sign-in'), 'sign-in');
  assert.equal(destination(null, 'help'), 'help');
});
test('signed-in launches and completed sign-in use the Map entry, keeping profile setup and Help reachable', () => {
  const user = { id: 'test-user' };
  assert.equal(destination(user, 'sign-in'), '/');
  for (const route of ['index', 'profile', 'help']) assert.equal(destination(user, route), route);
});

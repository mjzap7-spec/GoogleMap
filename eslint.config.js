const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

function restrict(group, message) {
  return { 'no-restricted-imports': ['error', { patterns: [{ group, message }] }] };
}

const backend = ['firebase', 'firebase/*', '@firebase/*', '**/config/**', '**/data/**'];
const presentation = [
  'react',
  'react/*',
  'react-native',
  'react-native/*',
  'expo*',
  '**/views/**',
  '**/screens/**',
  '**/bindings/**',
  '**/bootstrap/**',
  '**/navigation/**',
  '**/shared/ui/**',
  '**/shared/motion/**',
  '**/shared/theme/**',
];

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', '.test-build/**', '.expo/**', '.expo-export-check/**'] },
  {
    files: ['scripts/**/*.cjs', 'tests/**/*.cjs'],
    languageOptions: { globals: { __dirname: 'readonly' } },
  },
  {
    files: ['src/features/*/models/**/*.ts'],
    rules: restrict(
      [...backend, ...presentation, '**/viewmodels/**'],
      'Models contain domain types and rules only; they cannot depend on UI, ViewModels, or infrastructure.',
    ),
  },
  {
    files: ['src/features/*/viewmodels/**/*.ts', 'src/features/*/bindings/dependencies.ts'],
    rules: restrict(
      [...backend, ...presentation],
      'ViewModels and their factory depend on model contracts and shared MVVM code only.',
    ),
  },
  {
    files: ['src/features/*/views/**/*.{ts,tsx}'],
    rules: restrict(
      [
        ...backend,
        '**/models/validation',
        '**/models/AuthFailure',
        '**/bindings/**',
        '**/screens/**',
        '**/bootstrap/**',
        '**/navigation/**',
        'expo-router',
        'expo-router/*',
      ],
      'Views render snapshots and invoke commands; bind dependencies and navigation in screens instead.',
    ),
  },
  {
    files: ['src/features/*/bindings/**/*.{ts,tsx}'],
    rules: restrict(
      [...backend, '**/views/**', '**/screens/**', '**/bootstrap/**', '**/navigation/**'],
      'React bindings receive injected dependencies; they must not construct backend or UI adapters.',
    ),
  },
  {
    files: ['src/features/*/data/**/*.ts'],
    rules: restrict(
      [
        'react',
        'react/*',
        'react-native',
        'react-native/*',
        '**/views/**',
        '**/viewmodels/**',
        '**/bindings/**',
        '**/screens/**',
        '**/bootstrap/**',
        '**/navigation/**',
        '**/shared/ui/**',
        '**/shared/motion/**',
      ],
      'Data adapters implement model contracts and must not depend on presentation or ViewModels.',
    ),
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: restrict(
      [
        '**/features/**',
        '**/config/**',
        '**/bootstrap/**',
        '**/navigation/**',
        'firebase',
        'firebase/*',
        '@firebase/*',
      ],
      'Shared components must remain independent of app features and backend configuration.',
    ),
  },
  {
    files: ['src/shared/mvvm/**/*.ts'],
    rules: restrict(
      [...backend, ...presentation, '**/features/**'],
      'Shared MVVM primitives are framework-independent.',
    ),
  },
  {
    files: [
      'src/app/**/*.{ts,tsx}',
      'src/features/*/screens/**/*.{ts,tsx}',
      'src/navigation/**/*.{ts,tsx}',
    ],
    rules: restrict(
      backend,
      'Routes and screens compose presentation; backend selection belongs in bootstrap.',
    ),
  },
]);

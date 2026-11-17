import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['dist', 'node_modules', 'public'] }, js.configs.recommended, ...tseslint.configs.recommended, {
  rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-empty': ['error', { allowEmptyCatch: true }] },
},
  { files: ['scripts/**'], languageOptions: { globals: { console: 'readonly' } } },
);

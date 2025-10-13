import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 允许使用 any 类型（临时解决方案）
      '@typescript-eslint/no-explicit-any': 'warn',
      // 允许未使用的变量（临时解决方案）
      '@typescript-eslint/no-unused-vars': 'warn',
      // 允许未使用的 React hooks 依赖
      'react-hooks/exhaustive-deps': 'warn',
      // 允许未转义的引号
      'react/no-unescaped-entities': 'warn',
      // 允许使用 img 标签
      '@next/next/no-img-element': 'warn',
      // 允许图片没有 alt 属性
      'jsx-a11y/alt-text': 'warn',
      // 允许 require 导入
      '@typescript-eslint/no-require-imports': 'warn',
      // 允许注释在 children 中
      'react/jsx-no-comment-textnodes': 'warn'
    }
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;

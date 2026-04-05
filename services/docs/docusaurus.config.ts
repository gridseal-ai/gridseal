import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'GridSeal SDK',
  tagline: 'Tamper-evident audit trails for AI decisions',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.gridseal.ai',
  baseUrl: '/',

  organizationName: 'celestir',
  projectName: 'gridseal',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'GridSeal SDK',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'sdkSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/celestir/gridseal',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/getting-started',
            },
            {
              label: 'Core Concepts',
              to: '/core-concepts',
            },
          ],
        },
        {
          title: 'SDKs',
          items: [
            {
              label: 'Node.js SDK',
              to: '/node/openai',
            },
            {
              label: 'Python SDK',
              to: '/python/openai',
            },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Gridseal by Celestir. AGPL-3.0.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'python'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

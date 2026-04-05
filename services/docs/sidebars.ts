import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  sdkSidebar: [
    'intro',
    'getting-started',
    'core-concepts',
    {
      type: 'category',
      label: 'Node.js SDK',
      items: [
        'node/openai',
        'node/anthropic',
        'node/anthropic-tool-use',
        'node/http',
        'node/mcp',
      ],
    },
    {
      type: 'category',
      label: 'Python SDK',
      items: [
        'python/openai',
        'python/anthropic',
      ],
    },
    'type-reference',
  ],
};

export default sidebars;

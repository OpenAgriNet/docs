import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'OpenAgriNet',
    description: 'Architecture documentation for OpenAgriNet — an open agricultural information network',
    base: '/docs/',

    srcExclude: ['superpowers/**'],

    themeConfig: {
      nav: [
        { text: 'Getting Started', link: '/getting-started' },
        { text: 'Architecture', link: '/architecture/' },
        { text: 'Glossary', link: '/architecture/glossary' }
      ],

      sidebar: {
        '/getting-started': [
          {
            text: 'Getting Started',
            items: [
              { text: 'Installation & Setup', link: '/getting-started' }
            ]
          }
        ],
        '/architecture/': [
          {
            text: 'Architecture',
            items: [
              { text: 'Overview', link: '/architecture/' },
              { text: 'Glossary', link: '/architecture/glossary' },
              { text: 'Pydantic Models', link: '/architecture/pydantic-models' },
              { text: 'Agentic Architecture', link: '/architecture/agentic-architecture' },
              { text: 'Regional Variants', link: '/architecture/variants' },
              { text: 'Voice OAN API', link: '/architecture/voice-oan-api' }
            ]
          }
        ]
      },

      socialLinks: [
        { icon: 'github', link: 'https://github.com/OpenAgriNet' }
      ]
    }
  })
)

import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'OpenAgriNet',
    description: 'Architecture documentation for OpenAgriNet — an open agricultural information network',

    srcExclude: ['superpowers/**'],

    themeConfig: {
      nav: [
        { text: 'Architecture', link: '/architecture/' },
        { text: 'Glossary', link: '/architecture/glossary' }
      ],

      sidebar: {
        '/architecture/': [
          {
            text: 'Architecture',
            items: [
              { text: 'Overview', link: '/architecture/' },
              { text: 'Glossary', link: '/architecture/glossary' },
              { text: 'Pydantic Models', link: '/architecture/pydantic-models' },
              { text: 'Regional Variants', link: '/architecture/variants' }
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

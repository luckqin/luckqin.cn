(window.webpackJsonp=window.webpackJsonp||[]).push([[6],{RXBc:function(e,t,a){"use strict";a.r(t);var l=a("xwgP"),n=a.n(l),r=a("Wbzz"),o=a("6Gk8"),i=a("Bl7J"),c=a("vrFN");t.default=function(e){var t,a=e.data,l=e.location,s=(null===(t=a.site.siteMetadata)||void 0===t?void 0:t.title)||"Title",m=a.allMarkdownRemark.nodes;return 0===m.length?n.a.createElement(i.a,{location:l,title:s},n.a.createElement(c.a,{title:"HOME"}),n.a.createElement(o.a,null),n.a.createElement("p",null,'No blog posts found. Add markdown posts to "content/blog" (or the directory you specified for the "gatsby-source-filesystem" plugin in gatsby-config.js).')):n.a.createElement(i.a,{location:l,title:s},n.a.createElement(c.a,{title:"HOME"}),n.a.createElement(o.a,null),n.a.createElement("ol",{style:{listStyle:"none"}},m.map((function(e){var t=e.frontmatter.title||e.fields.slug;return n.a.createElement("li",{key:e.fields.slug},n.a.createElement("article",{className:"post-list-item",itemScope:!0,itemType:"http://schema.org/Article"},n.a.createElement("header",null,n.a.createElement("h2",null,n.a.createElement(r.Link,{to:e.fields.slug,style:{boxShadow:"none"}},n.a.createElement("span",{itemProp:"headline"},t))),n.a.createElement("small",null,e.frontmatter.date)),n.a.createElement("section",null,n.a.createElement("p",{dangerouslySetInnerHTML:{__html:e.frontmatter.description||e.excerpt},itemProp:"description"}))))}))))}}}]);
//# sourceMappingURL=component---src-pages-index-js-b689ced498bed11300c3.js.map